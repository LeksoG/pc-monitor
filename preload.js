const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loaded!');

contextBridge.exposeInMainWorld('api', {
  getUsername: async () => {
    return await ipcRenderer.invoke('get-username');
  },
  getStats: async () => {
    return await ipcRenderer.invoke('get-stats');
  },
  getNetworkStats: async () => {
    return await ipcRenderer.invoke('get-network-stats');
  },
  getSystemInfo: async () => {
    return await ipcRenderer.invoke('get-system-info');
  },
  getCPUDetails: async () => {
    return await ipcRenderer.invoke('get-cpu-details');
  },
  getNetworkInfo: async () => {
    return await ipcRenderer.invoke('get-network-info');
  },
  checkUpdates: async (installedVersion) => {
    return await ipcRenderer.invoke('check-updates', installedVersion);
  },
  getNotificationSettings: async () => {
    return await ipcRenderer.invoke('get-notification-settings');
  },
  updateNotificationSetting: async (key, value) => {
    return await ipcRenderer.invoke('update-notification-setting', key, value);
  },
  getStorage: async () => {
    return await ipcRenderer.invoke('get-storage');
  },
  getStorageBreakdown: async () => {
    return await ipcRenderer.invoke('get-storage-breakdown');
  },
  getSmartCleanup: async () => {
    return await ipcRenderer.invoke('get-smart-cleanup');
  },
  deleteCleanupItems: async (items) => {
    return await ipcRenderer.invoke('delete-cleanup-items', items);
  },
  getFolderContents: async (folderPath) => {
    return await ipcRenderer.invoke('get-folder-contents', folderPath);
  },
  deleteFile: async (filePath) => {
    return await ipcRenderer.invoke('delete-file', filePath);
  },
  getRAMBreakdown: async () => {
    return await ipcRenderer.invoke('get-ram-breakdown');
  },
  networkSpeedTest: async () => {
    return await ipcRenderer.invoke('network-speed-test');
  },
  setOptimizationMode: async (mode) => {
    return await ipcRenderer.invoke('set-optimization-mode', mode);
  },
  getCurrentOptimization: async () => {
    return await ipcRenderer.invoke('get-current-optimization');
  },
  getNetworkStatus: async () => {
    return await ipcRenderer.invoke('get-network-status');
  },
  getAppActivity: async () => {
    return await ipcRenderer.invoke('get-app-activity');
  },
  getWifiSignal: async () => {
    return await ipcRenderer.invoke('get-wifi-signal');
  },
  checkUpdateAvailable: async (installedVersion) => {
    return await ipcRenderer.invoke('check-update-available', installedVersion);
  },
  checkForUpdates: async () => {
    return await ipcRenderer.invoke('check-for-updates');
  },
  installUpdateNow: async () => {
    return await ipcRenderer.invoke('install-update-now');
  },
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, data) => callback(data));
  },
  // Manual tuning APIs
  getManualTuning: async () => {
    return await ipcRenderer.invoke('get-manual-tuning');
  },
  setCpuPowerPlan: async (plan) => {
    return await ipcRenderer.invoke('set-cpu-power-plan', plan);
  },
  setGpuPerformance: async (level) => {
    return await ipcRenderer.invoke('set-gpu-performance', level);
  },
  setFanSpeed: async (speed) => {
    return await ipcRenderer.invoke('set-fan-speed', speed);
  },
  // Game mode APIs
  getGameMode: async () => {
    return await ipcRenderer.invoke('get-game-mode');
  },
  toggleGameMode: async (enable) => {
    return await ipcRenderer.invoke('toggle-game-mode', enable);
  },
  onGameModeChanged: (callback) => {
    ipcRenderer.on('game-mode-changed', (event, active) => callback(active));
  },
  // Creator mode APIs
  getCreatorMode: async () => {
    return await ipcRenderer.invoke('get-creator-mode');
  },
  toggleCreatorMode: async (enable) => {
    return await ipcRenderer.invoke('toggle-creator-mode', enable);
  },
  onCreatorModeChanged: (callback) => {
    ipcRenderer.on('creator-mode-changed', (event, active) => callback(active));
  },
  // Graphics enhancer APIs
  getGraphicsEnhancer: async () => {
    return await ipcRenderer.invoke('get-graphics-enhancer');
  },
  toggleGraphicsEnhancer: async (enable) => {
    return await ipcRenderer.invoke('toggle-graphics-enhancer-from-renderer', enable);
  },
  onGraphicsEnhancerChanged: (callback) => {
    ipcRenderer.on('graphics-enhancer-changed', (event, enabled) => callback(enabled));
  }
});


console.log('API exposed to window!');


