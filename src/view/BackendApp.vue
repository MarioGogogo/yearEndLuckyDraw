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
import { useRouter } from 'vue-router'

const router = useRouter()
const STORAGE_KEY = 'lottery_config'

const defaultPrizes = [
  {
    id: 1,
    name: '特等奖：赤兔限量版座驾',
    description: '高端定制涂装电动轿跑',
    count: 1,
    amount: 100000,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBTPT5c1OskG2SjZXidj5kJHZL7KK8m_raA_As75THnywPNmum1AYM3HV3i2M9b7h7xCj3PQV6k7SqvH9I6yoBk9IbLqQgZkj-ZQgH1we-fhsbY-KvLdwKh2JasQhQdCSFduVHtYKQLPZW8VzGAkTGcL_MyrUB2jvfspIKXsqnmqdDHIF63fH_iiS3E-yZubCcpEJWbTFVSV1445uyPUOVQQCvJSE2iMU5n4YHTnkQzAZh5iYoeQdLV-Z3LEn5qs1Yxq3PPXgpDMj0',
    canReset: true,
    status: 'ready',
    isSpecial: true
  },
  {
    id: 2,
    name: '一等奖：极客探索套装',
    description: '旗舰智能手机 + 降噪蓝牙耳机',
    count: 5,
    amount: 8888,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCqAZhncTE-HPs-80vCYLlCOE3i_P2_kL90YJY45wOTt799M4vxqUJQgiRnfyzxwyWvUC9_NNDMYtZYTs1TBTSv1aCYXA_2HS6FcIZsAAHLVG5ZjYQ7u7FSqVLrxKcqgzPfyhI9UFDS96UnsD47gWw-_HcgTe6DSfjLiXK6RejfwrfxMNTdAS0JKhhgYufwb5Qs1aVaETfTnbaYDuO00c9xVwBfucBk2rP-4icgPyVB2cYqxTFxZgh42foW8TE2Ehd-4kuun0O4h7Q',
    canReset: true,
    status: 'ready',
    isSpecial: false
  },
  {
    id: 3,
    name: '二等奖：创意办公全家桶',
    description: '11英寸平板电脑 + 数字触控笔',
    count: 10,
    amount: 3000,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAZeBAkzyDB57QbQ_NlBX78EwzP2S2Z7V99Sz9QMDXqwi-X9k6PqRVKv9vn1Vj9KzL2A8N92ttW2GXzwyxesxkoeBqmI0zJG7ql9ZxQgRJKnhaSiZi_qSQ7fRqHjYW4UFbRovuwqfcljNwXyoaEfjlnA5NSqJl095m4XCLB-_Mzolhg1ptBDsopPY-OTrMH1tPdqd7Z4WWdxAtKIVTZ-o8HR9Q6cc5D2nZ6Vjm3S2-l-o_tgMlLSJn6yWJflk1szlhWpuHfPjDTQGY',
    canReset: false,
    status: 'incomplete',
    isSpecial: false
  }
]

const prizes = ref([...defaultPrizes])
const participants = ref([])
const activePage = ref('prizes')
const showEditModal = ref(false)
const editingPrize = ref(null)
const isDark = ref(false)
const settings = ref({ pageMode: 'yima' })

const prizeCount = computed(() => prizes.value.length)
const winnerCount = computed(() => prizes.value.reduce((sum, prize) => sum + (prize.count || 0), 0))
const totalValue = computed(() => {
  const total = prizes.value.reduce((sum, prize) => sum + (prize.amount * prize.count), 0)
  return `¥${total.toLocaleString()}`
})

function loadFromCache() {
  try {
    const cached = localStorage.getItem(STORAGE_KEY)
    if (cached) {
      const data = JSON.parse(cached)
      if (data.prizes && data.prizes.length > 0) {
        prizes.value = data.prizes
      }
    }
  } catch (e) {
    console.error('加载缓存失败:', e)
  }
}

function loadSettings() {
  try {
    const cached = localStorage.getItem('lottery_settings')
    if (cached) {
      settings.value = JSON.parse(cached)
    }
  } catch (e) {
    console.error('加载设置失败:', e)
  }
}

function saveToCache() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ prizes: prizes.value }))
  } catch (e) {
    console.error('保存缓存失败:', e)
  }
}

watch(prizes, saveToCache, { deep: true })

function handleNavigate(page) {
  if (page === 'draw') {
    router.push('/')
  } else {
    activePage.value = page
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
  if (confirm('确定要删除这个奖项吗？')) {
    prizes.value = prizes.value.filter(p => p.id !== id)
  }
}

function handleSavePrize(prizeData) {
  if (editingPrize.value) {
    prizes.value = prizes.value.map(p => p.id === prizeData.id ? { ...p, ...prizeData } : p)
  } else {
    // 假设大于 5000 元的奖项为特殊大奖
    const newPrize = { ...prizeData, id: Date.now(), status: 'ready', isSpecial: prizeData.amount >= 5000 }
    prizes.value = [...prizes.value, newPrize]
  }
}



onMounted(() => {
  loadFromCache()
  loadSettings()

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
