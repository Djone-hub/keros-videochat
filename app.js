const socket = io();
let localStream = null;
let screenStream = null;
let peers = new Map();
let roomId = '';
let userName = '';
let isMicOn = true;
let isCamOn = true;
let isScreenSharing = false;

const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

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
      addVideoStream('local', stream, userName, true);
    })
    .catch(err => {
      alert('Ошибка доступа к камере/микрофону: ' + err.message);
    });
}

function showRoom() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('roomScreen').style.display = 'block';
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

function addVideoStream(id, stream, name, isLocal = false) {
  let container = document.getElementById(`video-${id}`);
  if (!container) {
    container = document.createElement('div');
    container.className = 'video-container' + (isScreenSharing && isLocal ? ' screen-share' : '');
    container.id = `video-${id}`;
    
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = isLocal;
    if (isLocal) video.style.transform = 'scaleX(-1)';
    
    const label = document.createElement('div');
    label.className = 'video-label';
    label.textContent = isLocal ? `${name} (Вы)` : name;
    
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
    }
  };
  
  peers.set(userId, pc);
  return pc;
}

socket.on('users-in-room', async (users) => {
  for (const user of users) {
    const pc = await createPeerConnection(user.id);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('offer', user.id, offer);
  }
  updateUserList();
});

socket.on('user-joined', async (user) => {
  addChatMessage('Система', `${user.name} присоединился`, true);
  updateUserList();
});

socket.on('user-left', (userId) => {
  removeVideoStream(userId);
  if (peers.has(userId)) {
    peers.get(userId).close();
    peers.delete(userId);
  }
  addChatMessage('Система', 'Участник вышел', true);
  updateUserList();
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
      document.getElementById('micBtn').textContent = isMicOn ? '🎤 Микрофон (вкл)' : '🎤 Микрофон (выкл)';
      document.getElementById('micBtn').classList.toggle('active', !isMicOn);
    }
  }
}

function toggleCam() {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      isCamOn = videoTrack.enabled;
      document.getElementById('camBtn').textContent = isCamOn ? '📹 Камера (вкл)' : '📹 Камера (выкл)';
      document.getElementById('camBtn').classList.toggle('active', !isCamOn);
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
    const localVideo = localContainer.querySelector('video');
    localVideo.srcObject = localStream;
    localContainer.classList.remove('screen-share');
    
    isScreenSharing = false;
    socket.emit('screen-share-stopped');
    document.getElementById('screenBtn').textContent = '🖥️ Демонстрация экрана';
    document.getElementById('screenBtn').classList.remove('active');
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
      const localVideo = localContainer.querySelector('video');
      localVideo.srcObject = screenStream;
      localContainer.classList.add('screen-share');
      
      isScreenSharing = true;
      socket.emit('screen-share-started');
      document.getElementById('screenBtn').textContent = '🖥️ Остановить демонстрацию';
      document.getElementById('screenBtn').classList.add('active');
    } catch (err) {
      console.error('Screen share error:', err);
    }
  }
}

function addChatMessage(sender, text, isSystem = false, time = null) {
  const messages = document.getElementById('chatMessages');
  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-message';
  if (isSystem) msgDiv.style.opacity = '0.7';
  
  msgDiv.innerHTML = `
    <div class="sender">${sender}</div>
    <div class="text">${escapeHtml(text)}</div>
    ${time ? `<div class="time">${time}</div>` : ''}
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

function updateUserList() {
  const list = document.getElementById('userList');
  list.innerHTML = `<div class="user-item">${userName} (Вы)</div>`;
  peers.forEach((pc, id) => {
    list.innerHTML += `<div class="user-item">Участник ${id.substr(0, 6)}</div>`;
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

window.addEventListener('load', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const room = urlParams.get('room');
  if (room) {
    document.getElementById('roomId').value = room;
  }
});
