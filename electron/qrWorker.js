// 工作线程：优先使用 sharp 解码图像为 RGBA，再使用 jsQR 识别
const { parentPort } = require('worker_threads')

let sharp = null
let jsQR = null
let zxing = null
try { sharp = require('sharp') } catch (_) { sharp = null }
try { jsQR = require('jsqr') } catch (_) { jsQR = null }
try { zxing = require('@sec-ant/zxing-wasm') } catch (_) { zxing = null }

parentPort.postMessage({ type: 'ready' })

async function decodeWithSharp(buffer) {
  if (!sharp) throw new Error('sharp-not-available')
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { rgba: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), width: info.width, height: info.height }
}

function detectWithJsqr(rgba, width, height) {
  if (!jsQR) throw new Error('jsqr-not-available')
  const code = jsQR(rgba, width, height, { inversionAttempts: 'attemptBoth', returnDetailedDetectionResult: true })
  if (code && code.data && code.data.length > 0) {
    return { success: true, text: code.data, location: code.location }
  }
  return { success: false }
}

async function detectWithZxing(buffer) {
  if (!zxing) throw new Error('zxing-not-available')
  // 适配 @sec-ant/zxing-wasm 的常见 API 形态
  try {
    // 情形1：提供 readBarcodeFromImageBuffer
    if (typeof zxing.readBarcodeFromImageBuffer === 'function') {
      const out = await zxing.readBarcodeFromImageBuffer(buffer)
      if (out && out.text) return { success: true, text: out.text }
      return { success: false }
    }
  } catch (e) {
    // 继续尝试其他形态
  }
  try {
    // 情形2：需要先创建实例
    if (typeof zxing.ZXing === 'function') {
      const inst = await zxing.ZXing()
      if (inst && typeof inst.readBarcodeFromImageBuffer === 'function') {
        const out = await inst.readBarcodeFromImageBuffer(buffer)
        if (out && out.text) return { success: true, text: out.text }
        return { success: false }
      }
    }
  } catch (e) {
    // 忽略并继续回退
  }
  throw new Error('zxing-interface-not-supported')
}

parentPort.on('message', async (msg) => {
  if (!msg || msg.type !== 'detect') return
  try {
    const input = Buffer.isBuffer(msg.buffer) ? msg.buffer : Buffer.from(msg.buffer)

    // 优先使用 zxing-cpp (wasm)
    if (zxing) {
      try {
        const zres = await detectWithZxing(input)
        if (zres && zres.success) {
          return parentPort.postMessage({ type: 'detect-result', result: zres })
        }
      } catch (_) {}
    }

    // 回退：使用 sharp 解码 + jsQR
    const { rgba, width, height } = await decodeWithSharp(input)
    const jres = detectWithJsqr(rgba, width, height)
    parentPort.postMessage({ type: 'detect-result', result: jres })
  } catch (e) {
    parentPort.postMessage({ type: 'detect-result', result: { success: false, error: e?.message || String(e) } })
  }
})


