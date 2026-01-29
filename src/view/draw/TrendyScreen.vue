<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import * as THREE from 'three'
import {
  loadParticipants,
  loadPrizes,
  loadWinnerRecords,
  getEligibleParticipants,
  addWinnerRecord,
  isPrizeCompleted
} from '../../utils/lotteryStorage'

const emit = defineEmits(['back'])

// State
const containerRef = ref(null)
const drawStatus = ref('idle') // idle, drawing, eliminating, result
const allParticipants = ref([])
const eligibleList = ref([])
const prizes = ref([])
const currentPrizeIndex = ref(0)
const winners = ref([]) 
const winnerRecords = ref([])
const showPrizeSelector = ref(false)

// Config
const ROWS = 10
const COLS = 20
const CARD_WIDTH = 14
const CARD_HEIGHT = 8
const GAP = 1

// Colors
const COLOR_BG = '#4169E1' // Royal Blue (Background cards)
const COLOR_PATTERN = '#FF8C00' // Dark Orange (Pattern cards X & R)
const COLOR_WINNER = '#FFD700' // Gold

// Computed
const currentPrize = computed(() => prizes.value[currentPrizeIndex.value] || {})
const isCurrentPrizeAvailable = computed(() => {
  if (!currentPrize.value.id) return false
  return !isPrizeCompleted(currentPrize.value)
})

const totalWinners = computed(() => winnerRecords.value.length)
const totalParticipants = computed(() => allParticipants.value.length)

// 单次抽取人数
const batchCount = computed(() => currentPrize.value.batchCount || currentPrize.value.count || 1)

// 奖项总人数
const totalPrizeCount = computed(() => currentPrize.value.count || 0)

// 已抽取人数
const prizeDrawnCount = computed(() => winnerRecords.value.filter(r => r.prizeId === currentPrize.value.id).length)

// 剩余可抽取人数
const remainingCount = computed(() => Math.max(0, totalPrizeCount.value - prizeDrawnCount.value))

// 预计还需抽取次数（向上取整）
const remainingDraws = computed(() => {
  if (remainingCount.value <= 0) return 0
  return Math.ceil(remainingCount.value / batchCount.value)
})

// Helpers
const getPrizeDrawCount = (prizeId) => {
  return winnerRecords.value.filter(r => r.prizeId === prizeId).length
}

const togglePrizeSelector = () => {
    if (drawStatus.value === 'drawing') return
    showPrizeSelector.value = !showPrizeSelector.value
}

const selectPrize = (index) => {
    if (drawStatus.value === 'drawing') return
    currentPrizeIndex.value = index
    showPrizeSelector.value = false
    resetScene()
}

// 切换到下一奖项（更高一级）
const goToNextPrize = () => {
    if (currentPrizeIndex.value > 0) {
        currentPrizeIndex.value--
        resetScene()
    }
}

// 是否可以切换到下一奖项
const canGoToNextPrize = computed(() => currentPrizeIndex.value > 0)

// Three.js
let scene, camera, renderer
let meshInstanced
let dummy = new THREE.Object3D()
let cardsData = [] // { index, row, col, isPattern, currentName, velocity, rotation, isWinner }
let animationFrameId
let isSpaceDown = false

// Fallback Data
const DEFAULT_PARTICIPANTS = [
  '张伟', '李娜', '王芳', '刘强', '陈静', '杨帆', '赵磊', '黄艳',
  '周杰', '吴敏', '徐鹏', '孙丽', '马涛', '朱婷', '胡兵', '林娜',
  '郭峰', '罗萍', '梁超', '谢芳', '唐勇', '韩雪', '曹刚', '潘丽',
  '邓林', '杜鹏', '冯强', '沈燕', '彭军', '范梅', '吕刚', '金萍',
  '蒋华', '廖珍', '魏刚', '段丽', '雷兵', '贺芳', '薛刚', '阎娜',
  '顾强', '康丽', '孟刚', '常萍', '侯兵', '文丽', '乔刚', '白燕',
  '韦刚', '池丽', '毕兵', '申丽', '范刚', '彭丽', '郝刚', '间娜'
].map((name, i) => ({ id: `p_${i}`, name, department: '技术部' }))

