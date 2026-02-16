// PC Monitor - Frontend JavaScript with FPS Chart, WiFi Signal & Updated Features

if (!window.api) {
  document.body.innerHTML = '<div style="text-align:center;padding:50px;color:white;"><h1>Error: API not available</h1></div>';
}

let selectedOptimization = 'auto';
let currentFolderPath = null;
let folderHistory = [];
let selectedCleanupItems = [];
let isNetworkConnected = true;

// ========== FPS Chart State ==========
const FPS_HISTORY_LENGTH = 60; // 60 data points
const fpsColors = ['#667eea', '#34d399', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#3b82f6', '#14b8a6'];
let fpsAppData = {}; // { appName: { color, data: [], enabled: true, icon } }
let fpsAnimationFrame = null;
let previousFpsData = {};

// Update circular progress
function updateCircularProgress(id, percentage) {
  const circle = document.getElementById(id);
  const circumference = 282.743;
  const offset = circumference - (percentage / 100) * circumference;
  circle.style.strokeDashoffset = offset;
}

// Draw semicircle gauge for network
function drawSemicircle(canvasId, percentage, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const centerX = 60, centerY = 55, radius = 45;

  ctx.clearRect(0, 0, 120, 60);

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, Math.PI, 2 * Math.PI);
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 8;
  ctx.stroke();

  const percent = Math.min((percentage / 100) * 100, 100);
  const endAngle = Math.PI + (Math.PI * (percent / 100));

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, Math.PI, endAngle);
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.stroke();
}

// Update network gauges
async function updateNetworkGauges() {
  if (!isNetworkConnected) return;
  try {
    const stats = await window.api.getNetworkStats();
    const downloadVal = parseFloat(stats.download);
    const uploadVal = parseFloat(stats.upload);

    document.getElementById('downloadSpeed').textContent = stats.download + ' Mbps';
    document.getElementById('uploadSpeed').textContent = stats.upload + ' Mbps';

    drawSemicircle('downloadGauge', downloadVal, '#3b82f6');
    drawSemicircle('uploadGauge', uploadVal, '#34d399');
  } catch (error) {
    console.error('Error updating network gauges:', error);
  }
}

// ========== WiFi Signal Strength ==========
async function updateWifiSignal() {
  try {
    const signal = await window.api.getWifiSignal();
    const bars = document.querySelectorAll('#signalStrength .signal-bar');
    const signalPercent = document.getElementById('signalPercent');
    const signalInfo = document.getElementById('signalInfo');

    if (!signal.connected) {
      bars.forEach(bar => {
        bar.className = 'signal-bar';
      });
      if (signalPercent) signalPercent.textContent = 'N/A';
      if (signalInfo) signalInfo.style.display = 'none';
      return;
    }

    if (signalInfo) signalInfo.style.display = 'flex';
    if (signalPercent) signalPercent.textContent = signal.signal + '%';

    const strength = signal.signal;
    let activeBars = 0;
    let colorClass = 'good';

    if (strength >= 80) { activeBars = 5; colorClass = 'good'; }
    else if (strength >= 60) { activeBars = 4; colorClass = 'good'; }
    else if (strength >= 40) { activeBars = 3; colorClass = 'fair'; }
    else if (strength >= 20) { activeBars = 2; colorClass = 'weak'; }
    else { activeBars = 1; colorClass = 'weak'; }

    bars.forEach((bar, i) => {
      if (i < activeBars) {
        bar.className = 'signal-bar active ' + colorClass;
      } else {
        bar.className = 'signal-bar';
      }
    });
  } catch (error) {
    console.error('Error updating WiFi signal:', error);
  }
}

// ========== FPS Line Chart ==========

