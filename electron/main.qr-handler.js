// 主进程：注册识别二维码的 IPC 处理，并把重活放到 worker_threads
const { ipcMain, BrowserWindow } = require('electron')
const { Worker, isMainThread } = require('worker_threads')
const path = require('path')

let qrWorker = null
let workerReady = false

function ensureWorker() {
  if (qrWorker && workerReady) return qrWorker
  console.log('[QR-Worker] 创建新的Worker实例')
  const workerPath = path.join(__dirname, 'qrWorker.js')
  qrWorker = new Worker(workerPath)
  qrWorker.on('message', (msg) => {
    console.log('[QR-Worker] 收到消息:', msg)
    if (msg && msg.type === 'ready') {
      workerReady = true
      console.log('[QR-Worker] Worker已就绪')
    } else if (msg && msg.type === 'log') {
      // 转发Worker日志到渲染进程
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('worker-log', {
          level: msg.level,
          message: msg.message,
          timestamp: msg.timestamp
        })
      }
    }
  })
  qrWorker.on('error', (err) => {
    workerReady = false
    console.error('[QR-Worker] error:', err)
  })
  qrWorker.on('exit', (code) => {
    workerReady = false
    qrWorker = null
    console.warn('[QR-Worker] exit with code', code)
  })
  return qrWorker
}

function registerQRHandler() {
  console.log('[QR-Handler] 注册二维码识别处理器')
  ensureWorker()
  ipcMain.handle('detect-qr', async (_event, data, meta) => {
    try {
      console.log('[detect-qr] 收到识别请求，数据长度:', data?.length, 'meta:', meta)
      ensureWorker()
      if (!qrWorker || !workerReady) {
        console.log('[detect-qr] Worker未就绪，等待中...')
        // 等待Worker就绪，最多等待3秒
        let waitCount = 0
        while (!workerReady && waitCount < 30) {
          await new Promise(resolve => setTimeout(resolve, 100))
          waitCount++
        }
        if (!workerReady) {
          console.log('[detect-qr] Worker等待超时')
          return { success: false, error: 'worker-timeout' }
        }
      }

      const payload = {
        type: 'detect',
        codec: meta?.codec || 'png',
        width: meta?.width,
        height: meta?.height,
        // 将 ArrayBuffer/Buffer 直接传给 worker，避免 JSON 序列化
        buffer: Buffer.isBuffer(data) ? data : Buffer.from(new Uint8Array(data))
      }
      console.log('[detect-qr] 发送到Worker，buffer长度:', payload.buffer.length)

      const result = await new Promise((resolve, reject) => {
        const onMessage = (msg) => {
          if (!msg || msg.type !== 'detect-result') return
          qrWorker.off('message', onMessage)
          console.log('[detect-qr] Worker返回结果:', msg.result)
          resolve(msg.result)
        }
        qrWorker.on('message', onMessage)
        try {
          qrWorker.postMessage(payload, [payload.buffer.buffer])
        } catch (e) {
          qrWorker.off('message', onMessage)
          console.log('[detect-qr] 发送到Worker失败:', e)
          reject(e)
        }
      })

      console.log('[detect-qr] 最终结果:', result)
      return result
    } catch (e) {
      console.error('[detect-qr] failed:', e)
      return { success: false, error: e?.message || String(e) }
    }
  })
}

module.exports = { registerQRHandler }


