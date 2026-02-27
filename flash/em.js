var thisScript = document.currentScript;
var file = thisScript.getAttribute("data-swf-file-src");

document.getElementById("gameFName").innerHTML = thisScript.getAttribute("data-fName")
window.RufflePlayer = window.RufflePlayer || {};
window.RufflePlayer.config = {
    "autoplay": "off",
    "contextMenu": "off",
    "splashScreen": false,
    "openUrlMode": "confirm",
    "favorFlash": true,
    "playerRuntime": "flashPlayer",
    "allowFullscreen": true
};
window.PlayerObject = {};
window.addEventListener("load", (event) => {
    const ruffle = window.RufflePlayer.newest();
    const player = ruffle.createPlayer();
    player.style.width = "800px";
    player.style.height = "600px"
    const container = document.getElementById("gameContainer");
    container.appendChild(player);
    window.PlayerObject = player;
    player.load(file);
});

var fullscreenButton = document.getElementById("fullscreen");

fullscreenButton.addEventListener("click",(event)=>{
    window.PlayerObject.enterFullscreen();
})