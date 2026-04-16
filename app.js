// Keros VideoChat - Full Authentication & Lobby System
const socket = io();
let socketConnected = false;

// Socket connection event
socket.on('connect', () => {
  // Connected - only log on localhost
  if (window.location.hostname === 'localhost') {
    console.log('Connected to server');
  }
  socketConnected = true;
  // If lobby is already visible, reload rooms
  const lobbyScreen = document.getElementById('lobbyScreen');
  if (lobbyScreen && lobbyScreen.style.display === 'flex') {
    loadServerRooms();
  }
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
  socketConnected = false;
});

// State
let currentUser = null;
let currentRoom = null;
let currentRoomName = '';
let localStream = null;
let screenStream = null;
let peers = new Map();
let activeUsers = new Map();
let isMicOn = true;
let isCamOn = true;
let isScreenSharing = false;
let userAvatar = null;
let pingInterval = null;
let currentPing = 0;
let screenShareUsers = new Set(); // Track which remote users are screen sharing

// Ping measurement function
function measurePing() {
  if (!socketConnected) {
    console.log('[PING] Socket not connected, skipping');
    return;
  }
  
  const startTime = Date.now();
  console.log('[PING] Sending ping...');
  
  socket.timeout(5000).emit('ping-check', (err, serverTime) => {
    if (err) {
      console.log('[PING] Error or timeout:', err);
      currentPing = 0;
      updatePingDisplay();
      return;
    }
    const endTime = Date.now();
    currentPing = endTime - startTime;
    console.log('[PING] Received pong, latency:', currentPing, 'ms');
    updatePingDisplay();
  });
}

function startPingMeasurement() {
  // Measure immediately and then every 2 seconds
  measurePing();
  pingInterval = setInterval(measurePing, 2000);
}

function stopPingMeasurement() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  currentPing = 0;
  updatePingDisplay();
}

function updatePingDisplay() {
  const pingEl = document.getElementById('pingDisplay');
  if (!pingEl) return;
  
  if (currentPing === 0) {
    pingEl.textContent = '-- ms';
    pingEl.style.color = '#72767d';
    return;
  }
  
  pingEl.textContent = `${currentPing} ms`;
  
  // Color coding: green < 100ms, yellow 100-300ms, red > 300ms
  if (currentPing < 100) {
    pingEl.style.color = '#3ba55d'; // Green - good
  } else if (currentPing < 300) {
    pingEl.style.color = '#faa81a'; // Yellow - medium
  } else {
    pingEl.style.color = '#ed4245'; // Red - bad
  }
}

const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// ========== SOUND SYSTEM ==========
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSoftTone(frequency, duration, type = 'sine', volume = 0.1) {
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  
  osc.connect(gain);
  gain.connect(audioContext.destination);
  
  osc.frequency.value = frequency;
  osc.type = type;
  
  gain.gain.setValueAtTime(0, audioContext.currentTime);
  gain.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  
  osc.start(audioContext.currentTime);
  osc.stop(audioContext.currentTime + duration);
}

const sounds = {
  micOn: () => playSoftTone(600, 0.15, 'sine', 0.1),
  micOff: () => playSoftTone(350, 0.15, 'sine', 0.1),
  camOn: () => playSoftTone(500, 0.15, 'triangle', 0.1),
  camOff: () => playSoftTone(300, 0.15, 'triangle', 0.1),
  screenOn: () => playSoftTone(700, 0.2, 'sine', 0.15),
  screenOff: () => playSoftTone(400, 0.2, 'sine', 0.15),
  userJoin: () => playSoftTone(550, 0.3, 'sine', 0.1),
  userLeave: () => playSoftTone(380, 0.3, 'sine', 0.1)
};

// ========== AUTHENTICATION ==========

// Check for room invite in URL first (before auth check)
const urlParams = new URLSearchParams(window.location.search);
const inviteRoomId = urlParams.get('room');

// AGGRESSIVE CLEANUP: Remove all ghost rooms from localStorage immediately
(function cleanupGhostRooms() {
  const localRooms = JSON.parse(localStorage.getItem('keroschat_rooms') || '[]');
  const ghostRooms = [];
  const isGhostRoom = (room) => {
    // Ghost room: name equals ID, or name is empty, or ID looks like random (8 uppercase chars)
    if (!room.name || room.name === room.id) return true;
    if (/^[A-Z0-9]{8}$/.test(room.id) && room.name === room.id) return true;
    return false;
  };
  const cleanedRooms = localRooms.filter(r => {
    if (isGhostRoom(r)) {
      ghostRooms.push(r.id);
      return false;
    }
    return true;
  });
  if (cleanedRooms.length !== localRooms.length) {
    localStorage.setItem('keroschat_rooms', JSON.stringify(cleanedRooms));
    console.log('[STARTUP] Removed', localRooms.length - cleanedRooms.length, 'ghost rooms:', ghostRooms);
  }
})();

// Check if user is already logged in
// Clear any pending invites from previous session - user should stay in lobby
sessionStorage.removeItem('pendingRoomInvite');

window.addEventListener('load', () => {
  const savedUser = localStorage.getItem('keroschat_user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    userAvatar = localStorage.getItem(`keroschat_avatar_${currentUser.username}`);
    
    // Only auto-join if explicit invite in URL (not from sessionStorage)
    if (inviteRoomId) {
      // Store invite for auto-join after lobby loads
      sessionStorage.setItem('pendingRoomInvite', inviteRoomId);
      showLobby();
      
      // Wait for server rooms to load, then auto-join
      setTimeout(() => {
        const pendingRoom = sessionStorage.getItem('pendingRoomInvite');
        if (pendingRoom) {
          sessionStorage.removeItem('pendingRoomInvite');
          
          // Check if room exists in server rooms or locally
          const localRooms = JSON.parse(localStorage.getItem('keroschat_rooms') || '[]');
          const localRoom = localRooms.find(r => r.id === pendingRoom);
          
          if (localRoom) {
            // Room exists locally, join it
            joinRoomById(pendingRoom);
          } else {
            // Try to get room info from server via REST API
            fetch('/api/rooms')
              .then(res => res.json())
              .then(serverRooms => {
                const foundRoom = serverRooms.find(r => r.id === pendingRoom);
                if (foundRoom) {
                  // Room exists on server, join it
                  currentRoomName = foundRoom.name;
                  addLogEntry('Приглашение', `Найдена комната на сервере: ${foundRoom.name}`);
                  joinRoomById(pendingRoom);
                } else {
                  // Room doesn't exist - stay in lobby, show error
                  addLogEntry('Ошибка', `Комната ${pendingRoom} не найдена на сервере`);
                  alert(`Комната ${pendingRoom} не найдена. Возможно, она была удалена.`);
                  // Stay in lobby, don't auto-create room
                }
              })
              .catch(err => {
                console.error('Error checking room:', err);
                // On error, stay in lobby
                addLogEntry('Ошибка', 'Не удалось проверить комнату на сервере');
                alert('Ошибка подключения к серверу. Остаёмся в лобби.');
              });
          }
        }
      }, 800);
    } else {
      showLobby();
    }
  }
});

function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  
  if (tab === 'login') {
    document.querySelector('.auth-tab:first-child').classList.add('active');
    document.getElementById('loginForm').classList.add('active');
  } else {
    document.querySelector('.auth-tab:last-child').classList.add('active');
    document.getElementById('registerForm').classList.add('active');
  }
}