const DEFAULT_PRIZES = [
  { id: 'first', name: '一等奖', color: '#FFD700', count: 1 },
  { id: 'second', name: '二等奖', color: '#C0C0C0', count: 3 },
  { id: 'third', name: '三等奖', color: '#DAA520', count: 5 }
]

// Data Loading
const loadData = () => {
  const storedParticipants = loadParticipants()
  const storedPrizes = loadPrizes()
  
  // Use Stored or Fallback
  if (storedParticipants && storedParticipants.length > 0) {
      allParticipants.value = storedParticipants
  } else {
      allParticipants.value = DEFAULT_PARTICIPANTS
  }
  
  if (storedPrizes && storedPrizes.length > 0) {
      prizes.value = storedPrizes
      // 默认选中最后一个奖项（从大奖到小奖倒序抽奖）
      currentPrizeIndex.value = Math.max(0, prizes.value.length - 1)
  } else {
      prizes.value = DEFAULT_PRIZES
      currentPrizeIndex.value = 0
  }
  
  // For fallback data, eligible list logic needs to know they aren't in storage yet
  // But getEligibleParticipants reads from storage.
  // If we are strictly using fallback, we should ignore storage 'eligible' check or mock it.
  
  // If we are using defaults, we assume fresh start implies everyone is eligible 
  // unless we track them in memory (which this component does via `winners` ref, but logic uses `eligibleList`).
  
  // Let's simplified: 
  // If we used fallback participants, eligible = all - winners.
  if (allParticipants.value === DEFAULT_PARTICIPANTS) {
      // Filter out in-memory winners
      const winnerIds = new Set(winners.value.map(w => w.id))
      eligibleList.value = allParticipants.value.filter(p => !winnerIds.has(p.id))
  } else {
      eligibleList.value = getEligibleParticipants()
  }
  
  winnerRecords.value = loadWinnerRecords()
}

// ----------------------------------------------------------------------------
// Pattern Logic
// ----------------------------------------------------------------------------
const isPatternCell = (r, c) => {
  // Grid 20 cols (0-19), 10 rows (0-9)
  // "2026"
  // digit width = 4, gap = 1
  // "2": 1-4
  // "0": 6-9
  // "2": 11-14
  // "6": 16-19
  
  const check2 = (lr, lc) => {
     // Format "2" in 4x10 box
     // Top: r=1, Bottom: r=8
     if (lr === 1 || lr === 8) return true
     // Mid: r=4 or 5
     if (lr === 4 || lr === 5) return true
     // Top-Right: lc=3, r < 5
     if (lc === 3 && lr < 5 && lr > 1) return true
     // Top-Right Corner rounding?
     if (lr===2 && lc===3) return true
     
     // Bottom-Left: lc=0, r > 4
     if (lc === 0 && lr > 4 && lr < 8) return true
     
     // Connectors for nicer look
     if (lr===2 && lc===3) return true
     return false
  }
  
  const check0 = (lr, lc) => {
    // Box
    if (lr === 1 || lr === 8) return true
    if (lc === 0 || lc === 3) {
       if (lr > 1 && lr < 8) return true
    }
    return false
  }
  
  const check6 = (lr, lc) => {
    // Top & Bottom
    if (lr === 1 || lr === 8) return true
    // Left
    if (lc === 0 && lr > 1 && lr < 8) return true
    // Mid
    if (lr === 4 || lr === 5) return true
    // Right Bottom Loop
    if (lc === 3 && lr > 4 && lr < 8) return true
    return false
  }
  
  // Digit "2"
  if (c >= 1 && c <= 4) return check2(r, c-1)
  
  // Digit "0"
  if (c >= 6 && c <= 9) return check0(r, c-6)
  
  // Digit "2"
  if (c >= 11 && c <= 14) return check2(r, c-11)
  
  // Digit "6"
  if (c >= 16 && c <= 19) return check6(r, c-16)

  return false
}

