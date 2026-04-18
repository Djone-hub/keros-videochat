// ========== ADMIN PANEL FUNCTIONS ==========

// Helper functions for custom modals
function showConfirmModal(message, onConfirm) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center;
    z-index: 10000;
  `;
  modal.innerHTML = `
    <div style="background: #36393f; padding: 20px; border-radius: 8px; max-width: 400px; width: 90%;">
      <p style="color: #fff; margin-bottom: 20px; white-space: pre-line;">${message}</p>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button class="cancel-btn" style="padding: 10px 20px; background: #4f545c; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Отмена</button>
        <button class="confirm-btn" style="padding: 10px 20px; background: #ed4245; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Подтвердить</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('.cancel-btn').addEventListener('click', () => modal.remove());
  modal.querySelector('.confirm-btn').addEventListener('click', () => {
    modal.remove();
    onConfirm();
  });
}

function showAlertModal(message, type = 'info') {
  const colors = {
    info: '#5865f2',
    success: '#3ba55d',
    error: '#ed4245'
  };
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center;
    z-index: 10000;
  `;
  modal.innerHTML = `
    <div style="background: #36393f; padding: 20px; border-radius: 8px; max-width: 400px; width: 90%;">
      <p style="color: #fff; margin-bottom: 20px; white-space: pre-line;">${message}</p>
      <button class="close-btn" style="width: 100%; padding: 10px 20px; background: ${colors[type]}; color: #fff; border: none; border-radius: 4px; cursor: pointer;">OK</button>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
}

function showPromptModal(message, defaultValue = '', onConfirm) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center;
    z-index: 10000;
  `;
  modal.innerHTML = `
    <div style="background: #36393f; padding: 20px; border-radius: 8px; max-width: 400px; width: 90%;">
      <p style="color: #b9bbbe; margin-bottom: 15px;">${message}</p>
      <input type="text" id="promptInput" value="${defaultValue}" style="width: 100%; padding: 10px; margin-bottom: 15px; border-radius: 4px; border: none; background: #40444b; color: #fff;">
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button class="cancel-btn" style="padding: 10px 20px; background: #4f545c; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Отмена</button>
        <button class="confirm-btn" style="padding: 10px 20px; background: #5865f2; color: #fff; border: none; border-radius: 4px; cursor: pointer;">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('.cancel-btn').addEventListener('click', () => modal.remove());
  modal.querySelector('.confirm-btn').addEventListener('click', () => {
    const value = document.getElementById('promptInput').value;
    modal.remove();
    onConfirm(value);
  });

  setTimeout(() => document.getElementById('promptInput').focus(), 100);
}

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
  
  // Load users list
  loadAdminUsersList();
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
  showConfirmModal(`Вы уверены, что хотите удалить комнату ${roomId}?`, async () => {
    try {
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'DELETE',
        headers: {
          'X-Username': currentUser?.username || 'unknown'
        }
      });
      const result = await response.json();
      if (result.success) {
        showAlertModal('Комната удалена!', 'success');
        setTimeout(renderAdminPanel, 300);
      } else {
        showAlertModal('Ошибка: ' + result.message, 'error');
      }
    } catch (err) {
      console.error('Error deleting room:', err);
      showAlertModal('Ошибка удаления комнаты', 'error');
    }
  });
}

function forceRefreshRooms() {
  renderAdminPanel();
}

function clearGhostRooms() {
  if (!window.allAdminRooms) return;
  const ghostRooms = window.allAdminRooms.filter(r => r.id === r.name && /^[A-Z0-9]{8}$/.test(r.id));
  if (ghostRooms.length === 0) {
    showAlertModal('Призрачные комнаты не найдены.', 'info');
    return;
  }
  showConfirmModal(`Найдено ${ghostRooms.length} призрачных комнат. Удалить их?`, async () => {
    try {
      for (const room of ghostRooms) {
        const response = await fetch(`/api/rooms/${room.id}`, {
          method: 'DELETE',
          headers: {
            'X-Username': currentUser?.username || 'unknown'
          }
        });
      }
      showAlertModal('Призрачные комнаты удалены!', 'success');
      setTimeout(renderAdminPanel, 500);
    } catch (err) {
      console.error('Error deleting ghost rooms:', err);
      showAlertModal('Ошибка удаления призрачных комнат', 'error');
    }
  });
}

