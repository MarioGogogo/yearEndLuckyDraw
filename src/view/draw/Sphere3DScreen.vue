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
  isPrizeCompleted,
  saveParticipants
} from '../../utils/lotteryStorage'
import { draw, validateDrawResult, getAlgorithmInfo } from '../../utils/lotteryAlgorithm'

const emit = defineEmits(['back'])

// ========== 状态定义 ==========
const drawStatus = ref('idle') // idle, ready, drawing, stopping, result
const showConfigAlert = ref(false)
const configAlertMessage = ref('')
const showPrizeImage = ref(true) // 控制奖品图片显示/隐藏

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

// 上一轮中奖结果（临时存储，防止误操作丢失）
const lastPrizeWinners = ref([])
const lastPrizeName = ref('')
const showLastWinnersModal = ref(false)

function openLastWinnersModal() {
  showLastWinnersModal.value = true
}

function closeLastWinnersModal() {
  showLastWinnersModal.value = false
}

// 放弃奖项确认弹窗
const showAbandonConfirmModal = ref(false)
const abandonWinner = ref(null)

function openAbandonConfirmModal(winner) {
  abandonWinner.value = winner
  showAbandonConfirmModal.value = true
}

function closeAbandonConfirmModal() {
  showAbandonConfirmModal.value = false
  abandonWinner.value = null
}

// 确认放弃奖项
function confirmAbandonWinner() {
  if (!abandonWinner.value) return

  const winner = abandonWinner.value

  // 从 winners 中移除该中奖者
  const index = winners.value.findIndex(w =>
    (w.id && w.id === winner.id) || (w.name === winner.name && w.department === winner.department)
  )
  if (index !== -1) {
    winners.value.splice(index, 1)
  }

  // 从缓存的中奖记录中移除该记录
  const records = loadWinnerRecords()
  const recordIndex = records.findIndex(r =>
    (r.winnerId === winner.id) ||
    (r.winnerName === winner.name && r.winnerDept === winner.department)
  )
  if (recordIndex !== -1) {
    records.splice(recordIndex, 1)
    saveWinnerRecords(records)
    winnerRecords.value = records
  }

  // 重置该人员的中奖状态为 pending
  const participants = loadParticipants()
  const participantIndex = participants.findIndex(p =>
    p.id === winner.id ||
    (p.name === winner.name && p.department === winner.department)
  )
  if (participantIndex !== -1) {
    participants[participantIndex].status = 'pending'
    participants[participantIndex].winTime = null
    saveParticipants(participants)
    updateEligibleParticipants()
  }

  // 关闭弹窗
  closeAbandonConfirmModal()

  // 如果没有中奖者了，自动重置状态
  if (winners.value.length === 0) {
    drawStatus.value = 'idle'
  }
}

// 奖项历史栈(用于"上奖项"功能)
const prizeHistory = ref([])

// 初始奖项索引(用于判断是否在初始奖项)
const initialPrizeIndex = ref(null)

// 切换到上一奖项
function goToPrevPrize() {
  if (prizeHistory.value.length > 0) {
    currentPrizeIndex.value = prizeHistory.value.pop()
    resetScene()
  }
}

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

// 庆祝词语（用于生成"名字+词语"格式的弹幕）- 包含马年、2026、西软真棒等元素
const celebrationWords = [
  // 马年主题
  '马到成功🐎！', '马年大吉🐎！', '马上有钱🐎！', '马上有福🐎！', '万马奔腾🐎！',
  '马不停蹄🐎！', '一马当先🐎！', '龙马精神🐎！', '马到功成🐎！', '马年行大运🐎！',
  // 2026主题
  '2026好运来🎉！', '2026发大财💰！', '2026万事如意✨！', '2026福气满满🧧！', '2026大吉大利🍀！',
  '2026财源滚滚💎！', '2026心想事成⭐！', '2026好运连连🌟！', '2026万事顺遂🙏！', '2026鸿运当头🔥！',
  // 西软主题
  '西软真棒👏！', '西软最强💪！', '西软666👍！', '西软威武🚀！', '西软赛高🏆！',
  '西软加油💯！', '西软给力🎯！', '西软无敌🔥！', '西软独秀🏅！', '西软独秀🌟！',
  // 传统祝福
  '发红包🧧🧧🧧！', '发红包🧧🧧！', '发红包🧧！',
  '恭喜发财！', '发大财！', '好运来！', '万事如意！', '心想事成！',
  '财源广进！', '大吉大利！', '福星高照！', '步步高升！', '红红火火！',
  '新年快乐！', '恭喜恭喜！', '鸿运当头！', '吉星高照！', '五福临门！',
  '喜气洋洋！', '吉祥如意！', '年年有余！', '花好月圆！', '金玉满堂！',
  '万事亨通！', '吉庆有余！', '福寿双全！', '三阳开泰！', '六六大顺！',
  // 特殊庆祝
  '恭喜恭喜🎊！', '红红火火🎆！', '欢天喜地🎇！', '太厉害了🏅！', '大吉大利🍾！',
  '好运来🎵！', '财源滚滚💰！', '福气满满🧧！', '喜气洋洋🎉！', '运气太好了✨！',
  '让人羡慕😍！', '太强了吧💪！', '这就是欧皇👑！', '恭喜恭喜恭喜🎊！', '欧皇附体⚡！'
]

