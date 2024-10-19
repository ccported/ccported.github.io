const SUPABASE_URL = 'https://dahljrdecyiwfjgklnvz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhaGxqcmRlY3lpd2ZqZ2tsbnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjgyNjE3NzMsImV4cCI6MjA0MzgzNzc3M30.8-YlXqSXsYoPTaDlHMpTdqLxfvm89-8zk2HG2MCABRI';
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const chatMessages = document.getElementById('chat-messages');
const logoutBtn = document.getElementById('logout-btn');
const sidebar = document.querySelector(".sidebar");

if (!/Mobi|Android/i.test(navigator.userAgent)) {
    sidebar.addEventListener("mouseover", (e) => {
        sidebar.classList.add("expanded");
    });
    sidebar.addEventListener("mouseout", (e) => {
        sidebar.classList.remove("expanded");
    });
}
const sArrow = document.querySelector(".sidebar .arrow");
sArrow.addEventListener("click", () => {
    sidebar.classList.toggle("expanded")
})
var query = new URLSearchParams(window.location.search);
var channel = (query.has("channel") ? query.get("channel") : "1b81d7ae-9035-4280-b667-ad9c8bad9311");
let currentUser;
let penaltyCount = 0;
let lastMessageTime = 0;
let currentChannel = channel;

async function init() {
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
        window.location.href = '/login';
        return;
    }
    currentUser = user;
    const { data: channel, cerror } = await client
        .rpc("get_channel_info", { channel_id: currentChannel });
    if (cerror) {
        console.error('Error getting channel info:', cerror);
        alert("Error getting channel info");
    }
    const { data, error } = await client
        .from('u_profiles')
        .update({ 'current_channel': currentChannel })
        .eq('id', user.id)

    const channelRef = channel[0];
    if (!channelRef.joined_users.includes(user.id)) {
        if (channelRef.is_public) {
            joinC(channelRef.id, null);
        } else {
            const password = prompt("Enter the channel password");
            if (password) {
                joinC(channelRef.id, password);
            } else {
                window.location.href = "/chat";
            }
        }
    }
    setupRealtime(currentChannel);
    loadMessages();
    loadChannels();
}
async function joinC(channel, password) {
    let data = await client
        .rpc('append_user_to_channel', {
            channel_id: channel,
            new_user_id: currentUser.id,
            given_password: password
        })
    if(data.error){
        if(data.error.message.includes("[PARSE]")){
            // chop off [PARSE] from the error message
            alert(data.error.message.slice(7));
            // redirect to chat
            window.location.href = "/chat";
        }
    }

}
function setupRealtime(channelId) {
    client
        .channel('public:chat_messages')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `channel_id=eq.${channelId}`
            },
            handleNewMessage
        )
        .subscribe();
}
async function loadChannels() {
    const { data: rows, error } = await client
        .rpc('user_in_joined_users', { user_id: currentUser.id });
    if (error) throw error;
    var channelList = document.getElementById('channel-list');
    rows.forEach(channel => {
        var li = document.createElement("li");
        var a = document.createElement("a")
        a.setAttribute("href", `?channel=${channel.channel_id}`);
        a.innerText = channel.friendly_name;
        if (channel.channel_id == currentChannel) a.classList.add("active");
        li.appendChild(a);
        channelList.appendChild(li);
    })
}
async function loadMessages() {
    const { data, error } = await client
        .from('chat_messages')
        .select('*')
        .eq('channel_id', currentChannel)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error loading messages:', error);
        return;
    }

    data.forEach(message => {
        appendMessage(message);
    });
}

function handleNewMessage(payload) {
    appendMessage(payload.new);
}

function appendMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.textContent = `${message.display_name}: ${message.content}`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sanitizeMessage(message) {
    // Basic XSS protection
    // return message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return message;
}

function containsSwearWords(message) {
    // Add your list of swear words here
    const swearWords = ['fuck', 'shit', 'ass'];
    return swearWords.some(word => message.toLowerCase().includes(word));
}

function calculatePenalty() {
    const penalties = [5, 25, 60, 180, 360, 720];
    const penaltyMinutes = penalties[Math.min(penaltyCount, penalties.length - 1)];
    return penaltyMinutes * 60 * 1000; // Convert to milliseconds
}

messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = sanitizeMessage(messageInput.value.trim());
    if (!message) return;

    const now = Date.now();
    if (now - lastMessageTime < calculatePenalty()) {
        alert(`You are temporarily blocked from sending messages. Please wait.`);
        return;
    }

    if (containsSwearWords(message)) {
        penaltyCount++;
        lastMessageTime = now;
        alert(`Your message contains inappropriate language. You are blocked for ${calculatePenalty() / (60 * 1000)} minutes.`);
        return;
    }

    try {
        const { data, error } = await client
            .from('chat_messages')
            .insert([{ content: message, user_id: currentUser.id, display_name: currentUser.user_metadata.display_name, channel_id: currentChannel }]);

        if (error) throw error;
        messageInput.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
        alert("Error sending message")
    }

});

