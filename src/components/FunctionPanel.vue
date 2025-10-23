<template>
  <section class="function-panel">
    <!-- 屏幕扫描功能 -->
    <div class="card">
      <div class="card-header">
        <h3>屏幕扫描</h3>
        <div class="status-indicator" :class="{ active: isScanningScreen }"></div>
      </div>
      <div class="card-content">
        <p>自动识别屏幕上的二维码并登录</p>
        <!-- <div class="options">
          <label class="checkbox-label">
            <input 
              type="checkbox" 
              v-model="localSettings.autoScreen"
              @change="updateSettings"
            >
            <span class="checkmark"></span>
            启动后自动开始识别
          </label>
          <label class="checkbox-label">
            <input 
              type="checkbox" 
              v-model="localSettings.autoExit"
              @change="updateSettings"
            >
            <span class="checkmark"></span>
            识别完成后自动退出
          </label>
        </div> -->
        <button 
          class="btn btn-success btn-large"
          :disabled="!selectedAccount"
          @click="handleScreenScan"
        >
          <span class="icon">📱</span>
          {{ isScanningScreen ? '停止监视' : '开始监视屏幕' }}
        </button>
        
        <!-- 检测统计信息 -->
        <!-- <div v-if="isScanningScreen && detectionStats" class="detection-stats">
          <h4>检测统计</h4>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-label">总尝试次数:</span>
              <span class="stat-value">{{ detectionStats.totalAttempts }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">成功检测:</span>
              <span class="stat-value success">{{ detectionStats.successfulDetections }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">失败检测:</span>
              <span class="stat-value error">{{ detectionStats.failedDetections }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">成功率:</span>
              <span class="stat-value" :class="getSuccessRateClass()">
                {{ getSuccessRate() }}%
              </span>
            </div>
          </div>
        </div> -->
      </div>
    </div>

    <!-- 直播流扫描功能 -->
    <div class="card">
      <div class="card-header">
        <h3>直播流扫描</h3>
        <div class="status-indicator" :class="{ active: isScanningStream }"></div>
      </div>
      <div class="card-content">
        <p>从直播间获取二维码并登录</p>
        <div class="stream-controls">
          <div class="form-group">
            <label for="platformSelect">直播平台：</label>
            <select 
              id="platformSelect" 
              v-model="streamConfig.platform"
              class="form-control"
            >
            <option value="douyin">抖音</option>
              <option value="bilibili">B站</option>
              <!-- <option value="huya">虎牙</option> -->
            </select>
          </div>
          <div class="form-group">
            <label for="roomIdInput">直播间ID：</label>
            <input 
              type="text" 
              id="roomIdInput" 
              v-model="streamConfig.roomId"
              class="form-control" 
              placeholder="输入直播间ID"
            >
          </div>
        </div>
        <button 
          class="btn btn-info btn-large"
          :disabled="!selectedAccount || !streamConfig.roomId"
          @click="handleStreamScan"
        >
          <span class="icon">📺</span>
          {{ isScanningStream ? '停止监视' : '开始监视直播间' }}
        </button>
        
        <!-- 直播流检测统计信息 -->
        <!-- <div v-if="isScanningStream && detectionStats" class="detection-stats">
          <h4>直播流检测统计</h4>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-label">总尝试次数:</span>
              <span class="stat-value">{{ detectionStats.totalAttempts }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">成功检测:</span>
              <span class="stat-value success">{{ detectionStats.successfulDetections }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">失败检测:</span>
              <span class="stat-value error">{{ detectionStats.failedDetections }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">成功率:</span>
              <span class="stat-value" :class="getSuccessRateClass()">
                {{ getSuccessRate() }}%
              </span>
            </div>
          </div>
        </div> -->
      </div>
    </div>

    <!-- 登录选项 -->
    <div class="card">
      <div class="card-header">
        <h3>登录选项</h3>
      </div>
      <div class="card-content">
        <div class="options">
          <label class="checkbox-label">
            <input 
              type="checkbox" 
              v-model="localSettings.autoLogin"
              @change="updateSettings"
            >
            <span class="checkmark"></span>
            自动确认登录
          </label>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, watch, nextTick, onMounted } from 'vue'
import LogPanel from './LogPanel.vue'

// 定义props
const props = defineProps({
  selectedAccount: {
    type: Object,
    default: null
  },
  settings: {
    type: Object,
    default: () => ({})
  },
  isScanningScreen: {
    type: Boolean,
    default: false
  },
  isScanningStream: {
    type: Boolean,
    default: false
  },
  detectionStats: {
    type: Object,
    default: () => ({
      totalAttempts: 0,
      successfulDetections: 0,
      failedDetections: 0
    })
  }
})

// 定义事件
const emit = defineEmits([
  'start-screen-scan',
  'stop-screen-scan', 
  'start-stream-scan',
  'stop-stream-scan',
  'update-settings',
  'add-log'
])

// 响应式数据
const logPanel = ref(null)
const localSettings = reactive({ ...props.settings })
const streamConfig = reactive({
  platform: 'douyin',
  roomId: ''
})

// 方法
const handleScreenScan = () => {
  if (props.isScanningScreen) {
    emit('stop-screen-scan')
  } else {
    emit('start-screen-scan')
  }
}

const handleStreamScan = () => {
  if (props.isScanningStream) {
    emit('stop-stream-scan')
  } else {
    emit('start-stream-scan', streamConfig.platform, streamConfig.roomId)
  }
}

const updateSettings = () => {
  emit('update-settings', { ...localSettings })
}

// 计算成功率
const getSuccessRate = () => {
  if (props.detectionStats.totalAttempts === 0) return 0
  return ((props.detectionStats.successfulDetections / props.detectionStats.totalAttempts) * 100).toFixed(1)
}

// 获取成功率样式类
const getSuccessRateClass = () => {
  const rate = parseFloat(getSuccessRate())
  if (rate >= 80) return 'success'
  if (rate >= 50) return 'warning'
  return 'error'
}

// 监听设置变化
watch(() => props.settings, (newSettings) => {
  Object.assign(localSettings, newSettings)
}, { deep: true })

</script>

<style scoped>
.function-panel {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.function-panel .card{
  margin-bottom: 1rem;
}
.function-panel .card:last-child{
  margin-bottom: 0;
}

.stream-controls {
  margin-bottom: 1rem;
}

.options {
  margin-bottom: 1rem;
}


/* 检测统计样式 */
.detection-stats {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.detection-stats h4 {
  margin: 0 0 1rem 0;
  color: #495057;
  font-size: 1rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: white;
  border-radius: 4px;
  border: 1px solid #dee2e6;
}

.stat-label {
  font-size: 0.9rem;
  color: #6c757d;
  font-weight: 500;
}

.stat-value {
  font-size: 1rem;
  font-weight: 600;
  color: #495057;
}

.stat-value.success {
  color: #28a745;
}

.stat-value.warning {
  color: #ffc107;
}

.stat-value.error {
  color: #dc3545;
}
</style>
