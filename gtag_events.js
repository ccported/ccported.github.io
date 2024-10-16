const script = document.currentScript;
var gameID = script.getAttribute("data-gameID");

function emit() {
    gtag("event", "play_game", {
        gameID,
        location: window.location.hostname
    });
}



const seenPopup = (localStorage.getItem("ccported-popup") == "yes");
function createPopup(text = "Check out more awesome games like Spelunky, Minecraft, Cookie Clicker, Drift Hunters, and Slope, all unblocked and free to play at ccported.github.io!") {
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
    localStorage.setItem("ccported-popup", "yes")
}

emit();
setInterval(emit, 1000 * 60 * 10);

// Show popup after 2 minutes (120000 milliseconds)
if (!seenPopup) {
    setTimeout(createPopup, 120000);
}


importJSON("/games.json").then(games => {
    var { games } = games;
    var unseengames = games.filter(game => !hasSeenGame(game.name));
    if (unseengames.length == 0) return;
    var string = "New games to play: ";
    unseengames.forEach((game, i) => {
        markGameSeen(game.name);
        string += ((i == games.length - 1) ? "and " : "") + game.fName + ((i != unseengames.length - 1) ? ", " : "");
    });
    createPopup(string);
    localStorage.setItem("ccported-popup", "yes")

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


function hasSeenGame(gameID) {
    return localStorage.getItem(`seen-${gameID}`) == "yes";
}
function markGameSeen(gameID) {
    localStorage.setItem(`seen-${gameID}`, "yes");
}