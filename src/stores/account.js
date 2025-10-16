import { ref, computed } from 'vue'

// 账号状态管理
const accounts = ref([])
const selectedAccount = ref(null)

export function useAccountStore() {
  // 加载账号数据
  const loadAccounts = async () => {
    try {
      // 从localStorage加载数据
      const data = localStorage.getItem('mhy-scanner-accounts')
      accounts.value = data ? JSON.parse(data) : []
      
      // 自动选择默认账号
      const defaultAccount = accounts.value.find(acc => acc.isDefault)
      if (defaultAccount) {
        selectedAccount.value = defaultAccount
      } else if (accounts.value.length > 0) {
        selectedAccount.value = accounts.value[0]
      }
    } catch (error) {
      console.error('加载账号数据失败:', error)
      accounts.value = []
    }
  }

  // 保存账号数据
  const saveAccounts = async () => {
    try {
      // 保存到localStorage
      localStorage.setItem('mhy-scanner-accounts', JSON.stringify(accounts.value))
    } catch (error) {
      console.error('保存账号数据失败:', error)
    }
  }

  // 添加账号
  const addAccount = async (accountData) => {
    // 检查UID是否已存在
    const existingAccount = accounts.value.find(acc => acc.uid === accountData.uid)
    if (existingAccount) {
      throw new Error('该UID已存在')
    }

    accounts.value.push(accountData)
    await saveAccounts()
    
    // 如果是第一个账号，自动设为默认
    if (accounts.value.length === 1) {
      await setDefaultAccount(accountData)
    }
  }

  // 删除账号
  const deleteAccount = async (account) => {
    const index = accounts.value.findIndex(acc => acc.id === account.id)
    if (index === -1) {
      throw new Error('账号不存在')
    }

    accounts.value.splice(index, 1)
    await saveAccounts()

    // 如果删除的是当前选中的账号，重新选择
    if (selectedAccount.value?.id === account.id) {
      if (accounts.value.length > 0) {
        selectedAccount.value = accounts.value[0]
      } else {
        selectedAccount.value = null
      }
    }
  }

  // 设置默认账号
  const setDefaultAccount = async (account) => {
    // 清除其他账号的默认状态
    accounts.value.forEach(acc => {
      acc.isDefault = false
    })

    // 设置当前账号为默认
    const targetAccount = accounts.value.find(acc => acc.id === account.id)
    if (targetAccount) {
      targetAccount.isDefault = true
      selectedAccount.value = targetAccount
      await saveAccounts()
    }
  }

  // 选择账号
  const selectAccount = (account) => {
    selectedAccount.value = account
  }

  // 更新账号信息
  const updateAccount = async (accountId, updates) => {
    const account = accounts.value.find(acc => acc.id === accountId)
    if (account) {
      Object.assign(account, updates)
      await saveAccounts()
      
      // 如果更新的是当前选中的账号，更新选中状态
      if (selectedAccount.value?.id === accountId) {
        selectedAccount.value = account
      }
    }
  }

  // 计算属性
  const hasAccounts = computed(() => accounts.value.length > 0)
  const defaultAccount = computed(() => accounts.value.find(acc => acc.isDefault))

  return {
    // 状态
    accounts: computed(() => accounts.value),
    selectedAccount: computed(() => selectedAccount.value),
    hasAccounts,
    defaultAccount,

    // 方法
    loadAccounts,
    saveAccounts,
    addAccount,
    deleteAccount,
    setDefaultAccount,
    selectAccount,
    updateAccount
  }
}