// ----------------------------------------------------------------------------
// Three.js Setup
// ----------------------------------------------------------------------------
const initThree = () => {
  if (!containerRef.value) return

  scene = new THREE.Scene()
  // scene.background = new THREE.Color(0x8B0000) // Dark Red Background

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.z = 180

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  containerRef.value.appendChild(renderer.domElement)

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)
  
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
  dirLight.position.set(50, 50, 100)
  scene.add(dirLight)

  // Grid Creation
  createGrid()
  animate()

  window.addEventListener('resize', onWindowResize)
}

const createCardTexture = (name, color) => {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  
  // Bg
  ctx.fillStyle = color
  ctx.fillRect(0,0,256,128)
  
  // Border
  ctx.lineWidth = 8
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.strokeRect(0,0,256,128)
  
  // Text
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 60px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, 128, 64)
  
  return new THREE.CanvasTexture(canvas)
}

// Since we have many different names, InstancedMesh with texture atlas is hard for simple implementation.
// We will use individual Meshes for flexibility in this "Pro" version, 
// as 200 items is very cheap for Three.js.
const cardGroup = new THREE.Group()

const createGrid = () => {
  scene.add(cardGroup)
  cardsData = []
  cardGroup.clear()

  const participants = eligibleList.value.length > 0 ? eligibleList.value : allParticipants.value
  let displayList = []
  while(displayList.length < ROWS * COLS) {
    displayList = displayList.concat(participants)
  }
  displayList = displayList.sort(() => Math.random() - 0.5)

  const offsetX = (COLS * (CARD_WIDTH + GAP)) / 2
  const offsetY = (ROWS * (CARD_HEIGHT + GAP)) / 2

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c
      const isPattern = isPatternCell(r, c)
      const name = displayList[idx % displayList.length].name || displayList[idx % displayList.length]
      
      const color = isPattern ? COLOR_PATTERN : COLOR_BG
      
      // Geometry & Material
      // Using individual materials for simple texture handling per name
      const geometry = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT)
      const texture = createCardTexture(name, color)
      const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
      
      const mesh = new THREE.Mesh(geometry, material)
      
      const x = (c * (CARD_WIDTH + GAP)) - offsetX + CARD_WIDTH/2
      const y = ((ROWS - 1 - r) * (CARD_HEIGHT + GAP)) - offsetY + CARD_HEIGHT/2 // Invert row index for visuals
      
      mesh.position.set(x, y, 0)
      
      cardGroup.add(mesh)
      
      cardsData.push({
        mesh,
        row: r,
        col: c,
        isPattern,
        baseColor: color,
        currentName: name,
        originalPos: new THREE.Vector3(x, y, 0),
        targetPos: null,
        isWinner: false,
        pulseOffset: Math.random() * Math.PI * 2
      })
    }
  }
}

// 消消乐动画状态
let eliminationRound = 0
let eliminatedCount = 0
const ELIMINATE_BATCH_SIZE = 5 // 每次消除的数量
const ELIMINATION_ROUNDS = 8  // 消除轮数

// 随机消除（非中奖者）
const eliminateRandomCards = () => {
  // 只消除非中奖者
  const nonWinners = cardsData.filter(c => !c.isWinner && !c.isEliminated)

  if (nonWinners.length <= 0) return false

  // 随机选择一批消除
  const toEliminate = nonWinners
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(ELIMINATE_BATCH_SIZE, nonWinners.length))

  toEliminate.forEach(card => {
    card.isEliminated = true
  })

  eliminatedCount += toEliminate.length
  eliminationRound++

  // 还有未消除的非中奖者就继续
  const remainingNonWinners = cardsData.filter(c => !c.isWinner && !c.isEliminated)
  return remainingNonWinners.length > 0
}

