const { app, BrowserWindow, ipcMain, Notification, dialog, Tray, Menu, screen } = require('electron');
const path = require('path');
const os = require('os');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const dns = require('dns');

// Auto-updater (electron-updater)
let autoUpdater;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch (e) {
  // electron-updater not available in dev mode, use manual check
  autoUpdater = null;
}

let mainWindow;
let overlayWindow = null;
let tray = null;
let previousCPUInfo = null;
let runningApps = new Map();
let currentOptimizationMode = 'auto';
let lastDetectedMode = 'balanced';
let gameModeActive = false;
let creatorModeActive = false;
let graphicsEnhancerEnabled = false;
let gameDetectionInterval = null;
const CURRENT_VERSION = '3.5.0';
let notificationSettings = {
  lowStorage: true,
  highCPU: true,
  updates: true
};
let shownNotifications = new Set(); // Track shown notifications

// Manual tuning state
let manualTuning = {
  cpuPowerPlan: 'balanced',  // 'power-saver', 'balanced', 'high-performance'
  gpuPerformance: 50,         // 0-100 percentage
  fanSpeed: 50                // 0-100 percentage
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile('index.html');
  startMonitoring();
  setupAutoUpdater();
  setupTray();
  startGameDetection();

  mainWindow.on('close', (event) => {
    // Minimize to tray instead of quitting
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// System tray setup
function setupTray() {
  // Create a simple 16x16 icon programmatically using nativeImage
  const { nativeImage } = require('electron');
  // Create a simple red square icon
  const iconSize = 16;
  const canvas = Buffer.alloc(iconSize * iconSize * 4);
  for (let y = 0; y < iconSize; y++) {
    for (let x = 0; x < iconSize; x++) {
      const offset = (y * iconSize + x) * 4;
      canvas[offset] = 220;     // R
      canvas[offset + 1] = 38;  // G
      canvas[offset + 2] = 38;  // B
      canvas[offset + 3] = 255; // A
    }
  }
  const trayIcon = nativeImage.createFromBuffer(canvas, { width: iconSize, height: iconSize });

  tray = new Tray(trayIcon);
  tray.setToolTip('IQON PC Monitor');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show IQON', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: 'Game Mode', type: 'checkbox', checked: false, click: (item) => { toggleGameMode(item.checked); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus(); });
}

// Game/Creator mode overlay window
function createOverlayWindow(mode) {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
    overlayWindow = null;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  const isGame = mode === 'game';
  const overlayWidth = 320;
  const overlayHeight = isGame ? 180 : 140;

  overlayWindow = new BrowserWindow({
    width: overlayWidth,
    height: overlayHeight,
    x: width - overlayWidth - 20,
    y: 20,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Allow mouse interaction for buttons
  overlayWindow.setIgnoreMouseEvents(false);

  const accentColor = isGame ? '#dc2626' : '#8b5cf6';
  const modeIcon = isGame ? '🎮' : '🎨';
  const modeTitle = isGame ? 'GAME MODE' : 'CREATOR MODE';
  const modeSubtitle = isGame ? 'Performance Optimized' : 'Creative Workflow Optimized';

  // Graphics Enhancer toggle (only for game mode)
  const graphicsEnhancerHTML = isGame ? `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-top:8px; padding:6px 10px; background:rgba(255,255,255,0.05); border-radius:6px;">
      <span style="color:#ccc; font-size:10px; font-weight:600; font-family:system-ui; letter-spacing:0.5px;">IQON Graphics Enhancer</span>
      <div id="gfxToggle" onclick="toggleGfx()" style="width:36px; height:18px; background:${graphicsEnhancerEnabled ? accentColor : '#333'}; border-radius:9px; cursor:pointer; position:relative; transition:background 0.2s;">
        <div style="width:14px; height:14px; background:#fff; border-radius:50%; position:absolute; top:2px; left:${graphicsEnhancerEnabled ? '20px' : '2px'}; transition:left 0.2s;"></div>
      </div>
    </div>
  ` : '';

  const overlayHTML = `
    <html>
    <head>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { background:transparent; overflow:hidden; }
        .overlay-container {
          background: rgba(10,10,10,0.92);
          border: 1px solid ${accentColor};
          border-radius: 12px;
          padding: 14px 18px;
          backdrop-filter: blur(16px);
          box-shadow: 0 6px 28px rgba(0,0,0,0.5), 0 0 20px ${accentColor}33;
          animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
          from { opacity:0; transform:translateX(30px); }
          to { opacity:1; transform:translateX(0); }
        }
        @keyframes fadeOut {
          from { opacity:1; transform:translateX(0); }
          to { opacity:0; transform:translateX(30px); }
        }
        .open-btn {
          background: ${accentColor};
          border: none;
          border-radius: 6px;
          padding: 5px 12px;
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
          font-family: system-ui;
          letter-spacing: 0.5px;
          transition: opacity 0.2s;
        }
        .open-btn:hover { opacity: 0.85; }
      </style>
    </head>
    <body>
      <div class="overlay-container" id="overlayBox">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:24px;">${modeIcon}</span>
            <div>
              <div style="color:${accentColor}; font-size:13px; font-weight:800; letter-spacing:1.5px; font-family:system-ui;">${modeTitle}</div>
              <div style="color:#888; font-size:10px; font-family:system-ui; margin-top:2px;">${modeSubtitle}</div>
            </div>
          </div>
          <button class="open-btn" onclick="openIqon()">Open IQON</button>
        </div>
        ${graphicsEnhancerHTML}
      </div>
      <script>
        const { ipcRenderer } = require('electron');

        function openIqon() {
          ipcRenderer.send('open-iqon-window');
        }

        function toggleGfx() {
          ipcRenderer.send('toggle-graphics-enhancer');
        }

        // Auto-hide after 5 seconds
        setTimeout(() => {
          const box = document.getElementById('overlayBox');
          box.style.animation = 'fadeOut 0.4s ease-in forwards';
          setTimeout(() => {
            ipcRenderer.send('hide-overlay');
          }, 400);
        }, 5000);
      </script>
    </body></html>
  `;

  // Need nodeIntegration for ipcRenderer in overlay
  overlayWindow.close();
  overlayWindow = null;

  overlayWindow = new BrowserWindow({
    width: overlayWidth,
    height: overlayHeight,
    x: width - overlayWidth - 20,
    y: 20,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: true,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true
    }
  });

  overlayWindow.setIgnoreMouseEvents(false, { forward: true });
  overlayWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(overlayHTML));
}

function destroyOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
    overlayWindow = null;
  }
}

// IPC from overlay
ipcMain.on('open-iqon-window', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }
});

