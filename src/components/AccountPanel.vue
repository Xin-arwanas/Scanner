<template>
  <aside class="account-panel">
    <div class="panel-header">
      <h2>账号管理</h2>
      <div class="account-controls">
        <button 
          class="btn btn-small" 
          :disabled="!selectedAccount"
          @click="$emit('set-default', selectedAccount)"
        >
          设为默认
        </button>
        <button 
          class="btn btn-small btn-danger" 
          :disabled="!selectedAccount"
          @click="$emit('delete-account', selectedAccount)"
        >
          删除
        </button>
      </div>
    </div>
    <div class="account-list">
      <table class="table">
        <thead>
          <tr>
            <th>UID</th>
            <th>用户名</th>
            <!-- <th>状态</th> -->
            <th>备注</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="account in accounts" 
            :key="account?.id || account?.uid"
            :class="{ selected: selectedAccount?.id === account?.id }"
            @click="$emit('select-account', account)"
          >
            <td>{{ account?.uid || '-' }}</td>
            <td>
              <div class="user-info">
                <span>{{ account?.username || '-' }}</span>
              </div>
            </td>
            <!-- <td>
              <span class="status-tag" :class="getStatusClass(account)">
                {{ getStatusText(account) }}
              </span>
            </td> -->
            <td>
              <div class="notes-cell">
                <span v-if="!editingNotes || editingNotes !== account.id">
                  {{ account?.notes || '-' }}
                </span>
                <input 
                  v-else
                  v-model="editingNotesValue"
                  @blur="saveNotes(account)"
                  @keyup.enter="saveNotes(account)"
                  @keyup.escape="cancelEditNotes"
                  class="notes-input"
                  ref="notesInput"
                />
              </div>
            </td>
            <td>
              <div class="action-buttons">
                <button 
                  v-if="!editingNotes || editingNotes !== account.id"
                  class="btn btn-tiny btn-secondary"
                  @click="editNotes(account)"
                >
                  编辑备注
                </button>
                <button 
                  v-else
                  class="btn btn-tiny btn-primary"
                  @click="saveNotes(account)"
                >
                  保存
                </button>
                <button 
                  v-if="editingNotes === account.id"
                  class="btn btn-tiny btn-secondary"
                  @click="cancelEditNotes"
                >
                  取消
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="accounts.length === 0" class="empty-state">
        <p>暂无账号，点击"添加账号"开始使用</p>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref } from 'vue'

// 定义props
const props = defineProps({
  accounts: {
    type: Array,
    default: () => []
  },
  selectedAccount: {
    type: Object,
    default: null
  }
})

// 定义事件
const emit = defineEmits(['select-account', 'delete-account', 'set-default', 'update-account'])

// 编辑备注相关
const editingNotes = ref(null)
const editingNotesValue = ref('')

// 游戏名称映射
const gameNames = {
  bh3: '崩坏3',
  hk4e: '原神',
  hkrpg: '星穹铁道',
  zzz: '绝区零'
}

// 游戏样式类映射
const gameClasses = {
  bh3: 'game-bh3',
  hk4e: 'game-hk4e',
  hkrpg: 'game-hkrpg',
  zzz: 'game-zzz'
}

// 方法
const getGameName = (game) => {
  return gameNames[game] || game
}

const getGameClass = (game) => {
  return gameClasses[game] || ''
}

// 获取账号状态
const getStatusText = (account) => {
  if (!account?.loginData) {
    return '未登录'
  }
  
  const loginTime = new Date(account.loginData.loginTime)
  const now = new Date()
  const diffHours = (now - loginTime) / (1000 * 60 * 60)
  
  if (diffHours < 24) {
    return '已登录'
  } else if (diffHours < 72) {
    return '即将过期'
  } else {
    return '已过期'
  }
}

const getStatusClass = (account) => {
  if (!account?.loginData) {
    return 'status-offline'
  }
  
  const loginTime = new Date(account.loginData.loginTime)
  const now = new Date()
  const diffHours = (now - loginTime) / (1000 * 60 * 60)
  
  if (diffHours < 24) {
    return 'status-online'
  } else if (diffHours < 72) {
    return 'status-warning'
  } else {
    return 'status-expired'
  }
}

// 编辑备注方法
const editNotes = (account) => {
  editingNotes.value = account.id
  editingNotesValue.value = account.notes || ''
  // 下一个tick聚焦输入框
  setTimeout(() => {
    const input = document.querySelector('.notes-input')
    if (input) input.focus()
  }, 0)
}

const saveNotes = (account) => {
  if (editingNotes.value === account.id) {
    // 触发更新事件
    emit('update-account', account.id, { notes: editingNotesValue.value })
    editingNotes.value = null
    editingNotesValue.value = ''
  }
}

const cancelEditNotes = () => {
  editingNotes.value = null
  editingNotesValue.value = ''
}

</script>

<style scoped>
.account-panel {
  width: 600px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  padding: 1rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h2 {
  font-size: 1.2rem;
  color: #2c3e50;
  margin: 0;
}

.account-controls {
  display: flex;
  gap: 0.5rem;
}

.account-list {
  flex: 1;
  overflow: auto;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: #7f8c8d;
}

.game-tag {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
  color: white;
}

.status-tag {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
  color: white;
}

.status-online {
  background: linear-gradient(45deg, #00b894, #00a085);
}

.status-warning {
  background: linear-gradient(45deg, #fdcb6e, #e17055);
}

.status-expired {
  background: linear-gradient(45deg, #e17055, #d63031);
}

.status-offline {
  background: linear-gradient(45deg, #636e72, #2d3436);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.user-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}

.level-badge {
  background: linear-gradient(45deg, #74b9ff, #0984e3);
  color: white;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
}

.notes-cell {
  min-width: 120px;
}

.notes-input {
  width: 100%;
  padding: 0.25rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.8rem;
}

.action-buttons {
  display: flex;
  gap: 0.25rem;
}

.btn-tiny {
  padding: 0.2rem 0.4rem;
  font-size: 0.7rem;
  border-radius: 4px;
}

.game-bh3 {
  background: linear-gradient(45deg, #ff6b6b, #ee5a24);
}

.game-hk4e {
  background: linear-gradient(45deg, #74b9ff, #0984e3);
}

.game-hkrpg {
  background: linear-gradient(45deg, #a29bfe, #6c5ce7);
}

.game-zzz {
  background: linear-gradient(45deg, #fd79a8, #e84393);
}

@media (max-width: 1024px) {
  .account-panel {
    width: 100%;
    height: 300px;
  }
}
</style>
