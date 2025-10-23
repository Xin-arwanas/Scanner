// 工作线程：优先使用 sharp 解码图像为 RGBA，再使用 jsQR 识别
const { parentPort } = require('worker_threads')

let sharp = null
let jsQR = null
let zxing = null

try { 
  sharp = require('sharp') 
  console.log('[QR-Worker] Sharp加载成功')
} catch (e) { 
  sharp = null 
  console.log('[QR-Worker] Sharp加载失败:', e.message)
}

try { 
  jsQR = require('jsqr') 
  console.log('[QR-Worker] jsQR加载成功')
} catch (e) { 
  jsQR = null 
  console.log('[QR-Worker] jsQR加载失败:', e.message)
}

try { 
  // 使用新的 zxing-wasm 包
  zxing = require('zxing-wasm') 
  console.log('[QR-Worker] ZXing模块加载成功，类型:', typeof zxing)
  console.log('[QR-Worker] ZXing可用方法:', Object.keys(zxing || {}))
} catch (e) { 
  zxing = null 
  console.log('[QR-Worker] ZXing加载失败:', e.message)
}

// 自定义日志函数，将日志发送到主进程
function logToMain(level, ...args) {
  const message = args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg, null, 2)
      } catch (e) {
        return String(arg)
      }
    }
    return String(arg)
  }).join(' ')
  
  parentPort.postMessage({ 
    type: 'log', 
    level, 
    message: `${message}`,
    timestamp: new Date().toISOString()
  })
}

// 重写console方法
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info
}

console.log = (...args) => {
  originalConsole.log.apply(console, args)
  logToMain('info', ...args)
}

console.warn = (...args) => {
  originalConsole.warn.apply(console, args)
  logToMain('warning', ...args)
}

console.error = (...args) => {
  originalConsole.error.apply(console, args)
  logToMain('error', ...args)
}

console.info = (...args) => {
  originalConsole.info.apply(console, args)
  logToMain('info', ...args)
}

console.log('[QR-Worker] Worker启动，依赖检查:')
console.log('  - Sharp:', !!sharp)
console.log('  - jsQR:', !!jsQR)
console.log('  - ZXing:', !!zxing)

