<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import confetti from 'canvas-confetti'
import {
  loadParticipants,
  loadPrizes,
  loadWinnerRecords,
  loadSettings,
  getEligibleParticipants,
  addWinnerRecord,
  isPrizeCompleted,
  updateParticipantStatus,
  saveWinnerRecords,
  saveParticipants
} from '../../utils/lotteryStorage'

const emit = defineEmits(['back'])

// State
const bgCanvasRef = ref(null)
const winnerCardRef = ref(null)
const nameRollerRef = ref(null)
const winnerContainerRef = ref(null)

// 状态机
const STATE = {
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  STOPPING: 'STOPPING',
  RESULT: 'RESULT'
}

// 弹幕相关
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

// 大奖环节中奖者人名列表
let grandPrizeWinnerNames = []

const drawStatus = ref(STATE.IDLE)
const currentName = ref('准备抽奖')
const showWinnerCard = ref(false)
const winnerList = ref([])

// 参与者数据
const allParticipants = ref([])
const eligibleList = ref([])
const prizes = ref([])
const currentPrizeIndex = ref(0)
const winnerRecords = ref([])
const settings = ref({})
const showPrizeSelector = ref(false)
const showPrizeImage = ref(true) // 控制奖品图片显示/隐藏

// 上一轮中奖结果（临时存储，防止误操作丢失）
const lastPrizeWinners = ref([])
const lastPrizeName = ref('')
const showLastWinnersModal = ref(false)

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

  // 从 winnerList 中移除该中奖者
  const index = winnerList.value.findIndex(w =>
    (w.id && w.id === winner.id) || (w.name === winner.name && w.department === winner.department)
  )
  if (index !== -1) {
    winnerList.value.splice(index, 1)
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
    eligibleList.value = getEligibleParticipants()
  }

  // 关闭弹窗
  closeAbandonConfirmModal()

  // 如果没有中奖者了，自动关闭中奖卡片并重置状态
  if (winnerList.value.length === 0) {
    showWinnerCard.value = false
    drawStatus.value = STATE.IDLE
  }
}

function openLastWinnersModal() {
  showLastWinnersModal.value = true
}

function closeLastWinnersModal() {
  showLastWinnersModal.value = false
}

// 动画相关
let animationInterval = null
let bgAnimationFrame = null
let bgParticles = []
let bgClouds = []
let bgSpeed = 2
let bgTargetSpeed = 2
let bgCtx = null
let bgCanvas = null

// 动画状态
const horseAnimationDuration = ref('0.6s')

// 孔明灯相关状态
const lanterns = ref([])
const lanternImages = ['1.png', '2.png', '3.png', '4.png']
let lanternAnimationFrame = null

// 孔明灯尾巴配置
const lanternTailConfig = {
  top: '/images/top.png',
  center: '/images/center.png',
  bottom: '/images/bottom.png'
}

// 祝福语列表
const blessingMessages = [
  '马到成功', '万事如意', '大吉大利', '财源广进',
  '心想事成', '吉星高照', '步步高升', '鸿运当头',
  '好运连连', '吉祥如意', '年年有余', '花好月圆'
]

// 孔明灯类
class Lantern {
  constructor(name, x, imageIndex, screenHeight) {
    this.id = Date.now() + Math.random()
    this.name = name
    this.x = x
    this.y = screenHeight + 100 // 从屏幕下方开始
    this.targetY = -200 // 飘到屏幕上方
    this.speed = 1 + Math.random() * 1 + 0.5 // 随机速度
    this.scale = 0.6 + Math.random() * 0.3 // 随机大小
    this.opacity = 0.8 + Math.random() * 0.2 // 随机透明度
    this.imageIndex = imageIndex
    this.tailLength = 3 // 固定3节尾巴
    this.blessing = blessingMessages[Math.floor(Math.random() * blessingMessages.length)]
    this.finished = false
  }

  update() {
    // 笔直向上飘动
    this.y -= this.speed

    // 如果到达顶部，标记完成
    if (this.y < this.targetY) {
      this.finished = true
    }
  }
}

// 获取尾巴图片
const getTailImage = (index, total) => {
  if (index === total) {
    return lanternTailConfig.bottom // 最后一段用底部
  } else if (index === 1) {
    return lanternTailConfig.top // 第一段用顶部
  } else {
    return lanternTailConfig.center // 中间用中间
  }
}

// 开始孔明灯动画
const startLanternsAnimation = (names) => {
  // 清空之前的孔明灯
  lanterns.value = []

  // 为每个名字创建一个孔明灯
  const batchSize = Math.min(50, names.length)
  const shuffled = [...names].sort(() => Math.random() - 0.5).slice(0, batchSize)

  shuffled.forEach((name, index) => {
    // 根据屏幕宽度均匀分布（使用百分比）
    const marginPercent = 5 // 左右边距 5%
    const usablePercent = 90 // 可用宽度 90%
    const x = marginPercent + (usablePercent * index / batchSize) + (usablePercent / batchSize / 2)

    const imageIndex = Math.floor(Math.random() * lanternImages.length)
    const screenHeight = window.innerHeight
    const lantern = new Lantern(name, x, imageIndex, screenHeight)

    // 调整灯笼参数
    lantern.speed = 2 + Math.random() * 2 // 加快速度：2-4
    lantern.scale = 0.5 + Math.random() * 0.2 // 稍微调小

    // 上下错开起始位置（根据索引错开 0-300px）
    lantern.y = screenHeight + 100 + (index * 6)
    // 错开目标高度，避免同时到达顶部
    lantern.targetY = -200 - (index * 8)

    // 分批次延迟启动：每批 5 个，间隔 300ms
    const batchIndex = Math.floor(index / 5)
    setTimeout(() => {
      lanterns.value.push(lantern)
    }, batchIndex * 300)
  })
}

