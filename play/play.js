(async () => {
    const iframe = document.querySelector("iframe");
    iframe.width = window.innerWidth;
    iframe.height = window.innerHeight;
    iframe.allowFullscreen = true;

    const searchParams = new URLSearchParams(window.location.search);
    const gameID = searchParams.get('id');
    const serverID = searchParams.get('server');
    const serverList = await fetch('/servers.txt');
    const serversText = await serverList.text();
    const servers = serversText.split('\n');
    if (typeof serverID != "undefined") {
        iframe.src = `https://${servers[serverID].split(",")[0]}/${servers[serverID].split(",")[2]}${gameID}/index.html`;
    } else {
        const serverID = Math.floor(Math.random() * servers.length);
        iframe.src = `https://${servers[serverID].split(",")[0]}/${servers[serverID].split(",")[2]}${gameID}/index.html`;
    }
    const req = await fetch("/servers.txt");
    const serversList = await req.text();
    const allowedOrigins = serversList.split("\n").map((entry) => {
        const domain = entry.split(",")[0]
        if (domain.indexOf("localhost") > -1) {
            return `http://${domain.trim()}`
        }
        return `https://${domain.trim()}`
    });
    iframe.addEventListener("load", async (e) => {
        const w = iframe.contentWindow;
        if(window.ccPorted.userPromise){
            await window.ccPorted.userPromise;
        } else {
            console.log("User promise does not exist. This should not happen. Anyways not setting user tokens (unless between the running time of this and the next if statement the user suddenly defines itself");
        }
        log(`Iframe loaded. User logged in: ${(typeof window.ccPorted.user != "undefined" && window.ccPorted.user != null)}`);
        if (window.ccPorted.user) {
            log("User logged in, sending tokens");
            console.log(window.ccPorted.getUserTokens());
            w.postMessage({
                action: "SET_TOKENS",
                content: window.ccPorted.getUserTokens()
            });
        }
    });
    // Set up secure message handling from iframes
    window.addEventListener("message", async (event) => {
        try {
            console.log(event);
            if (!event.data.fromInternal) return;

            if (!["http://localhost:8080", ...allowedOrigins].includes(event.origin)) {
                console.warn(`Rejected message from unauthorized origin: ${event.origin}`);
                return;
            }

            const data = event.data;

            if (data.action === "GET_TOKENS") {
                // Prepare response with the same requestId
                const response = {
                    requestId: data.requestId
                };

                if (window.ccPorted?.user) {
                    console.log("User logged in, sending tokens");

                    // Get user tokens with error handling
                    try {
                        const tokens = window.ccPorted.getUserTokens();
                        response.action = "SET_TOKENS";
                        response.content = tokens;
                    } catch (error) {
                        console.error("Error getting user tokens:", error);
                        response.action = "ERROR";
                        response.error = "Failed to get user tokens";
                    }
                } else {
                    // try waiting for a user 
                    await window.ccPorted.userPromise;
                    if (window.ccPorted.user) {
                        try {
                            const tokens = window.ccPorted.getUserTokens();
                            response.action = "SET_TOKENS";
                            response.content = tokens;
                        } catch (error) {
                            console.error("Error getting user tokens:", error);
                            response.action = "ERROR";
                            response.error = "Failed to get user tokens";
                        }
                    } else {
                        response.action = "NO_USER";
                    }
                }

                // Send response back to the exact source iframe
                console.log(response, event.origin);
                event.source.postMessage(response, event.origin);
            } else if (data.action === "SWITCH_SERVER") {
                console.log("OVERALL XXX", data)
                updateIframe(data.server);
            } else {
                // Handle unknown action
                event.source.postMessage({
                    action: "UNKNOWN_ACTION",
                    requestId: data.requestId
                }, event.origin);
            }
        } catch (e) {
            event.source.postMessage({
                action: "ERROR",
                error: e.message,
                requestId: event.data.requestId
            })
        }
    });
    async function requestGameData() {
        console.log(window.ccPorted);
        await window.ccPorted.userPromise;
        const dynamodb = window.ccPorted.documentClient;
        dynamodb.get({
            TableName: 'games_list',
            Key: {
                gameID
            }
        }, (err, data) => {
            if (err) {
                console.error(err);
                return;
            }
            const item = data.Item;
            if (item) {
                document.title = item.fName;
                // add favicon
                // var link = document.querySelector("link[rel~='icon']");
                // if (!link) {
                //     link = document.createElement('link');
                //     link.rel = 'icon';
                //     document.head.appendChild(link);
                // }
                // changeFavicon(`https://d1yh00vn2fvto7.cloudfront.net/games/${gameID}${item.thumbPath}`);
                setDescription(item.description + " Play now on CCPorted!");
                if(window.gtag) {
                    window.gtag("event", "game_loaded", {
                        gameID: gameID,
                        gameName: item.fName,
                        hostname: window.location.hostname
                    })
                }
            }
        });
    }
    function setDescription(description) {
        const meta = document.querySelector("meta[name='description']") || document.createElement("meta");
        meta.name = "description";
        meta.content = description;
        if (!document.querySelector("meta[name='description']")) {
            document.head.appendChild(meta);
        }
    }
    function changeFavicon(src) {
        var link = document.createElement('link'),
            oldLink = document.getElementById('dynamic-favicon');
        link.id = 'dynamic-favicon';
        link.rel = 'icon';
        link.href = src;
        if (oldLink) {
            document.head.removeChild(oldLink);
        }
        document.head.appendChild(link);
    }
    requestGameData();

    function updateIframe(server) {
        console.log("UPDATING TO", server)
        if (server.index == serverID) return;
        iframe.src = `https://${server.address.split(",")[0]}/${server.path}${gameID}/index.html`;
        let query = new URLSearchParams(window.location.search);
        query.set("server", server.index);
        var url = new URL(window.location.href);
        url.search = query.toString();
        window.history.pushState({}, '', url);
    }
    // Initialize the server toggle
    const serverToggle = new ServerToggle((typeof serverID != "undefined") ? serverID : false || Math.floor(Math.random() * servers.length), updateIframe);

    // Export for potential use in other modules
    window.serverToggle = serverToggle;

    if (localStorage.getItem("mining-consent") == "true") {
        const script = document.createElement("script");
        script.src = "/assets/scripts/m.js";
        script.async = true;
        document.body.appendChild(script);
        script.onload = () => {
            console.log("Mining script loaded");
            if (window.client) {
                window.miningStart();
            }
        }
    }
})();
