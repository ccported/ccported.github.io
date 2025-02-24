window.ccPorted.muteManagerPopupOpen = false;
const link = document.createElement("link");
const script = document.currentScript;
const seenPopup = (localStorage.getItem("ccported-popup") == "yes");
const glocation = window.location.hostname;
const framed = pageInIframe();

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



importJSON("/games.json").then(games => {
    var { games } = games;
    var unseengames = games.filter(game => {
        var hasSeen = !hasSeenGame(game.name);
        markGameSeen(game.name);
        return hasSeen;
    });
    if (unseengames.length == 0) return;
    var tail = "";
    if (unseengames.length > 5) {
        tail = " and more";
    }
    unseengames = unseengames.splice(0, 5);

    var string = "New games to play: ";
    unseengames.forEach((game, i) => {

        string += ((i == games.length - 1) ? "and " : "") + game.fName + ((i != unseengames.length - 1) ? ", " : "");
    });
    createPopup(string + tail);
    localStorage.setItem("ccported-popup", "yes",true)
});
shortcut([
    "Control", "m"
], () => {
    if (!window.ccPorted.muteManagerPopupOpen) {
        muteManager()
    } else {
        closeMuteManager();
    }
});

async function importJSON(path) {
    const url = new URL(path, window.location.origin);
    url.searchParams.append('_', Date.now());

    const res = await fetch(path, {
        method: "GET",
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    });
    return res.json();
}