// 停止孔明灯动画
const stopLanternsAnimation = () => {
  // 延迟清除，让孔明灯继续飘一会
  setTimeout(() => {
    lanterns.value = []
  }, 2000)
}

// 孔明灯动画循环
const animateLanterns = () => {
  if (lanterns.value.length > 0) {
    lanterns.value.forEach(lantern => {
      lantern.update()
    })
    // 移除完成的孔明灯
    lanterns.value = lanterns.value.filter(l => !l.finished)
  }
  lanternAnimationFrame = requestAnimationFrame(animateLanterns)
}

// 颜色变量
const COLORS = {
  redDeep: '#8E0000',
  redBright: '#D20F15',
  gold: '#FFD700',
  goldLight: '#FFF8D6',
  cream: '#FFFDD0'
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

// Computed
const currentPrize = computed(() => prizes.value[currentPrizeIndex.value] || {})
const isCurrentPrizeAvailable = computed(() => {
  if (!currentPrize.value.id) return false
  return !isPrizeCompleted(currentPrize.value)
})

// 抽奖按钮是否禁用（参考 Sphere3DScreen.vue）
const isDrawButtonDisabled = computed(() => {
  return eligibleList.value.length === 0 || !isCurrentPrizeAvailable.value
})

// 中奖人信息显示（参考 Sphere3DScreen.vue）
const showAvatar = computed(() => settings.value?.showWinnerAvatar)
const showDept = computed(() => settings.value?.showWinnerDept)

// 单次抽取人数
const batchCount = computed(() => currentPrize.value.batchCount || currentPrize.value.count || 1)

// 奖项总人数
const totalPrizeCount = computed(() => currentPrize.value.count || 0)

// 已抽取人数
const prizeDrawnCount = computed(() => winnerRecords.value.filter(r => r.prizeId === currentPrize.value.id).length)

// 剩余可抽取人数
const remainingCount = computed(() => Math.max(0, totalPrizeCount.value - prizeDrawnCount.value))

// 当前轮次应抽取人数（考虑剩余人数，最后一批可能不足batchCount）
const currentBatchCount = computed(() => {
  const batch = batchCount.value
  const remaining = remainingCount.value
  return Math.min(batch, remaining)
})

// 预计还需抽取次数（向上取整）
const remainingDraws = computed(() => {
  if (remainingCount.value <= 0) return 0
  return Math.ceil(remainingCount.value / batchCount.value)
})

// 根据屏幕宽度和中奖人数自动计算网格列数
const winnerGridColumns = ref(8)

function getWinnerGridColumns() {
  const count = winnerList.value.length
  const screenWidth = window.innerWidth
  // 每个格子最小宽度 120px，加上 gap 20px
  const minCellWidth = 120
  const gap = 20
  const maxColumns = Math.floor((screenWidth - 80) / (minCellWidth + gap))
  // 限制列数范围 8-10
  return Math.max(8, Math.min(maxColumns, 10, count))
}

// 监听窗口大小变化，更新列数
function handleResize() {
  winnerGridColumns.value = getWinnerGridColumns()
}

// 生成参与者（如果没有存储的数据）
const generateParticipants = (count = 200) => {
  const LAST_NAMES = "赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳酆鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万支柯昝管卢莫经房裘缪干解应宗丁宣 邓郁单杭洪包诸左石崔吉钮龚".split("")
  const FIRST_NAMES = "明国华建文平志伟东海强晓生光林小民永杰军金新涛君清利信子杰波辉刚健若云飞风雨雷电春夏秋冬梅兰竹菊松柏杨柳山河湖海天地日月星辰".split("")

  const participants = []
  for (let i = 0; i < count; i++) {
    const ln = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
    const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)] +
      (Math.random() > 0.5 ? FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)] : "")
    participants.push({ id: `p_${i}`, name: ln + fn })
  }
  return participants
}

// 加载数据
const loadData = () => {
  const storedParticipants = loadParticipants()
  const storedPrizes = loadPrizes()

  if (storedParticipants && storedParticipants.length > 0) {
    allParticipants.value = storedParticipants
  } else {
    allParticipants.value = generateParticipants()
  }

  if (storedPrizes && storedPrizes.length > 0) {
    prizes.value = storedPrizes
    // 默认选中最后一个奖项（从大奖到小奖倒序抽奖）
    currentPrizeIndex.value = Math.max(0, prizes.value.length - 1)
  } else {
    // 默认奖项配置
    prizes.value = [
      { id: 'first', name: '一等奖', color: '#FFD700', count: 1 },
      { id: 'second', name: '二等奖', color: '#C0C0C0', count: 3 },
      { id: 'third', name: '三等奖', color: '#DAA520', count: 5 }
    ]
    currentPrizeIndex.value = 0
  }

  if (allParticipants.value === generateParticipants()) {
    const winnerIds = new Set(winnerRecords.value.map(w => w.participantId))
    eligibleList.value = allParticipants.value.filter(p => !winnerIds.has(p.id))
  } else {
    eligibleList.value = getEligibleParticipants()
  }

  winnerRecords.value = loadWinnerRecords()
  settings.value = loadSettings() || {
    showWinnerAvatar: false,         // 默认关闭头像显示
    showWinnerDept: false,           // 默认关闭部门显示
    barrageEnabled: true,
    fullScreenBarrageEnabled: true,
    enableSpecialBackground: true    // 默认启用特殊背景
  }
}

