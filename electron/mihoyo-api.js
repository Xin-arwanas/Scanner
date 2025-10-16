const axios = require('axios')
const QRCode = require('qrcode')
const crypto = require('crypto')

/**
 * 获取游戏ID
 * @param {string} gameType - 游戏类型
 */
const getGameId = (gameType) => {
  const gameIds = {
    bh3: 1,      // 崩坏3 (Honkai3 = 1)
    tears: 2,    // 未定事件簿 (TearsOfThemis = 2)
    hk4e: 4,     // 原神 (Genshin = 4)
    hkrpg: 8,    // 星穹铁道 (HonkaiStarRail = 8)
    zzz: 12,     // 绝区零 (ZenlessZoneZero = 12)
  }
  return gameIds[gameType] || 2  // 默认使用未定事件簿，完全模仿MHY_Scanner
}

/**
 * 生成设备ID - 使用静态全局变量，与原程序保持一致
 */
let deviceId = null

const generateDeviceId = () => {
  if (!deviceId) {
    // 生成UUID4格式的设备ID，与原程序CreateUUID::CreateUUID4()保持一致
    deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }
  return deviceId
}

/**
 * B站登录签名算法（完全模仿MHY_Scanner）
 * @param {string} data - 要签名的数据
 */
const bh3Sign = (data) => {
  const key = '0ebc517adb1b62c6b408df153331f9aa'
  // 移除反斜杠
  const cleanData = data.replace(/\\/g, '')
  // 使用HMAC-SHA256签名
  return crypto.createHmac('sha256', key).update(cleanData).digest('hex')
}

/**
 * 生成B站登录请求的签名（完全模仿MHY_Scanner）
 * @param {Object} data - 请求数据
 */
const makeSign = (data) => {
  const parsed = typeof data === 'string' ? JSON.parse(data) : data
  let data2 = ''
  
  console.log('makeSign 输入数据:', parsed)
  
  // 按照MHY_Scanner的方式构建签名字符串
  // 使用Object.keys()确保字段顺序一致
  const keys = Object.keys(parsed).sort()
  
  for (const key of keys) {
    if (key === 'sign') continue
    
    const value = parsed[key]
    let cleanValue = value
    if (key === 'data' || key === 'device') {
      // 移除引号
      if (typeof cleanValue === 'string') {
        if (cleanValue.startsWith('"') && cleanValue.endsWith('"')) {
          cleanValue = cleanValue.slice(1, -1)
        }
      }
    }
    
    console.log(`处理字段 ${key}:`, cleanValue)
    data2 += `${key}=${cleanValue}&`
  }
  
  // 移除最后的&
  data2 = data2.slice(0, -1)
  
  console.log('构建的签名字符串:', data2)
  
  // 生成签名
  const sign = bh3Sign(data2)
  console.log('生成的签名:', sign)
  
  // 添加签名到数据中
  parsed.sign = sign
  return JSON.stringify(parsed)
}

/**
 * 获取当前设备ID
 */
const getDeviceId = () => {
  return generateDeviceId()
}

/**
 * 获取二维码获取API端点
 * @param {string} gameType - 游戏类型
 */
const getQRCodeFetchUrl = (gameType) => {
  const urls = {
    bh3: 'https://api-sdk.mihoyo.com/bh3_cn/combo/panda/qrcode/fetch',
    hk4e: 'https://hk4e-sdk.mihoyo.com/hk4e_cn/combo/panda/qrcode/fetch',
    hkrpg: 'https://api-sdk.mihoyo.com/hkrpg_cn/combo/panda/qrcode/fetch',
    zzz: 'https://api-sdk.mihoyo.com/nap_cn/combo/panda/qrcode/fetch'
  }
  return urls[gameType] || urls.hk4e
}

/**
 * 获取二维码查询API端点
 * @param {string} gameType - 游戏类型
 */
const getQRCodeQueryUrl = (gameType) => {
  const urls = {
    bh3: 'https://api-sdk.mihoyo.com/bh3_cn/combo/panda/qrcode/query',
    hk4e: 'https://hk4e-sdk.mihoyo.com/hk4e_cn/combo/panda/qrcode/query',
    hkrpg: 'https://api-sdk.mihoyo.com/hkrpg_cn/combo/panda/qrcode/query',
    zzz: 'https://api-sdk.mihoyo.com/nap_cn/combo/panda/qrcode/query'
  }
  return urls[gameType] || urls.hk4e
}

/**
 * 获取登录二维码URL
 * @param {string} gameType - 游戏类型 (bh3, hk4e, hkrpg, zzz)
 */