function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  
  // Check stored users
  const users = JSON.parse(localStorage.getItem('keroschat_users') || '[]');
  const user = users.find(u => u.username === username && u.password === password);
  
  if (user) {
    currentUser = user;
    localStorage.setItem('keroschat_user', JSON.stringify(user));
    userAvatar = localStorage.getItem(`keroschat_avatar_${username}`);
    addLogEntry('Авторизация', `Пользователь ${username} вошел в систему`);
    showLobby();
  } else {
    addLogEntry('Ошибка', `Неудачная попытка входа для ${username}`);
    alert('Неверный никнейм или пароль!');
  }
}

function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const passwordConfirm = document.getElementById('regPasswordConfirm').value;
  
  if (password !== passwordConfirm) {
    alert('Пароли не совпадают!');
    return;
  }
  
  // Check if username exists
  const users = JSON.parse(localStorage.getItem('keroschat_users') || '[]');
  if (users.find(u => u.username === username)) {
    alert('Такой никнейм уже занят!');
    return;
  }
  
  // Create new user
  const newUser = { username, password, created: Date.now() };
  users.push(newUser);
  localStorage.setItem('keroschat_users', JSON.stringify(users));
  
  // Auto login
  currentUser = newUser;
  localStorage.setItem('keroschat_user', JSON.stringify(newUser));
  addLogEntry('Авторизация', `Новый пользователь ${username} зарегистрирован`);
  showLobby();
  alert('Регистрация успешна!');
};

function logout() {
  if (currentUser) {
    addLogEntry('Авторизация', `Пользователь ${currentUser.username} вышел из системы`);
  }
  localStorage.removeItem('keroschat_user');
  currentUser = null;
  location.reload();
}

// ========== LOBBY ==========

function showLobby() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('roomScreen').style.display = 'none';
  document.getElementById('lobbyScreen').style.display = 'flex';
  
  // Update user info
  document.getElementById('lobbyUsername').textContent = currentUser.username;
  const avatarEl = document.getElementById('lobbyAvatar');
  if (userAvatar) {
    avatarEl.innerHTML = `<img src="${userAvatar}" alt="avatar">`;
  } else {
    avatarEl.textContent = currentUser.username.charAt(0).toUpperCase();
  }
  
  // Load rooms from server
  loadServerRooms();
}

// Store server rooms
let serverRooms = [];

// Prevent multiple simultaneous loads
let isLoadingRooms = false;
let lastLoadTime = 0;

async function loadServerRooms() {
  // Debounce: don't reload if loaded in last 2 seconds
  const now = Date.now();
  if (isLoadingRooms || (now - lastLoadTime < 2000)) {
    console.log('[ROOMS] Skip reload - already loading or loaded recently');
    return;
  }
  
  isLoadingRooms = true;
  const list = document.getElementById('roomsList');
  list.innerHTML = '<p style="color: #72767d; padding: 16px; text-align: center;">⏳ Загрузка комнат...</p>';
  
  try {
    // Use REST API instead of socket (more reliable on Render)
    const response = await fetch('/api/rooms');
    if (!response.ok) throw new Error('Failed to fetch rooms');
    serverRooms = await response.json();
    // Only log in development
    if (window.location.hostname === 'localhost') {
      console.log('Loaded rooms from server:', serverRooms.length);
    }
  } catch (err) {
    console.error('Error loading rooms:', err);
    serverRooms = [];
    isLoadingRooms = false; // Reset on error
  }
  
  // Get local rooms and clean up those not on server (old/deleted)
  let localRooms = JSON.parse(localStorage.getItem('keroschat_rooms') || '[]');
  const serverRoomIds = new Set(serverRooms.map(r => r.id));
  
  // Filter out "ghost" rooms - rooms where name looks like an ID (uppercase letters+numbers, 8 chars)
  // These are auto-generated rooms that shouldn't exist
  const isGhostRoom = (room) => {
    // If name is same as ID and looks like random ID (8 uppercase chars/numbers)
    if (room.name === room.id && /^[A-Z0-9]{8}$/.test(room.id)) {
      return true;
    }
    // If name is empty or just the ID
    if (!room.name || room.name === room.id) {
      return true;
    }
    return false;
  };
  
  // AGGRESSIVE: Remove ALL ghost rooms regardless of creator!
  const cleanedLocalRooms = localRooms.filter(r => {
    if (isGhostRoom(r)) {
      console.log('[GHOST] DELETING ghost room:', r.id, 'creator:', r.creator);
      return false;
    }
    return serverRoomIds.has(r.id) || r.creator === currentUser?.username;
  });
  
  // Save cleaned list back
  if (cleanedLocalRooms.length !== localRooms.length) {
    localStorage.setItem('keroschat_rooms', JSON.stringify(cleanedLocalRooms));
    console.log('Cleaned up', localRooms.length - cleanedLocalRooms.length, 'old rooms from localStorage');
  }
  
  // Merge: server rooms take precedence (they have latest data like userCount)
  const mergedMap = new Map();
  cleanedLocalRooms.forEach(r => mergedMap.set(r.id, r));
  serverRooms.forEach(r => mergedMap.set(r.id, r)); // Server overwrites local
  
  allRooms = Array.from(mergedMap.values());
  
  // Sort: rooms with active users first, then by creation date
  allRooms.sort((a, b) => {
    if (a.active && !b.active) return -1;
    if (!a.active && b.active) return 1;
    return (b.created || 0) - (a.created || 0);
  });
  
  renderRoomsList(allRooms);
  
  // Reset loading state
  isLoadingRooms = false;
  lastLoadTime = Date.now();
}

function renderRoomsList(roomsToRender) {
  const list = document.getElementById('roomsList');
  list.innerHTML = '';
  
  if (roomsToRender.length === 0) {
    list.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #72767d;">
        <p style="margin-bottom: 12px;">😕 Пока нет ни одной комнаты</p>
        <p style="font-size: 13px;">Создайте первую комнату или дождитесь, пока кто-то поделится ссылкой!</p>
      </div>
    `;
    return;
  }
  
  // Add header for available rooms
  const activeCount = roomsToRender.filter(r => r.active).length;
  const headerInfo = document.createElement('div');
  headerInfo.style.cssText = 'padding: 8px 12px; color: #96989d; font-size: 12px; border-bottom: 1px solid #202225; margin-bottom: 8px;';
  headerInfo.innerHTML = `📋 Всего комнат: ${roomsToRender.length} | 🔴 Активных: ${activeCount}`;
  list.appendChild(headerInfo);
  
  roomsToRender.forEach(room => {
    const item = document.createElement('div');
    item.className = 'room-item' + (room.active ? ' active-room' : '');
    item.onclick = (e) => {
      if (e.target.closest('.room-actions')) return;
      joinRoomById(room.id);
    };
    
    const isCreator = room.creator === currentUser?.username;
    const actionsHtml = isCreator ? `
      <div class="room-actions" onclick="event.stopPropagation()">
        <button onclick="editRoom('${room.id}', '${room.name}', '${room.avatar || ''}')" title="Редактировать">✏️</button>
        <button onclick="deleteRoom('${room.id}')" title="Удалить">🗑️</button>
      </div>
    ` : '';
    
    const iconHtml = room.avatar ? 
      `<img src="${room.avatar}" alt="${room.name}">` : 
      '#';
    
    // Build users list HTML
    let usersHtml = '';
    if (room.active && room.users && room.users.length > 0) {
      const usersList = room.users.slice(0, 3).join(', '); // Show first 3 users
      const moreCount = room.users.length > 3 ? ` +${room.users.length - 3}` : '';
      usersHtml = `<div style="color: #3ba55d; font-size: 11px; margin-top: 4px;">� ${room.userCount}: ${usersList}${moreCount}</div>`;
    } else {
      usersHtml = `<div style="color: #72767d; font-size: 11px; margin-top: 4px;">⚪ Нет участников</div>`;
    }
    
    item.innerHTML = `
      <div class="icon">${iconHtml}</div>
      <div class="info">
        <div class="name">${room.name} ${room.active ? '🔥' : ''}</div>
        <div class="count" style="font-size: 11px; color: #96989d;">${isCreator ? '👑 Вы создатель' : (room.creator ? `👤 ${room.creator}` : '')}</div>
        ${usersHtml}
      </div>
      ${actionsHtml}
    `;
    list.appendChild(item);
  });
}

let allRooms = [];
let newRoomAvatar = null;

function loadRoomsList(filter = '') {
  // Use server rooms if available, otherwise fall back to local
  const rooms = filter 
    ? allRooms.filter(r => r.name.toLowerCase().includes(filter.toLowerCase()) || 
                          r.id.toLowerCase().includes(filter.toLowerCase()) ||
                          (r.creator && r.creator.toLowerCase().includes(filter.toLowerCase())))
    : allRooms;
  
  renderRoomsList(rooms);
}

async function searchRooms(query) {
  if (!query) {
    loadRoomsList();
    return;
  }
  
  // Search by room name only (not by ID)
  const filtered = allRooms.filter(r => 
    r.name.toLowerCase().includes(query.toLowerCase()) ||
    (r.creator && r.creator.toLowerCase().includes(query.toLowerCase()))
  );
  
  // If nothing found, show "no results" message
  if (filtered.length === 0) {
    const list = document.getElementById('roomsList');
    list.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #72767d;">
        <p style="margin-bottom: 8px;">🔍 Ничего не найдено</p>
        <p style="font-size: 13px;">По запросу "${query}" нет комнат</p>
        <button onclick="document.getElementById('roomSearch').value=''; loadRoomsList()" 
                style="margin-top: 12px; padding: 6px 12px; background: #5865f2; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
          🔄 Показать все комнаты
        </button>
      </div>
    `;
    return;
  }
  
  renderRoomsList(filtered);
}