// 背景动画 - 粒子类
class BgParticle {
  constructor(w, h) {
    this.x = Math.random() * w
    this.y = Math.random() * h
    this.size = Math.random() * 3 + 1
    this.speedX = Math.random() * 2 + 1
    this.alpha = Math.random() * 0.5 + 0.2
    this.width = w
    this.height = h
  }

  update(speed) {
    this.x -= this.speedX * speed
    if (this.x < 0) {
      this.x = this.width + Math.random() * 100
      this.y = Math.random() * this.height
    }
  }

  draw(ctx) {
    ctx.fillStyle = `rgba(255, 215, 0, ${this.alpha})`
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
    ctx.fill()
  }
}

// 背景动画 - 云类
class BgCloud {
  constructor(w, h) {
    this.x = Math.random() * w
    this.y = Math.random() * h
    this.width = Math.random() * 200 + 100
    this.height = this.width * 0.6
    this.speedX = Math.random() * 0.5 + 0.2
    this.opacity = Math.random() * 0.1 + 0.05
    this.width_ = w
    this.height_ = h
  }

  update(speed) {
    this.x -= this.speedX * speed * 0.5
    if (this.x + this.width < 0) {
      this.x = this.width_ + Math.random() * 200
      this.y = Math.random() * this.height_
    }
  }

  draw(ctx) {
    ctx.save()
    ctx.globalAlpha = this.opacity
    ctx.fillStyle = COLORS.goldLight
    ctx.beginPath()
    ctx.ellipse(this.x, this.y, this.width / 2, this.height / 2, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

// 初始化背景
const initBackground = () => {
  if (!bgCanvasRef.value) return

  bgCanvas = bgCanvasRef.value
  bgCtx = bgCanvas.getContext('2d')

  const resize = () => {
    bgCanvas.width = window.innerWidth
    bgCanvas.height = window.innerHeight
    // 重新初始化粒子
    bgParticles = []
    bgClouds = []
    for (let i = 0; i < 100; i++) {
      bgParticles.push(new BgParticle(bgCanvas.width, bgCanvas.height))
    }
    for (let i = 0; i < 15; i++) {
      bgClouds.push(new BgCloud(bgCanvas.width, bgCanvas.height))
    }
  }

  resize()
  window.addEventListener('resize', resize)

  // 动画循环
  const animate = () => {
    if (!bgCtx) return

    const w = bgCanvas.width
    const h = bgCanvas.height

    // 清除并绘制渐变背景
    const gradient = bgCtx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w)
    gradient.addColorStop(0, COLORS.redBright)
    gradient.addColorStop(0.8, COLORS.redDeep)
    gradient.addColorStop(1, '#580507')
    bgCtx.fillStyle = gradient
    bgCtx.fillRect(0, 0, w, h)

    // 平滑速度过渡
    bgSpeed += (bgTargetSpeed - bgSpeed) * 0.1

    // 绘制云层
    bgClouds.forEach(cloud => {
      cloud.update(bgSpeed)
      cloud.draw(bgCtx)
    })

    // 绘制粒子
    bgParticles.forEach(p => {
      p.update(bgSpeed)
      p.draw(bgCtx)
    })

    bgAnimationFrame = requestAnimationFrame(animate)
  }

  animate()
}

// 设置背景速度
const setBackgroundSpeed = (speed) => {
  bgTargetSpeed = speed
}

// 开始抽奖
const startDraw = () => {
  if (eligibleList.value.length === 0) {
    alert('暂无参与人员')
    return
  }
  if (!isCurrentPrizeAvailable.value) {
    alert('该奖项已抽完')
    return
  }

  // 播放开始音效
  playSound('start')

  drawStatus.value = STATE.RUNNING
  showWinnerCard.value = false
  horseAnimationDuration.value = '0.3s'

  // 加速背景
  setBackgroundSpeed(15)

  // 启动孔明灯动画
  startLanternsAnimation(eligibleList.value.map(p => p.name))

  // 开始名字滚动
  clearInterval(animationInterval)
  animationInterval = setInterval(() => {
    const name = eligibleList.value[Math.floor(Math.random() * eligibleList.value.length)].name
    currentName.value = name
  }, 50)
}

// 停止抽奖
const stopDraw = () => {
  if (drawStatus.value !== STATE.RUNNING) return

  drawStatus.value = STATE.STOPPING
  horseAnimationDuration.value = '0.6s'

  // 减速背景
  setBackgroundSpeed(2)

  // 减速效果
  let delay = 50
  const decelerate = () => {
    delay *= 1.1
    if (delay > 400) {
      finalizeDraw()
    } else {
      currentName.value = eligibleList.value[Math.floor(Math.random() * eligibleList.value.length)].name
      setTimeout(decelerate, delay)
    }
  }

  clearInterval(animationInterval)
  decelerate()
}

// 完成抽奖
const finalizeDraw = () => {
  // 播放结束音效
  playSound('end')

  // 使用 currentBatchCount（考虑剩余人数，最后一批可能不足batchCount）
  const count = currentBatchCount.value

  // 选取中奖者
  const winners = []
  const tempList = [...eligibleList.value]

  for (let i = 0; i < count; i++) {
    if (tempList.length === 0) break
    const idx = Math.floor(Math.random() * tempList.length)
    winners.push(tempList[idx])
    tempList.splice(idx, 1)
  }

  winnerList.value = winners
  drawStatus.value = STATE.RESULT
  horseAnimationDuration.value = '0.6s'

  // 保存中奖记录
  winners.forEach(w => {
    addWinnerRecord(w, currentPrize.value)
  })

  // 手动更新 winnerRecords，确保 remainingCount 正确计算
  winnerRecords.value = loadWinnerRecords()

  // 显示中奖卡片
  showWinnerCard.value = true

  // 播放彩带
  fireConfetti()

  // 手动刷新数据（由用户自行决定）
  // loadData()

  // 触发卡片动画（使用 nextTick 确保 DOM 已更新）
  nextTick(() => {
    if (winnerCardRef.value) {
      winnerCardRef.value.style.display = 'flex'
    }
  })

  // 保存中奖者人名列表（用于大奖弹幕）
  grandPrizeWinnerNames = winnerList.value.map(w => w.name || w)

  // 初始化弹幕
  setTimeout(() => {
    initDanmaku()
  }, 500)
}

// ========== 弹幕初始化 ==========
const initDanmaku = () => {
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

// 彩带效果
const fireConfetti = () => {
  const duration = 3000
  const end = Date.now() + duration

  const frame = () => {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#FFD700', '#D20F15', '#FFF']
    })
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#FFD700', '#D20F15', '#FFF']
    })

