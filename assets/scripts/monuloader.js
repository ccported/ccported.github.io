window.ccPorted = window.ccPorted || {};
async function detectAdBlockEnabled() {
    let isAdBlockEnabled = false
    const googleAdUrl = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'
    try {
        await fetch(new Request(googleAdUrl)).catch(_ => isAdBlockEnabled = true)
    } catch (e) {
        isAdBlockEnabled = true;
    }
    return isAdBlockEnabled;
}
async function adsEnabled() {
    let isAdBlockEnabled = false
    isAdBlockEnabled = await detectAdBlockEnabled();
    if (!window.ccPorted.aHosts) {
        const res = await fetch("/ahosts.txt");
        const text = await res.text();
        const hosts = text.split('\n');
        window.ccPorted.aHosts = hosts.map(h => h.trim());
        if (window.ccPorted.aHosts.includes(window.location.hostname)) {
            return !isAdBlockEnabled;
        } else {
            return false;
        }
    } else {
        if (window.ccPorted.aHosts.includes(window.location.hostname)) {
            return !isAdBlockEnabled;
        } else {
            return false;
        }
    }
}
async function loadAds() {
    let x = await detectAdBlockEnabled();
    window.ccPorted.adBlockEnabled = x;
    window.ccPorted.adsEnabled = await adsEnabled();
    if (window.ccPorted.adsEnabled) {
        const script = document.createElement('script');
        script.src = '//monu.delivery/site/e/4/500442-526a-41af-9981-22db9286cd37.js';
        script.setAttribute('data-cfasync', 'false');
        script.setAttribute('defer', 'defer');
        script.onload = () => {
            console.log("Ads loaded successfully.");
        }
        document.head.appendChild(script);
        window.ccPorted.adsEnabled = true;
    } else {
        window.ccPorted.adsEnabled = false;
        console.log("Ads are disabled for this host.");
    }
    return window.ccPorted.adsEnabled;
}

window.ccPorted.adsLoadPromise = loadAds();