function editRoom(roomId, currentName, currentAvatar) {
  // Create custom modal for editing room
  const newName = prompt('Введите новое название комнаты:', currentName);
  if (!newName || newName.trim() === '') return;
  
  const changeAvatar = confirm('Хотите изменить аватар комнаты?');
  let newAvatar = currentAvatar;
  
  if (changeAvatar) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 2 * 1024 * 1024) {
          alert('Файл слишком большой! Максимум 2MB');
          return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
          newAvatar = ev.target.result;
          saveRoomEdit(roomId, newName.trim(), newAvatar);
        };
        reader.readAsDataURL(file);
      } else {
        saveRoomEdit(roomId, newName.trim(), currentAvatar);
      }
    };
    input.click();
  } else {
    if (newName !== currentName) {
      saveRoomEdit(roomId, newName.trim(), currentAvatar);
    }
  }
}

function saveRoomEdit(roomId, newName, newAvatar) {
  const rooms = JSON.parse(localStorage.getItem('keroschat_rooms') || '[]');
  const roomIndex = rooms.findIndex(r => r.id === roomId);
  
  if (roomIndex !== -1) {
    rooms[roomIndex].name = newName;
    if (newAvatar) {
      rooms[roomIndex].avatar = newAvatar;
    }
    localStorage.setItem('keroschat_rooms', JSON.stringify(rooms));
    loadRoomsList();
    
    // Update header if we're in this room
    if (currentRoom === roomId) {
      currentRoomName = newName;
      const displayEl = document.getElementById('displayRoomId');
      if (displayEl) displayEl.textContent = newName;
      const avatarEl = document.getElementById('roomHeaderAvatar');
      if (avatarEl && newAvatar) {
        avatarEl.innerHTML = `<img src="${newAvatar}" alt="${newName}">`;
      }
    }
    
    addLogEntry('Комната', `Комната ${roomId} обновлена: название "${newName}"`);
    alert('Комната обновлена!');
  }
}

function deleteRoom(roomId) {
  if (!confirm('Удалить эту комнату? Все участники будут отключены.')) return;
  
  const rooms = JSON.parse(localStorage.getItem('keroschat_rooms') || '[]');
  const filteredRooms = rooms.filter(r => r.id !== roomId);
  
  // Always update localStorage if room was found
  if (filteredRooms.length !== rooms.length) {
    localStorage.setItem('keroschat_rooms', JSON.stringify(filteredRooms));
    console.log(`[DELETE] Room ${roomId} removed from localStorage`);
  }
  
  // Always notify server to delete (even if not in localStorage, might be on server)
  socket.emit('delete-room', roomId);
  
  // Reload room list immediately
  loadServerRooms();
  addLogEntry('Комната', `Комната ${roomId} удалена`);
  alert('Комната удалена!');
}

function showCreateRoomModal() {
  document.getElementById('createRoomModal').classList.add('active');
  document.getElementById('newRoomName').focus();
  // Reset avatar preview
  newRoomAvatar = null;
  document.getElementById('roomAvatarPreview').innerHTML = '#';
  document.getElementById('roomAvatarUpload').value = '';
}

function hideCreateRoomModal() {
  document.getElementById('createRoomModal').classList.remove('active');
  document.getElementById('newRoomName').value = '';
  newRoomAvatar = null;
  document.getElementById('roomAvatarPreview').innerHTML = '#';
}

function previewRoomAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  
  if (file.size > 2 * 1024 * 1024) {
    alert('Файл слишком большой! Максимум 2MB');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    newRoomAvatar = e.target.result;
    document.getElementById('roomAvatarPreview').innerHTML = `<img src="${newRoomAvatar}" alt="avatar">`;
  };
  reader.readAsDataURL(file);
}

function createRoom() {
  const name = document.getElementById('newRoomName').value.trim();
  if (!name) {
    alert('Введите название комнаты!');
    return;
  }
  
  // Prevent creating ghost rooms (name that looks like ID)
  if (/^[A-Z0-9]{8}$/.test(name)) {
    alert('Название комнаты не должно выглядеть как ID (8 заглавных букв/цифр)! Придумайте нормальное название.');
    return;
  }
  
  const roomId = generateRoomId();
  const rooms = JSON.parse(localStorage.getItem('keroschat_rooms') || '[]');
  const newRoom = { id: roomId, name, created: Date.now(), creator: currentUser.username, avatar: newRoomAvatar };
  rooms.push(newRoom);
  localStorage.setItem('keroschat_rooms', JSON.stringify(rooms));
  
  // Also store room info for server-side search
  allRooms.push({ id: roomId, name, creator: currentUser.username, avatar: newRoomAvatar });
  
  hideCreateRoomModal();
  loadServerRooms();
  joinRoomById(roomId);
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// ========== ROOM ==========

async function joinRoomById(roomId) {
  currentRoom = roomId;
  
  // Find room name from stored rooms (local or server)
  const rooms = JSON.parse(localStorage.getItem('keroschat_rooms') || '[]');
  const localRoom = rooms.find(r => r.id === roomId);
  const serverRoom = serverRooms.find(r => r.id === roomId);
  const room = localRoom || serverRoom;
  currentRoomName = room ? room.name : roomId;
  const roomAvatar = room ? room.avatar : null;
  
  addLogEntry('Комната', `Подключение к комнате: ${currentRoomName} (${roomId})`);
  
  // Request media
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    
    // Set default microphone volume to 50%
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      // Apply constraints to set volume (browser support varies)
      try {
        const capabilities = audioTrack.getCapabilities();
        if (capabilities.volume) {
          await audioTrack.applyConstraints({ volume: 0.5 });
        }
      } catch (e) {
        console.log('Could not set default mic volume via constraints');
      }
    }
  } catch (err) {
    alert('Ошибка доступа к камере/микрофону: ' + err.message);
    return;
  }
  
  // Join socket room with avatar, room name and room avatar
  socket.emit('join-room', roomId, currentUser.username, userAvatar, currentRoomName, roomAvatar);
  
  // Play sound for local user entering room
  sounds.userJoin();
  
  // Show room UI
  showRoomUI();
  
  // Add local video
  addVideoStream('local', localStream, currentUser.username, true, false);
  updateActiveUsers();
  
  // Start speaking detection
  startSpeakingDetection();
}

