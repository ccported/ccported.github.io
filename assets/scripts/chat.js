const client = window.ccSupaClient;
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const chatMessages = document.getElementById('chat-messages');
const logoutBtn = document.getElementById('logout-btn');
const sidebar = document.querySelector(".sidebar");
const createChannel = document.getElementById('create-channel-btn');
const joinChannel = document.getElementById('add-channel-btn');
const sArrow = document.querySelector(".sidebar .arrow");
const filter = new Filter({ list: localList });

let query = new URLSearchParams(window.location.search);
let channel = (query.has("channel") ? query.get("channel") : "1b81d7ae-9035-4280-b667-ad9c8bad9311");
let password = (query.has("password") ? query.get("password") : "");
let currentUser;
let penaltyCount = 0;
let lastMessageTime = 0;
let currentChannel = channel;
let channelRef = null;
let currentPage = 0;
let isLoading = false;
let hasMoreMessages = true;
let profilePictureCache = new Map();
let displayNameCache = new Map();
let messagesSent = 0;

window.createChannelPopupOpen = false;
sidebar.addEventListener("mouseover", (e) => {
    if(window.innerWidth < 768) return;
    sidebar.classList.add("expanded");
});
sidebar.addEventListener("mouseout", (e) => {
    if(window.innerWidth < 768) return;
    sidebar.classList.remove("expanded");
});


