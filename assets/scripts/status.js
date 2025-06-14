const client = window.ccSupaClient;
const gameRQs = document.querySelector(".gameRQs");
const gameStatuses = document.querySelector(".gameStatuses");
const updates = document.querySelector(".updates");
const gameTagMap = {
    "Game Request": handleGameRequest,
    "Game Status": handleGameStatus,
    "In progress": handleGameInProgress,
    "Update": handleUpdate
}
const statusColors = {
    "In Progress": ["#CCAC00", "#FFFFFF"],
    "Operational": ["#00CC00", "#FFFFFF"],
    "Not Started": ["#CC0000", "#FFFFFF"],
    "On Hold": ["#0000CC", "#FFFFFF"],
    "Buggy": ["#CC3700", "#FFFFFF"],
    "Cancelled": ["#000000", "#FFFFFF"]
}


const example =
    ["Mr. Mine", "Buggy", ["Game Request", "In Progress"]]
async function init() {
    const { data, error } = await client
        .from('cc_status')
        .select('*');
    log(data);
    if (error) console.error(error);
    data.forEach(piece => {
        const { name, status: xstatus, tags, description } = piece;
        const element = document.createElement("div");
        element.classList.add("gameStatusRow");
        const left = document.createElement("div");
        left.classList.add("left");
        left.innerHTML = name;
        const right = document.createElement("div");
        right.classList.add("right");
        right.appendChild(status(xstatus));
        const desc = document.createElement("div");
        desc.classList.add("desc");
        desc.innerHTML = description;
        element.appendChild(left);
        element.appendChild(desc);
        element.appendChild(right);
        tags.forEach(tag => {
            if (gameTagMap[tag]) {
                gameTagMap[tag](element, piece);
            }
        })
    })
}
function handleGameRequest(element, piece) {
    element.classList.add("gameRequest");
    gameRQs.appendChild(element);
}
function handleGameStatus(element, piece) {
    element.classList.add("gameStatus");
    gameStatuses.appendChild(element);
}
function handleGameInProgress(element, piece) {
    element.classList.add("gameInProgress");
    const status = element.querySelector(".right");
    status.appendChild(status("In Progress"));
    gameStatuses.appendChild(element);
}
function handleUpdate(element, piece) {
    element.classList.add("gameUpdate");
    updates.appendChild(element);
}
function status(s) {
    const status = document.createElement("div");
    status.classList.add("status");
    status.style.backgroundColor = statusColors[s][0];
    status.style.color = statusColors[s][1];
    status.innerHTML = s;
    return status;
}

init();