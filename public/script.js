const socket = io();

// UI Boxes
const authContainer = document.getElementById('auth-container');
const loginBox = document.getElementById('login-box');
const signupBox = document.getElementById('signup-box');
const roomBox = document.getElementById('room-box');
const appContainer = document.getElementById('app-container');

// Forms & Inputs
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const roomForm = document.getElementById('room-form');
const chatForm = document.getElementById('chat-form-main');
const msgInput = document.getElementById('msg');

// Sidebar/Header Elements
const chatHeaderName = document.getElementById('chat-header-name');
const onlineCount = document.getElementById('online-count');
const usersList = document.getElementById('users-list');
const currentUsernameDisplay = document.getElementById('current-username');
const currentAvatar = document.getElementById('current-avatar');
const chatMessages = document.getElementById('chat-messages');

// Toggles
const showSignup = document.getElementById('show-signup');
const showLogin = document.getElementById('show-login');
const emojiBtn = document.getElementById('emoji-btn');
const emojiTray = document.getElementById('emoji-tray');

// Globals
let currentUser = '';
let currentRoom = '';
let joinedRooms = [];
let roomMessages = {}; // Cache messages per room: { roomName: [messages] }

// Toggle Logic
showSignup.onclick = () => { loginBox.classList.add('hidden'); signupBox.classList.remove('hidden'); };
showLogin.onclick = () => { signupBox.classList.add('hidden'); loginBox.classList.remove('hidden'); };

// Dashboard Elements
const roomDashboardBox = document.getElementById('room-dashboard-box');
const roomListContainer = document.getElementById('room-list-container');
const showCreateRoomBtn = document.getElementById('show-create-room');
const createRoomBox = document.getElementById('create-room-box');
const createRoomForm = document.getElementById('create-room-form');
const cancelCreateRoomBtn = document.getElementById('cancel-create-room');
const gotoDashboardBtn = document.getElementById('goto-dashboard');
const activeRoomsSidebar = document.getElementById('active-rooms-sidebar');
const sidebarAddRoom = document.getElementById('sidebar-add-room');

// Signup Handler
signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('signup-username').value;
    const password = document.getElementById('signup-password').value;
    socket.emit('signup', { username, password });
});

socket.on('signupSuccess', () => {
    alert('Account created! Please log in.');
    signupBox.classList.add('hidden');
    loginBox.classList.remove('hidden');
});

// Login Handler
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    socket.emit('login', { username, password });
});

socket.on('loginSuccess', ({ username }) => {
    currentUser = username;
    loginBox.classList.add('hidden');
    roomDashboardBox.classList.remove('hidden');
    currentUsernameDisplay.innerText = username;
    currentAvatar.innerText = username.charAt(0).toUpperCase();
});

// Create Room Handling
showCreateRoomBtn.onclick = () => {
    roomDashboardBox.classList.add('hidden');
    createRoomBox.classList.remove('hidden');
};

cancelCreateRoomBtn.onclick = () => {
    createRoomBox.classList.add('hidden');
    roomDashboardBox.classList.remove('hidden');
};

createRoomForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const roomName = document.getElementById('new-room-name').value;
    const description = document.getElementById('new-room-desc').value;
    socket.emit('createRoom', { roomName, description });
    createRoomBox.classList.add('hidden');
    roomDashboardBox.classList.remove('hidden');
    createRoomForm.reset();
});

gotoDashboardBtn.onclick = () => {
    appContainer.classList.add('hidden');
    authContainer.classList.remove('hidden');
    roomDashboardBox.classList.remove('hidden');
};

sidebarAddRoom.onclick = () => {
    appContainer.classList.add('hidden');
    authContainer.classList.remove('hidden');
    roomDashboardBox.classList.remove('hidden');
};

// UI Logic
function updateDashboardButtons() {
    document.querySelectorAll('.btn-join').forEach(btn => {
        const roomName = btn.getAttribute('data-room-name');
        if (joinedRooms.includes(roomName)) {
            btn.innerText = 'Open';
            btn.classList.add('btn-open');
        } else {
            btn.innerText = 'Join';
            btn.classList.remove('btn-open');
        }
    });
}

// Room List Handling
socket.on('roomList', (rooms) => {
    roomListContainer.innerHTML = '';
    Object.entries(rooms).forEach(([name, data]) => {
        const roomCard = document.createElement('div');
        roomCard.className = 'room-card-item';
        roomCard.innerHTML = `
            <h3>${name}</h3>
            <p>${data.description}</p>
            <button class="btn-join" data-room-name="${name}" onclick="joinChat('${currentUser}', '${name}')">Join</button>
        `;
        roomListContainer.appendChild(roomCard);
    });
    updateDashboardButtons();
});

