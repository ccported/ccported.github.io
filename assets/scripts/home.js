try{const client = window.ccSupaClient;
const feilds = [".card-content .card-title", ".card-content .card-description", ".card-content .card-tags .tag"];
const failedInputCheckLag = 750;
const cards = document.querySelectorAll('.card');
const cardsList = Array.from(cards);
const cardsContainer = document.querySelector(".cards");
const searchButtonEnable = document.querySelector(".search-enable-button");
const sParent = document.querySelector(".s-parent");
const searchInput = document.getElementById("searchBox");
const allTags = document.querySelectorAll(".tag");
const sortButton = document.getElementById("sort");
const addGameRequestButton = document.getElementById("addGameRequestButton");
const sortDirectionText = document.getElementById("order");
const header = document.querySelector('header');
const scrollThreshold = 0;
const sortStates = [
    [sortCardsByClicks, "Hot"],
    [() => {
        sortCardsAlphabetically(1);
    }, "A-Z"],
    [() => {
        sortCardsAlphabetically(-1);
    }, "Z-A"]
]

let lastInputTime = Date.now();
let query = new URLSearchParams(window.location.search);
let cachedRomsJSON = null;
let cachedHotOrder = [];
let sortState = 0;

searchInput.value = "";
window.gameRQPopupOpen = false;
document.querySelector(".cards").classList.add("loading");

if (query.has("q")) {
    log(`Search query exists: <${query.get('q')}>`)
    searchInput.value = query.get("q");
    openSearch();
    input();
}
cards.forEach((card, i) => {
    if (document.querySelector(".cards") == card.parentElement) {
        card.classList.add("loading");
    }
    const id = card.getAttribute('id');
    // get links
    const links = card.querySelectorAll('.card-content .card-links a');
    card.style.cursor = "pointer";
    card.addEventListener('click', (e) => {
        if (e.target.tagName == "SPAN" || e.target.tagName == "A") {
            // not the card, but an item for which something happens on the card
            if (e.target.tagName == "A") {
                e.preventDefault();
                // if it's a link, open it
                incrementClicks(id);
                window.open(e.target.href, '_blank');
            }
            return;
        }
        incrementClicks(id);
        window.open(links[0].href, '_blank');
    });
    checkSeenGame(id, card);
    markGameSeen(id);
});
allTags.forEach(tag => {
    tag.addEventListener("click", () => {
        searchInput.value = tag.innerText;
        input()
    })
});
assignClickToCards().then(() => {
    log(`Clicks assigned to cards`)
    setSort(0);
    document.querySelector(".cards").classList.remove("loading");
    cards.forEach(card => {
        card.classList.remove("loading");
    });
});
shortcut([17, 81], () => {
    log("Shortcut CTRL + M pressed");
    createPopup({
        message: "Hello, Antonio",
        cta: false
    })
});


async function incrementClicks(gameID) {
    log(`Incrementing clicks for game ${gameID}`);
    let { data: game_clicks, error } = await client
        .from('game_clicks')
        .select('clicks')
        .eq('gameID', gameID);

    if (error) {
        console.error('Error getting game clicks:', error.message);
        return;
    }
    const clicks = (game_clicks[0] || { clicks: 0 }).clicks + 1;
    // upsert
    let { data, error: upsertError } = await client
        .from('game_clicks')
        .upsert([{ gameID, clicks }]);
}
async function getGameClicks(gameID) {
    log(`Getting clicks for game ${gameID}`);
    let { data: game_clicks, error } = await client
        .from('game_clicks')
        .select('clicks')
        .eq('gameID', gameID);

    if (error) {
        console.error('Error getting game clicks:', error.message);
        return;
    }
    return (game_clicks[0] || { clicks: 0 }).clicks;
}
async function getAllClicks() {
    log(`Getting all game clicks`);
    let { data: game_clicks, error } = await client
        .from('game_clicks')
        .select('gameID, clicks');

    if (error) {
        console.error('Error getting game clicks:', error.message);
        return;
    }
    let obj = {};
    game_clicks.forEach(game => {
        obj[game.gameID] = game.clicks;
    });
    return obj;
}
async function assignClickToCards() {
    log(`Assigning clicks to cards`);
    let clicks = await getAllClicks();
    cards.forEach(async (card) => {
        const id = card.getAttribute('id');
        card.setAttribute('data-clicks', clicks[id] || 0);
    });
}
async function sortCardsByClicks() {
    log(`Sorting cards by clicks`);
    let cardsArray = Array.from(cards);
    cardsArray.sort((a, b) => {
        return parseInt(b.getAttribute('data-clicks')) - parseInt(a.getAttribute('data-clicks'));
    });
    let cardsContainer = document.querySelector(".cards");
    cardsContainer.innerHTML = "";
    cardsArray.forEach(card => {
        cardsContainer.appendChild(card);
    });
}
async function input() {
    log(`Searching for ${searchInput.value}`);
    // update query parameters
    var url = new URL(window.location.href);
    url.searchParams.set("q", searchInput.value);
    window.history.pushState({}, '', url);
    // if the input has content, add a little "x" button to clear the input

    // add click event to clear the input
    var matching = cardsList.map((card) => {
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
    cardsContainer.innerHTML = "";
    matching = matching.filter((card) => {
        if (card[0] == 0) return false;
        cardsContainer.appendChild(card[1]);
        return true;
    });
    lastInputTime = Date.now();
    if (matching.length == 0) {
        var results = await testRomSearch(searchInput.value);
        if (results.length > 0) {
            var h3 = document.createElement("h3");
            h3.innerHTML = `Rom Results`
            var fullLibrary = document.createElement("p");
            fullLibrary.innerHTML = "<i style = 'font-weight:normal'>View the <a href = 'https://ccported.github.io/roms'>full library</a></i>";

            var div = document.createElement("div");
            div.appendChild(h3)
            div.appendChild(fullLibrary);
            for (const result of results) {
                var p = document.createElement("p");
                var [url, name, platform] = result;
                p.innerHTML = `<a href = https://ccported.github.io/roms/roms/${platform}/${url}>${name}</a>`;
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
        document.getElementById("check-roms").innerHTML = "";
    }
}
async function testRomSearch(query) {
    log(`Searching for roms with ${query}`);
    let response;
    let json;
    if (!cachedRomsJSON) {

        response = await fetch("https://ccported.github.io/roms/roms.json");
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
        const { data, error } = await client
            .from('CCPorted Game RQs')
            .insert([
                { game_name: game_name }
            ]);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error adding game request:', error.message);
        throw error;
    }
};
function openSearch(){
    log("Search box opened");
    searchInput.type = "text";
    searchButtonEnable.innerHTML = `<i class="fas fa-search"></i>`
}
function closeSearch(){
    log("Search box closed");
    searchInput.type = "hidden";
    searchButtonEnable.innerHTML = `<i class="fas fa-search"></i> Search`;

}
function markGameSeen(id) {
    log("Marking game as seen", id);
    localStorage.setItem(`seen-${id}`, "yes");
}
function checkSeenGame(id, card) {
    log(`Checking if game ${id} has been seen`);
    if (localStorage.getItem(`seen-${id}`) !== "yes") {
        card.querySelector(".card-content .card-title").textContent += " (New)";
        card.classList.add("new");
    }
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
function sortCardsAlphabetically(direction) {
    log(`Sorting cards alphabetically`);
    let cardsArray = Array.from(cards);
    cardsArray.sort((a, b) => {
        let aText = a.querySelector(".card-content .card-title").innerText;
        let bText = b.querySelector(".card-content .card-title").innerText;
        return compareAlpha(aText, bText) * direction;
    });
    let cardsContainer = document.querySelector(".cards");
    cardsContainer.innerHTML = "";
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
    sortDirectionText.innerHTML = sortStates[sortState][1];
}
function createPopup(popupData) {
    log(`Creating popup with message ${popupData.message}`);
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
    linkRow.style.justifyContent = 'space-between';
    if (popupData.cta) {
        linkRow.appendChild(link);
    }
    linkRow.appendChild(closeButton);

    popup.appendChild(message);
    popup.appendChild(linkRow);

    document.body.appendChild(popup);
}

document.addEventListener("keydown", (e) => {
    if (e.key == "Escape" && window.gameRQPopupOpen) {
        closePopup();
    }
    if (e.key == "Enter" && window.gameRQPopupOpen) {
        document.getElementById("sendGameRequestButton").click();
    }
});
addGameRequestButton.addEventListener("click", () => {
    createAddGamePopup();
    const sendButton = document.getElementById("sendGameRequestButton");
    const nvmdButton = document.getElementById("nvmd");
    const popup = document.querySelector(".popup");

    popup.addEventListener("click", (e) => {
        if (e.target == popup) {
            closePopup();
        }
    });
    nvmdButton.addEventListener("click", () => {
        closePopup();
    });
    sendButton.addEventListener("click", () => {
        const input = document.getElementById("gameRequestInput");
        addGameRequest(input.value);
        closePopup();
    });

})
sortButton.addEventListener("click", () => {
    searchInput.value = "";
    input();
    sortState++;
    if (sortState >= sortStates.length) {
        sortState = 0;
    }
    setSort(sortState);
});
window.addEventListener('scroll', () => {
    if (window.scrollY > scrollThreshold) {
        header.classList.add('shadow');
    } else {
        header.classList.remove('shadow');
    }
});
searchButtonEnable.addEventListener("click",(e)=>{
    openSearch();
});
searchInput.addEventListener("click", (e) => {

    // only clear if the click is on the "x" button
    var rect = searchInput.getBoundingClientRect();
    var x = rect.right - 10 - 15; // 10 is padding, 15 is the width of the "x" button
    if (e.clientX > x) {
        searchInput.value = "";
        setSort(sortState)
        searchButtonEnable.innerHTML = `<i class="fas fa-search"></i> Search`;
        searchInput.type = "hidden";
    }
 
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
}catch(err){
    log(err)
}
// function buildCards(games) {
//     /**
//      *        {
//             "name": "cookie_clicker",
//             "fName": "Cookie Clicker",
//             "description": "Addictive idle game where you bake cookies by clicking and upgrading your production",
//             "image": "/assets/images/cookie_clicker.jpg",
//             "online": true,
//             "links": [
//                 {
//                     "name": "CCPorted",
//                     "link": "https://ccported.github.io/cc"
//                 }
//             ],
//             "tags": [
//                 "idle",
//                 "clicker",
//                 "strategy"
//             ]
//         }

//         <div class="card" id="cookie_clicker">
//                     <div class="card-bg" style="background-image: url('assets/images/cookie_clicker.jpg');"></div>
//                     <div class="card-content">
//                         <div>
//                             <h2 class="card-title">Cookie Clicker</h2>
//                             <p class="card-description">Addictive idle game where you bake cookies by clicking and
//                                 upgrading
//                                 your production.</p>
//                             <div class="card-tags">
//                                 <span class="tag" data-tag="idle">Idle</span>
//                                 <span class="tag" data-tag="clicker">clicker</span>
//                             </div>
//                         </div>
//                         <div class="card-links">
//                             <a href="https://ccported.github.io/cc">Play Cookie Clicker on CCPorted</a>
//                         </div>
//                     </div>
//                 </div>
//      */
//     for(const games of games){
//         const card = document.createElement("div");
//         card.classList.add("card");
//         card.id = games.name;
//         card.innerHTML = `
//             <div class="card-bg" style="background-image: url('${games.image}');"></div>
//             <div class="card-content">
//                 <div>
//                     <h2 class="card-title">${games.fName}</h2>
//                     <p class="card-description">${games.description}</p>
//                     <div class="card-tags">
//                         ${games.tags.map(tag => `<span class="tag" data-tag="${tag}">${tag}</span>`).join("")}
//                     </div>
//                 </div>
//                 <div class="card-links">
//                     ${games.links.map(link => `<a href="${link.link}">Play ${games.fName} on ${link.name}</a>`).join("")}
//                 </div>
//             </div>
//         `;
//         document.querySelector(".cards").appendChild(card);


// }