function deleteAllEmptyRooms() {
  if (!window.allAdminRooms) return;
  const emptyRooms = window.allAdminRooms.filter(r => r.userCount === 0);
  if (emptyRooms.length === 0) {
    showAlertModal('Пустые комнаты не найдены.', 'info');
    return;
  }
  showConfirmModal(`Найдено ${emptyRooms.length} пустых комнат. Удалить их все?`, async () => {
    try {
      for (const room of emptyRooms) {
        const response = await fetch(`/api/rooms/${room.id}`, {
          method: 'DELETE',
          headers: {
            'X-Username': currentUser?.username || 'unknown'
          }
        });
      }
      showAlertModal('Пустые комнаты удалены!', 'success');
      setTimeout(renderAdminPanel, 500);
    } catch (err) {
      console.error('Error deleting empty rooms:', err);
      showAlertModal('Ошибка удаления пустых комнат', 'error');
    }
  });
}

function cleanGhostUsersFromRooms() {
  if (!window.allAdminRooms || !window.allAdminUsers) {
    showAlertModal('Сначала загрузите комнаты и пользователей.', 'error');
    return;
  }

  const validUsernames = new Set(window.allAdminUsers.map(u => u.username));
  let totalGhostUsers = 0;
  const roomsWithGhosts = [];

  window.allAdminRooms.forEach(room => {
    if (room.channels) {
      Object.values(room.channels).forEach(channel => {
        if (channel.users && Array.isArray(channel.users)) {
          const ghostUsers = channel.users.filter(u => !validUsernames.has(u));
          if (ghostUsers.length > 0) {
            totalGhostUsers += ghostUsers.length;
            roomsWithGhosts.push({
              roomId: room.id,
              roomName: room.name,
              channelName: channel.name,
              ghostUsers: ghostUsers
            });
          }
        }
      });
    }
  });

  if (roomsWithGhosts.length === 0) {
    showAlertModal('Призрачные пользователи не найдены.', 'info');
    return;
  }

  const message = `Найдено ${totalGhostUsers} призрачных пользователей в ${roomsWithGhosts.length} комнатах.\n\n` +
    roomsWithGhosts.map(r => `- ${r.roomName}: ${r.ghostUsers.join(', ')}`).join('\n') +
    '\n\nОчистить их?';

  showConfirmModal(message, () => {
    fetch('/api/admin/clean-ghost-users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Username': currentUser?.username || 'unknown'
      }
    })
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          showAlertModal(`✅ ${result.message}`, 'success');
          setTimeout(renderAdminPanel, 500);
        } else {
          showAlertModal(`❌ Ошибка: ${result.message}`, 'error');
        }
      })
      .catch(err => {
        console.error('Error cleaning ghost users:', err);
        showAlertModal('❌ Ошибка очистки призрачных пользователей', 'error');
      });
  });
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

  const micVol = localStorage.getItem('keroschat_mic_volume') || '50';
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

  // Update equalizer-style level indicators
  updateVolume('mic', micVol);
  updateVolume('vid', vidVol);

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

  // Update active button state
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.classList.contains(themeName)) {
      btn.classList.add('active');
    }
  });
}