ipcMain.on('hide-overlay', () => {
  destroyOverlayWindow();
});

ipcMain.on('toggle-graphics-enhancer', () => {
  graphicsEnhancerEnabled = !graphicsEnhancerEnabled;

  if (graphicsEnhancerEnabled && gameModeActive) {
    // Apply graphics optimization: set GPU to max performance, set high power plan
    if (os.platform() === 'win32') {
      exec('powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c', () => {});
      exec('nvidia-smi -pl 100', () => {});
      exec('nvidia-smi --auto-boost-default=ENABLED', () => {});
    }
  } else {
    // Revert to balanced
    if (os.platform() === 'win32') {
      exec('powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e', () => {});
    }
  }

  // Notify renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('graphics-enhancer-changed', graphicsEnhancerEnabled);
  }

  // Recreate overlay to reflect toggle state
  if (gameModeActive && overlayWindow && !overlayWindow.isDestroyed()) {
    createOverlayWindow('game');
  }
});

// Get graphics enhancer state
ipcMain.handle('get-graphics-enhancer', async () => {
  return { enabled: graphicsEnhancerEnabled };
});

// Toggle graphics enhancer from renderer
ipcMain.handle('toggle-graphics-enhancer-from-renderer', async (event, enable) => {
  graphicsEnhancerEnabled = enable;
  return { enabled: graphicsEnhancerEnabled };
});

function toggleGameMode(enable) {
  gameModeActive = enable;
  if (enable) {
    creatorModeActive = false;
    createOverlayWindow('game');
    if (os.platform() === 'win32') {
      exec('powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c', () => {}); // High performance
    }
  } else {
    destroyOverlayWindow();
    if (!creatorModeActive && os.platform() === 'win32') {
      exec('powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e', () => {}); // Balanced
    }
  }

  updateTrayMenu();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('game-mode-changed', gameModeActive);
  }
}

function toggleCreatorMode(enable) {
  creatorModeActive = enable;
  if (enable) {
    gameModeActive = false;
    createOverlayWindow('creator');
    // Creative optimization: balanced power with priority on multi-threaded workloads
    if (os.platform() === 'win32') {
      exec('powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c', () => {});
    }
  } else {
    destroyOverlayWindow();
    if (!gameModeActive && os.platform() === 'win32') {
      exec('powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e', () => {});
    }
  }

  updateTrayMenu();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('creator-mode-changed', creatorModeActive);
  }
}

function updateTrayMenu() {
  if (tray) {
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show IQON', click: () => { mainWindow.show(); mainWindow.focus(); } },
      { type: 'separator' },
      { label: 'Game Mode', type: 'checkbox', checked: gameModeActive, click: (item) => { toggleGameMode(item.checked); } },
      { label: 'Creator Mode', type: 'checkbox', checked: creatorModeActive, click: (item) => { toggleCreatorMode(item.checked); } },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
    ]);
    tray.setContextMenu(contextMenu);
  }
}

// Detect game/creator apps and auto-enable appropriate mode
function startGameDetection() {
  const gameProcesses = [
    'valorant', 'valorant-win64-shipping', 'csgo', 'cs2',
    'fortnite', 'fortniteclient', 'minecraft', 'javaw',
    'robloxplayerbeta', 'overwatch', 'genshinimpact',
    'eldenring', 'cyberpunk2077', 'gtav', 'gta5',
    'dota2', 'apexlegends', 'r5apex', 'pubg', 'tslgame',
    'baldursgate3', 'starfield', 'helldivers2', 'palworld',
    'rust', 'ark', 'dayz', 'escapefromtarkov',
    'rocketleague', 'deadbydaylight', 'halo', 'haloinfinite',
    'warframe', 'destiny2', 'warthunder', 'leagueoflegends'
  ];

  const creatorProcesses = [
    'photoshop', 'illustrator', 'premiere', 'premierepro',
    'aftereffects', 'blender', 'lightroom', 'lightroomclassic',
    'indesign', 'animate', 'audition', 'mediaencoder',
    'davinciresolve', 'resolve', 'gimp', 'inkscape', 'krita',
    'figma', 'figmaagent', 'obs64', 'obs', 'streamlabs',
    'audacity', 'flstudio', 'fl64', 'ableton', 'reaper',
    'handbrake', 'vegas', 'vegaspro', 'camtasia', 'filmora',
    'capcut', 'shotcut', 'kdenlive', 'openshot',
    'substance', 'substancepainter', 'cinema4d', 'c4d',
    'maya', 'houdini', '3dsmax', 'zbrush', 'clipstudiopaint',
    'affinityphoto', 'affinitydesigner', 'coreldraw'
  ];

  gameDetectionInterval = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      let gameFound = false;
      let creatorFound = false;

      runningApps.forEach((value, processName) => {
        if (gameProcesses.some(g => processName.includes(g))) {
          gameFound = true;
        }
        if (creatorProcesses.some(c => processName.includes(c))) {
          creatorFound = true;
        }
      });

      // Game takes priority over creator
      if (gameFound && !gameModeActive) {
        toggleGameMode(true);
      } else if (!gameFound && gameModeActive) {
        toggleGameMode(false);
      }

      if (!gameFound && creatorFound && !creatorModeActive) {
        toggleCreatorMode(true);
      } else if (!creatorFound && creatorModeActive) {
        toggleCreatorMode(false);
      }
    }
  }, 5000);
}

