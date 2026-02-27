const game = document.getElementById("gameContainer");
const currentScript = document.currentScript;

const dosUrl = currentScript.getAttribute("data-dos-url");

const width = 640;
const height = 400;


game.width = width;
game.height = height;
window.commandInterface = null;

function loadDos() {
    const dos = Dos(game, {
        url: dosUrl,
        autoStart: true,
        kiosk: true,
        pathPrefix: '/emulator/dos/js-dos/',
        onEvent: (...args) => {
            console.log("onEvent", args);
            if (args[0] == "ci-ready") {
                console.log("ci-ready");
                window.commandInterface = args[1];
            }
        }
    });
    return dos;
}

function fullscreen() {
    if (game.requestFullscreen) {
        game.requestFullscreen();
    } else if (game.webkitRequestFullscreen) {
        game.webkitRequestFullscreen();
    } else if (game.mozRequestFullScreen) {
        game.mozRequestFullScreen();
    } else if (canvas.msRequestFullscreen) {
        game.msRequestFullscreen();
    }
}
function save(dos) {
    if(!window.ccPorted.user){
        simpleNotif("<a style='text-decoration:underline' href = '/login'>Log in</a> to save to cloud");
        dos.save();
    }else{
        dos.save().then(()=>{
            window.ccPorted.stateSync.syncUtil.forceSync("Saving to cloud...");
        });
    }
}
document.getElementById("fullscreen").onclick = fullscreen;

function init() {
    const dos = loadDos();
    document.getElementById("save").onclick = () => {
        save(dos);
    };
}

function simpleNotif(content) {
    var notification = document.createElement('div');
    notification.innerHTML = '';
    notification.style.position = 'fixed';
    notification.style.top = '10px';
    notification.style.right = '10px';
    notification.style.backgroundColor = 'rgba(114, 114, 114, 0.9)';
    notification.style.color = 'white';
    notification.style.padding = '10px';
    notification.style.borderRadius = '5px';
    notification.style.textAlign = 'center';
    notification.style.zIndex = '9999';
    notification.innerHTML = content;

    document.body.appendChild(notification);
    window.saveNotif = notification;
    setTimeout(() => {
        notification.remove();
    }, 3000);
    return notification;
}


init();