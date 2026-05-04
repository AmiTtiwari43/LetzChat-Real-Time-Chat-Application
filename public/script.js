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
    showToast('Account created! Please log in.', 'success');
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

// Logout Handling
document.getElementById('leave-btn').onclick = () => {
    socket.emit('logout');
    
    // Clear local state
    currentUser = '';
    currentRoom = '';
    joinedRooms = [];
    roomMessages = {};
    
    // Reset UI
    appContainer.classList.add('hidden');
    roomDashboardBox.classList.add('hidden');
    authContainer.classList.remove('hidden');
    loginBox.classList.remove('hidden');
    signupBox.classList.add('hidden');
    
    showToast('Logged out successfully', 'success');
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

socket.on('error', (msg) => showToast(msg, 'error'));

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

// Toast Notification System
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Icon based on type
    const icon = type === 'success' 
        ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
        : '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
        
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('hiding');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3000);
}
