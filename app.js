const socket = io();
let localStream = null;
let screenStream = null;
let peers = new Map();
let roomId = '';
let userName = '';
let isMicOn = true;
let isCamOn = true;
let isScreenSharing = false;
let activeUsers = new Map();

const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// Sound effects
const sounds = {
  micOn: new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE'),
  micOff: new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE'),
  screenOn: new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE'),
  screenOff: new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE'),
  join: new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE'),
  leave: new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE')
};

function playSound(soundName) {
  const sound = sounds[soundName];
  if (sound) {
    sound.currentTime = 0;
    sound.play().catch(e => console.log('Sound play failed:', e));
  }
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function joinRoom() {
  userName = document.getElementById('userName').value.trim() || 'Аноним';
  roomId = document.getElementById('roomId').value.trim().toUpperCase() || generateRoomId();
  
  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      localStream = stream;
      socket.emit('join-room', roomId, userName);
      showRoom();
      addVideoStream('local', stream, userName, true, false);
      updateActiveUsers();
    })
    .catch(err => {
      alert('Ошибка доступа к камере/микрофону: ' + err.message);
    });
}

function showRoom() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('roomScreen').style.display = 'flex';
  document.getElementById('roomScreen').style.flexDirection = 'column';
  document.getElementById('displayRoomId').textContent = roomId;
  
  const shareUrl = `${window.location.origin}?room=${roomId}`;
  document.getElementById('shareLink').value = shareUrl;
  
  const urlParams = new URLSearchParams(window.location.search);
  if (!urlParams.get('room')) {
    window.history.replaceState({}, '', `?room=${roomId}`);
  }
}

function copyLink() {
  const link = document.getElementById('shareLink');
  link.select();
  document.execCommand('copy');
  alert('Ссылка скопирована!');
}

function leaveRoom() {
  playSound('leave');
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
  }
  if (screenStream) {
    screenStream.getTracks().forEach(t => t.stop());
  }
  peers.forEach(pc => pc.close());
  peers.clear();
  socket.disconnect();
  location.reload();
}

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
    
    // Fullscreen/Modal button for screen share
    if (isScreenShare) {
      const modalBtn = document.createElement('button');
      modalBtn.innerHTML = '🔍';
      modalBtn.className = 'fullscreen-btn';
      modalBtn.onclick = () => openScreenModal(id, stream, name);
      container.appendChild(modalBtn);
    }
    
    // Volume control for remote
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

function openScreenModal(id, stream, name) {
  const modal = document.getElementById('screenShareModal');
  const backdrop = document.getElementById('screenBackdrop');
  const container = document.getElementById('modalVideoContainer');
  
  container.innerHTML = '';
  const video = document.createElement('video');
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  video.style.width = '100%';
  video.style.height = '100%';
  container.appendChild(video);
  
  modal.classList.add('active');
  backdrop.classList.add('active');
}

function closeScreenModal() {
  document.getElementById('screenShareModal').classList.remove('active');
  document.getElementById('screenBackdrop').classList.remove('active');
}

function sendModalMessage() {
  const input = document.getElementById('modalChatInput');
  const text = input.value.trim();
  if (text) {
    socket.emit('chat-message', text);
    addModalChatMessage(userName, text);
    input.value = '';
  }
}

function addModalChatMessage(sender, text) {
  const messages = document.getElementById('modalChatMessages');
  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-message';
  msgDiv.innerHTML = `
    <div class="chat-avatar" style="width: 32px; height: 32px; font-size: 12px;">${sender.charAt(0)}</div>
    <div class="chat-content">
      <div class="chat-header-info">
        <span class="chat-sender" style="font-size: 13px;">${sender}</span>
        <span class="chat-time" style="font-size: 11px;">${new Date().toLocaleTimeString()}</span>
      </div>
      <div class="chat-text" style="font-size: 13px;">${escapeHtml(text)}</div>
    </div>
  `;
  messages.appendChild(msgDiv);
  messages.scrollTop = messages.scrollHeight;
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
  
  // Add local user
  const localItem = document.createElement('div');
  localItem.className = 'user-item';
  localItem.innerHTML = `
    <div class="user-avatar">${userName.charAt(0).toUpperCase()}</div>
    <span class="user-name">${userName} (Вы)</span>
    <div class="user-status"></div>
  `;
  list.appendChild(localItem);
  
  // Add remote users
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
}

