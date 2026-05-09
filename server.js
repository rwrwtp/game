const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files from the current directory
app.use(express.static(__dirname));

const rooms = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('createRoom', ({ nickname, gameType, credits, maxPlayers }) => {
        // Generate a unique 4-character code
        let roomCode;
        do {
            roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        } while (rooms[roomCode]);

        rooms[roomCode] = {
            gameType,
            credits,
            maxPlayers,
            hostId: socket.id,
            players: [{ id: socket.id, nickname, isHost: true }]
        };

        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, roomData: rooms[roomCode] });
        console.log(`Room created: ${roomCode} by ${nickname}`);
    });

    socket.on('joinRoom', ({ nickname, roomCode }) => {
        const room = rooms[roomCode];
        if (!room) {
            socket.emit('errorMsg', '방을 찾을 수 없습니다.');
            return;
        }

        if (room.players.length >= room.maxPlayers) {
            socket.emit('errorMsg', '방이 가득 찼습니다.');
            return;
        }

        const newPlayer = { id: socket.id, nickname, isHost: false };
        room.players.push(newPlayer);
        socket.join(roomCode);

        // Tell the joiner about the room
        socket.emit('roomJoined', { roomCode, roomData: room });
        
        // Notify everyone in the room
        io.to(roomCode).emit('updatePlayerList', room.players);
        console.log(`${nickname} joined room: ${roomCode}`);
    });

    socket.on('leaveRoom', (roomCode) => {
        handleLeave(socket, roomCode);
    });

    socket.on('disconnect', () => {
        // Find if player was in a room
        for (const roomCode in rooms) {
            const playerIdx = rooms[roomCode].players.findIndex(p => p.id === socket.id);
            if (playerIdx !== -1) {
                handleLeave(socket, roomCode);
                break;
            }
        }
        console.log('User disconnected:', socket.id);
    });
});

function handleLeave(socket, roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    room.players = room.players.filter(p => p.id !== socket.id);
    socket.leave(roomCode);

    if (room.players.length === 0) {
        delete rooms[roomCode];
        console.log(`Room deleted: ${roomCode}`);
    } else {
        // If host left, assign new host
        if (room.hostId === socket.id) {
            room.players[0].isHost = true;
            room.hostId = room.players[0].id;
        }
        io.to(roomCode).emit('updatePlayerList', room.players);
    }
}

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
