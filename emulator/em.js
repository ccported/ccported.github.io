async function init() {
    try {
        const dataLibraryBaseUrl = await findDataCDN();


        const search = new URLSearchParams(window.location.search);
        if (search.has("core") && search.has("rom")) {
            const core = search.get("core");
            const rom = search.get("rom");
            let url;
            if (rom.startsWith("http") || rom.startsWith("//")) {
                url = rom;
            } else {
                url = `https://ccportedroms.s3-us-west-2.amazonaws.com/${core}/${rom}`;
            }
            window.EJS_player = "#game";
            window.EJS_core = core;
            window.EJS_pathtodata = `${dataLibraryBaseUrl}/data/`;
            window.EJS_gameUrl = url;
            // window.EJS_startOnLoaded = true;
            const script = document.createElement("script");
            script.src = `${dataLibraryBaseUrl}/data/loader.js`;
            document.body.appendChild(script);
            document.querySelector(".select-game-popup").style.display = "none";
            document.querySelector("#game").style.display = "block";
        } else {
            document.querySelector(".select-game-popup").style.display = "flex";
            document.querySelector("#game").style.display = "none";
            await createSelect();
        }
    } catch (err) {
        alert(err);
    }
}
async function findDataCDN() {
    var cdns = ["https://ccported.github.io/emdata", "https://emdata.onrender.com", "https://sojs-coder.github.io/emdata", "https://d0136284.ccportedemdata.pages.dev", "https://main.dtbdx4d2gvp5v.amplifyapp.com/"];
    for (var i = 0; i < cdns.length; i++) {
        try {
            const response = await fetch(cdns[i] + '/blocked_res.txt', {
                method: 'GET',
                cors: "no-cors"
            });
            const text = await response.text();
            if(text.indexOf("===NOT_BLOCKED===") !== -1){
                return cdns[i];
            }else{
                continue;
            }
        } catch (err) {
            console.log(err);
            // ^ super soft error handling
        }
    }
    alert("All data delivery networks seem to be blocked. This will not work. If you think this is an error contact me though the instagram, discord, or email me at sojscoder@gmail.com");
}

function formatCategoryName(category) {
    // Convert category names to more readable format
    const names = {
        'nes': 'Nintendo NES',
        'snes': 'Super Nintendo',
        'n64': 'Nintendo 64',
        'gba': 'Game Boy Advance',
        'nds': 'Nintendo DS',
        'gb': 'Game Boy',
        'gbc': 'Game Boy Color',
        'sega': 'Sega Genesis',
        'segaCD': 'Sega CD',
        'segaSaturn': 'Sega Saturn',
        'dreamcast': 'Dreamcast',
        'psx': 'PlayStation',
        'atari2600': 'Atari 2600',
        'arcade': 'Arcade',
        'vb': 'Virtual Boy',
        'dos': 'DOS',
    };
    return `${names[category]} (${category.toUpperCase()})` || category.toUpperCase();
}

async function createSelect() {
    const romsJSON = await importJSON("/roms/roms.json");
    const container = document.querySelector('.game-selector-container');
    const searchInput = container.querySelector('.search-input');
    const select = document.createElement("select");
    select.className = 'game-select';
    select.size = 10;

    const allOptions = [];
    const allGroups = {};

    // Create optgroups for each category
    Object.keys(romsJSON).forEach((category) => {
        if(category === "dos") return;
        const group = document.createElement('optgroup');
        group.label = formatCategoryName(category);
        allGroups[category] = group;
        select.appendChild(group);

        romsJSON[category].forEach((rom) => {
            const option = document.createElement("option");
            option.value = rom[0];
            option.setAttribute("data-core", category);
            option.innerText = rom[1];
            group.appendChild(option);
            allOptions.push({
                element: option,
                group: group,
                category: category
            });
        });
    });

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();

        // Reset all groups visibility
        Object.values(allGroups).forEach(group => {
            group.style.display = '';
        });

        // Track which groups have visible options
        const groupsWithVisibleOptions = new Set();

        allOptions.forEach(({ element, category }) => {
            const matches = element.innerText.toLowerCase().includes(searchTerm);
            element.style.display = matches ? '' : 'none';
            if (matches) {
                groupsWithVisibleOptions.add(category);
            }
        });

        // Hide empty groups
        Object.entries(allGroups).forEach(([category, group]) => {
            if (!groupsWithVisibleOptions.has(category)) {
                group.style.display = 'none';
            }
        });
    });

    const button = document.createElement("button");
    button.className = 'start-button';
    button.innerText = "Start Game";
    button.onclick = () => {
        const selectedOption = select.options[select.selectedIndex];
        if (selectedOption) {
            const core = selectedOption.getAttribute("data-core");
            const rom = selectedOption.value;
            const url = `/emulator/?core=${core}&rom=${rom}`;
            window.location.href = url;
        }
    };

    container.appendChild(select);
    container.appendChild(button);

    // Initially disable button if no selection
    button.disabled = true;
    select.addEventListener('change', () => {
        button.disabled = !select.value;
    });
}

async function importJSON(path) {
    let url;
    if (path.startsWith("/") && !path.startsWith("//")) {
        url = new URL(path, window.location.origin);
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
    return res.json();
}

init();