logoutBtn.addEventListener('click', async () => {
    await client.auth.signOut();
    window.location.href = '/login';
});

init();

const createChannel = document.getElementById('create-channel-btn');
const joinChannel = document.getElementById('add-channel-btn');
joinChannel.addEventListener("click", () => {
    createChannelPopup(false);
    const sendButton = document.getElementById("createChannelConf");
    const nvmdButton = document.getElementById("nvmd");
    const channelInput = document.getElementById("channelInput");
    const passwordInput = document.getElementById("channelPassword");
    sendButton.addEventListener("click", async () => {
        const channelName = channelInput.value;
        if (!channelName) return;
        const passwordValue = passwordInput.value;
        const { data, error } = await client
            .from('chat_channels')
            .select('id')
            .eq('friendly_name', channelName)
            .eq('password', passwordValue);
        if (error) {
            console.error('Error joining channel:', error);
            alert("Error joining channel")
        }
        window.location.href = `?channel=${data[0].id}`;
    });
    const popup = document.querySelector(".popup");
    popup.addEventListener("click", (e) => {
        if (e.target == popup) {
            closePopup();
        }
    }
    );
    nvmdButton.addEventListener("click", () => {
        closePopup();
    });
});

createChannel.addEventListener("click", () => {
    createChannelPopup();
    const sendButton = document.getElementById("createChannelConf");
    const nvmdButton = document.getElementById("nvmd");
    const channelInput = document.getElementById("channelInput");
    const passwordInput = document.getElementById("channelPassword");
    sendButton.addEventListener("click", async () => {
        const channelName = channelInput.value;
        if (!channelName) return;
        const passwordValue = passwordInput.value;
        const public = (passwordValue.length == 0);
        const { data, error } = await client
            .from('chat_channels')
            .insert([{ friendly_name: channelName, password: passwordValue, is_public: public, owner: currentUser.id, joined_users: [currentUser.id] }])
            .select('id');
        if (error) {
            console.error('Error creating channel:', error);
            alert("Error creating channel")
        }
        const joinHTML = `
            <p>Channel created successfully!</p>
            <p>Click <a href="?channel=${data[0].id}">here</a> to join the channel</p>
            <p>Join code to share with friends: <code>${data[0].id}</code> <button class="copy-button" data-copy="${data[0].id}"><i class="fa-solid fa-copy"></i> <span id = "copy-text">Copy</span></button></p>
            `
        
        popup.querySelector(".popup-content").innerHTML = joinHTML;
        document.querySelectorAll(".copy-button").forEach(button => {
            button.addEventListener("click", () => {
                const copyText = button.getAttribute("data-copy");
                navigator.clipboard.writeText(copyText);
                button.querySelector("#copy-text").innerText = "Copied!";
                setTimeout(() => {
                    button.querySelector("#copy-text").innerText = "Copy";
                }, 500);
            });

        });
        
        // window.location.href = `?channel=${data[0].id}`;
    });
    const popup = document.querySelector(".popup");
    popup.addEventListener("click", (e) => {
        if (e.target == popup) {
            closePopup();
        }
    });
    nvmdButton.addEventListener("click", () => {
        closePopup();
    });
});

window.createChannelPopupOpen = false;
function createChannelPopup(create = true) {
    const popup = document.createElement("div");
    popup.classList.add("popup");
    popup.innerHTML = `
        <div class="popup-content">
            <h2>${create ? "Create" : "Join"} A Channel</h2>
            <input type="text" id="channelInput" placeholder="${create ? "Channel Name" : "Channel code"}">
            <input type="${create ? "text" : "password"}" id="channelPassword" placeholder="Channel Password">
            <div class = "popup-buttons">
                <button id = "nvmd">Close</button><button class = "conf" id="createChannelConf">Create</button>
            </div>
        </div>
    `;
    document.body.appendChild(popup);
    window.createChannelPopupOpen = true;
    return popup;
}

function closePopup() {
    document.querySelector(".popup").remove();
    window.createChannelPopupOpen = false;
}

document.addEventListener("keydown", (e) => {
    if (e.key == "Escape" && window.createChannelPopupOpen) {
        closePopup();
    }
    if (e.key == "Enter" && window.createChannelPopupOpen) {
        document.getElementById("createChannelConf").click();
    }
});