<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

// 导入缓存管理和抽奖算法模块
import {
  loadParticipants,
  loadPrizes,
  loadSettings,
  loadWinnerRecords,
  checkSystemReady,
  getEligibleParticipants,
  addWinnerRecord,
  updateParticipantStatus,
  saveWinnerRecords,
  isPrizeCompleted
} from '../../utils/lotteryStorage'
import { draw, validateDrawResult, getAlgorithmInfo } from '../../utils/lotteryAlgorithm'

const emit = defineEmits(['back'])

// ========== 状态定义 ==========
const drawStatus = ref('idle') // idle, ready, drawing, stopping, result
const showConfigAlert = ref(false)
const configAlertMessage = ref('')
const isAutoStopped = ref(false) // 标记是否是自动停止

// 加载的数据
const allParticipants = ref([])
const eligibleParticipants = ref([])
const prizes = ref([])
const settings = ref(null)
const winnerRecords = ref([])

// 当前奖项
const currentPrizeIndex = ref(0)
const currentPrize = computed(() => prizes.value[currentPrizeIndex.value] || {
  name: '未配置',
  subtitle: '请先配置奖项',
  count: 0,
  level: 0
})

// 中奖结果
const winners = ref([])
// 大奖环节中奖者人名列表（用于"人名+词语"格式弹幕）
let grandPrizeWinnerNames = []
// 已中奖累计人数
const drawnCount = computed(() => prizeDrawnCount.value)
const totalCount = computed(() => currentPrize.value.count || 0)

// 单次抽取人数（批次大小）
const batchSize = computed(() => currentPrize.value.batchCount || currentPrize.value.count || 1)

// 奖项总人数
const totalPrizeCount = computed(() => currentPrize.value.count || 0)

// 已抽取人数（累计）
const prizeDrawnCount = computed(() => winnerRecords.value.filter(r => r.prizeId === currentPrize.value.id).length)

// 剩余可抽取人数
const remainingCount = computed(() => Math.max(0, totalPrizeCount.value - prizeDrawnCount.value))

// 当前轮次应抽取人数（考虑剩余人数，最后一批可能不足batchCount）
const currentBatchCount = computed(() => {
  const batch = batchSize.value
  const remaining = remainingCount.value
  return Math.min(batch, remaining)
})

// 预计还需抽取次数（向上取整）
const remainingDraws = computed(() => {
  if (remainingCount.value <= 0) return 0
  return Math.ceil(remainingCount.value / batchSize.value)
})

// 弹幕
const danmakuList = ref([])
const danmakuTexts = [
  '恭喜中奖！🎉', '吸欧气！✨', '大奖拿回家！🎁', '羡慕了！',
  '下个就是我！💪', '太强了！', '666！', '好运连连！🍀',
  '新年快乐！🧧', '万事如意！', '我也想要大奖！', '欧皇附体！',
  '恭喜恭喜！', '一定要幸福哦！', '明年我也中！', '厉害了！',
  '这运气没谁了！', '老板大气！', '蹭蹭喜气！', '发财了！'
]

// 大奖环节专用弹幕（更喜庆、更多样）
const grandPrizeDanmakuTexts = [
  '2026好运连连！🎉', '老板发红包！✨', '大奖拿回家！🎁', '羡慕了！', '太强了！',
  '好运连连！🍀', '新年快乐！🧧', '万事如意！', '欧皇附体！', '恭喜恭喜！',
  '今年运气爆棚！', '太幸运了吧！', '接好运啦！', '66666！', '这就是欧皇吗！',
  '恭喜恭喜！🎊', '红红火火！', '恍恍惚惚！', '太厉害了！', '大吉大利！',
  '好运来！🎵', '财源滚滚！💰', '心想事成！✨', '福气满满！🧧', '喜气洋洋！',
  '运气太好了！', '让人羡慕！', '太强了吧！', '这就是实力！', '恭喜恭喜恭喜！'
]

// 喜庆词语（用于生成"名字+词语"格式的弹幕）
const celebrationWords = [
  '恭喜发财！', '发大财！', '好运来！', '万事如意！', '心想事成！',
  '财源广进！', '大吉大利！', '福星高照！', '步步高升！', '红红火火！',
  '新年快乐！', '恭喜恭喜！', '鸿运当头！', '吉星高照！', '五福临门！'
]

// ========== 缓存加载 ==========
function loadSystemData() {
  // 加载设置
  const savedSettings = loadSettings()
  settings.value = savedSettings || {
    soundEnabled: true,              // 音效总开关
    drawMode: 'random',
    weightedBy: 'department',
    allowRepeatWins: false,
    showWinnerAvatar: false,         // 默认关闭头像显示
    showWinnerDept: false,           // 默认关闭部门显示
    barrageEnabled: true,
    bgmEnabled: true,
    sfxEnabled: true,
    animationSpeed: 'normal'
  }

  // 加载参与人员
  allParticipants.value = loadParticipants()

  // 加载奖项配置
  prizes.value = loadPrizes()
  // 默认选中最后一个奖项（从大奖到小奖倒序抽奖）
  currentPrizeIndex.value = Math.max(0, prizes.value.length - 1)

  // 加载中奖记录
  winnerRecords.value = loadWinnerRecords()

  // 检查系统是否已配置
  const checkResult = checkSystemReady()
  if (!checkResult.isReady) {
    showConfigAlert.value = true
    configAlertMessage.value = `请先配置以下内容后再开奖：${checkResult.missingItems.join('、')}`
    return false
  }

  // 更新待抽奖人员列表
  updateEligibleParticipants()
  return true
}

// ========== 监听 Storage 变化 ==========
function handleStorageChange(e) {
  if (e.key === 'lottery_prizes' || e.key === 'lottery_participants') {
    // 奖项或参与人员变更，重新加载
    prizes.value = loadPrizes()
    allParticipants.value = loadParticipants()
    updateEligibleParticipants()
    console.log('检测到配置变化，已自动更新')
  }
}

function updateEligibleParticipants() {
  eligibleParticipants.value = getEligibleParticipants()
}

// ========== 奖项选择 ==========
const showPrizeSelector = ref(false)

function togglePrizeSelector() {
  if (drawStatus.value !== 'idle' && drawStatus.value !== 'ready') return
  // 打开下拉框时重新读取奖项和中奖记录缓存
  prizes.value = loadPrizes()
  winnerRecords.value = loadWinnerRecords()
  showPrizeSelector.value = !showPrizeSelector.value
}

function selectPrize(index) {
  const prize = prizes.value[index]
  if (drawStatus.value !== 'idle' && drawStatus.value !== 'ready') return
  // 如果奖项已抽取完毕，不允许选择
  if (isPrizeCompleted(prize)) return
  currentPrizeIndex.value = index
  showPrizeSelector.value = false
  resetScene()
}

