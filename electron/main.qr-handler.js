// 主进程：注册识别二维码的 IPC 处理，并把重活放到 worker_threads
const { ipcMain } = require('electron')
const { Worker, isMainThread } = require('worker_threads')
const path = require('path')

let qrWorker = null
let workerReady = false

function ensureWorker() {
  if (qrWorker && workerReady) return qrWorker
  const workerPath = path.join(__dirname, 'qrWorker.js')
  qrWorker = new Worker(workerPath)
  qrWorker.on('message', (msg) => {
    if (msg && msg.type === 'ready') workerReady = true
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
  ensureWorker()
  ipcMain.handle('detect-qr', async (_event, data, meta) => {
    try {
      ensureWorker()
      if (!qrWorker || !workerReady) {
        return { success: false, error: 'worker-not-ready' }
      }

      const payload = {
        type: 'detect',
        codec: meta?.codec || 'png',
        width: meta?.width,
        height: meta?.height,
        // 将 ArrayBuffer/Buffer 直接传给 worker，避免 JSON 序列化
        buffer: Buffer.isBuffer(data) ? data : Buffer.from(new Uint8Array(data))
      }

      const result = await new Promise((resolve, reject) => {
        const onMessage = (msg) => {
          if (!msg || msg.type !== 'detect-result') return
          qrWorker.off('message', onMessage)
          resolve(msg.result)
        }
        qrWorker.on('message', onMessage)
        try {
          qrWorker.postMessage(payload, [payload.buffer.buffer])
        } catch (e) {
          qrWorker.off('message', onMessage)
          reject(e)
        }
      })

      return result
    } catch (e) {
      console.error('[detect-qr] failed:', e)
      return { success: false, error: e?.message || String(e) }
    }
  })
}

module.exports = { registerQRHandler }


