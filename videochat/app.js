// Keros VideoChat - Full Authentication & Lobby System
const socket = io();
let socketConnected = false;

// Hide screen share button on devices that don't support getDisplayMedia
if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
  const hideScreenBtn = () => {
    const screenBtn = document.getElementById('screenBtn');
    if (screenBtn) {
      screenBtn.style.display = 'none';
      console.log('[SCREEN] Screen share button hidden - not supported on this device');
    }
  };
  hideScreenBtn();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideScreenBtn);
  }
}

// Socket connection event
socket.on('connect', () => {
  // Connected - only log on localhost
  if (window.location.hostname === 'localhost') {
    console.log('Connected to server');
  }
  socketConnected = true;

  // NOTE: Removed local users sync to prevent password overwrite
  // Users are now stored in Supabase, no need to sync from localStorage

  // REJOIN ROOM: If we were in a room, rejoin to restore socket.roomId on server
  if (currentRoom && currentUser && currentUser.username) {
    console.log('[RECONNECT] Rejoining room after reconnect:', currentRoom);
    socket.emit('join-room', {
      roomId: currentRoom,
      username: currentUser.username,
      avatar: userAvatar || localStorage.getItem(`keroschat_avatar_${currentUser.username}`),
      isScreenSharing: isScreenSharing
    });
    console.log('[RECONNECT] Rejoin event sent');
  }

  // If lobby is already visible, reload rooms and users
  const lobbyScreen = document.getElementById('lobbyScreen');
  if (lobbyScreen && lobbyScreen.style.display === 'flex') {
    loadServerRooms();
    loadRegisteredUsers();
  }
});

socket.on('disconnect', () => {
  console.log('[DISCONNECT] Disconnected from server');
  console.log('[DISCONNECT] Current room:', currentRoom);
  console.log('[DISCONNECT] Current user:', currentUser?.username);
  console.log('[DISCONNECT] peers.size before disconnect:', peers.size);
  socketConnected = false;
  // DO NOT clear peers here - let them reconnect automatically
  // peers will be cleaned up naturally when they fail
});

// Handle reconnect - rejoin room and recreate peer connections
socket.on('connect', () => {
  console.log('[CONNECT] Connected to server');
  socketConnected = true;
  
  // If we were in a room, rejoin and recreate connections
  if (currentRoom && currentUser) {
    console.log('[CONNECT] Was in room', currentRoom, '- rejoining and recreating peer connections');
    
    // Rejoin the room
    socket.emit('join-room', {
      roomId: currentRoom,
      userId: socket.id,
      username: currentUser.username
    }, (response) => {
      console.log('[CONNECT] Rejoin response:', response);
      if (response && response.success) {
        // Clear old peers and recreate connections with all users
        const oldPeers = Array.from(peers.keys());
        peers.forEach(pc => pc.close());
        peers.clear();
        activeUsers.clear();
        
        console.log('[CONNECT] Cleared old peers, will recreate when users update');
      }
    });
  }
});

// Listen for user list updates
socket.on('users-updated', () => {
  loadRegisteredUsers();
});

// Listen for mute event
socket.on('user-muted', ({ username, isMuted, duration }) => {
  if (currentUser && currentUser.username === username) {
    if (isMuted) {
      const durationText = duration > 0 ? `${duration} минут` : 'навсегда';
      showAlertModal(`🔇 Вы были замучены на ${durationText}`, 'info');
    } else {
      showAlertModal('🔊 Ваш мут был снят', 'success');
    }
    // Reload user data to get updated mute status
    loadRegisteredUsers();
  }
});

// Listen for kick event
socket.on('kicked-from-room', ({ roomId }) => {
  if (currentRoom === roomId) {
    showAlertModal(`👢 Вы были выгнаны из комнаты`, 'error');
    leaveRoom();
  }
});

// Listen for message deleted event
socket.on('message-deleted', ({ messageId }) => {
  const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
  if (messageElement) {
    messageElement.remove();
  }
});

// State
let currentUser = null;
let currentRoom = null;
let currentRoomName = '';
let currentRoomAvatar = null;
let localStream = null;
let screenStream = null;
let peers = new Map();
let activeUsers = new Map();
let isMicOn = true;
let isCamOn = false; // Camera OFF by default - user must enable explicitly
let isSoundOn = true;
let isScreenSharing = false;
let screenQuality = localStorage.getItem('keroschat_screen_quality') || 'auto'; // auto, low, medium, high

// Set quality selector to saved value
window.addEventListener('DOMContentLoaded', () => {
  const qualitySelector = document.getElementById('screenQuality');
  if (qualitySelector) {
    qualitySelector.value = screenQuality;
  }
});

// Expose to window for admin panel access
window.peers = peers;
window.activeUsers = activeUsers;
window.setRemoteVolume = setRemoteVolume;

// Audio/Video device selection
let selectedAudioInput = null; // microphone
let selectedAudioOutput = null; // speakers
let selectedVideoInput = null; // camera
let availableDevices = {
  audioinput: [],
  audiooutput: [],
  videoinput: []
};

// Microphone level indicator
let micLevelAnalyzer = null;
let micLevelInterval = null;
let micLevelCallback = null;

// Load saved device preferences
function loadDevicePreferences() {
  selectedAudioInput = localStorage.getItem('keroschat_audioInput') || null;
  selectedAudioOutput = localStorage.getItem('keroschat_audioOutput') || null;
  selectedVideoInput = localStorage.getItem('keroschat_videoInput') || null;
  console.log('[DEVICES] Loaded preferences:', { selectedAudioInput, selectedAudioOutput, selectedVideoInput });
}

// Save device preferences
function saveDevicePreferences() {
  if (selectedAudioInput) localStorage.setItem('keroschat_audioInput', selectedAudioInput);
  if (selectedAudioOutput) localStorage.setItem('keroschat_audioOutput', selectedAudioOutput);
  if (selectedVideoInput) localStorage.setItem('keroschat_videoInput', selectedVideoInput);
  console.log('[DEVICES] Saved preferences:', { selectedAudioInput, selectedAudioOutput, selectedVideoInput });
}

// Enumerate available devices
async function enumerateDevices() {
  try {
    // Request permission first
    await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

    const devices = await navigator.mediaDevices.enumerateDevices();

    // Filter only devices with labels (available/active devices)
    // Devices without labels are usually disconnected or not accessible
    availableDevices = {
      audioinput: devices.filter(d => d.kind === 'audioinput' && d.label),
      audiooutput: devices.filter(d => d.kind === 'audiooutput' && d.label),
      videoinput: devices.filter(d => d.kind === 'videoinput' && d.label)
    };

    console.log('[DEVICES] Available devices:', availableDevices);
    console.log('[DEVICES] Total devices found:', devices.length, 'Active devices:', {
      audioinput: availableDevices.audioinput.length,
      audiooutput: availableDevices.audiooutput.length,
      videoinput: availableDevices.videoinput.length
    });

    // Update UI if settings panel is open
    updateDeviceSelectors();

    return availableDevices;
  } catch (err) {
    console.error('[DEVICES] Error enumerating devices:', err);
    return availableDevices;
  }
}

// Update device selector UI
function updateDeviceSelectors() {
  const audioInputSelect = document.getElementById('audioInputSelect');
  const audioOutputSelect = document.getElementById('audioOutputSelect');
  const videoInputSelect = document.getElementById('videoInputSelect');

  if (!audioInputSelect || !audioOutputSelect || !videoInputSelect) return;

  // Check if selected devices are still available, reset if not
  const audioInputIds = availableDevices.audioinput.map(d => d.deviceId);
  const audioOutputIds = availableDevices.audiooutput.map(d => d.deviceId);
  const videoInputIds = availableDevices.videoinput.map(d => d.deviceId);

  if (selectedAudioInput && !audioInputIds.includes(selectedAudioInput)) {
    console.log('[DEVICES] Selected audio input no longer available, resetting to default');
    selectedAudioInput = null;
    localStorage.removeItem('keroschat_audioInput');
  }
  if (selectedAudioOutput && !audioOutputIds.includes(selectedAudioOutput)) {
    console.log('[DEVICES] Selected audio output no longer available, resetting to default');
    selectedAudioOutput = null;
    localStorage.removeItem('keroschat_audioOutput');
  }
  if (selectedVideoInput && !videoInputIds.includes(selectedVideoInput)) {
    console.log('[DEVICES] Selected video input no longer available, resetting to default');
    selectedVideoInput = null;
    localStorage.removeItem('keroschat_videoInput');
  }

  // Audio input (microphone)
  audioInputSelect.innerHTML = '<option value="">Default</option>';
  availableDevices.audioinput.forEach(device => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `Microphone ${device.deviceId.slice(0, 8)}`;
    if (device.deviceId === selectedAudioInput) option.selected = true;
    audioInputSelect.appendChild(option);
  });

  // Audio output (speakers)
  audioOutputSelect.innerHTML = '<option value="">Default</option>';
  availableDevices.audiooutput.forEach(device => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `Speakers ${device.deviceId.slice(0, 8)}`;
    if (device.deviceId === selectedAudioOutput) option.selected = true;
    audioOutputSelect.appendChild(option);
  });

  // Video input (camera)
  videoInputSelect.innerHTML = '<option value="">Default</option>';
  availableDevices.videoinput.forEach(device => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `Camera ${device.deviceId.slice(0, 8)}`;
    if (device.deviceId === selectedVideoInput) option.selected = true;
    videoInputSelect.appendChild(option);
  });
}

// Select device
function selectDevice(type, deviceId) {
  console.log('[DEVICES] Selected device:', type, deviceId);

  switch (type) {
    case 'audioinput':
      selectedAudioInput = deviceId;
      // Restart mic level monitoring with new device
      if (localStream) {
        startMicLevelMonitoring();
      }
      break;
    case 'audiooutput':
      selectedAudioOutput = deviceId;
      // Apply to all remote videos
      document.querySelectorAll('.video-container:not(.local) video').forEach(video => {
        if (deviceId) {
          video.setSinkId(deviceId).catch(err => {
            console.error('[DEVICES] Error setting output device:', err);
          });
        }
      });
      break;
    case 'videoinput':
      selectedVideoInput = deviceId;
      break;
  }

  saveDevicePreferences();
}

// Start microphone level monitoring
function startMicLevelMonitoring() {
  stopMicLevelMonitoring();

  if (!localStream) return;

  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(localStream);
    const analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 256;
    analyzer.smoothingTimeConstant = 0.8; // Smoother transitions
    source.connect(analyzer);
    micLevelAnalyzer = analyzer;

    const dataArray = new Uint8Array(analyzer.frequencyBinCount);

    micLevelInterval = setInterval(() => {
      analyzer.getByteFrequencyData(dataArray);

      // Calculate average volume with increased sensitivity
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      // Increase sensitivity: multiply by 2.5 to use full range
      const level = Math.min(100, Math.round((average / 128) * 100 * 2.5));

      // Update UI
      updateMicLevelIndicator(level);

      // Call callback if set
      if (micLevelCallback) {
        micLevelCallback(level);
      }
    }, 100);

    console.log('[MIC LEVEL] Monitoring started');
  } catch (err) {
    console.error('[MIC LEVEL] Error starting monitoring:', err);
  }
}

// Stop microphone level monitoring
function stopMicLevelMonitoring() {
  if (micLevelInterval) {
    clearInterval(micLevelInterval);
    micLevelInterval = null;
  }
  if (micLevelAnalyzer) {
    micLevelAnalyzer = null;
  }
  console.log('[MIC LEVEL] Monitoring stopped');
}

// Update microphone level indicator UI
function updateMicLevelIndicator(level) {
  const indicator = document.getElementById('micLevelIndicator');
  if (!indicator) return;

  // If microphone is muted, show no level
  if (!isMicOn) {
    resetMicLevelIndicator();
    return;
  }

  // Create bars based on level (increased sensitivity to use all 5 bars)
  const barsCount = 5;
  // Use logarithmic scale for better sensitivity: level 0-100 maps to 0-5 bars
  // Level 0-10: 1 bar, 10-30: 2 bars, 30-50: 3 bars, 50-70: 4 bars, 70-100: 5 bars
  let activeBars;
  if (level < 10) activeBars = 1;
  else if (level < 30) activeBars = 2;
  else if (level < 50) activeBars = 3;
  else if (level < 70) activeBars = 4;
  else activeBars = 5;

  let html = '';

  for (let i = 0; i < barsCount; i++) {
    const isActive = i < activeBars;
    const color = isActive ? (level > 80 ? '#ed4245' : level > 60 ? '#faa61a' : '#3ba55d') : '#40444b';
    html += `<div style="width: 8px; height: 4px; background: ${color}; border-radius: 2px;"></div>`;
  }

  indicator.innerHTML = html;
}

// Reset mic level indicator to default state
function resetMicLevelIndicator() {
  const indicator = document.getElementById('micLevelIndicator');
  if (!indicator) return;

  const barsCount = 5;
  let html = '';
  for (let i = 0; i < barsCount; i++) {
    html += `<div style="width: 8px; height: 4px; background: #40444b; border-radius: 2px;"></div>`;
  }
  indicator.innerHTML = html;
}

// Test audio output with melody
async function testAudioOutput() {
  try {
    // Create audio context
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Create audio element for output
    const audioElement = new Audio();
    audioElement.volume = 0.5;

    // Apply selected output device BEFORE creating source
    if (selectedAudioOutput && typeof audioElement.setSinkId === 'function') {
      try {
        await audioElement.setSinkId(selectedAudioOutput);
        console.log('[AUDIO TEST] Successfully set output device to:', selectedAudioOutput);
      } catch (err) {
        console.error('[AUDIO TEST] Error setting sink ID:', err);
        console.log('[AUDIO TEST] Falling back to default output');
      }
    } else {
      console.log('[AUDIO TEST] Using default output device (setSinkId not available or no device selected)');
    }

    // Create oscillator for melody
    const oscillator = audioContext.createOscillator();
    oscillator.type = 'sine';

    // Create gain node for volume control
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0.3;

    // Connect oscillator to gain node
    oscillator.connect(gainNode);

    // Create media stream destination
    const destination = audioContext.createMediaStreamDestination();
    gainNode.connect(destination);

    // Connect to audio element
    audioElement.srcObject = destination.stream;

    // Play the audio
    await audioElement.play();
    oscillator.start();

    // Play a 3-second melody: C-E-G-C (C major chord arpeggio)
    const notes = [
      { freq: 261.63, start: 0, duration: 0.5 },    // C4
      { freq: 329.63, start: 0.5, duration: 0.5 }, // E4
      { freq: 392.00, start: 1.0, duration: 0.5 }, // G4
      { freq: 523.25, start: 1.5, duration: 0.5 }, // C5
      { freq: 392.00, start: 2.0, duration: 0.5 }, // G4
      { freq: 329.63, start: 2.5, duration: 0.5 }  // E4
    ];

    notes.forEach(note => {
      oscillator.frequency.setValueAtTime(note.freq, audioContext.currentTime + note.start);
    });

    // Fade out at the end
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 3);

    setTimeout(() => {
      oscillator.stop();
      audioElement.pause();
      audioElement.remove();
      audioContext.close();
      console.log('[AUDIO TEST] Test completed');
    }, 3000);

    console.log('[AUDIO TEST] Playing 3-second melody...');
  } catch (err) {
    console.error('[AUDIO TEST] Error:', err);
    showAlertModal('Ошибка теста звука: ' + err.message, 'error');
  }
}
let userAvatar = null;
let pingInterval = null;
let currentPing = 0;
let screenShareUsers = new Set(); // Track which remote users are screen sharing