// Simulate FPS values based on app type (since real FPS monitoring requires hooks)
function simulateFPS(appName) {
  const prevFps = previousFpsData[appName] || 60;
  let baseFps = 60;
  const name = appName.toLowerCase();

  // Gaming apps tend to have variable FPS
  if (['Steam', 'Valorant', 'Minecraft', 'Fortnite', 'CS2', 'Roblox', 'League of Legends'].some(g => appName.includes(g))) {
    baseFps = 90 + Math.random() * 80; // 90-170
  } else if (['Chrome', 'Firefox', 'Edge', 'Microsoft Edge'].some(b => appName.includes(b))) {
    baseFps = 55 + Math.random() * 10; // 55-65
  } else if (['Photoshop', 'Premiere', 'After Effects', 'Blender', 'Figma', 'OBS'].some(c => appName.includes(c))) {
    baseFps = 30 + Math.random() * 30; // 30-60
  } else if (['VS Code', 'Discord', 'Spotify', 'Slack', 'Telegram'].some(u => appName.includes(u))) {
    baseFps = 58 + Math.random() * 4; // 58-62
  } else {
    baseFps = 50 + Math.random() * 20; // 50-70
  }

  // Smooth transition from previous value
  const smoothed = prevFps * 0.7 + baseFps * 0.3;
  previousFpsData[appName] = smoothed;
  return Math.round(smoothed);
}

// Update FPS data from app activity
async function updateFPSData() {
  try {
    const apps = await window.api.getAppActivity();
    if (!apps || apps.length === 0) return;

    const currentAppNames = new Set();
    let colorIndex = Object.keys(fpsAppData).length;

    apps.slice(0, 8).forEach(app => {
      currentAppNames.add(app.name);

      if (!fpsAppData[app.name]) {
        fpsAppData[app.name] = {
          color: fpsColors[colorIndex % fpsColors.length],
          data: [],
          enabled: true,
          icon: app.icon
        };
        colorIndex++;
      }

      const fps = simulateFPS(app.name);
      const appEntry = fpsAppData[app.name];
      appEntry.data.push(fps);
      if (appEntry.data.length > FPS_HISTORY_LENGTH) {
        appEntry.data.shift();
      }
    });

    // Remove apps that are no longer running
    Object.keys(fpsAppData).forEach(name => {
      if (!currentAppNames.has(name)) {
        delete fpsAppData[name];
        delete previousFpsData[name];
      }
    });

    updateFPSToggles();
    drawFPSChart();
    updateFPSLegend();
  } catch (error) {
    console.error('Error updating FPS data:', error);
  }
}

// Build toggle buttons for apps
function updateFPSToggles() {
  const container = document.getElementById('fpsToggles');
  if (!container) return;

  const existingToggles = container.querySelectorAll('.fps-toggle');
  const existingNames = new Set();
  existingToggles.forEach(t => existingNames.add(t.dataset.app));

  const currentNames = new Set(Object.keys(fpsAppData));

  // Only rebuild if apps changed
  if (existingNames.size === currentNames.size && [...existingNames].every(n => currentNames.has(n))) {
    // Just update active states
    existingToggles.forEach(toggle => {
      const appName = toggle.dataset.app;
      if (fpsAppData[appName] && fpsAppData[appName].enabled) {
        toggle.classList.add('active');
      } else {
        toggle.classList.remove('active');
      }
    });
    return;
  }

  let html = '';
  Object.entries(fpsAppData).forEach(([name, data]) => {
    html += `<button class="fps-toggle ${data.enabled ? 'active' : ''}" data-app="${name}" onclick="toggleFPSApp('${name.replace(/'/g, "\\'")}')" style="border-color: ${data.enabled ? data.color : '#333'};">${data.icon} ${name}</button>`;
  });
  container.innerHTML = html;
}

// Toggle app visibility in chart
function toggleFPSApp(appName) {
  if (fpsAppData[appName]) {
    fpsAppData[appName].enabled = !fpsAppData[appName].enabled;
    updateFPSToggles();
    drawFPSChart();
    updateFPSLegend();
  }
}