function updateVolume(type, value) {
  const displayEl = document.getElementById(type === 'mic' ? 'micVolVal' : 'vidVolVal');
  if (displayEl) displayEl.textContent = value;

  // Update equalizer-style level indicator (vertical bars)
  const greenEl = document.getElementById(type === 'mic' ? 'micVolLevelGreen' : 'vidVolLevelGreen');
  const yellowEl = document.getElementById(type === 'mic' ? 'micVolLevelYellow' : 'vidVolLevelYellow');
  const redEl = document.getElementById(type === 'mic' ? 'micVolLevelRed' : 'vidVolLevelRed');

  if (greenEl && yellowEl && redEl) {
    const percentage = parseInt(value);

    // Green: 0-33% (excellent)
    if (percentage <= 33) {
      greenEl.style.height = (percentage / 33 * 100) + '%';
      yellowEl.style.height = '0%';
      redEl.style.height = '0%';
    }
    // Yellow: 34-66% (level)
    else if (percentage <= 66) {
      greenEl.style.height = '100%';
      yellowEl.style.height = ((percentage - 33) / 33 * 100) + '%';
      redEl.style.height = '0%';
    }
    // Red: 67-100% (peak)
    else {
      greenEl.style.height = '100%';
      yellowEl.style.height = '100%';
      redEl.style.height = ((percentage - 66) / 34 * 100) + '%';
    }
  }

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

async function createVIPChannel() {
  showPromptModal('Введите название VIP канала:', '', (channelName) => {
    if (!channelName) return;
    showPromptModal('Установите пароль (или оставьте пустым):', '', async (password) => {
      try {
        const response = await fetch('/api/vip-channels', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Username': currentUser?.username || 'unknown'
          },
          body: JSON.stringify({ name: channelName, password: password })
        });
        const result = await response.json();
        if (result.success) {
          renderVIPChannelsList();
          showAlertModal('VIP канал создан!', 'success');
        } else {
          showAlertModal('Ошибка: ' + result.message, 'error');
        }
      } catch (err) {
        console.error('Error creating VIP channel:', err);
        showAlertModal('Ошибка создания VIP канала', 'error');
      }
    });
  });
}

async function renderVIPChannelsList() {
  const listEl = document.getElementById('vipChannelsList');
  if (!listEl) return;

  try {
    const response = await fetch('/api/vip-channels');
    const vipChannels = await response.json();

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
  } catch (err) {
    console.error('Error loading VIP channels:', err);
    listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #ed4245;">Ошибка загрузки VIP каналов</div>';
  }
}

