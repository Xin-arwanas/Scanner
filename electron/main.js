const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const { join } = require('path')
const Store = require('electron-store')

// 初始化配置存储
const store = new Store()

// 保持对窗口对象的全局引用
let mainWindow
let douyinSessionHeaders = null

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: join(__dirname, 'preload.js')
    },
    icon: join(__dirname, '../assets/icon.png'),
    title: 'MHY扫码器',
    show: false
  })

  // 开发模式下加载Vite开发服务器
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
  console.log('Development mode:', isDev)
  
  if (isDev) {
    const devUrl = 'http://localhost:3090'
    console.log('Loading development URL:', devUrl)
    mainWindow.loadURL(devUrl).catch(err => {
      console.error('Failed to load development URL:', err)
    })
    mainWindow.webContents.openDevTools()
  } else {
    // 生产模式下加载构建后的文件
    const prodPath = join(__dirname, '../dist/index.html')
    console.log('Loading production file:', prodPath)
    mainWindow.loadFile(prodPath)
  }

  // 当窗口准备好显示时显示窗口
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // 当窗口被关闭时触发
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 添加错误监听器
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', errorCode, errorDescription, validatedURL)
  })

  mainWindow.webContents.on('crashed', () => {
    console.error('Renderer process crashed')
  })

  mainWindow.webContents.on('unresponsive', () => {
    console.error('Renderer process became unresponsive')
  })
}

// 当Electron完成初始化并准备创建浏览器窗口时调用此方法
app.whenReady().then(() => {
  createWindow()

  // 隐藏应用菜单
  try { Menu.setApplicationMenu(null) } catch (_) {}

  // 注册主进程二维码识别 IPC（worker 线程）
  try {
    const { registerQRHandler } = require('./main.qr-handler')
    if (registerQRHandler) registerQRHandler()
    else console.warn('[detect-qr] registerQRHandler not found')
  } catch (e) {
    console.warn('[detect-qr] 无法注册主进程识别IPC：', e?.message || e)
  }

  app.on('activate', () => {
    // 在macOS上，当单击dock图标并且没有其他窗口打开时，
    // 通常在应用程序中重新创建窗口。
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 当所有窗口都被关闭时退出应用
app.on('window-all-closed', () => {
  // 在macOS上，除非用户用Cmd + Q确定地退出，
  // 否则绝大部分应用及其菜单栏会保持激活。
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 创建应用菜单
function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '添加账号',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-add-account')
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit()
          }
        }
      ]
    },
    {
      label: '工具',
      submenu: [
        {
          label: '监视屏幕',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('menu-scan-screen')
          }
        },
        {
          label: '监视直播间',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            mainWindow.webContents.send('menu-scan-stream')
          }
        }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于MHY扫码器',
              message: 'MHY扫码器 v1.0.0',
              detail: '米哈游游戏扫码登录工具 - Electron版本\n\n支持游戏：\n• 崩坏3\n• 原神\n• 星穹铁道\n• 绝区零'
            })
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// IPC通信处理
console.log('主进程启动，注册IPC处理器...')

ipcMain.handle('get-accounts', () => {
  return store.get('accounts', [])
})

ipcMain.handle('save-accounts', (event, accounts) => {
  store.set('accounts', accounts)
  return true
})

ipcMain.handle('get-settings', () => {
  return store.get('settings', {
    autoScreen: false,
    autoExit: false,
    autoLogin: true
  })
})

ipcMain.handle('save-settings', (event, settings) => {
  store.set('settings', settings)
  return true
})

ipcMain.handle('show-message-box', async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, options)
  return result
})

ipcMain.handle('show-error-box', async (event, title, content) => {
  const result = await dialog.showErrorBox(title, content)
  return result
})

// 屏幕截图处理
ipcMain.handle('capture-screen', async () => {
  try {
    const { desktopCapturer, screen } = await import('electron')
    
    // 获取主屏幕信息
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.size
    
    console.log('屏幕分辨率:', width, 'x', height)
    
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: width, height: height }
    })

    if (sources.length > 0) {
      const dataURL = sources[0].thumbnail.toDataURL()
      console.log('屏幕截图成功，大小:', dataURL.length)
      return dataURL
    }
    return null
  } catch (error) {
    console.error('屏幕截图失败:', error)
    return null
  }
})

// 米哈游登录API处理
ipcMain.handle('mihoyo-get-qrcode', async (event, gameType) => {
  try {
    const { getLoginQRCode } = require('./mihoyo-api.js')
    return await getLoginQRCode(gameType)
  } catch (error) {
    console.error('获取二维码失败:', error)
    throw error
  }
})

// 持久化 FFmpeg image2pipe 拉流并推送帧（最接近 MHY_Scanner 的性能路径）
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

