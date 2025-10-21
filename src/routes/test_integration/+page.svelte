<script lang="ts">
    import { GetItemCommand } from "@aws-sdk/client-dynamodb";
    import {
        initializeTooling,
        SessionState,
        State,
        waitForTooling,
    } from "$lib/state.js";
    import { unmarshall } from "@aws-sdk/util-dynamodb";
    import type { Game } from "$lib/types/game.js";
    import { onMount } from "svelte";
    import { page } from "$app/state";
    import {
        detectAdBlockEnabled,
        getCommitHash,
        trackClick,
    } from "$lib/helpers.js";
    import { browser } from "$app/environment";
    import { initializeAds } from "$lib/adSlotConfig.js";
    import Ad from "$lib/components/Ad.svelte";
    import type { Tokens } from "$lib/authentication.js";

    let game: Game | null = $state(null);
    let adblock = $state(false);
    let error: string | null = $state(null);
    let withoutSupportingTimer = $state(15);
    let continued = $state(false);
    let isAHost = $state(true);

    async function fetchGameData() {
        console.log("[R][PLAY][fetchGameData] Fetching game data");
        if (!browser) {
            console.log("[R][PLAY][fetchGameData] Not on browser, skipping");
            return;
        }
        const searchParam = page.url.searchParams;
        const gameID = searchParam.get("gameID");
        if (!gameID) {
            error = "Missing gameID query parameter";
            return;
        }
        isAHost = State.isAHost();
        const dbparams = {
            TableName: "games_list",
            Key: {
                gameID: { S: gameID },
            },
        };
        const getItemCommand = new GetItemCommand(dbparams);
        if (!SessionState.dynamoDBClient) {
            console.log("[R][PLAY][fetchGameData] Need to wait for tooling");
            await waitForTooling();
        }
        if (!SessionState.dynamoDBClient) {
            error = "DynamoDB client not initialized";
            return;
        }
        const client = SessionState.dynamoDBClient;
        const response = await client.send(getItemCommand);
        if (!response.Item) {
            error = "Game not found";
            return;
        }
        const unmarshalled = unmarshall(response.Item) as Game;
        game = unmarshalled;
        loading = false;
        adblock = await detectAdBlockEnabled();
        console.log("[R][PLAY][fetchGameData] Adblock detected:", adblock);
    }
    let loading = $state(true);
    let iframe = $state(null as null | HTMLIFrameElement);
    let application: any = null;
    let adContinued = $state(false);
    let commitHash = $state("");

    let adsEnabled = $state(false);
    let adBlock = $state(false);
    let adSlots = $state<{
        sidebar: string;
        grid: string;
        footer: string;
    } | null>(null);

    // Manual src chooser for integration testing
    let chosenSrc = $state<string | null>(null);
    const TOKEN_STORAGE_KEY = 'ccported_tokens';
    function getStoredTokens(): Tokens | null {
        try {
            const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return {
                accessToken: parsed?.accessToken,
                idToken: parsed?.idToken,
                refreshToken: parsed?.refreshToken
            } as Tokens;
        } catch {
            return null;
        }
    }
    function getChosenOrigin(): string | null {
        try {
            return chosenSrc ? new URL(chosenSrc).origin : null;
        } catch {
            return null;
        }
    }
    onMount(async () => {
        await initializeTooling();
        // Prefer ?src=... from query string; if missing, prompt for a URL
        const srcParam = page.url.searchParams.get('src');
        if (srcParam && srcParam.trim().length > 0) {
            chosenSrc = srcParam.trim();
        } else if (browser) {
            const fallback = 'http://localhost:8080/index.html';
            const input = window.prompt('Enter iframe src URL to test (leave blank to use default)', fallback);
            chosenSrc = input && input.trim().length > 0 ? input.trim() : fallback;
        }
    });

    function updateIframe(server: {
        address: string;
        path: string;
        index: number;
        name: string;
    }) {
        console.log("[R][PLAY][updateIframe] Updating to", server);
        if (server.name == State.currentServer.name) return;
        if (!iframe || !game || !browser) return;
        const serverHost = server.address.split(",")[0];
        // Note: This updateIframe function seems to use a different server format than our Server interface
        // For now, keeping the IP address detection logic here until we clarify the server parameter structure
        const isIpAddress = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(
            serverHost,
        );
        const protocol = isIpAddress
            ? "http"
            : window.isSecureContext
              ? "https"
              : "http";
        iframe.src = `${protocol}://${serverHost}/${server.path}${game.gameID}/index.html`;
        let query = page.url.searchParams;
        query.set("server", server.name);
        var url = new URL(page.url);
        url.search = query.toString();
        window.history.pushState({}, "", url);
    }

    // Setup iframe load and message handling after game is loaded
    $effect(() => {
        if (chosenSrc && !error) {
            // Wait for DOM to update
            setTimeout(() => {
                if (!iframe) return;
                iframe.addEventListener("load", async (e) => {
                    if (!iframe) return;
                    const w = iframe.contentWindow;
                    if (!w) return;
                    if (!SessionState.awsReady) {
                        await waitForTooling();
                    }
                    const stored = getStoredTokens();
                    if (stored && (stored.idToken || stored.accessToken)) {
                        console.log(
                            "[R][PLAY][updateIframe] Iframe loaded. User logged in: true",
                        );
                        try {
                            const tokens: Tokens = stored as Tokens;
                            const targetOrigin = getChosenOrigin() || "*";
                            w.postMessage({
                                action: "SET_TOKENS",
                                content: tokens,
                            }, targetOrigin);
                        } catch (err) {
                            console.error("Error sending tokens:", err);
                        }
                    } else {
                        console.log(
                            "[R][PLAY][updateIframe] Iframe loaded. User not logged in.",
                        );
                    }
                    iframe.focus();
                });
            }, 0);

            // Secure message handling from iframes
            if (browser) {
                window.addEventListener("message", async (event) => {
                    try {
                        if (!event.data.fromInternal) return;
                        const allowedOrigins = [
                            ...State.servers.map((s) => `https://${s.hostname}`),
                        ];
                        const chosenOrigin = getChosenOrigin();
                        if (chosenOrigin) allowedOrigins.push(chosenOrigin);
                        if (
                            ![
                                "http://localhost:5173",
                                ...allowedOrigins,
                            ].includes(event.origin)
                        ) {
                            console.warn(
                                `[R][PLAY][updateIframe][message] Rejected message from unauthorized origin: ${event.origin}`,
                            );
                            return;
                        }

                        const data = event.data;

                        if (data.action === "GET_TOKENS") {
                            // Prepare response with the same requestId
                            const response: any = {
                                requestId: data.requestId,
                            };

                            const stored = getStoredTokens();
                            if (stored && (stored.idToken || stored.accessToken)) {
                                console.log(
                                    "[R][PLAY][updateIframe][message-GET_TOKENS] User logged in, sending tokens",
                                );
                                try {
                                    const tokens: Tokens = stored as Tokens;
                                    response.action = "SET_TOKENS";
                                    response.content = tokens;
                                } catch (error) {
                                    console.error(
                                        "Error getting user tokens:",
                                        error,
                                    );
                                    response.action = "ERROR";
                                    response.error =
                                        "Failed to get user tokens";
                                }
                            } else {
                                // Try waiting for tooling/user
                                await initializeTooling();
                                const stored2 = getStoredTokens();
                                if (stored2 && (stored2.idToken || stored2.accessToken)) {
                                    try {
                                        const tokens: Tokens = stored2 as Tokens;
                                        response.action = "SET_TOKENS";
                                        response.content = tokens;
                                    } catch (error) {
                                        console.error(
                                            "Error getting user tokens:",
                                            error,
                                        );
                                        response.action = "ERROR";
                                        response.error =
                                            "Failed to get user tokens";
                                    }
                                } else {
                                    response.action = "NO_USER";
                                }
                            }

                            // Send response back to the exact source iframe
                            console.log(
                                "[R][PLAY][updateIframe][message-GET_TOKENS] Sending response:",
                                response,
                            );
                            if (!event.source) return;
                            event.source.postMessage(response, {
                                targetOrigin: event.origin,
                            });
                        } else if (data.action === "SWITCH_SERVER") {
                            // Ignored in integration test mode
                        } else if (data.action === "CACHE_ENABLED") {
                            // Acknowledged (not an unknown action, but nothing to do)
                            // NOTE: FOR CACHE ACTIONS, ADD "TYPE": "CACHE_CONTROL" so that it is not confused with auth flow.
                        } else {
                            // Handle unknown action
                            if (!event.source) return;
                            event.source.postMessage(
                                {
                                    action: "UNKNOWN_ACTION",
                                    requestId: data.requestId,
                                },
                                {
                                    targetOrigin: event.origin,
                                },
                            );
                        }
                    } catch (e: any) {
                        if (!event.source) return;
                        event.source.postMessage({
                            action: "ERROR",
                            error: e.message,
                            requestId: event.data.requestId,
                        });
                    }
                });
            }
        }
    });

    // Play/ad logic removed for integration test