async function configureVIPChannel(channelId) {
  showPromptModal(`1 - Изменить пароль\n2 - Удалить канал`, '', async (action) => {
    if (action === '1') {
      showPromptModal('Новый пароль:', '', async (newPassword) => {
        try {
          const response = await fetch(`/api/vip-channels/${channelId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-Username': currentUser?.username || 'unknown'
            },
            body: JSON.stringify({ password: newPassword })
          });
          const result = await response.json();
          if (result.success) {
            showAlertModal('Пароль изменён!', 'success');
          } else {
            showAlertModal('Ошибка: ' + result.message, 'error');
          }
        } catch (err) {
          console.error('Error updating VIP channel:', err);
          showAlertModal('Ошибка изменения пароля', 'error');
        }
      });
    } else if (action === '2') {
      showConfirmModal(`Удалить канал?`, async () => {
        try {
          const response = await fetch(`/api/vip-channels/${channelId}`, {
            method: 'DELETE',
            headers: {
              'X-Username': currentUser?.username || 'unknown'
            }
          });
          const result = await response.json();
          if (result.success) {
            renderVIPChannelsList();
            showAlertModal('Канал удалён!', 'success');
          } else {
            showAlertModal('Ошибка: ' + result.message, 'error');
          }
        } catch (err) {
          console.error('Error deleting VIP channel:', err);
          showAlertModal('Ошибка удаления канала', 'error');
        }
      });
    }
  });
}

// ========== USER MANAGEMENT ==========

function loadAdminUsersList() {
  const listEl = document.getElementById('adminUsersList');
  const usersTab = document.getElementById('adminTab-users');
  if (!listEl || !usersTab) return;

  // Fetch users from API
  fetch('/api/users')
    .then(res => res.json())
    .then(users => {
      window.allAdminUsers = users;

      // Update current user role from users list
      const currentUserData = users.find(u => u.username === currentUser?.username);
      if (currentUserData && currentUserData.role) {
        currentUser.role = currentUserData.role;
      }

      if (users.length === 0) {
        listEl.innerHTML = '<div style="text-align: center; padding: 40px; color: #72767d;">😕 Нет пользователей</div>';
        return;
      }
      // Remove duplicates by username (keep first occurrence, prefer online users)
      const uniqueUsers = [];
      const seenNames = new Set();

      // First pass: add online users
      users.forEach(user => {
        if (!seenNames.has(user.username)) {
          seenNames.add(user.username);
          uniqueUsers.push(user);
        }
      });

      // Sort: online first, then by name
      uniqueUsers.sort((a, b) => {
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        return a.username.localeCompare(b.username);
      });

      const listHtml = uniqueUsers.map(user => {
        const statusColor = user.isOnline ? '#3ba55d' : '#72767d';
        const statusText = user.isOnline ? '🟢 В сети' : '⚪ Не в сети';
        const avatarHtml = user.avatar ?
          `<img src="${user.avatar}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">` :
          `<div style="width: 32px; height: 32px; border-radius: 50%; background: #5865f2; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 600;">${user.username.charAt(0).toUpperCase()}</div>`;

        // Check if current user is admin
        const currentUserRole = currentUser?.role || 'user';
        const isAdmin = currentUserRole === 'admin' || currentUserRole === 'superadmin';
        const canDelete = isAdmin && !(user.role === 'superadmin');  // Admins can delete, but not superadmins
        const canChangeRole = isAdmin && !(currentUserRole === 'superadmin' && currentUser.username === user.username);
        const canKick = isAdmin && !(user.role === 'superadmin');  // Admins can kick, but not superadmins
        const canMute = isAdmin && !(user.role === 'superadmin');  // Admins can mute, but not superadmins
        const canUnkick = isAdmin;  // Admins can unkick users

        const kickedRooms = JSON.parse(user.kickedRooms || '[]');
        const isKicked = kickedRooms.length > 0;

        return `
          <div class="admin-room-item ${user.isOnline ? '' : 'empty'}">
            <div class="admin-room-info" style="display: flex; align-items: center; gap: 12px;">
              ${avatarHtml}
              <div>
                <div class="admin-room-name">${user.username}</div>
                <div class="admin-room-meta" style="color: ${statusColor};">${statusText}</div>
                <div class="admin-room-meta" style="font-size: 12px; margin-top: 4px;">
                  Роль: <span style="color: ${getRoleColor(user.role)}; font-weight: bold;">${getRoleLabel(user.role)}</span>
                </div>
                ${user.isMuted ? `
                <div class="admin-room-meta" style="font-size: 12px; margin-top: 4px; color: #faa61a;">
                  🔇 Замучен ${user.muteUntil && user.muteUntil > 0 ? `до ${new Date(user.muteUntil).toLocaleTimeString()}` : 'навсегда'}
                </div>
                ` : ''}
                ${isKicked ? `
                <div class="admin-room-meta" style="font-size: 12px; margin-top: 4px; color: #ed4245;">
                  👢 Кикнут из ${kickedRooms.length} комнат
                </div>
                ` : ''}
              </div>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              ${canChangeRole ? `
                <select onchange="changeUserRole('${user.username}', this.value)" class="admin-btn" style="padding: 6px 10px; font-size: 12px;">
                  <option value="user" ${user.role === 'user' ? 'selected' : ''}>Пользователь</option>
                  <option value="moderator" ${user.role === 'moderator' ? 'selected' : ''}>Модератор</option>
                  <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Админ</option>
                  <option value="superadmin" ${user.role === 'superadmin' ? 'selected' : ''}>Суперадмин</option>
                </select>
              ` : ''}
              ${canMute ? `
                <button onclick="muteUser('${user.username}', ${user.isMuted ? 'false' : 'true'})" class="admin-btn" style="padding: 6px 10px; font-size: 12px;" title="${user.isMuted ? 'Размутить' : 'Замутить'}">${user.isMuted ? '🔊' : '🔇'}</button>
              ` : ''}
              ${canKick ? `
                <button onclick="kickUser('${user.username}')" class="admin-btn" style="padding: 6px 10px; font-size: 12px;" title="Кикнуть из комнаты">👢</button>
              ` : ''}
              ${canUnkick && isKicked ? `
                <button onclick="unkickUser('${user.username}')" class="admin-btn" style="padding: 6px 10px; font-size: 12px; background: #3ba55d;" title="Разбанить из комнаты">🔓</button>
              ` : ''}
              ${canDelete ? `
                <button onclick="deleteUser('${user.username}')" class="admin-btn danger" title="Удалить пользователя">🗑️</button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');

      listEl.innerHTML = `
        <div style="margin-bottom: 15px; color: #b9bbbe; font-size: 14px;">
          Всего пользователей: <strong style="color: #fff;">${uniqueUsers.length}</strong> |
          Онлайн: <strong style="color: #3ba55d;">${uniqueUsers.filter(u => u.isOnline).length}</strong>
        </div>
        ${currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin') ? `
        <button onclick="reloadUsersFromSupabase()" class="admin-btn" style="margin-bottom: 15px; padding: 8px 16px;">🔄 Перезагрузить пользователей из Supabase</button>
        <button onclick="clearBrowserCache()" class="admin-btn danger" style="margin-bottom: 15px; padding: 8px 16px;">🗑️ Очистить кэш браузера</button>
        ` : ''}
        ${listHtml}
      `;
    })
    .catch(err => {
      console.error('Error loading users:', err);
      if (listEl) {
        listEl.innerHTML = '<div style="color: #ed4245; text-align: center; padding: 20px;">Ошибка загрузки пользователей</div>';
      }
    });
}

function reloadUsersFromSupabase() {
  fetch('/api/admin/reload-users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Username': currentUser?.username || 'unknown'
    }
  })
    .then(res => res.json())
    .then(result => {
      if (result.success) {
        showAlertModal(`✅ ${result.message}`, 'success');
        loadAdminUsersList();
      } else {
        showAlertModal(`❌ Ошибка: ${result.message}`, 'error');
      }
    })
    .catch(err => {
      console.error('Error reloading users:', err);
      showAlertModal('❌ Ошибка при перезагрузке пользователей', 'error');
    });
}

async function clearBrowserCache() {
  showConfirmModal('Очистить весь кэш браузера? Это удалит все сохранённые данные (аватары, темы, настройки).', async () => {
    try {
      // Clear all localStorage
      localStorage.clear();

      // Clear sessionStorage
      sessionStorage.clear();

      // Clear IndexedDB (for larger data)
      if (window.indexedDB) {
        const databases = await indexedDB.databases();
        databases.forEach(db => {
          indexedDB.deleteDatabase(db.name);
        });
      }

      showAlertModal('✅ Кэш очищен! Страница перезагрузится.', 'success');
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      console.error('Error clearing cache:', err);
      showAlertModal('❌ Ошибка очистки кэша', 'error');
    }
  });
}

function filterAdminUsers(searchTerm) {
  if (!window.allAdminUsers) return;
  const filtered = window.allAdminUsers.filter(u =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Re-render with filtered users
  const listEl = document.getElementById('adminUsersList');
  if (!listEl) return;

  // Update current user role from users list
  const currentUserData = filtered.find(u => u.username === currentUser?.username);
  if (currentUserData && currentUserData.role) {
    currentUser.role = currentUserData.role;
  }

  const uniqueUsers = [];
  const seenNames = new Set();

  filtered.forEach(user => {
    if (!seenNames.has(user.username)) {
      seenNames.add(user.username);
      uniqueUsers.push(user);
    }
  });

  uniqueUsers.sort((a, b) => {
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    return a.username.localeCompare(b.username);
  });

  const listHtml = uniqueUsers.map(user => {
    const statusColor = user.isOnline ? '#3ba55d' : '#72767d';
    const statusText = user.isOnline ? '🟢 В сети' : '⚪ Не в сети';
    const avatarHtml = user.avatar ?
      `<img src="${user.avatar}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">` :
      `<div style="width: 32px; height: 32px; border-radius: 50%; background: #5865f2; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 600;">${user.username.charAt(0).toUpperCase()}</div>`;

    const currentUserRole = currentUser?.role || 'user';
    const isAdmin = currentUserRole === 'admin' || currentUserRole === 'superadmin';
    const canDelete = isAdmin && !(user.role === 'superadmin');  // Only admins can delete, but not superadmins
    const canChangeRole = isAdmin && !(currentUserRole === 'superadmin' && currentUser.username === user.username);
    const canKick = isAdmin && !(user.role === 'superadmin');  // Admins can kick, but not superadmins
    const canMute = isAdmin && !(user.role === 'superadmin');  // Admins can mute, but not superadmins
    const canUnkick = isAdmin;  // Admins can unkick users

    const kickedRooms = JSON.parse(user.kickedRooms || '[]');
    const isKicked = kickedRooms.length > 0;

    return `
      <div class="admin-room-item ${user.isOnline ? '' : 'empty'}">
        <div class="admin-room-info" style="display: flex; align-items: center; gap: 12px;">
          ${avatarHtml}
          <div>
            <div class="admin-room-name">${user.username}</div>
            <div class="admin-room-meta" style="color: ${statusColor};">${statusText}</div>
            <div class="admin-room-meta" style="font-size: 12px; margin-top: 4px;">
              Роль: <span style="color: ${getRoleColor(user.role)}; font-weight: bold;">${getRoleLabel(user.role)}</span>
            </div>
            ${user.isMuted ? `
            <div class="admin-room-meta" style="font-size: 12px; margin-top: 4px; color: #faa61a;">
              🔇 Замучен ${user.muteUntil && user.muteUntil > 0 ? `до ${new Date(user.muteUntil).toLocaleTimeString()}` : 'навсегда'}
            </div>
            ` : ''}
            ${isKicked ? `
            <div class="admin-room-meta" style="font-size: 12px; margin-top: 4px; color: #ed4245;">
              👢 Кикнут из ${kickedRooms.length} комнат
            </div>
            ` : ''}
          </div>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${canChangeRole ? `
            <select onchange="changeUserRole('${user.username}', this.value)" class="admin-btn" style="padding: 6px 10px; font-size: 12px;">
              <option value="user" ${user.role === 'user' ? 'selected' : ''}>Пользователь</option>
              <option value="moderator" ${user.role === 'moderator' ? 'selected' : ''}>Модератор</option>
              <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Админ</option>
              <option value="superadmin" ${user.role === 'superadmin' ? 'selected' : ''}>Суперадмин</option>
            </select>
          ` : ''}
          ${canMute ? `
            <button onclick="muteUser('${user.username}', ${user.isMuted ? 'false' : 'true'})" class="admin-btn" style="padding: 6px 10px; font-size: 12px;" title="${user.isMuted ? 'Размутить' : 'Замутить'}">${user.isMuted ? '🔊' : '🔇'}</button>
          ` : ''}
          ${canKick ? `
            <button onclick="kickUser('${user.username}')" class="admin-btn" style="padding: 6px 10px; font-size: 12px;" title="Кикнуть из комнаты">👢</button>
          ` : ''}
          ${canUnkick && isKicked ? `
            <button onclick="unkickUser('${user.username}')" class="admin-btn" style="padding: 6px 10px; font-size: 12px; background: #3ba55d;" title="Разбанить из комнаты">🔓</button>
          ` : ''}
          ${canDelete ? `
            <button onclick="deleteUser('${user.username}')" class="admin-btn danger" title="Удалить пользователя">🗑️</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  listEl.innerHTML = `
    <div style="margin-bottom: 15px; color: #b9bbbe; font-size: 14px;">
      Всего пользователей: <strong style="color: #fff;">${uniqueUsers.length}</strong> |
      Онлайн: <strong style="color: #3ba55d;">${uniqueUsers.filter(u => u.isOnline).length}</strong>
    </div>
    ${currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin') ? `
    <button onclick="reloadUsersFromSupabase()" class="admin-btn" style="margin-bottom: 15px; padding: 8px 16px;">🔄 Перезагрузить пользователей из Supabase</button>
    <button onclick="clearBrowserCache()" class="admin-btn danger" style="margin-bottom: 15px; padding: 8px 16px;">🗑️ Очистить кэш браузера</button>
    ` : ''}
    ${listHtml}
  `;
}

function deleteUser(username) {
  showConfirmModal(`Удалить пользователя "${username}"?\n\nЭто действие нельзя отменить!`, () => {
    fetch(`/api/users/${encodeURIComponent(username)}`, {
      method: 'DELETE',
      headers: {
        'X-Username': currentUser?.username || 'unknown'
      }
    })
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          showAlertModal(`✅ Пользователь "${username}" удалён`, 'success');
          loadAdminUsersList();
        } else {
          showAlertModal(`❌ Ошибка: ${result.message}`, 'error');
        }
      })
      .catch(err => {
        console.error('Error deleting user:', err);
        showAlertModal('❌ Ошибка при удалении пользователя', 'error');
      });
  });
}

function muteUser(username, isMuted) {
  if (!isMuted) {
    // Unmute immediately
    fetch(`/api/users/${username}/mute`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Username': currentUser?.username || 'unknown'
      },
      body: JSON.stringify({ isMuted: false, duration: 0 })
    })
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          showAlertModal(`✅ Пользователь "${username}" размучен`, 'success');
          loadAdminUsersList();
        } else {
          showAlertModal(`❌ Ошибка: ${result.message}`, 'error');
        }
      })
      .catch(err => {
        console.error('Error unmuting user:', err);
        showAlertModal('❌ Ошибка при размуте', 'error');
      });
    return;
  }

  // Show modal for mute duration
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center;
    z-index: 10000;
  `;
  modal.innerHTML = `
    <div style="background: #36393f; padding: 20px; border-radius: 8px; max-width: 400px; width: 90%;">
      <h3 style="color: #fff; margin-top: 0;">Замутить пользователя ${username}</h3>
      <p style="color: #b9bbbe; margin-bottom: 15px;">На сколько минут замутить?</p>
      <input type="number" id="muteDuration" value="10" min="0" style="width: 100%; padding: 10px; margin-bottom: 10px; border-radius: 4px; border: none;">
      <p style="color: #72767d; font-size: 12px; margin-bottom: 15px;">0 = навсегда</p>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button onclick="this.closest('div[style*=fixed]').remove()" class="admin-btn" style="padding: 10px 20px;">Отмена</button>
        <button id="confirmMute" class="admin-btn danger" style="padding: 10px 20px;">Замутить</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('confirmMute').addEventListener('click', async () => {
    const duration = parseInt(document.getElementById('muteDuration').value) || 0;
    modal.remove();

    if (duration < 0) {
      showAlertModal('❌ Неверное значение', 'error');
      return;
    }

    fetch(`/api/users/${username}/mute`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Username': currentUser?.username || 'unknown'
      },
      body: JSON.stringify({ isMuted: true, duration: duration })
    })
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          showAlertModal(`✅ Пользователь "${username}" замучен на ${duration === 0 ? 'навсегда' : duration + ' минут'}`, 'success');
          loadAdminUsersList();
        } else {
          showAlertModal(`❌ Ошибка: ${result.message}`, 'error');
        }
      })
      .catch(err => {
        console.error('Error muting user:', err);
        showAlertModal('❌ Ошибка при муте', 'error');
      });
  });
}

