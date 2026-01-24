<script setup>
import { ref, computed, onMounted, defineAsyncComponent } from 'vue'

const pageMode = ref('yima')

const YimaScreen = defineAsyncComponent(() => import('./YimaScreen.vue'))
const TrendyScreen = defineAsyncComponent(() => import('./TrendyScreen.vue'))
const Sphere3DScreen = defineAsyncComponent(() => import('./Sphere3DScreen.vue'))

const currentScreen = computed(() => {
  if (pageMode.value === 'sphere3d') return Sphere3DScreen
  if (pageMode.value === 'trendy') return TrendyScreen
  return YimaScreen
})

function loadSettings() {
  try {
    const cached = localStorage.getItem('lottery_settings')
    if (cached) {
      const settings = JSON.parse(cached)
      pageMode.value = settings.pageMode || 'yima'
    }
  } catch (e) {
    console.error('加载设置失败:', e)
  }
}

function goToBackend() {
  window.location.href = '/backend'
}

onMounted(() => {
  loadSettings()
})
</script>

<template>
  <div class="draw-index">
    <component :is="currentScreen" @back="goToBackend" />
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Material+Symbols-Outlined:wght,FILL@100..700,0..1&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700;900&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #1a0a0a;
  min-height: 100vh;
}

.dark {
  color-scheme: dark;
}

/* Material Symbols */
.material-symbols-outlined {
  font-family: 'Material Symbols Outlined';
  font-weight: normal;
  font-style: normal;
  font-size: 24px;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-smoothing: antialiased;
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
</style>

<style scoped>
.draw-index {
  width: 100%;
  min-height: 100vh;
}
</style>