// Ping measurement function
function measurePing() {
  if (!socketConnected) return;
  
  const startTime = Date.now();
  
  socket.timeout(5000).emit('ping-check', (err, serverTime) => {
    if (err) {
      currentPing = 0;
      updatePingDisplay();
      return;
    }
    const endTime = Date.now();
    currentPing = endTime - startTime;
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
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Free TURN servers (for testing only - replace with your own TURN server for production)
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
  ]
};

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

// ========== SOUND SYSTEM ==========
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

async function playSoftTone(frequency, duration, type = 'sine', volume = 0.1) {
  try {
    // Resume audio context if suspended (browser autoplay policy)
    if (audioContext.state === 'suspended') {
      console.log('[SOUND] Resuming audio context...');
      await audioContext.resume();
      console.log('[SOUND] Audio context resumed');
    }

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

    console.log('[SOUND] Playing tone:', frequency, 'Hz', duration, 's');
  } catch (err) {
    console.error('[SOUND] Error playing tone:', err);
  }
}

const sounds = {
  micOn: async () => await playSoftTone(600, 0.15, 'sine', 0.1),
  micOff: async () => await playSoftTone(350, 0.15, 'sine', 0.1),
  camOn: async () => await playSoftTone(500, 0.15, 'triangle', 0.1),
  camOff: async () => await playSoftTone(300, 0.15, 'triangle', 0.1),
  screenOn: async () => await playSoftTone(700, 0.2, 'sine', 0.15),
  screenOff: async () => await playSoftTone(400, 0.2, 'sine', 0.15),
  soundOn: async () => await playSoftTone(450, 0.15, 'sine', 0.1),
  soundOff: async () => await playSoftTone(280, 0.15, 'sine', 0.1),
  userJoin: async () => await playSoftTone(550, 0.3, 'sine', 0.1),
  userLeave: async () => await playSoftTone(380, 0.3, 'sine', 0.1)
};

// ========== SCREEN SHARING ==========

// Set screen share quality
function setScreenQuality(quality) {
  console.log('[SCREEN] Setting screen quality:', quality);
  screenQuality = quality;
  localStorage.setItem('keroschat_screen_quality', quality);
  
  // If screen sharing is active, restart with new quality
  if (isScreenSharing) {
    toggleScreen(); // Stop
    setTimeout(() => toggleScreen(), 100); // Restart with new quality
  }
}

window.setScreenQuality = setScreenQuality;

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
  // Load device preferences
  loadDevicePreferences();

  const savedUser = localStorage.getItem('keroschat_user');
  console.log('[AUTO-LOGIN] Checking localStorage for saved user...');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      userAvatar = localStorage.getItem(`keroschat_avatar_${currentUser.username}`);
      console.log('[AUTO-LOGIN] Loaded user from localStorage:', currentUser.username, 'role:', currentUser.role);

      // Refresh user data from API to get fresh role
      fetch('/api/users')
        .then(res => res.json())
        .then(users => {
          const freshUserData = users.find(u => u.username === currentUser.username);
          if (freshUserData) {
            // Always update role from fresh data
            currentUser.role = freshUserData.role || 'user';
            currentUser.isMuted = freshUserData.isMuted;
            currentUser.muteUntil = freshUserData.muteUntil;
            currentUser.kickedRooms = freshUserData.kickedRooms;
            localStorage.setItem('keroschat_user', JSON.stringify(currentUser));
            console.log('[AUTO-LOGIN] Refreshed user data from API, role:', currentUser.role);
          }
          showLobby();
        })
        .catch(err => {
          console.error('[AUTO-LOGIN] Error refreshing user data:', err);
          // Still show lobby even if API fails
          showLobby();
        });
    } catch (err) {
      console.error('[AUTO-LOGIN] Error parsing saved user:', err);
      localStorage.removeItem('keroschat_user');
      showAuth();
    }

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
                  showAlertModal(`Комната ${pendingRoom} не найдена. Возможно, она была удалена.`, 'error');
                  // Stay in lobby, don't auto-create room
                }
              })
              .catch(err => {
                console.error('Error checking room:', err);
                // On error, stay in lobby
                addLogEntry('Ошибка', 'Не удалось проверить комнату на сервере');
                showAlertModal('Ошибка подключения к серверу. Остаёмся в лобби.', 'error');
              });
          }
        }
      }, 800);
  } else {
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

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    // Server-side login only - no localStorage fallback
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        currentUser = data.user;
        currentUser.role = data.user.role || 'user';  // Ensure role is set
        localStorage.setItem('keroschat_user', JSON.stringify(currentUser));
        userAvatar = data.user.avatar || localStorage.getItem(`keroschat_avatar_${username}`);
        addLogEntry('Авторизация', `Пользователь ${username} вошёл в систему`);

        // Notify server about user being online (user is already registered)
        socket.emit('user-online', { username, avatar: data.user.avatar });

        showLobby();
        return;
      }
    }

    // Login failed
    addLogEntry('Ошибка', `Неудачная попытка входа для ${username}`);
    showAlertModal('Неверный никнейм или пароль!', 'error');
  } catch (err) {
    console.error('Login error:', err);
    addLogEntry('Ошибка', `Неудачная попытка входа для ${username}`);
    showAlertModal('Ошибка соединения с сервером. Попробуйте позже.', 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const passwordConfirm = document.getElementById('regPasswordConfirm').value;
  
  if (password !== passwordConfirm) {
    showAlertModal('Пароли не совпадают!', 'error');
    return;
  }
  
  try {
    // Check if user already exists on server
    const checkResponse = await fetch(`/api/users/${username}`);
    const checkData = await checkResponse.json();

    if (checkData.exists) {
      showAlertModal('Пользователь с таким именем уже зарегистрирован! Используйте форму входа.', 'error');
      return;
    }

    // Register new user on server
    socket.emit('user-registered', { username, avatar: null, isOnline: true, password });

    // Also save locally for offline support
    const localUsers = JSON.parse(localStorage.getItem('keroschat_users') || '[]');
    localUsers.push({ username, password, created: Date.now() });
    localStorage.setItem('keroschat_users', JSON.stringify(localUsers));

    currentUser = { username, name: username, avatar: null, role: 'user' };
    localStorage.setItem('keroschat_user', JSON.stringify(currentUser));
    addLogEntry('Авторизация', `Новый пользователь ${username} зарегистрирован`);

    showLobby();
    showAlertModal('Регистрация успешна!', 'success');
  } catch (err) {
    console.error('Registration error:', err);
    showAlertModal('Ошибка регистрации. Попробуйте снова.', 'error');
  }
};

function logout() {
  if (currentUser) {
    addLogEntry('Авторизация', `Пользователь ${currentUser.username} вышел из системы`);
  }
  localStorage.removeItem('keroschat_user');
  currentUser = null;
  location.reload();
}

// ========== AUTH ==========

function showAuth() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('roomScreen').style.display = 'none';
  document.getElementById('lobbyScreen').style.display = 'none';
}

// ========== LOBBY ==========

function showLobby() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('roomScreen').style.display = 'none';
  document.getElementById('lobbyScreen').style.display = 'flex';

  // Update user info
  if (!currentUser || !currentUser.username) {
    console.error('showLobby: currentUser or username is undefined', currentUser);
    // Try to restore from localStorage
    const savedUser = localStorage.getItem('keroschat_user');
    if (savedUser) {
      try {
        currentUser = JSON.parse(savedUser);
        userAvatar = localStorage.getItem(`keroschat_avatar_${currentUser.username}`);
        console.log('[LOBBY] Restored user from localStorage:', currentUser.username);
      } catch (err) {
        console.error('[LOBBY] Error restoring user:', err);
        showAuth();
        return;
      }
    } else {
      console.log('[LOBBY] No saved user found, showing auth screen');
      showAuth();
      return;
    }
  }

  document.getElementById('lobbyUsername').textContent = currentUser.username;
  const avatarEl = document.getElementById('lobbyAvatar');
  if (userAvatar) {
    avatarEl.innerHTML = `<img src="${userAvatar}" alt="avatar">`;
  } else {
    avatarEl.textContent = currentUser.username.charAt(0).toUpperCase();
  }
  
  // Notify server that user is online (in lobby)
  if (socketConnected && currentUser) {
    socket.emit('user-online', { 
      username: currentUser.username, 
      avatar: userAvatar 
    });
  }
  
  // Load saved theme
  if (typeof loadUserSettings === 'function') {
    loadUserSettings();
  }
  
  // Load rooms from server
  loadServerRooms();
  
  // Load registered users
  loadRegisteredUsers();
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

  // Deduplicate rooms by name (keep oldest room, prefer active rooms)
  const roomsMap = new Map();
  const roomsToDelete = [];

  console.log('[ROOMS] Starting deduplication for rooms:', serverRooms.map(r => ({id: r.id, name: r.name, active: r.active, created: r.created})));

  serverRooms.forEach(room => {
    if (!roomsMap.has(room.name)) {
      console.log(`[ROOMS] First occurrence of room "${room.name}": ${room.id}`);
      roomsMap.set(room.name, room);
    } else {
      const existing = roomsMap.get(room.name);
      console.log(`[ROOMS] Duplicate found for "${room.name}": existing=${existing.id}, new=${room.id}`);
      // Keep the oldest room or the active one
      if ((room.active && !existing.active) || (room.created || 0) < (existing.created || 0)) {
        // Mark existing for deletion
        console.log(`[ROOMS] Marking existing ${existing.id} for deletion (newer/active: ${room.id})`);
        roomsToDelete.push(existing);
        roomsMap.set(room.name, room);
      } else {
        // Mark current for deletion
        console.log(`[ROOMS] Marking current ${room.id} for deletion (older: ${existing.id})`);
        roomsToDelete.push(room);
      }
    }
  });

  // Automatically delete duplicate rooms from Supabase
  if (roomsToDelete.length > 0) {
    console.log('[ROOMS] Auto-deleting duplicate rooms:', roomsToDelete.map(r => ({id: r.id, name: r.name, created: r.created, active: r.active})));
    roomsToDelete.forEach(async (room) => {
      try {
        console.log(`[ROOMS] Attempting to delete duplicate room: ${room.id} (${room.name})`);
        const response = await fetch(`/api/rooms/${room.id}`, {
          method: 'DELETE',
          headers: {
            'X-Username': currentUser?.username || 'system'
          }
        });
        if (response.ok) {
          const result = await response.json();
          console.log(`[ROOMS] Auto-deleted duplicate room successfully: ${room.id}`, result);
        } else {
          const error = await response.json();
          console.error(`[ROOMS] Failed to delete duplicate room ${room.id}:`, error);
        }
      } catch (err) {
        console.error('[ROOMS] Error auto-deleting room:', err);
      }
    });
  }

  allRooms = Array.from(roomsMap.values());

  console.log(`[ROOMS] Deduplicated from ${serverRooms.length} to ${allRooms.length} rooms (auto-deleted ${roomsToDelete.length} duplicates)`);

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
    item.onclick = () => joinRoomById(room.id);
    
    const isCreator = room.creator === currentUser?.username;
    // REMOVED: Edit and delete buttons from lobby - use admin panel instead
    const actionsHtml = '';
    
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

// Load and display registered users in lobby
async function loadRegisteredUsers() {
  let users = [];

  try {
    // Try to fetch from API first
    const response = await fetch('/api/users');
    if (response.ok) {
      const apiUsers = await response.json();
      users = apiUsers.map(u => ({
        name: u.name || u.username,
        avatar: u.avatar,
        isOnline: u.isOnline
      }));

      // Update current user with mute and kick status
      if (currentUser) {
        const currentUserData = apiUsers.find(u => u.username === currentUser.username);
        if (currentUserData) {
          currentUser.isMuted = currentUserData.isMuted;
          currentUser.muteUntil = currentUserData.muteUntil;
          currentUser.kickedRooms = currentUserData.kickedRooms;
          currentUser.role = currentUserData.role;
        }
      }
    }
  } catch (err) {
    // API failed, use localStorage fallback
    console.log('API users not available, using localStorage fallback');
  }
  
  // Fallback to localStorage if API failed or returned empty
  if (users.length === 0) {
    const localUsers = JSON.parse(localStorage.getItem('keroschat_users') || '[]');
    const currentUserData = JSON.parse(localStorage.getItem('keroschat_user') || '{}');
    
    // Combine and deduplicate users
    const userMap = new Map();
    
    localUsers.forEach(u => {
      userMap.set(u.username, {
        name: u.username,
        avatar: localStorage.getItem(`keroschat_avatar_${u.username}`),
        isOnline: currentUserData.username === u.username
      });
    });
    
    // Add current user if exists and not already in list
    if (currentUserData.username && !userMap.has(currentUserData.username)) {
      userMap.set(currentUserData.username, {
        name: currentUserData.username,
        avatar: localStorage.getItem(`keroschat_avatar_${currentUserData.username}`),
        isOnline: true
      });
    }
    
    users = Array.from(userMap.values());
  }
  
  // Update header with count
  const header = document.getElementById('registeredUsersHeader');
  if (header) {
    header.textContent = `${users.length} 👥 Пользователи`;
  }
  
  const list = document.getElementById('registeredUsersList');
  if (!list) return;
  
  list.innerHTML = '';
  
  if (users.length === 0) {
    list.innerHTML = '<p style="color: #72767d; padding: 16px; text-align: center; font-size: 12px;">Пока нет зарегистрированных пользователей</p>';
    return;
  }
  
  // Sort: online users first, then by name
  users.sort((a, b) => {
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    return a.name.localeCompare(b.name);
  });
  
  users.forEach(user => {
    const item = document.createElement('div');
    item.className = 'registered-user-item' + (user.isOnline ? ' online' : '');
    
    const avatarHtml = user.avatar ? 
      `<img src="${user.avatar}" alt="${user.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">` :
      user.name.charAt(0).toUpperCase();
    
    const statusTitle = user.isOnline ? 'В сети' : 'Не в сети';
    
    item.innerHTML = `
      <div class="registered-user-avatar">${avatarHtml}</div>
      <span class="registered-user-name">${user.name}</span>
      <div class="registered-user-status" title="${statusTitle}"></div>
    `;
    
    list.appendChild(item);
  });
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
  showPromptModal('Введите новое название комнаты:', currentName, (newName) => {
    if (!newName || newName.trim() === '') return;

    showConfirmModal('Хотите изменить аватар комнаты?', (changeAvatar) => {
      let newAvatar = currentAvatar;

      if (changeAvatar) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (file) {
            if (file.size > 2 * 1024 * 1024) {
              showAlertModal('Файл слишком большой! Максимум 2MB', 'error');
              return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
              newAvatar = e.target.result;
              updateRoomInStorage(roomId, newName, newAvatar);
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
      } else {
        updateRoomInStorage(roomId, newName, newAvatar);
      }
    });
  });
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
    showAlertModal('Комната обновлена!', 'success');
  }
}