async function init() {
    log(`Initializing chat`)
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
        localStorage.setItem("redirect", window.location.href);
        window.location.href = `/login/`;
        return;
    }
    currentUser = user;
    const { data: channel, cerror } = await client
        .rpc("get_channel_info", { channel_id: currentChannel });
    if (cerror) {
        log('Error getting channel info:', cerror);
        alert("Error getting channel info");
    }
    const { error } = await client
        .from('u_profiles')
        .update({ 'current_channel': currentChannel })
        .eq('id', user.id)

    channelRef = channel[0];
    document.getElementById("chat_name").textContent = channelRef.friendly_name;
    if (!channelRef.joined_users.includes(user.id)) {
        if (channelRef.is_public) {
            log("Joining w/o password")
            joinC(channelRef.id, null);
        } else {
            if (!password || password.length == 0) {
                password = prompt("Enter the channel password");
            }
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
    loadInviteButton();
}
async function loadChannels() {
    log(`Loading channels`)
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
async function loadMessages(page = 0, pageSize = 20) {
    log(`Loading messages from message <${page * pageSize}> to <${(page + 1) * pageSize}>`);
    try {
        const { data, error } = await client
            .from('chat_messages')
            .select('*')
            .eq('channel_id', currentChannel)
            .order('created_at', { ascending: false })
            .limit(pageSize)
            .range(page * (pageSize), (page + 1) * (pageSize));

        if (error) {
            log('Error loading messages:', error);
            return;
        }
        for (const message of data) {
            await appendMessage(message, true);
        }

        if (data.length != 0) {
            return { hasMore: true, messages: data }
        } else {
            return { hasMore: false, messages: data };
        }
    } catch (err) {
        log('Error loading messages:', err);
        return { hasMore: false, messages: [] };
    }
}
async function joinC(channel, password = null) {
    log(`Joining channel <${channel}>`)
    let data = await client
        .rpc('append_user_to_channel', {
            channel_id: channel,
            new_user_id: currentUser.id,
            given_password: password
        })
    if (data.error) {
        if (data.error.message.includes("[PARSE]")) {
            // chop off [PARSE] from the error message
            alert(data.error.message.slice(7));
            // redirect to chat
            window.location.href = "/chat";
        }
    }

}
async function loadPFP(user_id) {
    log(`Loading profile picture for user <${user_id}>`);
    if (profilePictureCache.has(user_id)) {
        return profilePictureCache.get(user_id);
    }
    const { data, error } = await client
        .from('u_profiles')
        .select('avatar_url')
        .eq('id', user_id);
    if (error) {
        log('Error loading profile picture:', error);
        return;
    }
    profilePictureCache.set(user_id, data[0].avatar_url || '/assets/images/profile_pic.png');
    return profilePictureCache.get(user_id);
}
async function loadDisplayName(user_id) {
    log(`Loading display name for user <${user_id}>`);
    if (displayNameCache.has(user_id)) {
        return displayNameCache.get(user_id);
    }
    const { data, error } = await window.ccSupaClient
        .rpc('get_user_display_name', {
            user_id
        });
    if (error) log(error);
    displayNameCache.set(user_id, data);
    return displayNameCache.get(user_id);
}
async function handleNewMessage(payload) {
    log(`Handling new message`)
    await appendMessage(payload.new);
}
async function appendMessage(message, before = false) {
    log(`Appending new message (before <${before}>)`)
    const messageElement = document.createElement('div');
    if (message.user_id == currentUser.id) {
        messageElement.classList.add('message', 'self');
    }
    const pfp = await loadPFP(message.user_id);
    messageElement.classList.add('message');
    const img = document.createElement("img");
    img.src = pfp;
    img.classList.add("profile-picture");
    const messageContent = document.createElement('div');
    messageContent.classList.add('message-content');
    const messageHeader = document.createElement('div');
    messageHeader.classList.add('message-header');
    messageHeader.appendChild(img);
    const authorTime = document.createElement('div');
    authorTime.classList.add('author-time');
    const messageAuthor = document.createElement('span');
    messageAuthor.classList.add('message-author');
    messageAuthor.textContent = await loadDisplayName(message.user_id);
    authorTime.appendChild(messageAuthor);
    const messageTime = document.createElement('span');
    messageTime.classList.add('message-time');
    const messageDate = new Date(message.created_at);
    messageTime.textContent = `${messageDate.toLocaleDateString()} ${messageDate.toLocaleTimeString()}`;
    authorTime.appendChild(messageTime);
    messageHeader.appendChild(authorTime);
    messageContent.appendChild(messageHeader);
    const messageText = document.createElement('p');
    messageText.classList.add('message-text');
    messageText.textContent = message.content;
    messageContent.appendChild(messageText);
    messageElement.appendChild(messageContent);


    if (!before) {
        chatMessages.appendChild(messageElement);
    } else {
        chatMessages.insertBefore(messageElement, document.querySelectorAll('.message')[0] || document.querySelector(".empty-message"))
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
function loadInviteButton() {
    log("Loading invite buttons")
    if (channelRef && channelRef.owner == currentUser.id) {
        const inviteButton = document.createElement("button");
        inviteButton.innerHTML = `<i class="fa-solid fa-share"></i> Invite Friends`;
        inviteButton.addEventListener("click", () => {
            createInvitePopup();
        });
        document.querySelector(".sidebar-content .actionButtons").appendChild(inviteButton);
    }
}
function setupRealtime(channelId) {
    log(`Setting up realtime on channel <${channelId}>`)
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
function sanitizeMessage(message) {
    log(`Sanitizing message <${message}>`)
    return filterXSS(message);
}
function createChannelPopup(create = true) {
    log(`Creating create channel popup`)
    const popup = document.createElement("div");
    popup.classList.add("popup");
    popup.innerHTML = `
        <div class="popup-content">
            <h2>${create ? "Create" : "Join"} A Channel</h2>
            <input type="text" id="channelInput" placeholder="${create ? "Channel Name" : "Channel code"}">
            <input type="${create ? "text" : "password"}" id="channelPassword" placeholder="Channel Password${create ? " (Leave empty to make public)" : ""}">
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
    log(`Close popup`)
    document.querySelector(".popup").remove();
    window.createChannelPopupOpen = false;
}
function createInvitePopup() {
    log(`Creating invite popup`)
    const popup = document.createElement("div");
    popup.classList.add("popup");
    popup.innerHTML = `
        <div class="popup-content invite-box">
            <h2>Invite Friends</h2>
            <p>Add your friends email addresses</p>
            <div class="invite-emails adder">
                <div class = "invite-emailInputContainer">
                    <input type="text" class="invite-emailInput" placeholder="Email Address" autofocus>
                </div>
            </div>
            <div class = "invite-emails">
                <div class = "invite-emailInputContainer">
                    <div class = "invite-emailInputFaux">&nbsp;</div><button class="invite-add">+</button>
                </div>
            </div>
            <button class="invite-send">Send</button>
        </div>
    `;
    document.body.appendChild(popup);
    document.querySelector(".invite-send").addEventListener("click", async () => {
        const emails = Array.from(document.querySelectorAll(".invite-emailInput")).map(input => {
            if (input.value && input.value.length > 0) {
                return input.value;
            } else {
                return null;
            }
        }).filter(email => email);
        if (emails.length == 0) {
            alert("Please enter at least one email address");
            return;
        }
        const body = {
            emails,
            channelID: currentChannel,
            location: window.location.origin + window.location.pathname
        }
        const res = await client.functions.invoke("send_email_invite", {
            body
        });
        if (res.data && res.data.success) {
            closePopup();
        }
        if (res.error) {
            alert("Error sending invites");
            log(res.error);
            closePopup();
        }
    });
    document.querySelector(".invite-add").addEventListener("click", () => {
        const container = document.createElement("div");
        container.classList.add("invite-emailInputContainer");

        const input = document.createElement("input");
        input.type = "text";
        input.classList.add("invite-emailInput");
        input.placeholder = "Email Address";

        const button = document.createElement("button");
        button.classList.add("invite-remove");
        button.setAttribute("data-remove", document.querySelectorAll(".invite-emailInput").length);
        button.innerText = "X";
        button.addEventListener("click", () => {
            input.remove();
            button.remove();
            container.remove();
        });
        container.appendChild(input);
        container.appendChild(button);

        document.querySelector(".invite-emails.adder").appendChild(container);
        input.focus();
    });
    popup.addEventListener("click", (e) => {
        if (e.target == popup) {
            closePopup();
        }
    });
    return popup;
}

messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = sanitizeMessage(messageInput.value.trim());
    if (!message) return;

    try {
        const { data, error } = await client
            .from('chat_messages')
            .insert([{ content: filter.clean(message), user_id: currentUser.id, display_name: filter.clean(currentUser.user_metadata.display_name), channel_id: currentChannel, channel_name: filter.clean(channelRef.friendly_name) }]);

        if (error) throw error;
        messageInput.value = '';
        updateTracking('chat_messages_sent', getDeepValue(window.ccPortedTrackingData, 'chat_messages_sent') + 1);
    } catch (error) {
        log('Error sending message:', error);
        alert("Error sending message")
    }
});
logoutBtn.addEventListener('click', async () => {
    await client.auth.signOut();
    window.location.href = '/login/';
});
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
            log('Error joining channel:', error);
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
            .insert([{ friendly_name: channelName, password: (passwordValue.length > 0) ? passwordValue : null, is_public: public, owner: currentUser.id, joined_users: [currentUser.id] }])
            .select('id');
        if (error) {
            log('Error creating channel:', error);
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
document.addEventListener("keydown", (e) => {
    if (e.key == "Escape" && window.createChannelPopupOpen) {
        closePopup();
    }
    if (e.key == "Enter" && window.createChannelPopupOpen) {
        document.getElementById("createChannelConf").click();
    }
});
chatMessages.addEventListener("scroll", async () => {
    // Calculate scroll position
    const scrollTop = chatMessages.scrollTop;
    const scrollThreshold = 50; // Pixels from top to trigger load
    if (scrollTop <= scrollThreshold) {
    }
    // Check if we're near the top and not currently loading
    if (scrollTop <= scrollThreshold && !isLoading && hasMoreMessages) {
        isLoading = true;

        try {
            // Save current scroll height
            const previousScrollHeight = chatMessages.scrollHeight;

            // Load next page
            const result = await loadMessages(currentPage + 1);
            hasMoreMessages = result.hasMore;

            if (result.messages.length > 0) {
                currentPage++;

                // Maintain scroll position after new content is loaded
                requestAnimationFrame(() => {
                    const newScrollHeight = chatMessages.scrollHeight;
                    const scrollDiff = newScrollHeight - previousScrollHeight;
                    chatMessages.scrollTop = scrollDiff;
                });
            }
        } catch (error) {
            log('Error loading messages:', error);
            isLoading = false;
        } finally {
            isLoading = false;
        }
    }
});
sArrow.addEventListener("click", () => {
    if (navigator.userAgent.includes("Mobi")) {
        sidebar.classList.toggle("expanded")
    }
});
window.addEventListener('beforeunload', () => {
    trackingTick();
});
init();