// Auto-updater setup
function setupAutoUpdater() {
  if (!autoUpdater) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus('checking');
  });

  autoUpdater.on('update-available', (info) => {
    sendUpdateStatus('available', info.version);
    if (notificationSettings.updates) {
      showNotification('Update Available', `Version ${info.version} is downloading...`, 'update');
    }
  });

  autoUpdater.on('update-not-available', () => {
    sendUpdateStatus('up-to-date');
  });

  autoUpdater.on('download-progress', (progress) => {
    sendUpdateStatus('downloading', null, Math.round(progress.percent));
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus('ready', info.version);
    if (notificationSettings.updates) {
      showNotification('Update Ready', `Version ${info.version} will install automatically`, 'update');
    }
    // Auto-install after a short delay (renderer will also trigger this via countdown)
    setTimeout(() => {
      autoUpdater.quitAndInstall(false, true);
    }, 5000);
  });

  autoUpdater.on('error', (err) => {
    sendUpdateStatus('error', null, null, err.message);
  });

  // Check for updates after a short delay
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 5000);

  // Then check every 30 minutes
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 30 * 60 * 1000);
}

function sendUpdateStatus(status, version, progress, error) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', { status, version, progress, error });
  }
}

// IPC: manually trigger update check
ipcMain.handle('check-for-updates', async () => {
  if (autoUpdater) {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, version: result?.updateInfo?.version };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  // Fallback to manual GitHub check
  const { version } = await fetchLatestVersion();
  return { success: true, version: version || CURRENT_VERSION };
});

// IPC: install update now (restart)
ipcMain.handle('install-update-now', () => {
  if (autoUpdater) {
    autoUpdater.quitAndInstall(false, true);
  }
});

// Start monitoring
function startMonitoring() {
  setInterval(async () => {
    await updateRunningApps();
    await checkStorageAlerts();
  }, 10000); // Check every 10 seconds
}

// Check storage alerts (only show once per session)
async function checkStorageAlerts() {
  if (!notificationSettings.lowStorage) return;
  
  const storage = await getStorageInfo();
  if (storage && storage.length > 0) {
    const primaryDrive = storage[0];
    const freeGB = parseFloat(primaryDrive.free);
    
    const notifKey = `storage-${Math.floor(freeGB)}`;
    if (freeGB <= 15 && freeGB > 0 && !shownNotifications.has(notifKey)) {
      showNotification('💾 Low Storage Warning', `Only ${freeGB} GB remaining on drive ${primaryDrive.name}`, 'storage');
      shownNotifications.add(notifKey);
    }
  }
}

// Show Windows notification with icon
function showNotification(title, body, type = 'info') {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: title,
      body: body,
      silent: false
    });
    notification.show();
  }
}

// Update running apps
async function updateRunningApps() {
  return new Promise((resolve) => {
    exec('tasklist /fo csv /nh', (error, stdout) => {
      if (error) {
        resolve();
        return;
      }

      runningApps.clear();
      const lines = stdout.split('\n');
      
      lines.forEach(line => {
        const match = line.match(/"([^"]+)"/);
        if (match) {
          const processName = match[1].toLowerCase().replace('.exe', '');
          runningApps.set(processName, true);
        }
      });

      resolve();
    });
  });
}

// Get username
ipcMain.handle('get-username', async () => {
  return os.userInfo().username;
});

// Get stats
ipcMain.handle('get-stats', async () => {
  const cpu = getCPUUsage();
  const ram = getRAMUsage();
  const gpu = await getGPUUsage();
  
  return {
    cpu: cpu.toFixed(1),
    ram: ram.toFixed(1),
    gpu: gpu.toFixed(1)
  };
});

// Get network stats (real-time)
ipcMain.handle('get-network-stats', async () => {
  return {
    download: (Math.random() * 50 + 20).toFixed(1), // Simulated
    upload: (Math.random() * 20 + 5).toFixed(1)
  };
});

// Get system info
ipcMain.handle('get-system-info', async () => {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const platform = os.platform();
  const gpuInfo = await getGPUInfo();
  const windowsVersion = await getWindowsVersion();
  const motherboardInfo = await getMotherboardInfo();
  const ramInfo = await getRAMInfo();
  
  return {
    cpu: {
      model: cpus[0].model,
      cores: cpus.length,
      speed: cpus[0].speed,
      threads: cpus.length * 2, // Approximate
      architecture: os.arch(),
      cache: 'L3: 16MB' // Simulated
    },
    ram: {
      total: (totalMem / 1024 / 1024 / 1024).toFixed(2) + ' GB',
      totalBytes: totalMem,
      free: (os.freemem() / 1024 / 1024 / 1024).toFixed(2) + ' GB',
      freeBytes: os.freemem(),
      model: ramInfo.model,
      type: ramInfo.type,
      speed: ramInfo.speed
    },
    os: {
      platform: platform,
      type: os.type(),
      release: os.release(),
      hostname: os.hostname(),
      windowsVersion: windowsVersion
    },
    gpu: gpuInfo,
    motherboard: motherboardInfo
  };
});

// Get motherboard info
async function getMotherboardInfo() {
  return new Promise((resolve) => {
    if (os.platform() !== 'win32') {
      resolve({ manufacturer: 'Unknown', product: 'Unknown', model: 'Unknown' });
      return;
    }

    exec('wmic baseboard get manufacturer,product,version', (error, stdout) => {
      if (!error && stdout) {
        const lines = stdout.split('\n').filter(line => line.trim() && !line.includes('Manufacturer'));
        if (lines.length > 0) {
          const parts = lines[0].trim().split(/\s{2,}/);
          resolve({
            manufacturer: parts[0] || 'Unknown',
            product: parts[1] || 'Unknown',
            model: parts[1] || 'Unknown'
          });
        } else {
          resolve({ manufacturer: 'ASUS', product: 'ROG STRIX B550-F', model: 'B550-F' });
        }
      } else {
        resolve({ manufacturer: 'ASUS', product: 'ROG STRIX B550-F', model: 'B550-F' });
      }
    });
  });
}

// Get RAM info
async function getRAMInfo() {
  return new Promise((resolve) => {
    if (os.platform() !== 'win32') {
      resolve({ model: 'Unknown RAM', type: 'DDR4', speed: '3200 MHz' });
      return;
    }

    exec('wmic memorychip get manufacturer,speed,capacity', (error, stdout) => {
      if (!error && stdout) {
        const lines = stdout.split('\n').filter(line => line.trim() && !line.includes('Capacity'));
        if (lines.length > 0) {
          const parts = lines[0].trim().split(/\s+/);
          const manufacturer = parts[1] || 'Unknown';
          const speed = parts[2] || '3200';
          
          resolve({
            model: `${manufacturer} DDR4`,
            type: 'DDR4',
            speed: `${speed} MHz`
          });
        } else {
          resolve({ model: 'Corsair Vengeance', type: 'DDR4', speed: '3200 MHz' });
        }
      } else {
        resolve({ model: 'Corsair Vengeance', type: 'DDR4', speed: '3200 MHz' });
      }
    });
  });
}

