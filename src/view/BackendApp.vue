<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import Sidebar from './components/Sidebar.vue'
import Header from './components/Header.vue'
import StatsCards from './components/StatsCards.vue'
import PrizeTable from './components/PrizeTable.vue'
import PrizeEditModal from './components/PrizeEditModal.vue'
import ParticipantsPage from './components/ParticipantsPage.vue'
import RecordsPage from './components/RecordsPage.vue'
import SettingsPage from './components/SettingsPage.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { useRouter } from 'vue-router'

// 导入缓存管理模块
import {
  loadPrizes,
  savePrizes,
  loadSettings,
  saveSettings,
  loadParticipants,
  loadWinnerRecords
} from '../utils/lotteryStorage'

const router = useRouter()

// 默认奖项配置（仅一条，用于首次初始化）
const defaultPrizes = [
  {
    id: Date.now(),
    name: '默认奖项',
    subtitle: '幸运抽奖',
    description: '请编辑此奖项',
    count: 1,
    amount: 100,
    level: 1,
    image: '',
    canReset: true,
    status: 'ready',
    isSpecial: false
  }
]

// 响应式状态
const prizes = ref([]) // 初始为空，由 loadFromCache 或 defaultPrizes 填充
const participants = ref([])
const winnerRecords = ref([])
const activePage = ref('prizes')
const showEditModal = ref(false)
const editingPrize = ref(null)
const isDark = ref(false)
const showDeleteDialog = ref(false)
const deletingPrizeId = ref(null)
const deletingPrizeName = ref('')
const settings = ref({
  drawMode: 'random',
  weightedBy: 'department',
  allowRepeatWins: false,
  maxWinPerPerson: 1,
  showWinnerAvatar: true,
  showWinnerDept: true,
  barrageEnabled: true,
  bgmEnabled: true,
  sfxEnabled: true,
  animationSpeed: 'normal'
})

// 统计数据计算
const prizeCount = computed(() => prizes.value.length)
const winnerCount = computed(() => {
  const records = loadWinnerRecords()
  return records.length
})
const totalValue = computed(() => {
  const total = prizes.value.reduce((sum, prize) => sum + (prize.amount * prize.count), 0)
  return `¥${total.toLocaleString()}`
})

// 从缓存加载数据
function loadFromCache() {
  // 加载奖项配置
  const cachedPrizes = loadPrizes()
  if (cachedPrizes && cachedPrizes.length > 0) {
    prizes.value = cachedPrizes
  } else {
    // 没有缓存数据时，使用默认奖项并保存到缓存
    prizes.value = JSON.parse(JSON.stringify(defaultPrizes))
    savePrizes(prizes.value)
  }

  // 加载参与人员
  participants.value = loadParticipants()

  // 加载中奖记录
  winnerRecords.value = loadWinnerRecords()

  // 加载设置
  const cachedSettings = loadSettings()
  if (cachedSettings) {
    settings.value = { ...settings.value, ...cachedSettings }
  }
}

// 保存奖项配置到缓存
function savePrizesToCache() {
  savePrizes(prizes.value)
}

// 保存设置到缓存
function saveSettingsToCache() {
  saveSettings(settings.value)
}

// 监听数据变化自动保存
watch(prizes, savePrizesToCache, { deep: true })
watch(settings, saveSettingsToCache, { deep: true })

function handleNavigate(page) {
  if (page === 'draw') {
    router.push('/')
  } else {
    activePage.value = page
    // 切换页面时刷新数据
    if (page === 'participants') {
      participants.value = loadParticipants()
    } else if (page === 'records') {
      winnerRecords.value = loadWinnerRecords()
    }
  }
}

function handleAddPrize() {
  editingPrize.value = null
  showEditModal.value = true
}

function handleEditPrize(prize) {
  editingPrize.value = { ...prize }
  showEditModal.value = true
}

function handleDeletePrize(id) {
  const prize = prizes.value.find(p => p.id === id)
  if (prize) {
    deletingPrizeId.value = id
    deletingPrizeName.value = prize.name
    showDeleteDialog.value = true
  }
}

