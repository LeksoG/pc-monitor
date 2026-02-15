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
  checkUpdateAvailable: async (installedVersion) => {
    return await ipcRenderer.invoke('check-update-available', installedVersion);
  }
});


console.log('API exposed to window!');