// 切换到下一奖项（更高一级）
function goToNextPrize() {
  if (currentPrizeIndex.value > 0) {
    currentPrizeIndex.value--
    resetScene()
  }
}

// 是否可以切换到下一奖项
const canGoToNextPrize = computed(() => currentPrizeIndex.value > 0)

// 获取奖项剩余可抽取数量
function getPrizeDrawCount(prizeId) {
  return winnerRecords.value.filter(r => r.prizeId === prizeId).length
}

// 当前选中的奖项是否可用
const isCurrentPrizeAvailable = computed(() => {
  return currentPrize.value && !isPrizeCompleted(currentPrize.value)
})

// 抽奖按钮是否禁用
const isDrawButtonDisabled = computed(() => {
  return eligibleParticipants.value.length === 0 || !isCurrentPrizeAvailable.value
})

// ========== 键盘事件 ==========
function handleKeydown(e) {
  // 只响应空格键，且不在输入框中
  if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
    e.preventDefault() // 防止页面滚动

    if (drawStatus.value === 'idle' || drawStatus.value === 'ready') {
      // 空格键开始抽奖
      if (!isDrawButtonDisabled.value) {
        startDraw()
      }
    } else if (drawStatus.value === 'drawing') {
      // 空格键停止抽奖
      isAutoStopped.value = false
      stopDraw()
    }
  }
}

// ========== Canvas 相关 ==========
let canvas, ctx
let animationId
let particles = []
let speedLines = []
let floatingDots = []

// 烟花独立 Canvas 上下文
let fireworkCanvas, fireworkCtx
let fireworkAnimationId
let fireworks = []
let sparkParticles = []
let showFireworks = ref(false)

// 粒子类（名字）- Z轴飞行效果
class NameParticle {
  constructor(centerX, centerY, name, isWinner = false, index = 0, total = 1, avatar = null, dept = '') {
    this.name = name
    this.avatar = avatar
    this.dept = dept
    this.isWinner = isWinner
    this.centerX = centerX
    this.centerY = centerY
    this.index = index
    this.total = total

    this.baseFontSize = 20 + Math.random() * 10
    this.reset()
  }

  reset() {
    const goldenAngle = Math.PI * (3 - Math.sqrt(5))
    const baseAngle = goldenAngle * this.index
    const angleOffset = (Math.random() - 0.5) * 0.3
    const angle = baseAngle + angleOffset

    const spreadRadius = 400 + Math.random() * 400

    this.dirX = Math.cos(angle) * spreadRadius
    this.dirY = Math.sin(angle) * spreadRadius

    const layerOffset = (this.index % 10) * 0.15
    this.z = -layerOffset
    this.zSpeed = 0.004 + Math.random() * 0.006
    this.maxZ = 1.2

    this.alpha = 0
    this.edgeFade = 1
  }

  update(canvasWidth, canvasHeight) {
    this.z += this.zSpeed

    if (this.z < 0.01) {
      this.alpha = 0
      return
    }

    const scale = this.z / this.maxZ
    const screenX = this.centerX + this.dirX * scale
    const screenY = this.centerY + this.dirY * scale

    const edgeDistance = 250
    let edgeFadeX = 1
    let edgeFadeY = 1

    if (screenX < edgeDistance) {
      edgeFadeX = Math.max(0, screenX / edgeDistance)
    } else if (screenX > canvasWidth - edgeDistance) {
      edgeFadeX = Math.max(0, (canvasWidth - screenX) / edgeDistance)
    }

    if (screenY < edgeDistance) {
      edgeFadeY = Math.max(0, screenY / edgeDistance)
    } else if (screenY > canvasHeight - edgeDistance) {
      edgeFadeY = Math.max(0, (canvasHeight - screenY) / edgeDistance)
    }

    this.edgeFade = Math.min(edgeFadeX, edgeFadeY)

    let zAlpha = 1
    if (this.z < 0.15) {
      zAlpha = this.z / 0.15
    } else if (this.z > 0.6) {
      zAlpha = Math.max(0, (this.maxZ - this.z) / (this.maxZ - 0.6))
    }

    this.alpha = Math.max(0, Math.min(1, zAlpha * this.edgeFade))
  }

  isDead() {
    return this.z >= this.maxZ
  }

  shouldRemove() {
    return this.z >= this.maxZ || (this.z > 0.15 && this.alpha <= 0.01)
  }

  draw(ctx) {
    if (this.z <= 0.01) return

    const scale = this.z / this.maxZ
    const screenX = this.centerX + this.dirX * scale
    const screenY = this.centerY + this.dirY * scale

    const normalizedZ = this.z / this.maxZ
    const sizeScale = 0.3 + normalizedZ * 2.5
    const fontSize = this.baseFontSize * sizeScale

    if (screenX < -800 || screenX > canvas.width + 800 ||
        screenY < -800 || screenY > canvas.height + 800) {
      return
    }

    ctx.save()
    ctx.translate(screenX, screenY)
    ctx.globalAlpha = this.alpha

    ctx.font = `900 ${fontSize}px "Microsoft YaHei", sans-serif`
    const textWidth = ctx.measureText(this.name).width
    const padding = 8 + sizeScale * 4

    const gradient = ctx.createLinearGradient(-textWidth/2 - padding, 0, textWidth/2 + padding, 0)
    gradient.addColorStop(0, this.isWinner ? 'rgba(255, 215, 0, 0.95)' : 'rgba(255, 215, 0, 0.85)')
    gradient.addColorStop(1, this.isWinner ? 'rgba(255, 165, 0, 0.95)' : 'rgba(255, 140, 0, 0.85)')

    ctx.fillStyle = gradient
    ctx.shadowColor = 'rgba(255, 215, 0, 0.6)'
    ctx.shadowBlur = 10 + sizeScale * 5

    const rectHeight = fontSize + padding
    this.roundRect(ctx, -textWidth/2 - padding, -fontSize/2 - padding/2, textWidth + padding*2, rectHeight, 8)
    ctx.fill()

    ctx.shadowBlur = 0
    ctx.fillStyle = '#8B0000'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.name, 0, 0)

    ctx.restore()
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    ctx.lineTo(x + radius, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
  }
}

// 速度线类
class SpeedLine {
  constructor(centerX, centerY) {
    this.centerX = centerX
    this.centerY = centerY

    const angle = Math.random() * Math.PI * 2
    const radius = 200 + Math.random() * 400

    this.dirX = Math.cos(angle) * radius
    this.dirY = Math.sin(angle) * radius

    this.z = 0.01
    this.zSpeed = 0.015 + Math.random() * 0.02
    this.maxZ = 1

    this.length = 80 + Math.random() * 120
    this.width = 2 + Math.random() * 3
    this.alpha = 0
  }

