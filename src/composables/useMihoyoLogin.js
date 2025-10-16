import { ref, computed } from 'vue'

// 米哈游登录功能
export function useMihoyoLogin() {
  const isLoggingIn = ref(false)
  const loginStatus = ref('idle') // idle, scanning, confirmed, expired, error

  /**
   * 获取登录二维码URL
   * @param {string} gameType - 游戏类型 (bh3, hk4e, hkrpg, zzz)
   */
  const getLoginQRCode = async (gameType) => {
    try {
      return await window.electronAPI.mihoyoGetQRCode(gameType)
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
      // 直接调用API，不需要包装
      const result = await window.electronAPI.mihoyoQueryQRCode(ticket, gameType)
      
      // 直接返回结果，因为API已经处理了数据格式
      return result
    } catch (error) {
      console.error('查询二维码状态失败:', error)
      throw error
    }
  }

  /**
   * 执行扫码登录
   * @param {string} qrUrl - 二维码URL
   * @param {string} ticket - 二维码票据
   * @param {string} gameType - 游戏类型
   */
  const performQRLogin = async (qrUrl, ticket, gameType) => {
    isLoggingIn.value = true
    loginStatus.value = 'scanning'

    try {
      // 开始轮询二维码状态
      const pollInterval = setInterval(async () => {
        try {
          const status = await queryQRCodeStatus(ticket, gameType)
          
          switch (status.status) {
            case 'Init':
              loginStatus.value = 'scanning'
              break
            case 'Scanned':
              loginStatus.value = 'scanned'
              break
            case 'Confirmed':
              loginStatus.value = 'confirmed'
              clearInterval(pollInterval)
              isLoggingIn.value = false
              
              // 返回登录成功信息
              return {
                success: true,
                uid: status.uid,
                token: status.token
              }
            case 'Expired':
              loginStatus.value = 'expired'
              clearInterval(pollInterval)
              isLoggingIn.value = false
              throw new Error('二维码已过期')
          }
        } catch (error) {
          clearInterval(pollInterval)
          isLoggingIn.value = false
          loginStatus.value = 'error'
          throw error
        }
      }, 2000) // 每2秒查询一次

      // 设置超时
      setTimeout(() => {
        if (isLoggingIn.value) {
          clearInterval(pollInterval)
          isLoggingIn.value = false
          loginStatus.value = 'expired'
          throw new Error('登录超时')
        }
      }, 300000) // 5分钟超时

    } catch (error) {
      isLoggingIn.value = false
      loginStatus.value = 'error'
      throw error
    }
  }


  return {
    isLoggingIn: computed(() => isLoggingIn.value),
    loginStatus: computed(() => loginStatus.value),
    getLoginQRCode,
    queryQRCodeStatus,
    performQRLogin
  }
}