function resolveFfmpegPath(preferred) {
  // 1) 调用方指定
  if (preferred && typeof preferred === 'string') {
    try {
      if (path.isAbsolute(preferred)) {
        if (fs.existsSync(preferred)) return preferred
      } else {
        // 相对路径：相对于应用根目录
        const abs = path.resolve(process.cwd(), preferred)
        if (fs.existsSync(abs)) return abs
      }
    } catch (_) {}
  }
  // 1.1) 环境变量 FFMPEG_PATH
  try {
    const envPath = process.env.FFMPEG_PATH
    if (envPath) {
      const p = path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath)
      if (fs.existsSync(p)) return p
    }
  } catch (_) {}
  // 2) 尝试 ffmpeg-static
  try {
    // 动态 require，未安装则忽略
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const ffstatic = require('ffmpeg-static')
    if (ffstatic && fs.existsSync(ffstatic)) return ffstatic
  } catch (_) {}
  // 3) 回退到 PATH 中的 ffmpeg
  try {
    const cp = require('child_process')
    if (process.platform === 'win32') {
      const out = cp.execSync('where ffmpeg', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().split(/\r?\n/).find(Boolean)
      if (out && fs.existsSync(out.trim())) return out.trim()
    } else {
      const out = cp.execSync('which ffmpeg', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
      if (out && fs.existsSync(out)) return out
    }
  } catch (_) {}
  return null
}

// 维护每个窗口的拉流进程与缓冲
const streamPipes = new Map() // key: webContents.id, value: { proc, buffer, busy }

// 存储拦截到的抖音接口数据
let capturedDouyinData = {
  apiUrl: null,
  cookies: null,
  headers: null
}

ipcMain.handle('stream-pipe-start', async (event, streamUrl, headers, options = {}) => {
  const wcId = event.sender.id
  // 若已有，先停止
  if (streamPipes.has(wcId)) {
    try { const prev = streamPipes.get(wcId); if (prev && prev.proc) prev.proc.kill('SIGKILL') } catch (_) {}
    streamPipes.delete(wcId)
  }

  const ffmpegPath = resolveFfmpegPath(options.ffmpegPath)
  if (!ffmpegPath) {
    const msg = '未找到 ffmpeg 可执行文件。请在系统 PATH 配置或通过 options.ffmpegPath/环境变量 FFMPEG_PATH 指定完整路径。'
    try { event.sender.send('stream-log', `[ERROR] ${msg}`) } catch (_) {}
    return { success: false, error: msg }
  }
  const fps = options.fps || 2
  const scale = options.scale || '480' // 默认更稳：480p/2fps
  const codec = (options.codec || 'mjpeg')
  const pipeFormat = options.pipeFormat || 'image' // image | raw
  const rawWidth = options.rawWidth || 640
  const rawHeight = options.rawHeight || 360
  const tlsInsecure = !!options.tlsInsecure
  const isHttps = /^https:/i.test(String(streamUrl || ''))

  // 处理自定义请求头（如抖音需要 Referer/User-Agent 等）
  let headerArgs = []
  const defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://live.douyin.com/',
    'Accept': '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Origin': 'https://live.douyin.com',
    'Connection': 'keep-alive'
  }
  const mergedHeaders = Object.assign({}, defaultHeaders, douyinSessionHeaders || {}, headers || {})
  event.sender.send('stream-log', `[Headers] ${JSON.stringify(mergedHeaders)}`)
  try {
    if (mergedHeaders && typeof mergedHeaders === 'object' && Object.keys(mergedHeaders).length > 0) {
      const headerString = Object.entries(mergedHeaders).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n'
      headerArgs = ['-headers', headerString]
    }
  } catch (_) {}

  const userAgent = (mergedHeaders && (mergedHeaders['User-Agent'] || mergedHeaders['user-agent']))
  // 基础通用参数
  const args = [
    '-loglevel', 'debug',
    '-nostdin',
    ...(userAgent ? ['-user_agent', userAgent] : []),
    '-protocol_whitelist', 'file,http,https,tcp,tls,hls,crypto',
    // 提升 HLS/HTTP 兼容性与低延迟
    '-probesize', '1M',
    '-analyzeduration', '0',
    '-flush_packets', '1',
    '-timeout', '15000000',
    ...headerArgs,
    // 仅在 https 且显式要求不校验证书时附加
    ...((isHttps && tlsInsecure) ? ['-tls_verify', '0'] : []),
    '-i', streamUrl,
    '-map', '0:v:0',
    '-fflags', 'nobuffer',
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_on_network_error', '1',
    '-reconnect_delay_max', '2',
    '-rw_timeout', '1500000',
    '-fflags', '+discardcorrupt',
    '-an',
    ...(pipeFormat === 'raw'
      ? ['-vf', `scale=${rawWidth}:${rawHeight},fps=${fps}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1']
      : (
          codec === 'mjpeg'
            ? ['-vf', `scale=-2:${scale},fps=${fps}`,'-f','image2pipe','-vcodec','mjpeg','-q:v','4','-pix_fmt','yuvj422p','pipe:1']
            : ['-vf', `scale=-2:${scale},fps=${fps}`,'-f','image2pipe','-vcodec','png','pipe:1']
        )
    )
  ]

  const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  const state = { 
    proc, 
    buffer: Buffer.alloc(0), 
    busy: false, 
    codec, 
    pipeFormat, 
    rawWidth, 
    rawHeight,
    maxBufferSize: 10 * 1024 * 1024 // 10MB 最大缓冲区
  }
  streamPipes.set(wcId, state)
  try {
    // 打印 FFmpeg 可执行路径与请求头
    try { event.sender.send('stream-log', `[FFmpeg path] ${ffmpegPath}`) } catch (_) {}
    try { event.sender.send('stream-log', `[Headers] ${JSON.stringify(mergedHeaders)}`) } catch (_) {}
    // 构造可复制的一行命令（将 -headers 的 CRLF 转义为 \r\n，并为含空格的参数加引号）
    const printable = (() => {
      const out = []
      for (let i = 0; i < args.length; i++) {
        let val = String(args[i])
        if (i > 0 && args[i - 1] === '-headers') {
          val = val.replace(/\r\n/g, '\\r\\n').replace(/"/g, '\\"')
          out.push(`"${val}"`)
          continue
        }
        if (/\s|;|&|=|\?/g.test(val)) { out.push(`"${val}"`) } else { out.push(val) }
      }
      return `${ffmpegPath} ${out.join(' ')}`
    })()
    event.sender.send('stream-log', `[CMD] ${printable}`)
    event.sender.send('stream-log', `ffmpeg start: ${ffmpegPath} ${args.join(' ')}`)
  } catch (_) {}

  // 若 3 秒内没有任何日志，发出提示，便于定位（可能为网络/TLS/权限）
  let sawAnyLog = false
  const logWatchdog = setTimeout(() => {
    if (!sawAnyLog) {
      try { event.sender.send('stream-log', '[watchdog] 3秒内未收到FFmpeg日志，可能为网络/TLS/Headers导致，可尝试 tlsInsecure=true 或检查 Cookie/Referer') } catch (_) {}
    }
  }, 3000)

  const sendFrame = (buf) => {
    try {
      event.sender.send('stream-frame', { success: true, codec: state.codec, data: buf, pipeFormat: state.pipeFormat, width: state.rawWidth, height: state.rawHeight })
    } catch (e) {
      // 窗口可能已销毁
    }
  }

  const findPngEnd = (buffer) => {
    // PNG IEND chunk 结尾标志：49 45 4E 44 AE 42 60 82
    const sig = Buffer.from([0x49,0x45,0x4E,0x44,0xAE,0x42,0x60,0x82])
    const index = buffer.indexOf(sig)
    if (index === -1) return -1
    
    // 确保IEND chunk是完整的
    const endPos = index + sig.length
    if (endPos > buffer.length) return -1
    
    // 调试：检查PNG结构
    try {
      event.sender.send('stream-log', `[PNG] 找到IEND在位置 ${index}, 总长度 ${buffer.length}, 结束位置 ${endPos}`)
    } catch (_) {}
    
    return endPos
  }

  const findJpegEnd = (buffer) => {
    // JPEG 结束标志: FF D9
    for (let i = buffer.length - 1; i >= 0; i--) {
      if (buffer[i] === 0xD9 && i > 0 && buffer[i-1] === 0xFF) {
        // 调试：检查JPEG结构
        try {
          event.sender.send('stream-log', `[JPEG] 找到FFD9在位置 ${i-1}, 总长度 ${buffer.length}`)
        } catch (_) {}
        return i + 1
      }
    }
    return -1
  }

  const findFrameEnd = (buffer) => {
    if (state.pipeFormat === 'raw') {
      const frameSize = state.rawWidth * state.rawHeight * 3
      return buffer.length >= frameSize ? frameSize : -1
    }
    if (state.codec === 'png') return findPngEnd(buffer)
    if (state.codec === 'mjpeg' || state.codec === 'jpeg' || state.codec === 'jpg') return findJpegEnd(buffer)
    return -1
  }

  // 可选调试：把前若干字节写入临时文件，验证 stdout 是否有数据
  let dumpStream = null
  let dumpedBytes = 0
  if (options && options.debugDump) {
    try {
      const os = require('os')
      const p = require('path')
      const fsp = require('fs')
      const dumpPath = p.join(os.tmpdir(), `ffmpeg_stdout_${Date.now()}.bin`)
      dumpStream = fsp.createWriteStream(dumpPath)
      event.sender.send('stream-log', `[debugDump] stdout -> ${dumpPath}`)
    } catch (_) {}
  }

  proc.on('spawn', () => {
    try { event.sender.send('stream-log', '[proc] spawned') } catch (_) {}
    console.log('[proc] spawned')
  })

  proc.stdout.on('data', (chunk) => {
    const s = streamPipes.get(wcId)
    if (!s) return
    
    // 始终追加数据，不丢弃
    s.buffer = Buffer.concat([s.buffer, chunk])
    
    // 检查缓冲区大小，如果过大则清理
    if (s.buffer.length > s.maxBufferSize) {
      try { event.sender.send('stream-log', `[警告] 缓冲区过大 ${s.buffer.length} bytes，尝试清理`) } catch (_) {}
      
      // 尝试找到最后一个完整的帧
      let lastValidFrame = -1
      if (s.pipeFormat === 'raw') {
        const frameSize = s.rawWidth * s.rawHeight * 3
        lastValidFrame = Math.floor(s.buffer.length / frameSize) * frameSize
      } else {
        // 对于图片格式，从后往前找最后一个完整的帧
        for (let i = s.buffer.length - 1; i >= 0; i--) {
          if (s.codec === 'png') {
            const pngEnd = Buffer.from([0x49,0x45,0x4E,0x44,0xAE,0x42,0x60,0x82])
            if (i >= 7 && s.buffer.slice(i-7, i+1).equals(pngEnd)) {
              lastValidFrame = i + 1
              break
            }
          } else if (s.codec === 'mjpeg' || s.codec === 'jpeg' || s.codec === 'jpg') {
            if (i > 0 && s.buffer[i] === 0xD9 && s.buffer[i-1] === 0xFF) {
              lastValidFrame = i + 1
              break
            }
          }
        }
      }
      
      if (lastValidFrame > 0) {
        s.buffer = s.buffer.slice(lastValidFrame)
        try { event.sender.send('stream-log', `[清理] 保留最后 ${lastValidFrame} bytes，当前缓冲区 ${s.buffer.length} bytes`) } catch (_) {}
      } else {
        // 如果找不到完整帧，保留最后一部分数据
        const keepSize = Math.min(s.maxBufferSize / 2, s.buffer.length)
        s.buffer = s.buffer.slice(-keepSize)
        try { event.sender.send('stream-log', `[清理] 保留最后 ${keepSize} bytes`) } catch (_) {}
      }
    }
    
    // 调试：统计字节到达
    try { event.sender.send('stream-log', `[stdout] +${chunk.length} bytes, buffer=${s.buffer.length}`) } catch (_) {}
    
    if (dumpStream && dumpedBytes < 1024 * 1024) {
      try { dumpStream.write(chunk); dumpedBytes += chunk.length } catch (_) {}
    }
    
    // 持续处理帧，不等待busy状态
    processFrames(s)
  })
  
  // 提取帧处理逻辑到单独函数
  const processFrames = (s) => {
    if (s.pipeFormat === 'raw') {
      const frameSize = s.rawWidth * s.rawHeight * 3
      while (s.buffer.length >= frameSize) {
        const frame = s.buffer.slice(0, frameSize)
        s.buffer = s.buffer.slice(frameSize)
        try { event.sender.send('stream-log', `[frame] raw ${s.rawWidth}x${s.rawHeight}`) } catch (_) {}
        sendFrame(frame)
      }
    } else {
      let processed = true
      while (processed) {
        processed = false
        const end = findFrameEnd(s.buffer)
        if (end !== -1) {
          const frame = s.buffer.slice(0, end)
          s.buffer = s.buffer.slice(end)
          
          // 验证帧数据完整性
          if (s.codec === 'png') {
            // 检查PNG文件头
            if (frame.length < 8 || frame[0] !== 0x89 || frame[1] !== 0x50 || frame[2] !== 0x4E || frame[3] !== 0x47) {
              try { event.sender.send('stream-log', `[警告] PNG文件头无效，跳过帧`) } catch (_) {}
              continue
            }
            // 检查PNG文件尾
            const pngEnd = Buffer.from([0x49,0x45,0x4E,0x44,0xAE,0x42,0x60,0x82])
            if (!frame.slice(-8).equals(pngEnd)) {
              try { event.sender.send('stream-log', `[警告] PNG文件尾无效，跳过帧`) } catch (_) {}
              continue
            }
          } else if (s.codec === 'mjpeg' || s.codec === 'jpeg' || s.codec === 'jpg') {
            // 检查JPEG文件头
            if (frame.length < 2 || frame[0] !== 0xFF || frame[1] !== 0xD8) {
              try { event.sender.send('stream-log', `[警告] JPEG文件头无效，跳过帧`) } catch (_) {}
              continue
            }
            // 检查JPEG文件尾
            if (frame.length < 2 || frame[frame.length-2] !== 0xFF || frame[frame.length-1] !== 0xD9) {
              try { event.sender.send('stream-log', `[警告] JPEG文件尾无效，跳过帧`) } catch (_) {}
              continue
            }
          }
          
          try { event.sender.send('stream-log', `[frame] image codec=${s.codec} size=${frame.length} 验证通过`) } catch (_) {}
          sendFrame(frame)
          processed = true
        }
      }
    }
  }

  proc.stderr.on('data', (data) => {
    sawAnyLog = true
    const msg = data.toString()
    try {
      event.sender.send('stream-log', msg)
      // 同时也在主进程打印，便于对比
      // console.log('[FFmpeg]', msg)
    } catch (_) {}
  })

  proc.on('error', (err) => {
    // 例如 ENOENT: ffmpeg 不存在
    streamPipes.delete(wcId)
    try { event.sender.send('stream-frame-end', { reason: 'error', error: err.message }) } catch (_) {}
    try { clearTimeout(logWatchdog) } catch (_) {}
  })

  proc.on('close', (code, signal) => {
    streamPipes.delete(wcId)
    try { event.sender.send('stream-frame-end', { reason: 'closed', code, signal }) } catch (_) {}
    try { clearTimeout(logWatchdog) } catch (_) {}
  })

  return { success: true, ffmpegPath, args }
})

ipcMain.handle('stream-pipe-stop', async (event) => {
  const wcId = event.sender.id
  const s = streamPipes.get(wcId)
  if (s && s.proc) {
    try { s.proc.kill('SIGKILL') } catch (_) {}
  }
  streamPipes.delete(wcId)
  return { success: true }
})

// 渲染端在处理完一帧后调用（保留用于兼容性，但不再使用busy机制）
ipcMain.on('stream-frame-done', (event) => {
  // 不再需要busy机制，数据会持续处理
})

// 保存调试图片
ipcMain.handle('save-debug-image', async (event, dataUrl, filename) => {
  try {
    const fs = require('fs')
    const path = require('path')
    const os = require('os')
    
    // 从dataURL中提取base64数据
    const base64Data = dataUrl.split(',')[1]
    const buffer = Buffer.from(base64Data, 'base64')
    
    // 保存到临时目录
    const debugDir = path.join(os.tmpdir(), 'mhy-scanner-debug')
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true })
    }
    
    const filePath = path.join(debugDir, filename)
    fs.writeFileSync(filePath, buffer)
    
    console.log(`[调试] 图片已保存到: ${filePath}`)
    return { success: true, path: filePath }
  } catch (error) {
    console.error('保存调试图片失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('mihoyo-query-qrcode', async (event, ticket, gameType) => {
  try {
    const { queryQRCodeStatus } = require('./mihoyo-api.js')
    return await queryQRCodeStatus(ticket, gameType)
  } catch (error) {
    console.error('查询二维码状态失败:', error)
    throw error
  }
})

// 获取设备ID
ipcMain.handle('get-device-id', async () => {
  try {
    const { getDeviceId } = require('./mihoyo-api.js')
    return await getDeviceId()
  } catch (error) {
    console.error('获取设备ID失败:', error)
    throw error
  }
})

// 获取用户信息
ipcMain.handle('mihoyo-get-user-info', async (event, uid) => {
  try {
    const { getUserInfo } = require('./mihoyo-api.js')
    return await getUserInfo(uid)
  } catch (error) {
    console.error('获取用户信息失败:', error)
    throw error
  }
})

// 扫描二维码登录
ipcMain.handle('mihoyo-scan-qr-login', async (event, ticket, gameType, uid, gameToken) => {
  try {
    console.log('主进程收到扫描登录请求:', { ticket, gameType, uid, gameToken })
    const { scanQRLogin } = require('./mihoyo-api.js')
    console.log('成功导入 scanQRLogin 函数')
    const result = await scanQRLogin(ticket, gameType, uid, gameToken)
    console.log('扫描登录结果:', result)
    return result
  } catch (error) {
    console.error('扫描二维码登录失败:', error)
    throw error
  }
})

// 确认二维码登录
ipcMain.handle('mihoyo-confirm-qr-login', async (event, uid, gameToken, ticket, gameType) => {
  try {
    const { confirmQRLogin } = require('./mihoyo-api.js')
    return await confirmQRLogin(uid, gameToken, ticket, gameType)
  } catch (error) {
    console.error('确认二维码登录失败:', error)
    throw error
  }
})

// 通过游戏令牌获取SToken
ipcMain.handle('mihoyo-get-stoken-by-game-token', async (event, uid, gameToken) => {
  try {
    const { getStokenByGameToken } = require('./mihoyo-api.js')
    return await getStokenByGameToken(uid, gameToken)
  } catch (error) {
    console.error('获取SToken失败:', error)
    throw error
  }
})

// 通过SToken获取GameToken
ipcMain.handle('mihoyo-get-game-token-by-stoken', async (event, stoken, mid) => {
  try {
    const { getGameTokenByStoken } = require('./mihoyo-api.js')
    return await getGameTokenByStoken(stoken, mid)
  } catch (error) {
    console.error('获取GameToken失败:', error)
    throw error
  }
})

// 获取直播流链接
ipcMain.handle('get-stream-link', async (event, platform, roomId) => {
  try {
    console.log('主进程收到获取直播流链接请求:', { platform, roomId })
    
    const axios = require('axios')
    
    // 根据平台获取直播流链接
    switch (platform.toLowerCase()) {
      case 'bilibili':
      case 'bili':
        return await getBilibiliStreamLink(roomId)
      case 'douyin':
        return await getDouyinStreamLink(roomId, event)
      case 'huya':
        return await getHuyaStreamLink(roomId)
      default:
        return { success: false, error: `不支持的平台: ${platform}` }
    }
  } catch (error) {
    console.error('获取直播流链接失败:', error)
    return { success: false, error: error.message }
  }
})

// 获取B站直播流链接
async function getBilibiliStreamLink(roomId) {
  try {
    const axios = require('axios')
    
    // 1. 获取直播间信息
    const roomInfoResponse = await axios.get(`https://api.live.bilibili.com/room/v1/Room/room_init?id=${roomId}`)
    const roomInfo = roomInfoResponse.data
    
    if (roomInfo.code !== 0) {
      if (roomInfo.code === 60004) {
        return { success: false, error: '直播间不存在' }
      }
      return { success: false, error: `获取直播间信息失败: ${roomInfo.message}` }
    }
    
    if (roomInfo.data.live_status !== 1) {
      return { success: false, error: '直播间未开播' }
    }
    
    const realRoomId = roomInfo.data.room_id
    
    // 2. 获取播放信息
    const playInfoParams = {
      codec: '0',
      format: '0,2',
      only_audio: '0',
      only_video: '0',
      protocol: '0,1',
      qn: '10000',
      room_id: realRoomId
    }
    
    const queryString = Object.entries(playInfoParams)
      .map(([key, value]) => `${key}=${value}`)
      .join('&')
    
    const playInfoResponse = await axios.get(`https://api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo?${queryString}`)
    const playInfo = playInfoResponse.data
    
    if (playInfo.code !== 0) {
      return { success: false, error: `获取播放信息失败: ${playInfo.message}` }
    }
    
    // 3. 构建直播流URL
    const stream = playInfo.data.playurl_info.playurl.stream[0]
    const format = stream.format[0]
    const codec = format.codec[0]
    const urlInfo = codec.url_info[0]
    
    const streamUrl = urlInfo.host + codec.base_url + urlInfo.extra
    
    return {
      success: true,
      url: streamUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36 Edg/110.0.1587.41',
        'Referer': 'https://live.bilibili.com'
      }
    }
  } catch (error) {
    console.error('获取B站直播流链接失败:', error)
    return { success: false, error: error.message }
  }
}

// 获取抖音直播流链接（使用拦截到的真实接口数据）
async function getDouyinStreamLink(roomId, event) {
  try {
    const axios = require('axios')
    
    // 检查是否有拦截到的数据
    if (!capturedDouyinData.apiUrl || !capturedDouyinData.cookies) {
      console.log('[DOUYIN] 未找到拦截到的接口数据，使用默认参数')
      
      // 发送警告到渲染端
      if (event && event.sender) {
        try {
          event.sender.send('stream-log', `[抖音警告] 未找到拦截到的接口数据，使用默认参数`)
        } catch (e) {
          console.log('发送警告到渲染端失败:', e.message)
        }
      }
      
      // 使用默认参数作为后备
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
        'Cookie': 'SelfTabRedDotControl=%5B%7B%22id%22%3A%227285975541155366912%22%2C%22u%22%3A89%2C%22c%22%3A0%7D%5D; IsDouyinActive=false; ttwid=1%7CCJhPxlURCzpjjrsdRDkyaNmvFkLAyjR5QjE0ykOWLg0%7C1760403510%7Ccc436090ba59a3164be2097b4954a0d0428b411e4ffd5ffd122fcf4ebb38c297; xg_device_score=7.3629389170911566; has_avx2=null; device_web_cpu_core=6; device_web_memory_size=8; live_can_add_dy_2_desktop=%220%22; live_use_vvc=%22false%22; csrf_session_id=2e0150df2a8058ac2950982774cc6c46; hevc_supported=true; odin_tt=2dc9d923f760934533c8eec6fb7515a697dc0d9c8df68686412913af1170c87c4ccf08b43ff6bdb6e6e5c39e110eda6f7c8fbc6e5d4dc1237dc2c17b5a730d053ffeea5d49e5edad30c116bae16a3ea2; fpk1=U2FsdGVkX19iq3suNWsDykqtFGx/uoqg7yf3h3WI5i0vnip5vSR8JQZDAFg4759WeBHAVAUv4tpDmt7y+rJjDg==; fpk2=2204ee63bef2f351470a66ffe1bb020e; webcast_leading_last_show_time=1760403523892; webcast_leading_total_show_times=1; __live_version__=%221.1.4.954%22'
      }
      
      const url = `https://live.douyin.com/webcast/room/web/enter/?aid=6383&app_name=douyin_web&live_id=1&device_platform=web&language=zh-CN&enter_from=web_search&cookie_enabled=true&screen_width=1440&screen_height=900&browser_language=zh-CN&browser_platform=Win32&browser_name=Chrome&browser_version=141.0.0.0&web_rid=${roomId}&room_id_str=7560738861786221353&enter_source=&is_need_double_stream=false&insert_task_id=&live_reason=&msToken=5CXDD9eri9K2V5yEDJZqJDA1TcXhW2JgKKYr-qobAvUaBknj0QvwaABAEeI24o9aEGb0NP0MBRhA3qFip2x7J_R5wBuD8Dcn0wZFM7ZO_bzOkxkt7Zci783pV3jSGWKPwhqBXXMzi0zCjk8dRI4YMxs5I21LOTsTbmy_k1_n9tCYZcYMemue0kc%3D&a_bogus=d7U5keSjQZmjCdFSuKnr7cIUl%2FyANBWyEliOWw%2Fu9NYIO7eYgRNHDNtWGowFspxDdSpih91HmE0AbxxcsVXs1MHkwmpvuKkjgGn9908oMqwhb0ksLqDOC0YzF78o0WsYmA%2FJEZ65X4zE2oQ3wrO0l5AGS50n5KbMV22ovlwcPoNvgOTHYD%3D%3D`
      
      console.log('使用默认参数请求抖音直播间信息:', url)
      
      const response = await axios.get(url, { headers })
      return processDouyinResponse(response.data, event)
    }
    
    // 使用拦截到的真实数据
    console.log('[DOUYIN] 使用拦截到的真实接口数据')
    
    // 发送信息到渲染端
    if (event && event.sender) {
      try {
        event.sender.send('stream-log', `[抖音API] 使用拦截到的接口: ${capturedDouyinData.apiUrl}`)
        event.sender.send('stream-log', `[抖音API] 使用拦截到的Cookie: ${capturedDouyinData.cookies.substring(0, 100)}...`)
      } catch (e) {
        console.log('发送信息到渲染端失败:', e.message)
      }
    }
    
    // 构建请求头，优先使用拦截到的请求头
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      'Referer': 'https://live.douyin.com',
      'Origin': 'https://live.douyin.com',
      'Accept': '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Connection': 'keep-alive',
      'Cookie': capturedDouyinData.cookies
    }
    
    // 如果有拦截到的请求头，合并使用
    if (capturedDouyinData.headers) {
      Object.assign(headers, capturedDouyinData.headers)
    }
    
    console.log('使用拦截数据请求抖音直播间信息:', capturedDouyinData.apiUrl)
    
    const response = await axios.get(capturedDouyinData.apiUrl, { headers })
    return processDouyinResponse(response.data, event)
  } catch (error) {
    console.error('获取抖音直播流链接失败:', error)
    return { success: false, error: error.message }
  }
}