function showRoomUI() {
  document.getElementById('lobbyScreen').style.display = 'none';
  document.getElementById('roomScreen').style.display = 'flex';
  document.getElementById('roomScreen').style.flexDirection = 'column';
  // Always show room name, not ID
  const displayName = currentRoomName && currentRoomName !== currentRoom ? currentRoomName : currentRoom;
  document.getElementById('displayRoomId').textContent = displayName;
  
  // Set room avatar in header
  const rooms = JSON.parse(localStorage.getItem('keroschat_rooms') || '[]');
  const room = rooms.find(r => r.id === currentRoom);
  const avatarEl = document.getElementById('roomHeaderAvatar');
  if (avatarEl) {
    if (room && room.avatar) {
      avatarEl.innerHTML = `<img src="${room.avatar}" alt="${room.name}">`;
    } else {
      avatarEl.textContent = '#';
    }
  }
  
  // Start ping measurement
  startPingMeasurement();
}

function leaveRoom() {
  // Stop streams
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  if (screenStream) {
    screenStream.getTracks().forEach(t => t.stop());
    screenStream = null;
  }
  
  // Close peer connections
  peers.forEach(pc => pc.close());
  peers.clear();
  activeUsers.clear();
  screenShareUsers.clear(); // Clear screen share tracking
  
  // Stop ping measurement
  stopPingMeasurement();
  
  // Leave socket room
  socket.emit('leave-room', currentRoom);
  
  // Reset state
  currentRoom = null;
  isMicOn = true;
  isCamOn = true;
  isScreenSharing = false;
  
  // Clear UI
  document.getElementById('videoGrid').innerHTML = '';
  document.getElementById('chatMessages').innerHTML = '';
  
  // Reset buttons
  const micBtn = document.getElementById('micBtn');
  micBtn.classList.remove('danger');
  micBtn.querySelector('.label').textContent = 'Мик';
  
  const camBtn = document.getElementById('camBtn');
  camBtn.classList.remove('danger');
  camBtn.querySelector('.label').textContent = 'Камера';
  
  const screenBtn = document.getElementById('screenBtn');
  screenBtn.classList.remove('active');
  screenBtn.querySelector('.label').textContent = 'Экран';
  
  // Show settings panel if open
  document.getElementById('settingsPanel').classList.remove('active');
  
  // Back to lobby
  showLobby();
}

function disconnectAndJoinAnother() {
  // Just disconnect and return to lobby without stopping streams
  // Leave socket room
  socket.emit('leave-room', currentRoom);
  
  // Close peer connections but keep streams
  peers.forEach(pc => pc.close());
  peers.clear();
  activeUsers.clear();
  screenShareUsers.clear(); // Clear screen share tracking
  
  // Reset state
  currentRoom = null;
  isMicOn = true;
  isCamOn = true;
  isScreenSharing = false;
  
  // Clear UI
  document.getElementById('videoGrid').innerHTML = '';
  document.getElementById('chatMessages').innerHTML = '';
  
  // Reset buttons
  const micBtn = document.getElementById('micBtn');
  micBtn.classList.remove('danger');
  micBtn.querySelector('.label').textContent = 'Мик';
  
  const camBtn = document.getElementById('camBtn');
  camBtn.classList.remove('danger');
  camBtn.querySelector('.label').textContent = 'Камера';
  
  const screenBtn = document.getElementById('screenBtn');
  screenBtn.classList.remove('active');
  screenBtn.querySelector('.label').textContent = 'Экран';
  
  // Show settings panel if open
  document.getElementById('settingsPanel').classList.remove('active');
  
  // Back to lobby - streams continue running
  showLobby();
  
  // Show message to select another room
  alert('Вы отключены от комнаты. Выберите другую комнату из списка или создайте новую.');
}

function copyLink() {
  const link = `${window.location.origin}?room=${currentRoom}`;
  navigator.clipboard.writeText(link).then(() => {
    alert('Ссылка скопирована!');
  });
}

// ========== VIDEO & PEERS ==========

function addVideoStream(id, stream, name, isLocal = false, isScreenShare = false) {
  console.log(`[VIDEO] addVideoStream called: id=${id}, isLocal=${isLocal}, isScreenShare=${isScreenShare}`);
  let container = document.getElementById(`video-${id}`);
  if (!container) {
    container = document.createElement('div');
    container.className = 'video-container' + (isScreenShare ? ' screen-share' : '');
    container.id = `video-${id}`;
    
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = isLocal;
    if (isLocal && !isScreenShare) video.style.transform = 'scaleX(-1)';
    
    const label = document.createElement('div');
    label.className = 'video-label';
    label.textContent = isLocal ? `${name} (Вы)` : name;
    
    if (!isLocal) {
      const volumeControl = document.createElement('div');
      volumeControl.className = 'remote-volume';
      volumeControl.innerHTML = `
        <span>🔊</span>
        <input type="range" min="0" max="100" value="50" 
               onchange="setRemoteVolume('${id}', this.value)" title="Громкость">
      `;
      label.appendChild(volumeControl);
      // Set default volume to 50%
      video.volume = 0.5;
    }
    
    // Add fullscreen button for screen share (only for REMOTE users, not local)
    // Local user doesn't need fullscreen button for their own screen share
    // Remote users DO need fullscreen button to enlarge shared screen
    if (isScreenShare && !isLocal) {
      const fullscreenBtn = document.createElement('button');
      fullscreenBtn.className = 'fullscreen-btn';
      fullscreenBtn.innerHTML = '🔍';
      fullscreenBtn.title = 'Увеличить демонстрацию экрана';
      fullscreenBtn.onclick = () => openScreenModal(id);
      container.appendChild(fullscreenBtn);
      
      // Double-click on video to enlarge screen share
      video.style.cursor = 'pointer';
      video.title = 'Двойной клик для увеличения';
      video.ondblclick = () => openScreenModal(id);
    }
    
    container.appendChild(video);
    container.appendChild(label);
    document.getElementById('videoGrid').appendChild(container);
  } else {
    const video = container.querySelector('video');
    video.srcObject = stream;
  }
  updateUserCount();
}

function removeVideoStream(id) {
  const container = document.getElementById(`video-${id}`);
  if (container) container.remove();
  updateUserCount();
}

function updateUserCount() {
  const count = document.querySelectorAll('.video-container').length;
  document.getElementById('userCount').textContent = count;
}

function updateActiveUsers() {
  const list = document.getElementById('activeUsers');
  list.innerHTML = '';
  
  // Local user with speaking indicator
  const localItem = document.createElement('div');
  localItem.className = 'user-item';
  localItem.id = 'user-local-item';
  const avatarHtml = userAvatar ? 
    `<img src="${userAvatar}" alt="avatar">` :
    currentUser.username.charAt(0).toUpperCase();
  localItem.innerHTML = `
    <div class="user-avatar" id="avatar-local">${avatarHtml}</div>
    <span class="user-name">${currentUser.username} (Вы)</span>
    <div class="user-status" id="status-local"></div>
  `;
  list.appendChild(localItem);
  
  // Remote users with speaking indicator and avatar
  peers.forEach((pc, id) => {
    const user = activeUsers.get(id);
    const item = document.createElement('div');
    item.className = 'user-item';
    item.id = `user-item-${id}`;
    
    // Check if user has avatar
    const avatarHtml = (user && user.avatar) ? 
      `<img src="${user.avatar}" alt="avatar">` :
      (user ? user.name.charAt(0).toUpperCase() : '?');
    
    item.innerHTML = `
      <div class="user-avatar" id="avatar-${id}">${avatarHtml}</div>
      <span class="user-name">${user ? user.name : 'Участник'}</span>
      <div class="user-status" id="status-${id}"></div>
    `;
    list.appendChild(item);
  });
  
  // Update settings if open
  const settingsPanel = document.getElementById('settingsPanel');
  if (settingsPanel.classList.contains('active')) {
    updateRemoteVolumeControls();
  }
}

