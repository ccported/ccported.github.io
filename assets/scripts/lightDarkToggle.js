const theme = localStorage.getItem("[ns_ccported]_theme") || "light";
const lightDarkToggle = document.querySelector(".cc.lightDarkToggle .cc.checkbox");
if(theme == "dark"){
    document.body.classList.add("dark");
    lightDarkToggle.checked = true;
}
checkbox.addEventListener("change", (e) => {
    document.body.classList.toggle("dark");
    localStorage.setItem("[ns_ccported]_theme", document.body.classList.contains("dark") ? "dark" : "light");
})