  update() {
    this.z += this.zSpeed

    if (this.z < 0.1) {
      this.alpha = this.z / 0.1
    } else if (this.z > 0.8) {
      this.alpha = (this.maxZ - this.z) / (this.maxZ - 0.8)
    } else {
      this.alpha = 0.6
    }
  }

  isDead() {
    return this.z >= this.maxZ
  }

  draw(ctx) {
    if (this.z <= 0 || this.alpha <= 0) return

    const scale = this.z / this.maxZ
    const screenX = this.centerX + this.dirX * scale
    const screenY = this.centerY + this.dirY * scale

    if (screenX < -100 || screenX > canvas.width + 100 ||
        screenY < -100 || screenY > canvas.height + 100) {
      return
    }

    ctx.save()

    const prevScale = Math.max(0, (this.z - 0.1) / this.maxZ)
    const prevX = this.centerX + this.dirX * prevScale
    const prevY = this.centerY + this.dirY * prevScale

    const gradient = ctx.createLinearGradient(prevX, prevY, screenX, screenY)
    gradient.addColorStop(0, 'rgba(255, 215, 0, 0)')
    gradient.addColorStop(0.5, `rgba(255, 215, 0, ${this.alpha * 0.8})`)
    gradient.addColorStop(1, `rgba(255, 215, 0, ${this.alpha})`)

    ctx.strokeStyle = gradient
    ctx.lineWidth = this.width * scale * 1.5
    ctx.lineCap = 'round'

    ctx.shadowColor = '#FFD700'
    ctx.shadowBlur = 15 * scale

    ctx.globalAlpha = this.alpha

    ctx.beginPath()
    ctx.moveTo(prevX, prevY)
    ctx.lineTo(screenX, screenY)
    ctx.stroke()

    ctx.restore()
  }
}

// 漂浮微粒类
class FloatingDot {
  constructor(width, height) {
    this.x = Math.random() * width
    this.y = Math.random() * height
    this.vx = (Math.random() - 0.5) * 0.5
    this.vy = (Math.random() - 0.5) * 0.5
    this.radius = 1 + Math.random() * 3
    this.alpha = 0.3 + Math.random() * 0.4
    this.pulseSpeed = 0.02 + Math.random() * 0.03
    this.pulse = 0
  }

  update(width, height) {
    this.x += this.vx
    this.y += this.vy
    this.pulse += this.pulseSpeed

    if (this.x < 0 || this.x > width) this.vx *= -1
    if (this.y < 0 || this.y > height) this.vy *= -1
  }

  draw(ctx) {
    ctx.save()
    ctx.globalAlpha = this.alpha + Math.sin(this.pulse) * 0.2
    ctx.fillStyle = '#FFD700'
    ctx.shadowColor = '#FFD700'
    ctx.shadowBlur = 10

    ctx.beginPath()
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }
}

// 烟花粒子类
class FireworkParticle {
  constructor(x, y, targetX, targetY, hue) {
    this.x = x
    this.y = y
    this.startX = x
    this.startY = y
    this.targetX = targetX
    this.targetY = targetY
    this.distanceToTarget = Math.sqrt(Math.pow(targetX - x, 2) + Math.pow(targetY - y, 2))
    this.distanceTraveled = 0
    this.coordinates = []
    this.coordinateCount = 3
    while (this.coordinateCount--) {
      this.coordinates.push([this.x, this.y])
    }
    this.angle = Math.atan2(targetY - y, targetX - x)
    this.speed = 2
    this.acceleration = 1.05
    this.brightness = Math.random() * 50 + 50
    this.hue = hue
    this.targetRadius = 1
  }

  update(index) {
    this.coordinates.pop()
    this.coordinates.unshift([this.x, this.y])
    this.speed *= this.acceleration

    const vx = Math.cos(this.angle) * this.speed
    const vy = Math.sin(this.angle) * this.speed
    this.distanceTraveled = Math.sqrt(Math.pow(this.x + vx - this.startX, 2) + Math.pow(this.y + vy - this.startY, 2))

    if (this.distanceTraveled >= this.distanceToTarget) {
      createSparkParticles(this.targetX, this.targetY, this.hue)
      fireworks.splice(index, 1)
    } else {
      this.x += vx
      this.y += vy
    }
  }

  draw(ctx) {
    ctx.beginPath()
    ctx.moveTo(this.coordinates[this.coordinates.length - 1][0], this.coordinates[this.coordinates.length - 1][1])
    ctx.lineTo(this.x, this.y)
    ctx.strokeStyle = `hsl(${this.hue}, 100%, ${this.brightness}%)`
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(this.x, this.y, this.targetRadius, 0, Math.PI * 2)
    ctx.stroke()
  }
}

// 爆炸粒子类
class SparkParticle {
  constructor(x, y, hue) {
    this.x = x
    this.y = y
    this.coordinates = []
    this.coordinateCount = 5
    while (this.coordinateCount--) {
      this.coordinates.push([this.x, this.y])
    }
    this.angle = Math.random() * Math.PI * 2
    this.speed = Math.random() * 10 + 1
    this.friction = 0.95
    this.gravity = 1
    this.hue = Math.random() * 20 + hue
    this.brightness = Math.random() * 50 + 50
    this.alpha = 1
    this.decay = Math.random() * 0.015 + 0.015
  }

  update(index) {
    this.coordinates.pop()
    this.coordinates.unshift([this.x, this.y])
    this.speed *= this.friction
    this.x += Math.cos(this.angle) * this.speed
    this.y += Math.sin(this.angle) * this.speed + this.gravity
    this.alpha -= this.decay

    if (this.alpha <= this.decay) {
      sparkParticles.splice(index, 1)
    }
  }

  draw(ctx) {
    ctx.beginPath()
    ctx.moveTo(this.coordinates[this.coordinates.length - 1][0], this.coordinates[this.coordinates.length - 1][1])
    ctx.lineTo(this.x, this.y)
    ctx.strokeStyle = `hsla(${this.hue}, 100%, ${this.brightness}%, ${this.alpha})`
    ctx.stroke()
  }
}

function createSparkParticles(x, y, hue) {
  const count = 150
  for (let i = 0; i < count; i++) {
    sparkParticles.push(new SparkParticle(x, y, hue))
  }
}

// ========== Canvas 初始化 ==========
function initCanvas() {
  canvas = document.getElementById('particle-canvas')
  if (!canvas) return

  ctx = canvas.getContext('2d')
  resizeCanvas()

  createFloatingDots()
  animate()

  window.addEventListener('resize', resizeCanvas)
}

function resizeCanvas() {
  if (!canvas) return
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
}

function createFloatingDots() {
  floatingDots = []
  const count = 100
  for (let i = 0; i < count; i++) {
    floatingDots.push(new FloatingDot(canvas.width, canvas.height))
  }
}

