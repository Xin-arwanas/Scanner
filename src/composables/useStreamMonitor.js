import { ref, computed } from 'vue'
import jsQR from 'jsqr'
import { useSettingsStore } from '../stores/settings'

// FFmpeg路径配置
const FFMPEG_PATH = './ffmpeg/bin/ffmpeg.exe'

// 直播流扫描功能
export function useStreamMonitor() {
  const isScanningStream = ref(false)
  const streamInterval = ref(null)
  const retryCount = ref(0)
  const maxRetries = 3
  const isProcessingQR = ref(false) // 防止重复处理二维码
  const lastProcessedTicket = ref('') // 记录最后处理的ticket
  const detectionStats = ref({
    totalAttempts: 0,
    successfulDetections: 0,
    failedDetections: 0
  })

  // 游戏类型映射（完全模仿MHY_Scanner）
  const setGameType = {
    '8F3': () => {
      gameType = 'bh3'
      scanUrl = 'https://api-sdk.mihoyo.com/bh3_cn/combo/panda/qrcode/scan'
      confirmUrl = 'https://api-sdk.mihoyo.com/bh3_cn/combo/panda/qrcode/confirm'
    },
    '9E&': () => {
      gameType = 'hk4e'
      scanUrl = 'https://api-sdk.mihoyo.com/hk4e_cn/combo/panda/qrcode/scan'
      confirmUrl = 'https://api-sdk.mihoyo.com/hk4e_cn/combo/panda/qrcode/confirm'
    },
    '8F%': () => {
      gameType = 'hkrpg'
      scanUrl = 'https://api-sdk.mihoyo.com/hkrpg_cn/combo/panda/qrcode/scan'
      confirmUrl = 'https://api-sdk.mihoyo.com/hkrpg_cn/combo/panda/qrcode/confirm'
    },
    '%BA': () => {
      gameType = 'zzz'
      scanUrl = 'https://api-sdk.mihoyo.com/nap_cn/combo/panda/qrcode/scan'
      confirmUrl = 'https://api-sdk.mihoyo.com/nap_cn/combo/panda/qrcode/confirm'
    }
  }

  let gameType = ''
  let scanUrl = ''
  let confirmUrl = ''
  let lastTicket = ''
  const settingsStore = useSettingsStore()

  /**
   * 开始直播流扫描
   * @param {string} platform - 直播平台 (bilibili, douyin, huya)
   * @param {string} roomId - 直播间ID
   * @param {Object} account - 当前账号
   * @param {Function} onQRDetected - 二维码检测回调
   * @param {Function} onLoginConfirm - 登录确认回调
   * @param {Function} onAutoLogin - 自动登录回调
   */
  const startStreamScan = async (platform, roomId, account, onQRDetected, onLoginConfirm, onAutoLogin) => {
    // 如果已经在扫描，先停止之前的扫描
    if (isScanningStream.value) {
      console.log('检测到正在扫描，先停止之前的扫描...')
      await stopStreamScan()
    }

    // 重置检测统计
    detectionStats.value = {
      totalAttempts: 0,
      successfulDetections: 0,
      failedDetections: 0
    }

    // 如果是官服账号，先获取新的gameToken（完全模仿MHY_Scanner）
    console.log('当前账号信息:', account)
    
    try {
      if (account && account.loginData) {
        // 情况1：如果已有stoken和mid，使用它们获取新的gameToken
        if (account.loginData.stoken && account.loginData.mid) {
          try {
            console.log('使用stoken和mid获取新的gameToken...')
            const newGameToken = await window.electronAPI.mihoyoGetGameTokenByStoken(
              account.loginData.stoken, 
              account.loginData.mid
            )
            if (newGameToken) {
              console.log('获取到新的gameToken:', newGameToken)
              // 更新账号的gameToken
              account.loginData.gameToken = newGameToken
            } else {
              console.error('获取gameToken失败，使用原有token')
            }
          } catch (error) {
            console.error('获取gameToken失败:', error)
          }
        }
        // 情况2：如果没有stoken但有gameToken，先获取stoken和mid
        else if (account.loginData.gameToken && !account.loginData.stoken) {
          try {
            console.log('使用gameToken获取stoken和mid...')
            const stokenData = await window.electronAPI.mihoyoGetStokenByGameToken(
              account.uid, 
              account.loginData.gameToken
            )
            if (stokenData) {
              console.log('获取到stoken数据:', stokenData)
              // 更新账号的stoken和mid
              account.loginData.stoken = stokenData.stoken
              account.loginData.mid = stokenData.mid
              
              // 然后使用stoken获取新的gameToken
              console.log('使用新获取的stoken和mid获取gameToken...')
              const newGameToken = await window.electronAPI.mihoyoGetGameTokenByStoken(
                stokenData.stoken, 
                stokenData.mid
              )
              if (newGameToken) {
                console.log('获取到新的gameToken:', newGameToken)
                account.loginData.gameToken = newGameToken
              }
            } else {
              console.error('获取stoken失败，gameToken可能已失效')
              // 如果获取stoken失败，说明gameToken已失效，需要重新登录
              throw new Error('登录状态失效，请重新登录')
            }
          } catch (error) {
            console.error('获取stoken失败:', error)
            // 如果是登录失效错误，直接抛出
            if (error.message && error.message.includes('登录状态失效')) {
              throw error
            }
            // 其他错误也抛出，让上层处理
            throw new Error('账号登录凭证失效，请重新添加账号')
          }
        }
        // 情况3：既没有stoken也没有gameToken，无法进行扫描
        else {
          console.error('账号缺少必要的登录凭证，无法进行扫描')
          throw new Error('账号缺少必要的登录凭证，请重新添加账号')
        }
      }
    } catch (error) {
      console.error('账号验证失败:', error)
      // 显示错误提示给用户
      alert(`账号验证失败：${error.message}\n\n请重新添加账号或检查网络连接。`)
      return
    }

    isScanningStream.value = true
    isProcessingQR.value = false // 重置处理标志位
    lastProcessedTicket.value = '' // 重置最后处理的ticket
    console.log('开始直播流扫描...', { platform, roomId })

    // 获取直播流链接
    try {
      // 抖音：先用隐藏窗口自动获取 Cookie，再请求真实流地址
      if (platform && platform.toLowerCase() === 'douyin') {
        console.log('开始为抖音直播间获取Cookie:', roomId)
        const hdr = await window.electronAPI.douyinHeadersAuto(roomId)
        if (hdr && hdr.success && hdr.headers) {
          console.log('已自动获取抖音Cookie，headers:', hdr.headers)
        } else {
          console.warn('自动获取抖音Cookie失败，将尝试直接请求:', hdr?.error || '未知错误')
        }
      }

      const streamData = await getStreamLink(platform, roomId)
      if (!streamData.success) {
        throw new Error(streamData.error || '获取直播流链接失败')
      }
      
      console.log('获取直播流链接成功:', streamData.url, 'type=', streamData.type, 'alt=', !!streamData.altUrl)
      
      // 开始扫描直播流
      startStreamFrameCapture({
        url: streamData.url,
        altUrl: streamData.altUrl,
        type: streamData.type,
        headers: streamData.headers
      }, account, onQRDetected, onLoginConfirm, onAutoLogin)
      
    } catch (error) {
      console.error('直播流扫描错误:', error)
      isScanningStream.value = false
      try {
        alert(`直播流扫描启动失败：${error?.message || error}\n\n请检查：\n- 直播间是否开播\n- URL/Headers/Cookie 是否有效\n- 网络连接与FFmpeg是否可用`)
      } catch (_) {}
      throw new Error('直播流扫描错误:', error)
    }
  }

  /**
   * 获取直播流链接
   * @param {string} platform - 直播平台
   * @param {string} roomId - 直播间ID
   */
  const getStreamLink = async (platform, roomId) => {
    try {
      // 调用主进程获取直播流链接
      const result = await window.electronAPI.getStreamLink(platform, roomId)
      return result
    } catch (error) {
      console.error('获取直播流链接失败:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 开始直播流帧捕获和二维码扫描
   * @param {string} streamUrl - 直播流URL
   * @param {Object} headers - 请求头
   * @param {Object} account - 当前账号
   * @param {Function} onQRDetected - 二维码检测回调
   * @param {Function} onLoginConfirm - 登录确认回调
   * @param {Function} onAutoLogin - 自动登录回调
   */
  const startStreamFrameCapture = async (link, account, onQRDetected, onLoginConfirm, onAutoLogin) => {
    const streamUrl = link.url
    const headers = link.headers
    const altUrl = link.altUrl
    const currentType = link.type
    const onFrame = async (payload) => {
      if (!isScanningStream.value) return
      if (!payload || !payload.success || !payload.data) return
      if (isProcessingQR.value) return // 背压：正在处理，则丢帧

      try {
        isProcessingQR.value = true
        // raw 管道仅用于验证 stdout/分帧链路是否正常
        if (payload.pipeFormat === 'raw') {
          console.log('[STREAM] 收到 raw 帧:', payload.width, 'x', payload.height, 'bytes=', payload.data.length)
          isProcessingQR.value = false
          return
        }

        // 优先走主进程识别（worker/子进程），直接使用原始二进制，避免不必要的Base64转换
        let qrResult = null
        detectionStats.value.totalAttempts++
        if (window.electronAPI && window.electronAPI.detectQRFromBuffer) {
          try {
            console.log('[STREAM] 调用主进程识别，数据长度:', payload.data.length, 'codec:', payload.codec, '尺寸:', payload.width, 'x', payload.height)
            const detectRet = await window.electronAPI.detectQRFromBuffer(
              payload.data,
              { codec: payload.codec || 'png', width: payload.width, height: payload.height }
            )
            console.log('[STREAM] 主进程识别结果:', detectRet)
            if (detectRet && detectRet.success && detectRet.text && detectRet.text.length > 0) {
              qrResult = detectRet.text
              console.log('[STREAM] 主进程识别成功:', qrResult)
            } else {
              console.log('[STREAM] 主进程识别失败或无结果:', detectRet)
            }
          } catch (e) {
            console.log('[STREAM] 主进程识别异常，将回退到渲染端:', e?.message || e)
          }
        } else {
          console.log('[STREAM] detectQRFromBuffer API 不可用')
        }
        // 回退：需要时再生成 Base64 并走渲染端 Data URL + jsQR
        // if (!qrResult) {
        //   try {
        //     const base64 = (window.electronAPI && window.electronAPI.toBase64)
        //       ? window.electronAPI.toBase64(payload.data)
        //       : (typeof Buffer !== 'undefined' ? Buffer.from(payload.data).toString('base64') : '')
        //     if (base64.length < 100) {
        //       console.log('[STREAM] Base64数据过短，可能不完整:', base64.length)
        //       isProcessingQR.value = false
        //       return
        //     }
        //     const dataUrl = `data:image/${payload.codec || 'png'};base64,${base64}`
        //     // console.log(dataUrl)
        //     if (!dataUrl.startsWith('data:image/')) {
        //       console.log('[STREAM] 无效的图片数据URL')
        //       isProcessingQR.value = false
        //       return
        //     }
        //     qrResult = await decodeQRFromBase64(dataUrl)
        //   } catch (e) {
        //     console.log('[STREAM] 二维码检测失败:', e.message)
        //   }
        // }

        isProcessingQR.value = false

        if (!qrResult) {
          // detectionStats.value.failedDetections++
          // console.log(`[统计] 检测失败 ${detectionStats.value.failedDetections}/${detectionStats.value.totalAttempts}`)
          return
        }
        // else{
        //   const a = 1
        //   if (a) {
        //     throw new Error('成功检测到二维码')
        //   }
        // }
        
        detectionStats.value.successfulDetections++
        console.log(`[统计] 检测成功 ${detectionStats.value.successfulDetections}/${detectionStats.value.totalAttempts}`)
        onQRDetected && onQRDetected(qrResult)

        if (qrResult.length < 85) return
        const gameTypeView = qrResult.substring(79, 82)
        if (!setGameType[gameTypeView]) return
        const ticket = qrResult.substring(qrResult.length - 24)
        setGameType[gameTypeView]()
        if (lastTicket === ticket) return
        if (lastProcessedTicket.value === ticket) return

        // 停止拉流，避免重复处理
        await stopStreamScan()

        isProcessingQR.value = true
        lastProcessedTicket.value = ticket
        lastTicket = ticket

        const scanResult = await performScanLogin(ticket, gameType, account.uid, account.loginData.gameToken)
        
        if (!scanResult) {
          // 扫码失败，弹窗提示错误
          try {
            alert(`二维码扫描失败！\n\n游戏类型: ${gameType}\n票据: ${ticket.substring(0, 8)}...\n\n请检查账号信息或重新扫描。`)
          } catch (_) {}
          return
        }
        
        // 扫码成功，继续处理
        const autoLogin = (settingsStore && settingsStore.isAutoLogin && typeof settingsStore.isAutoLogin.value !== 'undefined')
          ? settingsStore.isAutoLogin.value
          : !!(settingsStore && settingsStore.settings && settingsStore.settings.value && settingsStore.settings.value.autoLogin)
        if (autoLogin) {
          // 自动确认登录模式
          onAutoLogin && onAutoLogin({ ticket, gameType }, account)
        } else {
          // 手动确认登录模式，无需弹窗提示
          onLoginConfirm && onLoginConfirm({ ticket, gameType }, account)
        }
      } catch (e) {
        console.error('处理帧失败:', e)
        // 解除背压
        try { window.electronAPI.streamFrameDone() } catch (_) {}
        isProcessingQR.value = false
      }
    }

    // 订阅帧事件
    let firstFrameTs = Date.now()
    try {
      // 确保无重复监听
      try { window.electronAPI.removeAllListeners && window.electronAPI.removeAllListeners('stream-log') } catch (_) {}
      try { window.electronAPI.removeAllListeners && window.electronAPI.removeAllListeners('stream-frame') } catch (_) {}
      try { window.electronAPI.removeAllListeners && window.electronAPI.removeAllListeners('stream-frame-end') } catch (_) {}

      if (window.electronAPI.onStreamFrame) {
        window.electronAPI.onStreamFrame((payload) => {
          firstFrameTs = Date.now()
          onFrame(payload)
        })
      }
      if (window.electronAPI.onStreamFrameEnd) {
        window.electronAPI.onStreamFrameEnd(() => {
          // 拉流结束
        })
      }
      // 静默 FFmpeg 逐行日志，仅用于保活时间刷新
      if (window.electronAPI.onStreamLog) {
        window.electronAPI.onStreamLog(() => {
          firstFrameTs = Date.now()
        })
      }
    } catch (e) {
      console.warn('注册流事件监听失败:', e)
    }

    // 监听注册完成后再启动主进程持久拉流
    // 优先使用 FLV + PNG（更稳出首帧）；若当前为 HLS 且提供了 altUrl（FLV），则切到 altUrl
    const preferUrl = (currentType === 'hls' && altUrl) ? altUrl : streamUrl
    console.log('[STREAM] 选择播放URL:', preferUrl)
    const startRet = await window.electronAPI.streamPipeStart(preferUrl, headers, { fps: 2, scale: '480', codec: 'png', tlsInsecure: true,ffmpegPath: FFMPEG_PATH })
    console.log('[STREAM] pipe started')
    if (!startRet || !startRet.success) {
      console.warn('[STREAM] 启动失败')
      try { alert('直播流启动失败，可能是地址或鉴权参数无效，或FFmpeg无法访问该流。') } catch (_) {}
      isScanningStream.value = false
      throw new Error('streamPipeStart failed')
    } else {
      // 略去详细 args 打印
    }

    // 5 秒无任何帧/日志，尝试自动回退：先切换为 rawvideo 管道，其次再尝试备选流
    setTimeout(async () => {
      if (!isScanningStream.value) return
      const noFrameFor = Date.now() - firstFrameTs
      if (noFrameFor > 5000) {
        console.warn('[STREAM] 5秒内未收到帧，先尝试切换为 rawvideo 管道')
        try {
          await window.electronAPI.streamPipeStop()
          const ret = await window.electronAPI.streamPipeStart(preferUrl, headers, { pipeFormat: 'raw', rawWidth: 640, rawHeight: 360, fps: 2, tlsInsecure: true,ffmpegPath: FFMPEG_PATH })
          console.warn('[STREAM] 已切换为 rawvideo，重试拉流:', ret?.success)
        } catch (e) {
          console.warn('[STREAM] 切换 raw 失败，尝试备选流:', e)
          if (altUrl) {
            try {
              await window.electronAPI.streamPipeStop()
              await window.electronAPI.streamPipeStart(altUrl, headers, { fps: 2, scale: '480', codec: 'png', tlsInsecure: true,ffmpegPath: FFMPEG_PATH })
              console.warn('[STREAM] 已切换至备选流并使用 png:', altUrl)
        } catch (e2) {
          console.warn('[STREAM] 备选流也失败:', e2)
          try { alert('直播流拉取失败：已尝试切换raw和备选流，仍未收到帧。\n\n请检查直播间状态、网络与鉴权参数。') } catch (_) {}
          isScanningStream.value = false
          try { await window.electronAPI.streamPipeStop() } catch (_) {}
          return
        }
          } else {
            console.warn('[STREAM] 无备选流可回退，可能为 headers/权限/源无数据')
            try { alert('直播流拉取失败：5秒内未收到帧且无可用备选流。\n\n请检查Headers/Cookie或更换清晰度/线路。') } catch (_) {}
            isScanningStream.value = false
            try { await window.electronAPI.streamPipeStop() } catch (_) {}
            throw new Error('no frames and no fallback stream')
          }
        }
      }
    }, 5200)
  }

  /**
   * 停止直播流扫描
   */
  const stopStreamScan = async () => {
    if (!isScanningStream.value) {
      return
    }

    isScanningStream.value = false
    isProcessingQR.value = false // 重置处理标志位
    lastProcessedTicket.value = '' // 重置最后处理的ticket
    if (streamInterval.value) {
      clearInterval(streamInterval.value)
      streamInterval.value = null
    }
    try { await window.electronAPI.streamPipeStop() } catch (_) {}
    retryCount.value = 0 // 重置重试计数
    detectionStats.value = { // 重置检测统计
      totalAttempts: 0,
      successfulDetections: 0,
      failedDetections: 0
    }

    console.log('停止直播流扫描')
  }

  /**
   * 捕获直播流帧并解码二维码
   * @param {string} streamUrl - 直播流URL
   * @param {Object} headers - 请求头
   */
  const captureAndDecodeStreamFrame = async (streamUrl, headers) => {
    try {
      console.log('开始获取直播流帧...')
      detectionStats.value.totalAttempts++
      
      // 获取直播流帧
      const frameResponse = await window.electronAPI.captureStreamFrame(streamUrl, headers)
      if (!frameResponse || !frameResponse.success) {
        console.log('直播流帧获取失败:', frameResponse?.error || '未知错误')
        detectionStats.value.failedDetections++
        return null
      }
      
      const frameDataUrl = frameResponse.dataUrl
      if (!frameDataUrl) {
        console.log('直播流帧获取失败：未获取到数据')
        detectionStats.value.failedDetections++
        return null
      }
      
      console.log('直播流帧获取成功，数据长度:', frameDataUrl.length)
      
      // 检查是否是FLV流
      if (frameResponse.isFlvStream) {
        console.log('检测到FLV直播流，流大小:', frameResponse.streamSize, 'bytes')
        console.log('FFmpeg已成功解码FLV流为PNG图像，可以进行二维码检测')
        console.log(frameDataUrl)
        // FFmpeg已经成功解码了FLV流，现在可以进行二维码检测
      }
      
      // 解码二维码
      console.log('开始解码二维码...')
      const qrResult = await decodeQRFromBase64(frameDataUrl)
      
      if (qrResult) {
        console.log('检测到二维码:', qrResult)
        detectionStats.value.successfulDetections++
        console.log('检测统计:', {
          总尝试次数: detectionStats.value.totalAttempts,
          成功检测: detectionStats.value.successfulDetections,
          失败检测: detectionStats.value.failedDetections,
          成功率: `${((detectionStats.value.successfulDetections / detectionStats.value.totalAttempts) * 100).toFixed(1)}%`
        })
      } else {
        console.log('未检测到二维码')
        detectionStats.value.failedDetections++
      }
      
      return qrResult
      
    } catch (error) {
      console.error('直播流帧获取失败:', error)
      return null
    }
  }

  /**
   * 从Base64图像解码二维码
   * @param {string} base64Image - Base64编码的图像
   */
  const decodeQRFromBase64 = async (base64Image) => {
    try {
      return new Promise((resolve) => {
        // 检查base64数据是否有效
        if (!base64Image || base64Image.length < 100) {
          console.log('Base64数据无效或太短')
          resolve(null)
          return
        }
        
        // 检查是否是图像格式的base64
        if (!base64Image.startsWith('data:image/')) {
          console.log('不是图像格式的base64数据，跳过二维码检测')
          resolve(null)
          return
        }
        
        // 创建Image对象
        const img = new Image()
        
        img.onload = () => {
          clearTimeout(timeout)
          try {
            console.log('图像加载成功，尺寸:', img.width, 'x', img.height)
            
            // 验证图像尺寸
            if (img.width <= 0 || img.height <= 0) {
              console.error('图像尺寸无效:', img.width, 'x', img.height)
              resolve(null)
              return
            }
            
            // 检查图像是否完整加载
            if (img.naturalWidth === 0 || img.naturalHeight === 0) {
              console.error('图像未完全加载，natural尺寸:', img.naturalWidth, 'x', img.naturalHeight)
              resolve(null)
              return
            }
            
            console.log('图像natural尺寸:', img.naturalWidth, 'x', img.naturalHeight)
            
            // 创建canvas
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            
            // 使用natural尺寸确保完整图像
            const canvasWidth = img.naturalWidth || img.width
            const canvasHeight = img.naturalHeight || img.height
            
            // 设置canvas尺寸
            canvas.width = canvasWidth
            canvas.height = canvasHeight
            
            console.log('Canvas尺寸设置为:', canvas.width, 'x', canvas.height)
            
            // 绘制图像到canvas，使用完整尺寸
            ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight)
            
            // 验证绘制结果
            const testPixel = ctx.getImageData(0, 0, 1, 1)
            if (testPixel.data[3] === 0) {
              console.warn('Canvas左上角像素为透明，可能绘制失败')
            }
            
            // 获取图像数据
            let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            console.log('图像数据获取成功，像素数:', imageData.data.length / 4)
            
            // 验证图像数据完整性
            const expectedPixels = canvas.width * canvas.height
            const actualPixels = imageData.data.length / 4
            if (actualPixels !== expectedPixels) {
              console.error('图像数据不完整，期望像素数:', expectedPixels, '实际像素数:', actualPixels)
              resolve(null)
              return
            }
            
            // 检查图像是否全黑或全透明
            let hasContent = false
            for (let i = 0; i < imageData.data.length; i += 4) {
              const alpha = imageData.data[i + 3]
              if (alpha > 0) {
                hasContent = true
                break
              }
            }
            
            if (!hasContent) {
              console.error('图像内容为空，可能绘制失败')
              resolve(null)
              return
            }
            
            console.log('图像数据验证通过')
            
            // 如果Canvas处理失败，尝试备用方案
            if (actualPixels === 0 || !hasContent) {
              console.log('尝试备用Canvas处理方案...')
              
              // 创建新的Canvas，使用不同的设置
              const backupCanvas = document.createElement('canvas')
              const backupCtx = backupCanvas.getContext('2d')
              
              // 设置Canvas为图像的实际尺寸
              backupCanvas.width = img.width
              backupCanvas.height = img.height
              
              // 设置Canvas样式属性
              backupCanvas.style.width = img.width + 'px'
              backupCanvas.style.height = img.height + 'px'
              
              // 绘制图像
              backupCtx.drawImage(img, 0, 0)
              
              // 获取图像数据
              imageData = backupCtx.getImageData(0, 0, backupCanvas.width, backupCanvas.height)
              console.log('备用方案图像数据获取成功，像素数:', imageData.data.length / 4)
            }
            
            // 图像预处理：提高二维码检测成功率
            console.log('开始图像预处理...')
            
            // 尝试调整对比度和亮度
            const processedImageData = new ImageData(
              new Uint8ClampedArray(imageData.data), 
              imageData.width, 
              imageData.height
            )
            
            // 增强对比度
            for (let i = 0; i < processedImageData.data.length; i += 4) {
              const r = processedImageData.data[i]
              const g = processedImageData.data[i + 1]
              const b = processedImageData.data[i + 2]
              
              // 转换为灰度
              const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
              
              // 增强对比度
              const enhanced = gray < 128 ? Math.max(0, gray - 50) : Math.min(255, gray + 50)
              
              processedImageData.data[i] = enhanced     // R
              processedImageData.data[i + 1] = enhanced // G
              processedImageData.data[i + 2] = enhanced // B
              // Alpha通道保持不变
            }
            
            console.log('图像预处理完成')
            imageData = processedImageData
            // 打印当前帧的 DataURL/Base64，便于直接查看该帧
            // try {
            //   console.log('[FRAME] dataUrl length:', (base64Image || '').length)
            //   console.log('[FRAME] dataUrl:', base64Image)
            // } catch (_) {}
            // // 也可打印经过 canvas 重编码后的 PNG（可用于对照）
            // try {
            //   const canvasUrl = canvas.toDataURL('image/png')
            //   console.log('[FRAME][canvas] dataUrl length:', canvasUrl.length)
            //   console.log('[FRAME][canvas] dataUrl:', canvasUrl)
            // } catch (_) {}
            
            // 使用jsQR解码，添加更多选项提高检测成功率
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'attemptBoth',
              // 添加更多检测选项
              returnDetailedDetectionResult: true
            })
            
            if (code && code.data) {
              console.log('二维码解码成功:', code.data)
              console.log('二维码长度:', code.data.length)
              console.log('二维码位置:', code.location)
              console.log('二维码版本:', code.version)
              console.log('二维码错误纠正级别:', code.errorCorrectionLevel)
              
              if (code.data.length > 50) {
                console.log('检测到二维码，内容:', code.data.substring(0, 100) + '...')
                resolve(code.data)
              } else {
                console.log('检测到二维码但内容太短:', code.data)
                resolve(null)
              }
            } else {
              console.log('未检测到二维码')
              // 尝试不同的检测参数
              console.log('尝试使用不同的检测参数...')
              
              // 尝试不同的inversionAttempts
              const code2 = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert'
              })
              
              if (code2 && code2.data) {
                console.log('使用dontInvert参数检测到二维码:', code2.data)
                if (code2.data.length > 50) {
                  resolve(code2.data)
                  return
                }
              }
              
              // 尝试invertOnly
              const code3 = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'invertOnly'
              })
              
              if (code3 && code3.data) {
                console.log('使用invertOnly参数检测到二维码:', code3.data)
                if (code3.data.length > 50) {
                  resolve(code3.data)
                  return
                }
              }
              
              // 如果所有检测都失败，尝试简化方案
              if (!trySimpleDetection()) {
                resolve(null)
              }
            }
          } catch (error) {
            console.error('二维码解码失败:', error)
            // 尝试简化方案作为最后手段
            if (!trySimpleDetection()) {
              resolve(null)
            }
          }
        }
        
        // 添加一个简化的备用检测方案
        const trySimpleDetection = () => {
          try {
            console.log('尝试简化检测方案...')
            
            // 创建最小化的Canvas
            const simpleCanvas = document.createElement('canvas')
            const simpleCtx = simpleCanvas.getContext('2d')
            
            // 使用固定尺寸，避免尺寸问题
            simpleCanvas.width = 400
            simpleCanvas.height = 300
            
            // 绘制图像，保持宽高比
            const aspectRatio = img.width / img.height
            let drawWidth = 400
            let drawHeight = 400 / aspectRatio
            
            if (drawHeight > 300) {
              drawHeight = 300
              drawWidth = 300 * aspectRatio
            }
            
            const offsetX = (400 - drawWidth) / 2
            const offsetY = (300 - drawHeight) / 2
            
            simpleCtx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)
            
            // 获取图像数据
            const simpleImageData = simpleCtx.getImageData(0, 0, 400, 300)
            
            // 使用简化参数检测
            const simpleCode = jsQR(simpleImageData.data, 400, 300, {
              inversionAttempts: 'attemptBoth'
            })
            
            if (simpleCode && simpleCode.data && simpleCode.data.length > 50) {
              console.log('简化方案检测成功:', simpleCode.data)
              resolve(simpleCode.data)
              return true
            }
            
            return false
          } catch (error) {
            console.error('简化检测方案失败:', error)
            return false
          }
        }
        
        // 添加超时处理
        const timeout = setTimeout(() => {
          console.error('图像加载超时')
          resolve(null)
        }, 5000) // 5秒超时
        
        img.onerror = (error) => {
          clearTimeout(timeout)
          console.error('图像加载失败:', error)
          resolve(null)
        }
        
        // 设置图像源
        console.log('设置图像源，Base64长度:', base64Image.length)
        img.src = base64Image
      })
      
    } catch (error) {
      console.error('二维码解码失败:', error)
      return null
    }
  }

  /**
   * 执行扫描登录
   * @param {string} ticket - 二维码票据
   * @param {string} gameType - 游戏类型
   * @param {string} uid - 用户UID
   * @param {string} gameToken - 游戏令牌
   */
  const performScanLogin = async (ticket, gameType, uid, gameToken) => {
    try {
      console.log('执行扫描登录:', { ticket, gameType, uid, gameToken })
      const result = await window.electronAPI.mihoyoScanQRLogin(ticket, gameType, uid, gameToken)
      return result
    } catch (error) {
      console.error('扫描登录失败:', error)
      return false
    }
  }

  /**
   * 执行自动登录（只执行确认登录，模仿MHY_Scanner的continueLastLogin）
   * @param {Object} qrInfo - 二维码信息
   * @param {Object} account - 当前账户
   */
  const performAutoLogin = async (qrInfo, account) => {
    try {
      console.log('开始自动确认登录流程:', { qrInfo, account })
      
      // 直接执行确认登录（模仿MHY_Scanner的continueLastLogin逻辑）
      const confirmResult = await confirmLogin(account.uid, account.loginData.gameToken, qrInfo.ticket, qrInfo.gameType)
      
      // 弹窗提示登录结果
      try {
        if (confirmResult) {
          alert(`自动登录成功！\n\n游戏类型: ${qrInfo.gameType}\n票据: ${qrInfo.ticket.substring(0, 8)}...\n\n账号已成功登录。`)
        } else {
          alert(`自动登录失败！\n\n游戏类型: ${qrInfo.gameType}\n票据: ${qrInfo.ticket.substring(0, 8)}...\n\n请检查账号信息或重新扫描。`)
        }
      } catch (_) {}
      
      if (!confirmResult) {
        console.log('确认登录失败')
        return false
      }
      
      console.log('确认登录成功')
      return true
      
    } catch (error) {
      console.error('自动确认登录失败:', error)
      // 异常情况下也弹窗提示
      try {
        alert(`自动登录异常！\n\n游戏类型: ${qrInfo.gameType}\n票据: ${qrInfo.ticket.substring(0, 8)}...\n\n错误: ${error.message}`)
      } catch (_) {}
      return false
    }
  }

  /**
   * 确认登录
   * @param {string} uid - 用户UID
   * @param {string} gameToken - 游戏令牌
   * @param {string} ticket - 二维码票据
   * @param {string} gameType - 游戏类型
   */
  const confirmLogin = async (uid, gameToken, ticket, gameType) => {
    try {
      console.log('确认登录:', { uid, gameToken, ticket, gameType })
      const result = await window.electronAPI.mihoyoConfirmQRLogin(uid, gameToken, ticket, gameType)
      return result
    } catch (error) {
      console.error('确认登录失败:', error)
      return false
    }
  }


  return {
    isScanningStream: computed(() => isScanningStream.value),
    detectionStats: computed(() => detectionStats.value),
    startStreamScan,
    stopStreamScan,
    performAutoLogin,
    // 导出统计信息
    getDetectionStats: () => detectionStats.value
  }
}