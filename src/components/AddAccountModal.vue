<template>
  <div class="modal" @click="handleBackdropClick">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>添加账号</h3>
        <span class="close" @click="$emit('close')">&times;</span>
      </div>
      <div class="modal-body">
        <!-- 登录方式选择 -->
        <!-- <div class="login-tabs">
          <div class="tab active">扫码登录</div>
        </div> -->
        
        <!-- 扫码登录说明 -->
        <div class="scan-instructions">
          <p>打开米游社APP，扫一扫登录</p>
        </div>
        
               <!-- 二维码显示区域 -->
               <div class="qr-code-container">
                 <div v-if="!qrCodeUrl" class="qr-loading">
                   <div class="loading-spinner"></div>
                   <p>正在生成二维码...</p>
                 </div>
                 <div v-else class="qr-code">
                   <img :src="qrCodeUrl" alt="登录二维码" />
                   <!-- <div class="qr-info">
                     <p>请使用米游社APP扫描二维码</p>
                     <p v-if="originalUrl" class="qr-url">{{ originalUrl }}</p>
                   </div> -->
                 </div>
               </div>
        
        <!-- 登录状态显示 -->
        <div v-if="loginStatus" class="login-status" :class="loginStatus.type">
          <p>{{ loginStatus.message }}</p>
        </div>
      </div>
      <div class="modal-footer">
        <button 
          type="button" 
          class="btn btn-secondary" 
          @click="$emit('close')"
        >
          取消
        </button>
        <button 
          type="button" 
          class="btn btn-primary" 
          @click="refreshQRCode"
          :disabled="isGenerating"
        >
          {{ isGenerating ? '生成中...' : '刷新二维码' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useMihoyoLogin } from '../composables/useMihoyoLogin'

// 定义事件
const emit = defineEmits(['close', 'add'])

// 使用米哈游登录功能
const { getLoginQRCode, queryQRCodeStatus, performQRLogin } = useMihoyoLogin()

// 响应式数据
const qrCodeUrl = ref('')
const originalUrl = ref('')
const ticket = ref('')
const isGenerating = ref(false)
const loginStatus = ref(null)
const pollInterval = ref(null)

// 方法
const generateQRCode = async () => {
  try {
    isGenerating.value = true
    loginStatus.value = null
    
    // 获取登录二维码（完全模仿MHY_Scanner，使用未定事件簿）
    const qrData = await getLoginQRCode('tears')
    qrCodeUrl.value = qrData.url
    originalUrl.value = qrData.originalUrl
    ticket.value = qrData.ticket
    
    // 开始轮询登录状态
    startPolling()
    
  } catch (error) {
    console.error('生成二维码失败:', error)
    loginStatus.value = {
      type: 'error',
      message: '生成二维码失败: ' + error.message
    }
  } finally {
    isGenerating.value = false
  }
}

const startPolling = () => {
  pollInterval.value = setInterval(async () => {
    try {
      const status = await queryQRCodeStatus(ticket.value, 'tears')
      
      switch (status.status) {
        case 'Init':
          loginStatus.value = {
            type: 'info',
            message: '等待扫码...'
          }
          break
        case 'Scanned':
          loginStatus.value = {
            type: 'warning',
            message: '已扫码，等待确认...'
          }
          break
        case 'Confirmed':
          loginStatus.value = {
            type: 'success',
            message: '登录成功！'
          }
          
                 // 获取SToken和MID
                 let stokenData = null
                 try {
                   stokenData = await window.electronAPI.mihoyoGetStokenByGameToken(status.uid, status.token)
                   console.log('获取到SToken数据:', stokenData)
                 } catch (error) {
                   console.error('获取SToken失败:', error)
                 }
                 
                 // 获取用户信息
                 let userInfo = null
                 try {
                   userInfo = await window.electronAPI.mihoyoGetUserInfo(status.uid)
                   console.log('获取到用户信息:', userInfo)
                 } catch (error) {
                   console.error('获取用户信息失败:', error)
                   // 如果获取用户信息失败，使用默认值
                   userInfo = {
                     uid: status.uid,
                     nickname: '扫码登录用户',
                     avatar: '',
                     level: 0,
                     gender: 0,
                     introduce: ''
                   }
                 }
                 
                 // 创建账号数据
                 const accountData = {
                   id: Date.now().toString(),
                   uid: status.uid,
                   username: userInfo.nickname,
                   game: 'tears',
                   notes: '扫码登录',
                   isDefault: false,
                   createdAt: new Date().toISOString(),
                   // 保存登录凭证（完全模仿MHY_Scanner）
                   loginData: {
                     token: status.token,
                     gameToken: status.token,
                     stoken: stokenData ? stokenData.stoken : null,
                     mid: stokenData ? stokenData.mid : null,
                     loginTime: new Date().toISOString()
                   },
                   // 保存用户信息
                   userInfo: {
                     nickname: userInfo.nickname,
                     avatar: userInfo.avatar,
                     level: userInfo.level,
                     gender: userInfo.gender,
                     introduce: userInfo.introduce
                   }
                 }
          
          emit('add', accountData)
          stopPolling()
          emit('close')
          break
        case 'Expired':
          loginStatus.value = {
            type: 'error',
            message: '二维码已过期，请刷新'
          }
          stopPolling()
          break
      }
    } catch (error) {
      console.error('查询登录状态失败:', error)
      loginStatus.value = {
        type: 'error',
        message: '查询登录状态失败'
      }
    }
         }, 1000) // 每1秒查询一次，与原程序保持一致
}

const stopPolling = () => {
  if (pollInterval.value) {
    clearInterval(pollInterval.value)
    pollInterval.value = null
  }
}

const refreshQRCode = () => {
  stopPolling()
  generateQRCode()
}

const handleBackdropClick = (event) => {
  if (event.target === event.currentTarget) {
    emit('close')
  }
}

// 生命周期
onMounted(() => {
  generateQRCode()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.modal {
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  background: white;
  padding: 0;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: modalSlideIn 0.3s ease;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-50px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  padding: 1rem;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  color: #2c3e50;
}

.close {
  color: #aaa;
  font-size: 28px;
  font-weight: bold;
  cursor: pointer;
  transition: color 0.3s ease;
}

.close:hover {
  color: #000;
}

.modal-body {
  padding: 1.5rem;
  text-align: center;
}

/* 登录方式标签 */
.login-tabs {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
}

.tab {
  padding: 0.5rem 1rem;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.tab.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

/* 扫码说明 */
.scan-instructions {
  margin-bottom: 1.5rem;
}

.scan-instructions p {
  color: #666;
  font-size: 0.9rem;
  margin: 0;
}

/* 二维码容器 */
.qr-code-container {
  margin-bottom: 1.5rem;
}

.qr-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

       .qr-code {
         display: flex;
         flex-direction: column;
         align-items: center;
       }

       .qr-code img {
         max-width: 200px;
         max-height: 200px;
         border: 1px solid #ddd;
         border-radius: 8px;
         margin-bottom: 1rem;
       }

       .qr-info {
         text-align: center;
         font-size: 0.8rem;
         color: #666;
       }

       .qr-info p {
         margin: 0.25rem 0;
       }

       .qr-url {
         word-break: break-all;
         font-family: monospace;
         background: #f5f5f5;
         padding: 0.5rem;
         border-radius: 4px;
         font-size: 0.7rem;
         max-width: 300px;
         margin: 0 auto;
       }

/* 登录状态 */
.login-status {
  padding: 0.75rem;
  border-radius: 6px;
  margin-bottom: 1rem;
}

.login-status.info {
  background: #e3f2fd;
  color: #1976d2;
  border: 1px solid #bbdefb;
}

.login-status.warning {
  background: #fff3e0;
  color: #f57c00;
  border: 1px solid #ffcc02;
}

.login-status.success {
  background: #e8f5e8;
  color: #2e7d32;
  border: 1px solid #a5d6a7;
}

.login-status.error {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ef9a9a;
}

.modal-footer {
  padding: 1rem;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