function joinChat(username, room) {
    if (!joinedRooms.includes(room)) {
        joinedRooms.push(room);
        roomMessages[room] = [];
        socket.emit('joinRoom', { username, room });
    }
    
    switchRoom(room);
}

function switchRoom(room) {
    currentRoom = room;
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    chatHeaderName.innerText = room;
    msgInput.placeholder = `Message #${room.toLowerCase()}`;
    
    // Clear and reload messages for this room
    chatMessages.innerHTML = '';
    if (roomMessages[room]) {
        roomMessages[room].forEach(msg => outputMessage(msg));
    }
    scrollToBottom();
    updateSidebar();
    updateDashboardButtons();
    socket.emit('getRoomUsers', { room });
}

function updateSidebar() {
    activeRoomsSidebar.innerHTML = joinedRooms.map(room => `
        <div class="server-icon ${room === currentRoom ? 'active' : ''}" 
             title="${room}" onclick="switchRoom('${room}')">
            ${room.charAt(0).toUpperCase()}
        </div>
    `).join('');
}

// Leave Room Handling
document.getElementById('leave-btn').onclick = () => {
    if (currentRoom) {
        const roomToLeave = currentRoom;
        socket.emit('leaveRoom', { room: roomToLeave });
        
        joinedRooms = joinedRooms.filter(r => r !== roomToLeave);
        delete roomMessages[roomToLeave];
        
        if (joinedRooms.length > 0) {
            switchRoom(joinedRooms[0]);
        } else {
            currentRoom = '';
            appContainer.classList.add('hidden');
            authContainer.classList.remove('hidden');
            roomDashboardBox.classList.remove('hidden');
            updateDashboardButtons();
        }
        updateSidebar();
    }
};

// Socket Events
socket.on('loadHistory', (history) => {
    // Populate cache with history when joining
    // Since we know which room we just joined, we can find it.
    // However, the server should ideally send the room name with history.
    // For now, let's just append to currentRoom if empty.
    if (history && history.length > 0 && currentRoom) {
        roomMessages[currentRoom] = history;
        chatMessages.innerHTML = '';
        history.forEach(msg => outputMessage(msg));
        scrollToBottom();
    }
});

socket.on('message', (message) => {
    const room = message.room || currentRoom; // Fallback for system messages
    if (!roomMessages[room]) roomMessages[room] = [];
    roomMessages[room].push(message);
    
    if (room === currentRoom) {
        outputMessage(message);
        scrollToBottom();
    }
});

socket.on('roomUsers', ({ room, users }) => {
    if (room === currentRoom) {
        onlineCount.innerText = users.length;
        usersList.innerHTML = users.map(user => `
            <li>
                <div class="user-item-main">${user.username}</div>
            </li>
        `).join('');
    }
});

socket.on('error', (msg) => alert(msg));

// Message Send
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = msgInput.value;
    if (!msg || !currentRoom) return;
    socket.emit('chatMessage', { room: currentRoom, msg });
    msgInput.value = '';
    msgInput.focus();
});

// Features
emojiBtn.onclick = () => { emojiTray.classList.toggle('hidden'); };

emojiTray.onclick = (e) => {
    if (e.target.tagName === 'SPAN') {
        msgInput.value += e.target.innerText;
        emojiTray.classList.add('hidden');
        msgInput.focus();
    }
};

// UI Output
function outputMessage(message) {
    if (message.user === 'System') {
        const div = document.createElement('div');
        div.className = 'message system';
        div.innerText = message.text;
        chatMessages.appendChild(div);
        return;
    }

    const div = document.createElement('div');
    div.className = 'message';
    div.innerHTML = `
        <div class="msg-avatar">${message.user.charAt(0).toUpperCase()}</div>
        <div class="msg-content">
            <div class="msg-header">
                <span class="msg-user">${message.user} ${message.isAdmin ? '👑' : ''}</span>
                <span class="msg-time">${message.time}</span>
            </div>
            <span class="msg-text">${escapeHtml(message.text)}</span>
        </div>
    `;
    chatMessages.appendChild(div);
}

function scrollToBottom() { chatMessages.scrollTop = chatMessages.scrollHeight; }
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.getElementById('toggle-users').onclick = () => document.getElementById('user-sidebar').classList.toggle('hidden');