const getLoginQRCode = async (gameType) => {
  try {
    // 完全模仿MHY_Scanner的GetLoginQrcodeUrl函数
    // 使用原神的API端点，但使用传入的gameType作为app_id
    const gameId = getGameId(gameType)
    const deviceId = generateDeviceId()
    
    // 使用原神的API端点（完全模仿MHY_Scanner）
    const apiUrl = 'https://hk4e-sdk.mihoyo.com/hk4e_cn/combo/panda/qrcode/fetch'
    
    // 构建请求数据
    const requestData = {
      app_id: gameId,
      device: deviceId
    }

    // 发送请求获取二维码
    const response = await axios.post(
      apiUrl,
      requestData,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) miHoYoBBS/2.76.1',
          'Accept': 'application/json',
          'x-rpc-app_id': 'bll8iq97cem8',
          'x-rpc-app_version': '2.76.1',
          'x-rpc-client_type': '2',
          'x-rpc-device_id': deviceId,
          'x-rpc-device_name': '',
          'x-rpc-game_biz': 'bbs_cn',
          'x-rpc-sdk_version': '2.16.0',
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    )

    if (response.data.retcode === 0) {
      const qrUrl = response.data.data.url
      
      // 按照原程序逻辑，从URL末尾提取24位ticket
      const ticket = qrUrl.substring(qrUrl.length - 24)
      
      console.log('二维码生成成功:', {
        qrUrl: qrUrl,
        ticket: ticket,
        deviceId: deviceId
      })
      
      // 将URL转换为二维码图片
      const qrCodeDataURL = await QRCode.toDataURL(qrUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
      
      return {
        url: qrCodeDataURL, // 返回二维码图片的DataURL
        originalUrl: qrUrl, // 保留原始URL用于调试
        ticket: ticket
      }
    } else {
      throw new Error(`获取二维码失败: ${response.data.message}`)
    }
  } catch (error) {
    console.error('获取登录二维码失败:', error)
    throw error
  }
}

/**
 * 查询二维码状态
 * @param {string} ticket - 二维码票据
 * @param {string} gameType - 游戏类型
 */
const queryQRCodeStatus = async (ticket, gameType) => {
  try {
    const gameId = getGameId(gameType)
    const deviceId = generateDeviceId()
    
    // 根据原程序的实现，使用正确的API端点
    const apiUrl = getQRCodeQueryUrl(gameType)
    
    const requestData = {
      app_id: gameId,
      device: deviceId,
      ticket: ticket
    }

    console.log('查询二维码状态:', {
      apiUrl: apiUrl,
      requestData: requestData,
      deviceId: deviceId
    })

    const response = await axios.post(
      apiUrl,
      requestData,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) miHoYoBBS/2.76.1',
          'Accept': 'application/json',
          'x-rpc-app_id': 'bll8iq97cem8',
          'x-rpc-app_version': '2.76.1',
          'x-rpc-client_type': '2',
          'x-rpc-device_id': deviceId,
          'x-rpc-device_name': '',
          'x-rpc-game_biz': 'bbs_cn',
          'x-rpc-sdk_version': '2.16.0',
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    )

    console.log('查询二维码状态响应:', {
      retcode: response.data.retcode,
      data: response.data.data
    })

    if (response.data.retcode === 0) {
      const status = response.data.data.stat
      const result = {
        status: status,
        uid: null,
        token: null
      }

      if (status === 'Confirmed') {
        // 解析登录信息
        const payload = JSON.parse(response.data.data.payload.raw)
        result.uid = payload.uid
        result.token = payload.token
      }

      console.log('二维码状态查询结果:', result)
      return result
    } else {
      // retcode == -106 表示二维码过期
      console.log('二维码过期，retcode:', response.data.retcode)
      return {
        status: 'Expired',
        uid: null,
        token: null
      }
    }
  } catch (error) {
    console.error('查询二维码状态失败:', error)
    throw error
  }
}

/**
 * 获取扫描登录API端点
 * @param {string} gameType - 游戏类型
 */
const getQRCodeScanUrl = (gameType) => {
  const urls = {
    bh3: 'https://api-sdk.mihoyo.com/bh3_cn/combo/panda/qrcode/scan',
    hk4e: 'https://api-sdk.mihoyo.com/hk4e_cn/combo/panda/qrcode/scan',
    hkrpg: 'https://api-sdk.mihoyo.com/hkrpg_cn/combo/panda/qrcode/scan',
    zzz: 'https://api-sdk.mihoyo.com/nap_cn/combo/panda/qrcode/scan'
  }
  return urls[gameType] || urls.hk4e
}

/**
 * 获取确认登录API端点
 * @param {string} gameType - 游戏类型
 */
const getQRCodeConfirmUrl = (gameType) => {
  const urls = {
    bh3: 'https://api-sdk.mihoyo.com/bh3_cn/combo/panda/qrcode/confirm',
    hk4e: 'https://api-sdk.mihoyo.com/hk4e_cn/combo/panda/qrcode/confirm',
    hkrpg: 'https://api-sdk.mihoyo.com/hkrpg_cn/combo/panda/qrcode/confirm',
    zzz: 'https://api-sdk.mihoyo.com/nap_cn/combo/panda/qrcode/confirm'
  }
  return urls[gameType] || urls.hk4e
}