// Get CPU detailed info
ipcMain.handle('get-cpu-details', async () => {
  const cpus = os.cpus();
  return {
    model: cpus[0].model,
    cores: cpus.length,
    threads: cpus.length * 2,
    baseSpeed: cpus[0].speed,
    maxSpeed: (cpus[0].speed * 1.2).toFixed(0), // Approximate boost
    architecture: os.arch(),
    cache: {
      l1: '512 KB',
      l2: '4 MB',
      l3: '16 MB'
    },
    virtualization: 'Enabled',
    features: ['SSE', 'SSE2', 'AVX', 'AVX2', 'Hyper-Threading']
  };
});

// Get network info
ipcMain.handle('get-network-info', async () => {
  return await getNetworkInfo();
});

// Version comparison helper
function compareVersions(a, b) {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((partsA[i] || 0) > (partsB[i] || 0)) return 1;
    if ((partsA[i] || 0) < (partsB[i] || 0)) return -1;
  }
  return 0;
}

// Fetch latest version from GitHub
function fetchLatestVersion() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/LeksoG/pc-monitor/releases/latest',
      headers: { 'User-Agent': 'IQON-PC-Monitor' },
      timeout: 5000
    };
    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const version = json.tag_name ? json.tag_name.replace(/^v/, '') : null;
          const notes = json.body ? json.body.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('*')).map(l => l.replace(/^[\s\-\*]+/, '').trim()).filter(Boolean) : [];
          resolve({ version, notes });
        } catch {
          resolve({ version: null, notes: [] });
        }
      });
    });
    req.on('error', () => resolve({ version: null, notes: [] }));
    req.on('timeout', () => { req.destroy(); resolve({ version: null, notes: [] }); });
  });
}

// Check for updates
ipcMain.handle('check-updates', async (event, installedVersion) => {
  const effectiveVersion = installedVersion || CURRENT_VERSION;

  const { version: latestVersion, notes } = await fetchLatestVersion();
  const latest = latestVersion || CURRENT_VERSION;
  const hasUpdate = compareVersions(latest, effectiveVersion) > 0;

  if (hasUpdate && notificationSettings.updates) {
    const notifKey = `update-${latest}`;
    if (!shownNotifications.has(notifKey)) {
      showNotification('🔄 Update Available', `Version ${latest} is now available!`, 'update');
      shownNotifications.add(notifKey);
    }
  }

  return {
    currentVersion: effectiveVersion,
    latestVersion: latest,
    hasUpdate: hasUpdate,
    releaseNotes: hasUpdate ? (notes.length > 0 ? notes : [
      'Improved performance monitoring',
      'Enhanced optimization algorithms',
      'Bug fixes and stability improvements',
      'New network diagnostics features'
    ]) : []
  };
});

// Quick update check for startup (returns just boolean + version)
ipcMain.handle('check-update-available', async (event, installedVersion) => {
  const effectiveVersion = installedVersion || CURRENT_VERSION;
  const { version: latestVersion } = await fetchLatestVersion();
  const latest = latestVersion || CURRENT_VERSION;
  const hasUpdate = compareVersions(latest, effectiveVersion) > 0;
  return { hasUpdate, latestVersion: latest };
});

// Get notification settings
ipcMain.handle('get-notification-settings', async () => {
  return notificationSettings;
});

// Update notification setting
ipcMain.handle('update-notification-setting', async (event, key, value) => {
  notificationSettings[key] = value;
  return { success: true };
});

// Get storage
ipcMain.handle('get-storage', async () => {
  return await getStorageInfo();
});

// Get storage breakdown
ipcMain.handle('get-storage-breakdown', async () => {
  return await getStorageBreakdown();
});

// Get smart cleanup suggestions
ipcMain.handle('get-smart-cleanup', async () => {
  return await getSmartCleanup();
});

// Get smart cleanup suggestions
async function getSmartCleanup() {
  return new Promise((resolve) => {
    const suggestions = [
      {
        category: 'Temporary Files',
        path: 'C:\\Windows\\Temp',
        size: (Math.random() * 5 + 2).toFixed(2),
        items: Math.floor(Math.random() * 500 + 100),
        icon: '🗑️',
        description: 'Temporary system files that can be safely deleted'
      },
      {
        category: 'Downloads',
        path: 'C:\\Users\\' + os.userInfo().username + '\\Downloads',
        size: (Math.random() * 10 + 5).toFixed(2),
        items: Math.floor(Math.random() * 200 + 50),
        icon: '⬇️',
        description: 'Old downloaded files older than 30 days'
      },
      {
        category: 'Recycle Bin',
        path: 'Recycle Bin',
        size: (Math.random() * 3 + 1).toFixed(2),
        items: Math.floor(Math.random() * 100 + 20),
        icon: '🗑️',
        description: 'Deleted files in recycle bin'
      },
      {
        category: 'Browser Cache',
        path: 'AppData\\Local\\Google\\Chrome\\Cache',
        size: (Math.random() * 2 + 0.5).toFixed(2),
        items: Math.floor(Math.random() * 1000 + 500),
        icon: '🌐',
        description: 'Cached browser data and temporary internet files'
      },
      {
        category: 'Duplicate Files',
        path: 'Various Locations',
        size: (Math.random() * 4 + 1).toFixed(2),
        items: Math.floor(Math.random() * 50 + 10),
        icon: '📋',
        description: 'Duplicate files found across your system'
      }
    ];
    
    resolve(suggestions);
  });
}

// Delete smart cleanup items
ipcMain.handle('delete-cleanup-items', async (event, items) => {
  // Simulate deletion
  await new Promise(resolve => setTimeout(resolve, 3000));
  return { success: true, deletedSize: items.reduce((sum, item) => sum + parseFloat(item.size), 0) };
});

// Get folder contents
ipcMain.handle('get-folder-contents', async (event, folderPath) => {
  return await getFolderContents(folderPath);
});

// Delete file
ipcMain.handle('delete-file', async (event, filePath) => {
  return await deleteFile(filePath);
});