// ========== 缓存加载 ==========
function loadSystemData() {
  // 加载设置
  const savedSettings = loadSettings()
  settings.value = savedSettings || {
    soundEnabled: true,              // 音效总开关
    allowRepeatWins: false,
    showWinnerAvatar: false,         // 默认关闭头像显示
    showWinnerDept: false,           // 默认关闭部门显示
    barrageEnabled: true,
    bgmEnabled: true,
    sfxEnabled: true,
    animationSpeed: 'normal',
    enableSpecialBackground: true    // 默认启用特殊背景
  }

  // 加载参与人员
  allParticipants.value = loadParticipants()

  // 加载奖项配置
  prizes.value = loadPrizes()
  // 默认选中最后一个奖项(从大奖到小奖倒序抽奖)
  currentPrizeIndex.value = Math.max(0, prizes.value.length - 1)
  // 记录初始奖项索引
  initialPrizeIndex.value = currentPrizeIndex.value

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
  // 保存当前奖项索引到历史栈
  prizeHistory.value.push(currentPrizeIndex.value)
  currentPrizeIndex.value = index
  showPrizeSelector.value = false
  resetScene()
}

// 下一奖项按钮是否可用
const canGoToNextPrize = computed(() => currentPrizeIndex.value > 0)

// 上一奖项按钮是否可用
const canGoToPrevPrize = computed(() => {
  // 如果尚未加载数据或历史栈为空，禁用
  if (initialPrizeIndex.value === null || prizeHistory.value.length === 0) {
    return false
  }
  // 如果当前奖项就是初始进入时的奖项，且历史栈中没有比它更早的，禁用
  // (实际上有 historyLength > 0 已经足够判断是否有上一级)
  if (currentPrizeIndex.value === initialPrizeIndex.value && prizeHistory.value.length === 0) {
    return false
  }
  return true
})

// 切换到下一奖项（更高一级）
function goToNextPrize() {
  if (currentPrizeIndex.value > 0) {
    prizeHistory.value.push(currentPrizeIndex.value)
    currentPrizeIndex.value--
    resetScene()
  }
}

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
let orbitingLights = [] // 金光环绕粒子

// 烟花独立 Canvas 上下文
let fireworkCanvas, fireworkCtx
let fireworkAnimationId
let fireworks = []
let sparkParticles = []
let showFireworks = ref(false)

// 礼物盒元素引用
const giftBoxRef = ref(null)

// 粒子类（名字）- Z轴飞行效果（优化版：分批出现 + 飞出屏幕消失）
class NameParticle {
  constructor(centerX, centerY, name, isWinner = false, index = 0, total = 1, avatar = null, dept = '', batchIndex = 0) {
    this.name = name
    this.avatar = avatar
    this.dept = dept
    this.isWinner = isWinner
    this.centerX = centerX
    this.centerY = centerY
    this.index = index
    this.total = total
    this.batchIndex = batchIndex // 批次索引，用于延迟出现

    // 基础字体大小：增大基础值以获得更好的层次感
    this.baseFontSize = 18 + Math.random() * 8
    this.reset()
  }

  reset() {
    // 【分批延迟】每批延迟一定帧数后才开始飞行
    // 每批间隔约 25 帧（约0.4秒），形成波浪式涌出效果
    // 【同批次内也有微延迟】增加 0-15 帧的随机延迟，让同批次名字也有先后
    this.delayFrames = this.batchIndex * 25 + Math.random() * 15
    this.currentDelay = 0
    this.hasStarted = false

    // 使用完全随机的角度，让每个名字飞向不同方向
    const angle = Math.random() * Math.PI * 2

    // 大幅扩大飞行半径，让名字能飞得更远、更分散
    const spreadRadius = 700 + Math.random() * 800

    this.dirX = Math.cos(angle) * spreadRadius
    this.dirY = Math.sin(angle) * spreadRadius

    // 【层次感核心】初始 z 值大幅随机化
    // 范围从 0.05 到 0.4，形成明显的远近层次
    // 有些名字一开始就"更靠近"屏幕，有些"更远"
    this.startZ = 0.05 + Math.random() * 0.35
    this.z = -this.startZ  // 负值，等延迟后变正开始显示

    // 【速度层次】速度差异大：从 0.006 到 0.025，差4倍
    // 慢的名字会落在后面，快的会冲到前面
    this.zSpeed = 0.006 + Math.random() * 0.019

    // 增大maxZ使名字能飞得更远
    this.maxZ = 2.0

    this.alpha = 0
  }

