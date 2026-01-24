<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const emit = defineEmits(['back'])

// 模拟员工数据 - 实际使用时可以从接口获取
const allEmployees = ref([
  '张伟', '李娜', '王芳', '刘强', '陈静', '杨帆', '赵磊', '黄艳',
  '周杰', '吴敏', '徐鹏', '孙丽', '马涛', '朱婷', '胡兵', '林娜',
  '郭峰', '罗萍', '梁超', '谢芳', '唐勇', '韩雪', '曹刚', '潘丽',
  '邓林', '杜鹏', '冯强', '沈燕', '彭军', '范梅', '吕刚', '金萍',
  '蒋华', '廖珍', '魏刚', '段丽', '雷兵', '贺芳', '薛刚', '阎娜',
  '顾强', '康丽', '孟刚', '常萍', '侯兵', '文丽', '乔刚', '白燕',
  '韦刚', '池丽', '毕兵', '申丽', '范刚', '彭丽', '郝刚', '间娜'
])

// 奖项配置
const prizeLevels = [
  { id: 'first', name: '一等奖', color: '#FFD700', count: 1 },
  { id: 'second', name: '二等奖', color: '#C0C0C0', count: 3 },
  { id: 'third', name: '三等奖', color: '#CD7F32', count: 5 }
]

// 状态管理
const currentPrizeIndex = ref(0) // 当前选中的奖项索引
const selectedPrize = computed(() => prizeLevels[currentPrizeIndex.value])
const isDrawing = ref(false) // 是否正在抽奖
const winners = ref([]) // 已中奖者列表
const currentWinners = ref([]) // 当前轮次的中奖者
const animationKey = ref(0) // 用于强制刷新动画

// 滚动相关
const displayNames = ref([])
const selectedIndices = ref([])
const animationFrameId = ref(null)
const scrollSpeed = ref(50)
const scrollPosition = ref(0)

// 键盘事件
const handleKeydown = (e) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    toggleDraw()
  }
}

// 切换抽奖状态
const toggleDraw = () => {
  if (isDrawing.value) {
    stopDraw()
  } else {
    startDraw()
  }
}

// 开始抽奖
const startDraw = () => {
  // 排除已中奖者
  const availableNames = allEmployees.value.filter(name => !winners.value.includes(name))
  if (availableNames.length === 0) {
    alert('所有员工都已中奖！')
    return
  }

  // 随机选择一些名字用于展示
  displayNames.value = []
  const repeatCount = Math.ceil(60 / availableNames.length)
  for (let i = 0; i < repeatCount; i++) {
    displayNames.value.push(...availableNames)
  }

  isDrawing.value = true
  currentWinners.value = []
  animationKey.value++
  selectedIndices.value = []

  // 初始化选中位置
  const winnerCount = selectedPrize.value.count
  const startIndex = Math.floor((displayNames.value.length - winnerCount * 3) / 2)
  for (let i = 0; i < winnerCount; i++) {
    selectedIndices.value.push(startIndex + i * 3)
  }

  // 开始滚动动画
  scrollPosition.value = 0
  animateScroll()
}

// 滚动动画
const animateScroll = () => {
  if (!isDrawing.value) return

  scrollPosition.value += scrollSpeed.value

  // 随机闪烁选中光标
  if (Math.random() > 0.7) {
    const winnerCount = selectedPrize.value.count
    const baseIndex = selectedIndices.value[0]
    const offset = Math.floor(Math.random() * 5) - 2
    for (let i = 0; i < winnerCount; i++) {
      selectedIndices.value[i] = Math.max(0, Math.min(displayNames.value.length - 1, baseIndex + i * 3 + offset))
    }
  }

  animationFrameId.value = requestAnimationFrame(animateScroll)
}

// 停止抽奖并选中中奖者
const stopDraw = () => {
  isDrawing.value = false

  if (animationFrameId.value) {
    cancelAnimationFrame(animationFrameId.value)
    animationFrameId.value = null
  }

  // 随机选择中奖者
  const availableNames = allEmployees.value.filter(name => !winners.value.includes(name))
  const winnerCount = selectedPrize.value.count
  const shuffled = [...availableNames].sort(() => Math.random() - 0.5)
  const selectedWinners = shuffled.slice(0, winnerCount)

  currentWinners.value = selectedWinners
  winners.value.push(...selectedWinners)

  // 更新显示的中奖者名字
  displayNames.value = selectedWinners
  selectedIndices.value = selectedWinners.map((_, i) => i)
}

