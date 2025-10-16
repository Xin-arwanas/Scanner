import { ref, computed } from 'vue'

// 设置状态管理
const settings = ref({
  autoScreen: false,
  autoExit: false,
  autoLogin: true
})

export function useSettingsStore() {
  // 加载设置数据
  const loadSettings = async () => {
    try {
      // 从localStorage加载数据
      const data = localStorage.getItem('mhy-scanner-settings')
      if (data) {
        settings.value = { ...settings.value, ...JSON.parse(data) }
      }
    } catch (error) {
      console.error('加载设置数据失败:', error)
    }
  }

  // 保存设置数据
  const saveSettings = async () => {
    try {
      // 保存到localStorage
      localStorage.setItem('mhy-scanner-settings', JSON.stringify(settings.value))
    } catch (error) {
      console.error('保存设置数据失败:', error)
    }
  }

  // 更新设置
  const updateSettings = async (newSettings) => {
    settings.value = { ...settings.value, ...newSettings }
    await saveSettings()
  }

  // 重置设置
  const resetSettings = async () => {
    settings.value = {
      autoScreen: false,
      autoExit: false,
      autoLogin: true
    }
    await saveSettings()
  }

  // 计算属性
  const isAutoScreen = computed(() => settings.value.autoScreen)
  const isAutoExit = computed(() => settings.value.autoExit)
  const isAutoLogin = computed(() => settings.value.autoLogin)

  return {
    // 状态
    settings: computed(() => settings.value),
    isAutoScreen,
    isAutoExit,
    isAutoLogin,

    // 方法
    loadSettings,
    saveSettings,
    updateSettings,
    resetSettings
  }
}