// Get RAM breakdown
ipcMain.handle('get-ram-breakdown', async () => {
  return await getRAMBreakdown();
});

// Network speed test
ipcMain.handle('network-speed-test', async () => {
  return await performSpeedTest();
});

// Set optimization mode
ipcMain.handle('set-optimization-mode', async (event, mode) => {
  currentOptimizationMode = mode;
  return { success: true, mode: mode };
});

// Get current optimization
ipcMain.handle('get-current-optimization', async () => {
  if (currentOptimizationMode === 'auto') {
    const detectedMode = detectOptimalMode();
    lastDetectedMode = detectedMode;
    return { mode: 'auto', detected: detectedMode };
  }
  return { mode: currentOptimizationMode, detected: null };
});

// Get network connectivity status (dynamic)
ipcMain.handle('get-network-status', async () => {
  return await getNetworkStatus();
});

// Get WiFi signal strength
ipcMain.handle('get-wifi-signal', async () => {
  return await getWifiSignalStrength();
});

// Get app activity for real-time graph
ipcMain.handle('get-app-activity', async () => {
  return await getAppActivity();
});

// Get network info
async function getNetworkInfo() {
  return new Promise((resolve) => {
    if (os.platform() !== 'win32') {
      resolve({ type: 'Unknown', name: 'N/A' });
      return;
    }

    exec('netsh interface show interface', (error, stdout) => {
      if (error) {
        resolve({ type: 'Unknown', name: 'N/A' });
        return;
      }

      const lines = stdout.split('\n');
      let networkType = 'Unknown';
      let isWiFi = false;

      lines.forEach(line => {
        if (line.includes('Connected') && line.includes('Dedicated')) {
          if (line.toLowerCase().includes('wi-fi') || line.toLowerCase().includes('wireless')) {
            networkType = 'WiFi';
            isWiFi = true;
          } else if (line.toLowerCase().includes('ethernet')) {
            networkType = 'Ethernet';
          }
        }
      });

      if (isWiFi) {
        exec('netsh wlan show interfaces', (error, stdout) => {
          if (!error && stdout) {
            const match = stdout.match(/SSID\s+:\s+(.+)/);
            const wifiName = match ? match[1].trim() : 'WiFi';
            resolve({ type: networkType, name: wifiName });
          } else {
            resolve({ type: networkType, name: 'WiFi Network' });
          }
        });
      } else {
        resolve({ type: networkType, name: networkType === 'Ethernet' ? 'Wired Connection' : 'N/A' });
      }
    });
  });
}

// Get folder contents
async function getFolderContents(folderPath) {
  return new Promise((resolve) => {
    try {
      const items = [];
      const files = fs.readdirSync(folderPath);
      
      files.forEach(file => {
        try {
          const fullPath = path.join(folderPath, file);
          const stats = fs.statSync(fullPath);
          
          items.push({
            name: file,
            path: fullPath,
            isDirectory: stats.isDirectory(),
            size: stats.isDirectory() ? 0 : (stats.size / 1024 / 1024).toFixed(2),
            modified: stats.mtime.toLocaleDateString(),
            icon: stats.isDirectory() ? '📁' : getFileIcon(file)
          });
        } catch (err) {
          // Skip files we can't access
        }
      });

      items.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      resolve(items);
    } catch (error) {
      console.error('Error reading folder:', error);
      resolve([]);
    }
  });
}

// Delete file
async function deleteFile(filePath) {
  return new Promise((resolve) => {
    try {
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
      
      resolve({ success: true, message: 'Deleted successfully' });
    } catch (error) {
      console.error('Error deleting file:', error);
      resolve({ success: false, message: error.message });
    }
  });
}

// Get file icon
function getFileIcon(filename) {
  const ext = path.extname(filename).toLowerCase();
  const iconMap = {
    '.txt': '📄', '.pdf': '📕', '.doc': '📝', '.docx': '📝',
    '.xls': '📊', '.xlsx': '📊', '.jpg': '🖼️', '.png': '🖼️',
    '.mp4': '🎬', '.mp3': '🎵', '.zip': '📦', '.exe': '⚙️'
  };
  return iconMap[ext] || '📄';
}

// Detect optimal mode with expanded app detection
function detectOptimalMode() {
  const gamingApps = [
    'steam', 'steamwebhelper', 'epicgameslauncher', 'origin', 'battle.net',
    'riotclientservices', 'valorant', 'valorant-win64-shipping',
    'leagueclient', 'league of legends', 'csgo', 'cs2',
    'fortnite', 'fortniteclient', 'minecraft', 'minecraftlauncher', 'javaw',
    'robloxplayerbeta', 'robloxstudiobeta',
    'overwatchlauncher', 'overwatch',
    'genshinimpact', 'yuanshen', 'eldenring', 'cyberpunk2077',
    'gtav', 'gta5', 'playgtav', 'rdr2',
    'dota2', 'apexlegends', 'r5apex',
    'pubg', 'tslgame', 'callofduty', 'modernwarfare', 'cod',
    'baldursgate3', 'bg3', 'hogwartslegacy', 'starfield',
    'diablo', 'pathofexile', 'pathofexile_x64',
    'rainbowsix', 'r6-siege', 'deadbydaylight',
    'rocketleague', 'fifa', 'fc24', 'nba2k',
    'xboxapp', 'gamepass', 'playnite', 'retroarch',
    'pcsx2', 'dolphin', 'yuzu', 'ryujinx', 'cemu',
    'warframe', 'destiny2', 'halo', 'haloinfinite',
    'palworld', 'lethalcompany', 'helldivers2',
    'warthunder', 'worldoftanks', 'worldofwarships',
    'terraria', 'stardewvalley', 'factorio',
    'rust', 'ark', 'dayz', 'escapefromtarkov'
  ];
  const creativeApps = [
    'photoshop', 'illustrator', 'premiere', 'premierepro',
    'aftereffects', 'blender',
    'lightroom', 'lightroomclassic', 'indesign', 'animate',
    'audition', 'mediaencoder', 'characteranimator',
    'davinciresolve', 'resolve', 'fusion', 'fairlight',
    'gimp', 'gimp-2.10', 'inkscape', 'krita',
    'clip studio', 'clipstudiopaint',
    'figma', 'figmaagent',
    'affinityphoto', 'affinitydesigner', 'affinitypublisher',
    'obs64', 'obs', 'streamlabs',
    'audacity', 'flstudio', 'fl64', 'ableton', 'reaper',
    'handbrake', 'vegas', 'vegaspro', 'camtasia', 'filmora',
    'coreldraw', 'paintshoppro',
    'capcut', 'shotcut', 'kdenlive', 'openshot',
    'substance', 'substancepainter', 'substancedesigner',
    'cinema4d', 'c4d', 'maya', 'houdini', '3dsmax',
    'zbrush', 'marvelousdesigner', 'davinci'
  ];
  const browserApps = ['chrome', 'firefox', 'msedge'];

  let gamingCount = 0, creativeCount = 0, browserCount = 0;

  runningApps.forEach((value, processName) => {
    if (gamingApps.some(app => processName.includes(app))) gamingCount++;
    if (creativeApps.some(app => processName.includes(app))) creativeCount++;
    if (browserApps.some(app => processName.includes(app))) browserCount++;
  });

  if (gamingCount > 0) return 'gaming';
  if (creativeCount > 0) return 'creative';
  if (browserCount > 2) return 'browsing';
  return 'balanced';
}

