window.ccPorted = window.ccPorted || {};
if (typeof supabase === "undefined") {
    log("Supabase script not installed, installing");
    installSupascript().then(() => {
        log("Supabase script loaded");
        postSupaInstall();
    });
} else {
    try {
        if (!window.ccSupaClient) window.ccSupaClient = createClient();
        postSupaInstall();
    } catch (e) {
        log("Error occured when creating client, or during postSupaInstall" + "\n" + e.stack);
    }
}
async function postSupaInstall() {
    window.ccPorted.userPromise = new Promise((resolve, reject) => {
        window.ccSupaClient.auth.getUser().then(({ data }) => {
            try {
                const { user } = data;
                window.user = user;
                window.ccPorted.user = user;
                if (user && document.querySelectorAll(".loggedInReplacable").length > 0) {
                    document.querySelectorAll(".loggedInReplacable").forEach(el => {
                        el.style.display = 'none';
                    });
                    document.querySelector(".loggedInAddable").innerHTML = `<a href="/profile/" class="cc">${user.user_metadata.display_name}</a>`
                }
                resolve(user);
            } catch (err) {
                reject(err);
            }
        });
    });
    window.user = {};
    window.ccPorted = window.ccPorted || {};
}
function log(...args) {
    console.log("[CCPORTED]: ", ...args);
    if (window.ccPorted?.stats) {
        window.ccPorted.stats.log(...args);
    }
}
async function importJSON(path) {
    let url;
    if (path.startsWith("/") && !path.startsWith("//")) {
        url = new URL(path, window.location.origin);
    } else {
        url = new URL(path);
    }
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
function shuffle(array) {
    let currentIndex = array.length;

    // While there remain elements to shuffle...
    while (currentIndex != 0) {

        // Pick a remaining element...
        let randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }
}
function installSupascript() {
    log("Installing Supabase script");
    const script = document.createElement("script");
    script.src = "https://unpkg.com/@supabase/supabase-js@2";
    document.head.appendChild(script);
    const loadPromise = new Promise((r, rr) => {
        script.onload = () => {
            window.ccSupaClient = createClient();
            r();
        }
    });

    return loadPromise;
}
function createClient() {
    const SUPABASE_URL = 'https://dahljrdecyiwfjgklnvz.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhaGxqcmRlY3lpd2ZqZ2tsbnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjgyNjE3NzMsImV4cCI6MjA0MzgzNzc3M30.8-YlXqSXsYoPTaDlHMpTdqLxfvm89-8zk2HG2MCABRI';
    return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
function shortcut(keys, cb) {
    log(`Creating shortcut for keys ${keys}, calling ${cb.name}`);
    var keyMap = {};
    for (const key of keys) {
        keyMap[key] = false;
    }
    document.addEventListener("keydown", (e) => {
        if (keyMap[e.which] !== undefined) {
            keyMap[e.which] = true;
        }
        if (check()) {
            cb();
        }
    });
    document.addEventListener("keyup", (e) => {
        if (keyMap[e.which] !== undefined) {
            keyMap[e.which] = false;
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
function decamelize(string) {
    // string are in camelcase
    // should end up as "Camel Case"
    let denormalized = "";
    for (let i = 0; i < string.length; i++) {
        if (string[i] === string[i].toUpperCase() && ((string[i+1] && string[i+1] === string[i+1].toUpperCase()) || !string[i+1])) {
            denormalized += " " + string[i];
        } else {
            denormalized += string[i];
        }
    }
    // capitalize first character
    denormalized = denormalized[0].toUpperCase() + denormalized.slice(1);
    return denormalized;
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
        z-index: 99999;
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