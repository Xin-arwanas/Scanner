<template>
  <div id="app">
    <Header @add-account="showAddAccountModal = true" />
    <main class="main-content">
      <section class="left-column">
        <AccountPanel 
          :accounts="accounts"
          :selected-account="selectedAccount"
          @add-account="showAddAccountModal = true"
          @select-account="selectAccount"
          @delete-account="deleteAccount"
          @set-default="setDefaultAccount"
          @update-account="updateAccount"
        />
        <div class="left-log">
          <LogPanel 
            :enable-console-intercept="true"
            :enable-worker-logs="true"
            :max-logs="500"
          />
        </div>
      </section>
      <section class="right-column">
        <FunctionPanel
          :selected-account="selectedAccount"
          :settings="settings"
          :is-scanning-screen="isScanningScreen"
          :is-scanning-stream="isScanningStream"
          :detection-stats="detectionStats"
          @start-screen-scan="startScreenScan"
          @stop-screen-scan="stopScreenScan"
          @start-stream-scan="startStreamScan"
          @stop-stream-scan="stopStreamScan"
          @update-settings="updateSettings"
          @add-log="addLog"
        />
      </section>
    </main>
    
    <AddAccountModal
      v-if="showAddAccountModal"
      @close="showAddAccountModal = false"
      @add="addAccount"
    />
    
    <LoginConfirmModal
      v-if="showLoginConfirmModal"
      :visible="showLoginConfirmModal"
      :qr-info="currentQRInfo"
      :account="selectedAccount"
      @close="closeLoginConfirmModal"
      @login-success="handleLoginConfirm"
    />
    
    <QRTestModal
      v-if="showQRTestModal"
      :show="showQRTestModal"
      @close="showQRTestModal = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Header from './components/Header.vue'
import AccountPanel from './components/AccountPanel.vue'
import FunctionPanel from './components/FunctionPanel.vue'
import LogPanel from './components/LogPanel.vue'
import AddAccountModal from './components/AddAccountModal.vue'
import LoginConfirmModal from './components/LoginConfirmModal.vue'
import QRTestModal from './components/QRTestModal.vue'
import { useAccountStore } from './stores/account'
import { useSettingsStore } from './stores/settings'
import { useQRScanner } from './composables/useQRScanner'
import { useStreamMonitor } from './composables/useStreamMonitor'

// 响应式数据
const showAddAccountModal = ref(false)
const showLoginConfirmModal = ref(false)
const showQRTestModal = ref(false)
const isScanningScreen = ref(false)
const isScanningStream = ref(false)
const currentQRInfo = ref(null)

// 使用stores
const accountStore = useAccountStore()
const settingsStore = useSettingsStore()

// 使用composables
const { startScreenScan: startQRScan, stopScreenScan: stopQRScan, performAutoLogin, detectionStats } = useQRScanner()
const { startStreamScan: startStreamScanCore, stopStreamScan: stopStreamScanCore } = useStreamMonitor()

// 计算属性
const accounts = computed(() => accountStore.accounts.value)
const selectedAccount = computed(() => accountStore.selectedAccount.value)
const settings = computed(() => settingsStore.settings.value)

// 方法
const selectAccount = (account) => {
  accountStore.selectAccount(account)
}

const addAccount = async (accountData) => {
  await accountStore.addAccount(accountData)
  showAddAccountModal.value = false
}

const deleteAccount = async (account) => {
  await accountStore.deleteAccount(account)
}

const setDefaultAccount = async (account) => {
  await accountStore.setDefaultAccount(account)
}

const updateAccount = async (accountId, updates) => {
  await accountStore.updateAccount(accountId, updates)
}

const updateSettings = async (newSettings) => {
  await settingsStore.updateSettings(newSettings)
}

const addLog = (message, type = 'info') => {
  // 这里可以添加日志功能
  console.log(`[${type.toUpperCase()}] ${message}`)
}

// 屏幕扫描控制
const startScreenScan = async () => {
  if (!selectedAccount.value) {
    await window.electronAPI.showMessageBox({
      type: 'warning',
      title: '提示',
      message: '请先选择一个账号'
    })
    return
  }
  
  isScanningScreen.value = true
  try {
    await startQRScan(
      selectedAccount.value, 
      settings.value,
      (qrData) => {
        addLog(`检测到二维码: ${qrData}`, 'success')
      }, 
      settings.value.autoLogin ? null : (qrInfo, account) => {
        // 只有在未启用自动登录时才显示登录确认对话框
        currentQRInfo.value = qrInfo
        showLoginConfirmModal.value = true
        // 重置扫描状态，因为已经检测到二维码并停止扫描
        isScanningScreen.value = false
      },
      settings.value.autoLogin ? async (qrInfo, account) => {
        // 只有在启用自动登录时才执行自动确认登录
        addLog(`开始自动确认登录: ${qrInfo.gameType}`, 'info')
        const loginResult = await performAutoLogin(qrInfo, account)
        if (loginResult.success) {
          addLog(`自动确认登录成功`, 'success')
          // 登录成功，可以在这里处理后续逻辑
        } else {
          addLog(`自动确认登录失败: ${loginResult.error}`, 'error')
        }
        // 无论成功还是失败，都要重置扫描状态
        isScanningScreen.value = false
      } : null
    )
  } catch (error) {
    addLog(`屏幕扫描错误: ${error.message}`, 'error')
    isScanningScreen.value = false
  }
}