  update(canvasWidth, canvasHeight) {
    // 【分批延迟】：等待延迟帧数后才开始飞行
    if (!this.hasStarted) {
      this.currentDelay++
      if (this.currentDelay < this.delayFrames) {
        this.alpha = 0
        return
      }
      this.hasStarted = true
    }

    this.z += this.zSpeed

    // z值太小时不显示
    if (this.z < 0.02) {
      this.alpha = 0
      return
    }

    const scale = this.z / this.maxZ
    const screenX = this.centerX + this.dirX * scale
    const screenY = this.centerY + this.dirY * scale

    // 保存当前屏幕位置供后续使用
    this.screenX = screenX
    this.screenY = screenY

    // 淡入效果：根据初始深度调整淡入速度
    // 初始就较大的粒子（startZ大）淡入更快
    let zAlpha = 1
    const fadeInEnd = 0.1 + this.startZ * 0.3  // 深度越大，淡入结束点越往后
    if (this.z < fadeInEnd) {
      zAlpha = this.z / fadeInEnd
    }

    this.alpha = Math.max(0, Math.min(1, zAlpha))
  }

  isDead() {
    // 判断是否完全飞出屏幕（考虑放大后的尺寸）
    const margin = 300 // 给一些余量确保完全飞出
    const isOutOfScreen = this.screenX < -margin ||
      this.screenX > canvas.width + margin ||
      this.screenY < -margin ||
      this.screenY > canvas.height + margin
    return this.z >= this.maxZ || isOutOfScreen
  }

  shouldRemove() {
    return this.isDead()
  }