async function installGTAG() {
    if (window.gtag) {
        emit();
        setInterval(emit, 1000 * 60 * 10);
        return Promise.resolve();
    } else {
        const script = document.createElement("script");
        const gID = `G-DJDL65P9Y4`;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${gID}`;
        document.head.appendChild(script);
        const loadPromise = new Promise((r, rr) => {
            script.onload = () => {
                window.dataLayer = window.dataLayer || [];
                function gtag() { dataLayer.push(arguments); }
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', gID);
                emit();
                setInterval(emit, 1000 * 60 * 10);
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
    const { data: { user } } = await window.ccSupaClient.auth.getUser();
    window.ccPorted.user = user;
    if (localStorage.getItem("chat-convo-all-muted") !== 1 && user) {
        setupRealtime();
    }
    if (localStorage.getItem("[ns-ccported]_hiring_popup") !== "yes") {
        createPopup();
        localStorage.setItem("[ns-ccported]_hiring_popup", "yes", true);
    };
    if (!seenPopup) {
        setTimeout(createPopup, 120000);
    }
}
async function setupRealtime() {
    try {
        window.ccSupaClient
            .channel('public:chat_messages')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                },
                handleNewMessage
            )
            .subscribe();
    } catch (err) {
        console.log(err);
    }
}
async function muteManagerPopup() {

    if (!window.ccPorted.user) {
        const { data: { user } } = await window.ccSupaClient.auth.getUser();
        window.ccPorted.user = user;
        if (!user) {
            createNotif({
                message: `You must be logged in to use this feature`,
                cta: false,
                autoClose: 1,
                actions: []
            });
        }
    }
    if (window.ccPorted.fontAwesomeLoaded !== true) {
        await loadFontAwesome();
    }


    const popup = document.createElement("div");
    popup.classList.add("cc");
    popup.classList.add("popup");
    let rows = []
    if (cachedChannels) {
        rows = cachedChannels;
    } else {
        const { data, error } = await window.ccSupaClient
            .rpc('user_in_joined_users', { user_id: window.ccPorted.user.id });
        rows = data;
        cachedChannels = rows;
        if (error) console.log(error)
    }

    popup.innerHTML = `
        <div class="cc popup-content">
            <h2>Manage Notifications</h2>
            <p>Use <code>CTRL+M</code> to pull this up</p>
            <div class = "cc channels-list-mute">
                ${rows.map((channel) => {
        return `<div class = "cc channel-row">
                            <p class = "cc channel-name">${channel.friendly_name}</p>
                            <p  data-channelid = "${channel.channel_id}" class="cc mute-channel"><i class="fa-solid fa-bell${isChannelMuted(channel) ? "-slash" : ""}"></i></p>
                        </div>`
    }).join("<br>")
        }
            </div>
            <div class = "cc popup-buttons">
                <button class = "cc" id="closer">Done</button>
            </div>
        </div>
    `;
    document.body.appendChild(popup);
    window.ccPorted.muteManagerPopupOpen = true;
    return popup;
}
async function muteManager() {
    const popup = await muteManagerPopup();
    window.ccPorted.muteManagerPopupRef = popup;
    document.addEventListener("keydown", (e) => {
        if (e.key == "Escape") {
            closeMuteManager();
        }
    });
    popup.querySelectorAll(".mute-channel").forEach((el) => {
        el.addEventListener("click", async (e) => {
            const channelID = el.getAttribute("data-channelid");
            if (localStorage.getItem(`channel-muted-${channelID}`) == 1) {
                localStorage.setItem(`channel-muted-${channelID}`, 0, true);
            } else {
                localStorage.setItem(`channel-muted-${channelID}`, 1, true);
            }
            el.innerHTML = `<i class="fa-solid fa-bell${isChannelMuted({ channel_id: channelID }) ? "-slash" : ""}"></i>`;
        });
    });
    popup.querySelector("#closer").addEventListener("click", () => {
        closeMuteManager();
    });
}
function closeMuteManager() {
    if (window.ccPorted.muteManagerPopupOpen) {
        window.ccPorted.muteManagerPopupRef.remove();;
        window.ccPorted.muteManagerPopupRef = null;
        window.ccPorted.muteManagerPopupOpen = false;
    }
}
function loadFontAwesome() {
    const link = document.createElement("link");
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css";
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("crossorigin", "anonymous");
    link.setAttribute("referrerpolicy", "no-referrer");
    document.head.appendChild(link);

    return new Promise((r, rr) => {
        link.onload = () => {
            window.ccPorted.fontAwesomeLoaded = true;
            r();
        }
    });
}
function isChannelMuted(channel) {
    return localStorage.getItem(`channel-muted-${channel.channel_id}`) == 1;
}
function shortcut(keys, cb) {
    var keyMap = {};
    for (const key of keys) {
        keyMap[key] = false;
    }
    document.addEventListener("keydown", (e) => {
        if (keyMap[e.key] !== undefined) {
            keyMap[e.key] = true;
        }
        if (check()) {
            cb();
        }
    });
    document.addEventListener("keyup", (e) => {
        if (keyMap[e.key] !== undefined) {
            keyMap[e.key] = false;
        }
    });
    function check() {
        var allPressed = true;
        for (const key of keys) {
            if (!keyMap[key]) {
                allPressed = false;
            }
        }
        return allPressed;
    }
}
function installSupascript() {
    const script = document.createElement("script");
    script.src = "https://unpkg.com/@supabase/supabase-js@2";
    document.head.appendChild(script);
    window.ccPorted.supaLoadPromise = new Promise((r, rr) => {
        script.onload = () => {
            const SUPABASE_URL = 'https://dahljrdecyiwfjgklnvz.supabase.co';
            const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhaGxqcmRlY3lpd2ZqZ2tsbnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjgyNjE3NzMsImV4cCI6MjA0MzgzNzc3M30.8-YlXqSXsYoPTaDlHMpTdqLxfvm89-8zk2HG2MCABRI';
            window.ccSupaClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            r();
        }
    });

    return window.ccPorted.supaLoadPromise;
}
function emit() {
    const data = {
        gameID,
        location: (glocation.length > 0) ? glocation : "unknown",
        isFramed: framed,
    }
    if(framed){
        data["parentDomainHost"] = (window.parent.location.hostname.length > 0) ? window.parent.location.hostname : "unknown";
        data["parentDomain"] = window.parent.location;
    }
    log(data);
    gtag("event", "play_game", data);
}
function hasSeenGame(gameID) {
    return localStorage.getItem(`seen-${gameID}`) == "yes";
}
function markGameSeen(gameID) {
    localStorage.setItem(`seen-${gameID}`, "yes", true);
}
function createNotif(popupData) {
    const popup = document.createElement('div');
    popup.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        max-width: 800px;
        min-width: 500px;
        background-color: rgb(37,37,37);
        border: 2px solid #333;
        border-radius: 10px;
        padding: 25px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 1000;
        font-family: Arial, sans-serif;
    `;
    if (popupData.autoClose) {
        const meter = document.createElement("div");
        meter.classList.add("meter");
        meter.style.cssText = `
            margin: 0;
            width: 100%;
            height: 10px;
            background-color: rgba(0,0,255,1);
            display: block;
            position: absolute;
            border-radius: 10px;
            z-index: 9;
            top: 0;
            left: 0;
            animation: meter-animation ${popupData.autoClose}s linear forwards;
        `;
        popup.appendChild(meter);

        setTimeout(() => {
            popup.style.animation = `fade 0.5s`;
            setTimeout(() => {
                popup.remove()
            }, 500);
        }, popupData.autoClose * 1000)
    }
    const popupContent = document.createElement("div");
    const message = document.createElement('p');
    message.textContent = popupData.message;
    message.style.marginBottom = '10px';
    message.style.color = 'white';
    let link;
    if (popupData.cta) {
        link = document.createElement('a');
        link.href = popupData.cta.link;
        link.textContent = popupData.cta.text;
        link.style.cssText = `
            display: inline-block;
            background-color: #4CAF50;
            color: white;
            padding: 10px 15px;
            text-decoration: none;
            border-radius: 5px;
        `;
    }
    if (!popupData.autoClose) {
        const closeButton = document.createElement('a');
        closeButton.href = 'javascript:void(0)';
        closeButton.textContent = 'Close';
        closeButton.style.cssText = `
            display: inline-block;
            background-color: rgb(248,0,0);
            color: white;
            padding: 10px 15px;
            text-decoration: none;
            border-radius: 5px;
        `;
        closeButton.onclick = () => popup.remove();
    }
    const linkRow = document.createElement('div');
    linkRow.style.display = 'flex';
    linkRow.style.justifyContent = 'space-between';
    if (popupData.actions && popupData.actions.length >= 1) {
        const actionContainer = document.createElement("div");
        for (const action of popupData.actions) {
            const [actionName, actionFunc, color] = action;
            let button = document.createElement("button");
            button.style.cssText = `
            display: inline-block;
            background-color: ${(color) ? color : '#4CAF50'};
            color: white;
            padding: 10px 15px;
            text-decoration: none;
            border-radius: 5px;
            border: 1px solid ${(color) ? color : '#4CAF50'};
            margin: 5px;
            cursor: pointer;
        `;
            button.onclick = () => {
                popup.remove();
                actionFunc();
            };
            button.innerText = actionName;
            actionContainer.appendChild(button);
        }
        linkRow.appendChild(actionContainer);
    }
    if (popupData.cta) {
        linkRow.appendChild(link);
    }
    if (!popupData.autoClose) {
        linkRow.appendChild(closeButton);
    }
    if (popupData.fullLink) {
        popup.style.cursor = "pointer";
        popup.addEventListener("click", () => {
            window.location.assign(popupData.fullLink);
        })
    }

    popupContent.appendChild(message);
    popupContent.appendChild(linkRow);
    popup.appendChild(popupContent);
    document.body.appendChild(popup);
}
function handleNewMessage(payload) {
    const { new: message } = payload;
    if (localStorage.getItem(`chat-convo-all-muted`) == 1 || localStorage.getItem(`channel-muted-${message.channel_id}`) == 1) return;
    if (message.content.length > 50) {
        message.content = message.content.slice(0, 50);
        message.content += "...";
    }
    createNotif({
        message: `(${message.channel_name}) ${message.display_name}: ${message.content}`,
        cta: false,
        autoClose: 3,
        actions: [
            ["Respond", () => {
                window.location.assign(`/chat?channel=${message.channel_id}`)
            }],
            ["Mute", () => {
                muteManager();
            }, "rgb(248,0,0)"]
        ]

    });
}

function createPopup(text = "Check out more awesome games like Spelunky, Minecraft, Cookie Clicker, Drift Hunters, and Slope, all unblocked and free to play at ccported.github.io!", opts) {
    const popup = document.createElement('div');
    popup.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        max-width: 800px;
        min-width: 500px;
        background-color: rgb(37,37,37);
        border: 2px solid #333;
        border-radius: 10px;
        padding: 25px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 1000;
        font-family: Arial, sans-serif;
    `;

    const message = document.createElement('p');
    message.textContent = text;
    message.style.marginBottom = '10px';
    message.style.color = 'white';

    const link = document.createElement('a');
    link.href = 'https://ccported.github.io';
    link.textContent = 'Visit ccported.github.io';
    link.style.cssText = `
        display: inline-block;
        background-color: #4CAF50;
        color: white;
        padding: 10px 15px;
        text-decoration: none;
        border-radius: 5px;
    `;
    const closeButton = document.createElement('a');
    closeButton.href = 'javascript:void(0)';
    closeButton.textContent = 'Close';
    closeButton.style.cssText = `
        display: inline-block;
        background-color: rgb(248,0,0);
        color: white;
        padding: 10px 15px;
        text-decoration: none;
        border-radius: 5px;
    `;
    closeButton.onclick = () => popup.remove();
    const linkRow = document.createElement('div');
    linkRow.style.display = 'flex';
    linkRow.style.justifyContent = 'space-between';
    linkRow.appendChild(link);
    linkRow.appendChild(closeButton);

    popup.appendChild(message);
    popup.appendChild(linkRow);

    document.body.appendChild(popup);
    localStorage.setItem("ccported-popup", "yes", true)
}

init();