// 处理抖音API响应的辅助函数
function processDouyinResponse(streamInfo, event) {
  try {
    // 调试模式：将完整响应保存到文件
    if (process.env.NODE_ENV === 'development') {
      try {
        const fs = require('fs')
        const path = require('path')
        const debugFile = path.join(__dirname, 'douyin_debug.json')
        fs.writeFileSync(debugFile, JSON.stringify(streamInfo, null, 2), 'utf8')
        console.log('抖音API完整响应已保存到:', debugFile)
      } catch (error) {
        console.log('保存调试文件失败:', error.message)
      }
    }
    
    // 分块输出API响应，避免控制台截断
    console.log('抖音API响应状态:', streamInfo.status_code)
    console.log('抖音API响应消息:', streamInfo.message || '无消息')
    
    if (streamInfo.data) {
      console.log('抖音API响应数据存在:', !!streamInfo.data)
      if (streamInfo.data.data) {
        console.log('抖音API响应data.data存在:', !!streamInfo.data.data)
        console.log('抖音API响应data.data长度:', streamInfo.data.data.length)
        if (streamInfo.data.data.length > 0) {
          const firstData = streamInfo.data.data[0]
          console.log('抖音直播间基本信息:')
          console.log('  - 状态:', firstData.status)
          console.log('  - 标题:', firstData.title || '无标题')
          console.log('  - 主播:', firstData.owner?.nickname || '未知')
          console.log('  - 观看人数:', firstData.user_count || 0)
          
          if (firstData.stream_url) {
            console.log('抖音直播流URL存在:', !!firstData.stream_url)
            if (firstData.stream_url.live_core_sdk_data) {
              console.log('抖音live_core_sdk_data存在:', !!firstData.stream_url.live_core_sdk_data)
              if (firstData.stream_url.live_core_sdk_data.pull_data) {
                console.log('抖音pull_data存在:', !!firstData.stream_url.live_core_sdk_data.pull_data)
                if (firstData.stream_url.live_core_sdk_data.pull_data.stream_data) {
                  console.log('抖音stream_data存在:', !!firstData.stream_url.live_core_sdk_data.pull_data.stream_data)
                  console.log('抖音stream_data长度:', firstData.stream_url.live_core_sdk_data.pull_data.stream_data.length)
                }
              }
            }
          }
        }
      }
    }
    
    // 检查状态码，完全模仿MHY_Scanner的逻辑
    if (!streamInfo || streamInfo.status_code !== 0) {
      console.log('抖音API返回错误状态码:', streamInfo.status_code)
      return { success: false, error: '抖音API返回错误状态码' }
    }
    
    // 检查数据结构，完全模仿MHY_Scanner的逻辑
    if (!streamInfo.data || !streamInfo.data.data || !Array.isArray(streamInfo.data.data) || streamInfo.data.data.length === 0) {
      console.log('抖音API返回数据格式错误')
      return { success: false, error: '抖音API返回数据格式错误' }
    }
    
    const data = streamInfo.data.data[0]
    // console.log('抖音直播间数据:', JSON.stringify(data, null, 2))
    
    // 检查直播状态，完全模仿MHY_Scanner的逻辑
    // 抖音 status == 2 代表是开播的状态
    const status = data.status
    console.log('抖音直播状态:', status)
    
    if (status === 2) {
      // 正在直播
      if (!data.stream_url || !data.stream_url.live_core_sdk_data || !data.stream_url.live_core_sdk_data.pull_data || !data.stream_url.live_core_sdk_data.pull_data.stream_data) {
        console.log('抖音直播流数据格式错误')
        return { success: false, error: '抖音直播流数据格式错误' }
      }
      
      // 解析stream_data，完全模仿MHY_Scanner的逻辑
      const streamDataStr = data.stream_url.live_core_sdk_data.pull_data.stream_data
      console.log('抖音stream_data原始字符串长度:', streamDataStr.length)
      console.log('抖音stream_data前100字符:', streamDataStr.substring(0, 100))
      
      const streamData = JSON.parse(streamDataStr)
      console.log('解析后的stream_data结构:')
      console.log('  - data存在:', !!streamData.data)
      if (streamData.data) {
        console.log('  - origin存在:', !!streamData.data.origin)
        if (streamData.data.origin) {
          console.log('  - main存在:', !!streamData.data.origin.main)
          if (streamData.data.origin.main) {
            console.log('  - flv存在:', !!streamData.data.origin.main.flv)
            if (streamData.data.origin.main.flv) {
              console.log('  - flv URL长度:', streamData.data.origin.main.flv.length)
              console.log('  - flv URL前50字符:', streamData.data.origin.main.flv.substring(0, 50))
            }
          }
        }
      }
      
      const originMain = streamData.data.origin.main
      const flvUrl = originMain.flv
      const hlsUrl = originMain.hls || originMain.m3u8 || ''
      const preferFlv = !!flvUrl
      const finalUrl = preferFlv ? flvUrl : hlsUrl
      const altUrl = preferFlv ? (hlsUrl || '') : flvUrl
      console.log('最终抖音播放URL(优先FLV):', finalUrl)
      
      return {
        success: true,
        url: finalUrl,
        altUrl,
        type: preferFlv ? 'flv' : 'hls',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
          'Referer': 'https://live.douyin.com',
          'Cookie': capturedDouyinData.cookies || ''
        }
      }
    } else if (status === 4) {
      // 直播间未开播
      return { success: false, error: '抖音直播间未开播' }
    } else {
      // 其他状态
      return { success: false, error: `抖音直播间状态异常: ${status}` }
    }
  } catch (error) {
    console.error('处理抖音API响应失败:', error)
    return { success: false, error: error.message }
  }
}

