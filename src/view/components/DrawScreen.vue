<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  pageMode: {
    type: String,
    default: 'yima'
  }
})

const emit = defineEmits(['back'])

const currentMode = computed(() => props.pageMode)

function goBack() {
  emit('back')
}
</script>

<template>
  <div class="draw-screen" :class="currentMode">
    <div class="screen-header">
      <button class="back-btn" @click="goBack">
        <span class="material-symbols-outlined">arrow_back</span>
        返回后台
      </button>
      <div class="mode-badge">
        <span class="material-symbols-outlined">auto_awesome</span>
        {{ currentMode === 'yima' ? '一马当先' : '马到成功' }}
      </div>
    </div>

    <div class="screen-content">
      <div v-if="currentMode === 'yima'" class="yima-mode">
        <h1>🎯 一马当先</h1>
        <p>抽奖即将开始...</p>
      </div>

      <div v-else-if="currentMode === 'macheng'" class="macheng-mode">
        <h1>🏆 马到成功</h1>
        <p>抽奖即将开始...</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.draw-screen {
  width: 100%;
  min-height: calc(100vh - 4rem);
  display: flex;
  flex-direction: column;
}

.screen-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 0.75rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease;
}

.back-btn:hover {
  border-color: #f42525;
  color: #f42525;
}

:global(.dark) .back-btn {
  background: rgba(255, 255, 255, 0.05);
  border-color: #3d2a2a;
  color: #9ca3af;
}

:global(.dark) .back-btn:hover {
  border-color: #f42525;
  color: #f42525;
}

.back-btn :deep(.material-symbols-outlined) {
  font-size: 1.25rem;
}

.mode-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: rgba(244, 37, 37, 0.1);
  border: 2px solid rgba(244, 37, 37, 0.2);
  border-radius: 9999px;
  font-size: 1rem;
  font-weight: 700;
  color: #f42525;
}

.mode-badge :deep(.material-symbols-outlined) {
  font-size: 1.25rem;
}

.screen-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.yima-mode,
.macheng-mode {
  text-align: center;
  padding: 4rem;
  background: white;
  border-radius: 1.5rem;
  border: 2px solid rgba(244, 37, 37, 0.1);
}

:global(.dark) .yima-mode,
:global(.dark) .macheng-mode {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(244, 37, 37, 0.2);
}

.yima-mode h1,
.macheng-mode h1 {
  font-size: 3rem;
  font-weight: 900;
  color: #181111;
  margin-bottom: 1rem;
}

:global(.dark) .yima-mode h1,
:global(.dark) .macheng-mode h1 {
  color: white;
}

.yima-mode p,
.macheng-mode p {
  font-size: 1.25rem;
  color: #8a6060;
}

:global(.dark) .yima-mode p,
:global(.dark) .macheng-mode p {
  color: #9ca3af;
}

.yima-mode {
  background: linear-gradient(135deg, rgba(244, 37, 37, 0.05) 0%, rgba(255, 255, 255, 1) 100%);
}

.macheng-mode {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 255, 255, 1) 100%);
  border-color: rgba(255, 215, 0, 0.3);
}

.macheng-mode h1 {
  color: #b8860b;
}

:global(.dark) .macheng-mode h1 {
  color: #ffd700;
}
</style>