async function kickUser(username) {
  // Fetch rooms from API
  const response = await fetch('/api/rooms');
  const rooms = await response.json();

  if (rooms.length === 0) {
    showAlertModal('❌ Нет активных комнат', 'error');
    return;
  }

  // Create room options
  const roomOptions = rooms.map(r => `<option value="${r.id}">${r.name} (${r.id})</option>`).join('');

  // Show modal with room selection
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center;
    z-index: 10000;
  `;
  modal.innerHTML = `
    <div style="background: #36393f; padding: 20px; border-radius: 8px; max-width: 400px; width: 90%;">
      <h3 style="color: #fff; margin-top: 0;">Кикнуть пользователя ${username}</h3>
      <p style="color: #b9bbbe; margin-bottom: 15px;">Выберите комнату:</p>
      <select id="kickRoomSelect" style="width: 100%; padding: 10px; margin-bottom: 15px; border-radius: 4px; border: none;">
        ${roomOptions}
      </select>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button onclick="this.closest('div[style*=fixed]').remove()" class="admin-btn" style="padding: 10px 20px;">Отмена</button>
        <button id="confirmKick" class="admin-btn danger" style="padding: 10px 20px;">Кикнуть</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('confirmKick').addEventListener('click', async () => {
    const roomId = document.getElementById('kickRoomSelect').value;
    modal.remove();

    fetch(`/api/users/${username}/kick`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Username': currentUser?.username || 'unknown'
      },
      body: JSON.stringify({ roomId })
    })
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          showAlertModal(`✅ Пользователь "${username}" кикнут из комнаты`, 'success');
          loadAdminUsersList();
        } else {
          showAlertModal(`❌ Ошибка: ${result.message}`, 'error');
        }
      })
      .catch(err => {
        console.error('Error kicking user:', err);
        showAlertModal('❌ Ошибка при кике', 'error');
      });
  });
}

