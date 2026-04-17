const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Global error handlers to prevent server crashes
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

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
// registeredUsers will be initialized from file below

// File-based persistence for rooms and users
const ROOMS_FILE = path.join(__dirname, 'rooms.json');

// Supabase configuration
const SUPABASE_URL = 'https://gtixajbcfxwqrtsdxnif.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhhamJjZnh3cXJ0c2R4bmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MDUwMTIsImV4cCI6MjA3NjA4MTAxMn0.T3Wvz0UPTG1O4NFS54PzfyB4sJdNLdiGT9GvnvJKGzw';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

async function loadUsersFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('videochat_users')
      .select('*');

    if (error) {
      console.error('[USERS] Error loading users from Supabase:', error);
      return new Map();
    }

    const map = new Map();
    data.forEach(u => {
      console.log(`[USERS] Loading user: ${u.username}, role: ${u.role}, is_muted: ${u.is_muted}`);
      map.set(u.username, {
        username: u.username,
        password: u.password,
        name: u.name,
        avatar: u.avatar,
        isOnline: u.is_online,
        lastSeen: u.last_seen,
        role: u.role || 'user',
        isMuted: u.is_muted || false,
        muteUntil: u.mute_until || 0,
        kickedRooms: u.kicked_rooms || '[]'
      });
    });

    console.log(`[USERS] Loaded ${data.length} users from Supabase`);
    return map;
  } catch (err) {
    console.error('[USERS] Error loading users from Supabase:', err);
    return new Map();
  }
}

function saveRoomsToFile() {
  try {
    const roomsArray = Array.from(roomStore.values());
    fs.writeFileSync(ROOMS_FILE, JSON.stringify(roomsArray, null, 2));
  } catch (err) {
    console.error('Error saving rooms file:', err);
  }
}

async function saveUsersToSupabase() {
  try {
    const usersArray = Array.from(registeredUsers.values());

    // Convert to Supabase format
    const supabaseUsers = usersArray.map(u => ({
      username: u.username,
      password: u.password,
      name: u.name,
      avatar: u.avatar,
      is_online: u.isOnline,
      last_seen: u.lastSeen,
      role: u.role || 'user',
      is_muted: u.isMuted || false,
      mute_until: u.muteUntil || 0,
      kicked_rooms: u.kickedRooms || '[]'
    }));

    // Use upsert to insert or update
    const { data, error } = await supabase
      .from('videochat_users')
      .upsert(supabaseUsers, { onConflict: 'username' });

    if (error) {
      console.error('[USERS] Error saving users to Supabase:', error);
    } else {
      console.log(`[USERS] Saved ${usersArray.length} users to Supabase`);
    }
  } catch (err) {
    console.error('[USERS] Error saving users to Supabase:', err);
  }
}

const roomStore = loadRoomsFromFile();
const registeredUsers = new Map();

// Load users from Supabase asynchronously
loadUsersFromSupabase().then(users => {
  // Copy all users to registeredUsers
  users.forEach((value, key) => registeredUsers.set(key, value));
  console.log('========================================');
  console.log('[VERSION] Server v3.0 - Supabase user persistence enabled');
  console.log('========================================');
}).catch(err => {
  console.error('[USERS] Failed to load users from Supabase:', err);
  console.log('========================================');
  console.log('[VERSION] Server v3.0 - Starting with empty user registry');
  console.log('========================================');
});

// REST API endpoint for rooms - returns ALL rooms (stored + active) with user list
app.get('/api/rooms', (req, res) => {
  const allRoomsMap = new Map();
  
  // First add all stored rooms
  roomStore.forEach((r, id) => {
    const activeRoom = rooms.get(id);
    // Deduplicate user names (same user may reconnect with different socket.id)
    const userList = activeRoom ? [...new Set(Array.from(activeRoom.users).map(u => u.name))] : [];
    const uniqueUserCount = userList.length;
    allRoomsMap.set(id, {
      id: id,
      name: r.name,
      avatar: r.avatar,
      creator: r.creator,
      active: uniqueUserCount > 0,
      userCount: uniqueUserCount,
      users: userList,
      created: r.created
    });
  });
  
  // Then add any active rooms not in store (orphaned/active only rooms)
  rooms.forEach((activeRoom, id) => {
    if (!allRoomsMap.has(id)) {
      // Deduplicate user names
      const userList = [...new Set(Array.from(activeRoom.users).map(u => u.name))];
      allRoomsMap.set(id, {
        id: id,
        name: activeRoom.name || id,
        avatar: null,
        creator: activeRoom.creator || null,
        active: true,
        userCount: userList.length,
        users: userList,
        created: Date.now()
      });
    }
  });
  
  const availableRooms = Array.from(allRoomsMap.values());
  console.log(`[API] Returning ${availableRooms.length} rooms (${roomStore.size} stored, ${rooms.size} active)`);
  res.json(availableRooms);
});