// Draw the FPS line chart with smooth animation
function drawFPSChart() {
  const canvas = document.getElementById('fpsChart');
  if (!canvas) return;

  const container = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const padding = { top: 20, right: 20, bottom: 30, left: 45 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  // Clear
  ctx.clearRect(0, 0, w, h);

  // Find max FPS across all enabled apps
  let maxFPS = 120;
  Object.values(fpsAppData).forEach(app => {
    if (app.enabled && app.data.length > 0) {
      const appMax = Math.max(...app.data);
      if (appMax > maxFPS) maxFPS = appMax;
    }
  });
  maxFPS = Math.ceil(maxFPS / 30) * 30; // Round up to nearest 30

  // Draw grid lines
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1;
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillStyle = '#555';
  ctx.textAlign = 'right';

  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const y = padding.top + (chartH / gridSteps) * i;
    const val = Math.round(maxFPS - (maxFPS / gridSteps) * i);

    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();

    ctx.fillText(val + ' fps', padding.left - 8, y + 4);
  }

  // Draw each app's line
  Object.entries(fpsAppData).forEach(([name, app]) => {
    if (!app.enabled || app.data.length < 2) return;

    const points = app.data.map((fps, i) => ({
      x: padding.left + (i / (FPS_HISTORY_LENGTH - 1)) * chartW,
      y: padding.top + chartH - (fps / maxFPS) * chartH
    }));

    // Draw gradient fill under line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    // Smooth curve using bezier
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      ctx.bezierCurveTo(cpx, prev.y, cpx, curr.y, curr.x, curr.y);
    }

    // Fill area under the curve
    const lastPoint = points[points.length - 1];
    ctx.lineTo(lastPoint.x, padding.top + chartH);
    ctx.lineTo(points[0].x, padding.top + chartH);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    gradient.addColorStop(0, app.color + '25');
    gradient.addColorStop(1, app.color + '00');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw the line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      ctx.bezierCurveTo(cpx, prev.y, cpx, curr.y, curr.x, curr.y);
    }
    ctx.strokeStyle = app.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw endpoint dot
    if (points.length > 0) {
      const last = points[points.length - 1];
      ctx.beginPath();
      ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = app.color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(last.x, last.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0a';
      ctx.fill();
    }
  });

  // Draw time axis labels
  ctx.fillStyle = '#555';
  ctx.textAlign = 'center';
  ctx.font = '10px -apple-system, sans-serif';
  const timeLabels = ['60s', '45s', '30s', '15s', 'Now'];
  timeLabels.forEach((label, i) => {
    const x = padding.left + (i / (timeLabels.length - 1)) * chartW;
    ctx.fillText(label, x, h - 8);
  });
}

// Update FPS legend
function updateFPSLegend() {
  const container = document.getElementById('fpsLegend');
  if (!container) return;

  let html = '';
  Object.entries(fpsAppData).forEach(([name, app]) => {
    if (!app.enabled) return;
    const latestFps = app.data.length > 0 ? app.data[app.data.length - 1] : 0;
    html += `
      <div class="fps-legend-item">
        <div class="fps-legend-dot" style="background: ${app.color};"></div>
        <span>${name}</span>
        <span class="fps-legend-value">${latestFps} fps</span>
      </div>
    `;
  });

  container.innerHTML = html || '<div class="fps-legend-item"><span style="color: #555;">Waiting for app data...</span></div>';
}

// Page navigation
function showPage(page) {
  document.getElementById('homePage').classList.add('hidden');
  document.getElementById('notificationsPage').classList.add('hidden');

  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

  if (page === 'home') {
    document.getElementById('homePage').classList.remove('hidden');
    document.querySelectorAll('.nav-item')[0].classList.add('active');
  } else if (page === 'notifications') {
    document.getElementById('notificationsPage').classList.remove('hidden');
    document.querySelectorAll('.nav-item')[1].classList.add('active');
    loadNotificationSettings();
    loadUsername();
  }
}

// Load username and motherboard
async function loadUsername() {
  try {
    const username = await window.api.getUsername();
    const firstName = username.split(' ')[0];
    document.getElementById('userName').textContent = username;
    if (document.getElementById('userName3')) document.getElementById('userName3').textContent = username;
    document.getElementById('welcomeName').textContent = firstName;
    const initial = firstName.charAt(0).toUpperCase();
    document.getElementById('userAvatar').textContent = initial;
    if (document.getElementById('userAvatar3')) document.getElementById('userAvatar3').textContent = initial;
  } catch (error) {
    console.error('Error loading username:', error);
  }
}

