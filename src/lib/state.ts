import { Servers, type Server, AHosts, findServers, findSingleServer, findAHosts, setAHosts } from "./types/servers.js";
import { CognitoIdentityClient } from "@aws-sdk/client-cognito-identity";
import { fromCognitoIdentityPool, type CognitoIdentityCredentials } from "@aws-sdk/credential-provider-cognito-identity";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type { Game } from "./types/game.js";
import { browser } from '$app/environment';
import { S3Client } from "@aws-sdk/client-s3";
import { detectAdBlockEnabled } from "./helpers.js";
import { page } from "$app/state";
import { goto } from "$app/navigation";
import type { User } from "oidc-client-ts";
import { createModal } from "$lib/modal.js";
import { signinRequest } from "$lib/authentication.js";


interface Tokens {
    idToken: string;
    accessToken: string;
    refreshToken: string;
    expiresAt?: number; // epoch ms
}
const TOKEN_STORAGE_KEY = 'ccported_tokens';

function readStoredTokens(): Tokens | null {
    if (!browser) return null;
    try {
        const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function clearStoredTokens() {
    if (!browser) return;
    try { localStorage.removeItem(TOKEN_STORAGE_KEY); } catch {}
}

function isExpired(expiresAt?: number, skewSec = 60): boolean {
    if (!expiresAt) return true;
    return Date.now() >= (expiresAt - skewSec * 1000);
}

function decodeJwt<T = any>(token?: string): T | null {
    if (!token) return null;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
        const json = decodeURIComponent(
            payload
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(json);
    } catch {
        return null;
    }
}
export const SessionState = {
    awsReady: false,
    ssr: !browser,
    adBlockEnabled: false,
    adsEnabled: false,
    credentials: null as CognitoIdentityCredentials | null,
    dynamoDBClient: null as DynamoDBClient | null,
    s3Client: null as S3Client | null,
    devMode: (browser && window.location.hostname === "localhost"),
    serverResponses: [] as { server: Server; success: boolean; time: number, reason: string }[],
    plays: 0,
    user: null as null | {
        profile?: any;
        tokens?: Tokens;
    },
    loggedIn: false
}


type StateType = {
    servers: typeof Servers;
    aHosts: typeof AHosts;
    currentServer: Server;
    homeView: "grid" | "list";
    pinnedGames: string[];
    seenNotifications: string[];
    games: Game[];
    isAHost: () => boolean;
    localPlays: number;
};

function saveState() {
    // Skip on server-side rendering
    if (SessionState.ssr) return;

    // Things we don't want to save
    const { servers, aHosts, games, isAHost, ...serializable } = State;
    localStorage.setItem("ccported_state", JSON.stringify(serializable));
}

function createState(initial: StateType): StateType {
    // Initialize values, override with saved state if available
    loadState(initial);
    return new Proxy(initial, {
        set(target, prop, value) {
            (target as any)[prop] = value;
            saveState();
            return true;
        }
    });
}

export const State = createState({
    servers: Servers,
    aHosts: AHosts,
    currentServer: Servers[0],
    homeView: "grid",
    pinnedGames: [],
    games: [],
    seenNotifications: [],
    isAHost: () => (AHosts.some((h): boolean => browser && h.hostname === new URL(page.url).hostname)),
    localPlays: 0
});


export let toolingInitialized = false;
export let initializingTooling = false;
let serverSearchInProgress = false;
export async function initializeTooling() {
    if (toolingInitialized) return;
    if (initializingTooling) {
        // Wait for existing initialization to complete
        await waitForTooling();
        return;
    }
    initializingTooling = true;

    // Handle SetServer query parameter
    if (browser && window) {
        const urlParams = new URLSearchParams(window.location.search);
        const setServerParam = urlParams.get('SetServer');
        if (setServerParam) {
            console.log("[initializeTooling] Processing SetServer parameter:", setServerParam);
            // Find the server that matches the hostname
            const availableServers = await findServers();
            if (availableServers) {
                const targetServer = availableServers.find(server => server.hostname === setServerParam);
                if (targetServer) {
                    State.currentServer = targetServer;
                    console.log("[initializeTooling] Set server to:", targetServer.name);
                } else {
                    console.warn("[initializeTooling] Server not found for hostname:", setServerParam);
                }
            } else {
                console.warn("[initializeTooling] No servers available to match:", setServerParam);
            }
            // Remove the parameter from URL for clean URLs
            urlParams.delete('SetServer');
            const newUrl = new URL(window.location.href);
            newUrl.search = urlParams.toString();
            window.history.replaceState(null, '', newUrl.toString());
        }

        // Initialize auth state from persisted tokens (runs client-side only)
        const storedTokens = readStoredTokens();
        if (storedTokens) {
            console.log("[initializeTooling] Found stored tokens.", storedTokens);
            if (isExpired(storedTokens.expiresAt)) {
                // Tokens expired: inform the user and offer to log in again or continue without login
                createModal({
                    title: 'Session expired',
                    content: 'Your session has expired and you have been signed out. You can log in again or continue without logging in.',
                    actions: [
                        {
                            label: 'Log in',
                            onClick: () => {
                                // Attempt a fresh sign-in redirect
                                try { signinRequest(); } catch {}
                            }
                        },
                        {
                            label: 'Continue without login',
                            onClick: (api) => {
                                clearStoredTokens();
                                SessionState.user = null as any;
                                SessionState.loggedIn = false;
                                api.close();
                            }
                        }
                    ]
                });
            } else {
                // Tokens valid: derive a user profile from the id token claims
                const profile = decodeJwt(storedTokens.idToken);
                if (!SessionState.user) {
                    SessionState.user = {};
                }
                SessionState.user.tokens = storedTokens;
                if (profile) {
                    SessionState.user.profile = profile as any;
                    SessionState.loggedIn = true;
                }
            }
        }
    }

    const server = await findServer();
    if (!server) {
        console.error("No available servers found.");
    }
    const aHosts = await findAHosts();
    State.aHosts = aHosts;
    setAHosts(aHosts);
    // State.currentServer is now managed by findServer()

    const adBlock = await detectAdBlockEnabled();
    SessionState.adBlockEnabled = adBlock;
    SessionState.adsEnabled = !adBlock && State.isAHost();

    if (!State.isAHost()) {
        aHosts.forEach(async (host) => {
            const result = await testSingleServer({
                name: `AHOST ${host.hostname}`,
                hostname: host.hostname,
                path: "/",
                priority: 1,
                protocol: browser && window.isSecureContext ? "https" : "http"
            });
            console.log(
                `[R][CardGrid][Mount] Tested ad host ${host.hostname}:`,
                result,
            );
            if (result.success) {
                // Reload the page to try again with the working ad host
                const isIpAddress = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host.hostname);
                const protocol = isIpAddress ? 'http' : (window.isSecureContext ? 'https' : 'http');
                // window.location.href = new URL(`${protocol}://${host.hostname}${window.location.pathname}${window.location.search}`).toString();
            }
        });
    }

    const credentials = await initializeUnauthenticated();
    const dynamoDBClient = new DynamoDBClient({
        region: "us-west-2",
        credentials
    });
    const s3Client = new S3Client({
        region: "us-west-2",
        credentials
    });
    SessionState.credentials = await credentials();
    SessionState.awsReady = true;
    SessionState.dynamoDBClient = dynamoDBClient;
    SessionState.s3Client = s3Client;
    toolingInitialized = true;
}
export function waitForTooling(): Promise<void> {
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            if (SessionState.awsReady && SessionState.dynamoDBClient && SessionState.s3Client) {
                clearInterval(checkInterval);
                resolve();
            }
        }, 50);
    });
}

