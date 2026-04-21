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

async function loadRoomsFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('videochat_rooms')
      .select('*');

    if (error) {
      console.error('[ROOMS] Error loading rooms from Supabase:', error);
      return new Map();
    }

    const map = new Map();
    data.forEach(r => {
      map.set(r.id, {
        id: r.id,
        name: r.name,
        avatar: r.avatar,
        creator: r.creator,
        created: r.created,
        channels: r.channels || { general: { name: 'Общий', users: [] } }
      });
    });

    console.log(`[ROOMS] Loaded ${data.length} rooms from Supabase`);
    return map;
  } catch (err) {
    console.error('[ROOMS] Error loading rooms from Supabase:', err);
    return new Map();
  }
}

async function saveRoomsToSupabase() {
  try {
    const roomsArray = Array.from(roomStore.values());

    // Convert to Supabase format
    const supabaseRooms = roomsArray.map(r => ({
      id: r.id,
      name: r.name,
      avatar: r.avatar,
      creator: r.creator,
      created: r.created,
      channels: r.channels || { general: { name: 'Общий', users: [] } }
    }));

    // Use upsert to insert or update
    const { data, error } = await supabase
      .from('videochat_rooms')
      .upsert(supabaseRooms, { onConflict: 'id' });

    if (error) {
      console.error('[ROOMS] Error saving rooms to Supabase:', error);
    } else {
      console.log(`[ROOMS] Saved ${roomsArray.length} rooms to Supabase`);
    }
  } catch (err) {
    console.error('[ROOMS] Error saving rooms to Supabase:', err);
  }
}

async function deleteRoomFromSupabase(roomId) {
  try {
    console.log(`[ROOMS] Deleting room ${roomId} from Supabase`);
    const { error } = await supabase
      .from('videochat_rooms')
      .delete()
      .eq('id', roomId);

    if (error) {
      console.error(`[ROOMS] Error deleting room ${roomId} from Supabase:`, error);
      return false;
    } else {
      console.log(`[ROOMS] Successfully deleted room ${roomId} from Supabase`);
      return true;
    }
  } catch (err) {
    console.error(`[ROOMS] Error deleting room ${roomId} from Supabase:`, err);
    return false;
  }
}

async function loadVIPChannelsFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('videochat_vip_channels')
      .select('*');

    if (error) {
      console.error('[VIP] Error loading VIP channels from Supabase:', error);
      return [];
    }

    const channels = data.map(c => ({
      id: c.id,
      name: c.name,
      password: c.password,
      creator: c.creator,
      created: c.created
    }));

    console.log(`[VIP] Loaded ${channels.length} VIP channels from Supabase`);
    return channels;
  } catch (err) {
    console.error('[VIP] Error loading VIP channels from Supabase:', err);
    return [];
  }
}

async function saveVIPChannelToSupabase(channel) {
  try {
    const supabaseChannel = {
      id: channel.id,
      name: channel.name,
      password: channel.password,
      creator: channel.creator,
      created: channel.created
    };

    const { data, error } = await supabase
      .from('videochat_vip_channels')
      .upsert(supabaseChannel, { onConflict: 'id' });

    if (error) {
      console.error('[VIP] Error saving VIP channel to Supabase:', error);
      return false;
    }

    console.log(`[VIP] Saved VIP channel ${channel.name} to Supabase`);
    return true;
  } catch (err) {
    console.error('[VIP] Error saving VIP channel to Supabase:', err);
    return false;
  }
}

async function deleteVIPChannelFromSupabase(channelId) {
  try {
    const { error } = await supabase
      .from('videochat_vip_channels')
      .delete()
      .eq('id', channelId);

    if (error) {
      console.error('[VIP] Error deleting VIP channel from Supabase:', error);
      return false;
    }

    console.log(`[VIP] Deleted VIP channel ${channelId} from Supabase`);
    return true;
  } catch (err) {
    console.error('[VIP] Error deleting VIP channel from Supabase:', err);
    return false;
  }
}

const roomStore = new Map();
const registeredUsers = new Map();