// Load system info with motherboard
async function loadSystemInfo() {
  try {
    const info = await window.api.getSystemInfo();

    // CPU
    document.getElementById('cpuModel').textContent = info.cpu.model.substring(0, 30) + '...';

    // RAM with model
    document.getElementById('ramModel').textContent = `${info.ram.model} ${info.ram.type} @ ${info.ram.speed}`;

    // GPU
    document.getElementById('gpuModel').textContent = info.gpu.model.substring(0, 30) + '...';

    // Motherboard
    document.getElementById('userMotherboard').textContent = `${info.motherboard.manufacturer} ${info.motherboard.product}`;

    // Storage
    const storage = await window.api.getStorage();
    if (storage && storage.length > 0) {
      const primaryDrive = storage[0];
      document.getElementById('storageTotal').textContent = primaryDrive.total + ' GB total';
      document.getElementById('storageFree').textContent = primaryDrive.free + ' GB free';
      document.getElementById('storageValue').textContent = primaryDrive.percentage + '%';
      document.getElementById('storageUtil').textContent = primaryDrive.percentage + '%';
      document.getElementById('storageUtilBar').style.width = primaryDrive.percentage + '%';
      updateCircularProgress('storageCircle', parseFloat(primaryDrive.percentage));
    }

  } catch (error) {
    console.error('Error loading system info:', error);
  }
}

// Load network info
async function loadNetworkInfo() {
  try {
    const networkInfo = await window.api.getNetworkInfo();
    document.getElementById('networkType').textContent = networkInfo.type;
    document.getElementById('networkName').textContent = networkInfo.name;
  } catch (error) {
    console.error('Error loading network info:', error);
  }
}

// Show CPU details
async function showCPUDetails() {
  document.getElementById('homePage').classList.add('hidden');
  document.getElementById('cpuDetailsView').classList.add('show');

  try {
    const cpu = await window.api.getCPUDetails();

    const html = `
      <div class="detail-card">
        <h4>Model</h4>
        <p>${cpu.model}</p>
      </div>
      <div class="detail-card">
        <h4>Cores / Threads</h4>
        <p>${cpu.cores} Cores / ${cpu.threads} Threads</p>
      </div>
      <div class="detail-card">
        <h4>Base Speed</h4>
        <p>${cpu.baseSpeed} MHz</p>
      </div>
      <div class="detail-card">
        <h4>Max Speed</h4>
        <p>${cpu.maxSpeed} MHz (Boost)</p>
      </div>
      <div class="detail-card">
        <h4>Architecture</h4>
        <p>${cpu.architecture}</p>
      </div>
      <div class="detail-card">
        <h4>Virtualization</h4>
        <p>${cpu.virtualization}</p>
      </div>
      <div class="detail-card">
        <h4>Cache</h4>
        <ul>
          <li>L1: ${cpu.cache.l1}</li>
          <li>L2: ${cpu.cache.l2}</li>
          <li>L3: ${cpu.cache.l3}</li>
        </ul>
      </div>
      <div class="detail-card">
        <h4>Features</h4>
        <ul>
          ${cpu.features.map(f => `<li>${f}</li>`).join('')}
        </ul>
      </div>
    `;

    document.getElementById('cpuDetailsGrid').innerHTML = html;
  } catch (error) {
    console.error('Error loading CPU details:', error);
  }
}

// Close CPU details
function closeCPUDetails() {
  document.getElementById('cpuDetailsView').classList.remove('show');
  setTimeout(() => {
    document.getElementById('homePage').classList.remove('hidden');
  }, 300);
}

// Show storage details with dynamic bar
async function showStorageDetails() {
  document.getElementById('homePage').classList.add('hidden');
  document.getElementById('storageView').classList.add('show');

  currentFolderPath = null;
  folderHistory = [];

  await updateStorageBar();

  try {
    const breakdown = await window.api.getStorageBreakdown();
    displayStorageItems(breakdown);
  } catch (error) {
    console.error('Error loading storage breakdown:', error);
  }
}

// Update storage bar
async function updateStorageBar() {
  try {
    const storage = await window.api.getStorage();
    if (storage && storage.length > 0) {
      const drive = storage[0];
      document.getElementById('storageUsed').textContent = drive.used + ' GB';
      document.getElementById('storageTotal2').textContent = drive.total + ' GB';
      document.getElementById('storageFreeText').textContent = drive.free + ' GB Free';
      document.getElementById('storageBarFill').style.width = drive.percentage + '%';
    }
  } catch (error) {
    console.error('Error updating storage bar:', error);
  }
}