// ========== SPEAKING DETECTION ==========
function startSpeakingDetection() {
  if (!localStream || !localStream.getAudioTracks()[0]) return;
  
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = audioContext.createAnalyser();
  const source = audioContext.createMediaStreamSource(localStream);
  source.connect(analyser);
  
  analyser.fftSize = 64;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  
  function checkSpeaking() {
    analyser.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    
    const statusEl = document.getElementById('status-local');
    if (statusEl) {
      if (average > 30 && isMicOn) {
        statusEl.style.background = '#3ba55d';
        statusEl.style.boxShadow = '0 0 8px #3ba55d';
      } else {
        statusEl.style.background = '#72767d';
        statusEl.style.boxShadow = 'none';
      }
    }
    
    requestAnimationFrame(checkSpeaking);
  }
  
  checkSpeaking();
}

async function createPeerConnection(userId) {
  const pc = new RTCPeerConnection(iceServers);
  
  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream);
  });
  
  pc.ontrack = (e) => {
    const stream = e.streams[0];
    console.log(`[TRACK] Received stream from ${userId}, tracks:`, stream.getTracks().map(t => t.kind));
    socket.emit('get-user-name', userId, (name) => {
      const userName = name || 'Участник';
      if (!activeUsers.has(userId)) {
        activeUsers.set(userId, { id: userId, name: userName });
      }
      // Check if this user is screen sharing
      const isScreenShare = screenShareUsers.has(userId);
      console.log(`[TRACK] screenShareUsers has ${userId}:`, isScreenShare, 'Set size:', screenShareUsers.size);
      addVideoStream(userId, stream, userName, false, isScreenShare);
      updateActiveUsers();
    });
  };
  
  pc.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit('ice-candidate', userId, e.candidate);
    }
  };
  
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'disconnected') {
      removeVideoStream(userId);
      peers.delete(userId);
      updateActiveUsers();
    }
  };
  
  peers.set(userId, pc);
  return pc;
}

// ========== SOCKET EVENTS ==========

socket.on('room-info', (room) => {
  // Update room name from server
  if (room && room.name) {
    currentRoomName = room.name;
    
    // Update display if already in room
    const displayEl = document.getElementById('displayRoomId');
    if (displayEl && currentRoom) {
      displayEl.textContent = currentRoomName;
    }
    
    // Update room avatar in header if provided
    const avatarEl = document.getElementById('roomHeaderAvatar');
    if (avatarEl && room.avatar) {
      avatarEl.innerHTML = `<img src="${room.avatar}" alt="${room.name}">`;
    }
    
    addLogEntry('Комната', `Получена информация о комнате: ${room.name}`);
    
    // Refresh room list to show updated info
    loadServerRooms();
  }
});

socket.on('users-in-room', async (users) => {
  // Users list received - debug minimized
  // console.log('Users in room:', users.length);
  for (const user of users) {
    // Skip if already connected to this user
    if (activeUsers.has(user.id) || peers.has(user.id)) {
      // Already connected, skip
      continue;
    }
    // Debug disabled for performance
  // console.log('Creating peer connection for user:', user.id);
    activeUsers.set(user.id, user);
    const pc = await createPeerConnection(user.id);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    // Debug disabled
    // console.log('Sending offer to:', user.id);
    socket.emit('offer', user.id, offer);
  }
  updateActiveUsers();
});

// Listen for room list updates from server
socket.on('rooms-updated', () => {
  // Rooms updated - refresh quietly
  // Refresh room list if in lobby
  const lobbyScreen = document.getElementById('lobbyScreen');
  if (lobbyScreen && lobbyScreen.style.display === 'flex') {
    loadServerRooms();
  }
});

socket.on('room-deleted', (roomId) => {
  addLogEntry('Комната', `Комната ${roomId} была удалена`);
  // If currently in this room, leave it
  if (currentRoom === roomId) {
    leaveRoom();
    alert('Эта комната была удалена создателем.');
  }
});

socket.on('room-error', (error) => {
  addLogEntry('Ошибка', error.message);
  alert(error.message);
  // If in room, go back to lobby
  if (currentRoom) {
    leaveRoom();
  }
});

socket.on('user-joined', async (user) => {
  // Skip if already connected to this user (prevent duplicates)
  if (activeUsers.has(user.id) || peers.has(user.id)) {
    console.log('User already connected:', user.id);
    return;
  }
  // Avatar sync debug - disabled for production performance
  // console.log('[AVATAR] User joined:', user.name, 'has avatar:', !!user.avatar);
  sounds.userJoin();
  activeUsers.set(user.id, user);
  addChatMessage('Система', `${user.name} присоединился`, true);
  addLogEntry('Пользователи', `${user.name} присоединился к комнате (avatar: ${user.avatar ? 'yes' : 'no'})`);
  updateActiveUsers();
});

socket.on('user-left', (userId) => {
  sounds.userLeave();
  const user = activeUsers.get(userId);
  removeVideoStream(userId);
  if (peers.has(userId)) {
    peers.get(userId).close();
    peers.delete(userId);
  }
  activeUsers.delete(userId);
  const userName = user ? user.name : 'Участник';
  addChatMessage('Система', `${userName} вышел`, true);
  addLogEntry('Пользователи', `${userName} покинул комнату`);
  updateActiveUsers();
});

socket.on('offer', async (userId, offer) => {
  // Offer received - debug disabled
  // console.log('Received offer from:', userId);
  const pc = await createPeerConnection(userId);
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  // Answer sent
  socket.emit('answer', userId, answer);
  updateActiveUsers();
});

socket.on('answer', async (userId, answer) => {
  // Answer received - debug disabled
  // console.log('Received answer from:', userId);
  if (peers.has(userId)) {
    await peers.get(userId).setRemoteDescription(answer);
    // Remote description set
  } else {
    // No peer for answer
  }
});

socket.on('ice-candidate', async (userId, candidate) => {
  // ICE candidate received - too verbose, disabled
  if (peers.has(userId)) {
    await peers.get(userId).addIceCandidate(new RTCIceCandidate(candidate));
  } else {
    // No peer for ICE
  }
});

socket.on('chat-message', (msg) => {
  addChatMessage(msg.sender, msg.text, false, msg.time);
});

// Handle remote user screen share started
socket.on('screen-share-started', (userId) => {
  console.log('[SCREEN] Remote user started screen share:', userId);
  addLogEntry('Демонстрация', 'Пользователь начал демонстрацию экрана');
  
  // Track this user as screen sharing
  screenShareUsers.add(userId);
  
  // Check if video container already exists and add fullscreen button
  const container = document.getElementById(`video-${userId}`);
  console.log('[SCREEN] Looking for container:', `video-${userId}`, 'found:', !!container);
  
  if (container) {
    if (!container.querySelector('.fullscreen-btn')) {
      console.log('[SCREEN] Adding fullscreen button to existing container');
      // Add screen-share class
      container.classList.add('screen-share');
      
      // Add fullscreen button
      const fullscreenBtn = document.createElement('button');
      fullscreenBtn.className = 'fullscreen-btn';
      fullscreenBtn.innerHTML = '🔍';
      fullscreenBtn.title = 'Увеличить демонстрацию экрана';
      fullscreenBtn.onclick = () => openScreenModal(userId);
      container.appendChild(fullscreenBtn);
      
      // Add double-click handler to video
      const video = container.querySelector('video');
      if (video) {
        video.style.cursor = 'pointer';
        video.title = 'Двойной клик для увеличения';
        video.ondblclick = () => openScreenModal(userId);
      }
    } else {
      console.log('[SCREEN] Fullscreen button already exists');
    }
  } else {
    console.log('[SCREEN] Container not found, will add button when video arrives');
  }
});

