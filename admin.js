// ========== ADMIN PANEL FUNCTIONS ==========

// Show/hide admin panel
function showAdminPanel() {
  document.getElementById('adminPanelModal').classList.add('active');
  renderAdminPanel();
  loadUserSettings();
}

function hideAdminPanel() {
  document.getElementById('adminPanelModal').classList.remove('active');
}

// Tab switching
function switchAdminTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    }
  });
  
  // Update tab content
  document.querySelectorAll('.admin-tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById('adminTab-' + tabName).classList.add('active');
}

// Render admin panel with stats and rooms
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
        <div class="admin-stat-card">
          <div class="number">${rooms.length}</div>
          <div class="label">Всего комнат</div>
        </div>
        <div class="admin-stat-card">
          <div class="number" style="color: #3ba55d;">${activeRooms}</div>
          <div class="label">Активных</div>
        </div>
        <div class="admin-stat-card">
          <div class="number" style="color: #faa81a;">${emptyRooms}</div>
          <div class="label">Пустых</div>
        </div>
        ${ghostRooms > 0 ? `
        <div class="admin-stat-card" style="background: #3a1c1c;">
          <div class="number" style="color: #ed4245;">${ghostRooms}</div>
          <div class="label">👻 Призраков</div>
        </div>
        ` : ''}
      `;
      
      // Room list with new styling
      window.allAdminRooms = rooms; // Store for filtering
      renderAdminRoomList(rooms);
    })
    .catch(err => {
      console.error('Error loading admin data:', err);
      document.getElementById('adminStats').innerHTML = '<span style="color: #ed4245;">Ошибка загрузки</span>';
      document.getElementById('adminRoomList').innerHTML = '<span style="color: #ed4245;">Ошибка загрузки списка комнат</span>';
    });
}

function renderAdminRoomList(rooms) {
  const listHtml = rooms.map(room => {
    const isGhost = room.id === room.name && /^[A-Z0-9]{8}$/.test(room.id);
    const isEmpty = room.userCount === 0;
    const itemClass = isGhost ? 'ghost' : (isEmpty ? 'empty' : '');
    
    return `
      <div class="admin-room-item ${itemClass}">
        <div class="admin-room-info">
          <div class="admin-room-name">${room.name} ${isGhost ? '👻' : ''}</div>
          <div class="admin-room-meta">
            ID: ${room.id} | ${room.userCount > 0 ? room.userCount + ' участников' : 'пустая'} | Создатель: ${room.creator || 'неизвестен'}
            ${room.users && room.users.length > 0 ? `<br>👤 ${room.users.join(', ')}` : ''}
          </div>
        </div>
        <button onclick="adminDeleteRoom('${room.id}')" class="admin-btn danger small">🗑️</button>
      </div>
    `;
  }).join('');
  
  document.getElementById('adminRoomList').innerHTML = listHtml || '<div style="color: #72767d; text-align: center; padding: 20px;">Нет комнат</div>';
}

function filterAdminRooms(searchTerm) {
  if (!window.allAdminRooms) return;
  
  const filtered = window.allAdminRooms.filter(room => 
    room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    room.id.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  renderAdminRoomList(filtered);
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

function showCreateRoomFromAdmin() {
  hideAdminPanel();
  showCreateRoomModal();
}

// ========== USER SETTINGS ==========

const themes = {
  dark: {
    '--bg-primary': '#36393f',
    '--bg-secondary': '#2f3136',
    '--bg-tertiary': '#202225',
    '--text-primary': '#fff',
    '--text-secondary': '#b9bbbe',
    '--accent': '#5865f2'
  },
  blue: {
    '--bg-primary': '#1a237e',
    '--bg-secondary': '#283593',
    '--bg-tertiary': '#0d47a1',
    '--text-primary': '#fff',
    '--text-secondary': '#b3e5fc',
    '--accent': '#2196f3'
  },
  red: {
    '--bg-primary': '#b71c1c',
    '--bg-secondary': '#c62828',
    '--bg-tertiary': '#7f0000',
    '--text-primary': '#fff',
    '--text-secondary': '#ffcdd2',
    '--accent': '#f44336'
  },
  green: {
    '--bg-primary': '#1b5e20',
    '--bg-secondary': '#2e7d32',
    '--bg-tertiary': '#0d3b10',
    '--text-primary': '#fff',
    '--text-secondary': '#c8e6c9',
    '--accent': '#4caf50'
  },
  purple: {
    '--bg-primary': '#4a148c',
    '--bg-secondary': '#6a1b9a',
    '--bg-tertiary': '#311b92',
    '--text-primary': '#fff',
    '--text-secondary': '#e1bee7',
    '--accent': '#9c27b0'
  }
};

function loadUserSettings() {
  // Load saved theme
  const savedTheme = localStorage.getItem('keroschat_theme') || 'dark';
  setTheme(savedTheme);
  
  // Load saved volumes
  const micVol = localStorage.getItem('keroschat_mic_volume') || '100';
  const vidVol = localStorage.getItem('keroschat_video_volume') || '100';
  
  document.getElementById('micVolume').value = micVol;
  document.getElementById('vidVolume').value = vidVol;
  document.getElementById('micVolVal').textContent = micVol;
  document.getElementById('vidVolVal').textContent = vidVol;
  
  // Update avatar preview
  const avatar = localStorage.getItem('keroschat_avatar');
  if (avatar) {
    document.getElementById('adminAvatarPreview').innerHTML = `<img src="${avatar}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
  }
}