// 切换奖项
const switchPrize = (index) => {
  currentPrizeIndex.value = index
  // 当前轮次的中奖者可以根据需要筛选
  currentWinners.value = []
}

function goToBackend() {
  emit('back')
}

onMounted(() => {
  document.documentElement.classList.add('dark')
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.documentElement.classList.remove('dark')
  window.removeEventListener('keydown', handleKeydown)
  if (animationFrameId.value) {
    cancelAnimationFrame(animationFrameId.value)
  }
})
</script>

<template>
  <div class="trendy-screen">
    <div class="gradient-bg"></div>

    <!-- 返回后台按钮 - 右下角 -->
    <button class="back-btn-fixed" @click="goToBackend">
      <span class="material-symbols-outlined">arrow_back</span>
      返回后台
    </button>

    <main class="screen-content">
      <div class="title-row">
        <span class="title-horse">🐎</span>
        <h1 class="main-title">
          <span class="char char-1">马</span>
          <span class="char char-2">年</span>
          <span class="char char-3">吉</span>
          <span class="char char-4">祥</span>
        </h1>
        <span class="title-horse">🐎</span>
      </div>

      <p class="subtitle">2026 灵蛇献瑞 · 幸运抽抽乐</p>

      <!-- 当前奖项提示 -->
      <div class="current-prize" :style="{ '--prize-color': selectedPrize.color }">
        <span class="prize-label">当前奖项</span>
        <span class="prize-name">{{ selectedPrize.name }} · {{ selectedPrize.count }}人</span>
      </div>

      <div class="draw-container">
        <!-- 抽奖卡池区域 - 跑马灯效果 -->
        <div class="name-scroller" :class="{ 'scrolling': isDrawing }">
          <div class="scroller-track">
            <div class="scroller-inner" :class="{ 'paused': !isDrawing }">
              <div
                v-for="(name, index) in displayNames"
                :key="`${animationKey}-${index}`"
                class="name-chip"
                :class="{ 'selected': selectedIndices.includes(index) }"
                :style="{ '--delay': `${index % 10 * 0.1}s` }"
              >
                <span class="name-text">{{ name }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 中奖结果展示 -->
        <div class="result-reveal" :class="{ 'has-winners': currentWinners.length > 0 }">
          <div v-if="currentWinners.length === 0" class="result-glow">
            <span class="winner-name">?</span>
          </div>
          <div v-else class="winners-display">
            <div
              v-for="(winner, index) in currentWinners"
              :key="index"
              class="winner-card"
              :style="{ animationDelay: `${index * 0.2}s` }"
            >
              <span class="winner-name">{{ winner }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-row">
        <button
          class="action-btn primary"
          :class="{ 'stop': isDrawing }"
          @click="toggleDraw"
        >
          <span class="material-symbols-outlined">{{ isDrawing ? 'stop' : 'celebration' }}</span>
          {{ isDrawing ? '停止抽奖 (回车)' : '开始抽奖 (回车)' }}
        </button>
      </div>

      <!-- 已中奖名单 -->
      <div class="winners-history" v-if="winners.length > 0">
        <h3>🏆 已中奖名单 ({{ winners.length }}人)</h3>
        <div class="history-tags">
          <span v-for="(winner, index) in winners" :key="index" class="history-tag">
            {{ winner }}
          </span>
        </div>
      </div>
    </main>

    <!-- 左侧底部奖项选项卡 -->
    <div class="prize-tabs">
      <div class="tabs-header">
        <span class="tabs-icon">🎖️</span>
        <span class="tabs-title">奖项选择</span>
      </div>
      <div class="tabs-list">
        <button
          v-for="(prize, index) in prizeLevels"
          :key="prize.id"
          class="prize-tab"
          :class="{ 'active': currentPrizeIndex === index }"
          :style="{ '--tab-color': prize.color }"
          @click="switchPrize(index)"
        >
          <span class="tab-rank">{{ index + 1 }}</span>
          <span class="tab-name">{{ prize.name }}</span>
          <span class="tab-count">{{ prize.count }}人</span>
        </button>
      </div>
    </div>

    <div class="decoration-horses">
      <span class="deco-horse h1">🐎</span>
      <span class="deco-horse h2">🐎</span>
      <span class="deco-horse h3">🐎</span>
    </div>
  </div>
</template>

<style scoped>
.trendy-screen {
  width: 100%;
  min-height: 100vh;
  background: #1a0a0a;
  position: relative;
  overflow: hidden;
}

.gradient-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #8B0000 0%, #DC143C 30%, #B8860B 70%, #DAA520 100%);
  opacity: 0.9;
}

.back-btn-fixed {
  position: fixed;
  right: 2rem;
  bottom: 2rem;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 9999px;
  font-size: 1rem;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
}

.back-btn-fixed:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: white;
}