function animate() {
  animationId = requestAnimationFrame(animate)

  if (!ctx || !canvas) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 更新背景漂浮微粒
  if (drawStatus.value === 'idle' || drawStatus.value === 'ready' || drawStatus.value === 'drawing') {
    floatingDots.forEach(dot => {
      dot.update(canvas.width, canvas.height)
      dot.draw(ctx)
    })
  }

  // 更新速度线
  speedLines = speedLines.filter(line => !line.isDead())
  speedLines.forEach(line => {
    line.update()
    line.draw(ctx)
  })

  // 更新名字粒子
  if (drawStatus.value === 'drawing') {
    particles.forEach(particle => {
      if (particle.isDead()) {
        particle.reset()
      }
      particle.update(canvas.width, canvas.height)
      particle.draw(ctx)
    })
  } else {
    particles = particles.filter(p => !p.shouldRemove())
    particles.forEach(particle => {
      particle.update(canvas.width, canvas.height)
      particle.draw(ctx)
    })
  }
}

// ========== 烟花效果 ==========
let fireworkInterval = null

function startFireworks() {
  showFireworks.value = true

  if (!fireworkCanvas) {
    fireworkCanvas = document.getElementById('firework-canvas')
    if (fireworkCanvas) {
      fireworkCtx = fireworkCanvas.getContext('2d')
      resizeFireworkCanvas()
      window.addEventListener('resize', resizeFireworkCanvas)
    }
  }

  if (!fireworkAnimationId) {
    animateFireworks()
  }

  function loop() {
    if (!showFireworks.value) return

    if (drawStatus.value === 'result') {
      const startX = window.innerWidth / 2 + (Math.random() - 0.5) * window.innerWidth * 0.5
      const targetX = Math.random() * window.innerWidth
      const targetY = Math.random() * window.innerHeight * 0.5
      const hue = Math.random() * 360
      fireworks.push(new FireworkParticle(startX, window.innerHeight, targetX, targetY, hue))
    }

    const delay = Math.random() * 800 + 200
    fireworkInterval = setTimeout(loop, delay)
  }

  loop()
}

function stopFireworks() {
  showFireworks.value = false
  if (fireworkInterval) {
    clearTimeout(fireworkInterval)
    fireworkInterval = null
  }
  fireworks = []
  sparkParticles = []

  if (fireworkAnimationId) {
    cancelAnimationFrame(fireworkAnimationId)
    fireworkAnimationId = null
  }

  if (fireworkCtx && fireworkCanvas) {
    fireworkCtx.clearRect(0, 0, fireworkCanvas.width, fireworkCanvas.height)
  }
}

function resizeFireworkCanvas() {
  if (fireworkCanvas) {
    fireworkCanvas.width = window.innerWidth
    fireworkCanvas.height = window.innerHeight
  }
}

function animateFireworks() {
  if (!fireworkCtx || !fireworkCanvas) {
    fireworkAnimationId = requestAnimationFrame(animateFireworks)
    return
  }

  fireworkCtx.globalCompositeOperation = 'destination-out'
  fireworkCtx.fillStyle = 'rgba(0, 0, 0, 0.2)'
  fireworkCtx.fillRect(0, 0, fireworkCanvas.width, fireworkCanvas.height)
  fireworkCtx.globalCompositeOperation = 'lighter'

  let i = fireworks.length
  while (i--) {
    fireworks[i].draw(fireworkCtx)
    fireworks[i].update(i)
  }

  let j = sparkParticles.length
  while (j--) {
    sparkParticles[j].draw(fireworkCtx)
    sparkParticles[j].update(j)
  }

  fireworkAnimationId = requestAnimationFrame(animateFireworks)
}

// ========== 弹幕初始化 ==========
function initDanmaku() {
  danmakuList.value = []

  // 判断是否为大奖环节（有中奖者人名列表且人数少于5人）
  const isGrandPrize = grandPrizeWinnerNames.length > 0 && grandPrizeWinnerNames.length < 5
  const count = isGrandPrize ? 100 : 40
  const textsPool = isGrandPrize ? grandPrizeDanmakuTexts : danmakuTexts

  for (let i = 0; i < count; i++) {
    let text

    // 大奖环节：前20条弹幕使用"人名+喜庆词语"格式
    if (isGrandPrize && i < 20 && grandPrizeWinnerNames.length > 0) {
      const randomName = grandPrizeWinnerNames[Math.floor(Math.random() * grandPrizeWinnerNames.length)]
      const randomWord = celebrationWords[Math.floor(Math.random() * celebrationWords.length)]
      text = `${randomName}${randomWord}`
    } else {
      text = textsPool[Math.floor(Math.random() * textsPool.length)]
    }

    // 优化弹幕分布：分层垂直位置，避免重叠
    let top
    if (isGrandPrize) {
      // 大奖环节：将100条弹幕分成10层，每层10条
      const layer = i % 10
      const layerOffset = (Math.random() - 0.5) * 4 // 每层内微调 ±2%
      top = 5 + layer * 9 + layerOffset // 从5%开始，每层间隔9%
    } else {
      top = Math.random() * 90
    }

    // 优化延迟时间：大奖弹幕延迟范围更长，分批出现
    let delay
    if (isGrandPrize) {
      // 大奖环节：延迟0-60秒，分散出现
      const batch = Math.floor(i / 10) // 分10批
      delay = batch * 3 + Math.random() * 6 // 每批间隔约3秒，批内随机0-6秒
    } else {
      delay = Math.random() * 30
    }

    const duration = isGrandPrize ? (20 + Math.random() * 15) : (15 + Math.random() * 20)
    // 大奖弹幕字体稍小一些，避免太拥挤
    const fontSize = isGrandPrize ? (1.0 + Math.random() * 0.8 + 'rem') : (1.2 + Math.random() * 1.5 + 'rem')

    // 大奖环节增加金色和红色弹幕比例（金色40%、红色40%、白色20%）
    let color
    if (isGrandPrize) {
      const rand = Math.random()
      if (rand < 0.4) {
        color = '#FFD700' // 金色 40%
      } else if (rand < 0.8) {
        color = '#FF6B6B' // 红色 40%
      } else {
        color = '#FFFFFF' // 白色 20%
      }
    } else {
      color = Math.random() > 0.6 ? '#FFD700' : '#FFFFFF'
    }

    danmakuList.value.push({
      id: i,
      text,
      style: {
        top: `${top}%`,
        left: '100%',
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
        fontSize,
        color
      }
    })
  }
}

watch(drawStatus, (newVal) => {
  if (newVal === 'result' && settings.value?.barrageEnabled) {
    // 在 stopDraw 中已经通过 saveWinnersToRecords 调用了 initDanmaku
    // 这里只处理非大奖环节的情况（由 stopDraw 中的 nextTick 调用 initDanmaku）
  } else {
    danmakuList.value = []
  }
})