async function createPeerConnection(userId) {
  const pc = new RTCPeerConnection(iceServers);
  
  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream);
  });
  
  pc.ontrack = (e) => {
    const stream = e.streams[0];
    socket.emit('get-user-name', userId, (name) => {
      addVideoStream(userId, stream, name || 'Участник');
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

socket.on('users-in-room', async (users) => {
  playSound('join');
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
  playSound('join');
  activeUsers.set(user.id, user);
  addChatMessage('Система', `${user.name} присоединился`, true);
  updateActiveUsers();
});

socket.on('user-left', (userId) => {
  playSound('leave');
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
  addModalChatMessage(msg.sender, msg.text);
});

socket.on('screen-share-started', (userId) => {
  const container = document.getElementById(`video-${userId}`);
  if (container) container.classList.add('screen-share');
});

socket.on('screen-share-stopped', (userId) => {
  const container = document.getElementById(`video-${userId}`);
  if (container) container.classList.remove('screen-share');
});

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
        playSound('micOn');
      } else {
        btn.classList.add('danger');
        btn.querySelector('.label').textContent = 'Мик выкл';
        playSound('micOff');
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
    playSound('screenOff');
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
    addVideoStream('local', localStream, userName, true, false);
    
    isScreenSharing = false;
    socket.emit('screen-share-stopped');
    
    const btn = document.getElementById('screenBtn');
    btn.classList.remove('active');
    btn.querySelector('.label').textContent = 'Экран';
  } else {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      playSound('screenOn');
      
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
      addVideoStream('local', screenStream, userName, true, true);
      
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

function addChatMessage(sender, text, isSystem = false, time = null) {
  const messages = document.getElementById('chatMessages');
  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-message';
  
  const isMe = sender === userName;
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
  if (text) {
    socket.emit('chat-message', text);
    addChatMessage(userName, text, false, new Date().toLocaleTimeString());
    input.value = '';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

// Microphone test variables
let micTestStream = null;
let micTestInterval = null;
let audioContext = null;
let analyser = null;

async function testMicrophone() {
  try {
    micTestStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(micTestStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 32;
    source.connect(analyser);
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const bars = document.querySelectorAll('.mic-bar');
    
    micTestInterval = setInterval(() => {
      analyser.getByteFrequencyData(dataArray);
      
      bars.forEach((bar, index) => {
        const value = dataArray[index] || 0;
        const height = Math.max(4, (value / 255) * 40);
        bar.style.height = `${height}px`;
        
        if (value > 200) {
          bar.style.background = '#ed4245';
        } else if (value > 100) {
          bar.style.background = '#5865f2';
        } else {
          bar.style.background = '#3ba55d';
        }
      });
    }, 50);
    
  } catch (err) {
    alert('Ошибка доступа к микрофону: ' + err.message);
  }
}

function stopMicTest() {
  if (micTestInterval) {
    clearInterval(micTestInterval);
    micTestInterval = null;
  }
  if (micTestStream) {
    micTestStream.getTracks().forEach(t => t.stop());
    micTestStream = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  
  const bars = document.querySelectorAll('.mic-bar');
  bars.forEach(bar => {
    bar.style.height = '4px';
    bar.style.background = '#5865f2';
  });
}

function createNewRoom() {
  const newRoomId = generateRoomId();
  document.getElementById('roomId').value = newRoomId;
  
  const btn = document.querySelector('.create-room-btn');
  btn.textContent = '✅ Комната создана!';
  setTimeout(() => {
    btn.textContent = '➕ Создать комнату';
  }, 2000);
}

window.addEventListener('beforeunload', () => {
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
  }
  if (screenStream) {
    screenStream.getTracks().forEach(t => t.stop());
  }
});

window.addEventListener('load', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const room = urlParams.get('room');
  if (room) {
    document.getElementById('roomId').value = room;
  }
});
