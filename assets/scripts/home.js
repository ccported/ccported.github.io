try {
    const client = window.ccSupaClient;
    const feilds = [".card-content .card-title", ".card-content .card-description", ".card-content .card-tags .tag"];
    const failedInputCheckLag = 750;
    const cardsContainer = document.querySelector(".cards");
    const searchInput = document.getElementById("searchBox");
    const allTags = document.querySelectorAll(".tag");
    const sortButton = document.getElementById("sort");
    const pickForMe = document.getElementById("pickforme");
    const sortDirectionText = document.getElementById("order");
    const header = document.querySelector('header');
    const toggleBtn = document.querySelector('.toggle-btn');

    window.server = null;
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
    let lastInputTime = Date.now();
    let query = new URLSearchParams(window.location.search);
    let cachedRomsJSON = null;
    let sortState = 0;
    let cardsCache = [];

    searchInput.value = "";
    window.gameRQPopupOpen = false;
    document.querySelector(".cards").classList.add("loading");



    async function importGames() {
        log("Importing games... waiting for AWS")
        await window.ccPorted.userPromise;
        log("AWS Loaded, waiting for query");
        const dynamodb = window.ccPorted.documentClient;
        const games = [];
        const params = {
            TableName: 'games_list',
            ProjectionExpression: 'gameID, clicks, description, fName, tags, thumbPath, uploadedTimestamp, updatedTimestamp',
            FilterExpression: 'isOnline = :o',
            ExpressionAttributeValues: {
                ':o': true
            }
        };


        try {
            const data = await dynamodb.scan(params).promise();
            log(`Query fullfiled, found ${data.Items.length} games.`);
            data.Items.forEach(item => {
                games.push(item);
            });
        } catch (error) {
            console.error('Error loading games:', error);
            document.querySelector('.container').innerHTML = `
                <div class="error">
                    Error loading games. Please try again later.
                    <br>
                    <span style = "color: red">${error.message}</span>
                    <br>
                    <p>Please contact us at <a href = "mailto:sojscoder@gmail.com">sojscoder@gmail.com</a> if this issue persists.</p>
                </div>
            `;
        }
        return { games }
    }
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
        let pserver = null;
        let serverIndex = 0;
        const serverList = await fetch('/servers.txt');
        const serversText = await serverList.text();
        const servers = serversText.split('\n');
        for (const server of servers) {

            const [address, name, path] = server.split(",");
            const toAttempt = address.trim();
            try {
                log(`Attempting server ${toAttempt}`);
                const res = await fetch(`https://${toAttempt}/blocked_res.txt`);
                if (res.ok) {
                    const text = await res.text();
                    if (text.indexOf("===NOT_BLOCKED===") !== -1) {
                        pserver = toAttempt;
                        return [toAttempt, serverIndex, path];
                    }
                }
            } catch (e) {
                log(`Server ${toAttempt} failed: ${e}`);
            }
            serverIndex++;
        }
    }
    async function baseRender(gamesJson) {
        try {
            log("Attempting base render");
            log("Cards rendered: " + window.ccPorted.cardsRendered)
            log("Base render occuring: " + window.ccPorted.baseRendering);
            if (window.ccPorted.baseRendering) return;
            if (window.ccPorted.cardsRendered) return;
            window.ccPorted.serverBlocked = true;
            window.ccPorted.baseRendering = true;

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
                            incrementClicks(id);
                            window.open(e.target.href, '_blank');
                        }
                        return;
                    }
                    incrementClicks(id);
                    window.open(links[0].href, '_blank');
                });
                checkSeenGame(game, card);
                cardsCache.push(card);
                cardsContainer.appendChild(card);
            });
            setSort(0);
            loadPinnedStates();
            log("Loading ROMs")
            document.querySelector(".cards").classList.remove("loading");
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
    async function checkForSwitchToAHost() {
        try {
            return;
            log("Checking switch to aHost");
            if (!window.ccPorted.aHosts) {
                const res = await fetch("/ahosts.txt");
                const text = await res.text();
                const hosts = text.split('\n');
                window.ccPorted.aHosts = hosts.map(h => h.trim());
            }
            if (window.ccPorted.aHosts.includes(window.location.hostname)) {
                log("Already on aHost");
                return;
            };
            for (const host of window.ccPorted.aHosts) {
                try {
                    log(`Checking ${host}`);
                    const blockedRes = await fetch(`https://${host}/blocked_res.txt`);
                    if (blockedRes.ok) {
                        const text = await blockedRes.text();
                        if (text.indexOf("===NOT_BLOCKED===") !== -1) {
                            window.location.href = `https://${host}/`
                        } else {
                            log(`${host} failed (wrong res)`);
                        }
                    } else {
                        log(`${host} failed (res not 200)`);
                    }
                } catch (e) {
                    log(`${host} failed (errored)!`)
                }
            }
        } catch (e) {
            log("Error checking for AHost switch")
        }
    }
    async function init() {
        log("Initializing");
        await checkForSwitchToAHost();
        window.ccPorted = window.ccPorted || {};
        window.ccPorted.cardsRendered = false;
        showKofiDonationModal();
        // createNotif({
        //     cta: {
        //         "link":"https://ko-fi.com/s/f33346d0ae",
        //         "text":"Get your own domain"
        //     },
        //     message: "Get your own custom CCPorted link!",
        //     autoClose: 7
        // })
        const [chosenServer, index, path] = await testOpenServers();
        window.ccPorted.gameServer = {};
        window.ccPorted.gameServer.server = chosenServer.trim();
        window.ccPorted.gameServer.index = index;
        window.ccPorted.gameServer.path = path.trim();
        const gamesJson = await importGames();
        setTimeout(() => {
            baseRender(gamesJson);
        }, 3000);
        const { games } = gamesJson;
        log(`Got ${games.length} games`);
        games.forEach(game => {
            const card = buildCard(game);
            const id = card.getAttribute('id');
            // get links
            const links = card.querySelectorAll('.card-content .card-links a');
            card.style.cursor = "pointer";
            card.setAttribute('data-clicks', game.clicks || 0);
            card.addEventListener('click', (e) => {
                if (e.target.tagName == "SPAN" || e.target.tagName == "A") {
                    if (e.target.tagName == "A") {
                        e.preventDefault();
                        incrementClicks(id);
                        window.open(e.target.href, '_blank');
                    }
                    return;
                }
                incrementClicks(id);
                window.open(links[0].href, '_blank');
            });
            checkSeenGame(game, card);
            cardsCache.push(card);
            cardsContainer.appendChild(card);
        });
        setSort(0);
        loadPinnedStates();
        document.querySelector(".cards").classList.remove("loading");
        window.ccPorted.cardsRendered = true;
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
        checkIfAdsLoaded();
        rerenderAds();
    }
    async function checkIfAdsLoaded() {
        await window.ccPorted.adsLoadPromise;
        if (window.ccPorted.adsEnabled && window.innerWidth > 800) {
            // add margin for the ads
            document.querySelector(".cards").style.marginRight = "300px";
            document.querySelector(".search").style.marginRight = "300px";
        }
        console.log(window.ccPorted.adBlockEnabled);
        console.log(window.ccPorted.adsEnabled);
        if (!window.ccPorted.adsEnabled) {
            hideAds();
            if (localStorage.getItem("mining-consent") == 'true' && window.ccPorted.adBlockEnabled) {
                createModal({
                    heading: (sessionStorage.getItem("clicked_disable_adblocker") == 'true') ? 'You frickin liar' : "Please disable adblocker",
                    description: (sessionStorage.getItem("clicked_disable_adblocker") == 'true') ? 'This goin keep popping up until you disable (pretty please)' : "CCPorted is broke gang.... Please disable your adblocker to use the site.",
                    cta: (sessionStorage.getItem("clicked_disable_adblocker") == 'true') ? "I've disabled my adblocker (for reals)" : "I've disabled my adblocker (don't lie gang or ts will keep popping up)",
                    closeFn: () => {
                        sessionStorage.setItem("clicked_disable_adblocker", "true");
                    }
                })
            }
        }
    }
    async function incrementClicks(gameID) {
        try {
            log(`Incrementing clicks for game ${gameID}`);
            const params = {
                TableName: 'games_list',
                Key: {
                    gameID: gameID
                },
                UpdateExpression: 'SET clicks = clicks + :inc',
                ExpressionAttributeValues: {
                    ':inc': 1
                },
                ReturnValues: 'UPDATED_NEW'
            };
            const data = await window.ccPorted.documentClient.update(params).promise();
            log('Clicks incremented:', data.Attributes.clicks);
        } catch (e) {
            log(e);
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
        hideAds();
        // update query parameters
        if (searchInput.value.length > 0) {
            console.log("SEARCH LONG")
            var url = new URL(window.location.href);
            url.searchParams.set("q", searchInput.value);
            window.history.pushState({}, '', url);
            // if the input has content, add open it
            openSearch();

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
            matching = matching.filter((card) => {
                if (card[0] == 0) return false;
                cardsContainer.appendChild(card[1]);
                return true;
            });
            lastInputTime = Date.now();
            removeCards();
            if (matching.length == 0) {
                removeCards();
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
                }
            } else {
                matching.forEach((card) => {
                    cardsContainer.appendChild(card[1]);
                });
                document.getElementById("check-roms").innerHTML = "";
            }
        } else if (searchInput.value.length <= 0) {
            var url = new URL(window.location);
            console.log("SEARCH SHORT")
            url.searchParams.delete("q");
            window.history.pushState({}, '', url);
            removeCards();
            cardsCache.forEach(card => {
                cardsContainer.appendChild(card);
            });
            setSort(sortState);
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
    function hideAds() {
        log("Hiding ads");
        showingAds = false;
        const ads = document.querySelectorAll(".inxxx");
        ads.forEach(ad => {
            ad.remove();
        });
    }
    function openSearch() {
        searchInput.type = "text";
        searchInput.focus();
    }
    function checkSeenGame(game, card) {
        const uploaded = game.uploadedTimestamp;
        const updated = game.updatedTimestamp;
        const now = Date.now();
        const threshold = 1000 * 60 * 60 * 24 * 2; // 2 days
        if (uploaded && updated) {
            if (now - uploaded < threshold) {
                card.classList.add("new");
            } else if (now - updated < threshold) {
                card.classList.add("updated");
            }
        } else if (uploaded) {
            if (now - uploaded < threshold) {
                card.classList.add("new");
            }
        } else if (updated) {
            if (now - updated < threshold) {
                card.classList.add("updated");
            }
        }
    }
    function normalize(string) {
        string = string.toLowerCase();
        string = string.replace(/[^a-z0-9]/g, "");
        string = string.replace(/\s/g, "");
        return string;
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
        const ads = document.querySelectorAll(".inxxx");
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
        cardsContainer.querySelectorAll(".card").forEach(card => {
            card.remove();
        });
    }

    function buildCard(game) {
        const card = document.createElement("div");
        card.classList.add("card");
        card.classList.add("grid");
        card.id = game.gameID;

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
        bg.style.backgroundImage = `url('https://${window.ccPorted.gameServer.server}/${window.ccPorted.gameServer.path}${game.gameID}${game.thumbPath}')`;
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
        const linkElement = document.createElement("a");
        linkElement.href = `/play/?id=${game.gameID}&server=${window.ccPorted.gameServer.index}`;
        linkElement.textContent = `Play ${game.fName} on CCPorted`;
        links.appendChild(linkElement);

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
    function rerenderCards(layout) {
        document.querySelectorAll('.card').forEach(card => {
            card.classList.toggle('rows', layout === 'rows');
            card.classList.toggle('grid', layout === 'grid');
        });
        rerenderAds(layout)
    }
    async function showKofiDonationModal(options = {}) {

        localStorage.removeItem("seen-modal-dk");
        // Default options
        const defaults = {
            kofiUrl: 'https://ko-fi.com/ccported',
            goalAmount: '500',
            deadline: 'May 15, 2025',
            siteName: 'CCPorted',
            showOnce: false,
            miningEnabled: true // Option to enable/disable mining feature
        };

        // Merge defaults with provided options
        const config = { ...defaults, ...options };
        await window.ccPorted.miningLoadPromise;
        // if (window.mining || window.ccPorted.miningEnabled || window.ccPorted.miningLoading || localStorage.getItem("mining-consent") == 'true') {
        //     return;
        // }
        // Check if mining is already enabled globally, if so, we don't need to show the mining option
        if (config.miningEnabled && window.mining) {
            console.log("Mining is already active, not showing mining toggle in modal");
        }


        // Check if we should show the modal (if showOnce is true)
        if (config.showOnce) {
            const hasSeenModal = localStorage.getItem('kofiModalSeen');
            if (hasSeenModal) return;
        }

        // Create modal container
        const modalOverlay = document.createElement('div');
        modalOverlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.7);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 9999;
          opacity: 0;
          transition: opacity 0.3s ease;
        `;

        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
          background-color: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
          width: 90%;
          max-width: 480px;
          max-height: 80vh;
          overflow-y: auto;
          padding: 32px;
          position: relative;
          transform: translateY(20px);
          transition: transform 0.3s ease;
        `;

        // Close button
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '&times;';
        closeButton.style.cssText = `
          position: absolute;
          top: 15px;
          right: 15px;
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
        `;

        // Title
        const title = document.createElement('h2');
        title.textContent = `Support CCPorted (${formatTimeLeft(config.deadline)})`;
        title.style.cssText = `
          margin: 0 0 12px;
          text-align: center;
          font-size: 24px;
          font-weight: 700;
          color: #333;
        `;

        // Progress text 
        const progressText = document.createElement('div');
        progressText.style.cssText = `
          text-align: left;
          margin-bottom: 16px;
        `;
        progressText.innerHTML = `
          <p style="margin: 0 0 8px; color: #333; font-size: 16px;">
            If $${config.goalAmount} isn't raised by <b>${config.deadline}</b>, ${config.siteName} will be shutting down.
            In the month of April, CCPorted delivered over 6,000 GB of games, across 96 HTML games and ~290 roms, to over 50000 users. If you enjoyed playing a game on CCPorted, please consider supporting so future generations can enjoy it too.<br>
            If every single person who comes uses this site donated just $1, we would be able to expand across hundreds of servers, support multiplayer games, expand our library, and spread across hundreds of unblocked domains. If this sounds like something you want, please donate.
          </p>
        `;

        // // Call to action
        // const ctaText = document.createElement('p');
        // ctaText.textContent = 'Please consider supporting us in one of the following ways:';
        // ctaText.style.cssText = `
        //   margin: 0 0 20px;
        //   text-align: center;
        //   color: #555;
        //   font-size: 16px;
        // `;

        // Progress bar container
        const progressContainer = document.createElement('div');
        progressContainer.style.cssText = `
            width: 100%;
            background-color: #f1f1f1;
            border-radius: 8px;
            height: 16px;
            margin-bottom: 24px;
            overflow: hidden;
            position: relative;
            `;

        // Progress bar (initially empty)
        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
        width: 0%;
        height: 100%;
        background-color: #29abe0;
        border-radius: 8px;
        transition: width 1s ease;
        `;

        // Text label inside the progress bar
        const progressTextL = document.createElement('div');
        progressTextL.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            letter-spacing: 1px;
            color: #000;
            font-size: 12px;
            font-weight: bold;
            text-shadow: 1px 1px 1px rgba(255, 255, 255, 0.5);
            `;
        progressTextL.textContent = '$11/$500';

        // Add text and progress bar to container
        progressContainer.appendChild(progressBar);
        progressContainer.appendChild(progressTextL);

        // Support options container
        const supportOptions = document.createElement('div');
        supportOptions.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 20px;
        `;

        // Donation button
        const donateButton = document.createElement('a');
        donateButton.href = config.kofiUrl;
        donateButton.target = '_blank';
        donateButton.style.cssText = `
          display: block;
          background-color: #29abe0;
          color: white;
          text-align: center;
          padding: 12px 20px;
          border-radius: 8px;
          font-weight: bold;
          text-decoration: none;
          font-size: 18px;
          width: 100%;
          box-sizing: border-box;
          transition: background-color 0.2s ease;
        `;
        donateButton.textContent = 'Support us on Ko-fi';
        donateButton.onmouseover = function () {
            this.style.backgroundColor = '#1e8bba';
        };
        donateButton.onmouseout = function () {
            this.style.backgroundColor = '#29abe0';
        };

        // Add mining option if enabled and not already active globally
        let miningToggle;

        if (config.miningEnabled && !window.mining) {
            // Mining option container
            const miningContainer = document.createElement('div');
            miningContainer.style.cssText = `
            background-color: #f5f5f5;
            border-radius: 8px;
            padding: 16px;
            margin-top: 12px;
          `;

            // Mining title
            const miningTitle = document.createElement('h3');
            miningTitle.textContent = 'Support with Crypto Mining';
            miningTitle.style.cssText = `
            margin: 0 0 8px;
            font-size: 16px;
            color: #333;
          `;

            // Mining description
            const miningDesc = document.createElement('p');
            miningDesc.textContent = 'Donate some of your computing power while browsing to help keep us running.';
            miningDesc.style.cssText = `
            margin: 0 0 12px;
            font-size: 14px;
            color: #555;
          `;

            // Mining toggle
            const miningToggleContainer = document.createElement('div');
            miningToggleContainer.style.cssText = `
            display: flex;
            align-items: center;
            margin-bottom: 10px;
          `;

            const toggleLabel = document.createElement('label');
            toggleLabel.style.cssText = `
            position: relative;
            display: inline-block;
            width: 50px;
            height: 28px;
            margin-right: 10px;
          `;

            miningToggle = document.createElement('input');
            miningToggle.type = 'checkbox';
            miningToggle.style.cssText = `
            opacity: 0;
            width: 0;
            height: 0;
          `;

            const toggleSlider = document.createElement('span');
            toggleSlider.style.cssText = `
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            transition: .4s;
            border-radius: 28px;
          `;
            toggleSlider.innerHTML = `
            <span style="
              position: absolute;
              content: '';
              height: 20px;
              width: 20px;
              left: 4px;
              bottom: 4px;
              background-color: white;
              transition: .4s;
              border-radius: 50%;
              transform: ${miningToggle.checked ? 'translateX(22px)' : 'translateX(0)'};
            "></span>
          `;

            const toggleText = document.createElement('span');
            toggleText.textContent = 'Enable Mining Support' + (!window.ccPorted.adBlockEnabled ? "" : " (Please disable adblocker)");
            toggleText.style.cssText = `
            font-size: 14px;
            color: #333;
          `;

            // Mining stats section (simplified without throttle control)
            const miningStats = document.createElement('div');
            miningStats.id = 'mining-stats';
            miningStats.style.cssText = `
            font-size: 12px;
            color: #666;
            margin-top: 8px;
            display: none;
          `;
            miningStats.innerHTML = `
            <p style="margin: 4px 0;">Hashes per second: <span id="hashrate">0</span></p>
            <p style="margin: 4px 0;">Total hashes: <span id="total-hashes">0</span></p>
            <p style="margin: 4px 0;">To disable, paste <code>localStorage.setItem("mining-consent","false")</code> into the console. Or clear your cookies.</p>
          `;

            // Assemble mining option
            toggleLabel.appendChild(miningToggle);
            toggleLabel.appendChild(toggleSlider);
            miningToggleContainer.appendChild(toggleLabel);
            miningToggleContainer.appendChild(toggleText);

            miningContainer.appendChild(miningTitle);
            miningContainer.appendChild(miningDesc);
            miningContainer.appendChild(miningToggleContainer);
            miningContainer.appendChild(miningStats);

            supportOptions.appendChild(donateButton);
            supportOptions.appendChild(miningContainer);
        } else {
            supportOptions.appendChild(donateButton);
        }

        // Maybe later button
        const maybeLaterButton = document.createElement('button');
        maybeLaterButton.textContent = 'Maybe later';
        maybeLaterButton.style.cssText = `
          background: none;
          border: none;
          color: #666;
          font-size: 14px;
          margin: 16px auto 0;
          display: block;
          cursor: pointer;
          text-decoration: underline;
        `;

        // Assemble modal
        modalContent.appendChild(closeButton);
        modalContent.appendChild(title);
        modalContent.appendChild(progressText);
        // modalContent.appendChild(ctaText);
        modalContent.appendChild(progressContainer);
        modalContent.appendChild(supportOptions);
        modalContent.appendChild(maybeLaterButton);
        modalOverlay.appendChild(modalContent);

        // Add to document
        document.body.appendChild(modalOverlay);



        // Animate in
        setTimeout(() => {
            modalOverlay.style.opacity = '1';
            modalContent.style.transform = 'translateY(0)';
        }, 10);

        // Close modal function
        const closeModal = () => {
            modalOverlay.style.opacity = '0';
            modalContent.style.transform = 'translateY(20px)';
            setTimeout(() => {
                document.body.removeChild(modalOverlay);
            }, 300);

            // Set flag in localStorage if showOnce is true
            if (config.showOnce) {
                localStorage.setItem('kofiModalSeen', 'true');
            }
        };

        // Event listeners
        closeButton.addEventListener('click', closeModal);
        maybeLaterButton.addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });

        // Mining toggle event listener (if mining toggle exists and mining is not already active)
        if (config.miningEnabled && miningToggle && !window.mining) {
            miningToggle.addEventListener('change', function () {
                if (this.checked) {
                    // Show mining stats
                    const miningStats = document.getElementById('mining-stats');
                    if (miningStats) {
                        miningStats.style.display = 'block';
                    }

                    // Load mining script
                    if (!window.miningScriptLoaded) {
                        const script = document.createElement('script');
                        script.src = '/assets/scripts/m.js'; // Path to your mining script
                        script.onload = function () {
                            if (window.startMining) {
                                window.startMining();
                            }
                        };
                        document.body.appendChild(script);
                        window.miningScriptLoaded = true;
                    } else if (window.startMining) {
                        window.startMining();
                    }

                    // Store mining consent
                    localStorage.setItem('mining-consent', 'true');
                    let expiry = new Date();
                    expiry.setDate(expiry.getDate() + 30); // 30 days consent
                    localStorage.setItem('mining-consent-expiry', expiry.toISOString());

                    // Update toggle slider visually
                    const toggleSlider = this.parentNode.querySelector('span');
                    if (toggleSlider) {
                        toggleSlider.querySelector('span').style.transform = 'translateX(22px)';
                        toggleSlider.style.backgroundColor = '#2196F3';
                    }
                } else {
                    // Hide mining stats
                    const miningStats = document.getElementById('mining-stats');
                    if (miningStats) {
                        miningStats.style.display = 'none';
                    }

                    // Stop mining
                    if (window.stopMining) {
                        window.stopMining();
                    }

                    // Clear mining consent
                    localStorage.removeItem('mining-consent');
                    localStorage.removeItem('mining-consent-expiry');

                    // Update toggle slider visually
                    const toggleSlider = this.parentNode.querySelector('span');
                    if (toggleSlider) {
                        toggleSlider.querySelector('span').style.transform = 'translateX(0)';
                        toggleSlider.style.backgroundColor = '#ccc';
                    }
                }
            });
            const miningConsent = localStorage.getItem('mining-consent');
            const miningExpiryStr = localStorage.getItem('mining-consent-expiry');
            // Check for existing mining consent
            if (miningConsent === 'true' && miningExpiryStr) {
                const miningExpiry = new Date(miningExpiryStr);
                if (miningExpiry > new Date()) {
                    // Valid consent exists, check the toggle
                    miningToggle.checked = true;

                    // Update toggle slider visually
                    const toggleSlider = miningToggle.parentNode.querySelector('span');
                    if (toggleSlider) {
                        toggleSlider.querySelector('span').style.transform = 'translateX(22px)';
                        toggleSlider.style.backgroundColor = '#2196F3';
                    }

                    // Show mining stats
                    const miningStats = document.getElementById('mining-stats');
                    if (miningStats) {
                        miningStats.style.display = 'block';
                    }
                }
            }
        }

        // Show some initial progress in the bar (optional, you can remove this or customize)
        setTimeout(() => {
            // You could replace this with actual progress data if you have it
            progressBar.style.width = '2.2%';
        }, 500);

        // Return an object with methods to control the modal
        return {
            close: closeModal,
            updateProgress: (percentComplete) => {
                progressBar.style.width = `${percentComplete}%`;
            },
            isMiningEnabled: () => {
                return window.mining || (config.miningEnabled && miningToggle && miningToggle.checked);
            }
        };
    }
    function formatTimeLeft(deadline) {
        const deadlineDate = new Date(deadline);
        const now = new Date();
        const timeLeft = deadlineDate - now;
        if (timeLeft <= 0) return '0 days left';
        const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        if (daysLeft < 1) {
            const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            if (hoursLeft < 1) {
                const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                if (minutesLeft < 1) {
                    return 'Less than a minute left';
                }
            }
            return `${hoursLeft} hours left`;
        }
        return `${daysLeft} days left`;
    }
    function createModal({ heading = "Modal Title", description = "This is a modal description.", cta = "Okay", closeFn = () => { } } = {}) {
        // Create overlay
        const modalOverlay = document.createElement('div');
        modalOverlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background-color: rgba(0, 0, 0, 0.6);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 10000;
          opacity: 0;
          transition: opacity 0.3s ease;
        `;

        // Create modal container
        const modalBox = document.createElement('div');
        modalBox.style.cssText = `
          background-color: #fff;
          border-radius: 10px;
          padding: 24px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 5px 25px rgba(0,0,0,0.2);
          position: relative;
          transform: translateY(20px);
          transition: transform 0.3s ease;
        `;

        // Close button
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '&times;';
        closeButton.style.cssText = `
          position: absolute;
          top: 10px;
          right: 15px;
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
        `;

        // Heading
        const title = document.createElement('h2');
        title.textContent = heading;
        title.style.cssText = `
          font-size: 22px;
          margin-bottom: 10px;
          color: #333;
        `;

        // Description
        const desc = document.createElement('p');
        desc.innerHTML = description;
        desc.style.cssText = `
          font-size: 16px;
          color: #555;
          margin-bottom: 20px;
        `;

        // CTA button
        const ctaButton = document.createElement('button');
        ctaButton.textContent = cta;
        ctaButton.style.cssText = `
          padding: 10px 20px;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
          display: block;
          margin: 0 auto;
        `;

        // Close modal function
        const closeModal = () => {
            modalOverlay.style.opacity = '0';
            modalBox.style.transform = 'translateY(20px)';
            closeFn();
            setTimeout(() => {
                document.body.removeChild(modalOverlay);
            }, 300);
        };

        // Event listeners
        closeButton.addEventListener('click', closeModal);
        ctaButton.addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });

        // Assemble modal
        modalBox.appendChild(closeButton);
        modalBox.appendChild(title);
        modalBox.appendChild(desc);
        modalBox.appendChild(ctaButton);
        modalOverlay.appendChild(modalBox);
        document.body.appendChild(modalOverlay);

        // Animate in
        setTimeout(() => {
            modalOverlay.style.opacity = '1';
            modalBox.style.transform = 'translateY(0)';
        }, 10);

        return { close: closeModal };
    }
    function rerenderAds() {
        // shuffle ads
        const ads = document.querySelectorAll('.inxxx');
        // remove all ads
        ads.forEach(ad => ad.remove());
        // load them again, in different order
        for (let i = 0; i < ads.length; i++) {
            const ad = ads[i];
            const randomCard = document.querySelector('.cards').children[Math.floor(Math.random() * document.querySelector('.cards').children.length)];
            document.querySelector('.cards').insertBefore(ad, randomCard);
        }


    }
    toggleBtn.addEventListener('click', () => {
        const currentLayout = toggleBtn.getAttribute('data-current');
        const newLayout = currentLayout === 'grid' ? 'rows' : 'grid';
        toggleBtn.setAttribute('data-current', newLayout);
        const cards = document.querySelector(".cards");
        cards.classList.toggle('rows', newLayout === 'rows');
        cards.classList.toggle('grid', newLayout === 'grid');
        rerenderCards(newLayout);
    });
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

