const unsupported = ["dos","dreamcast"];

// Utility function to capitalize words
const capitalizeWords = (str) => {
    return str.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
};

// Function to list ROMs
async function listRoms() {
    try {
        await window.ccPorted.userPromise;
        const bucketName = 'ccportedroms';
        const roms = {};

        // List all directories (consoles)
        const { CommonPrefixes } = await window.ccPorted.s3Client.listObjects({
            Bucket: bucketName,
            Delimiter: '/'
        }).promise();

        // Get ROMs for each console
        for (const prefix of CommonPrefixes) {
            const consoleType = prefix.Prefix.replace('/', '');
            const response = await window.ccPorted.s3Client.listObjects({
                Bucket: bucketName,
                Prefix: prefix.Prefix
            }).promise();

            roms[consoleType] = response.Contents
                .filter(item => item.Key !== prefix.Prefix)
                .map(item => {
                    const fileName = item.Key.split('/').pop();
                    return [
                        fileName,
                        capitalizeWords(fileName.split('.')[0])
                    ];
                });
        }

        displayRoms(roms);
        setupSearch();
    } catch (error) {
        console.error('Error loading ROMs:', error);
        document.querySelector('.container').innerHTML = `
             <div class="error">
                 Error loading ROMs. Please try again later.
                 <br>
                 ${error.message}
             </div>
         `;
    }
}

// Function to display ROMs
async function displayRoms(roms) {
    await window.ccPorted.userPromise;
    const container = document.querySelector('.container');
    container.innerHTML = Object.entries(roms)
        .map(([console, romList]) => `
             <div class="determiner">
                 <h2 id="${console}">${console.toUpperCase()} ${(console !== "dos") ? "ROMs" : "Files"}</h2>
                 <ul>
                     ${romList.map(([filename, title]) => `
                         <li>
                             <div class="name">${title}</div>
                             <div class="links">
                                 <a href="https://ccportedroms.s3-us-west-2.amazonaws.com/${console}/${filename}" target="_blank">Download</a>
                                 ${(!unsupported.includes(console)) ? `<a href="/emulator/?core=${console}&rom=${filename}" target="_blank">Play</a>` : ''}
                             </div>
                         </li>
                     `).join('')}
                 </ul>
             </div>
         `).join('');
}

// Setup search functionality
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const romItems = document.querySelectorAll('li');

    searchInput.addEventListener('input', function (e) {
        const searchTerm = normalize(e.target.value.toLowerCase());

        romItems.forEach(item => {
            const romName = normalize(item.querySelector('.name').textContent.toLowerCase());
            if (romName.includes(searchTerm)) {
                item.classList.remove('hidden');
            } else {
                item.classList.add('hidden');
            }
        });

        // Show/hide category titles based on visible ROMs
        document.querySelectorAll('.determiner').forEach(section => {
            const visibleRoms = section.querySelectorAll('li:not(.hidden)').length;
            section.style.display = visibleRoms > 0 ? '' : 'none';
        });
    });
}

function normalize(string) {
    string = string.toLowerCase();
    string = string.replace(/[^a-z0-9]/g, "");
    string = string.replace(/\s/g, "");
    return string;
}

listRoms().then(() => {
    console.log("ROMS loaded");
    setupSearch()
})