function deleteRoom(roomId) {
  showConfirmModal('Удалить эту комнату? Все участники будут отключены.', () => {
    const rooms = JSON.parse(localStorage.getItem('keroschat_rooms') || '[]');
    const filteredRooms = rooms.filter(r => r.id !== roomId);
    localStorage.setItem('keroschat_rooms', JSON.stringify(filteredRooms));

    // Reload room list immediately
    loadServerRooms();
    addLogEntry('Комната', `Комната ${roomId} удалена`);
    showAlertModal('Комната удалена!', 'success');
  });
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

async function createRoom() {
  const name = document.getElementById('newRoomName').value.trim();
  if (!name) {
    showAlertModal('Введите название комнаты!', 'error');
    return;
  }

  // Generate random 8-character room ID
  const roomId = generateRandomId(8);

  try {
    // Create room via REST API for synchronization
    const response = await fetch('/api/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-username': currentUser.username
      },
      body: JSON.stringify({
        id: roomId,
        name: name,
        avatar: newRoomAvatar
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create room');
    }

    const result = await response.json();
    console.log('[CREATE ROOM] Room created:', result);

    // Also store locally for immediate access
    const rooms = JSON.parse(localStorage.getItem('keroschat_rooms') || '[]');
    rooms.push({ id: roomId, name, creator: currentUser.username, avatar: newRoomAvatar });
    localStorage.setItem('keroschat_rooms', JSON.stringify(rooms));

    hideCreateRoomModal();
    await loadServerRooms(); // Wait for rooms to load before joining
    joinRoomById(roomId);
  } catch (err) {
    console.error('[CREATE ROOM] Error:', err);
    showAlertModal('Ошибка создания комнаты: ' + err.message, 'error');
  }
}

function generateRandomId(length) {
  return Math.random().toString(36).substring(2, length + 2).toUpperCase();
}

// ========== ROOM ==========

async function joinRoomById(roomId) {
  try {
    if (!currentUser) {
      showLoginModal();
      return;
    }

    // Find room from allRooms (loaded from server)
    console.log('[JOIN] Looking for room:', roomId);
    console.log('[JOIN] Available rooms:', allRooms.map(r => ({id: r.id, name: r.name})));
    const room = allRooms.find(r => r.id === roomId);
    if (!room) {
      console.error('[JOIN] Room not found:', roomId);
      showAlertModal('Комната не найдена', 'error');
      return;
    }
    console.log('[JOIN] Room found:', room.name);

  currentRoom = roomId;
  currentRoomName = room.name;
  currentRoomAvatar = room.avatar;

  // Check if user was screen sharing before (for restoration after join)
  const wasScreenSharing = localStorage.getItem('keroschat_screen_sharing') === 'true';

  // Stop screen sharing temporarily when joining (will restore after successful join)
  if (isScreenSharing) {
    console.log('[SCREEN] Stopping screen share temporarily for room join');
  }

  // Check if user is kicked from this room
  const kickedRooms = JSON.parse(localStorage.getItem('keroschat_kicked_rooms') || '[]');
  if (kickedRooms.includes(roomId)) {
    showAlertModal('Вы были выгнаны из этой комнаты', 'error');
    return;
  }

  // Request media stream with selected devices
  const constraints = {
    audio: selectedAudioInput ? { deviceId: { exact: selectedAudioInput } } : true,
    video: isCamOn ? (selectedVideoInput ? { deviceId: { exact: selectedVideoInput } } : true) : false
  };

  console.log('[DEVICES] Requesting media with constraints:', constraints);

  try {
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('[TRACK] Local track audio enabled:', localStream.getAudioTracks()[0]?.enabled);
    console.log('[TRACK] Local track audio muted:', localStream.getAudioTracks()[0]?.muted);
    console.log('[TRACK] Local track video enabled:', localStream.getVideoTracks()[0]?.enabled);

    // Detect OBS Virtual Camera (log only, don't block)
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      const label = videoTrack.label.toLowerCase();
      console.log('[DEVICES] Video track label:', videoTrack.label);
      if (label.includes('obs') || label.includes('virtual')) {
        console.warn('[DEVICES] OBS Virtual Camera detected - may cause issues with screen share');
        // NOT blocking - let user decide if they want to use it
      }
    }

    // Stop mic level monitoring if running
    if (micLevelInterval) {
      clearInterval(micLevelInterval);
      micLevelInterval = null;
      console.log('[MIC LEVEL] Monitoring stopped');
    }
  } catch (err) {
    console.error('[DEVICES] Error getting media:', err);

    // Fallback to default devices if selected devices fail
    if (selectedAudioInput || selectedVideoInput) {
      console.log('[DEVICES] Fallback to default devices');
      selectedAudioInput = null;
      selectedVideoInput = null;
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: isCamOn
        });
        console.log('[TRACK] Local track audio enabled:', localStream.getAudioTracks()[0]?.enabled);
        console.log('[TRACK] Local track video enabled:', localStream.getVideoTracks()[0]?.enabled);

        // Detect OBS Virtual Camera (log only, don't block)
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          const label = videoTrack.label.toLowerCase();
          console.log('[DEVICES] Video track label:', videoTrack.label);
          if (label.includes('obs') || label.includes('virtual')) {
            console.warn('[DEVICES] OBS Virtual Camera detected in fallback - may cause issues');
            // NOT blocking - let user decide
          }
        }
      } catch (fallbackErr) {
        console.error('[DEVICES] Fallback also failed:', fallbackErr);
        // If no camera available, fallback to audio-only
        try {
          localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
          });
          console.log('[TRACK] Local track audio enabled:', localStream.getAudioTracks()[0]?.enabled);
          showAlertModal('Камера не найдена или недоступна. Вход только с микрофоном.', 'info');
        } catch (audioOnlyErr) {
          console.error('[DEVICES] Audio-only also failed:', audioOnlyErr);
          return;
        }
      }
    } else {
      // If no camera available, fallback to audio-only
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false
        });
        console.log('[TRACK] Local track audio enabled:', localStream.getAudioTracks()[0]?.enabled);
        showAlertModal('Камера не найдена или недоступна. Вход только с микрофоном.', 'info');
      } catch (audioOnlyErr) {
        console.error('[DEVICES] Audio-only also failed:', audioOnlyErr);
        showAlertModal('Не удалось получить доступ к микрофону. Проверьте разрешения.', 'error');
        return;
      }
    }
  }

  // Emit join-room event
  console.log('[JOIN] Emitting join-room event');
  socket.emit('join-room', {
    roomId: currentRoom,
    username: currentUser.username,
    avatar: userAvatar || localStorage.getItem(`keroschat_avatar_${currentUser.username}`),
    isScreenSharing: isScreenSharing
  });
  console.log('[JOIN] join-room event emitted');

  // Play join sound for local user
  await sounds.userJoin();
  console.log('[JOIN] Play sound called');

  // Show room UI
  console.log('[JOIN] Showing room UI');
  const lobbyScreen = document.getElementById('lobbyScreen');
  const roomScreen = document.getElementById('roomScreen');
  console.log('[JOIN] lobbyScreen found:', !!lobbyScreen, 'roomScreen found:', !!roomScreen);
  if (lobbyScreen) {
    lobbyScreen.classList.remove('active');
    lobbyScreen.style.display = 'none';
    console.log('[JOIN] lobbyScreen classList after remove:', lobbyScreen.className);
  }
  if (roomScreen) {
    roomScreen.classList.add('active');
    roomScreen.style.display = 'flex';
    console.log('[JOIN] roomScreen classList after add:', roomScreen.className);
    console.log('[JOIN] roomScreen display:', roomScreen.style.display);
  }
  console.log('[JOIN] Room UI shown');

  // Add local video stream
  if (localStream.getVideoTracks().length > 0) {
    console.log('[JOIN] Adding local video stream');
    addVideoStream(socket.id, localStream, currentUser.username, true);
    console.log('[JOIN] Local video stream added');
  } else {
    // No camera - add local container with avatar placeholder
    console.log('[JOIN] No video track, adding local container with avatar');
    addVideoStream(socket.id, localStream, currentUser.username, true);
    console.log('[JOIN] Local avatar container added');
  }

  // Update active users list
  console.log('[JOIN] Updating active users');
  updateActiveUsers();
  console.log('[JOIN] Active users updated');

  // Start speaking detection and mic level monitoring
  console.log('[JOIN] Starting speaking detection');
  try {
    startSpeakingDetection();
    console.log('[JOIN] Speaking detection started');
  } catch (error) {
    console.error('[JOIN] Error starting speaking detection:', error);
  }
  try {
    startMicLevelMonitoring();
    console.log('[JOIN] Mic level monitoring started');
  } catch (error) {
    console.error('[JOIN] Error starting mic level monitoring:', error);
  }

  // Load user settings
  console.log('[JOIN] Loading user settings');
  try {
    loadUserSettings();
    console.log('[JOIN] User settings loaded');
  } catch (error) {
    console.error('[JOIN] Error loading user settings:', error);
  }

  // Load chat history for this room (if function exists)
  if (typeof loadChatHistory === 'function') {
    console.log('[JOIN] Loading chat history');
    loadChatHistory(currentRoom);
    console.log('[JOIN] Chat history loaded');
  }

  // Restore screen sharing if it was active before join
  if (wasScreenSharing) {
    console.log('[SCREEN] Restoring screen share after join');
    setTimeout(() => {
      toggleScreen();
    }, 1000);
  }
  console.log('[JOIN] joinRoomById completed successfully');
  } catch (error) {
    console.error('[JOIN] Error in joinRoomById:', error);
    showAlertModal('Ошибка входа в комнату: ' + error.message, 'error');
  }
}

// ... (rest of the code remains the same)

function showRoomUI() {
  document.getElementById('lobbyScreen').style.display = 'none';
  document.getElementById('roomScreen').style.display = 'flex';
  document.getElementById('roomScreen').style.flexDirection = 'column';
  
  // Reset current channel
  currentChannel = 'general';

  // DISABLED: Load channels list
  // const checkAndLoad = () => {
  //   if (socketConnected && currentRoom) {
  //     loadChannels();
  //   } else {
  //     setTimeout(checkAndLoad, 300);
  //   }
  // };
  // checkAndLoad();

  // Always show room name, not ID
  const displayName = currentRoomName && currentRoomName !== currentRoom ? currentRoomName : currentRoom;
  document.getElementById('displayRoomId').textContent = displayName;
  
  // Load saved theme
  if (typeof loadUserSettings === 'function') {
    loadUserSettings();
  }
  
  // Load chat history
  if (currentRoom) {
    socket.emit('get-room-messages', currentRoom, (messages) => {
      messages.forEach(msg => {
        addChatMessage(msg.sender, msg.text, false, msg.time);
      });
    });
  }
  
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

function resetRoomStateAndUI() {
  console.log(`[RESET] resetRoomStateAndUI called. peers.size before clear: ${peers.size}`);
  console.trace('[RESET] Stack trace of who called resetRoomStateAndUI');
  // Close peer connections
  peers.forEach((pc, id) => {
    console.log(`[RESET] Closing peer connection: ${id}`);
    pc.close();
  });
  peers.clear();
  activeUsers.clear();
  screenShareUsers.clear(); // Clear screen share tracking

  // Reset state
  currentRoom = null;
  isMicOn = true;
  isCamOn = false; // Camera OFF by default
  isSoundOn = true;
  isScreenSharing = false;

  // Clear UI
  document.getElementById('videoGrid').innerHTML = '';
  document.getElementById('chatMessages').innerHTML = '';

  // Reset buttons
  document.getElementById('micBtn').classList.remove('danger');
  document.getElementById('camBtn').classList.remove('danger');
  document.getElementById('screenBtn').classList.remove('active');
}

async function leaveRoom() {
  // Play sound for local user leaving room
  await sounds.userLeave();

  // Close any open screen share modals
  closeAllScreenModals();

  // Stop screen sharing if active
  if (isScreenSharing) {
    toggleScreen();
  }

  // Stop microphone level monitoring
  stopMicLevelMonitoring();

  // Stop streams
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  if (screenStream) {
    screenStream.getTracks().forEach(t => t.stop());
    screenStream = null;
  }

  // Stop ping measurement
  stopPingMeasurement();

  // Leave socket room
  socket.emit('leave-room', currentRoom);
  resetRoomStateAndUI();

  // Show settings panel if open
  document.getElementById('settingsPanel').classList.remove('active');

  // Back to lobby
  showLobby();
}

function disconnectAndJoinAnother() {
  // Close any open screen share modals
  closeAllScreenModals();
  
  // Stop screen sharing if active
  if (isScreenSharing) {
    toggleScreen();
  }
  
  // Just disconnect and return to lobby without stopping streams
  // Leave socket room
  socket.emit('leave-room', currentRoom);
  
  resetRoomStateAndUI();
  
  // Show settings panel if open
  document.getElementById('settingsPanel').classList.remove('active');
  
  // Back to lobby - streams continue running
  showLobby();
  
  // Show message to select another room
  showAlertModal('Вы отключены от комнаты. Выберите другую комнату из списка или создайте новую.', 'info');
}

function disconnectAndShowLobby() {
  // Close any open screen share modals
  closeAllScreenModals();
  
  // Stop screen sharing if active
  if (isScreenSharing) {
    toggleScreen();
  }
  
  // Leave socket room
  socket.emit('leave-room', currentRoom);
  
  resetRoomStateAndUI();
  
  // Show settings panel if open
  document.getElementById('settingsPanel').classList.remove('active');
  
  // Back to lobby
  showLobby();
}

function copyLink() {
  const link = `${window.location.origin}?room=${currentRoom}`;
  navigator.clipboard.writeText(link).then(() => {
    showAlertModal('Ссылка скопирована!', 'success');
  });
}

// ========== VIDEO & PEERS ==========

function addVideoStream(id, stream, name, isLocal = false, isScreenShare = false) {
  const videoGrid = document.getElementById('videoGrid');
  if (!videoGrid) return;

  // Use video-local for local user, video-${id} for remote users
  const containerId = isLocal ? 'video-local' : `video-${id}`;
  let container = document.getElementById(containerId);
  const isNew = !container;

  const hasVideoTrack = stream.getVideoTracks() && stream.getVideoTracks().length > 0;

  if (!container) {
    container = document.createElement('div');
    container.className = 'video-container' + (isScreenShare ? ' screen-share' : '') + (isLocal ? ' local' : '');
    container.id = containerId;

    // IMPORTANT: Only create video element if there are video tracks or it's screen share
    // For audio-only streams, don't create video element at all
    let video = null;
    if (hasVideoTrack || isScreenShare) {
      video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = isLocal;
      if (isLocal && !isScreenShare) video.style.transform = 'scaleX(-1)';
      
      console.log(`[VIDEO] Created video element for ${id}, hasVideoTrack: ${hasVideoTrack}, isScreenShare: ${isScreenShare}`);

      // Log video dimensions when loaded (important for debugging screen share)
      video.addEventListener('loadeddata', () => {
        const streamTracks = stream.getVideoTracks();
        const hasVideo = streamTracks.length > 0 && streamTracks[0].enabled && streamTracks[0].readyState === 'live';
        console.log(`[VIDEO] Video loaded for ${id}: ${video.videoWidth}x${video.videoHeight}, readyState: ${video.readyState}, hasLiveVideo: ${hasVideo}`);
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          console.error(`[VIDEO] CRITICAL: Video has 0x0 dimensions for ${id}! Stream has ${streamTracks.length} video tracks, enabled: ${streamTracks[0]?.enabled}, readyState: ${streamTracks[0]?.readyState}`);
        }
      });

      // For screen share, ensure it's visible
      if (isScreenShare) {
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'contain';
        console.log(`[VIDEO] Screen share video styled for ${id}`);
      }

      // Ensure video plays
      video.play().catch(e => {});
    } else {
      console.log(`[VIDEO] No video track for ${id}, skipping video element creation (audio-only)`);
    }

    const label = document.createElement('div');
    label.className = 'video-label';
    label.textContent = isLocal ? `${name} (Вы)` : name;

    // Add avatar placeholder for audio-only users (like Discord)
    if (!hasVideoTrack) {
      const avatarPlaceholder = document.createElement('div');
      avatarPlaceholder.className = 'avatar-placeholder';
      const avatar = isLocal ? (userAvatar || localStorage.getItem(`keroschat_avatar_${currentUser.username}`)) : (activeUsers.get(id)?.avatar);
      if (avatar) {
        avatarPlaceholder.innerHTML = `<img src="${avatar}" alt="${name}">`;
      } else {
        avatarPlaceholder.textContent = name.charAt(0).toUpperCase();
      }
      container.appendChild(avatarPlaceholder);
    }
    
    if (!isLocal && video) {
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
      // IMPORTANT: Never mute remote videos - user controls via volume slider
      video.muted = false;
      console.log(`[VIDEO] Video element created for ${id}, volume: ${video.volume}, muted: ${video.muted}`);

      // Apply selected audio output device
      if (selectedAudioOutput && typeof video.setSinkId === 'function') {
        video.setSinkId(selectedAudioOutput).catch(err => {
          console.error('[DEVICES] Error setting output device:', err);
        });
      }
    }
    
    // Add fullscreen button for screen share (only for REMOTE users, not local)
    // Local user doesn't need fullscreen button for their own screen share
    // Remote users DO need fullscreen button to enlarge shared screen
    if (isScreenShare && !isLocal && video) {
      // Extract original userId from screen ID (remove -screen suffix)
      const originalId = id.replace('-screen', '');

      // Add preview toggle button
      const previewToggleBtn = document.createElement('button');
      previewToggleBtn.className = 'preview-toggle-btn';
      previewToggleBtn.innerHTML = '👁️ Превью';
      previewToggleBtn.title = 'Переключить режим превью (экономия ресурсов)';
      previewToggleBtn.onclick = () => toggleScreenSharePreview(originalId);
      container.appendChild(previewToggleBtn);

      const fullscreenBtn = document.createElement('button');
      fullscreenBtn.className = 'fullscreen-btn';
      fullscreenBtn.innerHTML = '🔍';
      fullscreenBtn.title = 'Увеличить демонстрацию экрана';
      fullscreenBtn.onclick = () => openScreenModal(originalId);
      container.appendChild(fullscreenBtn);

      // Double-click on video to enlarge screen share
      video.style.cursor = 'pointer';
      video.title = 'Двойной клик для увеличения';
      video.ondblclick = () => openScreenModal(originalId);
    }
    
    if (video) {
      container.appendChild(video);
    }
    container.appendChild(label);
    videoGrid.appendChild(container);
  } else {
    // Container exists - update it
    let video = container.querySelector('video');
    
    // IMPORTANT: If no video element exists but we now have video track, create it
    if (!video && hasVideoTrack) {
      console.log(`[VIDEO] Creating video element in existing container for ${id}`);
      video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = isLocal;
      
      // Insert video before label
      const label = container.querySelector('.video-label');
      if (label) {
        container.insertBefore(video, label);
      } else {
        container.appendChild(video);
      }
      
      // Add loadeddata listener
      video.addEventListener('loadeddata', () => {
        const streamTracks = stream.getVideoTracks();
        const hasLiveVideo = streamTracks.length > 0 && streamTracks[0].enabled && streamTracks[0].readyState === 'live';
        console.log(`[VIDEO] Video loaded for ${id}: ${video.videoWidth}x${video.videoHeight}, hasLiveVideo: ${hasLiveVideo}`);
      });
    }
    
    if (video) {
      video.srcObject = stream;
      video.play().catch(e => {});

      // Show/hide video element based on video track
      if (hasVideoTrack) {
        video.style.visibility = 'visible';
        video.style.position = '';
        video.style.width = '';
        video.style.height = '';
        video.style.opacity = '1';
        
        // IMPORTANT: For screen share, ensure proper styling
        if (isScreenShare) {
          video.style.width = '100%';
          video.style.height = '100%';
          video.style.objectFit = 'contain';
          console.log(`[VIDEO] Updated existing video for screen share: ${id}`);
        }
      } else {
        video.style.visibility = 'hidden';
        video.style.position = 'absolute';
        video.style.width = '1px';
        video.style.height = '1px';
        video.style.opacity = '0';
      }
    }

    // Handle avatar placeholder - remove if video track exists, add if no video track
    const avatarPlaceholder = container.querySelector('.avatar-placeholder');
    if (hasVideoTrack) {
      // Video track exists - remove avatar placeholder
      if (avatarPlaceholder) {
        avatarPlaceholder.remove();
        console.log(`[VIDEO] Removed avatar placeholder for ${id} (video track received)`);
      }
    } else {
      // No video track - add avatar placeholder
      if (!avatarPlaceholder) {
        const newAvatarPlaceholder = document.createElement('div');
        newAvatarPlaceholder.className = 'avatar-placeholder';
        const avatar = isLocal ? (userAvatar || localStorage.getItem(`keroschat_avatar_${currentUser.username}`)) : (activeUsers.get(id)?.avatar);
        if (avatar) {
          newAvatarPlaceholder.innerHTML = `<img src="${avatar}" alt="${name}">`;
        } else {
          newAvatarPlaceholder.textContent = name.charAt(0).toUpperCase();
        }
        container.appendChild(newAvatarPlaceholder);
        console.log(`[VIDEO] Added avatar placeholder for ${id} (no video track)`);
      }
    }

    // Update styles if this is a screen share (for replaceTrack case)
    if (isScreenShare && !isLocal) {
      container.classList.add('screen-share');
      // Force inline styles for visibility
      container.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; min-width: 640px; min-height: 360px; border: 3px solid #3ba55d;';
      video.style.cssText = 'width: 100% !important; height: 100% !important; object-fit: contain !important; display: block !important; visibility: visible !important;';

      // Extract original userId from screen ID (remove -screen suffix)
      const originalId = id.replace('-screen', '');

      // Add fullscreen button if not exists
      if (!container.querySelector('.fullscreen-btn')) {
        const fullscreenBtn = document.createElement('button');
        fullscreenBtn.className = 'fullscreen-btn';
        fullscreenBtn.innerHTML = '🔍';
        fullscreenBtn.title = 'Увеличить демонстрацию экрана';
        fullscreenBtn.onclick = () => openScreenModal(originalId);
        container.appendChild(fullscreenBtn);

        video.style.cursor = 'pointer';
        video.title = 'Двойной клик для увеличения';
        video.ondblclick = () => openScreenModal(originalId);
      }
    }
  }
  updateUserCount();
}

