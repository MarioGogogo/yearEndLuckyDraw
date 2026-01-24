<script setup>
defineProps({
  activePage: {
    type: String,
    default: 'prizes'
  }
})

const emit = defineEmits(['navigate'])

const menuItems = [
  { id: 'prizes', icon: 'featured_seasonal_and_gifts', label: '奖项配置' },
  { id: 'participants', icon: 'group', label: '参与人员名单' },
  { id: 'records', icon: 'history_edu', label: '中奖记录查询' },
  { id: 'settings', icon: 'settings', label: '全局系统设置' }
]
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="logo-icon">
        <span class="material-symbols-outlined">celebration</span>
      </div>
      <div>
        <h1>年会抽奖系统</h1>
        <p>2026 灵蛇献瑞</p>
      </div>
    </div>

    <nav class="sidebar-nav">
      <a
        v-for="item in menuItems"
        :key="item.id"
        class="nav-item"
        :class="{ active: activePage === item.id }"
        href="#"
        @click.prevent="emit('navigate', item.id)"
      >
        <span class="material-symbols-outlined">{{ item.icon }}</span>
        <span class="font-medium">{{ item.label }}</span>
      </a>
    </nav>

    <div class="sidebar-actions">
      <button class="launch-btn" @click="emit('navigate', 'draw')">
        <span class="material-symbols-outlined">rocket_launch</span>
        <span>开启抽奖大屏</span>
      </button>
    </div>

    <div class="sidebar-footer">
      <div class="status-card">
        <p>系统运行状态</p>
        <div class="status-indicator">
          <div class="pulse-dot"></div>
          <span>服务器连接正常</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 18rem;
  background: white;
  border-right: 1px solid #e6dbdb;
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: sticky;
  top: 0;
  z-index: 30;
}

:global(.dark) .sidebar {
  background: #2d1a1a;
  border-color: #3d2a2a;
}

.sidebar-header {
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo-icon {
  width: 2.5rem;
  height: 2.5rem;
  background: #f42525;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 4px 12px rgba(244, 37, 37, 0.3);
}

.logo-icon :deep(.material-symbols-outlined) {
  font-size: 1.5rem;
}

.sidebar-header h1 {
  font-size: 1.125rem;
  font-weight: 700;
  color: #181111;
  line-height: 1;
}

:global(.dark) .sidebar-header h1 {
  color: white;
}

.sidebar-header p {
  color: #f42525;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-top: 0.25rem;
}

.sidebar-nav {
  flex: 1;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  color: #8a6060;
  text-decoration: none;
}

:global(.dark) .nav-item {
  color: #9ca3af;
}

.nav-item:hover {
  background: rgba(244, 37, 37, 0.05);
}

.nav-item.active {
  background: rgba(244, 37, 37, 0.1);
  color: #f42525;
  border-right: 4px solid #f42525;
}

.nav-item :deep(.material-symbols-outlined) {
  font-size: 1.25rem;
}

.nav-item .font-medium {
  font-weight: 500;
}

.sidebar-actions {
  padding: 1rem;
  border-top: 1px solid #f8f5f5;
}

:global(.dark) .sidebar-actions {
  border-color: #3d2a2a;
}

.launch-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.875rem;
  background: #f42525;
  color: white;
  border: none;
  border-radius: 0.75rem;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(244, 37, 37, 0.2);
}

.launch-btn:hover {
  background: #dc2626;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(244, 37, 37, 0.3);
}

.launch-btn:active {
  transform: translateY(0);
}

.launch-btn .material-symbols-outlined {
  font-size: 1.25rem;
}

.sidebar-footer {
  padding: 1rem;
  margin-top: auto;
}

.status-card {
  background: rgba(244, 37, 37, 0.05);
  border-radius: 1rem;
  padding: 1rem;
  border: 1px solid rgba(244, 37, 37, 0.1);
}

:global(.dark) .status-card {
  background: rgba(244, 37, 37, 0.1);
}

.status-card p {
  font-size: 0.75rem;
  color: #8a6060;
  margin-bottom: 0.5rem;
}

:global(.dark) .status-card p {
  color: #9ca3af;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pulse-dot {
  width: 0.5rem;
  height: 0.5rem;
  background: #22c55e;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-indicator span {
  font-size: 0.875rem;
  font-weight: 500;
  color: #16a34a;
}

:global(.dark) .status-indicator span {
  color: #4ade80;
}
</style>
