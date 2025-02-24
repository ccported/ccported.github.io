try {
    const client = window.ccSupaClient;
    const feilds = [".card-content .card-title", ".card-content .card-description", ".card-content .card-tags .tag"];
    const failedInputCheckLag = 750;
    const cardsContainer = document.querySelector(".cards");
    const searchInput = document.getElementById("searchBox");
    const allTags = document.querySelectorAll(".tag");
    const sortButton = document.getElementById("sort");
    const pickForMe = document.getElementById("pickforme");
    // const addGameRequestButton = document.getElementById("addGameRequestButton");
    const sortDirectionText = document.getElementById("order");
    const header = document.querySelector('header');
    const toggleBtn = document.querySelector('.toggle-btn');

    const sortStates = [
        [() => {
            sortCardsByClicks((cards) => {
                cards.sort((a, b) => {
                    const aPinned = a.hasAttribute("data-pinned");
                    const bPinned = b.hasAttribute("data-pinned");
                    if (aPinned && !bPinned) return -1;
                    if (!aPinned && bPinned) return 1;
                    return 0;
                });
                return cards;
            })
        }, "Hot"],
        [() => {
            sortCardsAlphabetically(1, (cards) => {
                cards.sort((a, b) => {
                    const aPinned = a.hasAttribute("data-pinned");
                    const bPinned = b.hasAttribute("data-pinned");
                    if (aPinned && !bPinned) return -1;
                    if (!aPinned && bPinned) return 1;
                    return 0;
                });
                return cards;
            });
        }, "A-Z"],
        [() => {
            sortCardsAlphabetically(-1, (cards) => {
                cards.sort((a, b) => {
                    const aPinned = a.hasAttribute("data-pinned");
                    const bPinned = b.hasAttribute("data-pinned");
                    if (aPinned && !bPinned) return -1;
                    if (!aPinned && bPinned) return 1;
                    return 0;
                });
                return cards;
            });
        }, "Z-A"],
        [() => {
            sortCardsRandomly((cards) => {
                cards.sort((a, b) => {
                    const aPinned = a.hasAttribute("data-pinned");
                    const bPinned = b.hasAttribute("data-pinned");
                    if (aPinned && !bPinned) return -1;
                    if (!aPinned && bPinned) return 1;
                    return 0;
                });
                return cards;
            })
        }, "Random"]
    ]
    let showingAds = true;
    let needToLoadAds = false;
    let lastInputTime = Date.now();
    let query = new URLSearchParams(window.location.search);
    let cachedRomsJSON = null;
    let cachedHotOrder = [];
    let sortState = 0;
    let cardsCache = [];

    searchInput.value = "";
    window.gameRQPopupOpen = false;
    document.querySelector(".cards").classList.add("loading");

    async function importJSON(path) {
        let url;
        if (path.startsWith("/") && !path.startsWith("//")) {
            url = new URL(path, window.location);
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
        if (!res.ok) {
            return {};
        }
        return res.json() || {};
    }
    async function testOpenServers() {
        const servers = ["https://dahljrdecyiwfjgklnvz.supabase.co"];
        const responses = await Promise.all(servers.map(server => {
            fetch(server)
        }));
        const json = await Promise.all(responses.map(response => response.json()));
        // expexted response should have "error: requested path is invalid"
        const valid = null;
        json.forEach((serverRes, i) => {
            if (serverRes["error"].includes("requested path is invalid")) {
                valid = servers[i];
                return;
            }
        });
        return valid;
    }
    async function baseRender() {
        try {
            log("Attempting base render");
            log("Cards rendered: " + window.ccPorted.cardsRendered)
            log("Base render occuring: " + window.ccPorted.baseRendering);
            if (window.ccPorted.baseRendering) return;
            if (window.ccPorted.cardsRendered) return;
            window.ccPorted.serverBlocked = true;
            window.ccPorted.baseRendering = true;

            // createNotif({
            //     message: "Something is blocking the connection to the server. You will not be able to login, which means that high scores will not be saved and your games will not save across domains and devices.",
            //     cta: false,
            //     autoClose: 5
            // });
            const gamesJson = await importJSON("/games.json");
            const { games } = gamesJson;
            log(`Games ${games.length} found.`);
            games.forEach(game => {
                const card = buildCard(game);
                const id = card.getAttribute('id');
                const links = card.querySelectorAll('.card-content .card-links a');
                card.style.cursor = "pointer";
                card.setAttribute('data-clicks', 0);
                card.addEventListener('click', (e) => {
                    if (e.target.tagName == "SPAN" || e.target.tagName == "A") {
                        if (e.target.tagName == "A") {
                            e.preventDefault();
                            const protocol = window.location.protocol;
                            const hostname = window.location.hostname;
                            const fullURL = e.target.href;
                            let x = fullURL.replace("ccported.github.io", hostname);
                            console.log(protocol);
                            x = x.replace("https://", protocol + "//");
                            window.open(x, '_blank');
                        }
                        return;
                    }
                    const protocol = window.location.protocol;
                    const hostname = window.location.hostname;
                    const fullURL = links[0].href;
                    let x = fullURL.replace("ccported.github.io", hostname + "//");
                    console.log(protocol);
                    x = x.replace("https://", protocol);
                    window.open(links[0].href.replace("ccported.github.io", window.location.hostname), '_blank');
                });
                checkSeenGame(id, card);
                markGameSeen(id);
                cardsCache.push(card);
                cardsContainer.appendChild(card);
            });
            setSort(0);
            loadPinnedStates();
            log("Loading ROMs")
            document.querySelector(".cards").classList.remove("loading");
            try {
                let romsJSON = await importJSON("/roms/roms.json");
                let unseenRoms = [];
                log(`Roms found (length not calculated - reason: deep)`);
                Object.keys(romsJSON).forEach(key => {
                    const romsList = romsJSON[key];
                    romsList.forEach(([romLink, romID]) => {
                        const name = `${key}-${normalize(romID)}`;
                        if (!checkRomSeen(name)) unseenRoms.push([key, romID]);
                        markGameSeen(name);
                    })
                });
                if (unseenRoms.length > 0) {
                    if (unseenRoms.length == 1) {
                        document.getElementById("romLinks").innerHTML += ` (${unseenRoms[0][0]}/${unseenRoms[0][1]} New!)`;
                    } else {
                        document.getElementById("romLinks").innerHTML += ` (${unseenRoms.length} New!)`;
                    }
                }
            } catch (e) {
                log("Failed to load ROMs: " + e);
            }
            if (query.has("q")) {
                if (query.get("q").length > 0) {
                    log(`Search query exists: <${query.get('q')}>`);
                    searchInput.value = query.get("q");
                    openSearch();
                    input();
                } else {
                    log(`Search query exists but is empty`);
                    query.delete("q");
                    var url = new URL(window.location.href);
                    url.search = query.toString();
                    window.history.pushState({}, '', url);
                }
            }
        } catch (e) {
            log("Failed to import manually" + "\n" + e.stack);
        }
    }
    async function init() {
        log("Initializing");
        window.ccPorted = window.ccPorted || {};
        window.ccPorted.cardsRendered = false;
        setTimeout(() => {
            baseRender();
        }, 3000);

        createPopup({
            title: 'Hiring!',
            message: "We are hiring! We are looking for interns to help add games and manage the community.",
            cta: {
                text: "Apply",
                link: "https://forms.gle/kWJRXuYN93unLkZRA"
            }
        });
        const gamesJson = await importJSON("/games.json");
        const { games } = gamesJson;
        log(`Got ${games.length} games`);
        let clicks;
        try {
            clicks = await getAllClicks();
        } catch (e) {
            log(e);
            clicks = {};
        }
        games.forEach(game => {
            const card = buildCard(game);
            const id = card.getAttribute('id');
            // get links
            const links = card.querySelectorAll('.card-content .card-links a');
            card.style.cursor = "pointer";
            card.setAttribute('data-clicks', clicks[id] || 0);
            card.addEventListener('click', (e) => {
                if (e.target.tagName == "SPAN" || e.target.tagName == "A") {
                    // not the card, but an item for which something happens on the card
                    if (e.target.tagName == "A") {
                        e.preventDefault();
                        // if it's a link, open it
                        incrementClicks(id);
                        const protocol = window.location.protocol;
                        const hostname = window.location.hostname;
                        const fullURL = e.target.href;
                        let x = fullURL.replace("ccported.github.io", hostname);
                        console.log(protocol);
                        x = x.replace("https://", protocol + "//");
                        window.open(e.target.href.replace("ccported.github.io", window.location.hostname), '_blank');
                    }
                    return;
                }
                incrementClicks(id);
                const protocol = window.location.protocol;
                const hostname = window.location.hostname;
                const fullURL = links[0].href;
                let x = fullURL.replace("ccported.github.io", hostname);
                console.log(protocol);
                x = x.replace("https://", protocol + "//");
                window.open(x, '_blank');
            });
            checkSeenGame(id, card);
            markGameSeen(id);
            cardsCache.push(card);
            cardsContainer.appendChild(card);
        });
        setSort(0);
        loadPinnedStates();
        document.querySelector(".cards").classList.remove("loading");
        window.ccPorted.cardsRendered = true;
        try {
            let romsJSON = await importJSON("/roms/roms.json");
            let unseenRoms = []
            Object.keys(romsJSON).forEach(key => {
                const romsList = romsJSON[key];
                romsList.forEach(([romLink, romID]) => {
                    const name = `${key}-${normalize(romID)}`;
                    if (!checkRomSeen(name)) unseenRoms.push([key, romID]);
                    markGameSeen(name);
                })
            });
            if (unseenRoms.length > 0) {
                if (unseenRoms.length == 1) {
                    document.getElementById("romLinks").innerHTML += ` (${unseenRoms[0][0]}/${unseenRoms[0][1]} New!)`
                } else {
                    document.getElementById("romLinks").innerHTML += ` (${unseenRoms.length} New!)`
                }
            }
        } catch (e) {
            log("Failed to load roms.json: " + e);
        }
        if (query.has("q")) {
            if (query.get("q").length > 0) {
                log(`Search query exists: <${query.get('q')}>`)
                searchInput.value = query.get("q");
                openSearch();
                input();
            } else {
                log(`Search query exists but is empty`)
                query.delete("q");
                var url = new URL(window.location.href);
                url.search = query.toString();
                window.history.pushState({}, '', url);
            }
        }
        log("Home page loaded");
        window.ccPorted.baseRendering = false;
        loadAds();
    }
    async function incrementClicks(gameID) {
        try {
            log(`Incrementing clicks for game ${gameID}`);
            let { data: game_clicks, error } = await client
                .from('game_clicks')
                .select('clicks')
                .eq('gameID', gameID);

            if (error) {
                log('Error getting game clicks:', error.message);
                return;
            }
            const clicks = (game_clicks[0] || { clicks: 0 }).clicks + 1;
            // upsert
            let { data, error: upsertError } = await client
                .from('game_clicks')
                .upsert([{ gameID, clicks }]);
        } catch (e) {
            log(e);
        }
    }
    async function getGameClicks(gameID) {
        try {
            log(`Getting clicks for game ${gameID}`);
            let { data: game_clicks, error } = await client
                .from('game_clicks')
                .select('clicks')
                .eq('gameID', gameID);

            if (error) {
                log('Error getting game clicks:', error.message);
                return;
            }
            return (game_clicks[0] || { clicks: 0 }).clicks;
        } catch (e) {
            log(e);
            return 0;
        }
    }
    async function getAllClicks() {
        try {
            log(`Getting all game clicks`);
            let { data: game_clicks, error } = await client
                .from('game_clicks')
                .select('gameID, clicks');

            if (error) {
                baseRender();
                log('Error getting game clicks:', error.message);
                return;
            }
            let obj = {};
            game_clicks.forEach(game => {
                obj[game.gameID] = game.clicks;
            });
            return obj;
        } catch (e) {
            log(e);
            baseRender();
            return {}
        }
    }
    function pickRandomCard() {
        return cardsCache[Math.floor(Math.random() * cardsCache.length)]

    }
    function sortCardsRandomly(middle = () => { }) {
        let cardsArray = Array.from(document.querySelectorAll(".card"));
        shuffle(cardsArray);
        let cardsContainer = document.querySelector(".cards");
        cardsArray = middle(cardsArray)
        removeCards();
        cardsArray.forEach(card => {
            cardsContainer.appendChild(card);
        });
    }
    async function sortCardsByClicks(middle = () => { }) {
        if (window.ccPorted?.serverBlocked) {
            return sortCardsRandomly(middle);
        }
        log(`Sorting cards by clicks`);
        let cardsArray = Array.from(document.querySelectorAll(".card"));
        cardsArray.sort((a, b) => {
            return parseInt(b.getAttribute('data-clicks')) - parseInt(a.getAttribute('data-clicks'));
        });
        cardsArray = middle(cardsArray);
        let cardsContainer = document.querySelector(".cards");
        removeCards();
        cardsArray.forEach(card => {
            cardsContainer.appendChild(card);
        });
    }
    async function input(sortState = 0) {
        log(`Searching for ${searchInput.value}`);
        if (searchInput.value.length <= 0) {
            setSort(sortState);
            var url = new URL(window.location);
            url.searchParams.delete("q");
            window.history.pushState({}, '', url);
            return;
        }
        // update query parameters
        var url = new URL(window.location.href);
        url.searchParams.set("q", searchInput.value);
        window.history.pushState({}, '', url);
        // if the input has content, add open it
        openSearch();

        // add click event to clear the input
        var matching = cardsCache.map((card) => {
            var score = 0;
            feilds.forEach(feild => {
                var allFeilds = card.querySelectorAll(feild);
                for (var i = 0; i < allFeilds.length; i++) {
                    var string = normalize(allFeilds[i].innerText);
                    if (string.indexOf(normalize(searchInput.value)) !== -1) {
                        score++;
                    }
                }
            })
            return [score, card]
        });
        matching = matching.sort((a, b) => {
            return b[0] - a[0]
        });
        removeCards();
        matching = matching.filter((card) => {
            if (card[0] == 0) return false;
            cardsContainer.appendChild(card[1]);
            return true;
        });
        shuffleAds();
        lastInputTime = Date.now();
        if (matching.length == 0) {
            removeCards();
            hideAds();
            var results = await testRomSearch(searchInput.value);
            if (results.length > 0) {
                var h3 = document.createElement("h3");
                h3.innerHTML = `Rom Results`
                var fullLibrary = document.createElement("p");
                fullLibrary.innerHTML = "<i style = 'font-weight:normal'>View the <a href = 'https://" + window.location.hostname + "/roms/'>full library</a></i>";

                var div = document.createElement("div");
                div.appendChild(h3)
                div.appendChild(fullLibrary);
                for (const result of results) {
                    var p = document.createElement("p");
                    var [url, name, platform] = result;
                    p.innerHTML = `<a href = "/emulator/?core=${platform}&rom=${url}">${name}</a>`;
                    div.appendChild(p)
                }
                document.getElementById("check-roms").innerHTML = "";
                document.getElementById("check-roms").appendChild(div);
            } else {
                setTimeout(() => {
                    if (Date.now() - lastInputTime >= failedInputCheckLag) {
                        client.from("failed_search")
                            .insert([{ search_content: searchInput.value }])
                    }
                }, failedInputCheckLag);
            }
        } else {
            showAds();
            document.getElementById("check-roms").innerHTML = "";
        }
    }
    async function testRomSearch(query) {
        log(`Searching for roms with ${query}`);
        let response;
        let json;
        if (!cachedRomsJSON) {

            response = await fetch("https://" + window.location.hostname + "/roms/roms.json");
            json = await response.json();
            cachedRomsJSON = json;
        } else {
            json = cachedRomsJSON;
        }

        const normalizedQuery = normalize(query);
        const results = [];

        for (const platform in json) {
            for (const [url, name] of json[platform]) {
                const normalizedName = normalize(name);
                if (normalizedName.includes(normalizedQuery)) {
                    results.push([url, name, platform]);
                }
            }
        }

        return results;
    }
    async function addGameRequest(game_name) {
        try {
            log(`Adding game request for ${game_name}`);
            // run function 'notion-integration'
            const response = await fetch('https://dahljrdecyiwfjgklnvz.supabase.co/functions/v1/notion-integration', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhaGxqcmRlY3lpd2ZqZ2tsbnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjgyNjE3NzMsImV4cCI6MjA0MzgzNzc3M30.8-YlXqSXsYoPTaDlHMpTdqLxfvm89-8zk2HG2MCABRI',
                    'Content-Type': 'application/json'
                },
                cors: 'no-cors',
                body: JSON.stringify({ name: game_name })
            });


            log('Game request added:');
        } catch (error) {
            log('Error adding game request:', error.message);
        }
    };
    function showAds() {
        log("Showing ads");
        showingAds = true;
        if (needToLoadAds) {
            loadAds();
        } else {
            const ads = document.querySelectorAll(".tad");
            ads.forEach(ad => {
                ad.style.display = "flex";
            });
        }
    }
    function hideAds() {
        log("Hiding ads");
        showingAds = false;
        const ads = document.querySelectorAll(".tad");
        ads.forEach(ad => {
            ad.style.display = "none";
        });
    }
    function openSearch() {
        log("Search box opened");
        searchInput.type = "text";
        searchInput.focus();
    }
    function markGameSeen(id) {
        localStorage.setItem(`seen-${id}`, "yes");
    }
    function checkSeenGame(id, card) {
        if (localStorage.getItem(`seen-${id}`) !== "yes") {
            card.querySelector(".card-content .card-title").textContent += " (New)";
            card.classList.add("new");
        }
    }
    function checkRomSeen(id) {
        return localStorage.getItem(`seen-${id}`) == "yes";
    }
    function normalize(string) {
        string = string.toLowerCase();
        string = string.replace(/[^a-z0-9]/g, "");
        string = string.replace(/\s/g, "");
        return string;
    }
    function createAddGamePopup() {
        log("Creating game request popup");
        const popup = document.createElement("div");
        popup.classList.add("popup");
        popup.innerHTML = `
        <div class="popup-content">
            <h2>Request a game</h2>
            <input type="text" id="gameRequestInput" placeholder="Game name">
            <div class = "popup-buttons">
                <button id = "nvmd">Close</button><button id="sendGameRequestButton">Send</button>
            </div>
        </div>
    `;
        document.body.appendChild(popup);
        window.gameRQPopupOpen = true;
        return popup;
    }
    function closePopup() {
        log("Closing game request popup");
        document.querySelector(".popup").remove();
        window.gameRQPopupOpen = false;
    }
    function sortCardsAlphabetically(direction, middle = () => { }) {
        log(`Sorting cards alphabetically`);
        let cardsArray = Array.from(document.querySelectorAll(".card"));
        cardsArray.sort((a, b) => {
            let aText = a.querySelector(".card-content .card-title").innerText;
            let bText = b.querySelector(".card-content .card-title").innerText;
            return compareAlpha(aText, bText) * direction;
        });
        cardsArray = middle(cardsArray)
        let cardsContainer = document.querySelector(".cards");
        removeCards();
        cardsArray.forEach(card => {
            cardsContainer.appendChild(card);
        });
    }
    function compareAlpha(a, b) {
        let normalizedA = normalize(a);
        let normalizedB = normalize(b);

        var alphaCharacters = "0123456789abcdefghijklmnopqrstuvwxyz";
        for (var i = 0; i < normalizedA.length; i++) {
            if (normalizedB.length <= i) {
                return 1;
            }
            if (alphaCharacters.indexOf(normalizedA[i]) < alphaCharacters.indexOf(normalizedB[i])) {
                return -1;
            }
            if (alphaCharacters.indexOf(normalizedA[i]) > alphaCharacters.indexOf(normalizedB[i])) {
                return 1;
            }
        }
    }
    function setSort(state) {
        log(`Setting sort to ${state}`);
        if (searchInput.value.length > 0) {
            sortDirectionText.innerHTML = "Seach";
            return;
        }
        sortState = state;
        sortStates[sortState][0]();
        shuffleAds();
        sortDirectionText.innerHTML = sortStates[sortState][1];
    }
    function shuffleAds() {
        const ads = document.querySelectorAll(".tad");
        ads.forEach(ad => {
            ad.remove();
            var randomCard = document.querySelector(".cards").children[Math.floor(Math.random() * document.querySelector(".cards").children.length)];
            document.querySelector(".cards").insertBefore(ad, randomCard);
        });
    }
    function createPopup(popupData) {
        log(`Creating popup with message ${popupData.message}`);
        const popup = document.createElement('div');
        popup.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        max-width: 100vw;
        background-color: rgb(37,37,37);
        border: 2px solid #333;
        border-radius: 10px;
        padding: 25px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 1000;
        font-family: Arial, sans-serif;
    `;

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
        linkRow.style.alignItems = 'right';
        linkRow.style.gap = '10px';
        // linkRow.style.justifyContent = 'space';
        if (popupData.cta) {
            linkRow.appendChild(link);
        }
        linkRow.appendChild(closeButton);

        popup.appendChild(message);
        popup.appendChild(linkRow);

        document.body.appendChild(popup);
    }
    function removeCards() {
        log("Removing all cards");
        cardsContainer.querySelectorAll(".card").forEach(card => {
            card.remove();
        });
    }

    function buildCard(game) {
        const card = document.createElement("div");
        card.classList.add("card");
        card.classList.add("grid");
        card.id = game.name;

        // Add star icon
        const star = document.createElement("span");
        star.classList.add("star-icon");
        star.innerHTML = "★";
        star.addEventListener("click", (e) => {
            e.stopPropagation();
            togglePin(card, star);
        });

        const bg = document.createElement("div");
        bg.classList.add("card-bg");
        bg.style.backgroundImage = `url('${game.image}')`;

        const content = document.createElement("div");
        content.classList.add("card-content");

        const contentInner = document.createElement("div");
        const title = document.createElement("h2");
        title.classList.add("card-title");
        title.textContent = game.fName;

        const description = document.createElement("p");
        description.classList.add("card-description");
        description.textContent = game.description;

        const tags = document.createElement("div");
        tags.classList.add("card-tags");
        game.tags.forEach(tag => {
            const tagElement = document.createElement("span");
            tagElement.classList.add("tag");
            tagElement.setAttribute("data-tag", tag);
            tagElement.textContent = decamelize(tag);
            tagElement.addEventListener("click", () => {
                searchInput.value = tagElement.innerText;
                input();
            });
            tags.appendChild(tagElement);
        });

        const links = document.createElement("div");
        links.classList.add("card-links");
        game.links.forEach(link => {
            const linkElement = document.createElement("a");
            linkElement.href = link.link;
            linkElement.textContent = `${link.action ? link.action : "Play"} ${(link.pre) ? link.pre : game.fName} on ${link.name}`;
            links.appendChild(linkElement);
        });

        contentInner.appendChild(title);
        contentInner.appendChild(description);
        contentInner.appendChild(tags);
        content.appendChild(contentInner);
        content.appendChild(links);

        card.appendChild(star);
        card.appendChild(bg);
        card.appendChild(content);

        return card;
    }
    function togglePin(card, star) {
        const isPinned = card.hasAttribute("data-pinned");
        if (!isPinned) {
            card.setAttribute("data-pinned", "true");
            star.classList.add("pinned");
            savePinnedState(card.id, true);
        } else {
            card.removeAttribute("data-pinned");
            star.classList.remove("pinned");
            savePinnedState(card.id, false);
        }
        sortPinnedCards();
    }
    function savePinnedState(cardId, isPinned) {
        const pinnedCards = getPinnedCards();
        if (isPinned) {
            pinnedCards.add(cardId);
        } else {
            pinnedCards.delete(cardId);
        }
        localStorage.setItem('ccported-pinnedCards', JSON.stringify([...pinnedCards]));
    }
    function getPinnedCards() {
        const saved = localStorage.getItem('ccported-pinnedCards');
        return new Set(saved ? JSON.parse(saved) : []);
    }
    function loadPinnedStates() {
        const pinnedCards = getPinnedCards();
        pinnedCards.forEach(cardId => {
            const card = document.getElementById(cardId);
            if (card) {
                const star = card.querySelector('.star-icon');
                card.setAttribute("data-pinned", "true");
                star.classList.add("pinned");
            }
        });
        sortPinnedCards();
    }

    function sortPinnedCards() {
        let cardsArray = Array.from(document.querySelectorAll(".card"));


        cardsArray.sort((a, b) => {
            const aPinned = a.hasAttribute("data-pinned");
            const bPinned = b.hasAttribute("data-pinned");
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            return 0;
        });

        let cardsContainer = document.querySelector(".cards");
        removeCards();
        cardsArray.forEach(card => cardsContainer.appendChild(card));
    }
    function loadAds(num = 3) {
        log(`Loading ${num} ads`);
        if (!window.adsEnabled) return;
        if (!showingAds) {
            log("Ads not shown, not loading");
            needToLoadAds = true;
            return;
        };
        needToLoadAds = false;
        for (let i = 0; i < num; i++) {
            const adHTML = `<div data-mndbanid="c5cf29fe-386b-45f3-a462-bc8326f5a713"></div>`;
            const adCard = document.createElement("div");
            adCard.classList.add("tad");
            adCard.innerHTML = adHTML;
            adCard.style.backgroundImage = `url('/assets/images/loading.gif')`;
            adCard.style.backgroundSize = "fit";
            adCard.style.backgroundRepeat = "no-repeat";
            adCard.style.backgroundPosition = "center";

            var randomCard = document.querySelector(".cards").children[Math.floor(Math.random() * document.querySelector(".cards").children.length)];
            document.querySelector(".cards").insertBefore(adCard, randomCard);
        }
        const script = document.createElement("script");
        script.src = "https://ss.mrmnd.com/banner.js";
        document.body.appendChild(script);
        script.onload = () => {
            log("Ads loaded");
        }
    }
    function rerenderCards(layout) {
        document.querySelectorAll('.card').forEach(card => {
            card.classList.toggle('rows', layout === 'rows');
            card.classList.toggle('grid', layout === 'grid');
        });
    }
    toggleBtn.addEventListener('click', () => {
        const currentLayout = toggleBtn.getAttribute('data-current');
        const newLayout = currentLayout === 'grid' ? 'rows' : 'grid';
        toggleBtn.setAttribute('data-current', newLayout);
        rerenderCards(newLayout);
    });
    // document.addEventListener("keydown", (e) => {
    //     if (e.key == "Escape" && window.gameRQPopupOpen) {
    //         closePopup();
    //     }
    //     if (e.key == "Enter" && window.gameRQPopupOpen) {
    //         document.getElementById("sendGameRequestButton").click();
    //     }
    // });
    // addGameRequestButton.addEventListener("click", () => {
    //     createAddGamePopup();
    //     const sendButton = document.getElementById("sendGameRequestButton");
    //     const nvmdButton = document.getElementById("nvmd");
    //     const popup = document.querySelector(".popup");

    //     popup.addEventListener("click", (e) => {
    //         if (e.target == popup) {
    //             closePopup();
    //         }
    //     });
    //     nvmdButton.addEventListener("click", () => {
    //         closePopup();
    //     });
    //     sendButton.addEventListener("click", async () => {
    //         const input = document.getElementById("gameRequestInput");
    //         try {
    //             // show join discord instead
    //             document.getElementById("gameRequestInput").value = "";
    //             const p = document.createElement("p");
    //             p.innerHTML = "We are not accepting game requests through the website at this time. <a href = 'https://discord.gg/4nURBJmUJY'>Please join the discord</a> and mention the @gamedev role in #game-requests to submit a game request."
    //             const secondP = document.createElement("p");
    //             secondP.innerHTML = "If you are unable to join the discord, please email us at <a href = 'mailto:sojscoder@gmail.com'>sojscoder@gmail.com</a>.";

    //             if (input.value.toLowerCase().includes("roblox")) {
    //                 alert("20 game requests for roblox are submitted every day. Please no more. Thanks");
    //                 closePopup();
    //                 return;
    //             }
    //             await addGameRequest(input.value);
    //         } catch (e) {
    //             // alert("An error occurred while sending your request. Please try again later.")
    //             log("error" + e);
    //         }
    //         closePopup();
    //     });

    // });
    pickForMe.addEventListener("click", (e) => {
        var card = pickRandomCard();
        card.click();
    })
    sortButton.addEventListener("click", () => {
        searchInput.value = "";
        sortState++;
        if (sortState >= sortStates.length) {
            sortState = 0;
        }
        input(sortState);
        setSort(sortState);
    });
    // searchInput.addEventListener("click", (e) => {
    //     // only clear if the click is on the "x" button
    //     var rect = searchInput.getBoundingClientRect();
    //     var x = rect.right - 10 - 15; // 10 is padding, 15 is the width of the "x" button
    //     if (e.clientX > x) {
    //         log("Clearing search input");
    //         searchInput.value = "";
    //         var url = new URL(window.location);
    //         url.searchParams.delete("q");
    //         window.history.pushState({}, '', url);
    //         setSort(sortState)
    //         searchInput.type = "hidden";
    //     }

    // });
    searchInput.addEventListener("mousemove", (e) => {
        // only set if the click is on the "x" button
        var rect = searchInput.getBoundingClientRect();
        var x = rect.right - 10 - 15; // 10 is padding, 15 is the width of the "x" button
        if (e.clientX > x) {
            searchInput.style.cursor = "pointer";
        } else {
            searchInput.style.cursor = "text";
        }

    })
    searchInput.addEventListener("input", (e) => {
        input();
    });


    init()
} catch (err) {
    log(err)
}

