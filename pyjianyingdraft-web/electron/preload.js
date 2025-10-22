const { contextBridge, ipcRenderer } = require('electron');

// 通过 contextBridge 安全地暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electron', {
  // 可以在这里添加需要暴露给前端的 API
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },

  // 文件系统操作 API
  fs: {
    /**
     * 复制文本到剪贴板
     * @param {string} text - 要复制的文本
     * @returns {Promise<void>}
     */
    copyToClipboard: (text) => ipcRenderer.invoke('fs:copy-to-clipboard', text),

    /**
     * 使用系统默认程序打开文件
     * @param {string} filePath - 文件路径
     * @returns {Promise<void>}
     */
    openFile: (filePath) => ipcRenderer.invoke('fs:open-file', filePath),

    /**
     * 在文件管理器中显示文件
     * @param {string} filePath - 文件路径
     * @returns {Promise<void>}
     */
    showInFolder: (filePath) => ipcRenderer.invoke('fs:show-in-folder', filePath),

    /**
     * 打开文件夹
     * @param {string} folderPath - 文件夹路径
     * @returns {Promise<void>}
     */
    openFolder: (folderPath) => ipcRenderer.invoke('fs:open-folder', folderPath),
  }
});