// Handle remote user screen share stopped
socket.on('screen-share-stopped', (userId) => {
  // Screen share stopped - debug disabled
  // console.log('[SCREEN] Remote user stopped screen share:', userId);
  addLogEntry('Демонстрация', 'Пользователь остановил демонстрацию экрана');
  
  // Remove from screen share tracking
  screenShareUsers.delete(userId);
  
  // Remove the screen share video container
  const container = document.getElementById(`video-${userId}`);
  if (container && container.classList.contains('screen-share')) {
    container.remove();
    updateUserCount();
  }
});

// Handle active screen shares when joining room (users already sharing)
socket.on('active-screen-shares', (userIds) => {
  console.log('[SCREEN] Received active screen shares on join:', userIds);
  
  userIds.forEach(userId => {
    // Track this user as screen sharing
    screenShareUsers.add(userId);
    addLogEntry('Демонстрация', 'Пользователь уже демонстрирует экран');
    
    // Check if video container already exists and add fullscreen button
    const container = document.getElementById(`video-${userId}`);
    if (container && !container.querySelector('.fullscreen-btn')) {
      // Add screen-share class
      container.classList.add('screen-share');
      
      // Add fullscreen button
      const fullscreenBtn = document.createElement('button');
      fullscreenBtn.className = 'fullscreen-btn';
      fullscreenBtn.innerHTML = '🔍';
      fullscreenBtn.title = 'Увеличить демонстрацию экрана';
      fullscreenBtn.onclick = () => openScreenModal(userId);
      container.appendChild(fullscreenBtn);
      
      // Add double-click handler to video
      const video = container.querySelector('video');
      if (video) {
        video.style.cursor = 'pointer';
        video.title = 'Двойной клик для увеличения';
        video.ondblclick = () => openScreenModal(userId);
      }
    }
  });
});

// ========== CONTROLS ==========

function toggleMic() {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      isMicOn = audioTrack.enabled;
      
      // Play sound
      if (isMicOn) {
        sounds.micOn();
      } else {
        sounds.micOff();
      }
      
      const btn = document.getElementById('micBtn');
      if (isMicOn) {
        btn.classList.remove('danger');
        btn.querySelector('.label').textContent = 'Мик';
      } else {
        btn.classList.add('danger');
        btn.querySelector('.label').textContent = 'Мик выкл';
      }
    }
  }
}

function toggleCam() {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      isCamOn = videoTrack.enabled;
      
      // Play sound
      if (isCamOn) {
        sounds.camOn();
      } else {
        sounds.camOff();
      }
      
      const btn = document.getElementById('camBtn');
      if (isCamOn) {
        btn.classList.remove('danger');
        btn.querySelector('.label').textContent = 'Камера';
      } else {
        btn.classList.add('danger');
        btn.querySelector('.label').textContent = 'Камера выкл';
      }
    }
  }
}

async function toggleScreen() {
  console.log('[SCREEN] Toggle called, isScreenSharing:', isScreenSharing);
  
  if (isScreenSharing) {
    // Stop screen sharing
    sounds.screenOff();
    
    if (screenStream) {
      // Remove onended handler before stopping to prevent double toggle
      screenStream.getVideoTracks().forEach(track => {
        track.onended = null;
        track.stop();
      });
      screenStream.getAudioTracks().forEach(track => track.stop());
      screenStream = null;
    }
    
    // Replace with camera track
    const videoTrack = localStream ? localStream.getVideoTracks()[0] : null;
    if (videoTrack) {
      peers.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack).catch(err => {
            console.error('[SCREEN] Error replacing track:', err);
          });
        }
      });
    }
    
    // Remove screen share preview and restore camera preview
    const localContainer = document.getElementById('video-local');
    if (localContainer) {
      localContainer.remove();
    }
    if (localStream) {
      addVideoStream('local', localStream, currentUser.username, true, false);
    }
    
    isScreenSharing = false;
    socket.emit('screen-share-stopped');
    
    const btn = document.getElementById('screenBtn');
    if (btn) {
      btn.classList.remove('active');
      const label = btn.querySelector('.label');
      if (label) label.textContent = 'Экран';
    }
    
    console.log('[SCREEN] Screen sharing stopped');
  } else {
    // Start screen sharing
    try {
      console.log('[SCREEN] Starting screen share...');
      
      // Request screen share with constraints
      const constraints = {
        video: {
          cursor: 'always'
        },
        audio: false // Disable audio to reduce bandwidth
      };
      
      screenStream = await navigator.mediaDevices.getDisplayMedia(constraints);
      sounds.screenOn();
      
      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) {
        throw new Error('No video track in screen share');
      }
      
      // Handle when user stops sharing via browser UI
      screenTrack.onended = () => {
        console.log('[SCREEN] Track ended via browser');
        if (isScreenSharing) {
          toggleScreen();
        }
      };
      
      // Replace camera track with screen track in all peer connections
      peers.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack).catch(err => {
            console.error('[SCREEN] Error replacing track:', err);
          });
        }
      });
      
      // Update local preview - remove camera, add minimized screen preview
      const localContainer = document.getElementById('video-local');
      if (localContainer) {
        localContainer.remove();
      }
      
      // Add minimized local screen share preview (to reduce CPU load)
      addVideoStream('local', screenStream, currentUser.username, true, true);
      
      // Minimize the local preview after adding
      setTimeout(() => {
        const container = document.getElementById('video-local');
        if (container) {
          container.style.cssText = 'width: 120px; height: 90px; position: absolute; bottom: 80px; right: 20px; z-index: 100; opacity: 0.7;';
          const video = container.querySelector('video');
          if (video) {
            video.style.cssText = 'width: 100%; height: 100%; object-fit: contain;';
          }
          // Hide label to save space
          const label = container.querySelector('.video-label');
          if (label) label.style.display = 'none';
        }
      }, 100);
      
      isScreenSharing = true;
      socket.emit('screen-share-started');
      
      const btn = document.getElementById('screenBtn');
      if (btn) {
        btn.classList.add('active');
        const label = btn.querySelector('.label');
        if (label) label.textContent = 'Экран вкл';
      }
      
      console.log('[SCREEN] Screen sharing started');
    } catch (err) {
      console.error('[SCREEN] Error starting screen share:', err);
      alert('Ошибка при запуске демонстрации: ' + err.message);
    }
  }
}

// ========== FULLSCREEN SCREEN SHARE ==========
let currentScreenResolution = '1080p'; // Default resolution

