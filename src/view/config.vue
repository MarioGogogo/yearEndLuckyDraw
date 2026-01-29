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
import DrawScreen from './components/DrawScreen.vue'

// 缓存 key
const STORAGE_KEY = 'lottery_config'

// 默认奖项数据
const defaultPrizes = [
  {
    id: 1,
    name: '特等奖：赤兔限量版座驾',
    description: '高端定制涂装电动轿跑',
    count: 1,
    rarity: 'legendary',
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
    rarity: 'epic',
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
    rarity: 'rare',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAZeBAkzyDB57QbQ_NlBX78EwzP2S2Z7V99Sz9QMDXqwi-X9k6PqRVKv9vn1Vj9KzL2A8N92ttW2GXzwyxesxkoeBqmI0zJG7ql9ZxQgRJKnhaSiZi_qSQ7fRqHjYW4UFbRovuwqfcljNwXyoaEfjlnA5NSqJl095m4XCLB-_Mzolhg1ptBDsopPY-OTrMH1tPdqd7Z4WWdxAtKIVTZ-o8HR9Q6cc5D2nZ6Vjm3S2-l-o_tgMlLSJn6yWJflk1szlhWpuHfPjDTQGY',
    canReset: false,
    status: 'incomplete',
    isSpecial: false
  }
]

// 响应式数据
const prizes = ref([...defaultPrizes])
const participants = ref([])
const activePage = ref('prizes')
const showEditModal = ref(false)
const editingPrize = ref(null)
const isDark = ref(false)
const settings = ref({
  pageMode: 'yima'
})

// 获取设置
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

// 计算统计数据
const prizeCount = computed(() => prizes.value.length)

const winnerCount = computed(() =>
  prizes.value.reduce((sum, prize) => sum + (prize.count || 0), 0)
)

const totalCount = computed(() =>
  prizes.value.reduce((sum, prize) => sum + (prize.count || 0), 0)
)

// 加载缓存
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

// 保存缓存
function saveToCache() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      prizes: prizes.value
    }))
  } catch (e) {
    console.error('保存缓存失败:', e)
  }
}

// 监听变化自动保存
watch(prizes, saveToCache, { deep: true })

// 导航
function handleNavigate(page) {
  activePage.value = page
}

// 添加新奖项
function handleAddPrize() {
  editingPrize.value = null
  showEditModal.value = true
}

// 编辑奖项
function handleEditPrize(prize) {
  editingPrize.value = { ...prize }
  showEditModal.value = true
}

// 删除奖项
function handleDeletePrize(id) {
  if (confirm('确定要删除这个奖项吗？')) {
    prizes.value = prizes.value.filter(p => p.id !== id)
  }
}

// 保存奖项
function handleSavePrize(prizeData) {
  if (editingPrize.value) {
    // 编辑模式
    prizes.value = prizes.value.map(p =>
      p.id === prizeData.id ? { ...p, ...prizeData } : p
    )
  } else {
    // 新增模式
    const newPrize = {
      ...prizeData,
      id: Date.now(),
      status: 'ready',
      isSpecial: prizeData.rarity === 'legendary'
    }
    prizes.value = [...prizes.value, newPrize]
  }
}

// 初始化
onMounted(() => {
  loadFromCache()
  loadSettings()

  // 检测系统主题
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    isDark.value = true
    document.documentElement.classList.add('dark')
  }

  // 监听主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    isDark.value = e.matches
    if (isDark.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  })
})
</script>

<template>
  <div class="app-layout" :class="{ dark: isDark }">
    <Sidebar :activePage="activePage" @navigate="handleNavigate" />

    <main class="main-content">
      <!-- 中国风装饰 -->
      <div class="chinese-pattern"></div>

      <!-- 奖项配置页面 -->
      <template v-if="activePage === 'prizes'">
        <Header
          title="奖项配置中心"
          subtitle="管理 2026 春节庆典活动的奖项层级、数量及库存详情。"
          @add="handleAddPrize"
        />

        <StatsCards
          :prizeCount="prizeCount"
          :winnerCount="winnerCount"
          :totalCount="totalCount"
        />

        <PrizeTable
          :prizes="prizes"
          @edit="handleEditPrize"
          @delete="handleDeletePrize"
          @update:prizes="prizes = $event"
        />
      </template>

      <!-- 参与人员页面 -->
      <template v-else-if="activePage === 'participants'">
        <ParticipantsPage
          :participants="participants"
          @update:participants="participants = $event"
        />
      </template>

      <!-- 中奖记录页面 -->
      <template v-else-if="activePage === 'records'">
        <RecordsPage />
      </template>

      <template v-else-if="activePage === 'settings'">
        <SettingsPage @go-draw="activePage = 'draw'" />
      </template>

      <!-- 抽奖屏幕页面 -->
      <template v-else-if="activePage === 'draw'">
        <DrawScreen
          :pageMode="settings.pageMode"
          @back="activePage = 'prizes'"
        />
      </template>
    </main>

    <PrizeEditModal
      :show="showEditModal"
      :prize="editingPrize"
      @close="showEditModal = false"
      @save="handleSavePrize"
    />
  </div>
</template>

<style>
/* 全局样式 */
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

.dark {
  color-scheme: dark;
}

.dark body {
  background: #221010;
}
</style>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
}

.main-content {
  flex: 1;
  position: relative;
  overflow: hidden;
  padding: 2rem;
}

.chinese-pattern {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(#f42525 0.5px, transparent 0.5px),
    radial-gradient(#f42525 0.5px, #f8f5f5 0.5px);
  background-size: 20px 20px;
  background-position: 0 0, 10px 10px;
  opacity: 0.05;
  pointer-events: none;
}

:global(.dark) .chinese-pattern {
  background-image:
    radial-gradient(#f42525 0.5px, transparent 0.5px),
    radial-gradient(#f42525 0.5px, #221010 0.5px);
}

@media (max-width: 768px) {
  .app-layout {
    flex-direction: column;
  }

  .main-content {
    padding: 1rem;
  }
}

/* 占位页面 */
.placeholder-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  color: #8a6060;
}

:global(.dark) .placeholder-page {
  color: #9ca3af;
}

.placeholder-page :deep(.material-symbols-outlined) {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.placeholder-page p {
  font-size: 1.125rem;
}
</style>