function removeVideoStream(id) {
  // Remove camera container
  const container = document.getElementById(`video-${id}`);
  if (container) container.remove();

  // Remove screen share container (if exists)
  const screenContainer = document.getElementById(`video-${id}-screen`);
  if (screenContainer) screenContainer.remove();

  updateUserCount();
}

function updateUserCount() {
  const count = document.querySelectorAll('.video-container').length;
  document.getElementById('userCount').textContent = count;
}

function updateActiveUsers() {
  const list = document.getElementById('activeUsers');
  if (!list) return;
  
  list.innerHTML = '';
  
  // Track unique usernames to prevent duplicates
  const addedUsernames = new Set();
  
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
  addedUsernames.add(currentUser.username.toLowerCase());
  
  // Remote users from activeUsers (only those currently in room)
  activeUsers.forEach((user, id) => {
    // Skip if user has no name
    if (!user || !user.name) {
      console.warn(`[ACTIVE] User ${id} has no name, skipping`);
      return;
    }
    const username = user.name.toLowerCase();
    
    // Skip if already added (prevents duplicates)
    if (addedUsernames.has(username)) return;
    
    addedUsernames.add(username);
    
    const item = document.createElement('div');
    item.className = 'user-item';
    item.id = `user-item-${id}`;
    
    // Check if user has avatar
    const avatarHtml = user.avatar ? 
      `<img src="${user.avatar}" alt="avatar">` :
      user.name.charAt(0).toUpperCase();
    
    // Check if user has muted mic or sound
    const isMicMuted = user.isMicMuted || false;
    const isSoundMuted = user.isSoundMuted || false;
    
    const micIcon = isMicMuted ? '<span class="user-icon muted" title="Микрофон выключен">🎤❌</span>' : '';
    const soundIcon = isSoundMuted ? '<span class="user-icon muted" title="Звук выключен">🔇</span>' : '';
    
    item.innerHTML = `
      <div class="user-avatar" id="avatar-${id}">${avatarHtml}</div>
      <span class="user-name">${user.name}</span>
      <div class="user-icons">
        ${micIcon}
        ${soundIcon}
        <div class="user-status" id="status-${id}"></div>
      </div>
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

async function createPeerConnection(userId, forceScreen = false) {
  console.log(`[PEER] Creating peer connection for user: ${userId}, isScreenSharing: ${isScreenSharing}, forceScreen: ${forceScreen}`);
  
  // Check if localStream exists
  if (!localStream) {
    console.error(`[PEER] CRITICAL ERROR: localStream is null! Cannot create peer connection.`);
    return null;
  }
  
  const pc = new RTCPeerConnection({
    ...iceServers
  });

  console.log(`[PEER] Adding local tracks to peer connection for ${userId}, localStream tracks:`, localStream.getTracks().map(t => ({kind: t.kind, enabled: t.enabled, muted: t.muted})));

  // Add all tracks from localStream (camera + audio)
  localStream.getTracks().forEach(track => {
    console.log(`[PEER] Adding track: ${track.kind}, label: ${track.label}, enabled: ${track.enabled}, muted: ${track.muted}`);
    // Ensure audio track is not muted and enabled
    if (track.kind === 'audio') {
      if (track.muted) {
        console.warn(`[PEER] WARNING: Local audio track is muted! Attempting to unmute`);
        track.enabled = true;
      }
      if (!track.enabled) {
        console.warn(`[PEER] WARNING: Local audio track is disabled! Enabling`);
        track.enabled = true;
      }
    }
    pc.addTrack(track, localStream);
  });

  // If screen sharing is active OR forceScreen is true, ADD screen track as well
  if ((isScreenSharing && screenStream) || forceScreen) {
    console.log(`[PEER] Screen sharing active OR forceScreen=true, adding screen track for peer ${userId}`);
    const screenTrack = screenStream ? screenStream.getVideoTracks()[0] : null;
    if (screenTrack) {
      console.log(`[PEER] Screen track properties: label=${screenTrack.label}, enabled=${screenTrack.enabled}`);
      pc.addTrack(screenTrack, screenStream);
      console.log(`[PEER] Screen track added to peer ${userId} (in addition to camera)`);
    } else if (forceScreen) {
      console.warn(`[PEER] forceScreen=true but no screenStream available!`);
    }
  }
  console.log(`[PEER] Total tracks added to peer ${userId}`);

  pc.ontrack = (e) => {
    const stream = e.streams[0];
    const receivedTrack = e.track;
    const tracks = stream.getTracks();
    const videoTrack = tracks.find(t => t.kind === 'video');
    const audioTrack = tracks.find(t => t.kind === 'audio');

    // Log individual track event
    console.log(`[TRACK] ontrack fired for ${userId}:`, {
      receivedTrackKind: receivedTrack?.kind,
      receivedTrackLabel: receivedTrack?.label,
      streamTracks: tracks.map(t => t.kind),
      streamId: stream?.id
    });

    // Log detailed track info for debugging
    const trackInfo = tracks.map(t => ({
      kind: t.kind,
      label: t.label,
      readyState: t.readyState,
      enabled: t.enabled,
      muted: t.muted
    }));
    console.log(`[TRACK] All tracks from ${userId}:`, JSON.stringify(trackInfo));

    // Log video track settings
    if (videoTrack) {
      const videoSettings = videoTrack.getSettings();
      console.log(`[TRACK] Video track settings from ${userId}:`, videoSettings);
    }

    // Log audio track specifically
    if (audioTrack) {
      console.log(`[AUDIO] Received audio from ${userId}: enabled=${audioTrack.enabled}, muted=${audioTrack.muted}, state=${audioTrack.readyState}`);
      console.log(`[AUDIO] Audio track details - id: ${audioTrack.id}, label: ${audioTrack.label}`);

      // Audio track muted is READ-ONLY - it means browser isn't receiving media data
      if (audioTrack.muted) {
        console.warn(`[AUDIO] Audio track is MUTED for ${userId} - waiting for data from remote peer...`);
        
        // Add unmute listener to detect when audio starts flowing
        audioTrack.addEventListener('unmute', () => {
          console.log(`[AUDIO] Audio track UNMUTED for ${userId} - data is now flowing!`);
          // Try to play any pending audio elements
          const audioEl = document.getElementById(`audio-${userId}`);
          if (audioEl) {
            audioEl.play().then(() => {
              console.log(`[AUDIO] Playing audio after unmute for ${userId}`);
            }).catch(e => console.error(`[AUDIO] Error playing after unmute:`, e));
          }
        });
        
        // Also listen for mute event
        audioTrack.addEventListener('mute', () => {
          console.log(`[AUDIO] Audio track MUTED for ${userId} - data stopped flowing`);
        });
      }

      // If no video track, create audio element for audio-only stream
      if (!videoTrack) {
        console.log(`[AUDIO] No video track, creating audio element for ${userId}`);
        const audioContainer = document.getElementById(`video-${userId}`);
        if (audioContainer) {
          let audioEl = audioContainer.querySelector('audio');
          if (!audioEl) {
            audioEl = document.createElement('audio');
            audioEl.autoplay = true;
            audioEl.muted = false;
            audioEl.id = `audio-${userId}`;
            audioEl.controls = false;
            audioEl.style.display = 'none';
            audioContainer.appendChild(audioEl);
          }
          audioEl.srcObject = stream;
          console.log(`[AUDIO] Audio element created/updated for ${userId}, isSoundOn: ${isSoundOn}`);

          // Force volume to 0.5 to ensure audio can be heard
          audioEl.volume = 0.5;
          audioEl.muted = false;

          // Try to play audio
          audioEl.play().then(() => {
            console.log(`[AUDIO] Audio playing for ${userId}, volume: ${audioEl.volume}, muted: ${audioEl.muted}, paused: ${audioEl.paused}`);
          }).catch(err => {
            console.error(`[AUDIO] Error playing audio for ${userId}:`, err?.name, err?.message);
            // Try with user interaction
            const playOnInteraction = () => {
              audioEl.play().then(() => {
                console.log(`[AUDIO] Audio playing after interaction for ${userId}`);
              }).catch(clickErr => {
                console.error(`[AUDIO] Error playing audio after interaction for ${userId}:`, clickErr);
              });
            };
            audioEl.addEventListener('click', playOnInteraction);
            audioContainer.addEventListener('click', playOnInteraction, { once: true });
            document.body.addEventListener('click', playOnInteraction, { once: true });
          });
        }
      }
    } else {
      console.warn(`[AUDIO] No audio track received from ${userId}!`);
    }

    // Add onended handler for video track to remove screen container
    if (videoTrack) {
      videoTrack.onended = () => {
        console.log(`[TRACK] Video track ended for ${userId}`);
        if (screenShareUsers.has(userId)) {
          const screenContainer = document.getElementById(`video-${userId}-screen`);
          if (screenContainer) {
            screenContainer.remove();
            console.log('[SCREEN] Removed screen container after track ended:', userId);
          }
          screenShareUsers.delete(userId);
          const user = activeUsers.get(userId);
          const userName = user ? user.name : 'Участник';
          addLogEntry('Демонстрация', `${userName} остановил демонстрацию экрана`);
        }
      };

      // IMPORTANT: Handle muted tracks - video might start muted and unmute later
      if (videoTrack.muted) {
        console.log(`[TRACK] Video track is muted for ${userId}, waiting for unmute event`);
        videoTrack.onunmute = () => {
          console.log(`[TRACK] Video track unmuted for ${userId}!`);
          // Refresh the video element
          const videoId = screenShareUsers.has(userId) ? `${userId}-screen` : userId;
          const container = document.getElementById(`video-${videoId}`);
          if (container) {
            const video = container.querySelector('video');
            if (video) {
              video.play().catch(e => console.error(`[VIDEO] Error playing after unmute:`, e));
              console.log(`[VIDEO] Replayed video after unmute for ${userId}`);
            }
          }
        };
      }
    }

    // Detect screen share - use screenShareUsers Map (set when user starts screen share)
    // Fallback to label/resolution detection for edge cases
    const isScreenByUserFlag = screenShareUsers.has(userId);
    
    const isScreenByLabel = videoTrack && (
      videoTrack.label.toLowerCase().includes('screen') ||
      videoTrack.label.toLowerCase().includes('display') ||
      videoTrack.label.toLowerCase().includes('window')
    );

    // Detect screen share by settings (screen share usually has higher resolution or aspect ratio)
    const settings = videoTrack?.getSettings();
    const width = settings?.width || 0;
    const height = settings?.height || 0;
    // Screen share typically has 16:9 or wider aspect ratio, or high resolution
    const isScreenByResolution = width >= 720 || (width > 0 && width/height > 1.3);
    
    console.log(`[TRACK] Screen detection inputs for ${userId}: userFlag=${isScreenByUserFlag}, label=${isScreenByLabel}, resolution=${isScreenByResolution}`);

    console.log(`[TRACK] Video settings for ${userId}:`, width, 'x', height, 'aspect:', width/height);

    socket.emit('get-user-name', userId, (name) => {
      const userName = name || 'Участник';
      if (!activeUsers.has(userId)) {
        activeUsers.set(userId, { id: userId, name: userName });
      }

      // Check if this is a screen track - prioritize user flag (most reliable)
      let isScreenShare = isScreenByUserFlag || isScreenByLabel || isScreenByResolution;
      console.log(`[TRACK] Screen detection for ${userId}: userFlag=${isScreenByUserFlag}, label=${isScreenByLabel}, resolution=${isScreenByResolution}, FINAL=${isScreenShare}`);

      // If not detected as screen but might be pending, check again with delay
      if (!isScreenShare && videoTrack) {
        setTimeout(() => {
          const nowIsScreen = screenShareUsers.has(userId);
          if (nowIsScreen && !document.getElementById(`video-${userId}-screen`)) {
            console.log(`[TRACK] Late screen detection for ${userId}, moving video to screen container`);
            // Remove regular container and recreate as screen
            const regularContainer = document.getElementById(`video-${userId}`);
            if (regularContainer) {
              regularContainer.remove();
              addVideoStream(`${userId}-screen`, stream, userName, false, true);
            }
          }
        }, 500);
      }

      // Use unique ID for screen share container (userId + '-screen')
      const videoId = isScreenShare ? `${userId}-screen` : userId;

      // IMPORTANT: For screen share, if no video tracks yet, wait for them
      if (isScreenShare && !videoTrack) {
        console.log(`[TRACK] Screen share detected but no video track yet for ${userId}, waiting...`);
        // Set up a listener on the stream for when tracks are added
        const checkForVideoTrack = () => {
          const newVideoTrack = stream.getVideoTracks()[0];
          if (newVideoTrack) {
            console.log(`[TRACK] Video track now available for screen share ${userId}:`, newVideoTrack.label);
            // Now add the video stream with the actual video track
            addVideoStream(videoId, stream, userName, false, true);
            updateActiveUsers();
          } else {
            console.log(`[TRACK] Still no video track for ${userId}, retrying...`);
            setTimeout(checkForVideoTrack, 100);
          }
        };
        setTimeout(checkForVideoTrack, 100);
      } else {
        // Add video stream immediately if we have video track or it's not screen share
        addVideoStream(videoId, stream, userName, false, isScreenShare);
      }
      updateActiveUsers();

      // Try to play video/audio elements
      setTimeout(() => {
        const container = document.getElementById(videoId);
        if (container) {
          const video = container.querySelector('video');
          if (video) {
            video.play().then(() => {
              console.log(`[AUDIO] Video element playing for ${userId}`);
            }).catch(err => {
              console.error(`[AUDIO] Error playing video for ${userId}:`, err);
            });
          }
          const audio = container.querySelector('audio');
          if (audio) {
            audio.play().then(() => {
              console.log(`[AUDIO] Audio element playing for ${userId}`);
            }).catch(err => {
              console.error(`[AUDIO] Error playing audio for ${userId}:`, err);
            });
          }
        }
      }, 100);
    });
  };

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      console.log(`[ICE] Candidate for ${userId}:`, e.candidate.type, e.candidate.protocol, e.candidate.address, e.candidate.port);
      // Serialize candidate as plain object to avoid Socket.IO serialization issues
      const candidateObj = {
        candidate: e.candidate.candidate,
        sdpMid: e.candidate.sdpMid,
        sdpMLineIndex: e.candidate.sdpMLineIndex,
        type: e.candidate.type,
        protocol: e.candidate.protocol,
        address: e.candidate.address,
        port: e.candidate.port
      };
      socket.emit('ice-candidate', userId, candidateObj);
    } else {
      console.log(`[ICE] ICE gathering complete for ${userId}`);
    }
  };

  pc.oniceconnectionstatechange = () => {
    console.log(`[ICE] Connection state for ${userId}:`, pc.iceConnectionState);
    if (pc.iceConnectionState === 'connected') {
      console.log(`[ICE] ICE connection established for ${userId} - audio should now work`);
      
      // Get stats to verify audio is being sent/received
      setTimeout(async () => {
        const stats = await pc.getStats();
        let audioSenders = 0;
        let audioReceivers = 0;
        let audioBytesSent = 0;
        let audioBytesReceived = 0;
        
        stats.forEach(report => {
          if (report.type === 'outbound-rtp' && report.mediaType === 'audio') {
            audioSenders++;
            audioBytesSent = report.bytesSent || 0;
            console.log(`[STATS] ${userId} Audio outbound - bytesSent: ${audioBytesSent}, packetsSent: ${report.packetsSent || 0}`);
          }
          if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
            audioReceivers++;
            audioBytesReceived = report.bytesReceived || 0;
            console.log(`[STATS] ${userId} Audio inbound - bytesReceived: ${audioBytesReceived}, packetsReceived: ${report.packetsReceived || 0}, jitter: ${report.jitter || 0}`);
          }
        });
        
        if (audioSenders === 0) {
          console.error(`[STATS] ${userId} NO AUDIO SENDER FOUND - local audio track not being sent!`);
        }
        if (audioReceivers === 0) {
          console.warn(`[STATS] ${userId} NO AUDIO RECEIVER FOUND - remote audio track not being received`);
        }
      }, 2000);
      
    } else if (pc.iceConnectionState === 'failed') {
      console.error(`[ICE] ICE connection failed for ${userId} - audio will not work`);
    } else if (pc.iceConnectionState === 'disconnected') {
      console.warn(`[ICE] ICE connection disconnected for ${userId}`);
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`[ICE] Peer connection state for ${userId}:`, pc.connectionState);
    if (pc.connectionState === 'disconnected') {
      console.warn(`[ICE] Peer ${userId} disconnected - waiting 5 seconds before cleanup to allow reconnection`);
      // Don't delete immediately - give time for reconnection
      setTimeout(() => {
        // Check if still disconnected
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          console.log(`[ICE] Peer ${userId} still disconnected after timeout, cleaning up`);
          removeVideoStream(userId);
          peers.delete(userId);
          updateActiveUsers();
        } else {
          console.log(`[ICE] Peer ${userId} reconnected, not cleaning up`);
        }
      }, 5000);
    } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      console.warn(`[ICE] Peer ${userId} ${pc.connectionState}, removing`);
      removeVideoStream(userId);
      peers.delete(userId);
      updateActiveUsers();
    }
  };

  peers.set(userId, pc);
  console.log(`[PEER] Peer added to Map. peers.size is now: ${peers.size}, window.peers.size: ${window.peers?.size}`);
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
    
    // Refresh room list to show updated info
    loadServerRooms();
  }
});

// Listen for theme changes from other users
socket.on('theme-changed', ({ theme }) => {
  // Apply theme if setTheme function is available (from admin.js)
  if (typeof setTheme === 'function') {
    setTheme(theme);
  } else {
    // Fallback: apply theme directly
    const themes = {
      dark: { '--bg-primary': '#36393f', '--bg-secondary': '#2f3136', '--bg-tertiary': '#202225', '--text-primary': '#fff', '--text-secondary': '#b9bbbe', '--accent': '#5865f2' },
      blue: { '--bg-primary': '#1a237e', '--bg-secondary': '#283593', '--bg-tertiary': '#0d47a1', '--text-primary': '#fff', '--text-secondary': '#b3e5fc', '--accent': '#2196f3' },
      red: { '--bg-primary': '#b71c1c', '--bg-secondary': '#c62828', '--bg-tertiary': '#7f0000', '--text-primary': '#fff', '--text-secondary': '#ffcdd2', '--accent': '#f44336' },
      green: { '--bg-primary': '#1b5e20', '--bg-secondary': '#2e7d32', '--bg-tertiary': '#004d00', '--text-primary': '#fff', '--text-secondary': '#c8e6c9', '--accent': '#4caf50' },
      purple: { '--bg-primary': '#4a148c', '--bg-secondary': '#6a1b9a', '--bg-tertiary': '#38006b', '--text-primary': '#fff', '--text-secondary': '#e1bee7', '--accent': '#9c27b0' }
    };
    const themeData = themes[theme];
    if (themeData) {
      Object.entries(themeData).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
      });
    }
  }
});

// Listen for user mute state changes
socket.on('user-mute-state', ({ userId, isMicMuted, isSoundMuted }) => {
  const user = activeUsers.get(userId);
  if (user) {
    user.isMicMuted = isMicMuted;
    user.isSoundMuted = isSoundMuted;
    updateActiveUsers(); // Refresh the user list to show icons
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
    if (!pc) {
      console.error(`[INIT] Failed to create peer connection for ${user.id}, skipping offer`);
      return;
    }
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
    showAlertModal('Эта комната была удалена создателем.', 'info');
  }
});

socket.on('room-error', (error) => {
  console.error('[ROOM-ERROR] Received room-error from server:', error);
  addLogEntry('Ошибка', error.message);
  showAlertModal(error.message, 'error');
  // If in room, go back to lobby
  if (currentRoom) {
    console.log('[ROOM-ERROR] Leaving room due to error');
    leaveRoom();
  }
});

socket.on('user-joined', (user) => {
  console.log('[USER-JOINED] Received user-joined:', user.id, user.name);

  // Play sound when someone joins (non-blocking)
  sounds.userJoin();

  // Skip if already connected with this exact socket.id
  if (activeUsers.has(user.id) || peers.has(user.id)) {
    console.log('[USER-JOINED] User already connected with this exact socket.id, skipping:', user.id);
    return;
  }

  // Check if user with same name already exists (reconnect case)
  let existingUserId = null;
  for (const [id, existingUser] of activeUsers.entries()) {
    if (existingUser.name === user.name && id !== user.id) {
      existingUserId = id;
      console.log('[USER-JOINED] Found existing user with same name, removing old entry:', existingUserId);
      break;
    }
  }

  // Remove old entry if found
  if (existingUserId) {
    activeUsers.delete(existingUserId);
    // Also remove peer connection if exists
    if (peers.has(existingUserId)) {
      peers.get(existingUserId).close();
      peers.delete(existingUserId);
    }
    // Remove video stream
    removeVideoStream(existingUserId);
  }

  // Avatar sync debug - disabled for production performance
  // console.log('[AVATAR] User joined:', user.name, 'has avatar:', !!user.avatar);
  // REMOVED: sounds.userJoin() - sound should only play for the user who joined, not everyone in room
  activeUsers.set(user.id, user);
  addChatMessage('Система', `Комната "${currentRoomName}" - подключился ${user.name}`, true);
  updateActiveUsers();

  // Update admin panel remote volume controls
  if (typeof window.updateAdminRemoteVolumeControls === 'function') {
    window.updateAdminRemoteVolumeControls();
  }

  console.log('[USER-JOINED] User added to activeUsers:', user.id, user.name);

  // Create peer connection and send offer
  if (!peers.has(user.id)) {
    console.log('[USER-JOINED] Creating peer connection for new user:', user.id);
    createPeerConnection(user.id).then(async (pc) => {
      if (!pc) {
        console.error(`[USER-JOINED] Failed to create peer connection for ${user.id}`);
        return;
      }
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('offer', user.id, offer);
      console.log('[USER-JOINED] Offer sent to:', user.id);
    }).catch(err => {
      console.error('[USER-JOINED] Error creating peer connection:', err);
    });
  }
});

socket.on('user-deleted', (username) => {
  // Remove user from localStorage if it's the current user
  const localUsers = JSON.parse(localStorage.getItem('keroschat_users') || '[]');
  const filteredUsers = localUsers.filter(u => u.username !== username);
  localStorage.setItem('keroschat_users', JSON.stringify(filteredUsers));
  
  // Remove avatar
  localStorage.removeItem(`keroschat_avatar_${username}`);
  
  // Refresh user list in lobby
  loadRegisteredUsers();
  
  // If current user was deleted, log them out
  if (currentUser && currentUser.username === username) {
    showAlertModal('Ваш аккаунт был удалён администратором', 'error');
    logout();
  }
});

socket.on('user-left', (userId) => {
  // Play sound when someone leaves (non-blocking)
  sounds.userLeave();

  const user = activeUsers.get(userId);
  removeVideoStream(userId);
  if (peers.has(userId)) {
    peers.get(userId).close();
    peers.delete(userId);
  }
  activeUsers.delete(userId);
  const userName = user ? user.name : 'Участник';
  addChatMessage('Система', `Комната "${currentRoomName}" - отключился ${userName}`, true);
  updateActiveUsers();

  // Update admin panel remote volume controls
  if (typeof window.updateAdminRemoteVolumeControls === 'function') {
    window.updateAdminRemoteVolumeControls();
  }
});

// Room synchronization events
socket.on('room-created', (room) => {
  console.log('[SYNC] Room created:', room.name);
  loadServerRooms();
});

socket.on('room-deleted', (roomId) => {
  console.log('[SYNC] Room deleted:', roomId);
  // Remove from local storage
  const localRooms = JSON.parse(localStorage.getItem('keroschat_rooms') || '[]');
  const filtered = localRooms.filter(r => r.id !== roomId);
  localStorage.setItem('keroschat_rooms', JSON.stringify(filtered));
  loadServerRooms();
});

socket.on('rooms-updated', () => {
  console.log('[SYNC] Rooms updated');
  loadServerRooms();
});

// Channel synchronization events
socket.on('channel-created', (channel) => {
  console.log('[SYNC] Channel created:', channel.name);
  // Channels are disabled, but log for debugging
});

socket.on('channel-updated', (channel) => {
  console.log('[SYNC] Channel updated:', channel.name);
  // Channels are disabled, but log for debugging
});

socket.on('channel-deleted', (channelId) => {
  console.log('[SYNC] Channel deleted:', channelId);
  // Channels are disabled, but log for debugging
});

socket.on('channels-updated', () => {
  console.log('[SYNC] Channels updated');
  // Channels are disabled, but log for debugging
});

socket.on('offer', async (userId, offer) => {
  // Offer received
  console.log('[OFFER] Received offer from:', userId, 'type:', offer.type);
  
  // Check if this is a renegotiation (peer connection exists)
  if (peers.has(userId)) {
    const existingPc = peers.get(userId);
    const existingSenders = existingPc.getSenders();
    console.log('[OFFER] Existing peer connection found, senders:', existingSenders.map(s => ({ kind: s.track?.kind, label: s.track?.label })));
    console.log('[OFFER] Peer connection state:', existingPc.signalingState);

    // Use existing peer connection for renegotiation
    console.log('[OFFER] Using existing peer connection for renegotiation');
    try {
      await existingPc.setRemoteDescription(offer);
      console.log('[OFFER] Remote description set');
      const answer = await existingPc.createAnswer();
      console.log('[OFFER] Answer created, type:', answer.type);
      await existingPc.setLocalDescription(answer);
      console.log('[OFFER] Local description set');
      socket.emit('answer', userId, answer);
      console.log('[OFFER] Answer sent to:', userId);
      updateActiveUsers();
    } catch (err) {
      console.error('[OFFER] Error in renegotiation:', err);
      console.error('[OFFER] Peer connection state:', existingPc.signalingState);
      // Don't recreate peer connection - just log the error
      // Recreating breaks ICE connection and causes audio to be muted
    }
  } else {
    // Create new peer connection (initial connection)
    const pc = await createPeerConnection(userId);
    if (!pc) {
      console.error(`[OFFER] Failed to create peer connection for ${userId}, cannot process offer`);
      return;
    }
    console.log('[OFFER] Created new peer connection');
    await pc.setRemoteDescription(offer);
    console.log('[OFFER] Remote description set');
    const answer = await pc.createAnswer();
    console.log('[OFFER] Answer created, type:', answer.type);
    await pc.setLocalDescription(answer);
    console.log('[OFFER] Local description set');
    socket.emit('answer', userId, answer);
    console.log('[OFFER] Answer sent to:', userId);
    updateActiveUsers();
  }
});

socket.on('answer', async (userId, answer) => {
  // Answer received
  console.log('[ANSWER] Received answer from:', userId);
  if (peers.has(userId)) {
    const pc = peers.get(userId);
    console.log('[ANSWER] Peer connection state before setRemoteDescription:', pc.signalingState);
    console.log('[ANSWER] Has remote description:', !!pc.remoteDescription);

    // If peer connection is already in stable state AND has remote description, this is a duplicate answer
    // Just log and ignore it
    if (pc.signalingState === 'stable' && pc.remoteDescription) {
      console.log('[ANSWER] Peer connection is already in stable state with remote description, ignoring duplicate answer');
      return;
    }

    try {
      await pc.setRemoteDescription(answer);
      console.log('[ANSWER] Remote description set for:', userId);
    } catch (err) {
      console.error('[ANSWER] Error setting remote description:', err);
      console.error('[ANSWER] Peer connection state:', pc.signalingState);
      console.error('[ANSWER] Local description:', pc.localDescription ? 'set' : 'not set');
      console.error('[ANSWER] Remote description:', pc.remoteDescription ? 'set' : 'not set');
      // Don't recreate peer connection - just log the error
      // Recreating breaks ICE connection and causes audio to be muted
    }
  } else {
    console.warn('[ANSWER] No peer for answer from:', userId);
  }
});

socket.on('ice-candidate', async (userId, candidate) => {
  // ICE candidate received
  console.log(`[ICE] Received candidate from ${userId}:`, candidate?.type, candidate?.protocol, candidate?.address, candidate?.port);
  if (peers.has(userId)) {
    // Create RTCIceCandidate from plain object
    const iceCandidate = new RTCIceCandidate({
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex
    });
    await peers.get(userId).addIceCandidate(iceCandidate);
    console.log(`[ICE] Candidate added for ${userId}`);
  } else {
    console.warn(`[ICE] No peer for ICE candidate from ${userId}`);
  }
});

socket.on('chat-message', (msg) => {
  // TEMPORARILY DISABLED: Channel check - show all messages
  // if (currentChannel === 'general') {
    addChatMessage(msg.sender, msg.text, false, msg.time);
  // }
});

// Channel-specific messages - TEMPORARILY DISABLED
/*
socket.on('channel-message', (msg) => {
  // Only show if user is in this channel
  if (currentChannel === msg.channelId) {
    addChatMessage(msg.sender, `(${msg.channelName}) ${msg.text}`, false, msg.time);
  }
});

// Channel created by another user
socket.on('channel-created', (data) => {
  console.log('[CHANNEL DEBUG] Received channel-created event:', data);
  addLogEntry('Канал', `${data.createdBy} создал канал "${data.channelName}"`);
  // DISABLED: Refresh channel list
  // loadChannelsForRoom();
});

// Channels updated (counts changed)
socket.on('channels-updated', (channels) => {
  console.log('[CHANNEL] Received updated channel counts:', channels);
  // DISABLED: Update channel list
  // updateChannelList(channels);
});

// User joined channel
socket.on('user-joined-channel', (data) => {
  if (data.userId !== socket.id) {
    addSystemMessage(`${data.userName} присоединился к каналу "${data.channelName}"`);
    
    // Update channel user counts
    if (data.channelId === currentChannel) {
      currentChannelUsers.set(data.userId, { userName: data.userName });
      updateChannelParticipants();
      
      // Show user's video if they joined current channel
      showUserVideo(data.userId, true);
    }
  }
});

// User left channel
socket.on('user-left-channel', (data) => {
  if (data.userId !== socket.id) {
    // Remove from current channel users
    if (data.channelId === currentChannel) {
      currentChannelUsers.delete(data.userId);
      updateChannelParticipants();
      
      // Hide user's video if they left current channel
      showUserVideo(data.userId, false);
    }
  }
});
*/

// Refresh channel videos - re-creates the channel video container
function refreshChannelVideos() {
  const channelUsers = Array.from(currentChannelUsers.entries()).map(([userId, user]) => ({
    userId,
    userName: user.userName || (activeUsers.get(userId)?.name) || 'Участник'
  }));
  
  // Add current user
  channelUsers.push({
    userId: socket.id,
    userName: currentUser.username
  });
  
  updateVideoVisibilityForChannel(channelUsers);
}

// Handle remote user screen share started
socket.on('screen-share-started', (userId, callback) => {
  console.log('[SCREEN] RECEIVED screen-share-started for userId:', userId);
  const user = activeUsers.get(userId);
  const userName = user ? user.name : 'Участник';
  addLogEntry('Демонстрация', `${userName} начал демонстрацию экрана`);

  // Track this user as screen sharing
  screenShareUsers.add(userId);
  console.log('[SCREEN] Added to screenShareUsers:', userId, 'size now:', screenShareUsers.size);

  // Screen container will be created automatically when screen track arrives via ontrack
  console.log('[SCREEN] User started screen share, waiting for screen track:', userId);
  
  // Send ACK if callback provided (server-side emit with ACK)
  if (typeof callback === 'function') {
    callback({ received: true });
  }
});

// Handle remote user screen share stopped
socket.on('screen-share-stopped', (userId) => {
  const user = activeUsers.get(userId);
  if (user) {
    const userName = user.name;
    addLogEntry('Демонстрация', `${userName} остановил демонстрацию экрана`);
  } else {
    // Fetch name from server if not in activeUsers
    socket.emit('get-user-name', userId, (name) => {
      const userName = name || 'Участник';
      addLogEntry('Демонстрация', `${userName} остановил демонстрацию экрана`);
    });
  }

  console.log('[SCREEN] Received screen-share-stopped for:', userId);
  console.log('[SCREEN] Screen share users before delete:', Array.from(screenShareUsers));

  // Remove from screen share tracking
  screenShareUsers.delete(userId);

  console.log('[SCREEN] Screen share users after delete:', Array.from(screenShareUsers));

  // Remove screen container - try both possible IDs
  setTimeout(() => {
    // First try the screen-specific ID
    console.log('[SCREEN] Looking for screen container:', `video-${userId}-screen`);
    let screenContainer = document.getElementById(`video-${userId}-screen`);
    console.log('[SCREEN] Screen container found:', !!screenContainer);
    
    // If not found, try to find any video container for this user that might be screen
    if (!screenContainer) {
      const regularContainer = document.getElementById(`video-${userId}`);
      if (regularContainer && regularContainer.classList.contains('screen-share')) {
        console.log('[SCREEN] Found regular container with screen-share class');
        screenContainer = regularContainer;
      }
    }
    
    if (screenContainer) {
      screenContainer.remove();
      console.log('[SCREEN] Removed screen container for:', userId);
    } else {
      console.warn('[SCREEN] No screen container found to remove for:', userId);
    }
  }, 500);
});

// Handle active screen shares when joining room (users already sharing)
socket.on('active-screen-shares', (userIds) => {
  console.log('[SCREEN] Received active screen shares on join:', userIds);

  userIds.forEach((userId) => {
    // Track this user as screen sharing
    screenShareUsers.add(userId);
    const user = activeUsers.get(userId);
    const userName = user ? user.name : 'Участник';
    addLogEntry('Демонстрация', `${userName} демонстрирует экран`);

    console.log(`[SCREEN] Processing screen share for user: ${userId}, name: ${userName}`);
    
    // Request screen sharer to renegotiate (with delay to avoid race condition)
    setTimeout(() => {
      socket.emit('request-screen-renegotiation', userId);
      console.log(`[SCREEN] Sent request-screen-renegotiation for ${userId}`);
    }, 500);
  });
});

// Handle request to renegotiate screen share (from new user)
socket.on('request-screen-renegotiation', async (requesterId) => {
  console.log('[SCREEN] Received request-screen-renegotiation from:', requesterId);
  
  // Only respond if we are actively screen sharing
  if (isScreenSharing && screenStream) {
    console.log('[SCREEN] We are screen sharing, renegotiating with:', requesterId);
    
    // IMPORTANT: Add requester to screenShareUsers so they detect incoming track as screen
    screenShareUsers.add(requesterId);
    console.log('[SCREEN] Added requester to screenShareUsers:', requesterId, 'size:', screenShareUsers.size);
    
    // Close and remove old peer connection
    if (peers.has(requesterId)) {
      console.log(`[SCREEN] Closing old peer connection for requester: ${requesterId}`);
      const pc = peers.get(requesterId);
      pc.close();
      peers.delete(requesterId);
      removeVideoStream(requesterId);
    }
    
    // Wait a bit for the old peer connection to close
    setTimeout(async () => {
      try {
        console.log(`[SCREEN] Creating new peer connection with screen track for ${requesterId}`);
        const newPc = await createPeerConnection(requesterId);
        if (!newPc) {
          console.error(`[SCREEN] Failed to create peer connection for ${requesterId}`);
          return;
        }
        // Wait for screen track to be ready before creating offer
        await new Promise(resolve => setTimeout(resolve, 1000));
        const offer = await newPc.createOffer();
        await newPc.setLocalDescription(offer);
        socket.emit('offer', requesterId, offer);
        console.log(`[SCREEN] Peer connection created with screen track for ${requesterId}`);
      } catch (e) {
        console.error('[SCREEN] Error creating peer connection:', e);
      }
    }, 100);
  } else {
    console.log('[SCREEN] Not screen sharing, ignoring renegotiation request');
  }
});

// Handle screen share renegotiate request (from screen sharer)
socket.on('screen-share-renegotiate-request', async ({ screenSharerId }) => {
  console.log('[SCREEN] Received screen-share-renegotiate-request from:', screenSharerId);
  
  // Just log - screen sharer will send renegotiation offer automatically
  console.log('[SCREEN] Screen sharer will send renegotiation offer automatically');
});

// Handle request to refresh screen offer (when new user joins and needs stream)
socket.on('refresh-screen-offer', async ({ requesterId }) => {
  console.log('[SCREEN] Received refresh-screen-offer from:', requesterId);
  console.log('[SCREEN] isScreenSharing:', isScreenSharing, 'screenStream exists:', !!screenStream);

  // Only respond if we are actively screen sharing
  if (isScreenSharing && screenStream) {
    console.log('[SCREEN] We are screen sharing, creating new peer connection for requester:', requesterId);

    const screenTrack = screenStream.getVideoTracks()[0];
    if (screenTrack) {
      console.log('[SCREEN] Screen track found:', screenTrack.label, 'enabled:', screenTrack.enabled);
      const screenSettings = screenTrack.getSettings();
      console.log('[SCREEN] Screen track settings:', screenSettings);
    } else {
      console.warn('[SCREEN] No screen track found in screenStream!');
    }

    // Create peer connection if it doesn't exist
    if (!peers.has(requesterId)) {
      console.log('[SCREEN] Creating peer connection for requester:', requesterId);
      createPeerConnection(requesterId);
    }

    const pc = peers.get(requesterId);
    if (!pc) {
      console.error('[SCREEN] Failed to create peer connection for requester:', requesterId);
      return;
    }

    // Send a new offer with the screen track
    setTimeout(async () => {
      try {
        console.log('[SCREEN] Creating offer with screen track for:', requesterId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', {
          to: requesterId,
          from: socket.id,
          sdp: pc.localDescription
        });
        console.log('[SCREEN] Sent new offer with screen track to:', requesterId);
      } catch (e) {
        console.error('[SCREEN] Error creating offer for screen share:', e);
      }
    }, 100);
  } else {
    console.log('[SCREEN] Not screen sharing, ignoring refresh-screen-offer');
  }
});

// ========== CONTROLS ==========

async function toggleMic() {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      isMicOn = audioTrack.enabled;

      // Play sound
      if (isMicOn) {
        await sounds.micOn();
      } else {
        await sounds.micOff();
      }

      const btn = document.getElementById('micBtn');
      if (isMicOn) {
        btn.classList.remove('danger');
        btn.querySelector('.label').textContent = 'Мик';
      } else {
        btn.classList.add('danger');
        btn.querySelector('.label').textContent = 'Мик выкл';
        // Reset mic level indicator when muting
        resetMicLevelIndicator();
      }

      // Notify other users about mic state
      if (currentRoom) {
        socket.emit('user-mute-state', { roomId: currentRoom, isMicMuted: !isMicOn });
      }
    }
  }
}

async function toggleCam() {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      // Toggle existing video track
      videoTrack.enabled = !videoTrack.enabled;
      isCamOn = videoTrack.enabled;

      // Play sound
      if (isCamOn) {
        await sounds.camOn();
      } else {
        await sounds.camOff();
      }

      const btn = document.getElementById('camBtn');
      if (isCamOn) {
        btn.classList.remove('danger');
        btn.querySelector('.label').textContent = 'Камера';
      } else {
        btn.classList.add('danger');
        btn.querySelector('.label').textContent = 'Камера выкл';
      }
    } else {
      // No video track exists - request camera
      try {
        console.log('[CAM] Requesting camera...');
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: selectedVideoInput ? { deviceId: { exact: selectedVideoInput } } : true,
          audio: false
        });

        const newVideoTrack = camStream.getVideoTracks()[0];
        if (newVideoTrack) {
          localStream.addTrack(newVideoTrack);
          isCamOn = true;

          // Add to all peer connections
          peers.forEach(pc => {
            pc.addTrack(newVideoTrack, localStream);
          });

          // Update local video display
          addVideoStream('local', localStream, currentUser.username, true, false);

          await sounds.camOn();

          const btn = document.getElementById('camBtn');
          btn.classList.remove('danger');
          btn.querySelector('.label').textContent = 'Камера';

          console.log('[CAM] Camera added successfully');
        }
      } catch (err) {
        console.error('[CAM] Error requesting camera:', err);
        showAlertModal('Не удалось получить доступ к камере. Проверьте разрешения.', 'error');
      }
    }
  }
}

async function toggleSound() {
  isSoundOn = !isSoundOn;

  // Play sound effect
  if (isSoundOn) {
    await sounds.soundOn();
  } else {
    await sounds.soundOff();
  }
  
  // Update button UI
  const btn = document.getElementById('soundBtn');
  const icon = document.getElementById('soundIcon');
  const label = document.getElementById('soundLabel');
  
  if (isSoundOn) {
    btn.classList.remove('danger');
    icon.innerHTML = '&#128266;';
    label.textContent = 'Звук';
  } else {
    btn.classList.add('danger');
    icon.innerHTML = '&#128263;';
    label.textContent = 'Звук выкл';
  }
  
  // Change volume instead of muting to ensure audio can always be heard
  document.querySelectorAll('.video-container:not(.local) video').forEach(video => {
    video.volume = isSoundOn ? 0.5 : 0;
    video.muted = false; // Never mute, just use volume
  });
  
  // Also control audio elements (for audio-only streams)
  document.querySelectorAll('.video-container:not(.local) audio').forEach(audio => {
    audio.volume = isSoundOn ? 0.5 : 0;
    audio.muted = false; // Never mute, just use volume
  });
  
  // Notify other users about sound state
  if (currentRoom) {
    socket.emit('user-mute-state', { roomId: currentRoom, isMicMuted: !isMicOn, isSoundMuted: !isSoundOn });
  }
}

async function toggleScreen() {
  console.log('[SCREEN] Toggle called, isScreenSharing:', isScreenSharing);

  if (isScreenSharing) {
    // Stop screen sharing
    await sounds.screenOff();

    if (screenStream) {
      // Remove onended handler before stopping to prevent double toggle
      screenStream.getVideoTracks().forEach(track => {
        track.onended = null;
        track.stop();
      });
      screenStream.getAudioTracks().forEach(track => track.stop());
      screenStream = null;
    }

    // Remove screen track from all peer connections (keep camera track)
    peers.forEach(async (pc, peerId) => {
      const senders = pc.getSenders();
      let removed = false;
      senders.forEach(sender => {
        if (sender.track && sender.track.kind === 'video') {
          const track = sender.track;
          // Check if this is a screen track by label
          if (track.label && (track.label.toLowerCase().includes('screen') ||
              track.label.toLowerCase().includes('display') ||
              track.label.toLowerCase().includes('window'))) {
            console.log('[SCREEN] Removing screen track from peer');
            sender.replaceTrack(null).catch(err => {
              console.error('[SCREEN] Error removing screen track:', err);
            });
            removed = true;
          }
        }
      });

      // Renegotiate to notify remote peer that screen track is removed
      if (removed) {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('offer', peerId, offer);
          console.log(`[SCREEN] Renegotiation offer sent after removing screen track for peer ${peerId}`);
        } catch (renegErr) {
          console.error(`[SCREEN] Error renegotiating for peer ${peerId}:`, renegErr);
        }
      }
    });

    // Restore local container (camera continues to work)
    const localContainer = document.getElementById('video-local');
    if (localContainer) {
      // Remove screen share indicator
      const screenIndicator = localContainer.querySelector('[style*="background: rgba(59, 165, 93"]');
      if (screenIndicator) {
        screenIndicator.remove();
      }

      // Remove screen-share class
      localContainer.classList.remove('screen-share');

      // Check if we have camera track
      const hasVideoTrack = localStream && localStream.getVideoTracks().length > 0;
      const localVideo = localContainer.querySelector('video');

      if (hasVideoTrack && localVideo) {
        // Restore camera stream
        localVideo.srcObject = localStream;
        localVideo.playbackRate = 1.0;
        localVideo.style.objectFit = 'cover';
        localVideo.style.transform = 'scaleX(-1)';
        localVideo.style.display = 'block';
        console.log('[SCREEN] Local video restored with camera stream');
      } else {
        // No camera - restore avatar placeholder
        if (localVideo) {
          localVideo.style.display = 'none';
        }
        // Add avatar placeholder if not exists
        if (!localContainer.querySelector('.avatar-placeholder')) {
          const avatarPlaceholder = document.createElement('div');
          avatarPlaceholder.className = 'avatar-placeholder';
          const avatar = userAvatar || localStorage.getItem(`keroschat_avatar_${currentUser.username}`);
          if (avatar) {
            avatarPlaceholder.innerHTML = `<img src="${avatar}" alt="${currentUser.username}">`;
          } else {
            avatarPlaceholder.textContent = currentUser.username.charAt(0).toUpperCase();
          }
          localContainer.appendChild(avatarPlaceholder);
          console.log('[SCREEN] Avatar placeholder restored (no camera)');
        }
      }
    }
    
    isScreenSharing = false;
    localStorage.removeItem('keroschat_screen_sharing');
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

      // Check if getDisplayMedia is supported (not available on mobile devices)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        showAlertModal('Демонстрация экрана недоступна на этом устройстве. Эта функция работает только на десктопных браузерах.', 'error');
        return;
      }

      // Request screen share with quality settings based on user preference
      let constraints;
      switch (screenQuality) {
        case 'low':
          constraints = {
            video: { cursor: 'always', width: { ideal: 640, max: 640 }, height: { ideal: 360, max: 360 }, frameRate: { ideal: 15, max: 30 } },
            audio: false
          };
          break;
        case 'medium':
          constraints = {
            video: { cursor: 'always', width: { ideal: 1280, max: 1280 }, height: { ideal: 720, max: 720 }, frameRate: { ideal: 30, max: 30 } },
            audio: false
          };
          break;
        case 'high':
          constraints = {
            video: { cursor: 'always', width: { ideal: 1920, max: 1920 }, height: { ideal: 1080, max: 1080 }, frameRate: { ideal: 60, max: 60 } },
            audio: false
          };
          break;
        default: // auto
          constraints = {
            video: { cursor: 'always', width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 }, frameRate: { ideal: 30, max: 60 } },
            audio: false
          };
      }

      console.log('[SCREEN] Screen quality:', screenQuality, 'Constraints:', JSON.stringify(constraints));
      screenStream = await navigator.mediaDevices.getDisplayMedia(constraints);
      await sounds.screenOn();
      
      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) {
        throw new Error('No video track in screen share');
      }
      
      // Log screen track properties
      console.log('[SCREEN] Screen track label:', screenTrack.label);
      console.log('[SCREEN] Screen track enabled:', screenTrack.enabled);
      console.log('[SCREEN] Screen track readyState:', screenTrack.readyState);
      const settings = screenTrack.getSettings();
      console.log('[SCREEN] Screen track settings:', JSON.stringify(settings));
      
      // Handle when user stops sharing via browser UI
      screenTrack.onended = () => {
        console.log('[SCREEN] Track ended via browser');
        if (isScreenSharing) {
          toggleScreen();
        }
      };

      // Add screen track to existing peer connections
      console.log(`[SCREEN] Adding screen track to ${peers.size} peer connections`);
      console.log(`[SCREEN] Active users:`, Array.from(activeUsers.keys()));
      
      // CRITICAL: If no peers but there are active users, recreate peer connections
      if (peers.size === 0 && activeUsers.size > 0) {
        console.warn('[SCREEN] No peers but active users exist! Recreating peer connections...');
        for (const [userId, userInfo] of activeUsers) {
          console.log(`[SCREEN] Recreating peer connection for ${userId}`);
          const pc = createPeerConnection(userId);
          // Add audio track first
          if (localStream && localStream.getAudioTracks().length > 0) {
            localStream.getAudioTracks().forEach(track => {
              pc.addTrack(track, localStream);
              console.log(`[SCREEN] Added audio track to recreated peer ${userId}`);
            });
          }
          // Then add screen track
          pc.addTrack(screenTrack, screenStream);
          console.log(`[SCREEN] Added screen track to recreated peer ${userId}`);
          
          // Create and send offer
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('offer', userId, offer);
          console.log(`[SCREEN] Offer sent to recreated peer ${userId}`);
        }
      } else if (peers.size === 0) {
        console.warn('[SCREEN] No peers and no active users. Screen share will not be visible to anyone.');
      }
      
      // Function to add screen track to existing peer
      const addScreenTrackToPeer = async (pc, peerId) => {
        try {
          console.log(`[SCREEN] Adding screen track to peer ${peerId}`);
          pc.addTrack(screenTrack, screenStream);
          
          // Renegotiate to notify remote peer about new track
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('offer', peerId, offer);
          console.log(`[SCREEN] Screen track added to peer ${peerId}, renegotiation sent`);
        } catch (err) {
          console.error(`[SCREEN] Error adding screen track to peer ${peerId}:`, err);
        }
      };
      
      // Add to existing peers (if any left)
      peers.forEach(addScreenTrackToPeer);
      
      // Store pending screen share for future peers
      if (peers.size === 0 && activeUsers.size === 0) {
        console.log('[SCREEN] No peers yet, storing pending screen share');
        window.pendingScreenShare = true;
      }
      
      // Notify all users to request renegotiation if needed
      socket.emit('screen-share-renegotiate-request', { screenSharerId: socket.id });
      console.log('[SCREEN] Sent screen-share-renegotiate-request to all users');

      // Create LOW QUALITY preview stream for local display only
      const lowQualityPreviewConstraints = {
        video: { cursor: 'always', width: { ideal: 320, max: 320 }, height: { ideal: 180, max: 180 }, frameRate: { ideal: 5, max: 10 } },
        audio: false
      };
      
      let previewStream = null;
      try {
        previewStream = await navigator.mediaDevices.getDisplayMedia(lowQualityPreviewConstraints);
        console.log('[SCREEN] Created LOW QUALITY preview stream for local display');
      } catch (err) {
        console.warn('[SCREEN] Could not create low quality preview, using main stream:', err);
        previewStream = screenStream; // Fallback to main stream
      }

      // Replace local container avatar with screen preview
      const localContainer = document.getElementById('video-local');
      console.log('[SCREEN] Local container found:', !!localContainer, 'id: video-local');
      if (localContainer) {
        // Remove avatar placeholder
        const avatarPlaceholder = localContainer.querySelector('.avatar-placeholder');
        if (avatarPlaceholder) {
          avatarPlaceholder.remove();
          console.log('[SCREEN] Avatar placeholder removed');
        }

        // Get or create video element
        let localVideo = localContainer.querySelector('video');
        if (!localVideo) {
          localVideo = document.createElement('video');
          localVideo.autoplay = true;
          localVideo.muted = true;
          localVideo.playsInline = true;
          localVideo.style.width = '100%';
          localVideo.style.height = '100%';
          localVideo.style.objectFit = 'cover';
          localVideo.style.transform = 'scaleX(-1)';
          localContainer.appendChild(localVideo);
          console.log('[SCREEN] Created new video element in local container');
        } else {
          console.log('[SCREEN] Using existing video element');
        }

        // Use LOW QUALITY preview stream for local display
        localVideo.srcObject = previewStream;
        localVideo.style.objectFit = 'contain';
        localVideo.style.transform = 'none';
        
        // Ensure video plays
        localVideo.play().then(() => {
          console.log('[SCREEN] Local LOW QUALITY preview playing');
        }).catch(err => {
          console.error('[SCREEN] Error playing local video:', err);
        });

        console.log('[SCREEN] Local preview set - LOW QUALITY for you, HIGH QUALITY sent to remote');
        console.log('[SCREEN] Preview stream tracks:', previewStream ? previewStream.getTracks().length : 0);
        console.log('[SCREEN] Screen stream (sent to remote) tracks:', screenStream ? screenStream.getTracks().length : 0);

        // Add screen share indicator
        const screenIndicator = document.createElement('div');
        screenIndicator.innerHTML = '🖥️ Демонстрация';
        screenIndicator.style.cssText = 'position: absolute; top: 8px; left: 8px; background: rgba(59, 165, 93, 0.9); color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; z-index: 10;';
        localContainer.appendChild(screenIndicator);

        // Mark as screen share
        localContainer.classList.add('screen-share');

        console.log('[SCREEN] Local container updated with screen preview');
      } else {
        console.error('[SCREEN] Local container not found!');
      }

      isScreenSharing = true;
      localStorage.setItem('keroschat_screen_sharing', 'true');
      socket.emit('screen-share-started', (ack) => {
        if (ack && ack.success) {
          console.log('[SCREEN] Server confirmed screen-share-started broadcast to', ack.recipientCount, 'recipients');
        } else {
          console.warn('[SCREEN] No ACK for screen-share-started, event may not have been delivered');
        }
      });

      const btn = document.getElementById('screenBtn');
      if (btn) {
        btn.classList.add('active');
        const label = btn.querySelector('.label');
        if (label) label.textContent = 'Экран вкл';
      }
      
      console.log('[SCREEN] Screen sharing started');
    } catch (err) {
      console.error('[SCREEN] Error starting screen share:', err);
      console.error('[SCREEN] Error details:', err?.name, err?.message, err?.stack);

      // Handle specific permission denied error
      if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission denied')) {
        showAlertModal('❌ Вы отказали в разрешении на демонстрацию экрана. Нажмите кнопку "Экран" снова и разрешите доступ.', 'error');
      } else if (err?.name === 'NotFoundError') {
        showAlertModal('❌ Не выбран экран для демонстрации. Пожалуйста, выберите экран или окно.', 'error');
      } else {
        showAlertModal('Ошибка при запуске демонстрации: ' + (err?.message || err), 'error');
      }
    }
  }
}

// ========== FULLSCREEN SCREEN SHARE ==========
let currentScreenResolution = '1080p'; // Default resolution

// Toggle screen share between full size and preview/thumbnail mode
function toggleScreenSharePreview(videoId) {
  const container = document.getElementById(`video-${videoId}-screen`);
  if (!container) return;

  const isPreview = container.classList.contains('preview-mode');
  const toggleBtn = container.querySelector('.preview-toggle-btn');

  if (isPreview) {
    // Switch to full mode
    container.classList.remove('preview-mode');
    if (toggleBtn) toggleBtn.innerHTML = '👁️ Превью';
    console.log('[SCREEN] Switched to full mode for', videoId);
  } else {
    // Switch to preview mode (smaller, less CPU usage)
    container.classList.add('preview-mode');
    if (toggleBtn) toggleBtn.innerHTML = '🔲 Полный';
    console.log('[SCREEN] Switched to preview mode for', videoId);
  }
}

function closeAllScreenModals() {
  const modal = document.getElementById('screenShareModal');
  if (modal) {
    modal.remove();
    console.log('[SCREEN] Closed all screen share modals');
  }
}

function openScreenModal(videoId) {
  // REMOVED: Channel restriction - screen share is now visible to all users in room
  // This ensures screen share works in any room/channel and is visible to everyone

  // Find the screen share video element by id (use -screen suffix for screen share containers)
  const container = document.getElementById(`video-${videoId}-screen`);
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
  
  // Apply resolution constraint - use contain to preserve aspect ratio without cropping
  const res = resolutions[currentScreenResolution];
  clonedVideo.style.cssText = `
    max-width: calc(100vw - 40px);
    max-height: calc(100vh - 80px);
    width: auto;
    height: auto;
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
  // System messages go to system messages area
  if (isSystem || sender === 'Система') {
    addSystemMessage(text, time);
    return;
  }
  
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

function addSystemMessage(text, time = null) {
  const systemMessages = document.getElementById('systemMessages');
  if (!systemMessages) return;
  
  const msgDiv = document.createElement('div');
  msgDiv.className = 'system-message';
  msgDiv.innerHTML = `
    <span class="system-time">${time || new Date().toLocaleTimeString()}</span> — ${escapeHtml(text)}
  `;
  
  systemMessages.appendChild(msgDiv);
  systemMessages.scrollTop = systemMessages.scrollHeight;
  
  // Keep only last 20 system messages
  while (systemMessages.children.length > 20) {
    systemMessages.removeChild(systemMessages.firstChild);
  }
}

function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (text && currentRoom) {
    // Check if user is muted
    if (currentUser && (currentUser.isMuted === true || currentUser.isMuted === 'true')) {
      // Check if mute has expired
      if (currentUser.muteUntil && currentUser.muteUntil > Date.now()) {
        const remainingMinutes = Math.ceil((currentUser.muteUntil - Date.now()) / 60000);
        showAlertModal(`🔇 Вы замучены. Осталось ${remainingMinutes} минут`, 'error');
        return;
      } else if (currentUser.muteUntil && currentUser.muteUntil <= Date.now()) {
        // Mute has expired, auto-unmute
        currentUser.isMuted = false;
        currentUser.muteUntil = 0;
      } else if (!currentUser.muteUntil || currentUser.muteUntil === 0) {
        // Permanent mute
        showAlertModal('🔇 Вы замучены навсегда', 'error');
        return;
      }
    }

    // Send to current channel if in a channel, otherwise to room
    if (currentChannel && currentChannel !== 'general') {
      socket.emit('channel-message', currentChannel, text);
    } else {
      socket.emit('chat-message', text);
    }
    addChatMessage(currentUser.username, text, false, new Date().toLocaleTimeString());
    input.value = '';
  }
}

// ========== CHANNEL/SUBGROUP MANAGEMENT ==========
let currentChannel = 'general';
let availableChannels = [];

function createChannel() {
  console.log('[CHANNEL] Creating channel, currentRoom:', currentRoom, 'socketConnected:', socketConnected);
  if (!currentRoom) {
    alert('Сначала войдите в комнату');
    return;
  }
  if (!socketConnected) {
    alert('Нет подключения к серверу');
    return;
  }
  
  const name = prompt('Введите название канала:');
  if (!name || !name.trim()) return;
  
  console.log('[CHANNEL] Emitting create-channel with name:', name.trim());
  
  let hasResponse = false;
  const timeout = setTimeout(() => {
    if (!hasResponse) {
      console.error('[CHANNEL] create-channel timeout - no response from server');
      alert('Сервер не отвечает. Проверьте консоль сервера.');
    }
  }, 5000);
  
  socket.emit('create-channel', name.trim(), (response) => {
    hasResponse = true;
    clearTimeout(timeout);
    console.log('[CHANNEL] create-channel response:', response);
    if (response && response.success) {
      addLogEntry('Канал', `Создан канал "${response.channelName}"`);
      switchChannel(response.channelId);
    } else {
      alert('Ошибка создания канала: ' + (response?.error || 'Неизвестная ошибка'));
    }
  });
}

function switchChannel(channelId) {
  console.log('[CHANNEL] Switching to channel:', channelId, 'currentRoom:', currentRoom, 'currentChannel:', currentChannel);
  if (!currentRoom) {
    alert('Сначала войдите в комнату');
    return;
  }
  if (!socketConnected) {
    alert('Нет подключения к серверу');
    return;
  }
  if (channelId === currentChannel) {
    console.log('[CHANNEL] Already in this channel');
    return;
  }
  
  socket.emit('join-channel', channelId, (response) => {
    console.log('[CHANNEL] join-channel response:', response);
    if (response && response.success) {
      const oldChannel = currentChannel;
      currentChannel = channelId;
      
      // Close any open screen share modals when switching channels
      closeAllScreenModals();
      
      // Update UI
      document.querySelectorAll('.channel-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.channel === channelId) {
          item.classList.add('active');
        }
      });
      
      // Update chat header
      const chatHeader = document.querySelector('.chat-header h3');
      if (chatHeader) {
        chatHeader.innerHTML = `&#128172; Чат: ${response.channelName}`;
      }
      
      // Update currentChannelUsers from response
      currentChannelUsers.clear();
      if (response.channelUsers) {
        response.channelUsers.forEach(u => {
          currentChannelUsers.set(u.userId, { userName: u.userName });
        });
        console.log('[CHANNEL] Updated currentChannelUsers with', currentChannelUsers.size, 'users');
        
        // Update video visibility based on new channel users
        const channelUsers = Array.from(currentChannelUsers.entries()).map(([userId, user]) => ({
          userId,
          userName: user.userName || (activeUsers.get(userId)?.name) || 'Участник'
        }));
        updateVideoVisibilityForChannel(channelUsers);
      }

      // DISABLED: Refresh channel list to update user counts
      // loadChannels();

      // Clear chat messages when switching channels
      const chatMessages = document.getElementById('chatMessages');
      if (chatMessages) {
        chatMessages.innerHTML = '';
      }
      
      // Add system message
      addSystemMessage(`Вы перешли в канал "${response.channelName}"`);
      
      // Update channel users tracking
      currentChannelUsers.clear();
      console.log('[CHANNEL] Server returned channelUsers:', response.channelUsers);

      let channelUsers = response.channelUsers || [];

      // Deduplicate by username (server may send duplicates)
      const seenUsernames = new Set();
      channelUsers = channelUsers.filter(u => {
        const username = u.userName?.toLowerCase();
        if (!username || seenUsernames.has(username)) return false;
        seenUsernames.add(username);
        return true;
      });
      console.log('[CHANNEL] Deduplicated channelUsers:', channelUsers);

      // Ensure current user is in the list
      if (!channelUsers.find(u => u.userId === socket.id)) {
        channelUsers.push({
          userId: socket.id,
          userName: currentUser.username
        });
        console.log('[CHANNEL] Added current user to channelUsers');
      }

      channelUsers.forEach(u => {
        currentChannelUsers.set(u.userId, u);
      });
      
      console.log('[CHANNEL] Calling updateVideoVisibilityForChannel with', channelUsers.length, 'users');
      updateVideoVisibilityForChannel(channelUsers);
      
      // Update participants list
      updateChannelParticipants();
      
      addLogEntry('Канал', `Перешли в канал "${response.channelName}"`);
    } else {
      alert('Ошибка перехода в канал: ' + (response?.error || 'Неизвестная ошибка'));
    }
  });
}