    if (Date.now() < end) {
      requestAnimationFrame(frame)
    }
  }

  frame()
}

// 重置
const resetDraw = () => {
  // 在重置前，保存当前中奖结果为上一轮名单
  if (winnerList.value.length > 0) {
    lastPrizeWinners.value = [...winnerList.value]
    lastPrizeName.value = currentPrize.value.name
  }

  drawStatus.value = STATE.IDLE
  currentName.value = '准备抽奖'
  showWinnerCard.value = false
  horseAnimationDuration.value = '0.6s'
  setBackgroundSpeed(2)
  clearInterval(animationInterval)
  // 清空大奖中奖者人名列表和弹幕
  grandPrizeWinnerNames = []
  danmakuList.value = []
}

// 切换抽奖状态
const toggleDraw = () => {
  if (drawStatus.value === STATE.IDLE || drawStatus.value === STATE.RESULT) {
    // 在开始新抽奖前，保存上一轮结果
    if (drawStatus.value === STATE.RESULT && winnerList.value.length > 0) {
      lastPrizeWinners.value = [...winnerList.value]
      lastPrizeName.value = currentPrize.value.name
    }
    startDraw()
  } else if (drawStatus.value === STATE.RUNNING) {
    stopDraw()
  }
}

// 键盘事件
const handleKeydown = (e) => {
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault()
    toggleDraw()
  }
  if (e.code === 'Escape') {
    resetDraw()
  }
}

// 选择奖项
const selectPrize = (index) => {
  if (drawStatus.value === STATE.RUNNING) return
  currentPrizeIndex.value = index
  resetDraw()
}

// 切换到下一奖项（更高一级）
const goToNextPrize = () => {
  if (currentPrizeIndex.value > 0) {
    currentPrizeIndex.value--
    resetDraw()
  }
}

// 切换到上一奖项（更低一级）
const goToPrevPrize = () => {
  if (currentPrizeIndex.value < prizes.value.length - 1) {
    currentPrizeIndex.value++
    resetDraw()
  }
}

// 是否可以切换到下一奖项（更高一级）
const canGoToNextPrize = computed(() => prizes.value.length > 1)

// 是否可以切换到上一奖项（更低一级）
const canGoToPrevPrize = computed(() => currentPrizeIndex.value < prizes.value.length - 1)

// 返回后台
const goBack = () => {
  emit('back')
}

// Lifecycle
onMounted(() => {
  loadData()
  initBackground()
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', handleResize)
  // 启动孔明灯动画循环
  animateLanterns()
  // 初始化列数
  handleResize()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', handleResize)
  clearInterval(animationInterval)
  if (bgAnimationFrame) cancelAnimationFrame(bgAnimationFrame)
  if (lanternAnimationFrame) cancelAnimationFrame(lanternAnimationFrame)
  bgCtx = null
  stopAllSounds()
})
</script>

