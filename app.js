// PC Monitor - Complete Frontend JavaScript with ALL New Features

if (!window.api) {
  document.body.innerHTML = '<div style="text-align:center;padding:50px;color:white;"><h1>Error: API not available</h1></div>';
}

let selectedOptimization = 'auto';
let currentFolderPath = null;
let folderHistory = [];
let selectedCleanupItems = [];

// Update circular progress
function updateCircularProgress(id, percentage) {
  const circle = document.getElementById(id);
  const circumference = 282.743; // Updated for 100x100 circle with r=45
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
  
  // Background arc
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, Math.PI, 2 * Math.PI);
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 8;
  ctx.stroke();
  
  // Calculate percentage (max 100 Mbps = 100%)
  const percent = Math.min((percentage / 100) * 100, 100);
  const endAngle = Math.PI + (Math.PI * (percent / 100));
  
  // Progress arc
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, Math.PI, endAngle);
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.stroke();
}

// Update network gauges
async function updateNetworkGauges() {
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

// Page navigation
function showPage(page) {
  document.getElementById('homePage').classList.add('hidden');
  document.getElementById('updatesPage').classList.add('hidden');
  document.getElementById('notificationsPage').classList.add('hidden');
  
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  
  if (page === 'home') {
    document.getElementById('homePage').classList.remove('hidden');
    document.querySelectorAll('.nav-item')[0].classList.add('active');
  } else if (page === 'updates') {
    document.getElementById('updatesPage').classList.remove('hidden');
    document.querySelectorAll('.nav-item')[1].classList.add('active');
    loadUsername();
  } else if (page === 'notifications') {
    document.getElementById('notificationsPage').classList.remove('hidden');
    document.querySelectorAll('.nav-item')[2].classList.add('active');
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
    if (document.getElementById('userName2')) document.getElementById('userName2').textContent = username;
    if (document.getElementById('userName3')) document.getElementById('userName3').textContent = username;
    document.getElementById('welcomeName').textContent = firstName;
    const initial = firstName.charAt(0).toUpperCase();
    document.getElementById('userAvatar').textContent = initial;
    if (document.getElementById('userAvatar2')) document.getElementById('userAvatar2').textContent = initial;
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
  
  // Show progress
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

// Check for updates
async function checkForUpdates() {
  document.getElementById('updateCheck').style.display = 'none';
  document.getElementById('updateProgress').style.display = 'block';
  
  try {
    const updateInfo = await window.api.checkUpdates();
    document.getElementById('updateProgress').style.display = 'none';
    document.getElementById('currentVersion').textContent = updateInfo.currentVersion;
    
    if (updateInfo.hasUpdate) {
      document.getElementById('updateBadge').textContent = 'Update Available';
      document.getElementById('updateBadge').classList.add('available');
      document.getElementById('newVersion').textContent = updateInfo.latestVersion;
      
      const notesList = document.getElementById('releaseNotes');
      notesList.innerHTML = '';
      updateInfo.releaseNotes.forEach(note => {
        const li = document.createElement('li');
        li.textContent = note;
        notesList.appendChild(li);
      });
      
      document.getElementById('updateAvailable').style.display = 'block';
    } else {
      document.getElementById('updateBadge').textContent = 'Up to date';
      document.getElementById('updateCheck').style.display = 'block';
    }
  } catch (error) {
    console.error('Error checking updates:', error);
  }
}

// Install update
async function installUpdate() {
  // Hide update button, show progress
  document.getElementById('updateAvailable').style.display = 'none';
  document.getElementById('updateProgress').style.display = 'block';
  document.getElementById('updateProgress').querySelector('.optimization-status').textContent = 'Installing update...';
  
  // Simulate update installation
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Save that we just updated
  localStorage.setItem('lastVersion', '3.0.0');
  localStorage.setItem('currentVersion', '3.1.0');
  localStorage.setItem('justUpdated', 'true');
  
  // Show completion
  document.getElementById('updateProgress').querySelector('.optimization-status').textContent = 'Update complete! Restarting...';
  
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Simulate restart by reloading
  window.location.reload();
}

// Close What's New modal
function closeWhatsNew() {
  document.getElementById('whatsNewModal').classList.remove('show');
  localStorage.removeItem('justUpdated');
}

// Check if just updated and show What's New
function checkForWhatsNew() {
  const justUpdated = localStorage.getItem('justUpdated');
  const currentVersion = localStorage.getItem('currentVersion');
  
  if (justUpdated === 'true' && currentVersion) {
    document.getElementById('whatsNewVersion').textContent = currentVersion;
    setTimeout(() => {
      document.getElementById('whatsNewModal').classList.add('show');
    }, 1000);
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
    
    if (optimization.mode === 'auto') {
      const modeNames = {
        'gaming': 'Gaming',
        'creative': 'Creative Work',
        'browsing': 'Browsing',
        'balanced': 'Balanced Performance'
      };
      displayText = 'Auto: ' + (modeNames[optimization.detected] || 'Balanced');
    } else {
      const modeNames = {
        'gaming': 'Optimized for Gaming',
        'creative': 'Optimized for Creative',
        'power': 'Power Saver Mode'
      };
      displayText = modeNames[optimization.mode] || 'Optimized';
    }
    
    document.getElementById('optimizationMode').textContent = displayText;
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
setInterval(updateStats, 1000);
setInterval(updateNetworkGauges, 1000);
setInterval(updateOptimizationDisplay, 5000);
updateStats();
updateNetworkGauges();