function updateChannelList(channels) {
  const listEl = document.getElementById('channelList');
  if (!listEl) {
    console.error('[CHANNEL] channelList element not found!');
    return;
  }
  
  console.log('[CHANNEL] Updating channel list with', channels.length, 'channels');
  availableChannels = channels;
  
  let html = '';
  channels.forEach(ch => {
    const isActive = ch.channelId === currentChannel;
    const icon = ch.isGeneral ? '&#128226;' : '&#128172;';
    html += `
      <div class="channel-item ${isActive ? 'active' : ''}" data-channel="${ch.channelId}" onclick="switchChannel('${ch.channelId}')">
        <span class="channel-name">${icon} ${ch.channelName}</span>
        <span class="channel-users">${ch.userCount}</span>
      </div>
    `;
  });
  
  listEl.innerHTML = html;
}

function loadChannels() {
  if (!currentRoom) {
    console.log('[CHANNELS] Cannot load: not in a room');
    return;
  }
  if (!socketConnected) {
    console.log('[CHANNELS] Cannot load: socket not connected');
    return;
  }
  
  console.log('[CHANNELS] Loading channels for room:', currentRoom);
  
  socket.emit('get-channels', (response) => {
    console.log('[CHANNELS] Server response:', response);
    if (response && response.success) {
      updateChannelList(response.channels);
      currentChannel = response.currentChannel || 'general';
      console.log('[CHANNELS] Loaded successfully, currentChannel:', currentChannel);
      
      // Update currentChannelUsers based on channelUsers from server
      currentChannelUsers.clear();
      const currentChannelData = response.channels.find(ch => ch.channelId === currentChannel);
      if (currentChannelData && currentChannelData.channelUsers) {
        currentChannelData.channelUsers.forEach(u => {
          currentChannelUsers.set(u.userId, { userName: u.userName });
        });
        console.log('[CHANNELS] Updated currentChannelUsers with', currentChannelUsers.size, 'users');
        
        // Update video visibility based on current channel users
        const channelUsers = Array.from(currentChannelUsers.entries()).map(([userId, user]) => ({
          userId,
          userName: user.userName || (activeUsers.get(userId)?.name) || 'Участник'
        }));
        // Add current user
        channelUsers.push({
          userId: socket.id,
          userName: currentUser.username
        });
        updateVideoVisibilityForChannel(channelUsers);
      }
    } else {
      console.error('[CHANNELS] Failed to load:', response?.error || 'Unknown error');
      // Show default channel even if server fails
      updateChannelList([{ channelId: 'general', channelName: 'Общий', userCount: 0, isGeneral: true }]);
    }
  });
}

