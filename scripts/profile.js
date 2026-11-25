const profilePicture = document.getElementById('profilePicture');
const displayName = document.getElementById('displayName');
const saveButton = document.getElementById('saveChanges');
const achievementsContainer = document.getElementById('achievementsContainer');
const profilePictureInput = document.getElementById("profile-picture-upload");


document.addEventListener('DOMContentLoaded', () => {
    setProfilePictureLoading();
    // Initialize
    loadUserData();
});

// Load user data
async function loadUserData() {
    try {
        const user = await window.ccPorted.getUser();
        console.log("U2",user);
        if (!user) {
            window.location.href = '/login/';
            return;
        };
        displayName.value = user.attributes["preferred_username"] || user["cognito:username"] || "Anonymous";
        if (user.attributes.picture) {
            profilePicture.src = user.attributes.picture;
        } else {
            profilePicture.src = "/assets/images/profile_pic.png";
        }
        const trackingData = user.attributes["custom:tracking_data"];
        try {
            renderStats(trackingData);
        } catch (err) {
            alert("Something went wrong.");
            log(err);
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}
function renderStats(trackingData) {
    log("TRACKING DATA:", trackingData);
    if (!trackingData) return;
    trackingData = JSON.parse(trackingData);
    const statsC = document.querySelector(".stats-container");
    const totalGameTime = trackingData.total_playtime || 0;
    const gamesPlayed = Object.keys(trackingData.games || {});
    const gamesFormatted = gamesPlayed.map(async game => {
        const name = await deIDIfy(game);
        const timePlayed = trackingData.games[game];
        const stat = document.createElement("div");
        stat.classList.add("stat");
        const sname = document.createElement("div");
        sname.classList.add("stat-name");
        sname.innerHTML = name;
        const svalue = document.createElement("div");
        svalue.classList.add("stat-value");
        svalue.innerHTML = formatMinutes(timePlayed.playtime);
        stat.appendChild(sname);
        stat.appendChild(svalue);
        statsC.appendChild(stat);
        return [name, timePlayed];
    });
    const stat = document.createElement("div");
    stat.classList.add("stat");
    const sname = document.createElement("div");
    sname.classList.add("stat-name");
    sname.innerHTML = "Total Playtime";
    const svalue = document.createElement("div");
    svalue.classList.add("stat-value");
    svalue.innerHTML = formatMinutes(trackingData.total_playtime);
    stat.appendChild(sname);
    stat.appendChild(svalue);
    statsC.appendChild(stat);
    return;
}
function formatMinutes(minutes) {
    const hours = Math.floor(minutes / 60);
    const minutesLeft = minutes % 60;
    const days = Math.floor(hours / 24);
    const hoursLeft = hours % 24;

    let string = "";
    if (days > 0) {
        string = `${Math.floor(days)}d ${Math.floor(hoursLeft)}h ${minutesLeft.toFixed(1)}m`;
    } else if (hours > 0) {
        string = `${Math.floor(hours)}h ${minutesLeft.toFixed(1)}m`
    } else {
        string = `${minutes.toFixed(1)}m`
    }
    return string;
}
function deIDIfy(id) {
    return id;
}
function capitalizeFirstLetter(val) {
    return val.charAt(0).toUpperCase() + val.slice(1);
}
// Set profile picture loading state
function setProfilePictureLoading() {
    profilePicture.src = '/assets/images/loading.gif';
}
// Handle profile picture upload
async function handleFileUpload(file) {
    log("CALLED UPLOAD FILE")
    if (!file || !file.type.startsWith('image/')) return;

    try {
        const user = await window.ccPorted.getUser();
        if (!user) return;

        const fileExt = file.name.split('.').pop();
        const fileName = `profile.${fileExt}`;
        const data = await window.ccPorted.uploadFile(file, fileName);
        log('Successfully uploaded file:', data);
        // update profile picture
        const publicUrl = data.Location;
        profilePicture.src = publicUrl;
        const attr = await window.ccPorted.updateUser({
            picture: publicUrl
        })
        profilePicture.src = publicUrl;
        log('Successfully updated user attributes:', attr);
    } catch (error) {
        console.error('Error setting profile picture file:', error);
        alert('Failed to update profile. Please try again.');
    }
}

// Save profile changes
async function saveChanges() {
    try {
        const dataToUpdate = {};
        if (displayName.value) {
            dataToUpdate["preferred_username"] = displayName.value;
        }
        await window.ccPorted.updateUser(dataToUpdate)
        alert('Changes saved successfully!');
    } catch (error) {
        console.error('Error saving changes:', error);
        alert('Failed to save changes. Please try again.');
    }
}


// Event Listeners
profilePictureInput.onchange = (e) => {
    setProfilePictureLoading();
    handleFileUpload(e.target.files[0])
};

// Drag and drop support
const pictureContainer = document.querySelector('.profile-picture-container');

pictureContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    pictureContainer.classList.add('drag-over');
});

pictureContainer.addEventListener('dragleave', () => {
    pictureContainer.classList.remove('drag-over');
});

pictureContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    pictureContainer.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    setProfilePictureLoading();
    handleFileUpload(file);
});

saveButton.addEventListener('click', saveChanges);