.back-btn-fixed :deep(.material-symbols-outlined) {
  font-size: 1.25rem;
}

.screen-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  position: relative;
  z-index: 5;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 0.5rem;
}

.title-horse {
  font-size: 2.5rem;
  animation: horse-bounce 1s ease-in-out infinite;
}

.title-horse:first-child {
  animation-delay: 0s;
}

.title-horse:last-child {
  animation-delay: 0.5s;
}

@keyframes horse-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.main-title {
  display: flex;
  gap: 0.25rem;
}

.main-title .char {
  font-family: 'Noto Serif SC', serif;
  font-size: 4.5rem;
  font-weight: 900;
  background: linear-gradient(180deg, #FFD700 0%, #FFA500 50%, #FFD700 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: none;
  animation: char-glow 2s ease-in-out infinite;
}

.char-1 { animation-delay: 0s; }
.char-2 { animation-delay: 0.1s; }
.char-3 { animation-delay: 0.2s; }
.char-4 { animation-delay: 0.3s; }

@keyframes char-glow {
  0%, 100% {
    filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.5));
  }
  50% {
    filter: drop-shadow(0 0 25px rgba(255, 215, 0, 0.9));
  }
}

.subtitle {
  font-size: 1.25rem;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 2rem;
  letter-spacing: 0.2em;
}

/* 当前奖项提示 */
.current-prize {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 2rem;
  padding: 1rem 2rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 1rem;
  border: 2px solid var(--prize-color, #FFD700);
}

.prize-label {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.prize-name {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--prize-color, #FFD700);
  text-shadow: 0 0 20px var(--prize-color, #FFD700);
}

.draw-container {
  width: 90%;
  margin: 0 auto 2rem;
  padding: 0 2rem;
}

/* 抽奖卡池 - 跑马灯效果 */
.name-scroller {
  background: rgba(0, 0, 0, 0.4);
  border-radius: 1.5rem;
  padding: 2rem;
  margin-bottom: 1.5rem;
  overflow: hidden;
  position: relative;
  min-height: 200px;
  border: 2px solid rgba(255, 215, 0, 0.3);
}

/* 横向滚动的容器 */
.scroller-track {
  width: 100%;
  overflow: hidden;
  position: relative;
}

.scroller-inner {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.5rem;
  justify-content: flex-start;
  animation: scroll-left 30s linear infinite;
  padding: 0.5rem 0;
}

.scroller-inner.paused {
  animation-play-state: paused;
}

@keyframes scroll-left {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}

.name-chip {
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(218, 165, 32, 0.15) 100%);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 9999px;
  transition: all 0.15s ease;
  position: relative;
  flex-shrink: 0;
  font-size: 0.9rem;
}

.name-chip.selected {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.6) 0%, rgba(218, 165, 32, 0.6) 100%);
  border: 2px solid #FFD700;
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.8);
  z-index: 10;
}

.name-text {
  font-size: 0.9rem;
  font-weight: 600;
  color: white;
  white-space: nowrap;
}

/* 结果展示 */
.result-reveal {
  display: flex;
  justify-content: center;
  min-height: 80px;
}

.result-reveal.has-winners {
  flex-wrap: wrap;
  gap: 1rem;
}

.result-glow {
  width: 120px;
  height: 120px;
  background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
  border-radius: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 60px rgba(255, 215, 0, 0.5), 0 0 100px rgba(255, 165, 0, 0.3);
  animation: result-pulse 2s ease-in-out infinite;
}

@keyframes result-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.winners-display {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
}

.winner-card {
  padding: 1rem 2rem;
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.3) 0%, rgba(255, 165, 0, 0.3) 100%);
  border: 2px solid #FFD700;
  border-radius: 1rem;
  animation: winner-reveal 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
}