// ========== 抽奖逻辑 ==========
let drawTimer = null

function startDraw() {
  if (drawStatus.value !== 'idle' && drawStatus.value !== 'ready') return

  if (eligibleParticipants.value.length === 0) {
    alert('没有可抽奖的参与人员！')
    return
  }

  // 确保 canvas 已初始化
  if (!canvas || !ctx) {
    initCanvas()
  }

  // 播放开始音效
  if (settings.value?.soundEnabled && settings.value?.sfxEnabled) {
    playSound('start')
  }

  drawStatus.value = 'drawing'
  isAutoStopped.value = false

  const centerX = canvas.width / 2
  const centerY = canvas.height / 2

  // 预先使用算法抽取中奖者
  // 使用 currentBatchCount（考虑剩余人数）
  const winnerCount = currentBatchCount.value

  const selectedWinners = draw(eligibleParticipants.value, winnerCount, settings.value)
  winners.value = selectedWinners

  // 创建所有参与者的粒子
  eligibleParticipants.value.forEach((person, index) => {
    const isWinner = selectedWinners.some(w => w.id === person.id)
    const particle = new NameParticle(
      centerX, centerY,
      person.name,
      isWinner,
      index,
      eligibleParticipants.value.length,
      person.avatar,
      person.department
    )
    particles.push(particle)
  })

  // 创建速度线
  const lineInterval = setInterval(() => {
    if (drawStatus.value !== 'drawing') {
      clearInterval(lineInterval)
      return
    }
    for (let i = 0; i < 3; i++) {
      speedLines.push(new SpeedLine(centerX, centerY))
    }
  }, 50)

  // 根据动画速度设置自动停止时间
  const durationMap = { fast: 1500, normal: 3000, slow: 5000 }
  const autoStopTime = durationMap[settings.value?.animationSpeed || 'normal'] || 3000

  drawTimer = setTimeout(() => {
    isAutoStopped.value = true
    stopDraw()
  }, autoStopTime + 2000)
}

function stopDraw() {
  if (drawStatus.value !== 'drawing') return

  if (drawTimer) {
    clearTimeout(drawTimer)
    drawTimer = null
  }

  drawStatus.value = 'stopping'

  setTimeout(() => {
    particles = []
    speedLines = []
    drawStatus.value = 'result'

    // 播放中奖音效
    if (settings.value?.soundEnabled && settings.value?.sfxEnabled) {
      playSound('end')
    }

    // 保存中奖者人名列表（用于大奖弹幕）
    grandPrizeWinnerNames = winners.value.map(w => w.name)

    // 保存中奖记录（会更新 eligibleParticipants）
    saveWinnersToRecords()

    // 使用 setTimeout 确保 eligibleParticipants 已更新后再初始化弹幕
    setTimeout(() => {
      if (settings.value?.barrageEnabled) {
        initDanmaku()
      }
    }, 50)

    // 启动烟花效果
    if (settings.value?.soundEnabled && settings.value?.bgmEnabled) {
      startFireworks()
    }
  }, 1000)
}

function saveWinnersToRecords() {
  winners.value.forEach(winner => {
    // 更新人员状态
    updateParticipantStatus(winner.id, 'won')

    // 添加中奖记录
    addWinnerRecord(winner, currentPrize.value)
  })

  // 更新本地记录
  winnerRecords.value = loadWinnerRecords()
  // 更新待抽奖人员列表
  updateEligibleParticipants()
}

function resetScene() {
  if (drawTimer) {
    clearTimeout(drawTimer)
    drawTimer = null
  }

  stopFireworks()
  fireworks = []

  winners.value = []
  particles = []
  speedLines = []
  // 清空大奖中奖者人名列表
  grandPrizeWinnerNames = []
  // 重置自动停止标记
  isAutoStopped.value = false

  drawStatus.value = 'idle'
}

// ========== 音频播放 ==========
let audioElements = { start: null, end: null, bgm: null }

function playSound(type) {
  try {
    if (audioElements[type]) {
      audioElements[type].pause()
      audioElements[type].currentTime = 0
    }

    audioElements[type] = new Audio(`/audio/${type}.mp3`)
    audioElements[type].volume = 0.8
    audioElements[type].play()
  } catch (error) {
    console.error(`播放${type}音频失败:`, error)
  }
}

function stopAllSounds() {
  Object.keys(audioElements).forEach(key => {
    if (audioElements[key]) {
      audioElements[key].pause()
      audioElements[key].currentTime = 0
    }
  })
}

// ========== 布局和样式计算 ==========
const winnersLayoutType = computed(() => {
  const total = totalPrizeCount.value
  // 奖项总人数 <= 10 人用大卡片模式，其他用网格模式
  if (total <= 10) return 'showcase'
  return 'grid'
})

const prizeLevelStyle = computed(() => {
  const prizeName = currentPrize.value.name
  if (prizeName === '特等奖') {
    return { icon: '👑', gradient: 'linear-gradient(135deg, #FFD700, #FFA500, #FF6B6B)', glow: '#FFD700' }
  }
  if (prizeName === '一等奖') {
    return { icon: '🏆', gradient: 'linear-gradient(135deg, #C0C0C0, #FFD700, #FFA500)', glow: '#FFD700' }
  }
  if (prizeName === '二等奖') {
    return { icon: '🥈', gradient: 'linear-gradient(135deg, #CD7F32, #B8860B, #DAA520)', glow: '#CD7F32' }
  }
  return { icon: '🎁', gradient: 'linear-gradient(135deg, #FF6B6B, #FF8E53)', glow: '#FF6B6B' }
})

// 中奖人信息显示
const showAvatar = computed(() => settings.value?.showWinnerAvatar)
const showDept = computed(() => settings.value?.showWinnerDept)

// ========== 返回后台 ==========
function goBack() {
  emit('back')
}

// ========== 生命周期 ==========
onMounted(() => {
  document.documentElement.classList.add('dark')

  // 加载系统数据
  loadSystemData()

  // 监听 localStorage 变化（跨标签页同步）
  window.addEventListener('storage', handleStorageChange)

  // 监听键盘事件（空格键控制抽奖）
  window.addEventListener('keydown', handleKeydown)

  // 延迟初始化 Canvas
  setTimeout(() => {
    initCanvas()
  }, 100)
})

onUnmounted(() => {
  document.documentElement.classList.remove('dark')

  // 移除 storage 事件监听
  window.removeEventListener('storage', handleStorageChange)

  // 移除键盘事件监听
  window.removeEventListener('keydown', handleKeydown)

  stopAllSounds()
  stopFireworks()
  fireworks = []

  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  if (fireworkAnimationId) {
    cancelAnimationFrame(fireworkAnimationId)
  }

  if (drawTimer) {
    clearTimeout(drawTimer)
  }

  window.removeEventListener('resize', resizeCanvas)
  window.removeEventListener('resize', resizeFireworkCanvas)
})
</script>