</script>

<svelte:head>
    <title>{chosenSrc ? `Testing ${chosenSrc}` : "Integration Test"} | CCPorted</title>
</svelte:head>

{#if adblock && !continued && isAHost && adContinued}
    <div class="container">
        <div class="adblock-warning">
            <h2>Ad Blocker Detected</h2>
            <p>
                CCPorted relies on ads to keep the lights on. Please consider
                disabling your ad blocker for this site.
            </p>
            <p>
                Only 5% of users have disabled their ad blocker. Be part of the
                solution!
            </p>
            <button onclick={() => location.reload()}
                >I've disabled my ad blocker, reload the game</button
            >
            {#if withoutSupportingTimer > 0}
                <p>
                    You can continue in {withoutSupportingTimer} seconds...
                </p>
            {:else}
                <button onclick={() => (continued = true)}
                    >Continue without supporting us</button
                >
            {/if}
        </div>
    </div>
{/if}
{#if chosenSrc}
    <iframe
        src={chosenSrc}
        frameborder="0"
        allowfullscreen
        bind:this={iframe}
        title="Integration Test Frame"
    ></iframe>
{:else if error}
    <div class="container">
        <h2>Error</h2>
        <p>{error}</p>
    </div>
{:else}
    <div class="container">
        <h2>Awaiting src...</h2>
        <p>Add ?src=YOUR_URL to the page URL, or refresh to re-prompt.</p>
    </div>
{/if}

{#if adsEnabled && adSlots}
    <Ad slotId={adSlots.footer} />
{/if}

<style>
    .container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }
    button {
        background-color: #007bff;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 16px;
        display: block;
        margin-top: 10px;
    }
    .adblock-warning {
        background-color: white;
        border: 2px solid #ccc;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        z-index: 1000;
    }
    iframe {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        border: none;
        margin: 0;
        padding: 0;
        overflow: hidden;
        z-index: 999; /* Ensure the iframe is on top */
    }
</style>