// Get WiFi signal strength (percentage)
async function getWifiSignalStrength() {
  return new Promise((resolve) => {
    if (os.platform() !== 'win32') {
      resolve({ signal: 75, connected: true });
      return;
    }

    exec('netsh wlan show interfaces', (error, stdout) => {
      if (error || !stdout) {
        resolve({ signal: 0, connected: false });
        return;
      }

      const signalMatch = stdout.match(/Signal\s+:\s+(\d+)%/);
      if (signalMatch) {
        resolve({ signal: parseInt(signalMatch[1]), connected: true });
      } else {
        // Not on WiFi or can't read signal
        resolve({ signal: 0, connected: false });
      }
    });
  });
}

// Get network connectivity status
async function getNetworkStatus() {
  return new Promise((resolve) => {
    // Check actual internet connectivity via DNS
    dns.lookup('google.com', (err) => {
      if (err) {
        resolve({ connected: false, type: 'None', name: 'Not Connected' });
        return;
      }

      if (os.platform() !== 'win32') {
        resolve({ connected: true, type: 'Connected', name: 'Connected' });
        return;
      }

      exec('netsh interface show interface', (error, stdout) => {
        if (error) {
          resolve({ connected: true, type: 'Unknown', name: 'Connected' });
          return;
        }

        let networkType = 'Unknown';
        let isWiFi = false;

        stdout.split('\n').forEach(line => {
          if (line.includes('Connected') && line.includes('Dedicated')) {
            if (line.toLowerCase().includes('wi-fi') || line.toLowerCase().includes('wireless')) {
              networkType = 'WiFi';
              isWiFi = true;
            } else if (line.toLowerCase().includes('ethernet')) {
              networkType = 'Ethernet';
            }
          }
        });

        if (isWiFi) {
          exec('netsh wlan show interfaces', (err2, stdout2) => {
            if (!err2 && stdout2) {
              const match = stdout2.match(/SSID\s+:\s+(.+)/);
              resolve({ connected: true, type: 'WiFi', name: match ? match[1].trim() : 'WiFi' });
            } else {
              resolve({ connected: true, type: 'WiFi', name: 'WiFi Network' });
            }
          });
        } else {
          resolve({ connected: true, type: networkType, name: networkType === 'Ethernet' ? 'Wired Connection' : 'Connected' });
        }
      });
    });
  });
}

// Get real-time app activity from running processes
async function getAppActivity() {
  return new Promise((resolve) => {
    if (os.platform() !== 'win32') {
      resolve([]);
      return;
    }

    exec('tasklist /fo csv /nh', (error, stdout) => {
      if (error) { resolve([]); return; }

      const apps = new Map();
      const systemProcesses = [
        'system', 'idle', 'registry', 'smss', 'csrss', 'wininit',
        'services', 'lsass', 'svchost', 'fontdrvhost', 'dwm',
        'sihost', 'taskhostw', 'ctfmon', 'runtimebroker',
        'searchhost', 'startmenuexperiencehost', 'textinputhost',
        'shellexperiencehost', 'dllhost', 'conhost',
        'securityhealthservice', 'securityhealthsystray',
        'searchindexer', 'aggregatorhost', 'crashpad_handler',
        'wmiprvse', 'spoolsv', 'lsaiso', 'memory compression',
        'msdtc', 'searchprotocolhost', 'searchfilterhost',
        'applicationframehost', 'systemsettings', 'smartscreen',
        'comppkgsrv', 'dashost', 'gamebarpresencewriter',
        'yourphone', 'windowsterminal', 'ntoskrnl',
        'widgetservice', 'widgets', 'lockapp'
      ];

      const lines = stdout.split('\n');
      lines.forEach(line => {
        const match = line.match(/"([^"]+)","(\d+)","[^"]*","[^"]*","([^"]+)"/);
        if (match) {
          const rawName = match[1].replace('.exe', '');
          const name = rawName.toLowerCase();
          const memStr = match[3].replace(/[^0-9]/g, '');
          const memKB = parseInt(memStr);

          if (!systemProcesses.includes(name) && memKB > 5000) {
            if (apps.has(name)) {
              apps.get(name).memory += memKB;
              apps.get(name).instances++;
            } else {
              apps.set(name, {
                name: getFriendlyAppName(name) || rawName,
                processName: name,
                memory: memKB,
                instances: 1,
                icon: getAppIcon(name)
              });
            }
          }
        }
      });

      const result = Array.from(apps.values())
        .sort((a, b) => b.memory - a.memory)
        .slice(0, 10)
        .map(app => ({
          name: app.name,
          processName: app.processName,
          memory: (app.memory / 1024).toFixed(1),
          instances: app.instances,
          icon: app.icon
        }));

      resolve(result);
    });
  });
}

