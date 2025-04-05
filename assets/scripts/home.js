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
            ProjectionExpression: 'gameID, clicks, description, fName, tags, thumbPath',
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
    async function adsEnabled() {
        let adBlockEnabled = false
        const googleAdUrl = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'
        try {
            await fetch(new Request(googleAdUrl)).catch(_ => adBlockEnabled = true)
        } catch (e) {
            adBlockEnabled = true
        } finally {
            if (!window.ccPorted.aHosts) {
                const res = await fetch("/ahosts.txt");
                const text = await res.text();
                const hosts = text.split('\n');
                window.ccPorted.aHosts = hosts.map(h => h.trim());
                if (window.ccPorted.aHosts.includes(window.location.hostname)) {
                    return !adBlockEnabled;
                } else {
                    return false;
                }
            } else {
                if (window.ccPorted.aHosts.includes(window.location.hostname)) {
                    return !adBlockEnabled;
                } else {
                    return false;
                }
            }
        }
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
        for(const server of servers){

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
                checkSeenGame(id, card);
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
                        }else{
                            log(`${host} failed (wrong res)`);
                        }
                    }else{
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
        window.ccPorted.adsEnabled = await adsEnabled();
        if (window.ccPorted.adsEnabled && window.innerWidth > 800) {
            // add margin for the ads
            document.querySelector(".cards").style.marginRight = "300px";
            document.querySelector(".search").style.marginRight = "300px";
        }
        if (!window.ccPorted.adsEnabled) {
            hideAds();
        }
        const [chosenServer, index, path] = await testOpenServers();
        window.ccPorted.gameServer = {};
        window.ccPorted.gameServer.server = chosenServer;
        window.ccPorted.gameServer.index = index;
        window.ccPorted.gameServer.path = path
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
            checkSeenGame(id, card);
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
        rerenderAds();
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