<template>
  <div class="yima-container" :class="{ 'plain-bg': settings?.enableSpecialBackground === false }">
    <!-- 背景 Canvas -->
    <canvas v-if="settings?.enableSpecialBackground !== false" ref="bgCanvasRef" class="bg-canvas"></canvas>

    <!-- 主容器 -->
    <div class="app-container">
      <!-- 标题 -->
      <header class="header">
        <h1 class="title">马到成功 · 鸿运当头</h1>
        <div v-show="!showWinnerCard" class="subtitle">2026杭州西软信息技术有限公司年会</div>
      </header>

      <!-- 中间舞台 -->
      <div class="stage">
        <!-- 马的图片 -->
        <div class="horse-wrapper">
          <img src="/madaocgong/horse.png" alt="Running Horse" class="horse-img"
            :style="{ animationDuration: horseAnimationDuration }">
        </div>

        <!-- 名字显示区域 -->
        <div class="lottery-display">
          <div v-show="!showWinnerCard" ref="nameRollerRef" class="name-roller">{{ currentName }}</div>

          <!-- 中奖卡片 -->
          <div ref="winnerCardRef" class="winner-card" :style="{ display: showWinnerCard ? 'flex' : 'none' }">
            <div class="winner-label">恭喜</div>
            <div ref="winnerContainerRef" class="winner-container" :class="{ 'single': winnerList.length === 1 }">
              <template v-if="winnerList.length === 1">
                <div class="winner-name-wrapper single" @click="openAbandonConfirmModal(winnerList[0])" title="点击放弃奖项">
                  <div class="winner-name single">{{ winnerList[0]?.name }}</div>
                  <div v-if="showDept && winnerList[0]?.department" class="winner-dept-single">
                    {{ winnerList[0]?.department }}
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="winner-grid">
                  <div v-for="(w, idx) in winnerList" :key="idx" class="winner-grid-item"
                    @click="openAbandonConfirmModal(w)" title="点击放弃奖项">
                    <div class="winner-grid-name">{{ w.name }}</div>
                    <div v-if="showDept && w.department" class="winner-grid-dept">{{ w.department }}</div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 孔明灯层 -->
    <div class="lanterns-layer">
      <div v-for="lantern in lanterns" :key="lantern.id" class="lantern" :style="{
        left: lantern.x + '%',
        top: lantern.y + 'px',
        transform: `translateX(-50%) scale(${lantern.scale})`,
        opacity: lantern.opacity
      }">
        <!-- 灯体 -->
        <img :src="`/images/${lanternImages[lantern.imageIndex]}`" class="lantern-body" alt="孔明灯">
        <!-- 名字（灯中心） -->
        <div class="lantern-name">{{ lantern.name }}</div>
        <!-- 尾巴 -->
        <div class="lantern-tail">
          <template v-for="i in lantern.tailLength" :key="i">
            <!-- 中间节带祝福语 -->
            <div v-if="i === 2" class="tail-part tail-center">
              <img :src="lanternTailConfig.center" class="tail-center-img" alt="中间">
              <div class="tail-blessing">{{ lantern.blessing }}</div>
            </div>
            <!-- 其他节 -->
            <img v-else :src="getTailImage(i, lantern.tailLength)" class="tail-part" alt="尾巴">
          </template>
        </div>
      </div>
    </div>

    <!-- 弹幕层 -->
    <div v-if="drawStatus === 'RESULT' && danmakuList.length > 0 && settings?.barrageEnabled !== false"
      class="danmaku-container" :class="{ 'full-screen': settings?.fullScreenBarrageEnabled !== false }">
      <div v-for="item in danmakuList" :key="item.id" class="danmaku-item" :style="item.style">
        {{ item.text }}
      </div>
    </div>

    <!-- 底部控制区 -->
    <footer class="screen-footer">
      <div class="control-area">
        <button v-if="drawStatus === STATE.IDLE || drawStatus === STATE.RESULT" class="main-btn"
          :class="[
            drawStatus === STATE.RESULT ? 'confirm-btn' : 'start-btn',
            (isDrawButtonDisabled || remainingCount <= 0 || currentBatchCount <= 0) ? 'disabled-btn' : ''
          ]"
          :disabled="isDrawButtonDisabled || remainingCount <= 0 || currentBatchCount <= 0"
          @click="toggleDraw">
          {{ remainingCount <= 0 || currentBatchCount <= 0 ? '该奖项已抽完' : '开始抽奖' }}
        </button>
        <button v-else-if="drawStatus === STATE.RUNNING" class="main-btn stop-btn" @click="toggleDraw">
          停止抽奖
        </button>
      </div>
    </footer>

    <!-- 奖项选择器 - 左下角 -->
    <div class="prize-selector">
      <button v-if="false" class="prize-selector-btn" @click="showPrizeSelector = !showPrizeSelector">
        {{ currentPrize.name || '选择奖项' }}
        <span class="arrow">{{ showPrizeSelector ? '▲' : '▼' }}</span>
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

      <!-- 奖项信息 -->
      <div v-if="totalPrizeCount > 0" class="prize-info-card">
        <div class="prize-name-large">{{ currentPrize.name }}</div>
        <div class="prize-details">
          <span>名额: {{ totalPrizeCount }} (一次抽 {{ currentBatchCount }} 人)</span>
          <span v-if="remainingDraws > 0" class="remaining-draws">还需 {{ remainingDraws }} 次</span>
        </div>
      </div>
      <transition name="fade">
        <div v-if="showPrizeSelector" class="prize-options">
          <div v-for="(p, i) in prizes" :key="i" class="prize-option" :class="{ active: i === currentPrizeIndex }"
            @click="selectPrize(i)">
            {{ p.name }}
          </div>
        </div>
      </transition>
      <!-- 上下奖项按钮组 -->
      <div class="prize-nav-row">
        <!-- 左侧：上奖项和下一奖项 -->
        <div class="prize-nav-group">
          <button class="nav-btn prev-prize-btn" :class="{ disabled: !canGoToPrevPrize }"
            :disabled="!canGoToPrevPrize" @click="goToPrevPrize" title="切换到低一级奖项">
            <span class="material-symbols-outlined">arrow_downward</span>
            上奖项
          </button>
          <button class="nav-btn next-prize-btn" :class="{ disabled: !canGoToNextPrize }"
            :disabled="!canGoToNextPrize" @click="goToNextPrize" title="切换到高一级奖项">
            <span class="material-symbols-outlined">arrow_upward</span>
            下一奖项
          </button>
        </div>
        <!-- 右侧：上一批获奖名单 -->
        <button class="nav-btn last-winners-btn-corner" :class="{ disabled: lastPrizeWinners.length === 0 }"
          :disabled="lastPrizeWinners.length === 0" @click="openLastWinnersModal" title="查看上一批获奖名单">
          <span class="material-symbols-outlined">history</span>
          上一批获奖名单
        </button>
      </div>
    </div>

    <!-- 返回后台按钮 - 右下角 -->
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
              <div v-for="winner in lastPrizeWinners" :key="winner.id || winner" class="winner-card">
                <div v-if="showAvatar" class="winner-avatar">{{ (winner.name || winner).charAt(0) }}</div>
                <span class="winner-name">{{ winner.name || winner }}</span>
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
.yima-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  background: #8B0000;
}