// Animation
const animate = () => {
  animationFrameId = requestAnimationFrame(animate)

  const time = Date.now() * 0.001

  // Handle Card Animations
  cardsData.forEach(card => {
    const mesh = card.mesh

    if (drawStatus.value === 'idle') {
       // Idle: Static, no movement
       mesh.rotation.x = 0
       mesh.rotation.y = 0
       mesh.position.z = 0
       mesh.scale.set(1, 1, 1)
       mesh.material.opacity = 1

    } else if (drawStatus.value === 'drawing') {
       // 开始抽奖时保持静止，只有轻微呼吸效果
       mesh.rotation.x = 0
       mesh.rotation.y = 0
       mesh.position.z = THREE.MathUtils.lerp(mesh.position.z, 0, 0.1)
       mesh.position.x = card.originalPos.x
       mesh.position.y = card.originalPos.y

    } else if (drawStatus.value === 'eliminating') {
       // 消除动画效果
       if (card.isEliminated) {
         // 消除的卡片：旋转缩小消失
         mesh.rotation.z += 0.15
         mesh.rotation.x += 0.1
         mesh.scale.lerp(new THREE.Vector3(0, 0, 0), 0.12)
         mesh.position.z = THREE.MathUtils.lerp(mesh.position.z, -50, 0.1)

         mesh.material.transparent = true
         mesh.material.opacity = THREE.MathUtils.lerp(mesh.material.opacity, 0, 0.1)
       } else {
         // 未消除的卡片：轻微晃动表示安全
         mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, 0, 0.1)
         mesh.position.x = THREE.MathUtils.lerp(mesh.position.x, card.originalPos.x, 0.1)
         mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, card.originalPos.y, 0.1)
       }

    } else if (drawStatus.value === 'result') {
       // 结果展示：所有卡片回到原位，简化动画
       mesh.position.x = THREE.MathUtils.lerp(mesh.position.x, card.originalPos.x, 0.1)
       mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, card.originalPos.y, 0.1)
       mesh.position.z = THREE.MathUtils.lerp(mesh.position.z, 0, 0.1)
       mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, 0, 0.1)
       mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, 0, 0.1)
       mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, 0, 0.1)
       mesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1)
    }
  })

  renderer.render(scene, camera)
}