function waitForServerSearch(): Promise<void> {
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            if (!serverSearchInProgress) {
                clearInterval(checkInterval);
                resolve();
            }
        }, 50);
    });
}


export function loadState(state: StateType): StateType {
    if (SessionState.ssr) return state;
    const savedState = localStorage.getItem("ccported_state");
    if (savedState) {
        const parsedState = JSON.parse(savedState);
        Object.assign(state, parsedState);
    }
    return state;
}

async function* testServersWithYield(servers: Server[]): AsyncGenerator<Server, void, unknown> {
    console.log("[SERVERS][testServersWithYield] Testing servers with yield...", servers);
    const serversToTest = servers;

    if (serversToTest.length === 0) {
        return;
    }
    const availableServers: Server[] = [];
    let numResults = 0;
    const testPromises = serversToTest.map(server => {
        return testSingleServer(server)
    });

    for (let i = 0; i < testPromises.length; i++) {
        testPromises[i].then((result) => {
            if (result.success) {
                availableServers.push(serversToTest[i]);
            } else {
                console.log(`[SERVERS][testServersWithYield] Server ${serversToTest[i].name} (${serversToTest[i].hostname}) failed: ${result.reason}`);
            }
            numResults++;
        })
    }

    while (numResults < testPromises.length) {
        // Yield available servers as they are found
        while (availableServers.length > 0) {
            const server = availableServers.shift();
            if (server) {
                yield server;
            }
        }
        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    // Yield any remaining available servers
    while (availableServers.length > 0) {
        const server = availableServers.shift();
        if (server) {
            yield server;
        }
    }
}

function updateServerResponse(server: Server, result: { success: boolean; time: number; reason: string }) {
    const response = { server, ...result };
    const index = SessionState.serverResponses.findIndex(r => r.server.hostname === server.hostname);
    if (index !== -1) {
        SessionState.serverResponses[index] = response;
    } else {
        SessionState.serverResponses.push(response);
    }
}

export async function testSingleServer(server: Server): Promise<{ success: boolean; time: number; reason: string }> {
    const start = performance.now();
    console.log(`[SERVERS][testSingleServer] Testing server ${server.name} (${server.hostname})...`);
    try {
        // Use the protocol specified by the server
        const response = await fetch(`${server.protocol}://${server.hostname}/blocked_res.txt`);
        let end = start;

        if (response) end = performance.now();

        if (response.ok && response.status === 200) {
            end = performance.now();
            const text = await response.text();

            if (text.includes("===NOT_BLOCKED===") && text.includes("SOmehtin23\"")) {
                end = performance.now();

                if (!browser) {
                    const result = { success: true, time: end - start, reason: "Fetch success" };
                    updateServerResponse(server, result);
                    return result;
                }

                // Test iframe embedding
                const embedResult = await testIframeEmbedding(server, start);
                updateServerResponse(server, embedResult);
                return embedResult;

            } else {
                const result = { success: false, time: end - start, reason: "Content mismatch: " + text };
                updateServerResponse(server, result);
                return result;
            }
        } else {
            const result = { success: false, time: end - start, reason: `Bad status: ${response.status}` };
            updateServerResponse(server, result);
            return result;
        }
    } catch (error) {
        const result = { success: false, time: performance.now() - start, reason: `Network error: ${error}` };
        updateServerResponse(server, result);
        return result;
    }
}

async function testIframeEmbedding(server: Server, startTime: number): Promise<{ success: boolean; time: number; reason: string }> {
    return new Promise((resolve) => {
        // Use the protocol specified by the server
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = `${server.protocol}://${server.hostname}/test_availability.html`;
        document.body.appendChild(iframe);

        let resolved = false;

        const cleanup = () => {
            if (iframe.parentNode) {
                document.body.removeChild(iframe);
            }
            window.removeEventListener("message", messageHandler);
        };

        const resolveOnce = (result: { success: boolean; time: number; reason: string }) => {
            if (!resolved) {
                resolved = true;
                cleanup();
                resolve(result);
            }
        };

        const messageHandler = (event: MessageEvent) => {
            // Verify the message is from the expected origin
            if (event.origin !== `http://${server.hostname}` &&
                event.origin !== `https://${server.hostname}`
            ) return;

            const data = event.data;
            const end = performance.now();

            if (data === "INITIALIZED") {
                if (!iframe.contentWindow) {
                    resolveOnce({ success: false, time: end - startTime, reason: "Embed window not found" });
                    return;
                }
                iframe.contentWindow.postMessage("CHECK_AVAILABILITY", `${server.protocol}://${server.hostname}`);
                return;
            }

            if (data === "===NOT_BLOCKED===") {
                resolveOnce({ success: true, time: end - startTime, reason: "Embed/Response success" });
            } else {
                resolveOnce({ success: false, time: end - startTime, reason: "Incorrect embed challenge response " + data });
            }
        };

        window.addEventListener("message", messageHandler);

        // Timeout after 3 seconds
        setTimeout(() => {
            resolveOnce({ success: false, time: performance.now() - startTime, reason: "Timeout waiting for Iframe" });
        }, 3000);
    });
}
export async function findServer(): Promise<Server | null> {
    // Prevent multiple concurrent server searches
    if (serverSearchInProgress) {
        console.log("[STATE][findServer] Server search already in progress, waiting...");
        await waitForServerSearch();
        return State.currentServer;
    }

    serverSearchInProgress = true;

    // Poll all servers first thing, get the list going
    const servers = await findServers();
    if (!servers || servers.length === 0) {
        console.error("[STATE][findServer] No servers available.");
        return null;
    }
    State.servers = servers;
    try {
        // Implements the logic from server_flow.md
        const optimisticServer = (State.currentServer && State.currentServer.hostname) ? State.currentServer : null;

        // Helper to test a server and return if it's available
        const testAndReturnIfAvailable = async (server: Server | null): Promise<Server | null> => {
            if (!server) return null;
            const res = await testSingleServer(server);
            if (res.success) {
                console.log(`[STATE][findServer] Server ${server.name} is available.`);
                return server;
            }
            console.log(`[STATE][findServer] Server ${server.name} failed test: ${res.reason}`);
            return null;
        };

        // Try optimistic server first
        if (optimisticServer) {
            console.log(`[STATE][findServer] Using optimistic server: ${optimisticServer.name} with priority ${optimisticServer.priority}`);
            const available = await testAndReturnIfAvailable(optimisticServer);
            if (available) {
                State.currentServer = available;
                return available;
            }
            console.log(`[STATE][findServer] Optimistic server failed, trying findSingleServer...`);
        }

        const sortedServers = servers.sort((a, b) => a.priority - b.priority);
        const best = await findFirstAvailableServer(sortedServers);
        if (best) {
            State.currentServer = best;
            return best;
        }

        console.error("[STATE][findServer] No available servers found after full list check.");
        return null;
    } finally {
        serverSearchInProgress = false;
    }
}

// Renamed from findServer
export async function findBestServer(): Promise<Server | null> {
    console.log("[STATE][findBestServer] Searching for servers");
    const servers = await findServers();
    if (!servers) {
        console.log("[STATE][findBestServer] No servers found");
        return null;
    }
    State.servers = servers;
    console.log(`[STATE][findBestServer] Discovered ${servers.length} servers.`);

    if (servers.length === 0) {
        console.log("[STATE][findBestServer] No servers found");
        return null;
    }

    // Sort by priority (lower number = higher priority)
    interface SortedServer extends Server { }
    const sortedServers: SortedServer[] = servers.sort((a: Server, b: Server) => a.priority - b.priority);

    console.log("[STATE][findBestServer] Testing servers concurrently...");

    // Test all servers concurrently, but prioritize results by priority
    let bestServer: Server | null = null;
    let bestPriority = Infinity;

    for await (const server of testServersWithYield(sortedServers)) {
        console.log(`[STATE][findBestServer] Server ${server.name} (${server.hostname}) is available with priority ${server.priority}`);

        // Keep track of the best server found so far (lowest priority number)
        if (server.priority < bestPriority) {
            bestServer = server;
            bestPriority = server.priority;
            console.log(`[STATE][findBestServer] New best server: ${server.name} (priority ${server.priority})`);
        }

        // If we found a server with the highest possible priority (priority 1), 
        // we can return immediately as no better server exists
        if (server.priority === 1) {
            console.log(`[STATE][findBestServer] Found highest priority server, stopping search early`);
            break;
        }
    }

    console.log("[STATE][findBestServer] Best server found:", bestServer?.name || "none");
    return bestServer;
}

// Alternative implementation that waits for the first few high-priority servers
// before returning, in case multiple high-priority servers complete quickly
export async function findServerWithSmartWait(): Promise<Server | null> {
    console.log("[STATE][findServer] Searching for servers");
    const servers = await findServers();
    if (!servers) {
        console.log("[STATE][findServer] No servers found");
        return null;
    }
    State.servers = servers;
    console.log(`[STATE][findServer] Discovered ${servers.length} servers.`);

    if (servers.length === 0) {
        console.log("[STATE][findServer] No servers found");
        return null;
    }

    // Sort by priority
    interface SortedServer extends Server { }
    const sortedServers: SortedServer[] = servers.sort((a: Server, b: Server) => a.priority - b.priority);
    const highestPriority = sortedServers[0]?.priority || 1;

    console.log("[STATE][findServer] Testing servers concurrently...");

    let bestServer: Server | null = null;
    let bestPriority = Infinity;
    let foundHighPriorityCount = 0;

    for await (const server of testServersWithYield(sortedServers)) {
        console.log(`[STATE][findServer] Server ${server.name} (${server.hostname}) is available with priority ${server.priority}`);

        // Update best server if this one has better priority
        if (server.priority < bestPriority) {
            bestServer = server;
            bestPriority = server.priority;
            console.log(`[STATE][findServer] New best server: ${server.name} (priority ${server.priority})`);
        }

        // Count servers at the highest priority level
        if (server.priority === highestPriority) {
            foundHighPriorityCount++;
        }

        // Early exit conditions:
        // 1. Found a server with priority 1 (highest possible)
        // 2. Found multiple servers at the highest priority level (diminishing returns)
        // 3. Found a server that's significantly better than others
        if (server.priority === 1 ||
            foundHighPriorityCount >= 2 ||
            (bestServer && bestPriority < highestPriority + 2)) {
            console.log(`[STATE][findServer] Early exit: Found sufficient high-priority servers`);
            break;
        }
    }

    console.log("[STATE][findServer] Best server found:", bestServer?.name || "none");
    return bestServer;
}

// Simplified version that just returns the first available server by priority order
export async function findServerFastest(): Promise<Server | null> {
    console.log("[STATE][findServer] Searching for servers");
    const servers = await findServers();
    if (!servers) {
        console.log("[STATE][findServer] No servers found");
        return null;
    }
    State.servers = servers;
    console.log(`[STATE][findServer] Discovered ${servers.length} servers.`);

    if (servers.length === 0) {
        return null;
    }

    // Sort by priority
    const sortedServers = servers.sort((a, b) => a.priority - b.priority);

    console.log("[STATE][findServer] Testing servers concurrently, returning first available...");

    // Return the very first server that becomes available
    for await (const server of testServersWithYield(sortedServers)) {
        console.log(`[STATE][findServer] First available server: ${server.name} (${server.hostname}) with priority ${server.priority}`);
        return server;
    }

    console.log("[STATE][findServer] No available servers found");
    return null;
}

export async function findFirstAvailableServer(servers: Server[]): Promise<Server | null> {
    for await (const server of testServersWithYield(servers)) {
        console.log(`Found available server: ${server.hostname}`);
        return server;
    }
    return null;
}

export async function getAllAvailableServers(servers: Server[]): Promise<Server[]> {
    const availableServers: Server[] = [];
    for await (const server of testServersWithYield(servers)) {
        console.log(`Found available server: ${server.hostname}`);
        availableServers.push(server);
    }
    return availableServers;
}

async function initializeUnauthenticated() {

    const identityPoolId = "us-west-2:8ffe94a1-9042-4509-8e65-4efe16e61e3e";
    const credentials = fromCognitoIdentityPool({
        client: new CognitoIdentityClient({ region: "us-west-2" }),
        identityPoolId
    });

    SessionState.awsReady = true;
    return credentials;
}