<template>
  <div class="sphere-screen">
    <!-- 配置提示弹窗 -->
    <Transition name="modal">
      <div v-if="showConfigAlert" class="config-alert-overlay">
        <div class="config-alert-modal">
          <div class="alert-icon">⚠️</div>
          <h3>系统未配置</h3>
          <p>{{ configAlertMessage }}</p>
          <div class="alert-actions">
            <button class="alert-btn primary" @click="goBack">去配置</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 动态背景层 -->
    <div class="dynamic-bg">
      <div class="radial-gradient"></div>
    </div>

    <!-- Canvas 粒子层 -->
    <canvas id="particle-canvas" class="particle-canvas"></canvas>

    <!-- 顶部控制栏 -->
    <header class="screen-header">
      <div class="prize-info">
        <div class="prize-title">{{ currentPrize.name }}</div>
        <div class="prize-subtitle">{{ currentPrize.subtitle }}</div>
        <div class="prize-count">抽取 {{ currentPrize.count }} 人</div>
      </div>

      <div class="draw-counter">
        <span class="counter-label">已中奖:</span>
        <span class="counter-value">{{ drawnCount }}/{{ totalCount }}</span>
      </div>

      <div class="participant-info">
        <span class="participant-label">待抽奖:</span>
        <span class="participant-value">{{ eligibleParticipants.length }} 人</span>
      </div>
    </header>

    <!-- 主要内容区域 -->
    <main class="screen-main">
      <!-- 待抽奖状态 -->
      <transition name="fade">
        <div v-if="drawStatus === 'idle' || drawStatus === 'ready'" class="gift-container">
          <div class="gift-box">
            <div class="gift-glow"></div>
            <div class="gift-icon">🎁</div>
          </div>
          <div class="draw-info">
            <div class="draw-text">一次抽取 {{ currentBatchCount }} 人</div>
            <div v-if="remainingDraws > 0" class="draw-subtext">还需 {{ remainingDraws }} 次抽完</div>
            <div class="algorithm-hint">{{ getAlgorithmInfo(settings) }}</div>
          </div>
        </div>
      </transition>

      <!-- 中奖结果 -->
      <transition name="result-fade">
        <div v-if="drawStatus === 'result'" class="result-container" :class="winnersLayoutType">
          <template v-if="winnersLayoutType === 'showcase'">
            <div class="showcase-winners">
              <div
                v-for="(winner, index) in winners"
                :key="index"
                class="showcase-card"
                :class="{ 'is-grand-prize': currentPrize.name === '特等奖' }"
                :style="{
                  background: prizeLevelStyle.gradient,
                  '--glow-color': prizeLevelStyle.glow,
                  animationDelay: `${index * 0.15}s`
                }"
              >
                <!-- 头像显示 -->
                <div v-if="showAvatar && winner.avatar" class="winner-avatar">
                  <img :src="winner.avatar" :alt="winner.name" />
                </div>
                <div v-else-if="showAvatar" class="winner-avatar-placeholder">
                  {{ winner.name.charAt(0) }}
                </div>
                <span class="winner-name-large">{{ winner.name }}</span>
                <!-- 部门显示 -->
                <span v-if="showDept && winner.department" class="winner-dept">
                  {{ winner.department }}
                </span>
                <div class="card-shine"></div>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="compact-grid">
              <div
                v-for="(winner, index) in winners"
                :key="index"
                class="compact-card"
                :style="{ animationDelay: `${index * 0.02}s` }"
              >
                <div v-if="showAvatar" class="compact-avatar">
                  {{ winner.name.charAt(0) }}
                </div>
                <span class="compact-name">{{ winner.name }}</span>
                <span v-if="showDept && winner.department" class="compact-dept">
                  {{ winner.department }}
                </span>
              </div>
            </div>
          </template>
        </div>
      </transition>
    </main>

    <!-- 烟花 Canvas -->
    <canvas id="firework-canvas" class="firework-canvas"></canvas>

    <!-- 弹幕层 -->
    <div v-if="drawStatus === 'result' && settings?.barrageEnabled" class="danmaku-container">
      <div
        v-for="item in danmakuList"
        :key="item.id"
        class="danmaku-item"
        :style="item.style"
      >
        {{ item.text }}
      </div>
    </div>

    <!-- 底部控制按钮 -->
    <footer class="screen-footer">
      <div class="control-area">
        <button
          v-if="drawStatus === 'idle' || drawStatus === 'ready'"
          class="main-btn draw-btn"
          :disabled="isDrawButtonDisabled || remainingCount <= 0 || currentBatchCount <= 0"
          @click="startDraw"
        >
          {{ remainingCount <= 0 || currentBatchCount <= 0 ? '该奖项已抽完' : '开始抽奖' }}
        </button>
        <button
          v-else-if="drawStatus === 'drawing' || drawStatus === 'stopping'"
          class="main-btn stop-btn"
          @click="stopDraw"
        >
          {{ drawStatus === 'stopping' ? '正在停止...' : '停止抽奖' }}
        </button>
        <button
          v-else-if="drawStatus === 'result'"
          class="main-btn confirm-btn"
          @click="resetScene"
        >
          {{ isAutoStopped ? '确认结果，继续下一轮' : '继续下一轮' }}
        </button>
      </div>
    </footer>

    <!-- 奖项选择器 -->
    <div class="prize-selector" :class="{ active: showPrizeSelector }">
      <button
        v-if="false"
        class="prize-selector-btn"
        @click="togglePrizeSelector"
        :disabled="drawStatus !== 'idle' && drawStatus !== 'ready'"
      >
        <span class="prize-selector-label">
          {{ currentPrize.name }}
          <span v-if="!isCurrentPrizeAvailable" class="prize-completed-badge">已抽完</span>
        </span>
        <span class="prize-selector-icon">{{ showPrizeSelector ? '▲' : '▼' }}</span>
      </button>

      <transition name="prize-options">
        <div v-if="showPrizeSelector" class="prize-options">
          <!-- 已完成的奖项（灰色禁用，分开显示） -->
          <template v-for="(prize, index) in prizes" :key="prize.id || index">
            <div
              v-if="isPrizeCompleted(prize)"
              class="prize-option completed"
              :class="{ selected: index === currentPrizeIndex }"
            >
              <div class="prize-option-name">{{ prize.name }}</div>
              <div class="prize-option-info">
                <span class="completed-text">已抽取完毕</span>
              </div>
            </div>
          </template>

          <!-- 可抽取的奖项（正常显示） -->
          <button
            v-for="(prize, index) in prizes"
            :key="prize.id || index"
            class="prize-option"
            :class="{ selected: index === currentPrizeIndex }"
            :disabled="isPrizeCompleted(prize)"
            @click="selectPrize(index)"
            v-show="!isPrizeCompleted(prize)"
          >
            <div class="prize-option-name">{{ prize.name }}</div>
            <div class="prize-option-info">
              <span>{{ prize.count - getPrizeDrawCount(prize.id) }} 人剩余</span>
            </div>
          </button>
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

    <!-- 无奖项配置提示 -->
    <div v-if="prizes.length === 0 && !showConfigAlert" class="no-prizes-hint">
      请先在后台配置奖项
    </div>

    <!-- 返回后台按钮 -->
    <button class="back-btn-corner" @click="goBack">
      返回后台
    </button>
  </div>