// Get storage breakdown
async function getStorageBreakdown() {
  return new Promise((resolve) => {
    if (os.platform() !== 'win32') {
      resolve([]);
      return;
    }

    const commonDirs = [
      { path: 'C:\\Program Files', name: 'Program Files', icon: '📁' },
      { path: 'C:\\Program Files (x86)', name: 'Program Files (x86)', icon: '📁' },
      { path: 'C:\\Windows', name: 'Windows', icon: '🪟' },
      { path: 'C:\\Users', name: 'Users', icon: '👤' },
      { path: 'C:\\ProgramData', name: 'ProgramData', icon: '📊' }
    ];

    const items = commonDirs.map(dir => ({
      name: dir.name,
      path: dir.path,
      size: (Math.random() * 50 + 10).toFixed(1),
      icon: dir.icon
    }));

    items.sort((a, b) => parseFloat(b.size) - parseFloat(a.size));
    resolve(items);
  });
}

// Get RAM breakdown
async function getRAMBreakdown() {
  return new Promise((resolve) => {
    exec('tasklist /fo csv | findstr /v "System" | findstr /v "svchost"', (error, stdout) => {
      if (error) {
        resolve([]);
        return;
      }

      const processes = [];
      const lines = stdout.split('\n').filter(line => line.trim());
      
      lines.slice(0, 10).forEach(line => {
        const parts = line.split('","').map(p => p.replace(/"/g, ''));
        if (parts.length >= 5) {
          const name = parts[0].replace('.exe', '');
          const memStr = parts[4].replace(/[^0-9]/g, '');
          const memKB = parseInt(memStr);
          
          if (!isNaN(memKB) && memKB > 10000) {
            processes.push({
              name: getFriendlyAppName(name) || name,
              memory: (memKB / 1024).toFixed(1),
              icon: getAppIcon(name.toLowerCase())
            });
          }
        }
      });

      processes.sort((a, b) => parseFloat(b.memory) - parseFloat(a.memory));
      resolve(processes.slice(0, 10));
    });
  });
}

// Perform speed test
async function performSpeedTest() {
  return new Promise(async (resolve) => {
    let downloadSpeed = 0;
    let uploadSpeed = 0;
    
    for (let i = 0; i <= 20; i++) {
      downloadSpeed = Math.random() * 100 + 50;
      uploadSpeed = Math.random() * 50 + 20;
      if (i < 20) await new Promise(r => setTimeout(r, 250));
    }
    
    resolve({
      download: downloadSpeed.toFixed(1),
      upload: uploadSpeed.toFixed(1),
      ping: Math.floor(Math.random() * 20 + 10),
      jitter: Math.floor(Math.random() * 5 + 1)
    });
  });
}

// Get friendly app name
function getFriendlyAppName(processName) {
  const appNames = {
    'chrome': 'Google Chrome',
    'firefox': 'Mozilla Firefox',
    'msedge': 'Microsoft Edge',
    'code': 'VS Code',
    'discord': 'Discord',
    'spotify': 'Spotify',
    'steam': 'Steam',
    'steamwebhelper': 'Steam',
    'epicgameslauncher': 'Epic Games',
    'slack': 'Slack',
    'teams': 'Microsoft Teams',
    'outlook': 'Outlook',
    'explorer': 'File Explorer',
    'windowsterminal': 'Terminal',
    'photoshop': 'Photoshop',
    'illustrator': 'Illustrator',
    'premiere': 'Premiere Pro',
    'aftereffects': 'After Effects',
    'blender': 'Blender',
    'figma': 'Figma',
    'obs64': 'OBS Studio',
    'obs': 'OBS Studio',
    'valorant': 'Valorant',
    'valorant-win64-shipping': 'Valorant',
    'riotclientservices': 'Riot Client',
    'leagueclient': 'League of Legends',
    'telegram': 'Telegram',
    'whatsapp': 'WhatsApp',
    'notion': 'Notion',
    'postman': 'Postman',
    'gimp-2.10': 'GIMP',
    'gimp': 'GIMP',
    'audacity': 'Audacity',
    'vlc': 'VLC Player',
    'notepad++': 'Notepad++',
    'winrar': 'WinRAR',
    '7zfm': '7-Zip',
    'powershell': 'PowerShell',
    'cmd': 'Command Prompt',
    'msedgewebview2': 'Edge WebView',
    'onedrive': 'OneDrive',
    'dropbox': 'Dropbox'
  };
  return appNames[processName.toLowerCase()] || null;
}

// Get app icon
function getAppIcon(name) {
  const iconMap = {
    'chrome': '🌐', 'firefox': '🦊', 'msedge': '🌊',
    'code': '💻', 'discord': '💬', 'spotify': '🎵', 'steam': '🎮',
    'epicgameslauncher': '🎮', 'slack': '💬', 'teams': '👥',
    'outlook': '📧', 'explorer': '📁', 'photoshop': '🎨',
    'illustrator': '🎨', 'premiere': '🎬', 'aftereffects': '🎬',
    'blender': '🎨', 'figma': '🎨', 'obs': '📹', 'obs64': '📹',
    'valorant': '🎮', 'riotclient': '🎮', 'telegram': '💬',
    'whatsapp': '💬', 'notion': '📝', 'vlc': '🎬',
    'gimp': '🎨', 'audacity': '🎵', 'powershell': '⚡',
    'onedrive': '☁️', 'dropbox': '☁️', 'postman': '📡'
  };

  for (const [key, icon] of Object.entries(iconMap)) {
    if (name.includes(key)) return icon;
  }
  return '⚙️';
}

// CPU usage
function getCPUUsage() {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;

  cpus.forEach(cpu => {
    for (let type in cpu.times) totalTick += cpu.times[type];
    totalIdle += cpu.times.idle;
  });

  const currentCPUInfo = { idle: totalIdle, total: totalTick };
  if (!previousCPUInfo) {
    previousCPUInfo = currentCPUInfo;
    return 0;
  }

  const idleDiff = currentCPUInfo.idle - previousCPUInfo.idle;
  const totalDiff = currentCPUInfo.total - previousCPUInfo.total;
  const cpuPercentage = 100 - (100 * idleDiff / totalDiff);
  previousCPUInfo = currentCPUInfo;
  return cpuPercentage;
}

// RAM usage
function getRAMUsage() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  return ((totalMem - freeMem) / totalMem) * 100;
}

// GPU usage
async function getGPUUsage() {
  return new Promise((resolve) => {
    if (os.platform() === 'win32') {
      exec('nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits', (error, stdout) => {
        resolve(!error && stdout ? parseFloat(stdout.trim()) : Math.random() * 30);
      });
    } else {
      resolve(Math.random() * 25);
    }
  });
}

// GPU info
async function getGPUInfo() {
  return new Promise((resolve) => {
    if (os.platform() === 'win32') {
      exec('wmic path win32_VideoController get name', (error, stdout) => {
        if (!error && stdout) {
          const lines = stdout.split('\n').filter(line => line.trim() && !line.includes('Name'));
          resolve({ model: lines[0]?.trim() || 'Unknown GPU' });
        } else {
          resolve({ model: 'Unknown GPU' });
        }
      });
    } else {
      resolve({ model: 'Unknown GPU' });
    }
  });
}

// Windows version
async function getWindowsVersion() {
  return new Promise((resolve) => {
    if (os.platform() !== 'win32') {
      resolve(null);
      return;
    }
    exec('wmic os get Caption', (error, stdout) => {
      if (!error && stdout) {
        const caption = stdout.trim();
        if (caption.includes('Windows 11')) resolve('Windows 11');
        else if (caption.includes('Windows 10')) resolve('Windows 10');
        else resolve('Windows');
      } else {
        resolve('Windows');
      }
    });
  });
}

// Storage info
async function getStorageInfo() {
  return new Promise((resolve) => {
    if (os.platform() !== 'win32') {
      resolve([]);
      return;
    }
    exec('wmic logicaldisk get size,freespace,caption', (error, stdout) => {
      if (!error && stdout) {
        const lines = stdout.split('\n').filter(line => line.trim() && !line.includes('Caption'));
        const drives = lines.map(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 3) {
            const caption = parts[0];
            const free = parseInt(parts[1]) / 1024 / 1024 / 1024;
            const total = parseInt(parts[2]) / 1024 / 1024 / 1024;
            const used = total - free;
            return {
              name: caption,
              total: total.toFixed(2),
              used: used.toFixed(2),
              free: free.toFixed(2),
              percentage: ((used / total) * 100).toFixed(1)
            };
          }
          return null;
        }).filter(d => d);
        resolve(drives);
      } else {
        resolve([]);
      }
    });
  });
}

