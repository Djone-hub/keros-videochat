// ========== ADMIN PANEL FUNCTIONS ==========

// Show/hide admin panel
function showAdminPanel() {
  const panel = document.getElementById('adminPanelModal');
  if (panel) {
    panel.classList.add('active');
    renderAdminPanel();
  }
}

function hideAdminPanel() {
  const panel = document.getElementById('adminPanelModal');
  if (panel) {
    panel.classList.remove('active');
  }
}

function switchAdminTab(tabName) {
  // Hide all tab contents
  document.querySelectorAll('.admin-tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  // Remove active class from all tab buttons
  document.querySelectorAll('.admin-tab').forEach(button => {
    button.classList.remove('active');
  });

  // Show selected tab content
  const selectedTab = document.getElementById(`adminTab-${tabName}`);
  if (selectedTab) {
    selectedTab.classList.add('active');
  }
  
  // Add active class to selected tab button
  document.querySelectorAll('.admin-tab').forEach(button => {
    if (button.getAttribute('onclick')?.includes(`switchAdminTab('${tabName}')`)) {
      button.classList.add('active');
    }
  });
}

function renderAdminPanel() {
  fetch('/api/rooms')
    .then(res => res.json())
    .then(rooms => {
      window.allAdminRooms = rooms;
      renderAdminStats(rooms);
      renderAdminRoomList(rooms);
      loadUserSettings();
      renderVIPChannelsList();
    })
    .catch(err => {
      console.error('Error loading admin data:', err);
      const statsEl = document.getElementById('adminStats');
      const roomsEl = document.getElementById('adminRoomList');
      if (statsEl) statsEl.innerHTML = '<div style="text-align: center; padding: 40px; color: #ed4245;">❌ Ошибка загрузки статистики</div>';
      if (roomsEl) roomsEl.innerHTML = '<div style="text-align: center; padding: 40px; color: #ed4245;">❌ Ошибка загрузки комнат</div>';
    });
}

function renderAdminStats(rooms) {
  const totalRooms = rooms.length;
  const activeRooms = rooms.filter(r => r.active).length;
  const emptyRooms = rooms.filter(r => r.userCount === 0).length;
  const ghostRooms = rooms.filter(r => r.id === r.name && /^[A-Z0-9]{8}$/.test(r.id)).length;
  const totalUsers = rooms.reduce((sum, r) => sum + (r.userCount || 0), 0);

  const statsEl = document.getElementById('adminStats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="admin-stat-card">
        <div class="number">${totalRooms}</div>
        <div class="label">Всего комнат</div>
      </div>
      <div class="admin-stat-card">
        <div class="number" style="color: #3ba55d;">${activeRooms}</div>
        <div class="label">Активных</div>
      </div>
      <div class="admin-stat-card">
        <div class="number" style="color: #faa81a;">${totalUsers}</div>
        <div class="label">Пользователей</div>
      </div>
      <div class="admin-stat-card">
        <div class="number" style="color: #72767d;">${emptyRooms}</div>
        <div class="label">Пустых комнат</div>
      </div>
      <div class="admin-stat-card">
        <div class="number" style="color: #ed4245;">${ghostRooms}</div>
        <div class="label">Призраков 👻</div>
      </div>
    `;
  }
}

function renderAdminRoomList(rooms) {
  const listEl = document.getElementById('adminRoomList');
  if (!listEl) return;
  
  if (rooms.length === 0) {
    listEl.innerHTML = '<div style="text-align: center; padding: 40px; color: #72767d;">😕 Нет комнат для отображения</div>';
    return;
  }

  const listHtml = rooms.map(room => {
    const isGhost = room.id === room.name && /^[A-Z0-9]{8}$/.test(room.id);
    const isEmpty = room.userCount === 0;
    let statusClass = '';
    let statusIcon = '';
    
    if (isGhost) {
      statusClass = 'ghost';
      statusIcon = '👻';
    } else if (isEmpty) {
      statusClass = 'empty';
      statusIcon = '⚪';
    } else {
      statusIcon = '🔥';
    }
    
    return `
    <div class="admin-room-item ${statusClass}">
      <div class="admin-room-info">
        <div class="admin-room-name">${statusIcon} ${room.name}</div>
        <div class="admin-room-meta">ID: ${room.id} | Участников: ${room.userCount || 0} ${room.creator ? '| Создатель: ' + room.creator : ''}</div>
      </div>
      <div class="room-actions">
        <button class="admin-btn small danger" onclick="adminDeleteRoom('${room.id}')" title="Удалить комнату">🗑️</button>
      </div>
    </div>
  `}).join('');

  listEl.innerHTML = listHtml;
}

function filterAdminRooms(searchTerm) {
  if (!window.allAdminRooms) return;
  
  const term = searchTerm || document.getElementById('adminRoomSearch')?.value || '';
  const lowerTerm = term.toLowerCase();

  const filtered = window.allAdminRooms.filter(room =>
    room.name.toLowerCase().includes(lowerTerm) ||
    room.id.toLowerCase().includes(lowerTerm) ||
    (room.creator && room.creator.toLowerCase().includes(lowerTerm))
  );
  renderAdminRoomList(filtered);
}

function adminDeleteRoom(roomId) {
  if (!confirm(`Вы уверены, что хотите удалить комнату ${roomId}?`)) return;
  socket.emit('delete-room', roomId);
  setTimeout(renderAdminPanel, 300);
}

function forceRefreshRooms() {
  renderAdminPanel();
}

function clearGhostRooms() {
  if (!window.allAdminRooms) return;
  const ghostRooms = window.allAdminRooms.filter(r => r.id === r.name && /^[A-Z0-9]{8}$/.test(r.id));
  if (ghostRooms.length === 0) {
    alert('Призрачные комнаты не найдены.');
    return;
  }
  if (confirm(`Найдено ${ghostRooms.length} призрачных комнат. Удалить их?`)) {
    ghostRooms.forEach(room => socket.emit('delete-room', room.id));
    setTimeout(renderAdminPanel, 500);
  }
}

function deleteAllEmptyRooms() {
  if (!window.allAdminRooms) return;
  const emptyRooms = window.allAdminRooms.filter(r => r.userCount === 0);
  if (emptyRooms.length === 0) {
    alert('Пустые комнаты не найдены.');
    return;
  }
  if (confirm(`Найдено ${emptyRooms.length} пустых комнат. Удалить их все?`)) {
    emptyRooms.forEach(room => socket.emit('delete-room', room.id));
    setTimeout(renderAdminPanel, 500);
  }
}

function showCreateRoomFromAdmin() {
  hideAdminPanel();
  showCreateRoomModal();
}

const themes = {
  dark: { '--bg-primary': '#36393f', '--bg-secondary': '#2f3136', '--bg-tertiary': '#202225', '--text-primary': '#fff', '--text-secondary': '#b9bbbe', '--accent': '#5865f2' },
  blue: { '--bg-primary': '#1a237e', '--bg-secondary': '#283593', '--bg-tertiary': '#0d47a1', '--text-primary': '#fff', '--text-secondary': '#b3e5fc', '--accent': '#2196f3' },
  red: { '--bg-primary': '#b71c1c', '--bg-secondary': '#c62828', '--bg-tertiary': '#7f0000', '--text-primary': '#fff', '--text-secondary': '#ffcdd2', '--accent': '#f44336' },
  green: { '--bg-primary': '#1b5e20', '--bg-secondary': '#2e7d32', '--bg-tertiary': '#0d3b10', '--text-primary': '#fff', '--text-secondary': '#c8e6c9', '--accent': '#4caf50' },
  purple: { '--bg-primary': '#4a148c', '--bg-secondary': '#6a1b9a', '--bg-tertiary': '#311b92', '--text-primary': '#fff', '--text-secondary': '#e1bee7', '--accent': '#9c27b0' }
};

function loadUserSettings() {
  const savedTheme = localStorage.getItem('keroschat_theme') || 'dark';
  setTheme(savedTheme);

  const micVol = localStorage.getItem('keroschat_mic_volume') || '100';
  const vidVol = localStorage.getItem('keroschat_video_volume') || '100';

  // Update admin panel sliders
  const adminMicSlider = document.getElementById('adminMicVolume');
  const adminVidSlider = document.getElementById('adminVidVolume');
  if (adminMicSlider) adminMicSlider.value = micVol;
  if (adminVidSlider) adminVidSlider.value = vidVol;

  const micVolVal = document.getElementById('micVolVal');
  const vidVolVal = document.getElementById('vidVolVal');
  if (micVolVal) micVolVal.textContent = micVol;
  if (vidVolVal) vidVolVal.textContent = vidVol;

  // Update avatar preview in admin panel
  const avatar = userAvatar || localStorage.getItem(`keroschat_avatar_${currentUser?.username}`);
  const preview = document.getElementById('adminAvatarPreview');
  if (preview) {
    if (avatar) {
      preview.innerHTML = `<img src="${avatar}" alt="avatar" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else if (currentUser?.username) {
      preview.textContent = currentUser.username.charAt(0).toUpperCase();
    }
  }
  
  // Update lobby avatar
  const lobbyAvatar = document.getElementById('lobbyAvatar');
  if (lobbyAvatar && currentUser?.username) {
    if (avatar) {
      lobbyAvatar.innerHTML = `<img src="${avatar}" alt="avatar" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
      lobbyAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
    }
  }
  
  // Update lobby username
  const lobbyUsername = document.getElementById('lobbyUsername');
  if (lobbyUsername && currentUser?.username) {
    lobbyUsername.textContent = currentUser.username;
  }
}

function setTheme(themeName) {
  const theme = themes[themeName];
  if (!theme) return;

  Object.entries(theme).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });

  localStorage.setItem('keroschat_theme', themeName);

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === themeName);
  });
}

function updateVolume(type, value) {
  const displayEl = document.getElementById(type === 'mic' ? 'micVolVal' : 'vidVolVal');
  if (displayEl) displayEl.textContent = value;
  localStorage.setItem(`keroschat_${type}_volume`, value);
}

function updateAdminAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    userAvatar = e.target.result;
    localStorage.setItem(`keroschat_avatar_${currentUser.username}`, userAvatar);
    document.getElementById('adminAvatarPreview').innerHTML = `<img src="${userAvatar}" alt="avatar">`;
    document.getElementById('lobbyAvatar').innerHTML = `<img src="${userAvatar}" alt="avatar">`;
    if (currentRoom) {
      socket.emit('update-avatar', userAvatar);
    }
  };
  reader.readAsDataURL(file);
}

function setCameraQuality(quality) {
  localStorage.setItem('keroschat_camera_quality', quality);
  if (localStream) {
    const constraints = {
      low: { width: 640, height: 480 },
      medium: { width: 1280, height: 720 },
      high: { width: 1920, height: 1080 }
    };
    localStream.getVideoTracks()[0].applyConstraints(constraints[quality]).catch(err => {
      console.error('Error applying camera constraints:', err);
    });
  }
}

function createVIPChannel() {
  const channelName = prompt('Введите название VIP канала:');
  if (!channelName) return;
  const password = prompt('Установите пароль (или оставьте пустым):');
  const vipChannels = JSON.parse(localStorage.getItem('keroschat_vip_channels') || '[]');
  const newChannel = { id: 'vip-' + Date.now(), name: channelName, password: password, creator: currentUser.username };
  vipChannels.push(newChannel);
  localStorage.setItem('keroschat_vip_channels', JSON.stringify(vipChannels));
  renderVIPChannelsList();
}

function renderVIPChannelsList() {
  const listEl = document.getElementById('vipChannelsList');
  if (!listEl) return;
  
  const vipChannels = JSON.parse(localStorage.getItem('keroschat_vip_channels') || '[]');
  
  if (vipChannels.length === 0) {
    listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #72767d;">🔓 Нет VIP каналов. Создайте первый!</div>';
    return;
  }
  
  const listHtml = vipChannels.map(channel => `
    <div class="vip-channel-item">
      <span>🔒 ${channel.name} ${channel.password ? '(🔐 с паролем)' : '(открытый)'}</span>
      <button onclick="configureVIPChannel('${channel.id}')" class="admin-btn small" title="Настроить">⚙️ Настроить</button>
    </div>
  `).join('');
  
  listEl.innerHTML = listHtml;
}

function configureVIPChannel(channelId) {
  const vipChannels = JSON.parse(localStorage.getItem('keroschat_vip_channels') || '[]');
  const channel = vipChannels.find(c => c.id === channelId);
  if (!channel) return;

  const action = prompt(`1 - Изменить пароль\n2 - Удалить канал`);
  if (action === '1') {
    channel.password = prompt('Новый пароль:', channel.password);
    localStorage.setItem('keroschat_vip_channels', JSON.stringify(vipChannels));
  } else if (action === '2') {
    if (confirm(`Удалить канал "${channel.name}"?`)) {
      const filtered = vipChannels.filter(c => c.id !== channelId);
      localStorage.setItem('keroschat_vip_channels', JSON.stringify(filtered));
      renderVIPChannelsList();
    }
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Load user settings if logged in
  if (currentUser?.username) {
    loadUserSettings();
  }
});