</template>

<style scoped>
.sphere-screen {
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #1a0000;
}

/* 配置提示弹窗 */
.config-alert-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.config-alert-modal {
  background: white;
  padding: 3rem;
  border-radius: 1.5rem;
  text-align: center;
  max-width: 400px;
}

.dark .config-alert-modal {
  background: #1f1a1a;
}

.alert-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.config-alert-modal h3 {
  font-size: 1.5rem;
  color: #181111;
  margin-bottom: 1rem;
}

.dark .config-alert-modal h3 {
  color: white;
}

.config-alert-modal p {
  color: #8a6060;
  margin-bottom: 2rem;
}

.dark .config-alert-modal p {
  color: #9ca3af;
}

.alert-btn {
  padding: 0.75rem 2rem;
  border-radius: 9999px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.alert-btn.primary {
  background: #f42525;
  color: white;
  border: none;
}

.alert-btn.primary:hover {
  background: #dc2626;
}

/* 弹窗动画 */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

/* 动态背景层 */
.dynamic-bg {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.radial-gradient {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at center,
    #FF4444 0%,
    #DC143C 30%,
    #8B0000 60%,
    #1a0000 100%
  );
  animation: pulse-gradient 3s ease-in-out infinite;
}

@keyframes pulse-gradient {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}

/* Canvas */
.particle-canvas {
  position: absolute;
  inset: 0;
  z-index: 150;
  pointer-events: none;
}

/* 头部 */
.screen-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 3rem;
  position: relative;
  z-index: 100;
}

.prize-info {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
}

.prize-title {
  font-size: 2.5rem;
  font-weight: 900;
  color: #FFD700;
  text-shadow: 0 0 20px rgba(255, 215, 0, 0.6), 3px 3px 6px rgba(0, 0, 0, 0.4);
  letter-spacing: 0.2em;
}

.prize-subtitle {
  font-size: 1.2rem;
  color: rgba(255, 215, 0, 0.8);
  margin-top: 0.25rem;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.4);
}

.prize-count {
  font-size: 1rem;
  color: rgba(255, 215, 0, 0.6);
  margin-top: 0.5rem;
}

.draw-counter,
.participant-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: rgba(0, 0, 0, 0.4);
  border: 2px solid #FFD700;
  border-radius: 50px;
  backdrop-filter: blur(10px);
}

.participant-info {
  margin-left: auto;
}

.counter-label,
.participant-label {
  color: rgba(255, 215, 0, 0.8);
  font-size: 0.95rem;
}

.counter-value,
.participant-value {
  color: #FFD700;
  font-size: 1.5rem;
  font-weight: 900;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.6);
}

/* 主内容区 */
.screen-main {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 礼盒容器 */
.gift-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3rem;
}

.gift-box {
  position: relative;
  width: 300px;
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: gift-float 3s ease-in-out infinite;
}

@keyframes gift-float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-20px) scale(1.05); }
}

.gift-glow {
  position: absolute;
  inset: -40px;
  background: radial-gradient(circle, rgba(255, 215, 0, 0.4), transparent 70%);
  border-radius: 50%;
  animation: glow-pulse 2s ease-in-out infinite;
}

@keyframes glow-pulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.3); opacity: 1; }
}

.gift-icon {
  font-size: 15rem;
  filter: drop-shadow(0 0 40px rgba(255, 215, 0, 0.8));
  animation: gift-rotate 10s linear infinite;
}

@keyframes gift-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.draw-info {
  text-align: center;
}

.draw-text {
  font-size: 1.8rem;
  color: #FFD700;
  font-weight: 700;
  text-shadow: 0 0 15px rgba(255, 215, 0, 0.6), 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.algorithm-hint {
  font-size: 0.9rem;
  color: rgba(255, 215, 0, 0.6);
  margin-top: 0.5rem;
}

.draw-subtext {
  font-size: 0.85rem;
  color: rgba(255, 215, 0, 0.7);
  margin-top: 0.25rem;
}

/* 结果容器 */
.result-container {
  position: absolute;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  overflow-y: auto;
  background: transparent;
  backdrop-filter: blur(10px);
}

.result-fade-enter-active,
.result-fade-leave-active {
  transition: all 0.8s ease-out;
}

.result-fade-enter-from,
.result-fade-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

/* 展示模式 */
.showcase-winners {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2rem;
  max-width: 90%;
  margin-top: 10rem;
}

.showcase-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 3rem;
  border-radius: 20px;
  border: 3px solid rgba(255, 215, 0, 0.8);
  background: transparent;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5),
              0 0 60px var(--glow-color, #FFD700);
  animation: showcase-appear 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
  overflow: hidden;
  cursor: default;
}

.showcase-card.is-grand-prize {
  min-width: 500px;
  padding: 3rem 4rem;
  transform: translateY(30px);
}

.showcase-card.is-grand-prize .winner-name-large {
  font-size: 5rem;
}

/* 头像样式 */
.winner-avatar,
.winner-avatar-placeholder {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  margin-bottom: 1rem;
  border: 3px solid rgba(255, 215, 0, 0.8);
}

.winner-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.winner-avatar-placeholder {
  background: rgba(255, 215, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  font-weight: 900;
  color: #8B0000;
}

.winner-name-large {
  font-size: 3rem;
  font-weight: 900;
  color: #8B0000;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2), 0 0 40px rgba(255, 215, 0, 0.5);
  letter-spacing: 0.1em;
}

.winner-dept {
  font-size: 1rem;
  color: rgba(139, 0, 0, 0.8);
  margin-top: 0.5rem;
}

.card-shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 50%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  animation: shine 3s ease-in-out infinite;
}

@keyframes shine {
  0% { left: -100%; }
  50%, 100% { left: 150%; }
}

@keyframes showcase-appear {
  from {
    opacity: 0;
    transform: translateY(50px) scale(0.8) rotateX(-15deg);
    filter: blur(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1) rotateX(0deg);
    filter: blur(0);
  }
}

