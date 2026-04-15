// Keros VideoChat - Full Authentication & Lobby System
const socket = io();

// State
let currentUser = null;
let currentRoom = null;
let localStream = null;
let screenStream = null;
let peers = new Map();
let activeUsers = new Map();
let isMicOn = true;
let isCamOn = true;
let isScreenSharing = false;
let userAvatar = null;

const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// ========== AUTHENTICATION ==========

// Check if user is already logged in
window.addEventListener('load', () => {
  const savedUser = localStorage.getItem('keroschat_user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    userAvatar = localStorage.getItem('keroschat_avatar');
    showLobby();
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
    showLobby();
  } else {
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
  showLobby();
  alert('Регистрация успешна!');
}

function logout() {
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
  
  // Load rooms
  loadRoomsList();
}

function loadRoomsList() {
  const rooms = JSON.parse(localStorage.getItem('keroschat_rooms') || '[]');
  const list = document.getElementById('roomsList');
  list.innerHTML = '';
  
  if (rooms.length === 0) {
    list.innerHTML = '<p style="color: #72767d; padding: 16px; text-align: center;">Нет комнат. Создайте первую!</p>';
    return;
  }
  
  rooms.forEach(room => {
    const item = document.createElement('div');
    item.className = 'room-item';
    item.onclick = () => joinRoomById(room.id);
    item.innerHTML = `
      <div class="icon">#</div>
      <div class="info">
        <div class="name">${room.name}</div>
        <div class="count">Нажмите чтобы присоединиться</div>
      </div>
    `;
    list.appendChild(item);
  });
}

function showCreateRoomModal() {
  document.getElementById('createRoomModal').classList.add('active');
  document.getElementById('newRoomName').focus();
}

function hideCreateRoomModal() {
  document.getElementById('createRoomModal').classList.remove('active');
  document.getElementById('newRoomName').value = '';
}

function createRoom() {
  const name = document.getElementById('newRoomName').value.trim();
  if (!name) {
    alert('Введите название комнаты!');
    return;
  }
  
  const roomId = generateRoomId();
  const rooms = JSON.parse(localStorage.getItem('keroschat_rooms') || '[]');
  rooms.push({ id: roomId, name, created: Date.now(), creator: currentUser.username });
  localStorage.setItem('keroschat_rooms', JSON.stringify(rooms));
  
  hideCreateRoomModal();
  loadRoomsList();
  joinRoomById(roomId);
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// ========== ROOM ==========

async function joinRoomById(roomId) {
  currentRoom = roomId;
  
  // Request media
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch (err) {
    alert('Ошибка доступа к камере/микрофону: ' + err.message);
    return;
  }
  
  // Join socket room
  socket.emit('join-room', roomId, currentUser.username);
  
  // Show room UI
  showRoomUI();
  
  // Add local video
  addVideoStream('local', localStream, currentUser.username, true, false);
  updateActiveUsers();
}

function showRoomUI() {
  document.getElementById('lobbyScreen').style.display = 'none';
  document.getElementById('roomScreen').style.display = 'flex';
  document.getElementById('roomScreen').style.flexDirection = 'column';
  document.getElementById('displayRoomId').textContent = currentRoom;
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

function copyLink() {
  const link = `${window.location.origin}?room=${currentRoom}`;
  navigator.clipboard.writeText(link).then(() => {
    alert('Ссылка скопирована!');
  });
}

// ========== VIDEO & PEERS ==========

function addVideoStream(id, stream, name, isLocal = false, isScreenShare = false) {
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
        <input type="range" min="0" max="100" value="100" 
               onchange="setRemoteVolume('${id}', this.value)" title="Громкость">
      `;
      label.appendChild(volumeControl);
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
  
  // Local user
  const localItem = document.createElement('div');
  localItem.className = 'user-item';
  const avatarHtml = userAvatar ? 
    `<img src="${userAvatar}" alt="avatar">` :
    currentUser.username.charAt(0).toUpperCase();
  localItem.innerHTML = `
    <div class="user-avatar">${avatarHtml}</div>
    <span class="user-name">${currentUser.username} (Вы)</span>
    <div class="user-status"></div>
  `;
  list.appendChild(localItem);
  
  // Remote users
  peers.forEach((pc, id) => {
    const user = activeUsers.get(id);
    const item = document.createElement('div');
    item.className = 'user-item';
    item.innerHTML = `
      <div class="user-avatar">${user ? user.name.charAt(0).toUpperCase() : '?'}</div>
      <span class="user-name">${user ? user.name : 'Участник'}</span>
      <div class="user-status"></div>
    `;
    list.appendChild(item);
  });
  
  // Update settings if open
  const settingsPanel = document.getElementById('settingsPanel');
  if (settingsPanel.classList.contains('active')) {
    updateRemoteVolumeControls();
  }
}

async function createPeerConnection(userId) {
  const pc = new RTCPeerConnection(iceServers);
  
  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream);
  });
  
  pc.ontrack = (e) => {
    const stream = e.streams[0];
    socket.emit('get-user-name', userId, (name) => {
      const userName = name || 'Участник';
      if (!activeUsers.has(userId)) {
        activeUsers.set(userId, { id: userId, name: userName });
      }
      addVideoStream(userId, stream, userName);
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

socket.on('users-in-room', async (users) => {
  for (const user of users) {
    activeUsers.set(user.id, user);
    const pc = await createPeerConnection(user.id);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('offer', user.id, offer);
  }
  updateActiveUsers();
});

socket.on('user-joined', async (user) => {
  activeUsers.set(user.id, user);
  addChatMessage('Система', `${user.name} присоединился`, true);
  updateActiveUsers();
});

socket.on('user-left', (userId) => {
  removeVideoStream(userId);
  if (peers.has(userId)) {
    peers.get(userId).close();
    peers.delete(userId);
  }
  activeUsers.delete(userId);
  addChatMessage('Система', 'Участник вышел', true);
  updateActiveUsers();
});

socket.on('offer', async (userId, offer) => {
  const pc = await createPeerConnection(userId);
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('answer', userId, answer);
  updateActiveUsers();
});

socket.on('answer', async (userId, answer) => {
  if (peers.has(userId)) {
    await peers.get(userId).setRemoteDescription(answer);
  }
});

socket.on('ice-candidate', async (userId, candidate) => {
  if (peers.has(userId)) {
    await peers.get(userId).addIceCandidate(new RTCIceCandidate(candidate));
  }
});

socket.on('chat-message', (msg) => {
  addChatMessage(msg.sender, msg.text, false, msg.time);
});

// ========== CONTROLS ==========

function toggleMic() {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      isMicOn = audioTrack.enabled;
      
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
  if (isScreenSharing) {
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
    }
    
    const videoTrack = localStream.getVideoTracks()[0];
    peers.forEach(pc => {
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender && videoTrack) {
        sender.replaceTrack(videoTrack);
      }
    });
    
    const localContainer = document.getElementById('video-local');
    if (localContainer) {
      localContainer.remove();
    }
    addVideoStream('local', localStream, currentUser.username, true, false);
    
    isScreenSharing = false;
    socket.emit('screen-share-stopped');
    
    const btn = document.getElementById('screenBtn');
    btn.classList.remove('active');
    btn.querySelector('.label').textContent = 'Экран';
  } else {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      
      const screenTrack = screenStream.getVideoTracks()[0];
      screenTrack.onended = () => toggleScreen();
      
      peers.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      });
      
      const localContainer = document.getElementById('video-local');
      if (localContainer) {
        localContainer.remove();
      }
      addVideoStream('local', screenStream, currentUser.username, true, true);
      
      isScreenSharing = true;
      socket.emit('screen-share-started');
      
      const btn = document.getElementById('screenBtn');
      btn.classList.add('active');
      btn.querySelector('.label').textContent = 'Экран вкл';
    } catch (err) {
      console.error('Screen share error:', err);
    }
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
    
    const div = document.createElement('div');
    div.className = 'remote-volume-item';
    div.innerHTML = `
      <span>${name}</span>
      <input type="range" min="0" max="100" value="100" 
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
    }
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
    
    // Update preview
    const preview = document.getElementById('avatarPreview');
    preview.innerHTML = `<img src="${userAvatar}" alt="Avatar">`;
    
    // Update lobby avatar
    const lobbyAvatar = document.getElementById('lobbyAvatar');
    lobbyAvatar.innerHTML = `<img src="${userAvatar}" alt="avatar">`;
    
    alert('Аватар загружен!');
  };
  reader.readAsDataURL(file);
}

// ========== CLEANUP ==========

window.addEventListener('beforeunload', () => {
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
  }
  if (screenStream) {
    screenStream.getTracks().forEach(t => t.stop());
  }
});
