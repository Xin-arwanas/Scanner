<template>
  <div v-if="visible" class="modal-overlay" @click="handleOverlayClick">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>登录确认</h3>
        <button class="close-btn" @click="closeModal">×</button>
      </div>
      
      <div class="modal-body">
        <div class="login-info">
          <div class="info-item">
            <label>游戏类型:</label>
            <span class="game-type">{{ getGameTypeName(qrInfo?.gameType) }}</span>
          </div>
          <div class="info-item">
            <label>当前账号:</label>
            <span class="account-name">{{ account?.nickname || account?.uid || '未知' }}</span>
          </div>
          <div class="info-item">
            <label>票据:</label>
            <span class="ticket">{{ qrInfo?.ticket }}</span>
          </div>
        </div>
        
        <div class="status-message">
          <p v-if="status === 'scanning'">正在扫描二维码...</p>
          <p v-if="status === 'scanned'">二维码已扫描，等待确认登录</p>
          <p v-if="status === 'confirming'">正在确认登录...</p>
          <p v-if="status === 'success'">登录成功！</p>
          <p v-if="status === 'error'">登录失败: {{ errorMessage }}</p>
        </div>
        
        <div class="progress-bar" v-if="status === 'confirming'">
          <div class="progress-fill"></div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button 
          v-if="status === 'scanned'" 
          class="btn btn-primary" 
          @click="confirmLogin"
          :disabled="isLoading"
        >
          确认登录
        </button>
        <button 
          v-if="status === 'success'" 
          class="btn btn-success" 
          @click="closeModal"
        >
          完成
        </button>
        <button 
          v-if="status === 'error'" 
          class="btn btn-secondary" 
          @click="closeModal"
        >
          关闭
        </button>
        <button 
          v-if="status !== 'success' && status !== 'error'" 
          class="btn btn-secondary" 
          @click="closeModal"
        >
          取消
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useAccountStore } from '../stores/account.js'
import { useQRScanner } from '../composables/useQRScanner.js'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  qrInfo: {
    type: Object,
    default: null
  },
  account: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'login-success'])

const accountStore = useAccountStore()
const { confirmLogin: qrConfirmLogin } = useQRScanner()
const status = ref('scanning')
const isLoading = ref(false)
const errorMessage = ref('')

// 监听二维码信息变化
watch(() => props.qrInfo, (newQrInfo) => {
  if (newQrInfo) {
    status.value = 'scanned'
  }
}, { immediate: true })

// 获取游戏类型名称
const getGameTypeName = (gameType) => {
  const gameNames = {
    bh3: '崩坏3',
    hk4e: '原神',
    hkrpg: '星穹铁道',
    zzz: '绝区零'
  }
  return gameNames[gameType] || '未知'
}

// 确认登录
const confirmLogin = async () => {
  if (!props.qrInfo || !props.account) {
    return
  }
  
  isLoading.value = true
  status.value = 'confirming'
  
  try {
    // console.log('开始确认登录流程:', { qrInfo: props.qrInfo, account: props.account })
    
    // 使用useQRScanner的confirmLogin函数，确保与自动登录逻辑一致
    const confirmResult = await qrConfirmLogin(
      props.account.uid, 
      props.account.loginData.gameToken, 
      props.qrInfo.ticket, 
      props.qrInfo.gameType
    )
    
    if (!confirmResult.success) {
      throw new Error(confirmResult.error)
    }
    
    // console.log('确认登录成功')
    
    // 获取SToken
    const stokenResult = await window.electronAPI.mihoyoGetStokenByGameToken(
      props.account.uid, 
      props.account.loginData.gameToken
    )
    if (!stokenResult) {
      throw new Error('获取SToken失败')
    }
    
    console.log('获取SToken成功:', stokenResult)
    
    // 获取用户信息
    const userInfo = await window.electronAPI.mihoyoGetUserInfo(props.account.uid)
    if (!userInfo) {
      throw new Error('获取用户信息失败')
    }
    
    console.log('获取用户信息成功:', userInfo)
    
    status.value = 'success'
    emit('login-success', {
      qrInfo: props.qrInfo,
      account: props.account,
      loginResult: {
        uid: props.account.uid,
        gameToken: props.account.loginData.gameToken,
        stoken: stokenResult.stoken,
        mid: stokenResult.mid,
        userInfo: userInfo,
        gameType: props.qrInfo.gameType
      }
    })
    
  } catch (error) {
    console.error('登录失败:', error)
    status.value = 'error'
    errorMessage.value = error.message || '未知错误'
  } finally {
    isLoading.value = false
  }
}

// 关闭模态框
const closeModal = () => {
  emit('close')
}

// 点击遮罩层关闭
const handleOverlayClick = () => {
  if (status.value === 'success' || status.value === 'error') {
    closeModal()
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h3 {
  margin: 0;
  color: #333;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
}

.login-info {
  margin-bottom: 20px;
}

.info-item {
  display: flex;
  margin-bottom: 10px;
}

.info-item label {
  font-weight: bold;
  width: 80px;
  color: #666;
}

.info-item span {
  color: #333;
}

.game-type {
  color: #007bff;
  font-weight: bold;
}

.account-name {
  color: #28a745;
  font-weight: bold;
}

.ticket {
  font-family: monospace;
  font-size: 12px;
  color: #666;
  word-break: break-all;
}

.status-message {
  text-align: center;
  margin-bottom: 20px;
}

.status-message p {
  margin: 0;
  font-size: 16px;
  color: #333;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background-color: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 20px;
}

.progress-fill {
  height: 100%;
  background-color: #007bff;
  animation: progress 2s ease-in-out infinite;
}

@keyframes progress {
  0% { width: 0%; }
  50% { width: 70%; }
  100% { width: 100%; }
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 20px;
  border-top: 1px solid #e0e0e0;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-success {
  background-color: #28a745;
  color: white;
}

.btn-success:hover {
  background-color: #1e7e34;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background-color: #545b62;
}
</style>