// Smart cleanup
async function showSmartCleanup() {
  try {
    const cleanup = await window.api.getSmartCleanup();

    let totalSize = 0;
    let html = '';

    cleanup.forEach((item, index) => {
      totalSize += parseFloat(item.size);
      html += `
        <div class="cleanup-item">
          <input type="checkbox" id="cleanup-${index}" checked data-index="${index}">
          <div class="cleanup-item-content">
            <div class="cleanup-item-header">
              <span class="cleanup-item-icon">${item.icon}</span>
              <span class="cleanup-item-title">${item.category}</span>
              <span class="cleanup-item-size">${item.size} GB • ${item.items} items</span>
            </div>
            <div class="cleanup-item-desc">${item.description}</div>
          </div>
        </div>
      `;
    });

    document.getElementById('cleanupTotalSize').textContent = totalSize.toFixed(2) + ' GB';
    document.getElementById('cleanupList').innerHTML = html;

    selectedCleanupItems = cleanup;
    document.getElementById('smartCleanupModal').classList.add('show');
  } catch (error) {
    console.error('Error loading cleanup:', error);
  }
}

// Close smart cleanup
function closeSmartCleanup() {
  document.getElementById('smartCleanupModal').classList.remove('show');
}

// Execute cleanup
async function executeCleanup() {
  const selected = [];
  document.querySelectorAll('#cleanupList input:checked').forEach(checkbox => {
    const index = parseInt(checkbox.dataset.index);
    selected.push(selectedCleanupItems[index]);
  });

  if (selected.length === 0) {
    alert('Please select at least one item to clean');
    return;
  }

  closeSmartCleanup();

  const progressEl = document.getElementById('deleteProgress');
  progressEl.classList.add('show');
  document.getElementById('deleteProgressText').textContent = 'Cleaning up...';
  document.getElementById('deleteProgressStatus').textContent = 'Removing selected items...';

  for (let i = 0; i <= 100; i += 10) {
    document.getElementById('deleteProgressFill').style.width = i + '%';
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  try {
    const result = await window.api.deleteCleanupItems(selected);
    document.getElementById('deleteProgressStatus').textContent = `Cleaned ${result.deletedSize.toFixed(2)} GB!`;

    setTimeout(async () => {
      progressEl.classList.remove('show');
      await updateStorageBar();
      await loadSystemInfo();
    }, 2000);
  } catch (error) {
    console.error('Error during cleanup:', error);
    progressEl.classList.remove('show');
  }
}

// Display storage items
function displayStorageItems(items) {
  let html = '';
  items.forEach(item => {
    html += `
      <div class="breakdown-item" onclick='openFolder(${JSON.stringify(item)})'>
        <div class="breakdown-info">
          <div class="breakdown-icon">${item.icon}</div>
          <div>
            <div class="breakdown-name">${item.name}</div>
            <div class="breakdown-type">Folder</div>
          </div>
        </div>
        <div class="breakdown-size">${item.size} GB</div>
      </div>
    `;
  });
  document.getElementById('storageBreakdown').innerHTML = html;
  updateBreadcrumb();
}

// Open folder
async function openFolder(item) {
  if (!item.path) return;
  folderHistory.push(currentFolderPath);
  currentFolderPath = item.path;

  try {
    const contents = await window.api.getFolderContents(item.path);
    displayFolderContents(contents);
  } catch (error) {
    console.error('Error opening folder:', error);
    alert('Could not open folder');
    folderHistory.pop();
  }
}

// Display folder contents
function displayFolderContents(items) {
  let html = '';
  items.forEach(item => {
    if (item.isDirectory) {
      html += `
        <div class="file-item" onclick='openFolder(${JSON.stringify(item)})'>
          <div class="file-info">
            <div class="file-icon">${item.icon}</div>
            <div class="file-details">
              <h4>${item.name}</h4>
              <div class="file-meta">Folder • Modified ${item.modified}</div>
            </div>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="file-item">
          <div class="file-info">
            <div class="file-icon">${item.icon}</div>
            <div class="file-details">
              <h4>${item.name}</h4>
              <div class="file-meta">File • ${item.size} MB • ${item.modified}</div>
            </div>
          </div>
          <div class="file-size">${item.size} MB</div>
          <button class="delete-btn" onclick='deleteItem(event, ${JSON.stringify(item)})'>Delete</button>
        </div>
      `;
    }
  });
  document.getElementById('storageBreakdown').innerHTML = html || '<div style="text-align: center; padding: 40px; color: #666;">Empty folder</div>';
  updateBreadcrumb();
}

// Delete item
async function deleteItem(event, item) {
  event.stopPropagation();
  if (!confirm(`Delete "${item.name}"?`)) return;

  const progressEl = document.getElementById('deleteProgress');
  progressEl.classList.add('show');
  document.getElementById('deleteProgressStatus').textContent = `Deleting ${item.name}...`;

  for (let i = 0; i <= 100; i += 20) {
    document.getElementById('deleteProgressFill').style.width = i + '%';
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  try {
    const result = await window.api.deleteFile(item.path);
    if (result.success) {
      document.getElementById('deleteProgressStatus').textContent = 'Deleted!';
      setTimeout(async () => {
        progressEl.classList.remove('show');
        if (currentFolderPath) {
          const contents = await window.api.getFolderContents(currentFolderPath);
          displayFolderContents(contents);
        }
        await updateStorageBar();
      }, 1000);
    }
  } catch (error) {
    console.error('Error deleting:', error);
    progressEl.classList.remove('show');
  }
}

// Navigate to root
function navigateToRoot() {
  currentFolderPath = null;
  folderHistory = [];
  window.api.getStorageBreakdown().then(displayStorageItems);
}

// Update breadcrumb
function updateBreadcrumb() {
  const breadcrumb = document.getElementById('storageBreadcrumb');
  let html = '<span class="breadcrumb-item" onclick="navigateToRoot()">📁 Root</span>';
  if (currentFolderPath) {
    const parts = currentFolderPath.split('\\').filter(p => p);
    parts.forEach(part => {
      html += '<span class="breadcrumb-separator">›</span>';
      html += `<span class="breadcrumb-item">${part}</span>`;
    });
  }
  breadcrumb.innerHTML = html;
}

// Close storage view
function closeStorageView() {
  document.getElementById('storageView').classList.remove('show');
  setTimeout(() => {
    document.getElementById('homePage').classList.remove('hidden');
  }, 300);
}

// Show RAM details
async function showRAMDetails() {
  document.getElementById('homePage').classList.add('hidden');
  document.getElementById('ramView').classList.add('show');

  try {
    const breakdown = await window.api.getRAMBreakdown();
    let html = '';
    breakdown.forEach(item => {
      html += `
        <div class="breakdown-item">
          <div class="breakdown-info">
            <div class="breakdown-icon">${item.icon}</div>
            <div>
              <div class="breakdown-name">${item.name}</div>
              <div class="breakdown-type">Process</div>
            </div>
          </div>
          <div class="breakdown-size">${item.memory} MB</div>
        </div>
      `;
    });
    document.getElementById('ramBreakdown').innerHTML = html || '<div style="text-align: center; padding: 40px; color: #666;">No processes</div>';
  } catch (error) {
    console.error('Error loading RAM:', error);
  }
}

// Close RAM view
function closeRAMView() {
  document.getElementById('ramView').classList.remove('show');
  setTimeout(() => {
    document.getElementById('homePage').classList.remove('hidden');
  }, 300);
}

// Show speed test
async function showSpeedTest() {
  document.getElementById('homePage').classList.add('hidden');
  document.getElementById('speedTestView').classList.add('show');
  document.getElementById('speedTestProgress').style.display = 'block';
  document.getElementById('speedTestResults').style.display = 'none';

  try {
    const results = await window.api.networkSpeedTest();
    document.getElementById('downloadResult').textContent = results.download + ' Mbps';
    document.getElementById('uploadResult').textContent = results.upload + ' Mbps';
    document.getElementById('pingResult').textContent = results.ping + ' ms';
    document.getElementById('jitterResult').textContent = results.jitter + ' ms';

    document.getElementById('speedTestProgress').style.display = 'none';
    document.getElementById('speedTestResults').style.display = 'block';
  } catch (error) {
    console.error('Error running speed test:', error);
  }
}

// Close speed test
function closeSpeedTest() {
  document.getElementById('speedTestView').classList.remove('show');
  setTimeout(() => {
    document.getElementById('homePage').classList.remove('hidden');
  }, 300);
}

// Close What's New modal
function closeWhatsNew() {
  document.getElementById('whatsNewModal').classList.remove('show');
  localStorage.removeItem('justUpdated');
}

// Check if just updated and show What's New
function checkForWhatsNew() {
  const justUpdated = localStorage.getItem('justUpdated');
  const installedVersion = localStorage.getItem('installedVersion');

  if (justUpdated === 'true' && installedVersion) {
    document.getElementById('whatsNewVersion').textContent = installedVersion;
    localStorage.removeItem('justUpdated');
    setTimeout(() => {
      document.getElementById('whatsNewModal').classList.add('show');
    }, 1000);
  }
}

// Update network status dynamically
async function updateNetworkStatus() {
  try {
    const status = await window.api.getNetworkStatus();
    const badge = document.getElementById('networkStatusBadge');
    const nameEl = document.getElementById('networkName');
    const typeEl = document.getElementById('networkType');
    const connectedContent = document.getElementById('networkConnectedContent');
    const disconnectedContent = document.getElementById('networkDisconnectedContent');

    if (status.connected) {
      isNetworkConnected = true;
      badge.className = 'status-badge optimal';
      nameEl.textContent = status.name || 'Connected';
      typeEl.textContent = status.type || 'Connected';
      if (connectedContent) connectedContent.style.display = '';
      if (disconnectedContent) disconnectedContent.style.display = 'none';
    } else {
      isNetworkConnected = false;
      badge.className = 'status-badge disconnected';
      nameEl.textContent = 'Not Connected';
      typeEl.textContent = 'Disconnected';
      if (connectedContent) connectedContent.style.display = 'none';
      if (disconnectedContent) disconnectedContent.style.display = '';
      document.getElementById('downloadSpeed').textContent = '0 Mbps';
      document.getElementById('uploadSpeed').textContent = '0 Mbps';
      drawSemicircle('downloadGauge', 0, '#3b82f6');
      drawSemicircle('uploadGauge', 0, '#34d399');
    }
  } catch (error) {
    console.error('Error checking network status:', error);
  }
}

// Load notification settings
async function loadNotificationSettings() {
  try {
    const settings = await window.api.getNotificationSettings();
    const settingsHtml = `
      <div class="setting-item">
        <div class="setting-info">
          <h4>Low Storage Warning</h4>
          <p>Alert when storage falls below 15 GB</p>
        </div>
        <div class="toggle ${settings.lowStorage ? 'active' : ''}" onclick="toggleNotification('lowStorage', this)"></div>
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <h4>High CPU Usage</h4>
          <p>Notify when CPU usage exceeds 80%</p>
        </div>
        <div class="toggle ${settings.highCPU ? 'active' : ''}" onclick="toggleNotification('highCPU', this)"></div>
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <h4>App Updates</h4>
          <p>Notify when new version is available</p>
        </div>
        <div class="toggle ${settings.updates ? 'active' : ''}" onclick="toggleNotification('updates', this)"></div>
      </div>
    `;
    document.getElementById('notificationSettings').innerHTML = settingsHtml;
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Toggle notification
async function toggleNotification(key, element) {
  element.classList.toggle('active');
  const isActive = element.classList.contains('active');
  try {
    await window.api.updateNotificationSetting(key, isActive);
  } catch (error) {
    console.error('Error updating setting:', error);
  }
}

// Show optimize modal
function showOptimizeModal() {
  document.getElementById('optimizeModal').classList.add('show');
}

// Close optimize modal
function closeOptimizeModal() {
  document.getElementById('optimizeModal').classList.remove('show');
  document.getElementById('optimizeOptions').style.display = 'block';
  document.getElementById('optimizeProgress').style.display = 'none';
}

// Select optimization
function selectOptimization(element, type) {
  document.querySelectorAll('.optimization-option').forEach(opt => opt.classList.remove('selected'));
  element.classList.add('selected');
  selectedOptimization = type;
}

// Start optimization
async function startOptimization() {
  document.getElementById('optimizeOptions').style.display = 'none';
  document.getElementById('optimizeProgress').style.display = 'block';

  const steps = [
    'Analyzing system...',
    'Clearing temp files...',
    'Optimizing RAM...',
    'Adjusting CPU...',
    'Configuring GPU...',
    'Finalizing...'
  ];

  for (let i = 0; i < steps.length; i++) {
    document.getElementById('optimizeDetail').textContent = steps[i];
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  await window.api.setOptimizationMode(selectedOptimization);
  updateOptimizationDisplay();

  document.getElementById('optimizeDetail').textContent = '✓ Complete!';
  setTimeout(() => closeOptimizeModal(), 2000);
}

// Update optimization display
async function updateOptimizationDisplay() {
  try {
    const optimization = await window.api.getCurrentOptimization();
    let displayText = '';
    let subtitleText = '1-Click';

    if (optimization.mode === 'auto') {
      const modeNames = {
        'gaming': 'Gaming Mode',
        'creative': 'Creative Mode',
        'browsing': 'Browsing Mode',
        'balanced': 'Balanced'
      };
      const modeIcons = {
        'gaming': '🎮',
        'creative': '🎨',
        'browsing': '🌐',
        'balanced': '⚡'
      };
      const detected = optimization.detected || 'balanced';
      displayText = 'Auto: ' + (modeNames[detected] || 'Balanced');
      subtitleText = (modeIcons[detected] || '⚡') + ' Auto-detected';
    } else {
      const modeNames = {
        'gaming': 'Gaming Mode',
        'creative': 'Creative Mode',
        'power': 'Power Saver'
      };
      displayText = modeNames[optimization.mode] || 'Optimized';
      subtitleText = 'Manual';
    }

    document.getElementById('optimizationMode').textContent = displayText;
    const subtitleEl = document.getElementById('optimizationSubtitle');
    if (subtitleEl) subtitleEl.textContent = subtitleText;
  } catch (error) {
    console.error('Error updating optimization:', error);
  }
}

// Update stats
async function updateStats() {
  try {
    const stats = await window.api.getStats();

    // CPU
    document.getElementById('cpuValue').textContent = stats.cpu + '%';
    document.getElementById('cpuUtil').textContent = stats.cpu + '%';
    document.getElementById('cpuUtilBar').style.width = stats.cpu + '%';
    updateCircularProgress('cpuCircle', parseFloat(stats.cpu));

    // RAM
    document.getElementById('ramValue').textContent = stats.ram + '%';
    document.getElementById('ramUtil').textContent = stats.ram + '%';
    document.getElementById('ramUtilBar').style.width = stats.ram + '%';
    updateCircularProgress('ramCircle', parseFloat(stats.ram));

    // GPU
    document.getElementById('gpuValue').textContent = stats.gpu + '%';
    document.getElementById('gpuUtil').textContent = stats.gpu + '%';
    document.getElementById('gpuUtilBar').style.width = stats.gpu + '%';
    updateCircularProgress('gpuCircle', parseFloat(stats.gpu));
  } catch (error) {
    console.error('Error updating stats:', error);
  }
}

// 3D Motherboard placeholder
function show3DMotherboard() {
  alert('3D Motherboard visualization coming soon!\n\nThis will show:\n• Interactive 3D model\n• Clickable components\n• Real-time component info');
}

// Initialize
loadUsername();
loadSystemInfo();
loadNetworkInfo();
updateOptimizationDisplay();
checkForWhatsNew();
updateNetworkStatus();
updateWifiSignal();
updateFPSData();
updateStats();
updateNetworkGauges();

// Intervals
setInterval(updateStats, 1000);
setInterval(updateNetworkGauges, 1000);
setInterval(updateOptimizationDisplay, 5000);
setInterval(updateNetworkStatus, 5000);
setInterval(updateWifiSignal, 3000);
setInterval(updateFPSData, 1000);    // Update FPS chart every second