// REST API endpoint for registered users with online status
app.get('/api/users', (req, res) => {
  const users = Array.from(registeredUsers.values()).map(u => ({
    username: u.username,
    name: u.name,
    avatar: u.avatar,
    isOnline: u.isOnline,
    lastSeen: u.lastSeen,
    role: u.role || 'user'
  }));
  res.json(users);
});

// REST API endpoint to check if user exists
app.get('/api/users/:username', (req, res) => {
  const username = req.params.username;
  const exists = registeredUsers.has(username);
  res.json({ exists, username });
});

// REST API endpoint for user login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  console.log(`[LOGIN] Attempt: username=${username}, hasPassword=${!!password}, passwordLength=${password?.length || 0}`);
  const user = registeredUsers.get(username);
  console.log(`[LOGIN] User found in registry: ${!!user}, hasPassword: ${!!user?.password}, passwordLength=${user?.password?.length || 0}`);

  if (user && user.password === password) {
    console.log(`[LOGIN] SUCCESS: ${username}, role: ${user.role || 'user'}`);
    res.json({ success: true, user: { username: user.username, name: user.name, avatar: user.avatar, role: user.role || 'user' } });
  } else {
    console.log(`[LOGIN] FAILED: ${username} - user not found or wrong password`);
    res.status(401).json({ success: false, message: 'Invalid username or password' });
  }
});

// REST API endpoint to delete a registered user
app.delete('/api/users/:username', async (req, res) => {
  const username = req.params.username;
  const requester = req.headers['x-username'];

  // Check if requester is admin
  const requesterUser = registeredUsers.get(requester);
  const isAdmin = requesterUser && (requesterUser.role === 'admin' || requesterUser.role === 'superadmin');

  // Only allow deletion if requester is admin
  if (!isAdmin) {
    return res.status(403).json({ success: false, message: 'Only admins can delete users' });
  }

  if (registeredUsers.has(username)) {
    registeredUsers.delete(username);

    // Delete from Supabase
    const { error } = await supabase
      .from('videochat_users')
      .delete()
      .eq('username', username);

    if (error) {
      console.error('[DELETE] Error deleting user from Supabase:', error);
    }

    console.log(`[DELETE] User ${username} deleted by ${requester || 'unknown'} (role: ${requesterUser?.role})`);
    io.emit('user-deleted', username);
    io.emit('users-updated');
    res.json({ success: true, message: `User ${username} deleted` });
  } else {
    res.status(404).json({ success: false, message: 'User not found' });
  }
});

// REST API endpoint to update user role
app.put('/api/users/:username/role', async (req, res) => {
  const username = req.params.username;
  const { role } = req.body;
  const requester = req.headers['x-username'];

  // Check if requester is admin
  const requesterUser = registeredUsers.get(requester);
  const isAdmin = requesterUser && (requesterUser.role === 'admin' || requesterUser.role === 'superadmin');

  if (!isAdmin) {
    return res.status(403).json({ success: false, message: 'Only admins can change user roles' });
  }

  // Prevent superadmins from changing their own role
  if (requesterUser.role === 'superadmin' && requester === username) {
    return res.status(403).json({ success: false, message: 'Superadmins cannot change their own role' });
  }

  // Prevent changing superadmin role unless requester is also superadmin
  if (role === 'superadmin' && requesterUser.role !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'Only superadmins can grant superadmin role' });
  }

  // Validate role
  const validRoles = ['user', 'moderator', 'admin', 'superadmin'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role' });
  }

  const user = registeredUsers.get(username);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  // Update role in memory
  user.role = role;
  registeredUsers.set(username, user);

  // Update role in Supabase
  const { error } = await supabase
    .from('videochat_users')
    .update({ role })
    .eq('username', username);

  if (error) {
    console.error('[ROLE] Error updating user role in Supabase:', error);
    return res.status(500).json({ success: false, message: 'Error updating role' });
  }

  console.log(`[ROLE] User ${username} role changed to ${role} by ${requester}`);
  io.emit('users-updated');
  res.json({ success: true, message: `User ${username} role updated to ${role}` });
});

// REST API endpoint to mute/unmute user
app.put('/api/users/:username/mute', async (req, res) => {
  const username = req.params.username;
  const { isMuted, duration } = req.body;  // duration in minutes, 0 for permanent
  const requester = req.headers['x-username'];

  // Check if requester is admin or moderator
  const requesterUser = registeredUsers.get(requester);
  const isAdmin = requesterUser && (requesterUser.role === 'admin' || requesterUser.role === 'superadmin');
  const isModerator = requesterUser && requesterUser.role === 'moderator';

  if (!isAdmin && !isModerator) {
    return res.status(403).json({ success: false, message: 'Only admins and moderators can mute users' });
  }

  const user = registeredUsers.get(username);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  // Prevent muting admins/superadmins
  if (user.role === 'admin' || user.role === 'superadmin') {
    return res.status(403).json({ success: false, message: 'Cannot mute admins or superadmins' });
  }

  // Calculate mute until time
  const muteUntil = duration > 0 ? Date.now() + (duration * 60 * 1000) : 0;

  // Update user in memory
  user.isMuted = isMuted;
  user.muteUntil = muteUntil;
  registeredUsers.set(username, user);

  // Update user in Supabase
  const { error } = await supabase
    .from('videochat_users')
    .update({ is_muted: isMuted, mute_until: muteUntil })
    .eq('username', username);

  if (error) {
    console.error('[MUTE] Error updating user mute status in Supabase:', error);
    return res.status(500).json({ success: false, message: 'Error updating mute status' });
  }

  console.log(`[MUTE] User ${username} ${isMuted ? 'muted' : 'unmuted'} by ${requester} for ${duration} minutes`);
  io.emit('users-updated');

  // Notify user
  io.emit('user-muted', { username, isMuted, duration });

  res.json({ success: true, message: `User ${username} ${isMuted ? 'muted' : 'unmuted'}` });
});