const onWindowResize = () => {
  if (!camera || !renderer) return
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

// Logic
const startDraw = () => {
  if (eligibleList.value.length === 0) return alert('暂无参与人员')
  if (!isCurrentPrizeAvailable.value) return alert('该奖项已抽完')

  winners.value = []
  eliminationRound = 0
  eliminatedCount = 0

  // 先确定中奖者
  // 使用 batchCount（单次抽取数量），默认为 count
  const count = currentPrize.value.batchCount || currentPrize.value.count || 1
  const shuffled = [...eligibleList.value].sort(() => Math.random() - 0.5)
  const currentWinners = shuffled.slice(0, count)
  const winnerNames = new Set(currentWinners.map(w => w.name))

  // Reset all cards
  cardsData.forEach(c => {
    c.isWinner = winnerNames.has(c.currentName)
    c.isEliminated = false
    c.mesh.material.opacity = 1
    c.mesh.material.transparent = false
    c.mesh.scale.set(1, 1, 1)
    c.mesh.position.z = 0
    c.mesh.position.copy(c.originalPos)
    c.mesh.rotation.set(0, 0, 0)

    // Reset colors
    const p = eligibleList.value[Math.floor(Math.random() * eligibleList.value.length)]
    const name = p.name || p
    const color = c.isPattern ? COLOR_PATTERN : COLOR_BG
    c.mesh.material.map = createCardTexture(name, color)
  })

  // 直接开始消除动画
  startElimination()
}

// 定时消除任务
let eliminationTimer = null

const startElimination = () => {
  drawStatus.value = 'eliminating'

  // 立即消除一批
  eliminateBatch()
}

const eliminateBatch = () => {
  const hasMore = eliminateRandomCards()

  if (hasMore) {
    // 继续下一轮消除
    eliminationTimer = setTimeout(eliminateBatch, 400) // 每400ms消除一批
  } else {
    // 消除完成，显示结果
    setTimeout(() => {
      drawStatus.value = 'result'
      showWinnerList()
    }, 500)
  }
}

const stopDraw = () => {
  // 先开始消除动画，延迟后显示结果
  startElimination()
}

const showWinnerList = () => {
  const count = currentPrize.value.batchCount || currentPrize.value.count || 1
  const currentWinners = []

  const shuffled = [...eligibleList.value].sort(() => Math.random() - 0.5)
  for (let i = 0; i < count; i++) {
    if (shuffled[i]) {
      currentWinners.push(shuffled[i])
      addWinnerRecord(shuffled[i], currentPrize.value)
    }
  }
  winners.value = currentWinners

  // Select winner cards
  const indices = Array.from({length: cardsData.length}, (_, i) => i)
  indices.sort(() => Math.random() - 0.5)

  // Calculate Centered Grid for Winners
  const wCols = Math.min(currentWinners.length, 3)
  const wRows = Math.ceil(currentWinners.length / wCols)
  const wGapX = CARD_WIDTH * 4
  const wGapY = CARD_HEIGHT * 4
  const wOffsetX = ((wCols - 1) * wGapX) / 2
  const wOffsetY = ((wRows - 1) * wGapY) / 2

  currentWinners.forEach((w, i) => {
    const cardIdx = indices[i]
    if (cardIdx !== undefined) {
      const card = cardsData[cardIdx]
      card.isWinner = true
      card.mesh.material.map = createCardTexture(w.name, COLOR_WINNER)
      card.mesh.material.needsUpdate = true

      const col = i % wCols
      const row = Math.floor(i / wCols)
      const tx = (col * wGapX) - wOffsetX
      const ty = -(row * wGapY) + wOffsetY

      card.targetPos = new THREE.Vector3(tx, ty, 80)
    }
  })

  loadData()
}

const toggleDraw = () => {
  if (drawStatus.value === 'idle' || drawStatus.value === 'result') {
    if (drawStatus.value === 'result') {
        // Reset scene texture colors before starting
        resetGridColors()
    }
    startDraw()
  } else if (drawStatus.value === 'drawing' || drawStatus.value === 'eliminating') {
    // 点击停止，立即显示结果
    stopDraw()
  }
}

const resetGridColors = () => {
    // Reset all textures to original pattern colors
    const participants = eligibleList.value.length > 0 ? eligibleList.value : allParticipants.value
    
    cardsData.forEach((c, i) => {
       const p = participants[i % participants.length]
       const name = p.name || p
       const color = c.isPattern ? COLOR_PATTERN : COLOR_BG
       c.mesh.material.map = createCardTexture(name, color)
    })
}

const handleKeydown = (e) => {
  if (e.code === 'Space') {
    if (!isSpaceDown) {
        isSpaceDown = true
        e.preventDefault()
        toggleDraw()
    }
  }
}
const handleKeyup = (e) => {
    isSpaceDown = false
}

const handlePrizeChange = (index) => {
    if(drawStatus.value === 'drawing') return
    currentPrizeIndex.value = index
    resetScene()
}

const resetScene = () => {
  drawStatus.value = 'idle'
  // Re-create cards to reset positions and textures
  createGrid()
}

// Lifecycle
onMounted(() => {
  loadData()
  initThree()
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('keyup', handleKeyup)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('keyup', handleKeyup)
  window.removeEventListener('resize', onWindowResize)
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  if (renderer) renderer.dispose()
})

const goBack = () => {
  emit('back')
}

</script>

<template>
  <div class="mosaic-container">
    <div ref="containerRef" class="canvas-layer"></div>
    
    <!-- UI Overlay -->
    <div class="ui-layer">
        <!-- Header -->
        <div class="header">
             <div class="stat-box">
                <span class="stat-label">中奖人数</span>
                <span class="stat-value">{{ totalWinners }}</span>
             </div>
             
             <div class="prize-info">
                 <h1>{{ currentPrize.name || '幸运抽奖' }}</h1>
                 <p v-if="totalPrizeCount">名额: {{ totalPrizeCount }} (一次抽 {{ batchCount }} 人)</p>
                 <p v-if="remainingDraws > 0" class="remaining-draws">还需 {{ remainingDraws }} 次抽完</p>
             </div>
             
             <div class="stat-box">
                <span class="stat-label">参与人数</span>
                <span class="stat-value">{{ totalParticipants }}</span>
             </div>
        </div>
        
        <!-- Controls -->
        <div class="controls">
             <button class="action-btn" @click="toggleDraw">
                {{ drawStatus !== 'idle' && drawStatus !== 'result' ? '停止' : '开始抽奖' }}
             </button>
             <span class="keyboard-hint">按空格键也可以</span>
        </div>

        <!-- 中奖名单显示 -->
        <transition name="slide-up">
            <div v-if="drawStatus === 'result' && winners.length > 0" class="winner-list-panel">
                <div class="winner-header">
                    <span class="trophy">🏆</span>
                    <span>中奖名单</span>
                </div>
                <div class="winner-names">
                    <span v-for="(w, idx) in winners" :key="idx" class="winner-name">
                        {{ w.name }}
                    </span>
                </div>
            </div>
        </transition>
        
        <!-- Prize Selector (Bottom Left) -->
        <div class="prize-selector-container">
            <button class="prize-select-btn" @click="togglePrizeSelector">
                {{ currentPrize.name }}
                <span class="arrow">{{ showPrizeSelector ? '▲' : '▼' }}</span>
            </button>
            <transition name="fade">
              <div v-if="showPrizeSelector" class="prize-dropdown">
                  <div
                      v-for="(p, i) in prizes"
                      :key="i"
                      class="prize-option"
                      :class="{ active: i === currentPrizeIndex }"
                      @click="selectPrize(i)"
                  >
                      {{ p.name }}
                  </div>
              </div>
            </transition>
            <!-- 下一奖项按钮 -->
            <button
                v-if="canGoToNextPrize"
                class="next-prize-btn"
                @click="goToNextPrize"
                title="切换到高一级奖项"
            >
                <span class="material-symbols-outlined">arrow_upward</span>
                下一奖项
            </button>
        </div>
        
        <!-- Back Button (Bottom Right) -->
        <button class="back-btn-corner" @click="goBack">
            返回后台
        </button>
    </div>
  </div>
</template>

<style scoped>
.mosaic-container {
  width: 100vw;
  height: 100vh;
  background: #8B0000; /* Festive Red */
  position: relative;
  overflow: hidden;
}

.canvas-layer {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.ui-layer {
  position: absolute;
  inset: 0;
  z-index: 10;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 2rem;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  pointer-events: auto;
}

.stat-box {
  background: rgba(0,0,0,0.5);
  border: 1px solid #FFD700;
  padding: 0.5rem 1.5rem;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #FFD700;
  min-width: 100px;
}
.stat-label {
  font-size: 0.8rem;
  opacity: 0.8;
}
.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
}

.prize-info {
  text-align: center;
  color: #FFD700;
  text-shadow: 0 2px 10px rgba(0,0,0,0.5);
}
.prize-info h1 {
  font-size: 3rem;
  margin: 0;
}
.prize-info p {
  font-size: 1.2rem;
  opacity: 0.8;
}

.prize-info .remaining-draws {
  font-size: 0.9rem;
  opacity: 0.7;
  color: rgba(255, 215, 0, 0.8);
  margin-top: 0.25rem;
}

/* Controls */
.controls {
  position: absolute;
  bottom: 8%;  /* 按钮下移 */
  left: 50%;
  transform: translateX(-50%);
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.keyboard-hint {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.6);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.action-btn {
  background: #FFD700;
  color: #8B0000;
  border: none;
  padding: 1rem 3rem;
  font-size: 1.5rem;
  font-weight: 900;
  border-radius: 50px;
  cursor: pointer;
  box-shadow: 0 5px 15px rgba(0,0,0,0.3);
  transition: transform 0.1s;
}
.action-btn:active {
  transform: scale(0.95);
}

/* Winner List Panel */
.winner-list-panel {
  position: absolute;
  bottom: 25%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.85);
  border: 2px solid #FFD700;
  border-radius: 20px;
  padding: 1.5rem 2.5rem;
  text-align: center;
  min-width: 300px;
  pointer-events: auto;
  box-shadow: 0 0 30px rgba(255, 215, 0, 0.3);
}

.winner-header {
  color: #FFD700;
  font-size: 1.3rem;
  font-weight: bold;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.trophy {
  font-size: 1.5rem;
}

.winner-names {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  justify-content: center;
}

.winner-name {
  color: #FFD700;
  padding: 0.3rem 0.8rem;
  font-size: 1.2rem;
  font-weight: bold;
}

/* Transition for winner panel */
.slide-up-enter-active {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.slide-up-leave-active {
  transition: all 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(50px);
}

/* Prize Selector */
.prize-selector-container {
    position: absolute;
    bottom: 2rem;
    left: 2rem;
    pointer-events: auto;
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
}

.prize-select-btn {
    background: rgba(0,0,0,0.6);
    border: 2px solid #FFD700;
    color: #FFD700;
    padding: 0.75rem 1.5rem;
    border-radius: 30px;
    font-size: 1.1rem;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    backdrop-filter: blur(5px);
}

.prize-dropdown {
    position: absolute;
    bottom: 120%;
    left: 0;
    background: rgba(0,0,0,0.9);
    border: 1px solid #FFD700;
    border-radius: 10px;
    overflow: hidden;
    min-width: 150px;
}

.prize-option {
    padding: 0.75rem 1rem;
    color: #FFD700;
    cursor: pointer;
    border-bottom: 1px solid rgba(255,215,0,0.2);
    white-space: nowrap;
}
.prize-option:last-child {
    border-bottom: none;
}
.prize-option:hover {
    background: rgba(255,215,0,0.2);
}
.prize-option.active {
    background: rgba(255,215,0,0.4);
}
.badge {
    font-size: 0.7rem;
    background: #666;
    padding: 2px 5px;
    border-radius: 4px;
    margin-left: 5px;
}

/* 下一奖项按钮 */
.next-prize-btn {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.75rem 1rem;
    background: rgba(0, 0, 0, 0.6);
    border: 2px solid rgba(255, 215, 0, 0.5);
    border-radius: 30px;
    color: #FFD700;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.3s;
    backdrop-filter: blur(5px);
}

.next-prize-btn:hover {
    background: rgba(0, 0, 0, 0.8);
    border-color: #FFD700;
}

.next-prize-btn .material-symbols-outlined {
    font-size: 1.1rem;
}

/* Back Button */
.back-btn-corner {
  position: absolute;
  bottom: 2rem;
  right: 2rem;
  background: rgba(0,0,0,0.3);
  color: white;
  border: 1px solid rgba(255,255,255,0.3);
  padding: 0.75rem 1.5rem;
  border-radius: 30px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  pointer-events: auto;
  backdrop-filter: blur(5px);
}

.back-btn-corner:hover {
  background: rgba(255,255,255,0.1);
  border-color: white;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
