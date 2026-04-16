const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname)));
app.use(express.json());

const rooms = new Map();

// File-based persistence for rooms
const ROOMS_FILE = path.join(__dirname, 'rooms.json');

function loadRoomsFromFile() {
  try {
    if (fs.existsSync(ROOMS_FILE)) {
      const data = fs.readFileSync(ROOMS_FILE, 'utf8');
      const roomsArray = JSON.parse(data);
      const map = new Map();
      roomsArray.forEach(r => map.set(r.id, r));
      console.log(`Loaded ${roomsArray.length} rooms from file`);
      return map;
    }
  } catch (err) {
    console.error('Error loading rooms file:', err);
  }
  return new Map();
}

function saveRoomsToFile() {
  try {
    const roomsArray = Array.from(roomStore.values());
    fs.writeFileSync(ROOMS_FILE, JSON.stringify(roomsArray, null, 2));
  } catch (err) {
    console.error('Error saving rooms file:', err);
  }
}

const roomStore = loadRoomsFromFile();

// REST API endpoint for rooms - returns ALL rooms (stored + active) with user list
app.get('/api/rooms', (req, res) => {
  const allRoomsMap = new Map();
  
  // First add all stored rooms
  roomStore.forEach((r, id) => {
    const activeRoom = rooms.get(id);
    const activeUsersCount = activeRoom ? activeRoom.users.size : 0;
    const userList = activeRoom ? Array.from(activeRoom.users).map(u => u.name) : [];
    allRoomsMap.set(id, {
      id: id,
      name: r.name,
      avatar: r.avatar,
      creator: r.creator,
      active: activeUsersCount > 0,
      userCount: activeUsersCount,
      users: userList,
      created: r.created
    });
  });
  
  // Then add any active rooms not in store (orphaned/active only rooms)
  rooms.forEach((activeRoom, id) => {
    if (!allRoomsMap.has(id)) {
      const userList = Array.from(activeRoom.users).map(u => u.name);
      allRoomsMap.set(id, {
        id: id,
        name: activeRoom.name || id,
        avatar: null,
        creator: activeRoom.creator || null,
        active: true,
        userCount: activeRoom.users.size,
        users: userList,
        created: Date.now()
      });
    }
  });
  
  const availableRooms = Array.from(allRoomsMap.values());
  console.log(`[API] Returning ${availableRooms.length} rooms (${roomStore.size} stored, ${rooms.size} active)`);
  res.json(availableRooms);
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  console.log('Current rooms in store:', roomStore.size);

  socket.on('join-room', (roomId, userName, userAvatar, roomName, roomAvatar) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userName = userName;
    socket.userAvatar = userAvatar;

    // Check if room exists in persistent store
    let storedRoom = roomStore.get(roomId);
    
    if (!rooms.has(roomId)) {
      // If room exists in store, use that name
      // Only create if room exists in persistent store OR roomName is provided (explicit creation)
      if (storedRoom || roomName) {
        const displayName = storedRoom ? storedRoom.name : (roomName || roomId);
        rooms.set(roomId, { name: displayName, users: new Set(), screenSharingUsers: new Set() });
      } else {
        // Room doesn't exist anywhere and no name provided - reject join
        socket.emit('room-error', { message: 'Комната не найдена' });
        return;
      }
    } else if (roomName && roomName !== roomId) {
      // Update room name if provided and different from ID
      rooms.get(roomId).name = roomName;
    }
    
    const room = rooms.get(roomId);
    // Ensure screenSharingUsers Set exists
    if (!room.screenSharingUsers) {
      room.screenSharingUsers = new Set();
    }
    room.users.add({ id: socket.id, name: userName, avatar: userAvatar });
    
    // Store room metadata if this is a new room with a proper name
    let isNewRoom = false;
    if (roomName && !storedRoom) {
      roomStore.set(roomId, {
        id: roomId,
        name: roomName,
        avatar: roomAvatar || null,
        creator: userName,
        created: Date.now()
      });
      saveRoomsToFile();
      isNewRoom = true;
    }
    
    // Broadcast room update to all clients (for lobby sync)
    io.emit('rooms-updated');

    const users = Array.from(room.users).filter(u => u.id !== socket.id);
    
    console.log(`[DEBUG] Room ${roomId} has ${room.users.size} total users, sending ${users.length} others to ${userName}`);
    console.log(`[DEBUG] Users in room:`, Array.from(room.users).map(u => ({id: u.id, name: u.name, hasAvatar: !!u.avatar})));
    
    // Send room info with name from server (either stored or provided)
    const finalRoomName = storedRoom ? storedRoom.name : room.name;
    socket.emit('room-info', { id: roomId, name: finalRoomName, avatar: storedRoom?.avatar });
    socket.emit('users-in-room', users);
    
    // Send list of users who are currently screen sharing
    const screenSharingUsers = Array.from(room.screenSharingUsers || []);
    if (screenSharingUsers.length > 0) {
      console.log(`[SCREEN] Sending ${screenSharingUsers.length} active screen shares to new user`);
      socket.emit('active-screen-shares', screenSharingUsers);
    }
    
    socket.to(roomId).emit('user-joined', { id: socket.id, name: userName, avatar: userAvatar });

    console.log(`${userName} joined room ${roomId} (${finalRoomName})`);
  });
  
  socket.on('get-available-rooms', (callback) => {
    const availableRooms = Array.from(roomStore.values()).map(r => {
      // Check if room has active users
      const activeRoom = rooms.get(r.id);
      const activeUsersCount = activeRoom ? activeRoom.users.size : 0;
      return {
        id: r.id,
        name: r.name,
        avatar: r.avatar,
        creator: r.creator,
        active: activeUsersCount > 0,
        userCount: activeUsersCount
      };
    });
    callback(availableRooms);
  });
  
  socket.on('get-room-info', (roomId, callback) => {
    const storedRoom = roomStore.get(roomId);
    if (storedRoom) {
      const activeRoom = rooms.get(roomId);
      const activeUsersCount = activeRoom ? activeRoom.users.size : 0;
      callback({
        id: storedRoom.id,
        name: storedRoom.name,
        avatar: storedRoom.avatar,
        creator: storedRoom.creator,
        active: activeUsersCount > 0,
        userCount: activeUsersCount
      });
    } else {
      callback(null);
    }
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
    // Track this user as screen sharing
    if (socket.roomId && rooms.has(socket.roomId)) {
      const room = rooms.get(socket.roomId);
      if (!room.screenSharingUsers) {
        room.screenSharingUsers = new Set();
      }
      room.screenSharingUsers.add(socket.id);
      console.log(`[SCREEN] User ${socket.userName} started screen share in room ${socket.roomId}`);
    }
    socket.to(socket.roomId).emit('screen-share-started', socket.id);
  });

  socket.on('screen-share-stopped', () => {
    // Remove user from screen sharing tracking
    if (socket.roomId && rooms.has(socket.roomId)) {
      const room = rooms.get(socket.roomId);
      if (room.screenSharingUsers) {
        room.screenSharingUsers.delete(socket.id);
      }
      console.log(`[SCREEN] User ${socket.userName} stopped screen share in room ${socket.roomId}`);
    }
    socket.to(socket.roomId).emit('screen-share-stopped', socket.id);
  });

  // Handle request for fresh screen stream (when new user joins and others are sharing)
  socket.on('request-screen-stream', (targetUserId) => {
    console.log(`[SCREEN] User ${socket.userName} requested stream from ${targetUserId}`);
    // Notify the target user to re-offer their screen stream
    socket.to(socket.roomId).emit('refresh-screen-offer', {
      requesterId: socket.id,
      targetId: targetUserId
    });
  });

  // Handle theme changes - broadcast to other users in room
  socket.on('theme-changed', ({ roomId, theme }) => {
    console.log(`[THEME] User ${socket.userName} changed theme to ${theme} in room ${roomId}`);
    // Broadcast to all other users in the room
    socket.to(roomId).emit('theme-changed', { theme });
  });

  // Ping handler for latency measurement
  socket.on('ping-check', (callback) => {
    if (typeof callback === 'function') {
      callback(Date.now());
    }
  });

  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      // Find and remove user from Set
      const userToRemove = Array.from(room.users).find(u => u.id === socket.id);
      if (userToRemove) {
        room.users.delete(userToRemove);
        console.log(`User ${socket.userName} removed from room ${roomId}`);
      }
      if (room.users.size === 0) {
        rooms.delete(roomId);
        // Don't delete from roomStore so room persists for rejoining
      }
      socket.to(roomId).emit('user-left', socket.id);
      
      // Notify all clients to refresh room list (for lobby users)
      io.emit('rooms-updated');
    }
    console.log(`User left room ${roomId}`);
  });
  
  socket.on('delete-room', (roomId) => {
    const storedRoom = roomStore.get(roomId);
    const activeRoom = rooms.get(roomId);
    
    console.log(`[DELETE] Room ${roomId} delete attempt by ${socket.userName}`);
    console.log(`[DELETE] storedRoom:`, storedRoom);
    console.log(`[DELETE] activeRoom:`, activeRoom ? { name: activeRoom.name, creator: activeRoom.creator } : null);
    
    // Check both stored room and active room for creator
    const creator = storedRoom?.creator || activeRoom?.creator;
    
    // Allow deletion if:
    // 1. User is the creator, OR
    // 2. No creator is set (orphaned room) - first user to delete becomes "owner"
    if (creator === socket.userName || !creator) {
      roomStore.delete(roomId);
      if (rooms.has(roomId)) {
        rooms.delete(roomId);
      }
      saveRoomsToFile();
      io.emit('room-deleted', roomId);
      io.emit('rooms-updated');
      console.log(`[DELETE] Room ${roomId} deleted by ${socket.userName}`);
    } else {
      console.log(`[DELETE] Rejected: ${socket.userName} is not creator (creator=${creator})`);
      socket.emit('room-error', { message: 'Только создатель может удалить комнату' });
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
      // Find and remove user from Set
      const userToRemove = Array.from(room.users).find(u => u.id === socket.id);
      if (userToRemove) {
        room.users.delete(userToRemove);
        console.log(`User ${socket.userName} removed from room ${socket.roomId} on disconnect`);
      }
      // Remove from screen sharing tracking
      if (room.screenSharingUsers) {
        room.screenSharingUsers.delete(socket.id);
      }
      if (room.users.size === 0) {
        rooms.delete(socket.roomId);
      }
      socket.to(socket.roomId).emit('user-left', socket.id);
      
      // Notify all clients to refresh room list (for lobby users)
      io.emit('rooms-updated');
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Videochat server running on port ${PORT}`);
});