// REST API endpoint to kick user from room
app.post('/api/users/:username/kick', async (req, res) => {
  const username = req.params.username;
  const { roomId } = req.body;
  const requester = req.headers['x-username'];

  // Check if requester is admin or moderator
  const requesterUser = registeredUsers.get(requester);
  const isAdmin = requesterUser && (requesterUser.role === 'admin' || requesterUser.role === 'superadmin');
  const isModerator = requesterUser && requesterUser.role === 'moderator';

  if (!isAdmin && !isModerator) {
    return res.status(403).json({ success: false, message: 'Only admins and moderators can kick users' });
  }

  const user = registeredUsers.get(username);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  // Prevent kicking admins/superadmins
  if (user.role === 'admin' || user.role === 'superadmin') {
    return res.status(403).json({ success: false, message: 'Cannot kick admins or superadmins' });
  }

  // Update user's kicked rooms in memory
  let kickedRooms = JSON.parse(user.kickedRooms || '[]');
  if (!kickedRooms.includes(roomId)) {
    kickedRooms.push(roomId);
    user.kickedRooms = JSON.stringify(kickedRooms);
    registeredUsers.set(username, user);
  }

  // Update user in Supabase
  const { error } = await supabase
    .from('videochat_users')
    .update({ kicked_rooms: user.kickedRooms })
    .eq('username', username);

  if (error) {
    console.error('[KICK] Error updating user kicked rooms in Supabase:', error);
    return res.status(500).json({ success: false, message: 'Error kicking user' });
  }

  console.log(`[KICK] User ${username} kicked from room ${roomId} by ${requester}`);

  // Force disconnect user from room
  io.to(roomId).emit('user-kicked', { username, roomId });

  // Find user's socket and disconnect from room
  io.sockets.sockets.forEach(socket => {
    if (socket.userName === username && socket.roomId === roomId) {
      socket.leave(roomId);
      socket.emit('kicked-from-room', { roomId });
    }
  });

  res.json({ success: true, message: `User ${username} kicked from room ${roomId}` });
});

// REST API endpoint to delete a message
app.delete('/api/messages/:messageId', (req, res) => {
  const messageId = req.params.messageId;
  const requester = req.headers['x-username'];

  // Check if requester is admin or moderator
  const requesterUser = registeredUsers.get(requester);
  const isAdmin = requesterUser && (requesterUser.role === 'admin' || requesterUser.role === 'superadmin');
  const isModerator = requesterUser && requesterUser.role === 'moderator';

  if (!isAdmin && !isModerator) {
    return res.status(403).json({ success: false, message: 'Only admins and moderators can delete messages' });
  }

  // Emit event to delete message on all clients
  io.emit('message-deleted', { messageId });

  console.log(`[DELETE MESSAGE] Message ${messageId} deleted by ${requester}`);
  res.json({ success: true, message: 'Message deleted' });
});