// Load rooms from Supabase asynchronously
loadRoomsFromSupabase().then(rooms => {
  // Copy all rooms to roomStore
  rooms.forEach((value, key) => roomStore.set(key, value));
  console.log('========================================');
  console.log('[VERSION] Server v3.1 - Supabase room & user persistence enabled');
  console.log('========================================');
}).catch(err => {
  console.error('[ROOMS] Failed to load rooms from Supabase, falling back to file:', err);
  const fileRooms = loadRoomsFromFile();
  fileRooms.forEach((value, key) => roomStore.set(key, value));
  console.log('========================================');
  console.log('[VERSION] Server v3.1 - Loaded rooms from file as fallback');
  console.log('========================================');
});

// Load users from Supabase asynchronously
loadUsersFromSupabase().then(users => {
  // Copy all users to registeredUsers
  users.forEach((value, key) => registeredUsers.set(key, value));
  console.log('========================================');
  console.log('[USERS] Loaded users from Supabase');
  console.log('========================================');
}).catch(err => {
  console.error('[USERS] Failed to load users from Supabase:', err);
  console.log('========================================');
  console.log('[VERSION] Server v3.1 - Starting with empty user registry');
  console.log('========================================');
});

// REST API endpoint to create room
app.post('/api/rooms', async (req, res) => {
  const { id, name, avatar } = req.body;
  const creator = req.headers['x-username'];

  if (!id || !name) {
    return res.status(400).json({ success: false, message: 'Room ID and name are required' });
  }

  if (!creator) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const newRoom = {
    id,
    name,
    avatar: avatar || null,
    creator,
    created: Date.now()
  };

  roomStore.set(id, newRoom);
  await saveRoomsToSupabase();

  io.emit('room-created', newRoom);
  io.emit('rooms-updated');

  console.log(`[CREATE API] Room ${id} created by ${creator}`);
  res.json({ success: true, room: newRoom });
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
app.get('/api/users', async (req, res) => {
  try {
    // Fetch fresh data from Supabase
    const { data, error } = await supabase
      .from('videochat_users')
      .select('*');

    if (error) {
      console.error('[API] Error fetching users from Supabase:', error);
      // Fallback to memory cache
      const users = Array.from(registeredUsers.values()).map(u => ({
        username: u.username,
        name: u.name,
        avatar: u.avatar,
        isOnline: u.isOnline,
        lastSeen: u.lastSeen,
        role: u.role || 'user'
      }));
      res.json(users);
      return;
    }

    console.log('[API] Fetched users from Supabase:', data.map(u => ({ username: u.username, role: u.role })));

    // Map Supabase data to API format, merging with online status from memory
    const users = data.map(su => {
      const memoryUser = registeredUsers.get(su.username);
      return {
        username: su.username,
        name: su.name,
        avatar: su.avatar,
        isOnline: memoryUser ? memoryUser.isOnline : su.is_online,
        lastSeen: memoryUser ? memoryUser.lastSeen : su.last_seen,
        role: su.role || 'user',
        isMuted: su.is_muted || false,
        muteUntil: su.mute_until || 0,
        kickedRooms: su.kicked_rooms || '[]'
      };
    });

    console.log('[API] Returning users to client:', users.map(u => ({ username: u.username, role: u.role })));
    res.json(users);
  } catch (err) {
    console.error('[API] Error in /api/users:', err);
    res.status(500).json({ error: 'Error fetching users' });
  }
});

// REST API endpoint to check if user exists
app.get('/api/users/:username', (req, res) => {
  const username = req.params.username;
  const exists = registeredUsers.has(username);
  res.json({ exists, username });
});

// REST API endpoint for user login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  console.log(`[LOGIN] Attempt: username=${username}, hasPassword=${!!password}, passwordLength=${password?.length || 0}`);

  // First check cached users in memory
  let user = registeredUsers.get(username);

  // If user not found or role might be outdated, fetch fresh from Supabase
  if (!user) {
    console.log(`[LOGIN] User not found in cache, fetching from Supabase...`);
    try {
      const { data, error } = await supabase
        .from('videochat_users')
        .select('*')
        .eq('username', username)
        .single();

      if (error) {
        console.error('[LOGIN] Error fetching from Supabase:', error);
      } else if (data) {
        // Update cache with fresh data
        registeredUsers.set(username, {
          username: data.username,
          password: data.password,
          name: data.name,
          avatar: data.avatar,
          isOnline: data.is_online,
          lastSeen: data.last_seen,
          role: data.role || 'user',
          isMuted: data.is_muted || false,
          muteUntil: data.mute_until || 0,
          kickedRooms: data.kicked_rooms || '[]'
        });
        user = registeredUsers.get(username);
        console.log(`[LOGIN] Loaded fresh user from Supabase: role=${user.role}`);
      }
    } catch (err) {
      console.error('[LOGIN] Error fetching from Supabase:', err);
    }
  }

  console.log(`[LOGIN] User found in registry: ${!!user}, hasPassword: ${!!user?.password}, passwordLength=${user?.password?.length || 0}, role=${user?.role}`);

  if (user && user.password === password) {
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
  console.log(`[DELETE API] Requester header: '${requester}'`);

  // Fetch fresh data from Supabase to verify requester role
  const { data: requesterData, error: requesterError } = await supabase
    .from('videochat_users')
    .select('role')
    .eq('username', requester)
    .single();
  console.log(`[DELETE API] Requester data from DB:`, requesterData, 'Error:', requesterError);

  if (requesterError || !requesterData) {
    return res.status(403).json({ success: false, message: 'Requester not found' });
  }

  const isAdmin = requesterData.role === 'admin' || requesterData.role === 'superadmin';
  console.log(`[DELETE API] isAdmin check: ${isAdmin}, role: ${requesterData.role}`);

  // Only allow deletion if requester is admin
  if (!isAdmin) {
    console.log(`[DELETE API] REJECTED: requester ${requester} is not admin (role: ${requesterData.role})`);
    return res.status(403).json({ success: false, message: 'Only admins can delete users' });
  }

  // Fetch target user data to check if it's superadmin
  const { data: targetUser, error: targetError } = await supabase
    .from('videochat_users')
    .select('role')
    .eq('username', username)
    .single();

  if (targetError || !targetUser) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  // Prevent deleting superadmins
  if (targetUser.role === 'superadmin') {
    return res.status(403).json({ success: false, message: 'Cannot delete superadmins' });
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

    console.log(`[DELETE] User ${username} deleted by ${requester || 'unknown'} (role: ${requesterData.role})`);
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
  console.log(`[ROLE API] Requester header: '${requester}', target: ${username}, new role: ${role}`);

  // Fetch fresh data from Supabase to verify requester role
  const { data: requesterData, error: requesterError } = await supabase
    .from('videochat_users')
    .select('role')
    .eq('username', requester)
    .single();
  console.log(`[ROLE API] Requester data from DB:`, requesterData, 'Error:', requesterError);

  if (requesterError || !requesterData) {
    return res.status(403).json({ success: false, message: 'Requester not found' });
  }

  const isAdmin = requesterData.role === 'admin' || requesterData.role === 'superadmin';
  console.log(`[ROLE API] isAdmin check: ${isAdmin}, role: ${requesterData.role}`);

  if (!isAdmin) {
    console.log(`[ROLE API] REJECTED: requester ${requester} is not admin (role: ${requesterData.role})`);
    return res.status(403).json({ success: false, message: 'Only admins can change user roles' });
  }

  // Prevent superadmins from changing their own role
  if (requesterData.role === 'superadmin' && requester === username) {
    return res.status(403).json({ success: false, message: 'Superadmins cannot change their own role' });
  }

  // Prevent changing superadmin role unless requester is also superadmin
  if (role === 'superadmin' && requesterData.role !== 'superadmin') {
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

  // Fetch fresh data from Supabase to verify requester role
  const { data: requesterData, error: requesterError } = await supabase
    .from('videochat_users')
    .select('role')
    .eq('username', requester)
    .single();

  if (requesterError || !requesterData) {
    return res.status(403).json({ success: false, message: 'Requester not found' });
  }

  const isAdmin = requesterData.role === 'admin' || requesterData.role === 'superadmin';
  const isModerator = requesterData.role === 'moderator';

  if (!isAdmin && !isModerator) {
    return res.status(403).json({ success: false, message: 'Only admins and moderators can mute users' });
  }

  // Fetch target user data from Supabase
  const { data: targetUser, error: targetError } = await supabase
    .from('videochat_users')
    .select('*')
    .eq('username', username)
    .single();

  if (targetError || !targetUser) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  // Prevent muting admins/superadmins
  if (targetUser.role === 'admin' || targetUser.role === 'superadmin') {
    return res.status(403).json({ success: false, message: 'Cannot mute admins or superadmins' });
  }

  // Calculate mute until time
  const muteUntil = duration > 0 ? Date.now() + (duration * 60 * 1000) : 0;

  // Update user in memory
  const memoryUser = registeredUsers.get(username);
  if (memoryUser) {
    memoryUser.isMuted = isMuted;
    memoryUser.muteUntil = muteUntil;
    registeredUsers.set(username, memoryUser);
  }

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

  // Fetch fresh data from Supabase to verify requester role
  const { data: requesterData, error: requesterError } = await supabase
    .from('videochat_users')
    .select('role')
    .eq('username', requester)
    .single();

  if (requesterError || !requesterData) {
    return res.status(403).json({ success: false, message: 'Requester not found' });
  }

  const isAdmin = requesterData.role === 'admin' || requesterData.role === 'superadmin';
  const isModerator = requesterData.role === 'moderator';

  if (!isAdmin && !isModerator) {
    return res.status(403).json({ success: false, message: 'Only admins and moderators can kick users' });
  }

  // Fetch target user data from Supabase
  const { data: targetUser, error: targetError } = await supabase
    .from('videochat_users')
    .select('*')
    .eq('username', username)
    .single();

  if (targetError || !targetUser) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  // Prevent kicking admins/superadmins
  if (targetUser.role === 'admin' || targetUser.role === 'superadmin') {
    return res.status(403).json({ success: false, message: 'Cannot kick admins or superadmins' });
  }

  // Update user's kicked rooms in memory
  const memoryUser = registeredUsers.get(username);
  let kickedRooms = memoryUser ? JSON.parse(memoryUser.kickedRooms || '[]') : JSON.parse(targetUser.kicked_rooms || '[]');
  if (!kickedRooms.includes(roomId)) {
    kickedRooms.push(roomId);
    if (memoryUser) {
      memoryUser.kickedRooms = JSON.stringify(kickedRooms);
      registeredUsers.set(username, memoryUser);
    }
  }

  // Update user in Supabase
  const { error } = await supabase
    .from('videochat_users')
    .update({ kicked_rooms: JSON.stringify(kickedRooms) })
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

// REST API endpoint to unkick user from room
app.post('/api/users/:username/unkick', async (req, res) => {
  const username = req.params.username;
  const { roomId } = req.body;
  const requester = req.headers['x-username'];

  // Fetch fresh data from Supabase to verify requester role
  const { data: requesterData, error: requesterError } = await supabase
    .from('videochat_users')
    .select('role')
    .eq('username', requester)
    .single();

  if (requesterError || !requesterData) {
    return res.status(403).json({ success: false, message: 'Requester not found' });
  }

  const isAdmin = requesterData.role === 'admin' || requesterData.role === 'superadmin';

  if (!isAdmin) {
    return res.status(403).json({ success: false, message: 'Only admins can unkick users' });
  }

  // Fetch target user data from Supabase
  const { data: targetUser, error: targetError } = await supabase
    .from('videochat_users')
    .select('*')
    .eq('username', username)
    .single();

  if (targetError || !targetUser) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  // Update user's kicked rooms in memory
  const memoryUser = registeredUsers.get(username);
  let kickedRooms = memoryUser ? JSON.parse(memoryUser.kickedRooms || '[]') : JSON.parse(targetUser.kicked_rooms || '[]');
  const index = kickedRooms.indexOf(roomId);
  if (index > -1) {
    kickedRooms.splice(index, 1);
    if (memoryUser) {
      memoryUser.kickedRooms = JSON.stringify(kickedRooms);
      registeredUsers.set(username, memoryUser);
    }
  }

  // Update user in Supabase
  const { error } = await supabase
    .from('videochat_users')
    .update({ kicked_rooms: JSON.stringify(kickedRooms) })
    .eq('username', username);

  if (error) {
    console.error('[UNKICK] Error updating user kicked rooms in Supabase:', error);
    return res.status(500).json({ success: false, message: 'Error unkicking user' });
  }

  console.log(`[UNKICK] User ${username} unkicked from room ${roomId} by ${requester}`);
  io.emit('users-updated');

  res.json({ success: true, message: `User ${username} unkicked from room ${roomId}` });
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

  // Fetch fresh data from Supabase to verify requester role
  const { data: requesterData, error: requesterError } = await supabase
    .from('videochat_users')
    .select('role')
    .eq('username', requester)
    .single();

  if (requesterError || !requesterData) {
    return res.status(403).json({ success: false, message: 'Requester not found' });
  }

  if (requesterData.role !== 'admin' && requesterData.role !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'Only admins can reload users' });
  }

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

// REST API endpoint to delete room
app.delete('/api/rooms/:roomId', async (req, res) => {
  const roomId = req.params.roomId;
  const requester = req.headers['x-username'];

  console.log(`[DELETE API] Request to delete room: ${roomId} by ${requester}`);

  if (!requester) {
    console.log(`[DELETE API] Rejected: no username in headers`);
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // Fetch user role from Supabase
  const { data: requesterData, error: requesterError } = await supabase
    .from('videochat_users')
    .select('role')
    .eq('username', requester)
    .single();

  if (requesterError || !requesterData) {
    console.log(`[DELETE API] Rejected: user not found in Supabase`);
    return res.status(403).json({ success: false, message: 'User not found' });
  }

  const storedRoom = roomStore.get(roomId);
  const creator = storedRoom?.creator;
  const isSuperAdmin = requesterData.role === 'superadmin';

  console.log(`[DELETE API] Room details: stored=${!!storedRoom}, creator=${creator}, requesterRole=${requesterData.role}`);

  // Allow deletion if:
  // 1. User is the creator, OR
  // 2. No creator is set (orphaned room), OR
  // 3. User is superadmin
  if (creator === requester || !creator || isSuperAdmin) {
    console.log(`[DELETE API] Deleting room ${roomId} from roomStore`);
    roomStore.delete(roomId);
    if (rooms.has(roomId)) {
      console.log(`[DELETE API] Deleting room ${roomId} from active rooms`);
      rooms.delete(roomId);
    }
    console.log(`[DELETE API] Explicitly deleting from Supabase`);
    const deleted = await deleteRoomFromSupabase(roomId);
    if (deleted) {
      console.log(`[DELETE API] Successfully deleted from Supabase`);
    } else {
      console.log(`[DELETE API] Failed to delete from Supabase, but removed from memory`);
    }
    io.emit('room-deleted', roomId);
    io.emit('rooms-updated');
    console.log(`[DELETE API] Room ${roomId} deleted successfully by ${requester} (role: ${requesterData.role})`);
    res.json({ success: true, message: 'Room deleted' });
  } else {
    console.log(`[DELETE API] Rejected: ${requester} is not creator (creator=${creator}, role=${requesterData.role})`);
    res.status(403).json({ success: false, message: 'Только создатель может удалить комнату' });
  }
});

// REST API endpoint to clean ghost users from room metadata
app.post('/api/admin/clean-ghost-users', async (req, res) => {
  const requester = req.headers['x-username'];

  // Fetch fresh data from Supabase to verify requester role
  const { data: requesterData, error: requesterError } = await supabase
    .from('videochat_users')
    .select('role')
    .eq('username', requester)
    .single();

  if (requesterError || !requesterData) {
    return res.status(403).json({ success: false, message: 'Requester not found' });
  }

  if (requesterData.role !== 'admin' && requesterData.role !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'Only admins can clean ghost users' });
  }

  console.log(`[CLEAN] Cleaning ghost users from room metadata (requested by: ${requester})...`);

  // Get all valid usernames from registered users
  const validUsernames = new Set(registeredUsers.keys());
  console.log(`[CLEAN] Valid usernames:`, Array.from(validUsernames));
  console.log(`[CLEAN] Total rooms in roomStore: ${roomStore.size}`);

  let totalCleaned = 0;
  let roomsCleaned = 0;

  // Clean ghost users from ALL rooms in roomStore (stored rooms from Supabase)
  for (const [roomId, room] of roomStore) {
    if (room.channels) {
      let roomCleaned = false;
      for (const [channelId, channel] of Object.entries(room.channels)) {
        if (channel.users && Array.isArray(channel.users)) {
          console.log(`[CLEAN] Room ${roomId}, channel ${channelId}, users: ${JSON.stringify(channel.users)}`);
          const originalLength = channel.users.length;
          channel.users = channel.users.filter(u => validUsernames.has(u));
          const removed = originalLength - channel.users.length;
          if (removed > 0) {
            totalCleaned += removed;
            roomCleaned = true;
            console.log(`[CLEAN] Removed ${removed} ghost users from room ${roomId}, channel ${channelId}: ${channel.users}`);
          }
        }
      }
      if (roomCleaned) {
        roomsCleaned++;
      }
    }
  }

  // Save cleaned rooms to Supabase
  await saveRoomsToSupabase();

  console.log(`[CLEAN] Cleaned ${totalCleaned} ghost users from ${roomsCleaned} rooms`);

  res.json({ success: true, message: `Cleaned ${totalCleaned} ghost users from ${roomsCleaned} rooms` });
});

// REST API endpoint for VIP channels
app.get('/api/vip-channels', async (req, res) => {
  try {
    const channels = await loadVIPChannelsFromSupabase();
    res.json(channels);
  } catch (err) {
    console.error('[VIP] Error loading VIP channels:', err);
    res.status(500).json({ error: 'Error loading VIP channels' });
  }
});

app.post('/api/vip-channels', async (req, res) => {
  const { name, password } = req.body;
  const creator = req.headers['x-username'];

  if (!name) {
    return res.status(400).json({ success: false, message: 'Channel name is required' });
  }

  const newChannel = {
    id: 'vip-' + Date.now(),
    name,
    password: password || '',
    creator,
    created: Date.now()
  };

  const saved = await saveVIPChannelToSupabase(newChannel);
  if (saved) {
    io.emit('channel-created', newChannel);
    io.emit('channels-updated');
    res.json({ success: true, channel: newChannel });
  } else {
    res.status(500).json({ success: false, message: 'Error saving VIP channel' });
  }
});

app.put('/api/vip-channels/:id', async (req, res) => {
  const channelId = req.params.id;
  const { password } = req.body;
  const creator = req.headers['x-username'];

  const channels = await loadVIPChannelsFromSupabase();
  const channel = channels.find(c => c.id === channelId);

  if (!channel) {
    return res.status(404).json({ success: false, message: 'Channel not found' });
  }

  // Only creator can update
  if (channel.creator !== creator) {
    return res.status(403).json({ success: false, message: 'Only creator can update channel' });
  }

  channel.password = password || '';
  const saved = await saveVIPChannelToSupabase(channel);

  if (saved) {
    io.emit('channel-updated', channel);
    io.emit('channels-updated');
    res.json({ success: true, channel });
  } else {
    res.status(500).json({ success: false, message: 'Error updating VIP channel' });
  }
});

app.delete('/api/vip-channels/:id', async (req, res) => {
  const channelId = req.params.id;
  const creator = req.headers['x-username'];

  const channels = await loadVIPChannelsFromSupabase();
  const channel = channels.find(c => c.id === channelId);

  if (!channel) {
    return res.status(404).json({ success: false, message: 'Channel not found' });
  }

  // Only creator can delete
  if (channel.creator !== creator) {
    return res.status(403).json({ success: false, message: 'Only creator can delete channel' });
  }

  const deleted = await deleteVIPChannelFromSupabase(channelId);

  if (deleted) {
    io.emit('channel-deleted', channelId);
    io.emit('channels-updated');
    res.json({ success: true, message: 'Channel deleted' });
  } else {
    res.status(500).json({ success: false, message: 'Error deleting VIP channel' });
  }
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

  socket.on('join-room', (data) => {
    console.log('[JOIN-ROOM] Received data:', data);

    // Support both old format (separate params) and new format (object)
    let roomId, userName, userAvatar, roomName, roomAvatar, isScreenSharing, callback;

    if (typeof data === 'object' && data !== null) {
      // New format: object
      roomId = data.roomId;
      userName = data.username;
      userAvatar = data.avatar;
      roomName = data.roomName;
      roomAvatar = data.roomAvatar;
      isScreenSharing = data.isScreenSharing;
      console.log('[JOIN-ROOM] Parsed new format: roomId=', roomId, 'username=', userName);
    } else {
      // Old format: separate parameters
      roomId = arguments[0];
      userName = arguments[1];
      userAvatar = arguments[2];
      roomName = arguments[3];
      roomAvatar = arguments[4];
      callback = arguments[5];
      console.log('[JOIN-ROOM] Parsed old format: roomId=', roomId, 'username=', userName);
    }

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

    console.log(`[JOIN-ROOM] Room ID: ${roomId}, Name: ${roomName}`);
    console.log(`[JOIN-ROOM] Stored room exists: ${!!storedRoom}`);
    console.log(`[JOIN-ROOM] Active room exists: ${rooms.has(roomId)}`);
    if (storedRoom) {
      console.log(`[JOIN-ROOM] Stored room data:`, storedRoom);
    }

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
        console.log(`[JOIN-ROOM] Created active room: ${roomId} with name: ${displayName}`);
      } else {
        // Room doesn't exist anywhere and no name provided - reject join
        console.log(`[JOIN-ROOM] Room not found anywhere, rejecting join for: ${roomId}`);
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
      saveRoomsToSupabase();
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

    // Send callback for reconnect support (only for old format)
    if (typeof callback === 'function') {
      callback({ success: true });
    }
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
    const mLines = offer.sdp?.match(/m=/g)?.length || 0;
    console.log(`[SERVER] Forwarding offer from ${socket.id} to ${targetId}, m-lines: ${mLines}`);
    socket.to(targetId).emit('offer', socket.id, offer);
  });

  socket.on('answer', (targetId, answer) => {
    socket.to(targetId).emit('answer', socket.id, answer);
  });

  socket.on('request-screen-renegotiation', (screenSharerId) => {
    console.log(`[SCREEN] Requesting screen renegotiation from ${socket.id} to ${screenSharerId}`);
    socket.to(screenSharerId).emit('request-screen-renegotiation', socket.id);
  });

  socket.on('screen-share-renegotiate-request', ({ screenSharerId }) => {
    console.log(`[SCREEN] Screen share renegotiate request from ${socket.id}, screenSharerId: ${screenSharerId}`);
    // Broadcast to all users in room except sender
    socket.to(socket.roomId).emit('screen-share-renegotiate-request', { screenSharerId });
  });

  socket.on('ice-candidate', (targetId, candidate) => {
    console.log(`[SERVER] ICE candidate from ${socket.id} to ${targetId}`);
    console.log(`[SERVER] Candidate:`, JSON.stringify(candidate));
    io.to(targetId).emit('ice-candidate', socket.id, candidate);
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

  socket.on('screen-share-started', (callback) => {
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
      
      // Get recipient count for ACK
      const roomSockets = io.sockets.adapter.rooms.get(socket.roomId);
      const recipientCount = roomSockets ? roomSockets.size - 1 : 0; // Exclude sender
      console.log(`[SCREEN] Broadcasting screen-share-started to ${recipientCount} recipients in room ${socket.roomId}`);
      
      socket.to(socket.roomId).emit('screen-share-started', socket.id);
      
      // Send ACK to sender
      if (typeof callback === 'function') {
        callback({ success: true, recipientCount });
      }
    } else {
      console.error(`[SCREEN] Cannot broadcast screen-share-started: socket.roomId=${socket.roomId}, rooms.has=${rooms.has(socket.roomId)}`);
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Not in a room' });
      }
    }
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

  socket.on('refresh-screen-offer', (requesterId) => {
    console.log('[SCREEN] Received refresh-screen-offer from:', requesterId, 'target:', socket.id);
    console.log('[SCREEN] isScreenSharing:', isScreenSharing);
    console.log('[SCREEN] screenStream exists:', !!screenStream);
    console.log('[SCREEN] screenStream tracks:', screenStream ? screenStream.getTracks().length : 0);

    // Only respond if we are actively screen sharing
    if (isScreenSharing && screenStream) {
      console.log('[SCREEN] We are screen sharing, creating new peer connection for requester:', requesterId);
    }
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
      // Remove from screen sharing tracking
      if (room.screenSharingUsers) {
        room.screenSharingUsers.delete(socket.id);
        console.log(`[SCREEN] Removed ${socket.userName} from screen sharing in room ${roomId}`);
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

    // Get user role
    const user = registeredUsers.get(socket.userName);
    const userRole = user?.role || 'user';
    const isSuperAdmin = userRole === 'superadmin';

    // Allow deletion if:
    // 1. User is the creator, OR
    // 2. No creator is set (orphaned room) - first user to delete becomes "owner", OR
    // 3. User is superadmin
    if (creator === socket.userName || !creator || isSuperAdmin) {
      roomStore.delete(roomId);
      if (rooms.has(roomId)) {
        rooms.delete(roomId);
      }
      saveRoomsToSupabase();
      io.emit('room-deleted', roomId);
      io.emit('rooms-updated');
      console.log(`[DELETE] Room ${roomId} deleted by ${socket.userName} (role: ${userRole})`);
    } else {
      console.log(`[DELETE] Rejected: ${socket.userName} is not creator (creator=${creator}, role=${userRole})`);
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
        saveRoomsToSupabase();
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
