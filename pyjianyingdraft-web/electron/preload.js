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
  // 示例:发送消息到主进程
  // send: (channel, data) => {
  //   const validChannels = ['toMain'];
  //   if (validChannels.includes(channel)) {
  //     ipcRenderer.send(channel, data);
  //   }
  // },
  // 示例:接收来自主进程的消息
  // receive: (channel, func) => {
  //   const validChannels = ['fromMain'];
  //   if (validChannels.includes(channel)) {
  //     ipcRenderer.on(channel, (event, ...args) => func(...args));
  //   }
  // }
});