// REST API endpoint to force reload users from Supabase
app.post('/api/admin/reload-users', async (req, res) => {
  const requester = req.headers['x-username'];

  // Temporarily allow all users to reload for debugging
  // TODO: Restrict to admins only after fixing role issue
  console.log(`[RELOAD] Force reloading users from Supabase (requested by: ${requester})...`);

  const freshUsers = await loadUsersFromSupabase();

  // Replace registered users with fresh data
  registeredUsers.clear();
  freshUsers.forEach((user, username) => {
    registeredUsers.set(username, user);
  });

  console.log(`[RELOAD] Reloaded ${freshUsers.size} users from Supabase`);
  io.emit('users-updated');

  res.json({ success: true, message: `Reloaded ${freshUsers.size} users from Supabase` });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  console.log('Current rooms in store:', roomStore.size);

  // Handle user registration
  socket.on('user-registered', async ({ username, avatar, isOnline, password }) => {
    console.log(`[REGISTER] User: ${username}, online: ${isOnline}, hasPassword: ${!!password}, passwordLength: ${password?.length || 0}`);

    // Add to global registry with password
    const existingUser = registeredUsers.get(username);
    if (existingUser) {
      console.log(`[REGISTER] Existing user found, had password: ${!!existingUser.password}, passwordLength: ${existingUser.password?.length || 0}`);
      // Update existing user (reconnect case)
      const newPassword = password !== undefined && password !== null && password !== '' ? password : existingUser.password;
      console.log(`[REGISTER] Using password: ${newPassword === existingUser.password ? 'KEEPING OLD' : 'USING NEW'}, hasPassword: ${!!newPassword}`);
      registeredUsers.set(username, {
        ...existingUser,
        avatar: avatar || existingUser.avatar,
        password: newPassword,
        isOnline: isOnline || existingUser.isOnline,
        lastSeen: Date.now()
      });
      console.log(`[REGISTER] Updated existing user: ${username}, new hasPassword: ${!!registeredUsers.get(username).password}`);
    } else {
      // Create new user
      registeredUsers.set(username, {
        username: username,
        password: password,
        name: username,
        avatar: avatar,
        isOnline: isOnline || false,
        lastSeen: Date.now(),
        role: 'user'  // Default role for new users
      });
      console.log(`[REGISTER] Created new user: ${username}, hasPassword: ${!!password}`);
    }
    
    // Save to Supabase
    await saveUsersToSupabase();
    
    // Broadcast to all clients to refresh user list
    io.emit('users-updated');
  });

  // Handle user entering lobby (online but not in room)
  socket.on('user-online', ({ username, avatar }) => {
    console.log(`[ONLINE] User entered lobby: ${username}`);
    socket.userName = username;
    socket.userAvatar = avatar;

    // Update user status - preserve existing password
    const existingUser = registeredUsers.get(username);
    registeredUsers.set(username, {
      username: username,
      password: existingUser?.password || null,
      name: username,
      avatar: avatar,
      isOnline: true,
      socketId: socket.id,
      lastSeen: Date.now()
    });

    // Broadcast to all clients
    io.emit('users-updated');
  });

  socket.on('join-room', (roomId, userName, userAvatar, roomName, roomAvatar, callback) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userName = userName;
    socket.userAvatar = userAvatar;
    
    // Register/update user in global registry - preserve existing password
    const existingUser = registeredUsers.get(userName);
    registeredUsers.set(userName, {
      username: userName,
      password: existingUser?.password || null,
      name: userName,
      avatar: userAvatar,
      isOnline: true,
      socketId: socket.id,
      lastSeen: Date.now()
    });

    // Check if room exists in persistent store
    let storedRoom = roomStore.get(roomId);
    
    if (!rooms.has(roomId)) {
      // If room exists in store, use that name
      // Only create if room exists in persistent store OR roomName is provided (explicit creation)
      if (storedRoom || roomName) {
        const displayName = storedRoom ? storedRoom.name : (roomName || roomId);
        rooms.set(roomId, { 
          name: displayName, 
          users: new Set(), 
          screenSharingUsers: new Set(),
          channels: new Map([['general', { name: 'Общий', users: new Set() }]]) // Default channel
        });
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
    // Ensure channels Map exists - critical for channel system
    if (!room.channels) {
      room.channels = new Map();
    }
    // Always ensure general channel exists
    if (!room.channels.has('general')) {
      room.channels.set('general', { name: 'Общий', users: new Set() });
    }

    // ALWAYS load channels from stored room data - for new and existing rooms
    // This ensures all users see the same channels
    if (storedRoom && storedRoom.channels) {
      const channelCount = Object.keys(storedRoom.channels).length;
      console.log(`[CHANNELS] Loading ${channelCount} channels from stored room ${roomId}`);
      console.log(`[CHANNELS] Current room.channels size before loading: ${room.channels.size}`);
      Object.entries(storedRoom.channels).forEach(([channelId, channelData]) => {
        if (!room.channels.has(channelId)) {
          room.channels.set(channelId, {
            name: channelData.name,
            users: new Set(),
            createdBy: channelData.createdBy,
            createdAt: channelData.createdAt
          });
          console.log(`[CHANNELS] Loaded channel "${channelData.name}" (${channelId}) into room ${roomId}`);
        } else {
          console.log(`[CHANNELS] Channel "${channelData.name}" (${channelId}) already exists in room ${roomId}`);
        }
      });
      console.log(`[CHANNELS] room.channels size after loading: ${room.channels.size}`);
    } else {
      console.log(`[CHANNELS] No stored channels found for room ${roomId} (storedRoom: ${storedRoom ? 'exists' : 'null'})`);
    }
    // Deduplicate: remove any existing entry with same socket.id OR same username (reconnect case)
    const existingBySocketId = Array.from(room.users).find(u => u.id === socket.id);
    if (existingBySocketId) {
      room.users.delete(existingBySocketId);
      console.log(`[DEDUP] Removed duplicate room.users entry for socket ${socket.id}`);
    }
    const existingByName = Array.from(room.users).find(u => u.name === userName);
    if (existingByName) {
      room.users.delete(existingByName);
      console.log(`[DEDUP] Removed stale room.users entry for username ${userName} (old socket: ${existingByName.id})`);
    }
    room.users.add({ id: socket.id, name: userName, avatar: userAvatar });
    
    // Join default channel
    socket.currentChannel = 'general';
    const generalChannel = room.channels.get('general');
    if (generalChannel) {
      // Deduplicate channel users by socket.id and username
      const existingChannelBySocket = Array.from(generalChannel.users).find(u => u.id === socket.id);
      if (existingChannelBySocket) {
        generalChannel.users.delete(existingChannelBySocket);
      }
      const existingChannelByName = Array.from(generalChannel.users).find(u => u.name === userName);
      if (existingChannelByName) {
        generalChannel.users.delete(existingChannelByName);
      }
      generalChannel.users.add({ id: socket.id, name: userName });
    }
    
    // Also clean stale entries from ALL channels (user may have been in a non-general channel before reconnect)
    if (room.channels) {
      room.channels.forEach((channel, channelId) => {
        if (channelId === 'general') return; // Already handled above
        const staleByName = Array.from(channel.users).find(u => u.name === userName);
        if (staleByName) {
          channel.users.delete(staleByName);
          console.log(`[DEDUP] Removed stale entry for ${userName} from channel ${channelId}`);
        }
      });
    }
    
    // Update screenSharingUsers if this user was screen sharing before reconnect
    if (room.screenSharingUsers) {
      room.users.forEach(u => {
        if (u.name === userName && u.id !== socket.id && room.screenSharingUsers.has(u.id)) {
          room.screenSharingUsers.delete(u.id);
          room.screenSharingUsers.add(socket.id);
          console.log(`[SCREEN] Updated screenSharingUsers for ${userName}: ${u.id} -> ${socket.id}`);
        }
      });
    }
    
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
    
    // Broadcast user list update (online status changed)
    io.emit('users-updated');

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
    
    // Send callback for reconnect support
    if (callback) callback({ success: true });
  });
  
  socket.on('get-available-rooms', (callback) => {
    const availableRooms = Array.from(roomStore.values()).map(r => {
      // Check if room has active users - deduplicate by name
      const activeRoom = rooms.get(r.id);
      const uniqueNames = activeRoom ? [...new Set(Array.from(activeRoom.users).map(u => u.name))] : [];
      return {
        id: r.id,
        name: r.name,
        avatar: r.avatar,
        creator: r.creator,
        active: uniqueNames.length > 0,
        userCount: uniqueNames.length
      };
    });
    callback(availableRooms);
  });
  
  socket.on('get-room-info', (roomId, callback) => {
    const storedRoom = roomStore.get(roomId);
    if (storedRoom) {
      const activeRoom = rooms.get(roomId);
      const uniqueNames = activeRoom ? [...new Set(Array.from(activeRoom.users).map(u => u.name))] : [];
      callback({
        id: storedRoom.id,
        name: storedRoom.name,
        avatar: storedRoom.avatar,
        creator: storedRoom.creator,
        active: uniqueNames.length > 0,
        userCount: uniqueNames.length
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
    const messageData = {
      sender: socket.userName,
      text: message,
      time: new Date().toLocaleTimeString(),
      timestamp: Date.now()
    };
    
    // Save to room message history
    if (socket.roomId && rooms.has(socket.roomId)) {
      const room = rooms.get(socket.roomId);
      if (!room.messages) room.messages = [];
      room.messages.push(messageData);
      // Keep only last 100 messages
      if (room.messages.length > 100) {
        room.messages.shift();
      }
    }
    
    socket.to(socket.roomId).emit('chat-message', messageData);
  });
  
  // Handle request for room message history
  socket.on('get-room-messages', (roomId, callback) => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      callback(room.messages || []);
    } else {
      callback([]);
    }
  });

  socket.on('screen-share-started', () => {
    // Track this user as screen sharing
    if (socket.roomId && rooms.has(socket.roomId)) {
      const room = rooms.get(socket.roomId);
      if (!room.screenSharingUsers) {
        room.screenSharingUsers = new Set();
      }
      // Deduplicate: remove old socket.id for this username (reconnect case)
      room.users.forEach(u => {
        if (u.name === socket.userName && u.id !== socket.id) {
          room.screenSharingUsers.delete(u.id);
          console.log(`[SCREEN] Removed old screen share entry for ${socket.userName} (old socket: ${u.id})`);
        }
      });
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

  // Handle user mute state changes
  socket.on('user-mute-state', ({ roomId, isMicMuted, isSoundMuted }) => {
    // Broadcast to other users in room
    socket.to(roomId).emit('user-mute-state', {
      userId: socket.id,
      isMicMuted: isMicMuted,
      isSoundMuted: isSoundMuted
    });
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
      // Find and remove user from room.users Set
      const userToRemove = Array.from(room.users).find(u => u.id === socket.id);
      if (userToRemove) {
        room.users.delete(userToRemove);
        console.log(`User ${socket.userName} removed from room ${roomId}`);
      }
      // Remove from ALL channel.users Sets
      if (room.channels) {
        room.channels.forEach((channel, channelId) => {
          const channelUser = Array.from(channel.users).find(u => u.id === socket.id);
          if (channelUser) {
            channel.users.delete(channelUser);
            console.log(`[CHANNEL] Removed ${socket.userName} from channel ${channelId} on leave-room`);
          }
        });
      }
      if (room.users.size === 0) {
        rooms.delete(roomId);
        // Don't delete from roomStore so room persists for rejoining
      }
      socket.to(roomId).emit('user-left', socket.id);
      
      // Broadcast updated channel counts after user removal
      if (room.channels && room.users.size > 0) {
        const updatedChannels = Array.from(room.channels.entries()).map(([id, ch]) => ({
          channelId: id,
          channelName: ch.name,
          userCount: ch.users ? ch.users.size : 0,
          isGeneral: id === 'general'
        }));
        io.to(roomId).emit('channels-updated', updatedChannels);
      }
      
      // Notify all clients to refresh room list (for lobby users)
      io.emit('rooms-updated');
      
      // Broadcast user list update (online status changed)
      io.emit('users-updated');
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

  // Handle user deletion request
  socket.on('delete-user', (username, callback) => {
    if (registeredUsers.has(username)) {
      registeredUsers.delete(username);
      console.log(`[DELETE] User ${username} deleted by ${socket.userName}`);
      io.emit('user-deleted', username);
      io.emit('users-updated');
      if (callback) callback({ success: true });
    } else {
      if (callback) callback({ success: false, error: 'User not found' });
    }
  });

  // ========== CHANNEL/SUBGROUP MANAGEMENT ==========
  
  // Create a new channel in the room
  socket.on('create-channel', (channelName, callback) => {
    console.log(`[CHANNEL] create-channel called by ${socket.userName}, roomId: ${socket.roomId}, name: ${channelName}`);
    
    try {
      if (!socket.roomId) {
        console.log(`[CHANNEL] Error: socket.roomId is undefined`);
        if (callback) callback({ success: false, error: 'Not in a room' });
        return;
      }
      
      if (!rooms.has(socket.roomId)) {
        console.log(`[CHANNEL] Error: room ${socket.roomId} not found`);
        if (callback) callback({ success: false, error: 'Room not found' });
        return;
      }
      
      const room = rooms.get(socket.roomId);
      
      // Ensure channels exists
      if (!room.channels) {
        console.log(`[CHANNEL] Creating channels Map for room ${socket.roomId}`);
        room.channels = new Map([['general', { name: 'Общий', users: new Set() }]]);
      }
      
      const channelId = 'ch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      
      room.channels.set(channelId, {
        name: channelName,
        users: new Set(),
        createdBy: socket.userName,
        createdAt: Date.now()
      });
      
      console.log(`[CHANNEL] ${socket.userName} created channel "${channelName}" (${channelId}) in room ${socket.roomId}`);
      
      // Save channels to roomStore for persistence
      const storedRoom = roomStore.get(socket.roomId);
      if (storedRoom) {
        if (!storedRoom.channels) storedRoom.channels = {};
        storedRoom.channels[channelId] = {
          name: channelName,
          createdBy: socket.userName,
          createdAt: Date.now()
        };
        saveRoomsToFile();
        console.log(`[CHANNEL] Saved channel "${channelName}" to roomStore`);
      }
      
      // Notify all users in room about new channel
      io.to(socket.roomId).emit('channel-created', {
        channelId,
        channelName,
        createdBy: socket.userName
      });
      
      if (callback) callback({ success: true, channelId, channelName });
    } catch (err) {
      console.error(`[CHANNEL] Error creating channel:`, err);
      if (callback) callback({ success: false, error: 'Server error: ' + err.message });
    }
  });
  
  // Join a channel
  socket.on('join-channel', (channelId, callback) => {
    console.log(`[CHANNEL] join-channel called by ${socket.userName}, roomId: ${socket.roomId}, channelId: ${channelId}`);
    
    try {
      // Try to recover roomId from socket.rooms if socket.roomId is not set
      if (!socket.roomId && socket.rooms) {
        for (const room of socket.rooms) {
          if (room !== socket.id && rooms.has(room)) {
            socket.roomId = room;
            console.log(`[CHANNEL] Recovered roomId from socket.rooms: ${room}`);
            break;
          }
        }
      }
      
      if (!socket.roomId) {
        console.log(`[CHANNEL] Error: socket.roomId is undefined`);
        if (callback) callback({ success: false, error: 'Not in a room' });
        return;
      }
      
      if (!rooms.has(socket.roomId)) {
        console.log(`[CHANNEL] Error: room ${socket.roomId} not found`);
        if (callback) callback({ success: false, error: 'Room not found' });
        return;
      }
      
      const room = rooms.get(socket.roomId);
      
      // Ensure channels exists
      if (!room.channels) {
        console.log(`[CHANNEL] Creating channels Map for room ${socket.roomId}`);
        room.channels = new Map([['general', { name: 'Общий', users: new Set() }]]);
      }
      
      if (!room.channels.has(channelId)) {
        console.log(`[CHANNEL] Error: channel ${channelId} not found`);
        if (callback) callback({ success: false, error: 'Channel not found' });
        return;
      }
      
      // Leave current channel
      if (socket.currentChannel && room.channels.has(socket.currentChannel)) {
        const oldChannel = room.channels.get(socket.currentChannel);
        const oldUser = Array.from(oldChannel.users).find(u => u.id === socket.id);
        if (oldUser) oldChannel.users.delete(oldUser);
      }
      
      // Join new channel
      const channel = room.channels.get(channelId);
      // Deduplicate: remove existing entry with same socket.id
      const existingInChannel = Array.from(channel.users).find(u => u.id === socket.id);
      if (existingInChannel) {
        channel.users.delete(existingInChannel);
        console.log(`[CHANNEL] Dedup: removed existing entry for socket ${socket.id} in channel ${channelId}`);
      }
      channel.users.add({ id: socket.id, name: socket.userName });
      
      // Store old channel for notification
      const oldChannelId = socket.currentChannel;
      socket.currentChannel = channelId;
      socket.join(`${socket.roomId}_${channelId}`); // Join channel-specific room
      
      console.log(`[CHANNEL] ${socket.userName} joined channel "${channel.name}" (${channelId})`);
      
      // Notify old channel users that user left
      if (oldChannelId && oldChannelId !== channelId) {
        io.to(`${socket.roomId}_${oldChannelId}`).emit('user-left-channel', {
          userId: socket.id,
          userName: socket.userName,
          channelId: oldChannelId
        });
      }
      
      // Notify new channel users that user joined
      io.to(`${socket.roomId}_${channelId}`).emit('user-joined-channel', {
        userId: socket.id,
        userName: socket.userName,
        channelId,
        channelName: channel.name
      });
      
      // Send list of users in this channel (include current user)
      const channelUsers = Array.from(channel.users).map(u => ({
        userId: u.id,
        userName: u.name
      }));
      
      // Ensure current user is in the list
      if (!channelUsers.find(u => u.userId === socket.id)) {
        channelUsers.push({
          userId: socket.id,
          userName: socket.userName
        });
      }
      
      console.log(`[CHANNEL] Sending ${channelUsers.length} users in channel ${channelId}:`, channelUsers.map(u => u.userName));
      if (callback) callback({ success: true, channelName: channel.name, channelUsers });
      
      // Broadcast updated channel counts to all users in room
      const updatedChannels = Array.from(room.channels.entries()).map(([id, ch]) => ({
        channelId: id,
        channelName: ch.name,
        userCount: ch.users ? ch.users.size : 0,
        isGeneral: id === 'general'
      }));
      io.to(socket.roomId).emit('channels-updated', updatedChannels);
    } catch (err) {
      console.error(`[CHANNEL] Error in join-channel:`, err);
      if (callback) callback({ success: false, error: 'Server error: ' + err.message });
    }
  });
  
  // Leave a channel
  socket.on('leave-channel', (channelId, callback) => {
    if (!socket.roomId || !rooms.has(socket.roomId)) return;
    
    const room = rooms.get(socket.roomId);
    if (!room.channels.has(channelId)) return;
    
    const channel = room.channels.get(channelId);
    const user = Array.from(channel.users).find(u => u.id === socket.id);
    if (user) {
      channel.users.delete(user);
      socket.leave(`${socket.roomId}_${channelId}`);
    }
    
    if (socket.currentChannel === channelId) {
      socket.currentChannel = 'general';
      const generalChannel = room.channels.get('general');
      if (generalChannel) {
        // Deduplicate before adding
        const existingInGeneral = Array.from(generalChannel.users).find(u => u.id === socket.id);
        if (existingInGeneral) generalChannel.users.delete(existingInGeneral);
        generalChannel.users.add({ id: socket.id, name: socket.userName });
        socket.join(`${socket.roomId}_general`);
      }
    }
    
    if (callback) callback({ success: true });
    
    // Broadcast updated channel counts to all users in room
    const updatedChannels = Array.from(room.channels.entries()).map(([id, ch]) => ({
      channelId: id,
      channelName: ch.name,
      userCount: ch.users ? ch.users.size : 0,
      isGeneral: id === 'general'
    }));
    io.to(socket.roomId).emit('channels-updated', updatedChannels);
  });
  
  // Get list of channels in current room
  socket.on('get-channels', (callback) => {
    console.log(`[CHANNELS] get-channels called by ${socket.userName}, roomId: ${socket.roomId}, socket.rooms:`, socket.rooms ? Array.from(socket.rooms) : 'undefined');
    
    // Try to recover roomId from socket.rooms if socket.roomId is not set
    if (!socket.roomId && socket.rooms) {
      for (const room of socket.rooms) {
        if (room !== socket.id) { // Skip default room (socket.id)
          socket.roomId = room;
          console.log(`[CHANNELS] Recovered roomId from socket.rooms: ${room}`);
          break;
        }
      }
    }
    
    if (!socket.roomId) {
      console.log(`[CHANNELS] Error: socket.roomId is undefined`);
      if (callback) callback({ success: false, error: 'Not in a room', channels: [] });
      return;
    }
    
    if (!rooms.has(socket.roomId)) {
      console.log(`[CHANNELS] Error: room ${socket.roomId} not found`);
      if (callback) callback({ success: false, error: 'Room not found', channels: [] });
      return;
    }
    
    const room = rooms.get(socket.roomId);

    // Ensure channels exists
    if (!room.channels) {
      console.log(`[CHANNELS] Creating channels Map for room ${socket.roomId}`);
      room.channels = new Map([['general', { name: 'Общий', users: new Set() }]]);
    }

    // DEBUG: Log detailed channel info
    console.log(`[CHANNELS DEBUG] room.channels size: ${room.channels.size}`);
    console.log(`[CHANNELS DEBUG] room.channels entries:`, Array.from(room.channels.keys()));

    // Check stored room channels
    const storedRoom = roomStore.get(socket.roomId);
    if (storedRoom) {
      console.log(`[CHANNELS DEBUG] storedRoom exists: true`);
      console.log(`[CHANNELS DEBUG] storedRoom.channels:`, storedRoom.channels ? Object.keys(storedRoom.channels) : 'undefined');
    } else {
      console.log(`[CHANNELS DEBUG] storedRoom exists: false`);
    }

    const channels = Array.from(room.channels.entries()).map(([id, ch]) => ({
      channelId: id,
      channelName: ch.name,
      userCount: ch.users ? ch.users.size : 0,
      isGeneral: id === 'general',
      channelUsers: ch.users ? Array.from(ch.users).map(u => ({ userId: u.id, userName: u.name })) : []
    }));

    console.log(`[CHANNELS] Returning ${channels.length} channels for room ${socket.roomId}`);
    if (callback) callback({ success: true, channels, currentChannel: socket.currentChannel || 'general' });
  });
  
  // Channel-specific chat message
  socket.on('channel-message', (channelId, message) => {
    if (!socket.roomId || !rooms.has(socket.roomId)) return;
    if (!socket.currentChannel || socket.currentChannel !== channelId) return;
    
    const room = rooms.get(socket.roomId);
    if (!room.channels.has(channelId)) return;
    
    const channel = room.channels.get(channelId);
    
    io.to(`${socket.roomId}_${channelId}`).emit('channel-message', {
      sender: socket.userName,
      text: message,
      channelId,
      channelName: channel.name,
      time: new Date().toLocaleTimeString()
    });
  });

  socket.on('disconnect', () => {
    console.log(`[DISCONNECT] User: ${socket.userName}, socketId: ${socket.id}`);
    // Mark user as offline in registered users
    if (socket.userName && registeredUsers.has(socket.userName)) {
      const user = registeredUsers.get(socket.userName);
      user.isOnline = false;
      user.lastSeen = Date.now();
      registeredUsers.set(socket.userName, user);
    }
    
    if (socket.roomId && rooms.has(socket.roomId)) {
      const room = rooms.get(socket.roomId);
      // Find and remove user from room.users Set
      const userToRemove = Array.from(room.users).find(u => u.id === socket.id);
      if (userToRemove) {
        room.users.delete(userToRemove);
        console.log(`User ${socket.userName} removed from room ${socket.roomId} on disconnect`);
      }
      // Remove from ALL channel.users Sets
      if (room.channels) {
        room.channels.forEach((channel, channelId) => {
          const channelUser = Array.from(channel.users).find(u => u.id === socket.id);
          if (channelUser) {
            channel.users.delete(channelUser);
            console.log(`[CHANNEL] Removed ${socket.userName} from channel ${channelId} on disconnect`);
          }
        });
      }
      // Remove from screen sharing tracking
      if (room.screenSharingUsers) {
        room.screenSharingUsers.delete(socket.id);
      }
      if (room.users.size === 0) {
        rooms.delete(socket.roomId);
      }
      socket.to(socket.roomId).emit('user-left', socket.id);
      
      // Broadcast updated channel counts after user removal
      if (room.channels && room.users.size > 0) {
        const updatedChannels = Array.from(room.channels.entries()).map(([id, ch]) => ({
          channelId: id,
          channelName: ch.name,
          userCount: ch.users ? ch.users.size : 0,
          isGeneral: id === 'general'
        }));
        io.to(socket.roomId).emit('channels-updated', updatedChannels);
      }
      
      // Notify all clients to refresh room list (for lobby users)
      io.emit('rooms-updated');
    }
    
    // Broadcast user list update (online status changed)
    io.emit('users-updated');
    
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Videochat server running on port ${PORT}`);
});