// ========== CHANNEL ISOLATION FUNCTIONS ==========

let currentChannelUsers = new Map(); // Track which users are in current channel

function showUserVideo(userId, show) {
  // Show/hide camera container
  const videoContainer = document.getElementById(`video-${userId}`);
  if (videoContainer) {
    videoContainer.style.display = show ? 'block' : 'none';
    console.log(`[CHANNEL] Video for ${userId}: ${show ? 'shown' : 'hidden'}`);
  }

  // Show/hide screen container (if exists)
  const screenContainer = document.getElementById(`video-${userId}-screen`);
  if (screenContainer) {
    screenContainer.style.display = show ? 'block' : 'none';
    console.log(`[CHANNEL] Screen for ${userId}: ${show ? 'shown' : 'hidden'}`);
  }
}

function updateVideoVisibilityForChannel(channelUsers) {
  // Get list of user IDs in this channel
  const userIdsInChannel = new Set(channelUsers.map(u => u.userId));

  console.log(`[CHANNEL DEBUG] updateVideoVisibilityForChannel called with ${channelUsers.length} users:`, channelUsers.map(u => u.userId));
  console.log(`[CHANNEL DEBUG] socket.id: ${socket.id}, userIdsInChannel has socket.id: ${userIdsInChannel.has(socket.id)}`);

  // Show/hide videos in the main video grid based on channel membership
  document.querySelectorAll('.video-container').forEach(container => {
    let userId = container.id.replace('video-', '');
    // Remove -screen suffix if present to get original userId
    userId = userId.replace('-screen', '');

    // For local user, check if socket.id is in the channel; for others, check userId directly
    const isLocalUser = userId === 'local';
    const isInChannel = isLocalUser ? userIdsInChannel.has(socket.id) : userIdsInChannel.has(userId);

    console.log(`[CHANNEL DEBUG] Video container ${container.id}: isLocalUser=${isLocalUser}, isInChannel=${isInChannel}, display will be: ${isInChannel ? 'block' : 'none'}`);

    if (isInChannel) {
      container.style.display = 'block';
      container.classList.remove('channel-hidden');
    } else {
      container.style.display = 'none';
      container.classList.add('channel-hidden');
    }
  });

  // Handle screen share preview - only show if current user is in this channel
  const screenSharePreview = document.getElementById('screen-share-preview');
  if (screenSharePreview) {
    const isLocalInChannel = userIdsInChannel.has(socket.id);
    screenSharePreview.style.display = isLocalInChannel ? 'block' : 'none';
    console.log(`[CHANNEL DEBUG] Screen share preview: isLocalInChannel=${isLocalInChannel}, display=${screenSharePreview.style.display}`);
  }

  console.log(`[CHANNEL] Showing ${userIdsInChannel.size} users in main video grid for channel`);
}

