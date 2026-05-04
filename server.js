const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Store registered users (username -> password)
const registeredUsers = {};
// Store active sockets and their session info
const users = {};
const rooms = {
    'General': { description: 'Main chat room for everyone', type: 'public' },
    'Tech': { description: 'Discuss programming and gadgets', type: 'public' },
    'Design': { description: 'Showcase your creative work', type: 'public' },
    'Random': { description: 'Anything goes here', type: 'public' }
};

// In-memory message history
const messageHistory = {};
Object.keys(rooms).forEach(room => messageHistory[room] = []);
const MAX_HISTORY = 100;

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle Signup
    socket.on('signup', ({ username, password }) => {
        if (registeredUsers[username]) {
            socket.emit('error', 'Username already exists');
        } else {
            registeredUsers[username] = password;
            socket.emit('signupSuccess');
            console.log('User registered:', username);
        }
    });

    // Handle Login
    socket.on('login', ({ username, password }) => {
        if (registeredUsers[username] && registeredUsers[username] === password) {
            socket.emit('loginSuccess', { username });
            // Send room list after login
            socket.emit('roomList', rooms);
        } else {
            socket.emit('error', 'Invalid username or password');
        }
    });

    // Handle Create Room
    socket.on('createRoom', ({ roomName, description }) => {
        if (rooms[roomName]) {
            socket.emit('error', 'Room already exists');
        } else {
            rooms[roomName] = { description, type: 'user' };
            messageHistory[roomName] = [];
            io.emit('roomList', rooms); // Notify everyone of new room
            console.log('Room created:', roomName);
        }
    });

    // Handle Room Members request
    socket.on('getRoomUsers', ({ room }) => {
        if (rooms[room]) {
            broadcastRoomInfo(room);
        }
    });

    // Handle joining a room
    socket.on('joinRoom', ({ username, room }) => {
        socket.join(room);
        
        if (!users[socket.id]) {
            users[socket.id] = { username, rooms: [] };
        }
        
        if (!users[socket.id].rooms.includes(room)) {
            users[socket.id].rooms.push(room);
        }

        // Send existing message history to the user
        if (messageHistory[room]) {
            socket.emit('loadHistory', messageHistory[room]);
        }

        // Welcome notifications
        socket.emit('message', {
            user: 'System',
            text: `Welcome to ${room}, ${username}!`,
            time: new Date().toLocaleTimeString()
        });

        socket.to(room).emit('message', {
            user: 'System',
            text: `${username} has joined the chat`,
            time: new Date().toLocaleTimeString()
        });

        // Send users and admin info
        broadcastRoomInfo(room);
    });

    // Handle leaving a room
    socket.on('leaveRoom', ({ room }) => {
        const user = users[socket.id];
        if (user && user.rooms.includes(room)) {
            socket.leave(room);
            user.rooms = user.rooms.filter(r => r !== room);
            
            socket.emit('message', {
                user: 'System',
                text: `You have left ${room}`,
                time: new Date().toLocaleTimeString()
            });

            socket.to(room).emit('message', {
                user: 'System',
                text: `${user.username} has left the chat`,
                time: new Date().toLocaleTimeString()
            });

            broadcastRoomInfo(room);
            console.log(`${user.username} left room: ${room}`);
        }
    });

    // Listen for chatMessage
    socket.on('chatMessage', ({ room, msg }) => {
        const user = users[socket.id];
        if (user && user.rooms.includes(room)) {
            const messageData = {
                user: user.username,
                text: msg,
                time: new Date().toLocaleTimeString()
            };

            if (!messageHistory[room]) messageHistory[room] = [];
            messageHistory[room].push(messageData);
            if (messageHistory[room].length > MAX_HISTORY) messageHistory[room].shift();

            io.to(room).emit('message', { room, ...messageData });
        }
    });

    // Handle Logout
    socket.on('logout', () => {
        const user = users[socket.id];
        if (user) {
            user.rooms.forEach(room => {
                socket.to(room).emit('message', {
                    user: 'System',
                    text: `${user.username} has logged out`,
                    time: new Date().toLocaleTimeString()
                });
                socket.leave(room);
            });

            const roomsToUpdate = [...user.rooms];
            delete users[socket.id];
            
            roomsToUpdate.forEach(room => broadcastRoomInfo(room));
            console.log(`${user.username} logged out`);
        }
    });

    // Handle Disconnect
    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (user) {
            user.rooms.forEach(room => {
                socket.to(room).emit('message', {
                    user: 'System',
                    text: `${user.username} has left the chat`,
                    time: new Date().toLocaleTimeString()
                });
                // broadcastRoomInfo(room) will be called after removal
            });

            const roomsToUpdate = [...user.rooms];
            delete users[socket.id];
            
            roomsToUpdate.forEach(room => broadcastRoomInfo(room));
        }
    });

    function broadcastRoomInfo(room) {
        const roomUsers = Object.values(users).filter(u => u.rooms.includes(room));
        io.to(room).emit('roomUsers', {
            room: room,
            users: roomUsers
        });
    }
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Error: Port ${PORT} is already in use.`);
        console.error(`Try running: npx kill-port ${PORT}`);
        process.exit(1);
    } else {
        throw err;
    }
});
