<script lang="ts">
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import ServerSwitcher from "$lib/components/ServerSwitcher.svelte";
    import { initializeTooling, SessionState, State } from "$lib/state.js";

    let { children } = $props();

    let ga4Codes = {
        "ccported.click": "G-ER9VZ5QL8K",
        "ccported.github.io": "G-NYC0Q0VKPP",
        localhost: null,
    };
    let defaultGA4Code = "G-DJDL65P9Y4";

    let idToUse = $state("");
    let useGA4 = $state(false);
    let mounted = $state(false);
    let adsEnabled = $state(false);
    let adblockEnabled = $state(SessionState.adBlockEnabled);
    let isAHost = $state(false);

    onMount(() => {
        mounted = true;
        if (browser) {
            initializeTooling().then(() => {
                adsEnabled = SessionState.adsEnabled;
                adblockEnabled = SessionState.adBlockEnabled;
            });
            isAHost = State.isAHost();
            let hostname = window.location.hostname;
            console.log("[R][LAYOUT][BASE] Hostname:", hostname);

            if (hostname in ga4Codes) {
                const code = ga4Codes[hostname as keyof typeof ga4Codes];
                console.log("[R][LAYOUT][BASE] GA4 Code:", code);
                if (code) {
                    idToUse = code;
                    useGA4 = true;
                } else {
                    useGA4 = false;
                }
            } else {
                idToUse = defaultGA4Code;
                useGA4 = true;
            }

            console.log(
                "[R][LAYOUT][BASE] Using GA4:",
                useGA4,
                "with ID:",
                idToUse,
            );

            // Manually inject GA4 after mount to ensure it works
            if (useGA4 && idToUse) {
                injectGA4(idToUse);
            }
            if ((!isAHost && adsEnabled) || SessionState.devMode) {
                console.log("[R][LAYOUT][BASE] Bad Ads enabled");
            } else {
                if (isAHost && adsEnabled) {
                    console.log("[R][LAYOUT][BASE] Good ads enabled");
                } else {
                    console.log("[R][LAYOUT][BASE] No ads");
                }
            }
        }
    });
    function injectGA4(trackingId: string) {
        // Inject the gtag script
        const script1 = document.createElement("script");
        script1.async = true;
        script1.src = `https://www.googletagmanager.com/gtag/js?id=${trackingId}`;
        document.head.appendChild(script1);

        // Inject the configuration script
        const script2 = document.createElement("script");
        script2.innerHTML = `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${trackingId}');
        `;
        document.head.appendChild(script2);
    }
</script>

<svelte:head>
    <meta name="use-ga4" content={String(useGA4)} />
    <!-- Remove GA4 injection from head since we're doing it manually -->
</svelte:head>

{@render children()}

<!-- Server Switcher - only show in browser -->
{#if browser}
    <ServerSwitcher />
{/if}

{#if (!isAHost && !adblockEnabled)}
    <script
        async
        defer
        type="text/javascript"
        src="//pl27945770.effectivegatecpm.com/b0/88/ed/b088ed7c9240db179822a126a078b258.js"
    ></script>
{/if}