let isUpdatingChannelParticipants = false;

function updateChannelParticipants() {
  // Prevent concurrent execution
  if (isUpdatingChannelParticipants) {
    console.log('[CHANNEL] Skipping duplicate updateChannelParticipants call');
    return;
  }
  isUpdatingChannelParticipants = true;
  
  const list = document.getElementById('activeUsers');
  if (!list) {
    isUpdatingChannelParticipants = false;
    return;
  }
  
  // Clear and rebuild the list
  list.innerHTML = '';
  
  // Track unique usernames to prevent duplicates
  const addedUsernames = new Set();
  
  // Local user - always show in participants
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
  addedUsernames.add(currentUser.username.toLowerCase());
  
  // Show only users in current channel (excluding self)
  currentChannelUsers.forEach((channelUser, userId) => {
    // Skip self - already added above
    if (userId === socket.id) return;
    
    // Get user info from activeUsers or use channel data
    const user = activeUsers.get(userId);
    const userName = user ? user.name : (channelUser.userName || 'Участник');
    const userAvatar = user ? user.avatar : null;
    
    // Also skip if same username as current user (prevents duplicates)
    if (userName.toLowerCase() === currentUser.username.toLowerCase()) return;
    
    const username = userName.toLowerCase();
    if (addedUsernames.has(username)) return;
    addedUsernames.add(username);
    
    const item = document.createElement('div');
    item.className = 'user-item';
    item.id = `user-item-${userId}`;
    
    const avatarHtml = userAvatar ? 
      `<img src="${userAvatar}" alt="avatar">` :
      userName.charAt(0).toUpperCase();
    
    const isMicMuted = user ? user.isMicMuted : false;
    const isSoundMuted = user ? user.isSoundMuted : false;
    
    const micIcon = isMicMuted ? '<span class="user-icon muted" title="Микрофон выключен">🎤❌</span>' : '';
    const soundIcon = isSoundMuted ? '<span class="user-icon muted" title="Звук выключен">🔇</span>' : '';
    
    item.innerHTML = `
      <div class="user-avatar" id="avatar-${userId}">${avatarHtml}</div>
      <span class="user-name">${userName}</span>
      <div class="user-icons">
        ${micIcon}
        ${soundIcon}
        <div class="user-status" id="status-${userId}"></div>
      </div>
    `;
    list.appendChild(item);
  });
  
  // Update user count
  const userCount = addedUsernames.size;
  document.getElementById('userCount').textContent = userCount;
  
  // Reset guard flag
  isUpdatingChannelParticipants = false;
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
    enumerateDevices();
    // Start mic level monitoring if in room
    if (localStream) {
      startMicLevelMonitoring();
    }
  } else {
    // Stop monitoring when closing settings
    stopMicLevelMonitoring();
    // Reset indicator to default state
    resetMicLevelIndicator();
  }
}