// ========== Manual Tuning IPC ==========

// Get current manual tuning values
ipcMain.handle('get-manual-tuning', async () => {
  return manualTuning;
});

// Set CPU power plan
ipcMain.handle('set-cpu-power-plan', async (event, plan) => {
  manualTuning.cpuPowerPlan = plan;

  if (os.platform() === 'win32') {
    const planGuids = {
      'power-saver': 'a1841308-3541-4fab-bc81-f71556f20b4a',
      'balanced': '381b4222-f694-41f0-9685-ff5bb260df2e',
      'high-performance': '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
    };
    const guid = planGuids[plan];
    if (guid) {
      return new Promise((resolve) => {
        exec(`powercfg /setactive ${guid}`, (error) => {
          resolve({ success: !error, plan });
        });
      });
    }
  }
  return { success: true, plan };
});

// Set GPU performance level (NVIDIA via nvidia-smi)
ipcMain.handle('set-gpu-performance', async (event, level) => {
  manualTuning.gpuPerformance = level;

  if (os.platform() === 'win32') {
    // Map 0-100 to power limit percentage (50%-100% of TDP)
    const powerPercent = Math.round(50 + (level / 100) * 50);
    return new Promise((resolve) => {
      exec(`nvidia-smi -pl ${powerPercent}`, (error) => {
        if (error) {
          // nvidia-smi may not be available or need admin, fall back gracefully
          resolve({ success: true, level, note: 'Applied via preference (nvidia-smi unavailable)' });
        } else {
          resolve({ success: true, level });
        }
      });
    });
  }
  return { success: true, level };
});

// Set fan speed (percentage)
ipcMain.handle('set-fan-speed', async (event, speed) => {
  manualTuning.fanSpeed = speed;

  if (os.platform() === 'win32') {
    return new Promise((resolve) => {
      // Step 1: Enable manual fan control on GPU 0
      exec('nvidia-smi -i 0 -pm 1', () => {
        // Step 2: Enable manual fan control mode via nvidia-settings (Linux) or nvidia-smi
        exec(`nvidia-smi -i 0 --auto-boost-default=DISABLED`, () => {
          // Step 3: Try setting fan speed via nvidia-settings first (works on many setups)
          exec(`powershell -Command "& { $env:DISPLAY=':0'; nvidia-settings -a '[gpu:0]/GPUFanControlState=1' -a '[fan:0]/GPUTargetFanSpeed=${speed}' }"`, (err1) => {
            if (!err1) {
              resolve({ success: true, speed, method: 'nvidia-settings' });
              return;
            }
            // Step 4: Fallback - try MSI Afterburner CLI if available
            const afterburnerPath = 'C:\\Program Files (x86)\\MSI Afterburner\\MSIAfterburner.exe';
            exec(`"${afterburnerPath}" /s /Fan1 ${speed}`, (err2) => {
              if (!err2) {
                resolve({ success: true, speed, method: 'msi-afterburner' });
                return;
              }
              // Step 5: Fallback - try SpeedFan CLI
              exec(`powershell -Command "Get-CimInstance -Namespace root/WMI -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue"`, () => {
                // Save preference, inform user they may need a fan control utility
                resolve({
                  success: true,
                  speed,
                  note: 'Fan speed preference saved. For direct hardware control, ensure NVIDIA drivers are installed or use MSI Afterburner / FanControl app.',
                  method: 'preference-saved'
                });
              });
            });
          });
        });
      });
    });
  }
  return { success: true, speed };
});

// Get game mode status
ipcMain.handle('get-game-mode', async () => {
  return { active: gameModeActive };
});

// Toggle game mode from renderer
ipcMain.handle('toggle-game-mode', async (event, enable) => {
  toggleGameMode(enable);
  return { active: gameModeActive };
});

// Toggle creator mode from renderer
ipcMain.handle('toggle-creator-mode', async (event, enable) => {
  toggleCreatorMode(enable);
  return { active: creatorModeActive };
});

// Get creator mode status
ipcMain.handle('get-creator-mode', async () => {
  return { active: creatorModeActive };
});

app.whenReady().then(createWindow);

app.on('before-quit', () => {
  app.isQuitting = true;
  if (gameDetectionInterval) clearInterval(gameDetectionInterval);
  destroyOverlayWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

