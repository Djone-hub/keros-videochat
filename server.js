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

app.use(express.static(path.join(__dirname)));

const rooms = new Map();
const roomStore = new Map(); // Persistent room storage with metadata

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId, userName, userAvatar, roomName, roomAvatar) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userName = userName;
    socket.userAvatar = userAvatar;

    // Check if room exists in persistent store
    let storedRoom = roomStore.get(roomId);
    
    if (!rooms.has(roomId)) {
      // If room exists in store, use that name
      const displayName = storedRoom ? storedRoom.name : (roomName || roomId);
      rooms.set(roomId, { name: displayName, users: new Set() });
    } else if (roomName && roomName !== roomId) {
      // Update room name if provided and different from ID
      rooms.get(roomId).name = roomName;
    }
    
    const room = rooms.get(roomId);
    room.users.add({ id: socket.id, name: userName, avatar: userAvatar });
    
    // Store room metadata if this is a new room with a proper name
    if (roomName && !storedRoom) {
      roomStore.set(roomId, {
        id: roomId,
        name: roomName,
        avatar: roomAvatar || null,
        creator: userName,
        created: Date.now()
      });
    }

    const users = Array.from(room.users).filter(u => u.id !== socket.id);
    
    // Send room info with name from server (either stored or provided)
    const finalRoomName = storedRoom ? storedRoom.name : room.name;
    socket.emit('room-info', { id: roomId, name: finalRoomName, avatar: storedRoom?.avatar });
    socket.emit('users-in-room', users);
    socket.to(roomId).emit('user-joined', { id: socket.id, name: userName, avatar: userAvatar });

    console.log(`${userName} joined room ${roomId} (${finalRoomName})`);
  });
  
  socket.on('get-available-rooms', (callback) => {
    const availableRooms = Array.from(roomStore.values()).map(r => ({
      id: r.id,
      name: r.name,
      avatar: r.avatar,
      creator: r.creator
    }));
    callback(availableRooms);
  });
  
  socket.on('search-rooms', (query, callback) => {
    const availableRooms = Array.from(roomStore.values()).filter(r => {
      const q = query.toLowerCase();
      return r.name.toLowerCase().includes(q) ||
             r.id.toLowerCase().includes(q) ||
             r.creator.toLowerCase().includes(q);
    }).map(r => ({
      id: r.id,
      name: r.name,
      avatar: r.avatar,
      creator: r.creator
    }));
    callback(availableRooms);
  });

  socket.on('offer', (targetId, offer) => {
    socket.to(targetId).emit('offer', socket.id, offer);
  });

  socket.on('answer', (targetId, answer) => {
    socket.to(targetId).emit('answer', socket.id, answer);
  });

  socket.on('ice-candidate', (targetId, candidate) => {
    socket.to(targetId).emit('ice-candidate', socket.id, candidate);
  });

  socket.on('chat-message', (message) => {
    socket.to(socket.roomId).emit('chat-message', {
      sender: socket.userName,
      text: message,
      time: new Date().toLocaleTimeString()
    });
  });

  socket.on('screen-share-started', () => {
    socket.to(socket.roomId).emit('screen-share-started', socket.id);
  });

  socket.on('screen-share-stopped', () => {
    socket.to(socket.roomId).emit('screen-share-stopped', socket.id);
  });

  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.users.forEach(user => {
        if (user.id === socket.id) room.users.delete(user);
      });
      if (room.users.size === 0) {
        rooms.delete(roomId);
        // Don't delete from roomStore so room persists for rejoining
      }
      socket.to(roomId).emit('user-left', socket.id);
    }
    console.log(`User left room ${roomId}`);
  });
  
  socket.on('delete-room', (roomId) => {
    // Only creator can delete
    const storedRoom = roomStore.get(roomId);
    if (storedRoom && storedRoom.creator === socket.userName) {
      roomStore.delete(roomId);
      if (rooms.has(roomId)) {
        rooms.delete(roomId);
      }
      io.emit('room-deleted', roomId);
      console.log(`Room ${roomId} deleted by ${socket.userName}`);
    }
  });

  socket.on('get-user-name', (userId, callback) => {
    if (rooms.has(socket.roomId)) {
      const room = rooms.get(socket.roomId);
      const user = Array.from(room.users).find(u => u.id === userId);
      if (user) {
        callback(user.name);
      } else {
        callback(null);
      }
    } else {
      callback(null);
    }
  });

  socket.on('disconnect', () => {
    if (socket.roomId && rooms.has(socket.roomId)) {
      const room = rooms.get(socket.roomId);
      room.users.forEach(user => {
        if (user.id === socket.id) room.users.delete(user);
      });
      if (room.users.size === 0) {
        rooms.delete(socket.roomId);
      }
      socket.to(socket.roomId).emit('user-left', socket.id);
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Videochat server running on port ${PORT}`);
});
