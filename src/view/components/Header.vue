<script setup>
defineProps({
  title: {
    type: String,
    default: '奖项配置中心'
  },
  subtitle: {
    type: String,
    default: '管理 2026 春节庆典活动的奖项层级、数量及库存详情。'
  },
  showAdd: {
    type: Boolean,
    default: true
  },
  addText: {
    type: String,
    default: '添加新奖项'
  }
})

const emit = defineEmits(['add'])
</script>

<template>
  <header class="page-header">
    <div class="header-content">
      <h2>{{ title }}</h2>
      <p>{{ subtitle }}</p>
    </div>
    <button v-if="showAdd" class="add-btn" @click="emit('add')">
      <span class="material-symbols-outlined">add_circle</span>
      {{ addText }}
    </button>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 2rem;
}

.header-content h2 {
  font-size: 2.25rem;
  font-weight: 800;
  color: #181111;
  letter-spacing: -0.025em;
}

:global(.dark) .header-content h2 {
  color: white;
}

.header-content p {
  color: #8a6060;
  margin-top: 0.25rem;
}

:global(.dark) .header-content p {
  color: #9ca3af;
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: #f42525;
  color: white;
  border: none;
  border-radius: 9999px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  box-shadow: 0 10px 25px -5px rgba(244, 37, 37, 0.2);
  transition: transform 0.2s;
}

.add-btn:hover {
  background: #dc2626;
  transform: scale(1.02);
}

.add-btn:active {
  transform: scale(0.98);
}

.add-btn :deep(.material-symbols-outlined) {
  font-size: 1.25rem;
}
</style>