// 方案B：通过隐藏窗口自动获取抖音 Cookie，并拦截接口请求
async function getDouyinHeadersByHiddenWindow(roomId, event) {
  return new Promise((resolve) => {
    const { BrowserWindow, session } = require('electron')
    const win = new BrowserWindow({
      show: false,
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    // 静音隐藏窗口，避免页面短暂发声
    try { win.webContents.setAudioMuted(true) } catch (_) {}

    // 拦截网络请求
    const { webRequest } = session.defaultSession
    
    // 拦截请求
    webRequest.onBeforeRequest((details, callback) => {
      const url = details.url
      
      // 检查是否是目标接口
      if (url.includes('/webcast/room/web/enter/')) {
        console.log('[DOUYIN][API] 捕获到目标接口请求:', url)
        
        // 存储接口URL
        capturedDouyinData.apiUrl = url
        
        // 发送到渲染端控制台
        if (event && event.sender) {
          try {
            event.sender.send('stream-log', `[抖音API] 接口地址: ${url}`)
            event.sender.send('stream-log', `[抖音API] 请求方法: ${details.method}`)
            event.sender.send('stream-log', `[抖音API] 请求体: ${details.uploadData ? JSON.stringify(details.uploadData) : '无'}`)
          } catch (e) {
            console.log('发送API信息到渲染端失败:', e.message)
          }
        }
      }
      
      callback({})
    })
    
    // 拦截请求头
    webRequest.onBeforeSendHeaders((details, callback) => {
      const url = details.url
      
      if (url.includes('/webcast/room/web/enter/')) {
        console.log('[DOUYIN][API] 请求头:', details.requestHeaders)
        
        // 存储请求头信息
        capturedDouyinData.headers = details.requestHeaders
        
        // 发送请求头到渲染端
        if (event && event.sender) {
          try {
            event.sender.send('stream-log', `[抖音API] 请求头: ${JSON.stringify(details.requestHeaders, null, 2)}`)
          } catch (e) {
            console.log('发送请求头到渲染端失败:', e.message)
          }
        }
      }
      
      callback({})
    })
    
    // 拦截响应
    webRequest.onHeadersReceived((details, callback) => {
      const url = details.url
      
      if (url.includes('/webcast/room/web/enter/')) {
        console.log('[DOUYIN][API] 响应状态:', details.statusCode)
        console.log('[DOUYIN][API] 响应头:', details.responseHeaders)
        
        // 发送响应信息到渲染端
        if (event && event.sender) {
          try {
            event.sender.send('stream-log', `[抖音API] 响应状态: ${details.statusCode}`)
            event.sender.send('stream-log', `[抖音API] 响应头: ${JSON.stringify(details.responseHeaders, null, 2)}`)
          } catch (e) {
            console.log('发送响应信息到渲染端失败:', e.message)
          }
        }
      }
      
      callback({})
    })

    const liveUrl = `https://live.douyin.com/${roomId}`
    win.loadURL(liveUrl).catch(() => {})

    const finish = async () => {
      try {
        // 等待一段时间让页面加载完成并发送请求
        await new Promise(resolve => setTimeout(resolve, 5000))
        
        const cookies = await session.defaultSession.cookies.get({ url: 'https://live.douyin.com' })
        const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ')
        
        // 存储Cookie信息
        capturedDouyinData.cookies = cookieStr
        
        console.log('[DOUYIN][headers] 自动获取的Cookie:', cookieStr)
        
        // 发送Cookie到渲染端
        if (event && event.sender) {
          try {
            event.sender.send('stream-log', `[抖音Cookie] 完整Cookie: ${cookieStr}`)
            event.sender.send('stream-log', `[抖音Cookie] Cookie数量: ${cookies.length}`)
          } catch (e) {
            console.log('发送Cookie到渲染端失败:', e.message)
          }
        }
        
        const headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
          'Referer': 'https://live.douyin.com',
          'Cookie': cookieStr
        }
        resolve({ success: true, headers })
      } catch (e) {
        resolve({ success: false, error: e.message })
      } finally {
        try { win.destroy() } catch (_) {}
      }
    }

    win.webContents.on('did-finish-load', () => {
      // 页面加载完成后再读 Cookie
      finish()
    })

    win.webContents.on('did-fail-load', () => {
      finish()
    })
  })
}

ipcMain.handle('douyin-headers-auto', async (event, roomId) => {
  console.log('[DOUYIN] 开始自动获取Cookie，直播间ID:', roomId)
  
  // 清理之前的抖音数据，确保使用新的直播间ID
  douyinSessionHeaders = null
  capturedDouyinData = {
    apiUrl: null,
    cookies: null,
    headers: null
  }
  
  const ret = await getDouyinHeadersByHiddenWindow(roomId, event)
  if (ret && ret.success && ret.headers) {
    douyinSessionHeaders = ret.headers
    try {
      event.sender.send('stream-log', `[DOUYIN][headers] ${JSON.stringify(ret.headers)}`)
    } catch (_) {}
  }
  return ret
})

// 获取虎牙直播流链接（简化实现，因为MHY_Scanner中也被注释掉了）
async function getHuyaStreamLink(roomId) {
  try {
    const axios = require('axios')
    
    // 虎牙的实现比较复杂，而且MHY_Scanner中也注释掉了
    // 这里提供一个基础的实现框架
    const headers = {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      'Accept-Encoding': ''
    }
    
    const url = `https://m.huya.com/${roomId}`
    
    console.log('请求虎牙直播间信息:', url)
    
    try {
      const response = await axios.get(url, { headers })
      const html = response.data
      
      // 尝试从HTML中提取直播流信息
      // 这里需要解析HTML中的JavaScript变量
      console.log('虎牙页面获取成功，HTML长度:', html.length)
      
      // 由于虎牙的实现比较复杂，暂时返回一个提示
      return { success: false, error: '虎牙直播流获取功能需要更复杂的实现，暂时不支持' }
      
    } catch (error) {
      console.error('虎牙API请求失败:', error.message)
      return { success: false, error: `虎牙API请求失败: ${error.message}` }
    }
  } catch (error) {
    console.error('获取虎牙直播流链接失败:', error)
    return { success: false, error: error.message }
  }
}

// 捕获直播流帧 - 完全模仿MHY_Scanner使用FFmpeg
ipcMain.handle('capture-stream-frame', async (event, streamUrl, headers) => {
  try {
    console.log('主进程收到捕获直播流帧请求:', { streamUrl, headers })
    
    const { spawn } = require('child_process')
    const path = require('path')
    const fs = require('fs')
    const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
    
    console.log('FFmpeg路径:', ffmpegPath)
    
    return new Promise((resolve) => {
      try {
        // 创建临时文件路径
        const tempDir = require('os').tmpdir()
        const tempImagePath = path.join(tempDir, `frame_${Date.now()}.png`)
        
        // 构建FFmpeg命令，完全模仿MHY_Scanner
        const args = [
          '-i', streamUrl,
          '-vframes', '1', // 只提取一帧
          '-f', 'image2', // 输出为图像
          '-vcodec', 'png', // PNG格式
          '-pix_fmt', 'rgb24', // RGB24像素格式
          '-y', // 覆盖输出文件
          tempImagePath
        ]
        
        // 添加请求头
        if (headers && Object.keys(headers).length > 0) {
          const headerStrings = Object.entries(headers).map(([k, v]) => `${k}: ${v}`)
          args.unshift('-headers', headerStrings.join('\r\n'))
        }
        
        console.log('FFmpeg命令:', ffmpegPath, args.join(' '))
        
        // 启动FFmpeg进程
        const ffmpegProcess = spawn(ffmpegPath, args)
        
        let errorOutput = ''
        
        ffmpegProcess.stderr.on('data', (data) => {
          const output = data.toString()
          errorOutput += output
          console.log('FFmpeg输出:', output.trim())
        })
        
        ffmpegProcess.on('close', (code) => {
          console.log('FFmpeg进程结束，退出码:', code)
          
          try {
            if (code === 0 && fs.existsSync(tempImagePath)) {
              // 读取生成的图像文件
              const imageBuffer = fs.readFileSync(tempImagePath)
              const base64 = imageBuffer.toString('base64')
              const dataUrl = `data:image/png;base64,${base64}`
              
              console.log('FFmpeg成功提取帧，大小:', imageBuffer.length, 'bytes')
              
              // 清理临时文件
              fs.unlinkSync(tempImagePath)
              
              resolve({
                success: true,
                dataUrl: dataUrl,
                isFlvStream: true,
                streamSize: imageBuffer.length
              })
            } else {
              console.log('FFmpeg处理失败，退出码:', code)
              console.log('错误输出:', errorOutput)
              
              // 清理临时文件
              if (fs.existsSync(tempImagePath)) {
                fs.unlinkSync(tempImagePath)
              }
              
              // 返回测试图像
              const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
              resolve({
                success: true,
                dataUrl: `data:image/png;base64,${testImageBase64}`,
                isFlvStream: false,
                streamSize: 0,
                error: `FFmpeg处理失败，退出码: ${code}`
              })
            }
          } catch (error) {
            console.error('处理FFmpeg输出失败:', error)
            const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
            resolve({
              success: true,
              dataUrl: `data:image/png;base64,${testImageBase64}`,
              isFlvStream: false,
              streamSize: 0,
              error: error.message
            })
          }
        })
        
        ffmpegProcess.on('error', (error) => {
          console.error('FFmpeg进程错误:', error)
          const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
          resolve({
            success: true,
            dataUrl: `data:image/png;base64,${testImageBase64}`,
            isFlvStream: false,
            streamSize: 0,
            error: error.message
          })
        })
        
        // 设置超时
        setTimeout(() => {
          console.log('FFmpeg处理超时，终止进程')
          ffmpegProcess.kill()
          
          const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
          resolve({
            success: true,
            dataUrl: `data:image/png;base64,${testImageBase64}`,
            isFlvStream: false,
            streamSize: 0,
            error: 'FFmpeg处理超时'
          })
        }, 15000) // 15秒超时
        
      } catch (error) {
        console.error('FFmpeg初始化失败:', error)
        const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
        resolve({
          success: true,
          dataUrl: `data:image/png;base64,${testImageBase64}`,
          isFlvStream: false,
          streamSize: 0,
          error: error.message
        })
      }
    })
    
  } catch (error) {
    console.error('捕获直播流帧失败:', error.message)
    return { success: false, error: error.message }
  }
})

// 防止多实例运行
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // 当运行第二个实例时，将焦点放到主窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}
