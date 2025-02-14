document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const profilePicture = document.getElementById('profilePicture');
    const displayName = document.getElementById('displayName');
    const currentPassword = document.getElementById('currentPassword');
    const newPassword = document.getElementById('newPassword');
    const saveButton = document.getElementById('saveChanges');
    const achievementsContainer = document.getElementById('achievementsContainer');
    const profilePictureInput = document.getElementById("profile-picture-upload");

    setProfilePictureLoading();

    // Load user data
    async function loadUserData() {
        try {
            const { data: { user } } = await window.ccSupaClient.auth.getUser();
            if (!user) {
                window.location.href = '/login/';
                return;
            };

            const { data: profile } = await window.ccSupaClient
                .from('u_profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profile) {
                displayName.value = user.user_metadata.display_name || '';
                if (profile.avatar_url) {
                    profilePicture.src = profile.avatar_url;
                }else{
                    profilePicture.src = "/assets/images/profile_pic.png";
                }
                var newAchievements = await checkForNewAchievements(profile);
                let { data: achievements, error } = await window.ccSupaClient
                    .from('achievements')
                    .select('*')
                    .in('id', profile.achievements);
                if (error) throw error;
                renderAchievements([...achievements, ...newAchievements]);
                // add new achievements to profile
                if (newAchievements.length > 0) {
                    const newAchievementIds = newAchievements.map(achievement => achievement.id);
                    await window.ccSupaClient
                        .from('u_profiles')
                        .update({ achievements: [...profile.achievements, ...newAchievementIds] })
                        .eq('id', user.id);
                }
                const trackingData = profile.tracking_data;
                try{
                renderStats(trackingData);
                }catch(err){
                    alert("Something went wrong.");
                    log(err);
                }
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }
    function renderStats(trackingData){
        const statsC = document.querySelector(".stats-container");
        const totalGameTime = trackingData.total_playtime || 0;
        const gamesPlayed = Object.keys(trackingData.games || {});
        const gamesFormatted = gamesPlayed.map(game=>{
            const name = deIDIfy(game);
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
    function formatMinutes(minutes){
        const hours = Math.floor(minutes / 60);
        const minutesLeft = minutes % 60;
        const days = Math.floor(hours / 24);
        const hoursLeft = hours % 24;

        let string = "";
        if(days > 0){
            string = `${Math.floor(days)}d ${Math.floor(hoursLeft)}h ${minutesLeft.toFixed(1)}m`;
        }else if(hours > 0){
            string = `${Math.floor(hours)}h ${minutesLeft.toFixed(1)}m`
        }else{
            string = `${minutes.toFixed(1)}m`
        }
        return string;
    }
    function deIDIfy(id){
        let string = "";
        const parts = id.split("_");
        parts.forEach((word,i)=>{
            word = word.split("-").join(".");
            string += capitalizeFirstLetter(word) + " ";
        });
        return string;
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
        if (!file || !file.type.startsWith('image/')) return;

        try {
            const { data: { user } } = await window.ccSupaClient.auth.getUser();
            if (!user) return;

            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${Date.now()}.${fileExt}`;
            const { error: uploadError } = await window.ccSupaClient.storage
                .from('avatars')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = window.ccSupaClient.storage
                .from('avatars')
                .getPublicUrl(fileName);

            profilePicture.src = publicUrl;

            await window.ccSupaClient
                .from('u_profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id);

        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Failed to upload image. Please try again.');
        }
    }
    // Check for new achievements
    async function checkForNewAchievements(profile) {
        // get all non-achieved achievements
        let { data: achievements, error } = await window.ccSupaClient
            .from('achievements')
            .select('*')
            .not('id', 'in', `(${profile.achievements.join(",")})`);
        if (error) throw error;
        const achieved = [];
        for (const achievement of achievements) {

            const isAchieved = await checkAchievement(achievement, profile);
            console.log(`Checking achievement ${achievement.name}: ${isAchieved}`);

            if (isAchieved) {
                achieved.push(achievement);
            }
        }
        return achieved;
    }
    // Utility function to create a sandboxed context
    function createSandbox(allowedFunctions) {
        // Create a proxy to restrict access to only allowed functions
        return new Proxy({}, {
            get: (target, prop) => {
                if (prop in allowedFunctions) {
                    return allowedFunctions[prop];
                }
                throw new Error(`Access to '${prop}' is not allowed in achievement criteria`);
            }
        });
    }

    // Achievement checker function
    async function checkAchievement(achievement, profile) {
        const { criteria } = achievement;
        const { tracking_data: trackingData } = profile;
        // Create a sandbox with only allowed functions
        const sandbox = createSandbox({
            getEveryGame,
            getCurrentTimestamp: () => Date.now(),
            calculateTotal: (arr) => arr.reduce((sum, val) => sum + val, 0)
        });

        try {
            // Wrap the criteria in a proper function scope
            const criteriaFunction = new Function(
                'tracking_data',
                'sandbox',
                `"use strict";
            return (${criteria})(tracking_data, sandbox);`
            );
            // Execute the criteria function with sandbox
            const will = criteriaFunction(trackingData, sandbox);
            if (will instanceof Promise) {
                return await will;
            } else {
                return will;
            }
        } catch (error) {
            console.error('Error executing achievement criteria:', error);
            return false;
        }
    }
    async function getEveryGame() {
        const gamesJSON = await importJSON('/games.json');
        return gamesJSON.games.map(game => game.name);
    }
    // Save profile changes
    async function saveChanges() {
        try {
            const { data: { user } } = await window.ccSupaClient.auth.getUser();
            if (!user) return;
            const dataToUpdate = {};
            if (displayName.value) {
                dataToUpdate.data.display_name = displayName.value;
                // await window.ccSupaClient
                //     .from('u_profiles')
                //     .update({ display_name: displayName.value })
                //     .eq('id', user.id);
            }
            if (currentPassword.value && newPassword.value) {
                dataToUpdate.password = newPassword.value;
                // const { error } = await window.ccSupaClient.auth.updateUser({
                //     password: newPassword.value
                // });

                // if (error) throw error;

                currentPassword.value = '';
                newPassword.value = '';
            }
            await window.ccSupaClient.auth.updateUser(dataToUpdate);
            alert('Changes saved successfully!');
        } catch (error) {
            console.error('Error saving changes:', error);
            alert('Failed to save changes. Please try again.');
        }
    }

    // Render achievements
    function renderAchievements(achievements) {
        achievementsContainer.innerHTML = achievements.map(achievement => `
            <div class="achievement-card" style="border-color: ${achievement.color}">
                <div class="achievement-icon" style="background-color: ${achievement.color}">
                    ${achievement.icon}
                </div>
                <div class="achievement-info">
                    <h3>${achievement.name}</h3>
                    <p>${achievement.description}</p>
                </div>
            </div>
        `).join('');
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

    // Initialize
    loadUserData();
});