function openScreenModal(videoId) {
  // Find the screen share video element by id
  const container = document.getElementById(`video-${videoId}`);
  if (!container) {
    console.warn('Screen share container not found:', videoId);
    return;
  }
  
  const video = container.querySelector('video');
  if (!video) {
    console.warn('Video element not found in container:', videoId);
    return;
  }
  
  const label = container.querySelector('.video-label');
  const userName = label ? label.textContent : 'Демонстрация экрана';
  
  // Create modal
  const modal = document.createElement('div');
  modal.id = 'screenShareModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: #000;
    z-index: 10000;
    display: flex;
    flex-direction: column;
  `;
  
  // Resolution options
  const resolutions = {
    '720p': { width: 1280, height: 720, label: 'HD 720p' },
    '1080p': { width: 1920, height: 1080, label: 'Full HD 1080p' },
    '1440p': { width: 2560, height: 1440, label: '2K 1440p' }
  };
  
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    background: #2f3136;
    border-bottom: 1px solid #202225;
  `;
  header.innerHTML = `
    <div style="display: flex; align-items: center; gap: 15px;">
      <span style="color: #fff; font-weight: 600;">🖥️ Демонстрация — ${userName}</span>
      <select id="resolutionSelector" onchange="changeScreenResolution(this.value)" style="
        background: #40444b;
        color: #fff;
        border: 1px solid #202225;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 13px;
        cursor: pointer;
      ">
        <option value="720p" ${currentScreenResolution === '720p' ? 'selected' : ''}>📺 HD 720p (экономично)</option>
        <option value="1080p" ${currentScreenResolution === '1080p' ? 'selected' : ''}>📺 Full HD 1080p</option>
        <option value="1440p" ${currentScreenResolution === '1440p' ? 'selected' : ''}>📺 2K 1440p (макс)</option>
      </select>
    </div>
    <button onclick="closeScreenModal()" style="
      background: #ed4245;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    ">✕ Закрыть (Esc)</button>
  `;
  
  const videoContainer = document.createElement('div');
  videoContainer.id = 'screenShareVideoContainer';
  videoContainer.style.cssText = `
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    overflow: hidden;
  `;
  
  const clonedVideo = document.createElement('video');
  clonedVideo.id = 'screenShareClonedVideo';
  clonedVideo.srcObject = video.srcObject;
  clonedVideo.autoplay = true;
  clonedVideo.playsInline = true;
  
  // Apply resolution constraint
  const res = resolutions[currentScreenResolution];
  clonedVideo.style.cssText = `
    max-width: ${res.width}px;
    max-height: ${res.height}px;
    width: 100%;
    height: 100%;
    object-fit: contain;
  `;
  
  // Add keyboard support to close modal
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      closeScreenModal();
      document.removeEventListener('keydown', handleKeyDown);
    }
  };
  document.addEventListener('keydown', handleKeyDown);
  
  // Close on click outside video
  videoContainer.onclick = (e) => {
    if (e.target === videoContainer) {
      closeScreenModal();
    }
  };
  
  videoContainer.appendChild(clonedVideo);
  modal.appendChild(header);
  modal.appendChild(videoContainer);
  document.body.appendChild(modal);
}

function changeScreenResolution(resolution) {
  currentScreenResolution = resolution;
  const resolutions = {
    '720p': { width: 1280, height: 720 },
    '1080p': { width: 1920, height: 1080 },
    '1440p': { width: 2560, height: 1440 }
  };
  
  const video = document.getElementById('screenShareClonedVideo');
  const container = document.getElementById('screenShareVideoContainer');
  
  if (video && container) {
    const res = resolutions[resolution];
    video.style.maxWidth = res.width + 'px';
    video.style.maxHeight = res.height + 'px';
    console.log('[SCREEN] Resolution changed to:', resolution);
  }
}

function closeScreenModal() {
  const modal = document.getElementById('screenShareModal');
  if (modal) {
    modal.remove();
  }
}

// ========== CHAT ==========

function addChatMessage(sender, text, isSystem = false, time = null) {
  const messages = document.getElementById('chatMessages');
  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-message';
  
  const isMe = sender === currentUser?.username;
  const initial = sender.charAt(0).toUpperCase();
  
  msgDiv.innerHTML = `
    <div class="chat-avatar" style="background: ${isMe ? '#5865f2' : '#3ba55d'}">${initial}</div>
    <div class="chat-content">
      <div class="chat-header-info">
        <span class="chat-sender">${isMe ? 'Вы' : sender}</span>
        <span class="chat-time">${time || new Date().toLocaleTimeString()}</span>
      </div>
      <div class="chat-text">${escapeHtml(text)}</div>
    </div>
  `;
  
  messages.appendChild(msgDiv);
  messages.scrollTop = messages.scrollHeight;
}

function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (text && currentRoom) {
    socket.emit('chat-message', text);
    addChatMessage(currentUser.username, text, false, new Date().toLocaleTimeString());
    input.value = '';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ========== SETTINGS ==========

function toggleSettings() {
  const panel = document.getElementById('settingsPanel');
  panel.classList.toggle('active');
  if (panel.classList.contains('active')) {
    updateRemoteVolumeControls();
  }
}

function updateRemoteVolumeControls() {
  const container = document.getElementById('remoteVolumeControls');
  
  if (peers.size === 0) {
    container.innerHTML = '<p style="color: #72767d; font-size: 12px;">Нет других участников</p>';
    return;
  }
  
  container.innerHTML = '';
  peers.forEach((pc, id) => {
    const user = activeUsers.get(id);
    const name = user ? user.name : 'Участник';
    
    // Get current volume from video element (default 50%)
    const videoContainer = document.getElementById(`video-${id}`);
    const video = videoContainer ? videoContainer.querySelector('video') : null;
    const currentVolume = video ? Math.round(video.volume * 100) : 50;
    
    const div = document.createElement('div');
    div.className = 'remote-volume-item';
    div.innerHTML = `
      <span>${name}</span>
      <input type="range" min="0" max="100" value="${currentVolume}" data-userid="${id}"
             onchange="setRemoteVolume('${id}', this.value)">
    `;
    container.appendChild(div);
  });
}

function setRemoteVolume(userId, value) {
  const container = document.getElementById(`video-${userId}`);
  if (container) {
    const video = container.querySelector('video');
    if (video) {
      video.volume = value / 100;
      console.log(`Volume for ${userId} set to ${value}%`);
    }
  }
  
  // Also update volume in settings panel if it exists
  const settingsVolume = document.querySelector(`#remoteVolumeControls input[data-userid="${userId}"]`);
  if (settingsVolume) {
    settingsVolume.value = value;
  }
}

function setMicVolume(value) {
  localStorage.setItem('micVolume', value);
}

function uploadAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  
  if (file.size > 2 * 1024 * 1024) {
    alert('Файл слишком большой! Максимум 2MB');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    userAvatar = e.target.result;
    localStorage.setItem(`keroschat_avatar_${currentUser.username}`, userAvatar);
    
    // Update preview immediately
    const preview = document.getElementById('avatarPreview');
    if (preview) {
      preview.innerHTML = `<img src="${userAvatar}" alt="Avatar">`;
    }
    
    // Update lobby avatar immediately
    const lobbyAvatar = document.getElementById('lobbyAvatar');
    if (lobbyAvatar) {
      lobbyAvatar.innerHTML = `<img src="${userAvatar}" alt="avatar">`;
    }
    
    // Update room user list if in room
    const localAvatar = document.getElementById('avatar-local');
    if (localAvatar && currentRoom) {
      localAvatar.innerHTML = `<img src="${userAvatar}" alt="avatar">`;
    }
    
    // Update chat avatars
    document.querySelectorAll('.chat-avatar').forEach(avatar => {
      if (avatar.textContent === currentUser.username.charAt(0).toUpperCase()) {
        avatar.innerHTML = `<img src="${userAvatar}" style="width: 100%; height: 100%; object-fit: cover;">`;
      }
    });
    
    alert('Аватар загружен!');
  };
  reader.readAsDataURL(file);
}

// ========== CLEANUP ==========

// ========== LOGGING SYSTEM ==========
const logs = [];

