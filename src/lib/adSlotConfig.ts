import { browser } from "$app/environment";
import { detectAdBlockEnabled } from "./helpers.js";
import { SessionState } from "./state.js";
import { findAHosts } from "./types/servers.js";

export const adSlotConfig = {
    "ccported.github.io": {
        sidebar: "69fd2258-841e-496e-b471-7fee303347da",
        grid: "1327f13c-fb3f-45df-9616-2c76dacf8707",
        footer: "c2522ff2-7549-433b-a689-0cd63517722c",
        sidebarR: "b9482d90-db02-4b5f-b8d9-d4b333965e74"
    },
    "ccported.click": {
        sidebar: "52cde221-3941-473c-afbc-5376c9ae5f76",
        grid: "29d0156c-2d0c-4d77-b80c-6a3c21b13dd2",
        footer: "b203fc61-1cc6-4a48-a13a-be6dbe61f3f0",
        sidebarR: "ea44e52d-5d55-4544-b5b3-ef6eb0f3b8d9"
    }
};

export async function initializeAds() {
    let adBlock = false;
    let adsEnabled = true;
    let adSlots: { sidebar: string; grid: string; footer: string } | null = null;
    await detectAdBlockEnabled();
    console.log(
        "[R][CardGrid][Mount] AdBlock Enabled:",
        SessionState.adBlockEnabled,
    );
    adBlock = SessionState.adBlockEnabled;
    adsEnabled = SessionState.adsEnabled;
    if (adsEnabled) {
        const host = browser ? window.location.hostname : "<SSR_HOST>";
        if (host in adSlotConfig) {
            adSlots = adSlotConfig[host as keyof typeof adSlotConfig];
        }
        (async () => {
            const aHosts = await findAHosts();
            if (!aHosts) {
                adsEnabled = false;
                SessionState.adsEnabled = false;
                return;
            }

            const aHostData = aHosts.find((h) => h.hostname === host);
            if (aHostData && aHostData.acode) {
                const scriptId = `ad-script-${aHostData.acode}`;
                if (document.getElementById(scriptId)) return;

                const script = document.createElement("script");
                script.id = scriptId;
                script.src = `//fastly.mmt.delivery/site/${aHostData.acode}`;
                script.setAttribute("data-cfasync", "false");
                script.defer = true;
                script.async = true;
                document.head.appendChild(script);
            } else {
                console.log(
                    "[R][CardGrid][Mount] No valid AHost for this domain:",
                    host,
                );
                adsEnabled = false;
                SessionState.adsEnabled = false;
            }
        })();
    }

    return { adBlock, adsEnabled, adSlots };
}