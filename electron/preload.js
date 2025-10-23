const { contextBridge, ipcRenderer } = require('electron')

// 暴露受保护的方法给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 账号管理
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  saveAccounts: (accounts) => ipcRenderer.invoke('save-accounts', accounts),
  
  // 设置管理
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // 对话框
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
  showErrorBox: (title, content) => ipcRenderer.invoke('show-error-box', title, content),
  
  // 屏幕截图
  captureScreen: () => ipcRenderer.invoke('capture-screen'),

  // 米哈游登录API
  mihoyoGetQRCode: (gameType) => ipcRenderer.invoke('mihoyo-get-qrcode', gameType),
  mihoyoQueryQRCode: (ticket, gameType) => ipcRenderer.invoke('mihoyo-query-qrcode', ticket, gameType),
  mihoyoScanQRLogin: (ticket, gameType, uid, gameToken) => ipcRenderer.invoke('mihoyo-scan-qr-login', ticket, gameType, uid, gameToken),
  mihoyoConfirmQRLogin: (uid, gameToken, ticket, gameType) => ipcRenderer.invoke('mihoyo-confirm-qr-login', uid, gameToken, ticket, gameType),
  mihoyoGetStokenByGameToken: (uid, gameToken) => ipcRenderer.invoke('mihoyo-get-stoken-by-game-token', uid, gameToken),
  mihoyoGetGameTokenByStoken: (stoken, mid) => ipcRenderer.invoke('mihoyo-get-game-token-by-stoken', stoken, mid),

  // 获取设备ID
  getDeviceId: () => ipcRenderer.invoke('get-device-id'),
  
  // 获取用户信息
  mihoyoGetUserInfo: (uid) => ipcRenderer.invoke('mihoyo-get-user-info', uid),
  
  // 直播流相关API
  getStreamLink: (platform, roomId) => ipcRenderer.invoke('get-stream-link', platform, roomId),
  captureStreamFrame: (streamUrl, headers) => ipcRenderer.invoke('capture-stream-frame', streamUrl, headers),
  douyinHeadersAuto: (roomId) => ipcRenderer.invoke('douyin-headers-auto', roomId),
  streamPipeStart: (streamUrl, headers, options) => ipcRenderer.invoke('stream-pipe-start', streamUrl, headers, options),
  streamPipeStop: () => ipcRenderer.invoke('stream-pipe-stop'),
  onStreamFrame: (callback) => ipcRenderer.on('stream-frame', (_e, payload) => callback(payload)),
  onStreamFrameEnd: (callback) => ipcRenderer.on('stream-frame-end', (_e, payload) => callback(payload)),
  onStreamLog: (callback) => ipcRenderer.on('stream-log', (_e, payload) => callback(payload)),
  onWorkerLog: (callback) => ipcRenderer.on('worker-log', (_e, payload) => callback(payload)),
  streamFrameDone: () => ipcRenderer.send('stream-frame-done'),
  // 保存调试图片
  saveDebugImage: (dataUrl, filename) => ipcRenderer.invoke('save-debug-image', dataUrl, filename),
  // 工具：将二进制数据转 base64（在渲染进程无 Buffer 时使用）
  toBase64: (data) => {
    try {
      if (data == null) return ''
      // data 可能是 Uint8Array/ArrayBuffer/Buffer
      const u8 = data instanceof Uint8Array ? data : new Uint8Array(data)
      const B = (typeof Buffer !== 'undefined' && Buffer && Buffer.from) ? Buffer : require('buffer').Buffer
      return B.from(u8).toString('base64')
    } catch (_) {
      return ''
    }
  },
  // 将图像二进制及元信息发送到主进程做识别
  detectQRFromBuffer: (data, meta) => ipcRenderer.invoke('detect-qr', data, meta),
  
  // 菜单事件监听
  onMenuAddAccount: (callback) => ipcRenderer.on('menu-add-account', callback),
  onMenuScanScreen: (callback) => ipcRenderer.on('menu-scan-screen', callback),
  onMenuScanStream: (callback) => ipcRenderer.on('menu-scan-stream', callback),
  
  // 移除监听器
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
})
