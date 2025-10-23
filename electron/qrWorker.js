// 工作线程：优先使用 sharp 解码图像为 RGBA，再使用 jsQR 识别
const { parentPort } = require('worker_threads')

let sharp = null
let jsQR = null
let zxing = null
try { sharp = require('sharp') } catch (_) { sharp = null }
try { jsQR = require('jsqr') } catch (_) { jsQR = null }
try { zxing = require('@sec-ant/zxing-wasm') } catch (_) { zxing = null }

console.log('[QR-Worker] Worker启动，依赖检查:')
console.log('  - Sharp:', !!sharp)
console.log('  - jsQR:', !!jsQR)
console.log('  - ZXing:', !!zxing)
parentPort.postMessage({ type: 'ready' })

async function decodeWithSharp(buffer) {
  if (!sharp) throw new Error('sharp-not-available')
  console.log('[QR-Worker] Sharp解码开始，输入buffer长度:', buffer.length)
  try {
    // 先检查图像信息
    const imageInfo = await sharp(buffer).metadata()
    console.log('[QR-Worker] 图像信息:', imageInfo)
    
    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    console.log('[QR-Worker] Sharp解码成功，输出尺寸:', info.width, 'x', info.height, '通道数:', info.channels)
    return { rgba: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), width: info.width, height: info.height }
  } catch (e) {
    console.log('[QR-Worker] Sharp解码失败:', e.message)
    throw e
  }
}