const stopScreenScan = () => {
  stopQRScan()
  isScanningScreen.value = false
  addLog('停止屏幕扫描', 'info')
}

// 登录确认对话框处理
const handleLoginConfirm = async (loginData) => {
  try {
    const { qrInfo, account, loginResult } = loginData
    
    addLog(`登录成功: ${loginResult.userInfo.nickname}`, 'success')
    
    // 这里可以处理登录成功后的逻辑
    // 比如保存账号信息、更新界面等
    
    showLoginConfirmModal.value = false
    currentQRInfo.value = null
    
  } catch (error) {
    addLog(`登录处理失败: ${error.message}`, 'error')
  }
}

const closeLoginConfirmModal = () => {
  showLoginConfirmModal.value = false
  currentQRInfo.value = null
}

// 直播流扫描控制
const startStreamScan = async (platform, roomId) => {
  if (!selectedAccount.value) {
    await window.electronAPI.showMessageBox({
      type: 'warning',
      title: '提示',
      message: '请先选择一个账号'
    })
    return
  }
  
  isScanningStream.value = true
  try {
    await startStreamScanCore(
      platform, 
      roomId, 
      selectedAccount.value,
      (qrData) => {
        addLog(`从直播流检测到二维码: ${qrData}`, 'success')
      },
      (qrInfo, account) => {
        // 显示登录确认对话框
        currentQRInfo.value = qrInfo
        showLoginConfirmModal.value = true
        // 重置扫描状态，因为已经检测到二维码并停止扫描
        isScanningStream.value = false
      },
      async (qrInfo, account) => {
        // 执行自动确认登录
        addLog(`开始自动确认登录: ${qrInfo.gameType}`, 'info')
        const loginResult = await performAutoLogin(qrInfo, account)
        if (loginResult.success) {
          addLog(`自动确认登录成功`, 'success')
          alert('登录成功')
          // 登录成功，可以在这里处理后续逻辑
        } else {
          addLog(`自动确认登录失败: ${loginResult.error}`, 'error')
        }
        // 无论成功还是失败，都要重置扫描状态
        isScanningStream.value = false
      }
    )
  } catch (error) {
    addLog(`直播流扫描错误: ${error.message}`, 'error')
    isScanningStream.value = false
  }
}

const stopStreamScan = () => {
  stopStreamScanCore()
  isScanningStream.value = false
  addLog('停止直播流扫描', 'info')
}

// 生命周期
onMounted(async () => {
  // 加载数据
  await accountStore.loadAccounts()
  await settingsStore.loadSettings()
  
  // 监听菜单事件
  window.electronAPI.onMenuAddAccount(() => {
    showAddAccountModal.value = true
  })
  
  window.electronAPI.onMenuScanScreen(() => {
    if (!isScanningScreen.value) {
      startScreenScan()
    } else {
      stopScreenScan()
    }
  })
  
  window.electronAPI.onMenuScanStream(() => {
    // 这里可以添加默认的直播流扫描逻辑
    addLog('请使用界面上的直播流扫描功能', 'info')
  })
})

onUnmounted(() => {
  // 清理监听器
  window.electronAPI.removeAllListeners('menu-add-account')
  window.electronAPI.removeAllListeners('menu-scan-screen')
  window.electronAPI.removeAllListeners('menu-scan-stream')
})
</script>

<style scoped>
.debug-buttons {
  position: fixed;
  top: 10px;
  right: 10px;
  z-index: 1000;
}

.debug-btn {
  background: #ff6b6b;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.debug-btn:hover {
  background: #ff5252;
}

.main-content {
  display: flex;
  height: calc(100vh - 60px);
  gap: 1rem;
  padding: 1rem;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  overflow: auto;
}

.left-column {
  display: flex;
  flex-direction: column;
  width: 50%;
  gap: 1rem;
}

.account-panel{
  height: 50%;
}

.left-log {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  flex:1;
  min-height: 0;
}

.right-column {
  flex: 1;
  min-width: 0;
}

/* @media (max-width: 1024px) {
  .main-content {
    flex-direction: column;
  }
} */
</style>
