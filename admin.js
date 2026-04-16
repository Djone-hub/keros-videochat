// ========== ADMIN PANEL FUNCTIONS ==========

// Show/hide admin panel
function showAdminPanel() {
  const panel = document.getElementById('adminPanel');
  if (panel) {
    panel.classList.add('active');
    renderAdminPanel();
  }
}

function hideAdminPanel() {
  const panel = document.getElementById('adminPanel');
  if (panel) {
    panel.classList.remove('active');
  }
}

function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.admin-tab-button').forEach(button => {
    button.classList.remove('active');
  });

  document.getElementById(`admin-tab-${tabName}`).classList.add('active');
  document.querySelector(`.admin-tab-button[onclick="switchAdminTab('${tabName}')"]`).classList.add('active');
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
      document.getElementById('admin-stats-content').innerHTML = '<p class="error">Ошибка загрузки статистики</p>';
      document.getElementById('admin-rooms-content').innerHTML = '<p class="error">Ошибка загрузки комнат</p>';
    });
}

function renderAdminStats(rooms) {
  const activeRooms = rooms.filter(r => r.active).length;
  const emptyRooms = rooms.filter(r => r.userCount === 0).length;
  const ghostRooms = rooms.filter(r => r.id === r.name && /^[A-Z0-9]{8}$/.test(r.id)).length;

  document.getElementById('admin-stats-content').innerHTML = `
    <div class="stat-item"><strong>Всего комнат:</strong> ${rooms.length}</div>
    <div class="stat-item"><strong>Активных:</strong> ${activeRooms}</div>
    <div class="stat-item"><strong>Пустых:</strong> ${emptyRooms}</div>
    <div class="stat-item"><strong>Призраков:</strong> ${ghostRooms}</div>
  `;
}

function renderAdminRoomList(rooms) {
  const listHtml = rooms.map(room => `
    <div class="admin-room-item">
      <div class="info">
        <div class="name">${room.name} ${room.id === room.name && /^[A-Z0-9]{8}$/.test(room.id) ? '👻' : ''}</div>
        <div class="meta">ID: ${room.id} | Участников: ${room.userCount}</div>
      </div>
      <div class="actions">
        <button class="admin-btn-icon" onclick="adminDeleteRoom('${room.id}')" title="Удалить комнату">🗑️</button>
      </div>
    </div>
  `).join('');

  document.getElementById('admin-rooms-content').innerHTML = listHtml || '<p>Нет комнат для отображения.</p>';
}

function filterAdminRooms() {
  const searchTerm = document.getElementById('admin-room-search').value.toLowerCase();
  if (!window.allAdminRooms) return;

  const filtered = window.allAdminRooms.filter(room =>
    room.name.toLowerCase().includes(searchTerm) ||
    room.id.toLowerCase().includes(searchTerm)
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

  const micVolumeSlider = document.getElementById('micVolume');
  const vidVolumeSlider = document.getElementById('vidVolume');
  if (micVolumeSlider) micVolumeSlider.value = micVol;
  if (vidVolumeSlider) vidVolumeSlider.value = vidVol;

  const micVolVal = document.getElementById('micVolVal');
  const vidVolVal = document.getElementById('vidVolVal');
  if (micVolVal) micVolVal.textContent = micVol;
  if (vidVolVal) vidVolVal.textContent = vidVol;

  const avatar = userAvatar || localStorage.getItem(`keroschat_avatar_${currentUser?.username}`);
  const preview = document.getElementById('adminAvatarPreview');
  if (avatar && preview) {
    preview.innerHTML = `<img src="${avatar}" alt="avatar">`;
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
  const vipChannels = JSON.parse(localStorage.getItem('keroschat_vip_channels') || '[]');
  const listHtml = vipChannels.map(channel => `
    <div class="vip-channel-item">
      <span>🔒 ${channel.name}</span>
      <button onclick="configureVIPChannel('${channel.id}')" class="admin-btn-icon" title="Настроить">⚙️</button>
    </div>
  `).join('');
  document.getElementById('vip-channels-content').innerHTML = listHtml || '<p>Нет VIP каналов.</p>';
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

document.addEventListener('DOMContentLoaded', () => {
  const adminButton = document.getElementById('adminButton');
  if (adminButton) {
    adminButton.addEventListener('click', showAdminPanel);
  }
});