async function unkickUser(username) {
  // Fetch user data to get kicked rooms
  const usersResponse = await fetch('/api/users');
  const users = await usersResponse.json();
  const user = users.find(u => u.username === username);

  if (!user) {
    showAlertModal('❌ Пользователь не найден', 'error');
    return;
  }

  const kickedRooms = JSON.parse(user.kickedRooms || '[]');
  if (kickedRooms.length === 0) {
    showAlertModal('❌ Пользователь не кикнут ни из одной комнаты', 'error');
    return;
  }

  // Fetch rooms from API to get room names
  const roomsResponse = await fetch('/api/rooms');
  const rooms = await roomsResponse.json();

  // Create room options with names
  const roomOptions = kickedRooms.map(roomId => {
    const room = rooms.find(r => r.id === roomId);
    const roomName = room ? room.name : roomId;
    return `<option value="${roomId}">${roomName} (${roomId})</option>`;
  }).join('');

  // Show modal with room selection
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center;
    z-index: 10000;
  `;
  modal.innerHTML = `
    <div style="background: #36393f; padding: 20px; border-radius: 8px; max-width: 400px; width: 90%;">
      <h3 style="color: #fff; margin-top: 0;">Разбанить пользователя ${username}</h3>
      <p style="color: #b9bbbe; margin-bottom: 15px;">Выберите комнату для разбана:</p>
      <select id="unkickRoomSelect" style="width: 100%; padding: 10px; margin-bottom: 15px; border-radius: 4px; border: none;">
        ${roomOptions}
      </select>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button onclick="this.closest('div[style*=fixed]').remove()" class="admin-btn" style="padding: 10px 20px;">Отмена</button>
        <button id="confirmUnkick" class="admin-btn" style="padding: 10px 20px; background: #3ba55d;">Разбанить</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('confirmUnkick').addEventListener('click', async () => {
    const roomId = document.getElementById('unkickRoomSelect').value;
    modal.remove();

    fetch(`/api/users/${username}/unkick`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Username': currentUser?.username || 'unknown'
      },
      body: JSON.stringify({ roomId })
    })
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          showAlertModal(`✅ Пользователь "${username}" разбанен из комнаты`, 'success');
          loadAdminUsersList();
        } else {
          showAlertModal(`❌ Ошибка: ${result.message}`, 'error');
        }
      })
      .catch(err => {
        console.error('Error unkicking user:', err);
        showAlertModal('❌ Ошибка при разбане', 'error');
      });
  });
}

function getRoleColor(role) {
  const colors = {
    'user': '#b9bbbe',
    'moderator': '#faa61a',
    'admin': '#ed4245',
    'superadmin': '#5865f2'
  };
  return colors[role] || '#b9bbbe';
}

function getRoleLabel(role) {
  const labels = {
    'user': 'Пользователь',
    'moderator': 'Модератор',
    'admin': 'Админ',
    'superadmin': 'Суперадмин'
  };
  return labels[role] || 'Пользователь';
}

function changeUserRole(username, newRole) {
  fetch(`/api/users/${encodeURIComponent(username)}/role`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Username': currentUser?.username || 'unknown'
    },
    body: JSON.stringify({ role: newRole })
  })
    .then(res => res.json())
    .then(result => {
      if (result.success) {
        showAlertModal(`✅ Роль пользователя "${username}" изменена на "${getRoleLabel(newRole)}"`, 'success');
        loadAdminUsersList();
      } else {
        showAlertModal(`❌ Ошибка: ${result.message}`, 'error');
      }
    })
    .catch(err => {
      console.error('Error changing user role:', err);
      showAlertModal('❌ Ошибка изменения роли', 'error');
    });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Load user settings if logged in
  if (currentUser?.username) {
    loadUserSettings();
  }
});