/* 普通背景（禁用特殊背景时） */
.yima-container.plain-bg {
  background: radial-gradient(circle at center,
      #FF4444 0%,
      #DC143C 30%,
      #8B0000 60%,
      #580507 100%);
}

.bg-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.app-container {
  position: relative;
  width: 100%;
  height: calc(100vh - 100px);
  /* 留出底部控制区空间 */
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at center, transparent 0%, rgba(0, 0, 0, 0.4) 100%);
}

/* 标题 */
.header {
  position: absolute;
  top: 5vh;
  text-align: center;
  z-index: 20;
}

.title {
  font-family: 'Ma Shan Zheng', cursive;
  font-size: 8vh;
  color: transparent;
  background: linear-gradient(to bottom, #FFD700, #BF953F);
  -webkit-background-clip: text;
  background-clip: text;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5));
  letter-spacing: 0.5rem;
  animation: float 4s ease-in-out infinite;
  margin: 0;
}

.subtitle {
  font-family: 'Ma Shan Zheng', cursive;
  font-size: 2.5vh;
  color: #FFF8D6;
  letter-spacing: 0.8rem;
  margin-top: 1vh;
  opacity: 0.8;
  text-transform: uppercase;
}

/* 中间舞台 */
.stage {
  position: relative;
  width: 80vw;
  height: 50vh;
  display: flex;
  align-items: center;
  justify-content: center;
  perspective: 1000px;
}

.horse-wrapper {
  position: absolute;
  bottom: -5vh;
  left: 50%;
  transform: translateX(-50%);
  width: 50vh;
  height: 50vh;
  z-index: 15;
  filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.5));
}

.horse-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  animation: gallop 0.6s ease-in-out infinite alternate;
}

@keyframes gallop {
  0% {
    transform: translateY(0) rotate(0deg);
  }

  100% {
    transform: translateY(-15px) rotate(2deg);
  }
}

@keyframes float {

  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-10px);
  }
}

/* 抽奖显示 */
.lottery-display {
  position: relative;
  z-index: 40;
  width: 100%;
  text-align: center;
}

.name-roller {
  font-family: 'Ma Shan Zheng', cursive;
  font-size: 15vh;
  color: #FFFDD0;
  text-shadow: 0 0 20px rgba(255, 215, 0, 0.6);
  white-space: nowrap;
  overflow: hidden;
  height: 20vh;
  line-height: 20vh;
  opacity: 0.9;
}