function confirmDeletePrize() {
  if (deletingPrizeId.value) {
    prizes.value = prizes.value.filter(p => p.id !== deletingPrizeId.value)
  }
  showDeleteDialog.value = false
  deletingPrizeId.value = null
  deletingPrizeName.value = ''
}

function cancelDeletePrize() {
  showDeleteDialog.value = false
  deletingPrizeId.value = null
  deletingPrizeName.value = ''
}

function handleSavePrize(prizeData) {
  if (editingPrize.value) {
    prizes.value = prizes.value.map(p => p.id === prizeData.id ? { ...p, ...prizeData } : p)
  } else {
    // 生成新的奖项ID
    const maxId = Math.max(...prizes.value.map(p => p.id || 0), 0)
    // 假设大于 5000 元的奖项为特殊大奖
    const newPrize = {
      ...prizeData,
      id: Date.now(),
      level: maxId + 1,
      status: 'ready',
      isSpecial: prizeData.amount >= 5000
    }
    prizes.value = [...prizes.value, newPrize]
  }
}

onMounted(() => {
  loadFromCache()

  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    isDark.value = true
    document.documentElement.classList.add('dark')
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    isDark.value = e.matches
    if (isDark.value) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  })
})
</script>

<template>
  <div class="app-layout" :class="{ dark: isDark }">
    <Sidebar :activePage="activePage" @navigate="handleNavigate" />

    <main class="main-content" :class="{ 'full-screen': activePage === 'draw' }">
      <div class="chinese-pattern"></div>

      <div :key="activePage" class="page-container">
        <template v-if="activePage === 'prizes'">
          <Header
            title="奖项配置中心"
            subtitle="管理 2026 春节庆典活动的奖项层级、数量及库存详情。"
            @add="handleAddPrize"
          />
          <StatsCards :prizeCount="prizeCount" :winnerCount="winnerCount" :totalValue="totalValue" />
          <PrizeTable :prizes="prizes" @edit="handleEditPrize" @delete="handleDeletePrize" @update:prizes="prizes = $event" />
        </template>

        <template v-else-if="activePage === 'participants'">
          <ParticipantsPage :participants="participants" @update:participants="participants = $event" />
        </template>

        <template v-else-if="activePage === 'records'">
          <RecordsPage />
        </template>

        <template v-else-if="activePage === 'settings'">
          <SettingsPage @go-draw="router.push('/')" />
        </template>
      </div>
    </main>

    <PrizeEditModal :show="showEditModal" :prize="editingPrize" @close="showEditModal = false" @save="handleSavePrize" />

    <!-- 删除确认弹窗 -->
    <ConfirmDialog
      :show="showDeleteDialog"
      title="删除奖项"
      :message="`确定要删除「${deletingPrizeName}」吗？\n\n此操作无法撤销，奖项将从列表中移除。`"
      confirm-text="删除"
      confirm-danger
      icon="danger"
      @confirm="confirmDeletePrize"
      @cancel="cancelDeletePrize"
    />
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #f8f5f5;
  min-height: 100vh;
}

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

.dark { color-scheme: dark; }
.dark body { background: #221010; }
</style>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
}

.main-content {
  flex: 1;
  position: relative;
  padding: 2rem;
  overflow-x: hidden;
}

.page-container {
  width: 100%;
  height: 100%;
}

/* 全屏模式适配 */
.main-content.full-screen {
  padding: 0;
  position: fixed;
  inset: 0;
  z-index: 100;
  background: black;
}

.chinese-pattern {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(#f42525 0.5px, transparent 0.5px), radial-gradient(#f42525 0.5px, #f8f5f5 0.5px);
  background-size: 20px 20px;
  background-position: 0 0, 10px 10px;
  opacity: 0.05;
  pointer-events: none;
}

:global(.dark) .chinese-pattern {
  background-image: radial-gradient(#f42525 0.5px, transparent 0.5px), radial-gradient(#f42525 0.5px, #221010 0.5px);
}

/* 页面转场动画 */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.page-fade-enter-from {
  opacity: 0;
  transform: scale(0.98);
  filter: blur(10px);
}

.page-fade-leave-to {
  opacity: 0;
  transform: scale(1.02);
  filter: blur(10px);
}

@media (max-width: 768px) {
  .app-layout { flex-direction: column; }
  .main-content { padding: 1rem; }
}
</style>