@keyframes winner-reveal {
  from {
    opacity: 0;
    transform: scale(0.5) rotate(-10deg);
  }
  to {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

.winner-name {
  font-size: 2rem;
  font-weight: 900;
  color: #FFD700;
  font-family: 'Noto Serif SC', serif;
  text-shadow: 0 2px 10px rgba(255, 215, 0, 0.5);
}

.action-row {
  display: flex;
  gap: 1.5rem;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 2.5rem;
  border-radius: 9999px;
  font-size: 1.25rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
}

.action-btn.primary {
  background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
  border: none;
  color: #8B0000;
  box-shadow: 0 6px 30px rgba(255, 215, 0, 0.4);
}

.action-btn.primary:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 40px rgba(255, 215, 0, 0.5);
}

.action-btn.primary.stop {
  background: linear-gradient(135deg, #FF4444 0%, #CC0000 100%);
  animation: stop-btn-pulse 1s ease-in-out infinite;
}

@keyframes stop-btn-pulse {
  0%, 100% { box-shadow: 0 6px 30px rgba(255, 68, 68, 0.4); }
  50% { box-shadow: 0 6px 40px rgba(255, 68, 68, 0.6); }
}

.action-btn :deep(.material-symbols-outlined) {
  font-size: 1.5rem;
}

/* 已中奖名单 */
.winners-history {
  margin-top: 2rem;
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 1rem;
  width: 100%;
  max-width: 600px;
}

.winners-history h3 {
  color: #FFD700;
  font-size: 1rem;
  margin-bottom: 1rem;
  text-align: center;
}

.history-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.history-tag {
  padding: 0.4rem 0.8rem;
  background: rgba(255, 215, 0, 0.2);
  border: 1px solid rgba(255, 215, 0, 0.4);
  border-radius: 9999px;
  font-size: 0.875rem;
  color: white;
}

/* 左侧底部奖项选项卡 */
.prize-tabs {
  position: fixed;
  left: 2rem;
  bottom: 2rem;
  z-index: 20;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 1.5rem;
  padding: 1rem;
  border: 2px solid rgba(255, 215, 0, 0.3);
  backdrop-filter: blur(10px);
}

.tabs-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border-bottom: 1px solid rgba(255, 215, 0, 0.2);
  margin-bottom: 0.5rem;
}

.tabs-icon {
  font-size: 1.25rem;
}

.tabs-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #FFD700;
}

.tabs-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.prize-tab {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid transparent;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: left;
}

.prize-tab:hover {
  background: rgba(255, 255, 255, 0.1);
}

.prize-tab.active {
  background: rgba(255, 215, 0, 0.15);
  border-color: var(--tab-color, #FFD700);
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.3);
}

.tab-rank {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--tab-color, #FFD700);
  color: #1a0a0a;
  border-radius: 50%;
  font-weight: 700;
  font-size: 0.875rem;
}

.prize-tab.active .tab-rank {
  box-shadow: 0 0 10px var(--tab-color, #FFD700);
}

.tab-name {
  flex: 1;
  font-size: 0.9rem;
  font-weight: 600;
  color: white;
}

.tab-count {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
}

.decoration-horses {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.deco-horse {
  position: absolute;
  font-size: 4rem;
  opacity: 0.1;
}

.h1 { top: 20%; left: 5%; animation: deco-float 6s ease-in-out infinite; }
.h2 { top: 60%; right: 5%; animation: deco-float 8s ease-in-out infinite reverse; }
.h3 { bottom: 10%; left: 20%; animation: deco-float 7s ease-in-out infinite 1s; }

@keyframes deco-float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(5deg); }
}

@media (max-width: 768px) {
  .title-row {
    gap: 0.5rem;
  }

  .title-horse {
    font-size: 1.5rem;
  }

  .main-title .char {
    font-size: 2.5rem;
  }

  .subtitle {
    font-size: 1rem;
  }

  .action-row {
    flex-direction: column;
    width: 100%;
    max-width: 300px;
  }

  .action-btn {
    width: 100%;
    justify-content: center;
  }

  .result-glow {
    width: 100px;
    height: 100px;
  }

  .winner-name {
    font-size: 1.5rem;
  }

  .prize-tabs {
    left: 1rem;
    right: 1rem;
    bottom: 1rem;
  }

  .tabs-list {
    flex-direction: row;
    overflow-x: auto;
  }

  .prize-tab {
    flex-shrink: 0;
  }

  .back-btn-fixed {
    right: 1rem;
    bottom: 1rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
  }

  .draw-container {
    width: 95%;
    padding: 0 1rem;
  }

  .name-scroller {
    padding: 1.5rem;
    min-height: 150px;
  }
}
</style>