/* 中奖卡片 */
.winner-card {
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(142, 0, 0, 0.95);
  border: 2px solid #FFD700;
  box-shadow: 0 0 50px #FFD700;
  padding: 40px;
  border-radius: 20px;
  position: relative;
  z-index: 30;
  max-width: 95vw;
  max-height: 80vh;
  animation: popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes popIn {
  0% {
    transform: scale(0);
    opacity: 0;
  }

  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.winner-label {
  font-size: 3vh;
  color: #FFF8D6;
  margin-bottom: 2vh;
}

.winner-container {
  text-align: center;
}

.winner-container.single .winner-name {
  font-family: 'Ma Shan Zheng', cursive;
  font-size: 12vh;
  color: #FFD700;
  text-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
}

.winner-name-wrapper.single {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1vh;
}

.winner-dept-single {
  font-size: 4vh;
  color: #FFF8D6;
  opacity: 0.8;
  font-family: 'Ma Shan Zheng', cursive;
}

.winner-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  width: 100%;
  justify-content: center;
  align-items: center;
}

.winner-grid-item {
  font-family: 'Ma Shan Zheng', cursive;
  color: #FFD700;
  text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
  padding: 10px 15px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid #FFD700;
  border-radius: 8px;
  text-align: center;
  flex: 0 1 auto;
  min-width: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.winner-grid-name {
  font-size: 3vh;
}

.winner-grid-dept {
  font-size: 1.6vh;
  color: #FFF8D6;
  opacity: 0.8;
}

/* 中奖卡片鼠标移入高亮效果 */
.winner-name-wrapper.single {
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 1rem 2rem;
  border-radius: 12px;
  border: 2px solid transparent;
}

.winner-name-wrapper.single:hover {
  background: rgba(255, 215, 0, 0.15);
  border-color: #FFD700;
  transform: scale(1.05);
  box-shadow: 0 0 30px rgba(255, 215, 0, 0.4);
}

.winner-name-wrapper.single:hover .winner-name {
  text-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
}

.winner-grid-item {
  cursor: pointer;
  transition: all 0.3s ease;
}

.winner-grid-item:hover {
  background: rgba(255, 215, 0, 0.25);
  border-color: #FFD700;
  transform: translateY(-4px) scale(1.05);
  box-shadow: 0 8px 25px rgba(255, 215, 0, 0.4);
}

.winner-grid-item:hover .winner-grid-name {
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.6);
}

/* 底部控制区 */
.screen-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 2rem 3rem;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.5), transparent);
}

.control-area {
  display: flex;
  align-items: center;
  justify-content: center;
}

.keyboard-hint {
  position: absolute;
  right: 2rem;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.6);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
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

