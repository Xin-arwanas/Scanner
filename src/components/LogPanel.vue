<template>
  <div class="log-panel">
    <div class="log-header">
      <h3>运行日志</h3>
      <div class="log-controls">
        <select v-model="logFilter" class="log-filter">
          <option value="all">全部日志</option>
          <option value="info">信息</option>
          <option value="success">成功</option>
          <option value="warning">警告</option>
          <option value="error">错误</option>
        </select>
        <button class="btn btn-small" @click="toggleLogAutoScroll" :class="{ active: autoScroll }">
          {{ autoScroll ? '停止自动滚动' : '自动滚动' }}
        </button>
        <button class="btn btn-small" @click="exportLogs">导出</button>
        <button class="btn btn-small" @click="clearLogs">清空</button>
      </div>
    </div>
    <div class="log-content">
      <div class="log-container" ref="logContainer">
        <div 
          v-for="(log, index) in filteredLogs" 
          :key="index"
          class="log-entry"
          :class="log.type"
        >
          <span class="log-time">[{{ formatTime(log.timestamp) }}]</span>
          <span class="log-message" v-html="formatLogMessage(log.message)"></span>
        </div>
        <div v-if="filteredLogs.length === 0" class="log-empty">
          {{ logs.length === 0 ? '暂无日志' : '没有匹配的日志' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, nextTick, onMounted, computed } from 'vue'

// 定义props
const props = defineProps({
  // 是否启用console拦截
  enableConsoleIntercept: {
    type: Boolean,
    default: true
  },
  // 是否启用Worker日志监听
  enableWorkerLogs: {
    type: Boolean,
    default: true
  },
  // 日志高度
  height: {
    type: String,
    default: '300px'
  },
  // 最大日志数量
  maxLogs: {
    type: Number,
    default: 500
  }
})

// 定义事件
const emit = defineEmits([
  'log-added',
  'logs-cleared',
  'logs-exported'
])

// 响应式数据
const logs = ref([])
const logContainer = ref(null)
const autoScroll = ref(true)
const logFilter = ref('all')

// 计算属性：过滤后的日志
const filteredLogs = computed(() => {
  if (logFilter.value === 'all') {
    return logs.value
  }
  return logs.value.filter(log => log.type === logFilter.value)
})

// 方法
const addLog = (message, type = 'info') => {
  logs.value.push({
    message,
    type,
    timestamp: new Date()
  })
  
  // 自动滚动到底部
  if (autoScroll.value) {
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight
      }
    })
  }
  
  // 限制日志数量
  if (logs.value.length > props.maxLogs) {
    logs.value = logs.value.slice(-props.maxLogs)
  }
  
  // 触发事件
  emit('log-added', { message, type, timestamp: new Date() })
}

const clearLogs = () => {
  logs.value = []
  emit('logs-cleared')
}

const toggleLogAutoScroll = () => {
  autoScroll.value = !autoScroll.value
  if (autoScroll.value) {
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight
      }
    })
  }
}

const exportLogs = () => {
  if (logs.value.length === 0) {
    addLog('没有日志可导出', 'warning')
    return
  }
  
  const logText = logs.value.map(log => {
    const time = formatTime(log.timestamp)
    return `[${time}] [${log.type.toUpperCase()}] ${log.message}`
  }).join('\n')
  
  const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `logs_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  
  addLog(`已导出 ${logs.value.length} 条日志`, 'success')
  emit('logs-exported', logs.value.length)
}

const formatTime = (timestamp) => {
  return timestamp.toLocaleTimeString()
}

const formatLogMessage = (message) => {
  // 如果消息包含JSON格式，进行美化显示
  if (typeof message === 'string' && message.includes('{')) {
    try {
      // 尝试提取JSON部分并美化
      const jsonMatch = message.match(/\{.*\}/s)
      if (jsonMatch) {
        const jsonStr = jsonMatch[0]
        const parsed = JSON.parse(jsonStr)
        const formatted = JSON.stringify(parsed, null, 2)
        return message.replace(jsonStr, `<pre class="json-content">${formatted}</pre>`)
      }
    } catch (e) {
      // 如果解析失败，返回原消息
    }
  }
  
  // 转义HTML特殊字符
  return message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br>')
}

// 拦截console日志
const interceptConsole = () => {
  if (!props.enableConsoleIntercept) return
  
  const originalLog = console.log
  const originalWarn = console.warn
  const originalError = console.error
  const originalInfo = console.info

  // 格式化参数为字符串
  const formatArgs = (args) => {
    return args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2)
        } catch (e) {
          return String(arg)
        }
      }
      return String(arg)
    }).join(' ')
  }

  console.log = (...args) => {
    originalLog.apply(console, args)
    addLog(formatArgs(args), 'info')
  }

  console.warn = (...args) => {
    originalWarn.apply(console, args)
    addLog(formatArgs(args), 'warning')
  }

  console.error = (...args) => {
    originalError.apply(console, args)
    addLog(formatArgs(args), 'error')
  }

  console.info = (...args) => {
    originalInfo.apply(console, args)
    addLog(formatArgs(args), 'info')
  }
}

// 监听Worker日志
const setupWorkerLogListener = () => {
  if (!props.enableWorkerLogs || !window.electronAPI || !window.electronAPI.onWorkerLog) {
    return
  }
  
  window.electronAPI.onWorkerLog((payload) => {
    addLog(payload.message, payload.level)
  })
}

// 暴露方法给父组件
defineExpose({
  addLog,
  clearLogs,
  exportLogs,
  logs: logs.value
})

onMounted(() => {
  addLog('日志面板已启动', 'info')
  interceptConsole()
  setupWorkerLogListener()
  
  if (props.enableConsoleIntercept) {
    addLog('Console日志拦截已启用', 'success')
  }
  if (props.enableWorkerLogs) {
    addLog('Worker日志监听已启用', 'success')
  }
})
</script>

<style scoped>
.log-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  background: white;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
}

.log-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.1rem;
}

.log-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.log-filter {
  padding: 0.25rem 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  font-size: 0.8rem;
  min-width: 100px;
}

.log-controls .btn.active {
  background-color: #007bff;
  color: white;
}

.log-content {
  flex: 1;
  overflow: hidden;
}

.log-container {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 1rem;
  height: v-bind(height);
  overflow-y: auto;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  border: 1px solid #333;
  height: 100%;
}

.log-container::-webkit-scrollbar {
  width: 8px;
}

.log-container::-webkit-scrollbar-track {
  background: #2d2d2d;
  border-radius: 4px;
}

.log-container::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 4px;
}

.log-container::-webkit-scrollbar-thumb:hover {
  background: #777;
}

.log-entry {
  margin-bottom: 0.5rem;
  padding: 0.25rem 0;
  display: flex;
  align-items: flex-start;
  word-break: break-all;
}

.log-time {
  color: #888;
  margin-right: 0.5rem;
  flex-shrink: 0;
  font-size: 0.8rem;
}

.log-message {
  flex: 1;
}

.log-entry.info .log-message {
  color: #4fc3f7;
}

.log-entry.success .log-message {
  color: #81c784;
}

.log-entry.warning .log-message {
  color: #ffb74d;
}

.log-entry.error .log-message {
  color: #e57373;
}

.log-empty {
  text-align: center;
  color: #888;
  font-style: italic;
  padding: 2rem;
}

.json-content {
  background: #2d2d2d;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 0.5rem;
  margin: 0.25rem 0;
  font-size: 0.8rem;
  color: #d4d4d4;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
}
</style>
