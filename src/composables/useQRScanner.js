import { ref, computed } from 'vue'
import jsQR from 'jsqr'

// 二维码扫描功能
export function useQRScanner() {
  const isScanning = ref(false)
  const scanInterval = ref(null)
  const retryCount = ref(0)
  const maxRetries = 3
  const isProcessingQR = ref(false) // 添加标志位，防止重复处理二维码
  const lastProcessedTicket = ref('') // 记录最后处理的ticket，防止重复处理同一个二维码
  const detectionStats = ref({
    totalAttempts: 0,
    successfulDetections: 0,
    failedDetections: 0
  })

  /**
   * 开始屏幕扫描
   * @param {Object} account - 当前账号
   * @param {Object} settings - 应用设置
   * @param {Function} onQRDetected - 二维码检测回调
   * @param {Function} onLoginConfirm - 登录确认回调
   * @param {Function} onAutoLogin - 自动登录回调
   */
  const startScreenScan = async (account, settings, onQRDetected, onLoginConfirm, onAutoLogin) => {
    if (isScanning.value) {
      return
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

    isScanning.value = true
    isProcessingQR.value = false // 重置处理标志位
    lastProcessedTicket.value = '' // 重置最后处理的ticket
    console.log('开始屏幕扫描...')

    // 使用Electron的屏幕截图API
    scanInterval.value = setInterval(async () => {
      // 如果正在处理二维码，跳过本次扫描
      if (isProcessingQR.value) {
        console.log('正在处理二维码，跳过本次扫描')
        return
      }
      
      try {
        const qrResult = await captureAndDecodeQR()
        
        if (qrResult) {
          console.log('检测到二维码:', qrResult)
          
          // 解析二维码信息
          const qrInfo = parseQRCode(qrResult)
          if (qrInfo) {
            console.log('解析二维码信息:', qrInfo)
            
            // 检查是否已经处理过这个ticket
            if (lastProcessedTicket.value === qrInfo.ticket) {
              console.log('该二维码已被处理过，跳过:', qrInfo.ticket)
              return
            }
            
            // 立即停止扫描，避免重复处理
            stopScreenScan()
            
            // 设置处理标志位和记录ticket，防止重复处理
            isProcessingQR.value = true
            lastProcessedTicket.value = qrInfo.ticket
            
            // 执行扫描登录（完全模仿MHY_Scanner的ScanQRLogin）
            const scanResult = await performScanLogin(qrInfo.ticket, qrInfo.gameType, account.uid, account.loginData.gameToken)
            if (scanResult) {
              console.log('扫描登录成功，二维码状态有效')
              
              // 检查是否启用自动登录（完全模仿MHY_Scanner的逻辑）
              if (settings.autoLogin) {
                console.log('自动登录已启用，直接执行确认登录')
                // 直接执行确认登录流程
                if (onAutoLogin) {
                  onAutoLogin(qrInfo, account)
                }
              } else {
                console.log('自动登录未启用，显示登录确认对话框')
                // 通知用户确认登录
                if (onLoginConfirm) {
                  onLoginConfirm(qrInfo, account)
                }
              }
            } else {
              console.log('扫描登录失败，二维码状态无效（可能已过期）')
              // 即使扫描失败，也显示确认对话框让用户重试
              if (onLoginConfirm) {
                onLoginConfirm(qrInfo, account)
              }
            }
          }
          
          // 通知检测到二维码
          onQRDetected && onQRDetected(qrResult)
          
          // 重要：检测到二维码后立即返回，避免继续执行后续的扫描逻辑
          return
        }
      } catch (error) {
        console.error('屏幕扫描错误:', error)
        retryCount.value++
        
        if (retryCount.value >= maxRetries) {
          console.log('达到最大重试次数，停止扫描')
          stopScreenScan()
        } else {
          console.log(`扫描失败，${1000}ms后重试 (${retryCount.value}/${maxRetries})`)
          // 短暂延迟后继续扫描
          setTimeout(() => {
            if (isScanning.value) {
              retryCount.value = 0 // 重置重试计数
            }
          }, 1000)
        }
      }
    }, 500) // 每0.5秒扫描一次，提高检测频率
  }

  /**
   * 停止屏幕扫描
   */
  const stopScreenScan = () => {
    if (!isScanning.value) {
      return
    }

    isScanning.value = false
    isProcessingQR.value = false // 重置处理标志位
    lastProcessedTicket.value = '' // 重置最后处理的ticket
    if (scanInterval.value) {
      clearInterval(scanInterval.value)
      scanInterval.value = null
    }
    retryCount.value = 0 // 重置重试计数
    detectionStats.value = { // 重置检测统计
      totalAttempts: 0,
      successfulDetections: 0,
      failedDetections: 0
    }

    console.log('停止屏幕扫描')
  }

  /**
   * 图像预处理函数，提高二维码检测成功率
   * @param {ImageData} imageData - 原始图像数据
   */
  const preprocessImage = (imageData) => {
    const { data, width, height } = imageData
    const processedData = new Uint8ClampedArray(data)
    
    // 增强对比度
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      
      // 转换为灰度
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
      
      // 增强对比度
      const enhanced = gray < 128 ? Math.max(0, gray - 50) : Math.min(255, gray + 50)
      
      processedData[i] = enhanced     // R
      processedData[i + 1] = enhanced // G
      processedData[i + 2] = enhanced // B
      processedData[i + 3] = data[i + 3] // A
    }
    
    return new ImageData(processedData, width, height)
  }

  /**
   * 验证二维码是否为米哈游登录二维码
   * @param {string} qrString - 二维码字符串
   */
  const validateMihoyoQR = (qrString) => {
    console.log('开始验证二维码:', qrString.substring(0, 50) + '...')
    console.log('二维码总长度:', qrString.length)
    
    if (!qrString || qrString.length < 50) {
      console.log('二维码太短，长度:', qrString ? qrString.length : 0)
      return false
    }
    
    // 检查是否包含米哈游相关的URL模式
    const mihoyoPatterns = [
      'mihoyo.com',
      'miyoushe.com',
      'api-sdk.mihoyo.com',
      'hk4e-sdk.mihoyo.com'
    ]
    
    const hasMihoyoPattern = mihoyoPatterns.some(pattern => qrString.includes(pattern))
    if (hasMihoyoPattern) {
      console.log('检测到米哈游相关URL模式')
      
      // 尝试提取ticket（通常在URL末尾）
      const urlMatch = qrString.match(/ticket=([a-zA-Z0-9]+)/)
      if (urlMatch && urlMatch[1]) {
        const ticket = urlMatch[1]
        console.log('提取到ticket:', ticket)
        return true
      }
      
      // 如果没有ticket参数，检查是否有其他标识符
      if (qrString.length > 80) {
        console.log('二维码长度足够，可能是米哈游登录二维码')
        return true
      }
    }
    
    // 原有的严格验证逻辑（作为备选）
    if (qrString.length >= 85) {
      // 检查游戏类型标识符（位置79-81）
      const gameTypeView = qrString.substring(79, 82)
      const validGameTypes = ['8F3', '9E&', '8F%', '%BA'] // 崩坏3, 原神, 星穹铁道, 绝区零
      
      if (validGameTypes.includes(gameTypeView)) {
        console.log('通过游戏类型验证 - 游戏类型:', gameTypeView)
        
        // 检查ticket长度（最后24位）
        const ticket = qrString.substring(qrString.length - 24)
        if (ticket.length === 24) {
          console.log('验证通过 - 游戏类型:', gameTypeView, 'ticket:', ticket)
          return true
        } else {
          console.log('ticket长度不正确:', ticket.length)
        }
      } else {
        console.log('无效的游戏类型标识符:', gameTypeView)
      }
    }
    
    console.log('验证失败，不是米哈游登录二维码')
    return false
  }

  /**
   * 从Base64图像解码二维码
   * @param {string} base64Image - Base64编码的图像
   */
  const decodeQRFromBase64 = async (base64Image) => {
    try {
      return new Promise((resolve) => {
        // 创建Image对象
        const img = new Image()
        
        img.onload = () => {
          try {
            console.log('图像加载成功，尺寸:', img.width, 'x', img.height)
            
            // 创建canvas
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            
            // 设置canvas尺寸
            canvas.width = img.width
            canvas.height = img.height
            
            // 绘制图像到canvas
            ctx.drawImage(img, 0, 0)
            
            // 获取图像数据
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            console.log('图像数据获取成功，像素数:', imageData.data.length / 4)
            
            // 使用jsQR解码，尝试多种检测策略
            let code = null
            
            // 策略1: 不反转检测
            console.log('尝试策略1: 不反转检测')
            const options1 = {
              inversionAttempts: 'dontInvert'
            }
            code = jsQR(imageData.data, imageData.width, imageData.height, options1)
            
            // 策略2: 反转检测
            if (!code) {
              console.log('策略1失败，尝试策略2: 反转检测')
              const options2 = {
                inversionAttempts: 'invertFirst'
              }
              code = jsQR(imageData.data, imageData.width, imageData.height, options2)
            }
            
            // 策略3: 尝试两种反转
            if (!code) {
              console.log('策略2失败，尝试策略3: 尝试两种反转')
              const options3 = {
                inversionAttempts: 'attemptBoth'
              }
              code = jsQR(imageData.data, imageData.width, imageData.height, options3)
            }
            
            // 策略4: 图像预处理
            if (!code) {
              console.log('策略3失败，尝试策略4: 图像预处理')
              const options4 = {
                inversionAttempts: 'attemptBoth'
              }
              // 尝试不同的图像处理
              const processedImageData = preprocessImage(imageData)
              code = jsQR(processedImageData.data, processedImageData.width, processedImageData.height, options4)
            }
            
            // 策略5: 调整图像尺寸
            if (!code) {
              console.log('策略4失败，尝试策略5: 调整图像尺寸')
              const scaleFactor = 2
              const scaledWidth = imageData.width * scaleFactor
              const scaledHeight = imageData.height * scaleFactor
              
              // 创建放大后的canvas
              const scaledCanvas = document.createElement('canvas')
              scaledCanvas.width = scaledWidth
              scaledCanvas.height = scaledHeight
              const scaledCtx = scaledCanvas.getContext('2d')
              
              // 放大图像
              scaledCtx.imageSmoothingEnabled = false
              scaledCtx.drawImage(canvas, 0, 0, scaledWidth, scaledHeight)
              
              const scaledImageData = scaledCtx.getImageData(0, 0, scaledWidth, scaledHeight)
              const options5 = {
                inversionAttempts: 'attemptBoth'
              }
              code = jsQR(scaledImageData.data, scaledImageData.width, scaledImageData.height, options5)
            }
            
            // 策略6: 多次尝试不同参数
            if (!code) {
              console.log('策略5失败，尝试策略6: 多次尝试不同参数')
              const attempts = [
                { inversionAttempts: 'dontInvert' },
                { inversionAttempts: 'invertFirst' },
                { inversionAttempts: 'attemptBoth' }
              ]
              
              for (let i = 0; i < attempts.length && !code; i++) {
                console.log(`尝试参数组合 ${i + 1}:`, attempts[i])
                code = jsQR(imageData.data, imageData.width, imageData.height, attempts[i])
                if (code) {
                  console.log(`参数组合 ${i + 1} 成功检测到二维码`)
                  break
                }
              }
            }
            
            if (code && code.data) {
              console.log('二维码解码成功:', code.data)
              console.log('二维码长度:', code.data.length)
              console.log('二维码位置:', code.location)
              
              // 先检查是否是任何二维码，不限制米哈游
              if (code.data.length > 50) {
                console.log('检测到二维码，内容:', code.data.substring(0, 100) + '...')
                
                // 验证是否为米哈游登录二维码
                if (validateMihoyoQR(code.data)) {
                  console.log('验证通过，返回二维码数据')
                  resolve(code.data)
                } else {
                  console.log('验证失败，不是米哈游登录二维码，但检测到了二维码')
                  console.log('二维码内容:', code.data)
                  // 暂时返回任何检测到的二维码，用于调试
                  resolve(code.data)
                }
              } else {
                console.log('检测到二维码但内容太短:', code.data)
                resolve(null)
              }
            } else {
              console.log('未检测到二维码')
              resolve(null)
            }
          } catch (error) {
            console.error('二维码解码失败:', error)
            resolve(null)
          }
        }
        
        img.onerror = (error) => {
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
   * 解析二维码信息
   * @param {string} qrString - 二维码字符串
   */
  const parseQRCode = (qrString) => {
    console.log('开始解析二维码:', qrString.substring(0, 100) + '...')
    
    // 首先尝试从URL中提取信息
    if (qrString.includes('mihoyo.com') || qrString.includes('miyoushe.com')) {
      console.log('检测到米哈游URL格式')
      
      // 尝试提取ticket
      const ticketMatch = qrString.match(/ticket=([a-zA-Z0-9]+)/)
      if (ticketMatch && ticketMatch[1]) {
        const ticket = ticketMatch[1]
        console.log('从URL提取到ticket:', ticket)
        
        // 尝试从URL中确定游戏类型
        let gameType = 'hk4e' // 默认原神
        
        if (qrString.includes('bh3_cn')) {
          gameType = 'bh3'
        } else if (qrString.includes('hk4e_cn')) {
          gameType = 'hk4e'
        } else if (qrString.includes('hkrpg_cn')) {
          gameType = 'hkrpg'
        } else if (qrString.includes('nap_cn')) {
          gameType = 'zzz'
        }
        
        console.log('解析结果:', { gameType, ticket })
        return {
          gameType: gameType,
          ticket: ticket,
          originalString: qrString
        }
      }
    }
    
    // 如果URL解析失败，尝试原有的严格格式
    if (qrString.length >= 85) {
      const gameTypeView = qrString.substring(79, 82)
      const gameTypeMap = {
        '8F3': 'bh3',    // 崩坏3
        '9E&': 'hk4e',   // 原神
        '8F%': 'hkrpg',  // 星穹铁道
        '%BA': 'zzz'    // 绝区零
      }
      
      const gameType = gameTypeMap[gameTypeView]
      if (gameType) {
        const ticket = qrString.substring(qrString.length - 24)
        console.log('通过严格格式解析:', { gameType, ticket })
        return {
          gameType: gameType,
          ticket: ticket,
          gameTypeView: gameTypeView
        }
      }
    }
    
    console.log('无法解析二维码格式')
    return null
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
      console.log('执行扫描登录（完全模仿MHY_Scanner的ScanQRLogin）:', { ticket, gameType, uid, gameToken })
      
      // 完全模仿MHY_Scanner的ScanQRLogin：直接调用扫描API，不查询状态
      const scanResult = await window.electronAPI.mihoyoScanQRLogin(ticket, gameType, uid, gameToken)
      console.log('扫描登录API调用结果:', scanResult)
      
      // MHY_Scanner的ScanQRLogin只检查retcode是否为0
      if (scanResult === true) {
        console.log('扫描登录成功（retcode=0）')
        return true
      } else {
        console.log('扫描登录失败（retcode!=0，可能二维码过期）')
        return false
      }
    } catch (error) {
      console.error('执行扫描登录失败:', error)
      return false
    }
  }

  /**
   * 确认登录（完全模仿MHY_Scanner的continueLastLogin）
   * @param {string} uid - 用户UID
   * @param {string} gameToken - 游戏令牌
   * @param {string} ticket - 二维码票据
   * @param {string} gameType - 游戏类型
   */
  const confirmLogin = async (uid, gameToken, ticket, gameType) => {
    try {
      console.log('确认登录（完全模仿MHY_Scanner的continueLastLogin）:', { uid, gameToken, ticket, gameType })
      
      // 完全模仿MHY_Scanner的continueLastLogin：直接调用ConfirmQRLogin，不查询状态
      const result = await window.electronAPI.mihoyoConfirmQRLogin(uid, gameToken, ticket, gameType)
      console.log('确认登录API调用结果:', result)
      
      if (result === true) {
        console.log('确认登录成功')
        return { success: true, error: null }
      } else {
        console.log('确认登录失败')
        return { success: false, error: '确认登录失败' }
      }
    } catch (error) {
      console.error('确认登录失败:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 获取SToken
   * @param {string} uid - 用户UID
   * @param {string} gameToken - 游戏令牌
   */
  const getStoken = async (uid, gameToken) => {
    try {
      console.log('获取SToken:', { uid, gameToken })
      const result = await window.electronAPI.mihoyoGetStokenByGameToken(uid, gameToken)
      return result
    } catch (error) {
      console.error('获取SToken失败:', error)
      return null
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
      if (!confirmResult.success) {
        console.log('确认登录失败:', confirmResult.error)
        return { success: false, error: confirmResult.error }
      }
      
      console.log('确认登录成功')
      return { success: true, error: null }
      
    } catch (error) {
      console.error('自动确认登录失败:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 捕获屏幕并解码二维码
   */
  const captureAndDecodeQR = async () => {
    try {
      console.log('开始获取屏幕截图...')
      detectionStats.value.totalAttempts++
      
      // 获取屏幕截图
      const screenshotDataUrl = await window.electronAPI.captureScreen()
      if (!screenshotDataUrl) {
        console.log('屏幕截图失败：未获取到数据')
        detectionStats.value.failedDetections++
        return null
      }
      
      console.log('屏幕截图成功，数据长度:', screenshotDataUrl.length)
      
      // 解码二维码
      console.log('开始解码二维码...')
      const qrResult = await decodeQRFromBase64(screenshotDataUrl)
      
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
      console.error('屏幕截图失败:', error)
      return null
    }
  }

  return {
    isScanning: computed(() => isScanning.value),
    detectionStats: computed(() => detectionStats.value),
    startScreenScan,
    stopScreenScan,
    decodeQRFromBase64,
    parseQRCode,
    performScanLogin,
    confirmLogin,
    getStoken,
    performAutoLogin
  }
}
