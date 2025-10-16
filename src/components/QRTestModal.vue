<template>
  <div v-if="show" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>二维码检测测试</h3>
        <button @click="closeModal" class="close-btn">&times;</button>
      </div>
      
      <div class="modal-body">
        <div class="test-section">
          <h4>屏幕截图测试</h4>
          <button @click="testScreenshot" :disabled="isLoading" class="test-btn">
            {{ isLoading ? '测试中...' : '测试屏幕截图' }}
          </button>
          
          <div v-if="screenshotData" class="result-section">
            <h5>截图结果：</h5>
            <p>数据长度: {{ screenshotData.length }}</p>
            <img :src="screenshotData" alt="屏幕截图" class="screenshot-preview" />
          </div>
        </div>
        
        <div class="test-section">
          <h4>二维码检测测试</h4>
          <button @click="testQRDetection" :disabled="isLoading" class="test-btn">
            {{ isLoading ? '检测中...' : '测试二维码检测' }}
          </button>
          
          <div v-if="qrResult" class="result-section">
            <h5>检测结果：</h5>
            <p>二维码内容: {{ qrResult }}</p>
            <p>长度: {{ qrResult.length }}</p>
            <p>游戏类型: {{ getGameType(qrResult) }}</p>
            <p>Ticket: {{ getTicket(qrResult) }}</p>
          </div>
          
          <div v-if="qrError" class="error-section">
            <h5>检测错误：</h5>
            <p>{{ qrError }}</p>
          </div>
        </div>
        
        <div class="test-section">
          <h4>连续检测测试</h4>
          <button @click="startContinuousTest" :disabled="isContinuousTesting" class="test-btn">
            {{ isContinuousTesting ? '停止测试' : '开始连续检测' }}
          </button>
          
          <div v-if="continuousResults.length > 0" class="result-section">
            <h5>连续检测结果：</h5>
            <div class="continuous-results">
              <div v-for="(result, index) in continuousResults" :key="index" class="result-item">
                <span class="timestamp">{{ result.timestamp }}</span>
                <span class="status" :class="result.success ? 'success' : 'failed'">
                  {{ result.success ? '检测到' : '未检测到' }}
                </span>
                <span v-if="result.qrData" class="qr-data">{{ result.qrData.substring(0, 50) }}...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { useQRScanner } from '../composables/useQRScanner.js'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const { decodeQRFromBase64 } = useQRScanner()

const isLoading = ref(false)
const screenshotData = ref(null)
const qrResult = ref(null)
const qrError = ref(null)
const isContinuousTesting = ref(false)
const continuousResults = ref([])
const continuousInterval = ref(null)

const testScreenshot = async () => {
  isLoading.value = true
  screenshotData.value = null
  qrResult.value = null
  qrError.value = null
  
  try {
    console.log('开始测试屏幕截图...')
    const data = await window.electronAPI.captureScreen()
    if (data) {
      screenshotData.value = data
      console.log('屏幕截图成功，长度:', data.length)
    } else {
      qrError.value = '屏幕截图失败：未获取到数据'
    }
  } catch (error) {
    console.error('屏幕截图测试失败:', error)
    qrError.value = `屏幕截图失败: ${error.message}`
  } finally {
    isLoading.value = false
  }
}

const testQRDetection = async () => {
  if (!screenshotData.value) {
    qrError.value = '请先进行屏幕截图测试'
    return
  }
  
  isLoading.value = true
  qrResult.value = null
  qrError.value = null
  
  try {
    console.log('开始测试二维码检测...')
    const result = await decodeQRFromBase64(screenshotData.value)
    if (result) {
      qrResult.value = result
      console.log('二维码检测成功:', result)
    } else {
      qrError.value = '未检测到二维码'
    }
  } catch (error) {
    console.error('二维码检测失败:', error)
    qrError.value = `二维码检测失败: ${error.message}`
  } finally {
    isLoading.value = false
  }
}

const startContinuousTest = () => {
  if (isContinuousTesting.value) {
    // 停止测试
    if (continuousInterval.value) {
      clearInterval(continuousInterval.value)
      continuousInterval.value = null
    }
    isContinuousTesting.value = false
    return
  }
  
  // 开始测试
  isContinuousTesting.value = true
  continuousResults.value = []
  
  continuousInterval.value = setInterval(async () => {
    try {
      const data = await window.electronAPI.captureScreen()
      if (data) {
        const result = await decodeQRFromBase64(data)
        const timestamp = new Date().toLocaleTimeString()
        
        continuousResults.value.unshift({
          timestamp,
          success: !!result,
          qrData: result
        })
        
        // 只保留最近20条记录
        if (continuousResults.value.length > 20) {
          continuousResults.value = continuousResults.value.slice(0, 20)
        }
      }
    } catch (error) {
      console.error('连续检测错误:', error)
    }
  }, 1000) // 每秒检测一次
}

const getGameType = (qrString) => {
  if (!qrString || qrString.length < 82) return '未知'
  const gameTypeView = qrString.substring(79, 82)
  const gameTypeMap = {
    '8F3': '崩坏3',
    '9E&': '原神',
    '8F%': '星穹铁道',
    '%BA': '绝区零'
  }
  return gameTypeMap[gameTypeView] || '未知'
}

const getTicket = (qrString) => {
  if (!qrString || qrString.length < 24) return '未知'
  return qrString.substring(qrString.length - 24)
}

const closeModal = () => {
  if (continuousInterval.value) {
    clearInterval(continuousInterval.value)
    continuousInterval.value = null
  }
  isContinuousTesting.value = false
  emit('close')
}

onUnmounted(() => {
  if (continuousInterval.value) {
    clearInterval(continuousInterval.value)
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-body {
  padding: 1rem;
}

.test-section {
  margin-bottom: 2rem;
  padding: 1rem;
  border: 1px solid #eee;
  border-radius: 4px;
}

.test-section h4 {
  margin: 0 0 1rem 0;
  color: #333;
}

.test-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 1rem;
}

.test-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.result-section {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 4px;
  margin-top: 1rem;
}

.result-section h5 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

.screenshot-preview {
  max-width: 100%;
  max-height: 300px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.error-section {
  background: #f8d7da;
  color: #721c24;
  padding: 1rem;
  border-radius: 4px;
  margin-top: 1rem;
}

.continuous-results {
  max-height: 300px;
  overflow-y: auto;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem;
  border-bottom: 1px solid #eee;
}

.timestamp {
  font-family: monospace;
  font-size: 0.9rem;
  color: #666;
  min-width: 80px;
}

.status {
  font-weight: bold;
  min-width: 60px;
}

.status.success {
  color: #28a745;
}

.status.failed {
  color: #dc3545;
}

.qr-data {
  font-family: monospace;
  font-size: 0.8rem;
  color: #666;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