function addLogEntry(category, message) {
  const timestamp = new Date().toLocaleTimeString();
  const entry = { timestamp, category, message };
  logs.push(entry);
  
  // Keep only last 100 entries
  if (logs.length > 100) {
    logs.shift();
  }
  
  // Update log display if settings panel is open
  const logContainer = document.getElementById('logContainer');
  if (logContainer) {
    const logEntry = document.createElement('div');
    logEntry.style.cssText = 'font-size: 12px; color: #b9bbbe; margin-bottom: 4px; font-family: monospace;';
    logEntry.innerHTML = `<span style="color: #72767d;">[${timestamp}]</span> <span style="color: #5865f2;">${category}:</span> ${message}`;
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
  }
  
  console.log(`[${category}] ${message}`);
}

function clearLogs() {
  logs.length = 0;
  const logContainer = document.getElementById('logContainer');
  if (logContainer) {
    logContainer.innerHTML = '';
  }
}

function clearAllCache() {
  if (confirm('Удалить все локальные комнаты? Это не удалит их с сервера, только почистит ваш кэш.')) {
    localStorage.removeItem('keroschat_rooms');
    console.log('Local rooms cache cleared');
    alert('Кэш очищен! Страница перезагрузится.');
    location.reload();
  }
}

// ========== ADMIN PANEL ==========
function showAdminPanel() {
  document.getElementById('adminPanelModal').classList.add('active');
  renderAdminPanel();
}

function hideAdminPanel() {
  document.getElementById('adminPanelModal').classList.remove('active');
}

function renderAdminPanel() {
  // Load all rooms from server
  fetch('/api/rooms')
    .then(res => res.json())
    .then(rooms => {
      // Stats
      const activeRooms = rooms.filter(r => r.active).length;
      const emptyRooms = rooms.filter(r => r.userCount === 0).length;
      const ghostRooms = rooms.filter(r => r.id === r.name && /^[A-Z0-9]{8}$/.test(r.id)).length;
      
      document.getElementById('adminStats').innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
          <div style="background: #40444b; padding: 10px; border-radius: 4px; text-align: center;">
            <div style="font-size: 24px; color: #fff; font-weight: bold;">${rooms.length}</div>
            <div style="font-size: 12px;">Всего комнат</div>
          </div>
          <div style="background: #40444b; padding: 10px; border-radius: 4px; text-align: center;">
            <div style="font-size: 24px; color: #3ba55d; font-weight: bold;">${activeRooms}</div>
            <div style="font-size: 12px;">Активных</div>
          </div>
          <div style="background: #40444b; padding: 10px; border-radius: 4px; text-align: center;">
            <div style="font-size: 24px; color: #faa81a; font-weight: bold;">${emptyRooms}</div>
            <div style="font-size: 12px;">Пустых</div>
          </div>
        </div>
        ${ghostRooms > 0 ? `<div style="margin-top: 10px; color: #ed4245;">⚠️ Найдено ${ghostRooms} призрачных комнат</div>` : ''}
      `;
      
      // Room list
      const listHtml = rooms.map(room => {
        const isGhost = room.id === room.name && /^[A-Z0-9]{8}$/.test(room.id);
        const statusColor = room.active ? '#3ba55d' : '#72767d';
        const userText = room.userCount > 0 ? `${room.userCount} участников` : 'пустая';
        
        return `
          <div style="background: ${isGhost ? '#3a1c1c' : '#40444b'}; padding: 12px; margin-bottom: 8px; border-radius: 4px; border-left: 3px solid ${statusColor};">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="color: #fff; font-weight: 600;">${room.name} ${isGhost ? '👻' : ''}</div>
                <div style="color: #b9bbbe; font-size: 12px; margin-top: 2px;">
                  ID: ${room.id} | ${userText} | Создатель: ${room.creator || 'неизвестен'}
                </div>
                ${room.users && room.users.length > 0 ? `
                  <div style="color: #72767d; font-size: 11px; margin-top: 4px;">
                    👤 ${room.users.join(', ')}
                  </div>
                ` : ''}
              </div>
              <div>
                <button onclick="adminDeleteRoom('${room.id}')" style="padding: 6px 12px; background: #ed4245; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">🗑️ Удалить</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
      
      document.getElementById('adminRoomList').innerHTML = listHtml || '<div style="color: #72767d; text-align: center; padding: 20px;">Нет комнат</div>';
    })
    .catch(err => {
      console.error('Error loading admin data:', err);
      document.getElementById('adminStats').innerHTML = '<span style="color: #ed4245;">Ошибка загрузки</span>';
      document.getElementById('adminRoomList').innerHTML = '<span style="color: #ed4245;">Ошибка загрузки списка комнат</span>';
    });
}

function adminDeleteRoom(roomId) {
  if (!confirm(`Удалить комнату ${roomId}?\n\nЭто действие нельзя отменить!`)) return;
  
  // Delete from localStorage
  const rooms = JSON.parse(localStorage.getItem('keroschat_rooms') || '[]');
  const filtered = rooms.filter(r => r.id !== roomId);
  localStorage.setItem('keroschat_rooms', JSON.stringify(filtered));
  
  // Notify server
  socket.emit('delete-room', roomId);
  
  // Refresh display
  setTimeout(renderAdminPanel, 500);
  addLogEntry('Админ', `Комната ${roomId} удалена администратором`);
}

function forceRefreshRooms() {
  isLoadingRooms = false;
  lastLoadTime = 0;
  loadServerRooms();
  renderAdminPanel();
  addLogEntry('Админ', 'Принудительное обновление списка комнат');
}

function clearGhostRooms() {
  const rooms = JSON.parse(localStorage.getItem('keroschat_rooms') || '[]');
  const ghostIds = rooms
    .filter(r => r.id === r.name && /^[A-Z0-9]{8}$/.test(r.id))
    .map(r => r.id);
  
  if (ghostIds.length === 0) {
    alert('Призрачных комнат не найдено!');
    return;
  }
  
  if (!confirm(`Найдено ${ghostIds.length} призрачных комнат. Удалить их из локального хранилища?`)) return;
  
  const filtered = rooms.filter(r => !ghostIds.includes(r.id));
  localStorage.setItem('keroschat_rooms', JSON.stringify(filtered));
  
  // Also notify server to delete
  ghostIds.forEach(id => socket.emit('delete-room', id));
  
  renderAdminPanel();
  loadServerRooms();
  addLogEntry('Админ', `Очищено ${ghostIds.length} призрачных комнат`);
  alert(`Очищено ${ghostIds.length} призрачных комнат!`);
}

function deleteAllEmptyRooms() {
  fetch('/api/rooms')
    .then(res => res.json())
    .then(rooms => {
      const emptyRooms = rooms.filter(r => r.userCount === 0);
      
      if (emptyRooms.length === 0) {
        alert('Пустых комнат не найдено!');
        return;
      }
      
      if (!confirm(`Найдено ${emptyRooms.length} пустых комнат. Удалить их?\n\n${emptyRooms.map(r => r.name).join(', ')}`)) return;
      
      // Delete all empty rooms
      emptyRooms.forEach(room => {
        // Delete from localStorage
        const localRooms = JSON.parse(localStorage.getItem('keroschat_rooms') || '[]');
        const filtered = localRooms.filter(r => r.id !== room.id);
        localStorage.setItem('keroschat_rooms', JSON.stringify(filtered));
        
        // Notify server
        socket.emit('delete-room', room.id);
      });
      
      setTimeout(() => {
        renderAdminPanel();
        loadServerRooms();
      }, 500);
      
      addLogEntry('Админ', `Удалено ${emptyRooms.length} пустых комнат`);
      alert(`Удалено ${emptyRooms.length} пустых комнат!`);
    });
}

window.addEventListener('beforeunload', () => {
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
  }
  if (screenStream) {
    screenStream.getTracks().forEach(t => t.stop());
  }
});