  draw(ctx) {
    if (this.z <= 0.02) return

    const scale = this.z / this.maxZ
    const screenX = this.centerX + this.dirX * scale
    const screenY = this.centerY + this.dirY * scale

    // 【核心改动】增大字体放大倍率：从 2.5 提升到 6
    // 让名字从小到大的变化更明显，靠近边缘时字非常大
    const normalizedZ = this.z / this.maxZ
    // 使用指数曲线让放大效果更自然：越靠近边缘增长越快
    const sizeScale = 0.2 + Math.pow(normalizedZ, 1.3) * 6
    const fontSize = this.baseFontSize * sizeScale

    // 放宽边界检测，因为字体会变得很大
    if (screenX < -500 || screenX > canvas.width + 500 ||
      screenY < -500 || screenY > canvas.height + 500) {
      return
    }

    ctx.save()
    ctx.translate(screenX, screenY)

    // 【层次感增强】根据z值调整颜色亮度和发光强度
    // 远处：暗淡、小、发光弱
    // 近处：明亮、大、发光强
    const brightnessBoost = 0.6 + normalizedZ * 0.4 // 0.6 -> 1.0
    const glowIntensity = 5 + normalizedZ * 25 // 5 -> 30

    ctx.globalAlpha = this.alpha

    ctx.font = `900 ${fontSize}px "Microsoft YaHei", sans-serif`
    const textWidth = ctx.measureText(this.name).width
    const padding = 6 + sizeScale * 3

    // 动态渐变：根据z值调整颜色饱和度和亮度
    const gradient = ctx.createLinearGradient(-textWidth / 2 - padding, 0, textWidth / 2 + padding, 0)
    if (this.isWinner) {
      gradient.addColorStop(0, `rgba(255, ${Math.floor(215 * brightnessBoost)}, 0, 0.95)`)
      gradient.addColorStop(1, `rgba(255, ${Math.floor(165 * brightnessBoost)}, 0, 0.95)`)
    } else {
      // 普通名字：根据深度调整亮度
      const alphaBase = 0.7 + normalizedZ * 0.25
      gradient.addColorStop(0, `rgba(255, ${Math.floor(215 * brightnessBoost)}, 0, ${alphaBase})`)
      gradient.addColorStop(1, `rgba(255, ${Math.floor(140 * brightnessBoost)}, 0, ${alphaBase})`)
    }

    ctx.fillStyle = gradient
    ctx.shadowColor = `rgba(255, 215, 0, ${0.4 + normalizedZ * 0.4})`
    ctx.shadowBlur = glowIntensity

    const rectHeight = fontSize + padding
    this.roundRect(ctx, -textWidth / 2 - padding, -fontSize / 2 - padding / 2, textWidth + padding * 2, rectHeight, 6 + sizeScale * 1.5)
    ctx.fill()

    ctx.shadowBlur = 0
    // 文字颜色也根据深度调整：远处偏暗红，近处鲜红
    const redIntensity = Math.floor(100 + normalizedZ * 39) // 100 -> 139
    ctx.fillStyle = `rgb(${redIntensity}, 0, 0)`
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

// 金光环绕粒子（模拟围绕礼物的流光）
class OrbitingLight {
  constructor(radius, speed, size, hue = 45) {
    this.radius = radius // 基础半径
    this.baseRadius = radius
    this.angle = Math.random() * Math.PI * 2
    this.speed = speed
    this.size = size
    this.hue = hue
    this.trail = []
    this.trailLength = 25 // 拖尾长度
    // 增加一点垂直方向的偏移，模拟 3D 环绕（Y轴压缩）
    this.yScale = 1.0 // 正圆，配合 css 动效
    // 呼吸效果
    this.pulseOffset = Math.random() * Math.PI
  }

  update(centerX, centerY) {
    this.angle += this.speed

    // 半径微调，形成呼吸感
    const pulse = Math.sin(Date.now() * 0.002 + this.pulseOffset) * 10
    const currentRadius = this.baseRadius + pulse

    const x = centerX + Math.cos(this.angle) * currentRadius
    const y = centerY + Math.sin(this.angle) * currentRadius * this.yScale

    // 记录拖尾
    this.trail.push({ x, y, alpha: 1.0 })
    if (this.trail.length > this.trailLength) {
      this.trail.shift()
    }

    // 衰减拖尾
    this.trail.forEach(p => p.alpha *= 0.92)
  }

  draw(ctx) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter' // 叠加模式，增强发光

    // 绘制拖尾
    this.trail.forEach((p, i) => {
      const ratio = i / this.trail.length
      const size = this.size * (0.2 + ratio * 0.8) // 尾部变小
      const alpha = p.alpha * ratio // 尾部变淡

      ctx.beginPath()
      const lightness = 50 + ratio * 40 // 头部更亮 (50 -> 90)
      ctx.fillStyle = `hsla(${this.hue}, 100%, ${lightness}%, ${alpha})`

      // 只给头部和近头部加光晕，提升性能
      if (i > this.trailLength - 5) {
        ctx.shadowBlur = 15 * ratio
        ctx.shadowColor = `hsla(${this.hue}, 100%, 50%, 1)`
      }

      ctx.arc(p.x, p.y, size, 0, Math.PI * 2)
      ctx.fill()
    })

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
  createOrbitingLights()
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

function createOrbitingLights() {
  orbitingLights = []
  // 创建几层不同的环绕光
  // 礼物盒大概 300x300，所以半径在 200 左右

  // 内圈快速流光
  orbitingLights.push(new OrbitingLight(170, 0.05, 3, 45))
  orbitingLights.push(new OrbitingLight(170, 0.05, 3, 45)) // 对称
  orbitingLights[1].angle += Math.PI // 错开 180 度

  // 中圈反向
  orbitingLights.push(new OrbitingLight(190, -0.03, 2.5, 50))
  orbitingLights.push(new OrbitingLight(190, -0.03, 2.5, 50))
  orbitingLights[3].angle += Math.PI

  // 外圈慢速大光点
  orbitingLights.push(new OrbitingLight(220, 0.02, 4, 40))
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

    // 画金光环绕（只在待机和准备状态显示，因为开始抽奖后礼物盒会消失）
    if (drawStatus.value === 'idle' || drawStatus.value === 'ready') {
      let centerX = canvas.width / 2
      let centerY = canvas.height / 2

      // 如果能获取到礼物盒的位置，则以礼物盒为中心
      if (giftBoxRef.value) {
        const rect = giftBoxRef.value.getBoundingClientRect()
        centerX = rect.left + rect.width / 2
        centerY = rect.top + rect.height / 2
      }

      // 绘制一个底层的光环（增加辉光感）
      ctx.save()
      ctx.beginPath()
      ctx.arc(centerX, centerY, 180, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.1)'
      ctx.lineWidth = 2
      ctx.shadowBlur = 20
      ctx.shadowColor = '#FFD700'
      ctx.stroke()
      ctx.restore()

      orbitingLights.forEach(light => {
        light.update(centerX, centerY)
        light.draw(ctx)
      })
    }
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

  console.log('[弹幕] 中奖人数:', grandPrizeWinnerNames.length)

  // 所有奖项都采用大奖弹幕模式，生成80条弹幕
  const count = 80

  for (let i = 0; i < count; i++) {
    let text

    // 所有弹幕都使用"人名+喜庆词语"格式
    if (grandPrizeWinnerNames.length > 0) {
      const randomName = grandPrizeWinnerNames[Math.floor(Math.random() * grandPrizeWinnerNames.length)]
      const randomWord = celebrationWords[Math.floor(Math.random() * celebrationWords.length)]
      text = `${randomName}${randomWord}`
    } else {
      // 如果没有中奖者，使用纯祝福语
      text = celebrationWords[Math.floor(Math.random() * celebrationWords.length)]
    }

    // 优化弹幕分布：分层垂直位置，避免重叠
    // 将80条弹幕分成10层，每层8条
    const layer = i % 10
    const layerOffset = (Math.random() - 0.5) * 4 // 每层内微调 ±2%
    const top = 5 + layer * 9 + layerOffset // 从5%开始，每层间隔9%

    // 优化延迟时间：延迟0-60秒，分散出现
    const batch = Math.floor(i / 8) // 分10批
    const delay = batch * 3 + Math.random() * 6 // 每批间隔约3秒，批内随机0-6秒

    const duration = 18 + Math.random() * 12 // 18-30秒

    // 弹幕字体大小
    const fontSize = 1.0 + Math.random() * 0.8 + 'rem'

    // 弹幕颜色：金色50%、红色30%、白色20%
    const rand = Math.random()
    let color
    if (rand < 0.5) {
      color = '#FFD700' // 金色
    } else if (rand < 0.8) {
      color = '#FF6B6B' // 红色
    } else {
      color = '#FFFFFF' // 白色
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

  const centerX = canvas.width / 2
  const centerY = canvas.height / 2

  // 预先使用算法抽取中奖者
  // 使用 currentBatchCount（考虑剩余人数）
  const winnerCount = currentBatchCount.value

  const selectedWinners = draw(eligibleParticipants.value, winnerCount, settings.value)
  winners.value = selectedWinners

  // 【分批出现】将参与者分成多个批次，每批延迟出现
  // 打乱顺序后分批，这样每批都是随机的人
  const shuffledParticipants = [...eligibleParticipants.value].sort(() => Math.random() - 0.5)
  const batchSize = Math.ceil(shuffledParticipants.length / 8) // 分成约8批

  shuffledParticipants.forEach((person, index) => {
    const isWinner = selectedWinners.some(w => w.id === person.id)
    const batchIndex = Math.floor(index / batchSize) // 计算所属批次
    const particle = new NameParticle(
      centerX, centerY,
      person.name,
      isWinner,
      index,
      shuffledParticipants.length,
      person.avatar,
      person.department,
      batchIndex // 传入批次索引
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

  // 在清空中奖结果前，保存为上一轮名单
  if (winners.value.length > 0) {
    lastPrizeWinners.value = [...winners.value]
    lastPrizeName.value = currentPrize.value.name
  }

  stopFireworks()
  fireworks = []

  winners.value = []
  particles = []
  speedLines = []
  // 清空大奖中奖者人名列表
  grandPrizeWinnerNames = []

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
  const count = totalPrizeCount.value

  // 只有1人中奖（特等奖/大奖级别）
  if (count === 1) {
    return { icon: '👑', gradient: 'linear-gradient(135deg, #FFD700, #FFA500, #FF6B6B)', glow: '#FFD700' }
  }
  // 2-5人中奖（一等奖/二等奖级别）
  if (count > 1 && count <= 5) {
    return { icon: '🏆', gradient: 'linear-gradient(135deg, #C0C0C0, #FFD700, #FFA500)', glow: '#FFD700' }
  }
  // 其他情况（普通奖项）
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
    <div v-if="settings?.enableSpecialBackground !== false" class="dynamic-bg">
      <div class="radial-gradient"></div>
    </div>

    <!-- 马年水印背景 -->
    <div v-if="settings?.enableSpecialBackground !== false" class="horse-watermark"></div>

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
          <div class="gift-box" ref="giftBoxRef">
            <div class="gift-glow"></div>
            <div class="gift-icon">
              <img src="/images/liwu.png" alt="Gift" />
            </div>
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
              <div v-for="(winner, index) in winners" :key="index" class="showcase-card"
                :class="{ 'is-grand-prize': totalPrizeCount === 1 }" :style="{
                  background: prizeLevelStyle.gradient,
                  '--glow-color': prizeLevelStyle.glow,
                  animationDelay: `${index * 0.15}s`
                }" @click="openAbandonConfirmModal(winner)" title="点击放弃奖项">
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
              <div v-for="(winner, index) in winners" :key="index" class="compact-card"
                :style="{ animationDelay: `${index * 0.02}s` }" @click="openAbandonConfirmModal(winner)" title="点击放弃奖项">
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
    <div v-if="drawStatus === 'result' && settings?.barrageEnabled" class="danmaku-container"
      :class="{ 'full-screen': settings?.fullScreenBarrageEnabled !== false }">
      <div v-for="item in danmakuList" :key="item.id" class="danmaku-item" :style="item.style">
        {{ item.text }}
      </div>
    </div>

    <!-- 底部控制按钮 -->
    <footer class="screen-footer">
      <div class="control-area">
        <button v-if="drawStatus === 'idle' || drawStatus === 'ready'" class="main-btn draw-btn"
          :disabled="isDrawButtonDisabled || remainingCount <= 0 || currentBatchCount <= 0" @click="startDraw">
          {{ remainingCount <= 0 || currentBatchCount <= 0 ? '该奖项已抽完' : '开始抽奖' }} </button>
            <button v-else-if="drawStatus === 'drawing' || drawStatus === 'stopping'" class="main-btn stop-btn"
              @click="stopDraw">
              {{ drawStatus === 'stopping' ? '正在停止...' : '停止抽奖' }}
            </button>
            <button v-else-if="drawStatus === 'result'" class="main-btn confirm-btn" @click="resetScene">
              继续下一轮
            </button>
      </div>
    </footer>

    <!-- 奖项选择器 -->
    <div class="prize-selector" :class="{ active: showPrizeSelector }">
      <button v-if="false" class="prize-selector-btn" @click="togglePrizeSelector"
        :disabled="drawStatus !== 'idle' && drawStatus !== 'ready'">
        <span class="prize-selector-label">
          {{ currentPrize.name }}
          <span v-if="!isCurrentPrizeAvailable" class="prize-completed-badge">已抽完</span>
        </span>
        <span class="prize-selector-icon">{{ showPrizeSelector ? '▲' : '▼' }}</span>
      </button>

      <!-- 奖品图片展示区 -->
      <div v-if="currentPrize.image" class="prize-image-wrapper">
        <div v-if="showPrizeImage" class="prize-image-card">
          <img :src="currentPrize.image" :alt="currentPrize.name" class="prize-image">
        </div>
        <!-- 奖品图片显示/隐藏按钮 -->
        <button class="toggle-image-btn" @click="showPrizeImage = !showPrizeImage" :title="showPrizeImage ? '隐藏奖品图片' : '显示奖品图片'">
          <span class="material-symbols-outlined">{{ showPrizeImage ? 'visibility_off' : 'visibility' }}</span>
        </button>
      </div>

      <transition name="prize-options">
        <div v-if="showPrizeSelector" class="prize-options">
          <!-- 已完成的奖项（灰色禁用，分开显示） -->
          <template v-for="(prize, index) in prizes" :key="prize.id || index">
            <div v-if="isPrizeCompleted(prize)" class="prize-option completed"
              :class="{ selected: index === currentPrizeIndex }">
              <div class="prize-option-name">{{ prize.name }}</div>
              <div class="prize-option-info">
                <span class="completed-text">已抽取完毕</span>
              </div>
            </div>
          </template>

          <!-- 可抽取的奖项（正常显示） -->
          <button v-for="(prize, index) in prizes" :key="prize.id || index" class="prize-option"
            :class="{ selected: index === currentPrizeIndex }" :disabled="isPrizeCompleted(prize)"
            @click="selectPrize(index)" v-show="!isPrizeCompleted(prize)">
            <div class="prize-option-name">{{ prize.name }}</div>
            <div class="prize-option-info">
              <span>{{ prize.count - getPrizeDrawCount(prize.id) }} 人剩余</span>
            </div>
          </button>
        </div>
      </transition>

      <!-- 导航按钮组 -->
      <div class="prize-nav-buttons">

        <!-- 上奖项按钮 -->
        <button class="prev-prize-btn" :class="{ 'disabled': !canGoToPrevPrize }" :disabled="!canGoToPrevPrize"
          @click="goToPrevPrize" title="切换回上一奖项">
          <span class="material-symbols-outlined">arrow_downward</span>
          上奖项
        </button>
        <!-- 下一奖项按钮 -->
        <button class="next-prize-btn" :class="{ 'disabled': !canGoToNextPrize }" :disabled="!canGoToNextPrize"
          @click="goToNextPrize" title="切换到高一级奖项">
          <span class="material-symbols-outlined">arrow_upward</span>
          下一奖项
        </button>
        <!-- 上一奖项名单按钮 -->
        <button v-if="lastPrizeWinners.length > 0" class="last-winners-btn" @click="openLastWinnersModal"
          title="查看上一奖项名单">
          <span class="material-symbols-outlined">history</span>
          上轮中奖名单
        </button>
      </div>
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

  <!-- 上一奖项名单弹窗 -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showLastWinnersModal" class="modal-overlay" @click.self="closeLastWinnersModal">
        <div class="modal-container last-winners-modal">
          <div class="modal-header">
            <h3 class="modal-title">上一奖项 - {{ lastPrizeName }}</h3>
            <button class="modal-close" @click="closeLastWinnersModal">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="modal-body">
            <div class="winners-grid">
              <div v-for="winner in lastPrizeWinners" :key="winner.id" class="winner-card">
                <div v-if="showAvatar" class="winner-avatar">{{ winner.name.charAt(0) }}</div>
                <span class="winner-name">{{ winner.name }}</span>
                <span v-if="showDept && winner.department" class="winner-dept">{{ winner.department }}</span>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="modal-btn modal-btn-confirm" @click="closeLastWinnersModal">
              确定
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- 放弃奖项确认弹窗 -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showAbandonConfirmModal" class="modal-overlay" @click.self="closeAbandonConfirmModal">
        <div class="modal-container abandon-modal">
          <div class="modal-header">
            <h3 class="modal-title">放弃奖项确认</h3>
            <button class="modal-close" @click="closeAbandonConfirmModal">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="modal-body abandon-modal-body">
            <div class="abandon-icon">⚠️</div>
            <p class="abandon-message">确定要放弃奖项吗？</p>
            <div class="abandon-winner-info">
              <span class="winner-name">{{ abandonWinner?.name }}</span>
              <span v-if="abandonWinner?.department" class="winner-dept">{{ abandonWinner.department }}</span>
            </div>
            <p class="abandon-hint">放弃后将从中奖名单中移除，并重新进入抽奖池</p>
          </div>
          <div class="modal-footer">
            <button class="modal-btn modal-btn-cancel" @click="closeAbandonConfirmModal">
              取消
            </button>
            <button class="modal-btn modal-btn-danger" @click="confirmAbandonWinner">
              确认放弃
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
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

/* 普通背景（禁用特殊背景时） */
.sphere-screen:not(:has(.dynamic-bg)) {
  background: radial-gradient(circle at center,
      #FF4444 0%,
      #DC143C 30%,
      #8B0000 60%,
      #580507 100%);
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
  background: radial-gradient(circle at center,
      #FF4444 0%,
      #DC143C 30%,
      #8B0000 60%,
      #1a0000 100%);
  animation: pulse-gradient 3s ease-in-out infinite;
}

/* 马年水印背景 */
.horse-watermark {
  position: absolute;
  inset: 0;
  z-index: 2;
  background-image: url('/images/horse-year.png');
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  opacity: 0.22;
  pointer-events: none;
}

@keyframes pulse-gradient {

  0%,
  100% {
    opacity: 0.8;
  }

  50% {
    opacity: 1;
  }
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
  width: 450px;
  height: 450px;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: gift-float 3s ease-in-out infinite;
}

@keyframes gift-float {

  0%,
  100% {
    transform: translateY(0) scale(1);
  }

  50% {
    transform: translateY(-20px) scale(1.05);
  }
}

.gift-glow {
  position: absolute;
  inset: -60px;
  background: radial-gradient(circle, rgba(255, 215, 0, 0.4), transparent 70%);
  border-radius: 50%;
  animation: glow-pulse 2s ease-in-out infinite;
}

@keyframes glow-pulse {

  0%,
  100% {
    transform: scale(1);
    opacity: 0.6;
  }

  50% {
    transform: scale(1.3);
    opacity: 1;
  }
}

.gift-icon {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 0 40px rgba(255, 215, 0, 0.6));
}

.gift-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

@keyframes gift-rotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.draw-info {
  text-align: center;
}

.draw-text {
  font-size: 2.5rem;
  color: #FFD700;
  font-weight: 700;
  text-shadow: 0 0 15px rgba(255, 215, 0, 0.6), 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.algorithm-hint {
  font-size: 1.1rem;
  color: rgba(255, 215, 0, 0.6);
  margin-top: 0.75rem;
}

.draw-subtext {
  font-size: 1.2rem;
  color: rgba(255, 215, 0, 0.7);
  margin-top: 0.5rem;
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
  cursor: pointer;
  transition: all 0.3s ease;
}

.showcase-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6),
    0 0 80px var(--glow-color, #FFD700);
}

.showcase-card:hover .winner-name-large {
  text-shadow: 0 0 30px rgba(255, 215, 0, 0.8);
}

.showcase-card.is-grand-prize {
  min-width: 800px;
  padding: 5rem 6rem;
  transform: translateY(30px);
}

.showcase-card.is-grand-prize .winner-name-large {
  font-size: 7rem;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

.showcase-card.is-grand-prize .winner-avatar,
.showcase-card.is-grand-prize .winner-avatar-placeholder {
  width: 180px;
  height: 180px;
  border-width: 6px;
  margin-bottom: 1.5rem;
}

.showcase-card.is-grand-prize .winner-avatar-placeholder {
  font-size: 5rem;
}

.showcase-card.is-grand-prize .winner-dept {
  font-size: 2rem;
  margin-top: 1rem;
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
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  animation: shine 3s ease-in-out infinite;
}

@keyframes shine {
  0% {
    left: -100%;
  }

  50%,
  100% {
    left: 150%;
  }
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
  grid-template-columns: repeat(auto-fit, 165px);
  justify-content: center;
  gap: 1rem;
  width: 100%;
  max-width: 100%;
  margin: 5rem auto 0;
}

.compact-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.5);
  border: 2px solid rgba(255, 215, 0, 0.6);
  border-radius: 16px;
  animation: compact-appear 0.4s ease-out backwards;
  cursor: pointer;
  transition: all 0.3s ease;
}

.compact-card:hover {
  background: rgba(255, 215, 0, 0.2);
  border-color: #FFD700;
  transform: translateY(-4px) scale(1.05);
  box-shadow: 0 8px 25px rgba(255, 215, 0, 0.4);
}

.compact-card:hover .compact-name {
  text-shadow: 0 0 15px rgba(255, 215, 0, 0.6);
}

.compact-avatar {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: rgba(255, 215, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 900;
  color: #8B0000;
  margin-bottom: 0.8rem;
}

.compact-name {
  color: #FFD700;
  font-weight: 700;
  font-size: 1.6rem;
}

.compact-dept {
  color: rgba(255, 215, 0, 0.6);
  font-size: 1.1rem;
  margin-top: 0.4rem;
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
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}

/* 奖品图片展示区 */
.prize-image-wrapper {
  position: relative;
}

.prize-image-card {
  background: rgba(0, 0, 0, 0.6);
  border: 2px solid #FFD700;
  border-radius: 12px;
  overflow: hidden;
  backdrop-filter: blur(10px);
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
}

.prize-image {
  /* max-width: 400px; */
  max-height: 280px;
  object-fit: contain;
  display: block;
}

/* 奖品图片显示/隐藏按钮 */
.toggle-image-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  border: 2px solid rgba(255, 215, 0, 0.6);
  color: #FFD700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  z-index: 10;
}

.toggle-image-btn:hover {
  background: rgba(255, 215, 0, 0.3);
  border-color: #FFD700;
}

.toggle-image-btn .material-symbols-outlined {
  font-size: 1rem;
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

.next-prize-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.next-prize-btn:disabled:hover {
  background: rgba(0, 0, 0, 0.6);
  border-color: rgba(255, 215, 0, 0.5);
  box-shadow: none;
}

/* 上奖项按钮 */
.prev-prize-btn {
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

.prev-prize-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  border-color: #FFD700;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.4);
}

.prev-prize-btn .material-symbols-outlined {
  font-size: 1.1rem;
}

.prev-prize-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.prev-prize-btn.disabled:hover {
  background: rgba(0, 0, 0, 0.6);
  border-color: rgba(255, 215, 0, 0.5);
  box-shadow: none;
}

/* 上一奖项名单按钮 */
.last-winners-btn {
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

.last-winners-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  border-color: #FFD700;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.4);
}

.last-winners-btn .material-symbols-outlined {
  font-size: 1.1rem;
}

/* 导航按钮组 */
.prize-nav-buttons {
  display: flex;
  gap: 0.5rem;
  margin-left: 0.5rem;
  margin-right: 0.5rem;
}

/* 上一奖项名单弹窗 */
.last-winners-modal {
  max-width: 800px;
}

.winners-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
  max-height: 450px;
  overflow-y: auto;
  padding: 0.5rem;
}

.winner-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 0.5rem;
  background: rgba(255, 215, 0, 0.1);
  border: 2px solid rgba(255, 215, 0, 0.3);
  border-radius: 0.75rem;
  text-align: center;
  transition: all 0.2s;
}

.winner-card:hover {
  background: rgba(255, 215, 0, 0.2);
  border-color: rgba(255, 215, 0, 0.6);
  transform: translateY(-2px);
}

.winner-avatar {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #FFD700, #FFA500);
  color: #8B0000;
  border-radius: 50%;
  font-weight: 700;
  font-size: 1.2rem;
  margin-bottom: 0.5rem;
}

.winner-name {
  color: #FFD700;
  font-weight: 600;
  font-size: 1rem;
  line-height: 1.3;
}

.winner-dept {
  color: rgba(255, 215, 0, 0.6);
  font-size: 0.8rem;
  margin-top: 0.25rem;
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

/* 放弃奖项确认弹窗 */
.abandon-modal {
  max-width: 450px;
  background: linear-gradient(145deg, #8B0000 0%, #DC143C 30%, #8B0000 100%);
  border: 3px solid #FFD700;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.5),
    0 0 40px rgba(255, 215, 0, 0.3),
    inset 0 0 100px rgba(255, 215, 0, 0.1);
}

.abandon-modal .modal-header {
  padding: 1.5rem;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid rgba(255, 215, 0, 0.3);
  background: linear-gradient(to right, rgba(255, 215, 0, 0.1), transparent);
}

.abandon-modal .modal-title {
  font-size: 1.6rem;
  color: #FFD700;
  text-shadow: 0 2px 10px rgba(255, 215, 0, 0.5);
  margin: 0;
}

.abandon-modal .modal-close {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid rgba(255, 215, 0, 0.5);
  background: rgba(0, 0, 0, 0.3);
  color: #FFD700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
}

.abandon-modal .modal-close:hover {
  background: rgba(255, 215, 0, 0.2);
  border-color: #FFD700;
  transform: rotate(90deg);
}

.abandon-modal-body {
  padding: 2rem;
  text-align: center;
}

.abandon-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {

  0%,
  100% {
    transform: translateX(0);
  }

  25% {
    transform: translateX(-5px);
  }

  75% {
    transform: translateX(5px);
  }
}

.abandon-message {
  font-size: 1.3rem;
  color: #FFF8D6;
  margin: 0 0 1rem 0;
}

.abandon-winner-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  margin-bottom: 1rem;
}

.abandon-winner-info .winner-name {
  font-weight: 700;
  font-size: 1.8rem;
  color: #FFD700;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.abandon-winner-info .winner-dept {
  color: #FFF8D6;
  opacity: 0.8;
}

.abandon-hint {
  font-size: 0.9rem;
  color: rgba(255, 253, 208, 0.7);
  margin: 0;
}

.abandon-modal .modal-footer {
  padding: 1rem 1.5rem 1.5rem;
  display: flex;
  justify-content: center;
  gap: 1rem;
  border-top: 2px solid rgba(255, 215, 0, 0.3);
  background: linear-gradient(to right, transparent, rgba(255, 215, 0, 0.1));
}

.abandon-modal .modal-btn {
  padding: 0.75rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 50px;
  border: 2px solid #FFD700;
  cursor: pointer;
  transition: all 0.3s;
}

.abandon-modal .modal-btn-cancel {
  background: transparent;
  color: #FFD700;
}

.abandon-modal .modal-btn-cancel:hover {
  background: rgba(255, 215, 0, 0.15);
}

.abandon-modal .modal-btn-danger {
  background: linear-gradient(135deg, #FF4444, #DC143C);
  color: #FFF;
  border-color: #FF6B6B;
}

.abandon-modal .modal-btn-danger:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 5px 20px rgba(255, 75, 75, 0.5);
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
  /* 默认 25% */
  z-index: 999;
  pointer-events: none;
  overflow: hidden;
}

.danmaku-container.full-screen {
  height: 100%;
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