/* 网格模式 */
.compact-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.75rem;
  max-width: 90%;
  margin-top: 15rem;
}

.compact-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.5);
  border: 2px solid rgba(255, 215, 0, 0.6);
  border-radius: 12px;
  animation: compact-appear 0.4s ease-out backwards;
}

.compact-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 215, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: 900;
  color: #8B0000;
  margin-bottom: 0.5rem;
}

.compact-name {
  color: #FFD700;
  font-weight: 700;
  font-size: 1.1rem;
}

.compact-dept {
  color: rgba(255, 215, 0, 0.6);
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

@keyframes compact-appear {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 烟花 Canvas */
.firework-canvas {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 1000;
}

/* 底部控制区 */
.screen-footer {
  padding: 2rem 3rem;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  z-index: 100;
}

.control-area {
  display: flex;
  align-items: center;
  justify-content: center;
}



.main-btn {
  padding: 1.5rem 4rem;
  font-size: 2rem;
  font-weight: 900;
  border-radius: 60px;
  cursor: pointer;
  border: none;
  transition: all 0.3s;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3), 0 0 40px rgba(255, 215, 0, 0.3);
}

.main-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.draw-btn {
  background: linear-gradient(135deg, #FFD700, #FFA500);
  color: #8B0000;
}

.draw-btn:hover:not(:disabled) {
  transform: translateY(-4px) scale(1.05);
  box-shadow: 0 15px 40px rgba(255, 215, 0, 0.5), 0 0 60px rgba(255, 215, 0, 0.5);
}

.stop-btn {
  background: linear-gradient(135deg, #FF6B6B, #FF4444);
  color: #FFFFFF;
}

.stop-btn:hover {
  transform: translateY(-4px) scale(1.05);
  box-shadow: 0 15px 40px rgba(255, 75, 75, 0.5), 0 0 60px rgba(255, 75, 75, 0.5);
}

.confirm-btn {
  background: linear-gradient(135deg, #FFD700, #FF8C00);
  color: #8B0000;
}

.confirm-btn:hover {
  transform: translateY(-4px) scale(1.05);
  box-shadow: 0 15px 40px rgba(255, 140, 0, 0.5), 0 0 60px rgba(255, 140, 0, 0.5);
}

/* 奖项选择器 */
.prize-selector {
  position: fixed;
  bottom: 2rem;
  left: 2rem;
  z-index: 200;
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}

.prize-selector-btn {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
  background: rgba(0, 0, 0, 0.6);
  border: 2px solid #FFD700;
  border-radius: 50px;
  color: #FFD700;
  font-weight: 700;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.3s;
  backdrop-filter: blur(10px);
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
}

.prize-selector-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.8);
  box-shadow: 0 0 30px rgba(255, 215, 0, 0.5);
}

.prize-selector-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.prize-options {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 0.5rem;
  background: rgba(0, 0, 0, 0.9);
  border: 2px solid #FFD700;
  border-radius: 12px;
  overflow: hidden;
  backdrop-filter: blur(10px);
  box-shadow: 0 0 30px rgba(255, 215, 0, 0.4);
  min-width: 180px;
}

.prize-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255, 215, 0, 0.2);
  color: #FFD700;
  cursor: pointer;
  transition: all 0.3s;
  width: 100%;
  text-align: left;
}

.prize-option:last-child {
  border-bottom: none;
}

.prize-option:hover {
  background: rgba(255, 215, 0, 0.2);
}

.prize-option.selected {
  background: rgba(255, 215, 0, 0.3);
}

.prize-option-name {
  font-weight: 700;
  font-size: 1rem;
}

.prize-option-info {
  font-size: 0.8rem;
  color: rgba(255, 215, 0, 0.7);
  margin-top: 0.25rem;
}

.prize-completed-badge {
  font-size: 0.7rem;
  background: rgba(128, 128, 128, 0.4);
  padding: 0.2rem 0.5rem;
  border-radius: 0.5rem;
  margin-left: 0.5rem;
  color: #aaa;
}

.prize-option.completed {
  opacity: 0.5;
  cursor: not-allowed;
  background: rgba(128, 128, 128, 0.1);
}

.prize-option.completed:hover {
  background: rgba(128, 128, 128, 0.15);
}

.prize-option.completed .completed-text {
  color: #888;
  font-size: 0.8rem;
}

/* 下一奖项按钮 */
.next-prize-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
  background: rgba(0, 0, 0, 0.6);
  border: 2px solid rgba(255, 215, 0, 0.5);
  border-radius: 50px;
  color: #FFD700;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.3s;
  backdrop-filter: blur(10px);
}

.next-prize-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  border-color: #FFD700;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.4);
}

.next-prize-btn .material-symbols-outlined {
  font-size: 1.1rem;
}

.prize-options-enter-active,
.prize-options-leave-active {
  transition: all 0.3s ease;
}

.prize-options-enter-from,
.prize-options-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* 无奖项提示 */
.no-prizes-hint {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.75rem 2rem;
  background: rgba(0, 0, 0, 0.6);
  border: 2px solid rgba(255, 215, 0, 0.5);
  border-radius: 50px;
  color: rgba(255, 215, 0, 0.8);
  font-size: 0.9rem;
  z-index: 200;
}

/* 返回按钮 */
.back-btn-corner {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50px;
  color: #FFD700;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  backdrop-filter: blur(10px);
  z-index: 200;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
}

.back-btn-corner:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateX(-4px);
  box-shadow: 0 0 30px rgba(255, 215, 0, 0.5);
}

/* 弹幕 */
.danmaku-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 25%;
  z-index: 300;
  pointer-events: none;
  overflow: hidden;
  mask-image: linear-gradient(to bottom, black 80%, transparent 100%);
}

.danmaku-item {
  position: absolute;
  white-space: nowrap;
  font-weight: 900;
  text-shadow: 0 0 5px rgba(0, 0, 0, 0.8), 0 0 10px rgba(0, 0, 0, 0.5);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  animation: moveRightLeft linear forwards;
  will-change: transform;
}

@keyframes moveRightLeft {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-150vw);
  }
}

@media (max-width: 768px) {
  .screen-header {
    flex-wrap: wrap;
    padding: 1rem;
    gap: 0.5rem;
  }

  .prize-info {
    position: relative;
    left: 0;
    transform: none;
    width: 100%;
  }

  .prize-title {
    font-size: 1.5rem;
  }

  .draw-counter,
  .participant-info {
    padding: 0.5rem 1rem;
    font-size: 0.8rem;
  }

  .main-btn {
    padding: 1rem 2.5rem;
    font-size: 1.5rem;
  }

  .showcase-card {
    padding: 1.5rem 2rem;
  }

  .showcase-card.is-grand-prize {
    min-width: 300px;
    padding: 2rem;
  }
}
</style>