/**
 * 用户身份验证（完全模仿MHY_Scanner的verify函数）
 * @param {string} uid - 用户UID
 * @param {string} gameToken - 游戏令牌
 */
const verifyUser = async (uid, gameToken, gameType = 'hkrpg') => {
  try {
    // 根据游戏类型选择验证API
    const verifyUrls = {
      bh3: 'https://api-sdk.mihoyo.com/bh3_cn/combo/granter/login/v2/login',
      hk4e: 'https://api-sdk.mihoyo.com/hk4e_cn/combo/granter/login/v2/login',
      hkrpg: 'https://api-sdk.mihoyo.com/hkrpg_cn/combo/granter/login/v2/login',
      zzz: 'https://api-sdk.mihoyo.com/nap_cn/combo/granter/login/v2/login'
    }
    const apiUrl = verifyUrls[gameType] || verifyUrls.hkrpg
    
    // 构建请求数据（完全模仿MHY_Scanner的verifyBody模板）
    const verifyBody = {
      device: "0000000000000000",
      app_id: 1,
      channel_id: 14,
      data: `{"access_key":"${gameToken}","uid":${uid}}`,
      sign: ""
    }

    console.log('用户身份验证:', {
      apiUrl: apiUrl,
      uid: uid,
      gameToken: gameToken,
      verifyBody: verifyBody
    })

    // 使用B站签名算法
    const signedData = makeSign(verifyBody)
    console.log('签名后的验证数据:', signedData)

    const response = await axios.post(
      apiUrl,
      signedData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': '*/*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) miHoYoBBS/2.76.1'
        },
        timeout: 10000
      }
    )

    console.log('用户身份验证响应:', response.data)

    if (response.data.retcode === 0) {
      return response.data
    } else {
      console.error('用户身份验证失败:', response.data.message)
      return null
    }
  } catch (error) {
    console.error('用户身份验证失败:', error)
    return null
  }
}

/**
 * 扫描二维码登录（官方登录方式，完全模仿MHY_Scanner）
 * @param {string} ticket - 二维码票据
 * @param {string} gameType - 游戏类型
 * @param {string} uid - 用户UID
 * @param {string} gameToken - 游戏令牌
 */
const scanQRLogin = async (ticket, gameType, uid, gameToken) => {
  try {
    // 第一步：用户身份验证（完全模仿MHY_Scanner）
    // 注意：MHY_Scanner实际上没有在扫描登录前进行用户身份验证
    // console.log('开始用户身份验证...')
    // const loginData = await verifyUser(uid, gameToken, gameType)
    // if (!loginData) {
    //   console.error('用户身份验证失败，无法进行扫描登录')
    //   return false
    // }
    // console.log('用户身份验证成功:', loginData)

    // 第二步：扫描二维码登录
    const gameId = getGameId(gameType)
    const deviceId = generateDeviceId()
    const apiUrl = getQRCodeScanUrl(gameType)
    
    const requestData = {
      app_id: gameId,
      device: deviceId,
      ticket: ticket
    }

    console.log('扫描二维码登录 (官方方式):', {
      apiUrl: apiUrl,
      requestData: requestData,
      deviceId: deviceId,
      gameType: gameType,
      gameId: gameId,
      uid: uid
    })

    const response = await axios.post(
      apiUrl,
      requestData,
      {
        // 不添加任何headers，与MHY_Scanner的ScanQRLogin保持一致
        timeout: 10000
      }
    )

    console.log('扫描登录响应:', response.data)

    if (response.data.retcode === 0) {
      return true
    } else {
      console.error('扫描登录失败:', response.data.message)
      return false
    }
  } catch (error) {
    console.error('扫描二维码登录失败:', error)
    return false
  }
}

/**
 * 确认二维码登录
 * @param {string} uid - 用户UID
 * @param {string} gameToken - 游戏令牌
 * @param {string} ticket - 二维码票据
 * @param {string} gameType - 游戏类型
 */
const confirmQRLogin = async (uid, gameToken, ticket, gameType) => {
  try {
    const gameId = getGameId(gameType)
    const deviceId = generateDeviceId()
    const apiUrl = getQRCodeConfirmUrl(gameType)
    
    const payload = {
      proto: 'Account',
      raw: JSON.stringify({
        uid: uid,
        token: gameToken
      })
    }

    const requestData = {
      app_id: gameId,
      device: deviceId,
      payload: payload,
      ticket: ticket
    }

    console.log('确认二维码登录:', {
      apiUrl: apiUrl,
      requestData: requestData,
      deviceId: deviceId
    })

    const response = await axios.post(
      apiUrl,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': '*/*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) miHoYoBBS/2.76.1'
        },
        timeout: 10000
      }
    )

    console.log('确认登录响应:', response.data)

    if (response.data.retcode === 0) {
      return true
    } else {
      console.error('确认登录失败:', response.data.message)
      return false
    }
  } catch (error) {
    console.error('确认二维码登录失败:', error)
    return false
  }
}

/**
 * 通过游戏令牌获取SToken
 * @param {string} uid - 用户UID
 * @param {string} gameToken - 游戏令牌
 */
const getStokenByGameToken = async (uid, gameToken) => {
  try {
    const apiUrl = 'https://api-takumi.mihoyo.com/account/ma-cn-session/app/getTokenByGameToken'
    
    const requestData = {
      account_id: parseInt(uid), // 转换为数字，与MHY_Scanner保持一致
      game_token: gameToken
    }

    console.log('获取SToken:', {
      apiUrl: apiUrl,
      requestData: requestData
    })

    const response = await axios.post(
      apiUrl,
      requestData,
      {
        headers: {
          'x-rpc-app_id': 'bll8iq97cem8',
          'Referer': 'https://app.mihoyo.com',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 12; LIO-AN00 Build/TKQ1.220829.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/103.0.5060.129 Mobile Safari/537.36 miHoYoBBS/2.67.1',
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    )

    console.log('获取SToken响应:', response.data)

    if (response.data.retcode === 0) {
      return {
        mid: response.data.data.user_info.mid,
        stoken: response.data.data.token.token
      }
    } else {
      console.error('获取SToken失败:', response.data.message)
      return null
    }
  } catch (error) {
    console.error('获取SToken失败:', error)
    return null
  }
}

/**
 * 通过SToken获取GameToken（完全模仿MHY_Scanner）
 * @param {string} stoken - SToken
 * @param {string} mid - 用户MID
 */
const getGameTokenByStoken = async (stoken, mid) => {
  try {
    const apiUrl = 'https://api-takumi.mihoyo.com/auth/api/getGameToken'
    
    const params = {
      stoken: stoken,
      mid: mid
    }

    console.log('通过SToken获取GameToken:', {
      apiUrl: apiUrl,
      params: params
    })

    const response = await axios.get(
      apiUrl,
      {
        params: params,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) miHoYoBBS/2.76.1',
          'Accept': 'application/json',
          'x-rpc-app_id': 'bll8iq97cem8',
          'x-rpc-app_version': '2.76.1',
          'x-rpc-client_type': '2',
          'x-rpc-device_id': generateDeviceId(),
          'x-rpc-device_name': '',
          'x-rpc-game_biz': 'bbs_cn',
          'x-rpc-sdk_version': '2.16.0'
        },
        timeout: 10000
      }
    )

    console.log('获取GameToken响应:', response.data)

    if (response.data.retcode === 0) {
      return response.data.data.game_token
    } else {
      console.error('获取GameToken失败:', response.data.message)
      return null
    }
  } catch (error) {
    console.error('获取GameToken失败:', error)
    return null
  }
}

/**
 * 获取用户信息
 * @param {string} uid - 用户UID
 */
const getUserInfo = async (uid) => {
  try {
    const apiUrl = 'https://bbs-api.miyoushe.com/user/api/getUserFullInfo'
    
    console.log('获取用户信息:', { uid, apiUrl })

    const response = await axios.get(
      `${apiUrl}?uid=${uid}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) miHoYoBBS/2.76.1',
          'Accept': 'application/json',
          'x-rpc-app_id': 'bll8iq97cem8',
          'x-rpc-app_version': '2.76.1',
          'x-rpc-client_type': '2',
          'x-rpc-device_id': generateDeviceId(),
          'x-rpc-device_name': '',
          'x-rpc-game_biz': 'bbs_cn',
          'x-rpc-sdk_version': '2.16.0'
        },
        timeout: 10000
      }
    )

    console.log('用户信息响应:', response.data)

    if (response.data.retcode === 0) {
      const userInfo = response.data.data.user_info
      return {
        uid: userInfo.uid,
        nickname: userInfo.nickname,
        avatar: userInfo.avatar,
        level: userInfo.level,
        gender: userInfo.gender,
        introduce: userInfo.introduce
      }
    } else {
      throw new Error(`获取用户信息失败: ${response.data.message}`)
    }
  } catch (error) {
    console.error('获取用户信息失败:', error)
    throw error
  }
}

// CommonJS 导出
module.exports = {
  getDeviceId,
  getLoginQRCode,
  queryQRCodeStatus,
  verifyUser,
  scanQRLogin,
  confirmQRLogin,
  getStokenByGameToken,
  getGameTokenByStoken,
  getUserInfo
}