.start-btn {
  background: linear-gradient(135deg, #FFD700, #FFA500);
  color: #8E0000;
}

.start-btn:hover {
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
  background: linear-gradient(135deg, #4CAF50, #45a049);
  color: #FFFFFF;
}

.confirm-btn:hover {
  transform: translateY(-4px) scale(1.05);
  box-shadow: 0 15px 40px rgba(76, 175, 80, 0.5), 0 0 60px rgba(76, 175, 80, 0.5);
}

.disabled-btn {
  background: linear-gradient(135deg, #888, #666) !important;
  color: #ccc !important;
  cursor: not-allowed !important;
  box-shadow: none !important;
}

.disabled-btn:hover {
  transform: none !important;
}

/* 奖项选择器 */
.prize-selector {
  position: fixed;
  bottom: 2rem;
  left: 2rem;
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 280px;
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

.prize-selector-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  box-shadow: 0 0 30px rgba(255, 215, 0, 0.5);
}

.prize-info-card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem 1.25rem;
  background: linear-gradient(135deg, rgba(139, 0, 0, 0.9), rgba(220, 20, 60, 0.8));
  border: 2px solid #FFD700;
  border-radius: 12px;
  color: #FFD700;
  box-shadow:
    0 4px 15px rgba(0, 0, 0, 0.4),
    0 0 20px rgba(255, 215, 0, 0.2);
  backdrop-filter: blur(10px);
}

/* 奖品图片展示区 */
.prize-image-wrapper {
  position: relative;
}

.prize-image-card {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
  border: 2px solid rgba(255, 215, 0, 0.6);
  border-radius: 12px;
  margin-bottom: 0.5rem;
  box-shadow:
    0 4px 15px rgba(0, 0, 0, 0.3),
    0 0 15px rgba(255, 215, 0, 0.2),
    inset 0 0 20px rgba(255, 215, 0, 0.1);
  backdrop-filter: blur(10px);
  overflow: hidden;
}

.prize-image {
  max-width: 100%;
  max-height: 280px;
  object-fit: contain;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
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

.prize-info-card .prize-name-large {
  font-family: 'Ma Shan Zheng', cursive;
  font-size: 1.5rem;
  font-weight: 700;
  color: #FFD700;
  text-shadow: 0 2px 8px rgba(255, 215, 0, 0.5);
  letter-spacing: 2px;
}

.prize-info-card .prize-details {
  display: flex;
  gap: 1rem;
  font-size: 0.9rem;
  color: rgba(255, 253, 208, 0.9);
}

.prize-info-card .remaining-draws {
  color: #FFA500;
  font-weight: 600;
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

.prize-option.active {
  background: rgba(255, 215, 0, 0.3);
}

/* 奖项导航行 - 水平布局 */
.prize-nav-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

/* 下一奖项按钮组 - 左右布局 */
.prize-nav-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
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

.nav-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  border-color: #FFD700;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.4);
}

.nav-btn:hover.disabled {
  background: rgba(0, 0, 0, 0.6);
  border-color: rgba(255, 215, 0, 0.5);
  box-shadow: none;
  cursor: not-allowed;
}

.nav-btn .material-symbols-outlined {
  font-size: 1.1rem;
}

.nav-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 上一批获奖名单按钮 */
.last-winners-btn-corner {
  flex-shrink: 0;
}

/* 上一奖项名单弹窗 */
.last-winners-modal {
  max-width: 900px;
  background: linear-gradient(145deg, #8B0000 0%, #DC143C 30%, #8B0000 100%);
  border: 3px solid #FFD700;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.5),
    0 0 40px rgba(255, 215, 0, 0.3),
    inset 0 0 100px rgba(255, 215, 0, 0.1);
}

/* 弹窗头部 */
.last-winners-modal .modal-header {
  padding: 1.5rem;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid rgba(255, 215, 0, 0.3);
  background: linear-gradient(to right, rgba(255, 215, 0, 0.1), transparent);
}

.last-winners-modal .modal-title {
  font-family: 'Ma Shan Zheng', cursive;
  font-size: 1.8rem;
  color: #FFD700;
  text-shadow: 0 2px 10px rgba(255, 215, 0, 0.5);
  margin: 0;
}

.last-winners-modal .modal-close {
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

.last-winners-modal .modal-close:hover {
  background: rgba(255, 215, 0, 0.2);
  border-color: #FFD700;
  transform: rotate(90deg);
}

.last-winners-modal .modal-body {
  padding: 1.5rem;
  max-height: 500px;
  overflow-y: auto;
}

/* 弹窗底部按钮 */
.last-winners-modal .modal-footer {
  padding: 1rem 1.5rem 1.5rem;
  display: flex;
  justify-content: center;
  border-top: 2px solid rgba(255, 215, 0, 0.3);
  background: linear-gradient(to right, transparent, rgba(255, 215, 0, 0.1));
}

.last-winners-modal .modal-btn {
  padding: 0.75rem 3rem;
  font-size: 1.1rem;
  font-weight: 600;
  border-radius: 50px;
  border: 2px solid #FFD700;
  cursor: pointer;
  transition: all 0.3s;
}

.last-winners-modal .modal-btn-confirm {
  background: linear-gradient(135deg, #FFD700, #FFA500);
  color: #8B0000;
}

.last-winners-modal .modal-btn-confirm:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 5px 20px rgba(255, 215, 0, 0.5);
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
  font-family: 'Ma Shan Zheng', cursive;
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
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
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
  font-family: 'Ma Shan Zheng', cursive;
  font-size: 2rem;
  color: #FFD700;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.abandon-winner-info .winner-dept {
  font-size: 1rem;
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

.winners-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 1rem;
  max-height: 450px;
  overflow-y: auto;
  padding: 1rem;
}

.winner-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.25rem 0.75rem;
  background: linear-gradient(145deg, #8B0000 0%, #DC143C 50%, #8B0000 100%);
  border: 2px solid #FFD700;
  border-radius: 1rem;
  text-align: center;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow:
    0 4px 15px rgba(0, 0, 0, 0.4),
    0 0 20px rgba(255, 215, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
}

.winner-card::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255, 215, 0, 0.1) 0%, transparent 70%);
  pointer-events: none;
}

.winner-card:hover {
  background: linear-gradient(145deg, #DC143C 0%, #FF4444 50%, #DC143C 100%);
  border-color: #FFD700;
  transform: translateY(-4px) scale(1.02);
  box-shadow:
    0 8px 25px rgba(0, 0, 0, 0.5),
    0 0 30px rgba(255, 215, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.winner-avatar {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%);
  color: #8B0000;
  border-radius: 50%;
  font-weight: 700;
  font-size: 1.4rem;
  margin-bottom: 0.6rem;
  box-shadow:
    0 3px 10px rgba(255, 215, 0, 0.5),
    inset 0 2px 4px rgba(255, 255, 255, 0.4);
  position: relative;
  z-index: 1;
}

.winner-name {
  color: #FFD700;
  font-weight: 700;
  font-size: 1.1rem;
  line-height: 1.3;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.winner-dept {
  color: rgba(255, 253, 208, 0.8);
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

.badge {
  font-size: 0.7rem;
  background: rgba(128, 128, 128, 0.4);
  padding: 0.2rem 0.5rem;
  border-radius: 0.5rem;
  margin-left: 0.5rem;
  color: #aaa;
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
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

/* 孔明灯样式 */
.lanterns-layer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 50;
}

.lantern {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: top 0.016s linear;
}

.lantern-body {
  width: 160px;
  height: auto;
  filter: drop-shadow(0 0 15px rgba(255, 150, 50, 0.7));
  z-index: 2;
}

.lantern-name {
  position: absolute;
  top: 15%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: 'Ma Shan Zheng', cursive;
  font-size: 2.0rem;
  color: #FFFDD0;
  text-shadow: 0 0 8px rgba(255, 100, 50, 0.9), 0 0 15px rgba(255, 150, 0, 0.7);
  /* white-space: nowrap;
  letter-spacing: 3px; */
  z-index: 3;
  width: 120px;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lantern-tail {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: -4px;
  z-index: 1;
}

.tail-part {
  width: 120px;
  height: auto;
}

/* 中间节尾巴（带祝福语） */
.tail-center {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tail-center-img {
  width: 120px;
  height: 200px;
}

.tail-blessing {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  writing-mode: vertical-rl;
  font-family: 'Ma Shan Zheng', cursive;
  font-size: 2rem;
  color: #ffffff;
  white-space: nowrap;
  letter-spacing: 3px;
  text-shadow: 0 0 3px rgba(255, 215, 0, 0.6);
}

/* 弹幕样式 */
.danmaku-container {
  position: fixed;
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
</style>
