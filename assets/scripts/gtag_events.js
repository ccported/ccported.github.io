window.ccPorted.muteManagerPopupOpen = false;
const link = document.createElement("link");
const script = document.currentScript;
const seenPopup = (localStorage.getItem("ccported-popup") == "yes");
const glocation = window.location.hostname;
const framed = pageInIframe();
const gameID = window.ccPorted.gameID;
function pageInIframe() {
    return (window.location !== window.parent.location);
}
const stlyeLoadPromise = new Promise((r, rr) => {
    link.onload = () => {
        r();
    }
});

let cachedChannels = null;

link.href = "/assets/styles/master.css";
link.setAttribute("rel", "stylesheet");
document.head.appendChild(link);


function installGTAG() {
    log("Installing GTAG");
    if (window.gtag) {
        log("GTAG already installed, starting init");
        init();
        return Promise.resolve();
    } else {
        log("GTAG not installed, loading script");
        const script = document.createElement("script");
        const gID = `G-DJDL65P9Y4`;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${gID}`;
        document.head.appendChild(script);
        const loadPromise = new Promise((r, rr) => {
            script.onload = () => {
                log("GTAG script loaded");
                window.dataLayer = window.dataLayer || [];
                function gtag() { dataLayer.push(arguments); }
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', gID);
                log("GTAG installed, starting init");
                init();
                r();
            }
        });
        return loadPromise;
    }

}


// Modified init function
async function init() {
    emit();
    setInterval(emit, 1000 * 60 * 10);
}

function emit() {
    const data = {
        gameID,
        location: (glocation.length > 0) ? glocation : "unknown",
        isFramed: framed,
    }
    if (framed) {
        data["parentDomainHost"] = (window.parent.location.hostname.length > 0) ? window.parent.location.hostname : "unknown";
        data["parentDomain"] = window.parent.location;
    }
    log(data);
    gtag("event", "play_game", data);
}

installGTAG();