var runAfterLoadList = [];
// runAfterLoad() takes a function and adds it to the runAfterLoadList.
function runAfterLoad(func) {
    runAfterLoadList.push(func);

}
// If the localStorage key "enabledMods" exists, load it as an array.
// If it doesn't exist, create an empty array.
enabledMods = localStorage.getItem("enabledMods") ? JSON.parse(localStorage.getItem("enabledMods")) : [];
// Run all scripts in the enabledMods array, if it fails print to console
for (var i = 0; i < enabledMods.length; i++) {
    try {
        var scriptx = document.createElement('script');

        scriptx.src = src;
        document.head.appendChild(scriptx);
    } catch (e) {
        console.log("Error in mod: " + enabledMods[i]);
        console.log(e);
    }
}