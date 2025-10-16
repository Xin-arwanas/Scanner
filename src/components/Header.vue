<template>
  <header class="header">
    <div class="header-content">
      <h1 class="app-title">MHY扫码器</h1>
      <div class="header-controls">
        <button class="btn btn-primary" @click="$emit('add-account')">
          <span class="icon">+</span>
          添加账号
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
// 定义事件
defineEmits(['add-account'])
</script>

<style scoped>
.header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding: 1rem 2rem;
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
  height: 60px;
  display: flex;
  align-items: center;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.app-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #2c3e50;
  background: linear-gradient(45deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
}

.header-controls {
  display: flex;
  gap: 0.5rem;
}

@media (max-width: 768px) {
  .header {
    padding: 1rem;
  }
  
  .header-content {
    flex-direction: column;
    gap: 1rem;
  }
  
  .app-title {
    font-size: 1.2rem;
  }
}
</style>