async function decodeWithSharpResized(buffer, targetWidth, targetHeight) {
  if (!sharp) throw new Error('sharp-not-available')
  console.log(`[QR-Worker] Sharp缩放解码开始，目标尺寸: ${targetWidth}x${targetHeight}`)
  try {
    const { data, info } = await sharp(buffer)
      .resize(targetWidth, targetHeight, { 
        kernel: sharp.kernel.nearest,
        fit: 'fill'
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    console.log(`[QR-Worker] Sharp缩放解码成功，输出尺寸: ${info.width}x${info.height}`)
    return { rgba: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), width: info.width, height: info.height }
  } catch (e) {
    console.log('[QR-Worker] Sharp缩放解码失败:', e.message)
    throw e
  }
}

function detectWithJsqr(rgba, width, height) {
  if (!jsQR) throw new Error('jsqr-not-available')
  console.log('[QR-Worker] jsQR识别开始，RGBA长度:', rgba.length, '尺寸:', width, 'x', height)
  
  // 验证数据完整性
  const expectedLength = width * height * 4
  if (rgba.length !== expectedLength) {
    console.log('[QR-Worker] RGBA数据长度不匹配，期望:', expectedLength, '实际:', rgba.length)
    return { success: false, error: 'rgba-length-mismatch' }
  }
  
  // 检查图像是否包含有效内容（不是全黑或全白）
  let hasVariation = false
  let minValue = 255
  let maxValue = 0
  for (let i = 0; i < Math.min(rgba.length, 10000); i += 4) {
    const r = rgba[i]
    const g = rgba[i + 1]
    const b = rgba[i + 2]
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    minValue = Math.min(minValue, gray)
    maxValue = Math.max(maxValue, gray)
    if (maxValue - minValue > 50) {
      hasVariation = true
      break
    }
  }
  console.log('[QR-Worker] 图像质量检查 - 最小值:', minValue, '最大值:', maxValue, '有变化:', hasVariation)
  
  // 尝试多种识别参数和图像预处理
  const attempts = [
    { inversionAttempts: 'attemptBoth' },
    { inversionAttempts: 'dontInvert' },
    { inversionAttempts: 'invertOnly' }
  ]
  
  // 创建多种增强版本的图像数据
  const enhancedRgba = new Uint8ClampedArray(rgba.length)
  const highContrastRgba = new Uint8ClampedArray(rgba.length)
  const binaryRgba = new Uint8ClampedArray(rgba.length)
  
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i]
    const g = rgba[i + 1]
    const b = rgba[i + 2]
    const a = rgba[i + 3]
    
    // 计算灰度值
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    
    // 增强对比度版本
    const enhanced = gray < 128 ? Math.max(0, gray - 30) : Math.min(255, gray + 30)
    enhancedRgba[i] = enhanced
    enhancedRgba[i + 1] = enhanced
    enhancedRgba[i + 2] = enhanced
    enhancedRgba[i + 3] = a
    
    // 高对比度版本
    const highContrast = gray < 128 ? 0 : 255
    highContrastRgba[i] = highContrast
    highContrastRgba[i + 1] = highContrast
    highContrastRgba[i + 2] = highContrast
    highContrastRgba[i + 3] = a
    
    // 二值化版本
    const binary = gray < 180 ? 0 : 255
    binaryRgba[i] = binary
    binaryRgba[i + 1] = binary
    binaryRgba[i + 2] = binary
    binaryRgba[i + 3] = a
  }
  
  // 先尝试原始图像
  for (let i = 0; i < attempts.length; i++) {
    const options = attempts[i]
    console.log(`[QR-Worker] jsQR原始图像尝试 ${i + 1}/${attempts.length}，参数:`, options)
    
    const code = jsQR(rgba, width, height, options)
    console.log(`[QR-Worker] jsQR原始图像尝试 ${i + 1} 结果:`, code)
    
    if (code && code.data && code.data.length > 0) {
      console.log('[QR-Worker] jsQR原始图像识别成功，文本长度:', code.data.length)
      return { success: true, text: code.data, location: code.location }
    }
  }
  
  // 尝试增强图像
  for (let i = 0; i < attempts.length; i++) {
    const options = attempts[i]
    console.log(`[QR-Worker] jsQR增强图像尝试 ${i + 1}/${attempts.length}，参数:`, options)
    
    const code = jsQR(enhancedRgba, width, height, options)
    console.log(`[QR-Worker] jsQR增强图像尝试 ${i + 1} 结果:`, code)
    
    if (code && code.data && code.data.length > 0) {
      console.log('[QR-Worker] jsQR增强图像识别成功，文本长度:', code.data.length)
      return { success: true, text: code.data, location: code.location }
    }
  }
  
  // 尝试高对比度图像
  for (let i = 0; i < attempts.length; i++) {
    const options = attempts[i]
    console.log(`[QR-Worker] jsQR高对比度图像尝试 ${i + 1}/${attempts.length}，参数:`, options)
    
    const code = jsQR(highContrastRgba, width, height, options)
    console.log(`[QR-Worker] jsQR高对比度图像尝试 ${i + 1} 结果:`, code)
    
    if (code && code.data && code.data.length > 0) {
      console.log('[QR-Worker] jsQR高对比度图像识别成功，文本长度:', code.data.length)
      return { success: true, text: code.data, location: code.location }
    }
  }
  
  // 尝试二值化图像
  for (let i = 0; i < attempts.length; i++) {
    const options = attempts[i]
    console.log(`[QR-Worker] jsQR二值化图像尝试 ${i + 1}/${attempts.length}，参数:`, options)
    
    const code = jsQR(binaryRgba, width, height, options)
    console.log(`[QR-Worker] jsQR二值化图像尝试 ${i + 1} 结果:`, code)
    
    if (code && code.data && code.data.length > 0) {
      console.log('[QR-Worker] jsQR二值化图像识别成功，文本长度:', code.data.length)
      return { success: true, text: code.data, location: code.location }
    }
  }
  
  // 注意：Sharp缩放尝试已移到主循环中，这里不再重复
  
  console.log('[QR-Worker] jsQR所有尝试都失败，无二维码')
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
    console.log('[QR-Worker] 收到识别请求，buffer长度:', msg.buffer?.length, 'codec:', msg.codec)
    const input = Buffer.isBuffer(msg.buffer) ? msg.buffer : Buffer.from(msg.buffer)

    // 优先使用 zxing-cpp (wasm)
    if (zxing) {
      try {
        console.log('[QR-Worker] 尝试使用ZXing识别')
        const zres = await detectWithZxing(input)
        console.log('[QR-Worker] ZXing识别结果:', zres)
        if (zres && zres.success) {
          return parentPort.postMessage({ type: 'detect-result', result: zres })
        }
      } catch (e) {
        console.log('[QR-Worker] ZXing识别失败:', e.message)
      }
    } else {
      console.log('[QR-Worker] ZXing不可用')
    }

    // 回退：使用 sharp 解码 + jsQR
    console.log('[QR-Worker] 回退到Sharp+jsQR识别')
    const { rgba, width, height } = await decodeWithSharp(input)
    console.log('[QR-Worker] Sharp解码完成，尺寸:', width, 'x', height, 'RGBA长度:', rgba.length)
    
    // 使用Sharp解码后的实际尺寸，而不是传递的元信息尺寸
    const jres = detectWithJsqr(rgba, width, height)
    console.log('[QR-Worker] jsQR识别结果:', jres)
    
    // 如果原始尺寸识别失败，尝试不同尺寸
    if (!jres.success) {
      console.log('[QR-Worker] 原始尺寸识别失败，尝试不同尺寸...')
      const targetSizes = [
        { width: 320, height: 240 },   // 0.5x
        { width: 480, height: 360 },   // 0.75x  
        { width: 640, height: 480 },   // 原始尺寸
        { width: 800, height: 600 },   // 1.25x
        { width: 1024, height: 768 },  // 1.5x
        { width: 1280, height: 960 }   // 2x
      ]
      
      for (const size of targetSizes) {
        try {
          console.log(`[QR-Worker] 尝试Sharp缩放尺寸: ${size.width}x${size.height}`)
          const { rgba: scaledRgba, width: newWidth, height: newHeight } = await decodeWithSharpResized(input, size.width, size.height)
          
          const scaledRes = detectWithJsqr(scaledRgba, newWidth, newHeight)
          console.log(`[QR-Worker] Sharp缩放尺寸 ${size.width}x${size.height} 识别结果:`, scaledRes)
          
          if (scaledRes.success) {
            console.log('[QR-Worker] Sharp缩放图像识别成功！')
            parentPort.postMessage({ type: 'detect-result', result: scaledRes })
            return
          }
        } catch (e) {
          console.log(`[QR-Worker] Sharp缩放尺寸 ${size.width}x${size.height} 失败:`, e.message)
        }
      }
    }
    
    parentPort.postMessage({ type: 'detect-result', result: jres })
  } catch (e) {
    console.log('[QR-Worker] 识别异常:', e.message)
    parentPort.postMessage({ type: 'detect-result', result: { success: false, error: e?.message || String(e) } })
  }
})