function updateRemoteVolumeControls() {
  const container = document.getElementById('remoteVolumeControls');

  // Use activeUsers instead of peers to show all users
  const otherUsers = Array.from(activeUsers.entries()).filter(([id]) => id !== socket.id);

  if (otherUsers.length === 0) {
    container.innerHTML = '<p style="color: #72767d; font-size: 12px;">Нет других участников</p>';
    return;
  }

  container.innerHTML = '';
  otherUsers.forEach(([id, user]) => {
    const name = user ? user.name : null;

    // Skip if name is unknown
    if (!name) {
      console.log(`[ADMIN VOL] Skipping user ${id} - no name available`);
      return;
    }

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
  // Try to set volume on video element first
  const container = document.getElementById(`video-${userId}`);
  if (container) {
    const video = container.querySelector('video');
    if (video) {
      video.volume = value / 100;
      console.log(`[VOLUME] Video volume for ${userId} set to ${value}%`);
    }
  }

  // Also try to set volume on screen container if exists
  const screenContainer = document.getElementById(`video-${userId}-screen`);
  if (screenContainer) {
    const video = screenContainer.querySelector('video');
    if (video) {
      video.volume = value / 100;
      console.log(`[VOLUME] Screen video volume for ${userId} set to ${value}%`);
    }
  }

  // Also update volume in settings panel if it exists
  const settingsVolume = document.querySelector(`#remoteVolumeControls input[data-userid="${userId}"]`);
  if (settingsVolume) {
    settingsVolume.value = value;
  }

  console.log(`[VOLUME] Volume for ${userId} set to ${value}%`);
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
  
  // Show in room system messages if in a room
  if (currentRoom) {
    addSystemMessage(`[${category}] ${message}`, timestamp);
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

async function clearAllCache() {
  showConfirmModal('Очистить весь кэш браузера? Это удалит все сохранённые данные (аватары, темы, настройки, комнаты).', async () => {
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

function emergencyClearCache() {
  try {
    // Clear all storage immediately without confirmation
    localStorage.clear();
    sessionStorage.clear();
    console.log('[EMERGENCY] Cache cleared, reloading...');
    location.reload();
  } catch (err) {
    console.error('[EMERGENCY] Error clearing cache:', err);
    alert('Ошибка очистки кэша. Пожалуйста, очистите кэш вручную в настройках браузера.');
  }
}

// Admin panel functions are now in admin.js

window.addEventListener('beforeunload', () => {
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
  }
  if (screenStream) {
    screenStream.getTracks().forEach(t => t.stop());
  }
});
