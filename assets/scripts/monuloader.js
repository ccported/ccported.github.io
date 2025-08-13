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
        window.ccPorted.aHosts = hosts.map(h => h.split(",")[0].trim());
        window.ccPorted.aHostIDs = hosts.map(h => h.split(",")[1].trim());
        if (window.ccPorted.aHosts.includes(window.location.hostname)) {
            window.ccPorted.aHost = true;
            return !isAdBlockEnabled;
        } else {
            window.ccPorted.aHost = false;
            return false;
        }
    } else {
        if (window.ccPorted.aHosts.includes(window.location.hostname)) {
            window.ccPorted.aHost = true;
            return !isAdBlockEnabled;
        } else {
            window.ccPorted.aHost = false;
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
        script.src = '//monu.delivery/site/' + window.ccPorted.aHostIDs[window.ccPorted.aHosts.indexOf(window.location.hostname)];
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