// 详细检查ZXing
if (zxing) {
  console.log('[QR-Worker] ZXing详细检查:')
  console.log('  - 类型:', typeof zxing)
  console.log('  - 是否为对象:', zxing && typeof zxing === 'object')
  console.log('  - 可用属性:', Object.keys(zxing || {}))
  console.log('  - 有readBarcodeFromImageBuffer:', typeof zxing.readBarcodeFromImageBuffer === 'function')
  console.log('  - 有ZXing构造函数:', typeof zxing.ZXing === 'function')
  console.log('  - 有readBarcode:', typeof zxing.readBarcode === 'function')
  
  // 尝试检查ZXing的版本信息
  if (zxing.version) {
    console.log('  - 版本:', zxing.version)
  }
  if (zxing.VERSION) {
    console.log('  - VERSION:', zxing.VERSION)
  }
} else {
  console.log('[QR-Worker] ZXing未加载，可能的原因:')
  console.log('  - 模块未安装')
  console.log('  - 模块路径问题')
  console.log('  - Worker线程限制')
}

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
  if (!zxing) {
    console.log('[QR-Worker] ZXing未加载，无法使用')
    throw new Error('zxing-not-available')
  }
  
  // console.log('[QR-Worker] ZXing对象详情:', {
  //   type: typeof zxing,
  //   isObject: zxing && typeof zxing === 'object',
  //   keys: zxing ? Object.keys(zxing) : [],
  //   hasReadBarcodes: typeof zxing.readBarcodes === 'function',
  //   hasReadBarcodesFromImageData: typeof zxing.readBarcodesFromImageData === 'function',
  //   hasReadBarcodesFromImageFile: typeof zxing.readBarcodesFromImageFile === 'function'
  // })
  
  // 使用新的 zxing-wasm API
  try {
    // 情形1：使用 readBarcodesFromImageData (推荐)
    if (typeof zxing.readBarcodesFromImageData === 'function') {
      console.log('[QR-Worker] 尝试ZXing readBarcodesFromImageData方式')
      
      // 需要将Buffer转换为ImageData格式
      // 先尝试用Sharp解码图像获取RGBA数据
      if (sharp) {
        try {
          const { data, info } = await sharp(buffer)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true })
          
          const imageData = {
            data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
            width: info.width,
            height: info.height
          }
          
          console.log('[QR-Worker] 图像数据准备完成，尺寸:', info.width, 'x', info.height)
          const results = await zxing.readBarcodesFromImageData(imageData)
          // console.log('[QR-Worker] ZXing readBarcodesFromImageData结果:', results)
          
          if (results && results.length > 0 && results[0].text) {
            return { success: true, text: results[0].text }
          }
          return { success: false }
        } catch (sharpError) {
          console.log('[QR-Worker] Sharp解码失败，尝试其他方式:', sharpError.message)
        }
      }
    }
  } catch (e) {
    console.log('[QR-Worker] ZXing readBarcodesFromImageData失败:', e.message)
  }
  
  try {
    // 情形2：使用 readBarcodes (直接处理Buffer)
    if (typeof zxing.readBarcodes === 'function') {
      console.log('[QR-Worker] 尝试ZXing readBarcodes方式')
      const results = await zxing.readBarcodes(buffer)
      console.log('[QR-Worker] ZXing readBarcodes结果:', results)
      
      if (results && results.length > 0 && results[0].text) {
        return { success: true, text: results[0].text }
      }
      return { success: false }
    }
  } catch (e) {
    console.log('[QR-Worker] ZXing readBarcodes失败:', e.message)
  }
  
  console.log('[QR-Worker] ZXing所有尝试都失败，接口不支持')
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
        }else{
          return parentPort.postMessage({ type: 'detect-result', result: { success: false, error: zres?.error || '未识别到二维码' } })
        }
      } catch (e) {
        console.log('[QR-Worker] ZXing识别失败:', e.message)
      }
    } else {
      console.log('[QR-Worker] ZXing不可用')
      parentPort.postMessage({ type: 'detect-result', result: { success: false, error: 'zxing-not-available' } })
    }

    // 回退：使用 sharp 解码 + jsQR
  //   console.log('[QR-Worker] 回退到Sharp+jsQR识别')
  //   const { rgba, width, height } = await decodeWithSharp(input)
  //   console.log('[QR-Worker] Sharp解码完成，尺寸:', width, 'x', height, 'RGBA长度:', rgba.length)
    
  //   // 使用Sharp解码后的实际尺寸，而不是传递的元信息尺寸
  //   const jres = detectWithJsqr(rgba, width, height)
  //   console.log('[QR-Worker] jsQR识别结果:', jres)
    
  //   // 如果原始尺寸识别失败，尝试不同尺寸
  //   if (!jres.success) {
  //     console.log('[QR-Worker] 原始尺寸识别失败，尝试不同尺寸...')
  //     const targetSizes = [
  //       { width: 320, height: 240 },   // 0.5x
  //       { width: 480, height: 360 },   // 0.75x  
  //       { width: 640, height: 480 },   // 原始尺寸
  //       { width: 800, height: 600 },   // 1.25x
  //       { width: 1024, height: 768 },  // 1.5x
  //       { width: 1280, height: 960 }   // 2x
  //     ]
      
  //     for (const size of targetSizes) {
  //       try {
  //         console.log(`[QR-Worker] 尝试Sharp缩放尺寸: ${size.width}x${size.height}`)
  //         const { rgba: scaledRgba, width: newWidth, height: newHeight } = await decodeWithSharpResized(input, size.width, size.height)
          
  //         const scaledRes = detectWithJsqr(scaledRgba, newWidth, newHeight)
  //         console.log(`[QR-Worker] Sharp缩放尺寸 ${size.width}x${size.height} 识别结果:`, scaledRes)
          
  //         if (scaledRes.success) {
  //           console.log('[QR-Worker] Sharp缩放图像识别成功！')
  //           parentPort.postMessage({ type: 'detect-result', result: scaledRes })
  //           return
  //         }
  //       } catch (e) {
  //         console.log(`[QR-Worker] Sharp缩放尺寸 ${size.width}x${size.height} 失败:`, e.message)
  //       }
  //     }
  //   }
    
  //   parentPort.postMessage({ type: 'detect-result', result: jres })
  } catch (e) {
    console.log('[QR-Worker] 识别异常:', e.message)
    parentPort.postMessage({ type: 'detect-result', result: { success: false, error: e?.message || String(e) } })
  }
})