function setTheme(themeName) {
  const theme = themes[themeName];
  if (!theme) return;
  
  const root = document.documentElement;
  Object.entries(theme).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  
  localStorage.setItem('keroschat_theme', themeName);
  
  // Update active button
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.onclick.toString().includes(themeName)) {
      btn.classList.add('active');
    }
  });
  
  addLogEntry('Настройки', `Тема изменена на ${themeName}`);
}

function updateVolume(type, value) {
  const displayVal = type === 'mic' ? 'micVolVal' : 'vidVolVal';
  document.getElementById(displayVal).textContent = value;
  
  localStorage.setItem(`keroschat_${type}_volume`, value);
  
  // Apply volume to actual elements
  if (type === 'mic' && localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      // WebRTC doesn't have direct volume control, would need audio context
      console.log('[AUDIO] Mic volume set to:', value);
    }
  } else if (type === 'vid') {
    // Apply to all remote videos
    document.querySelectorAll('.video-container:not(#video-local) video').forEach(video => {
      video.volume = value / 100;
    });
  }
}

function updateAdminAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const avatarData = e.target.result;
    localStorage.setItem('keroschat_avatar', avatarData);
    
    // Update preview
    document.getElementById('adminAvatarPreview').innerHTML = `<img src="${avatarData}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    
    // Update main UI
    updateAvatarDisplay(avatarData);
    
    addLogEntry('Настройки', 'Аватар обновлён');
  };
  reader.readAsDataURL(file);
}

function updateAvatarDisplay(avatarData) {
  // Update lobby avatar
  const lobbyAvatar = document.getElementById('lobbyAvatar');
  if (lobbyAvatar) {
    lobbyAvatar.innerHTML = `<img src="${avatarData}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
  }
  
  // Update room avatar if in room
  if (currentUser) {
    currentUser.avatar = avatarData;
    // Re-emit to update others
    if (currentRoom) {
      socket.emit('update-avatar', avatarData);
    }
  }
}

function setCameraQuality(quality) {
  localStorage.setItem('keroschat_camera_quality', quality);
  addLogEntry('Настройки', `Качество камеры: ${quality}`);
  
  // Apply if in call
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      const constraints = {
        low: { width: 640, height: 480 },
        medium: { width: 1280, height: 720 },
        high: { width: 1920, height: 1080 }
      };
      
      videoTrack.applyConstraints(constraints[quality]).catch(err => {
        console.error('Error applying camera constraints:', err);
      });
    }
  }
}

// ========== VIP CHANNELS ==========

function createVIPChannel() {
  const channelName = prompt('Введите название VIP канала:');
  if (!channelName) return;
  
  const password = prompt('Установите пароль для доступа (или оставьте пустым):');
  
  const vipChannels = JSON.parse(localStorage.getItem('keroschat_vip_channels') || '[]');
  
  const newChannel = {
    id: 'vip-' + Date.now(),
    name: channelName,
    password: password,
    created: Date.now(),
    creator: currentUser?.username || 'unknown'
  };
  
  vipChannels.push(newChannel);
  localStorage.setItem('keroschat_vip_channels', JSON.stringify(vipChannels));
  
  renderVIPChannelsList();
  addLogEntry('VIP', `Создан VIP канал: ${channelName}`);
}

function renderVIPChannelsList() {
  const vipChannels = JSON.parse(localStorage.getItem('keroschat_vip_channels') || '[]');
  
  const listHtml = vipChannels.map(channel => `
    <div class="vip-channel-item">
      <span>🔒 ${channel.name}</span>
      <button onclick="configureVIPChannel('${channel.id}')" class="admin-btn small">Настроить</button>
    </div>
  `).join('');
  
  document.getElementById('vipChannelsList').innerHTML = listHtml || '<div style="color: #72767d; text-align: center; padding: 20px;">Нет VIP каналов</div>';
}

function configureVIPChannel(channelId) {
  const vipChannels = JSON.parse(localStorage.getItem('keroschat_vip_channels') || '[]');
  const channel = vipChannels.find(c => c.id === channelId);
  
  if (!channel) return;
  
  const action = prompt(`Настройка канала "${channel.name}"\n\nВыберите действие:\n1 - Изменить пароль\n2 - Удалить канал\n3 - Отмена`);
  
  if (action === '1') {
    const newPassword = prompt('Новый пароль (оставьте пустым для открытого доступа):');
    channel.password = newPassword;
    localStorage.setItem('keroschat_vip_channels', JSON.stringify(vipChannels));
    addLogEntry('VIP', `Обновлён пароль канала: ${channel.name}`);
  } else if (action === '2') {
    if (confirm(`Удалить VIP канал "${channel.name}"?`)) {
      const filtered = vipChannels.filter(c => c.id !== channelId);
      localStorage.setItem('keroschat_vip_channels', JSON.stringify(filtered));
      renderVIPChannelsList();
      addLogEntry('VIP', `Удалён канал: ${channel.name}`);
    }
  }
}

// Initialize VIP channels list when opening admin panel
function initAdminPanel() {
  renderVIPChannelsList();
}
