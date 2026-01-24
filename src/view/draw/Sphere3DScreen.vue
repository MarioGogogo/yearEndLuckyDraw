<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'

const emit = defineEmits(['back'])

// 抽奖状态
const drawStatus = ref('idle') // idle, drawing, result
const currentPrize = ref({ name: '三等奖', subtitle: '神秘大礼盒', count: 50 })
const drawnCount = ref(0)
const totalCount = ref(50)
const winners = ref([])

// 中奖名单布局类型
const winnersLayoutType = computed(() => {
  const count = winners.value.length
  // 特等奖/一等奖/二等奖都用大卡片展示模式（≤10人）
  if (count <= 10) return 'showcase'
  return 'grid' // 10人以上：网格模式
})

// 获奖等级样式
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
const prizeOptions = [
  { name: '特等奖', subtitle: '超级大奖', count: 1 },
  { name: '一等奖', subtitle: '梦寐以求大礼', count: 5 },
  { name: '二等奖', subtitle: '精美礼品', count: 10 },
  { name: '三等奖', subtitle: '神秘大礼盒', count: 50 }
]
const showPrizeSelector = ref(false)

// 弹幕相关
const danmakuList = ref([])
const danmakuTexts = [
  '恭喜中奖！🎉', '吸欧气！✨', '大奖拿回家！🎁', '羡慕了！',
  '下个就是我！💪', '太强了！', '666！', '好运连连！🍀',
  '新年快乐！🧧', '万事如意！', '我也想要大奖！', '欧皇附体！',
  '恭喜恭喜！', '一定要幸福哦！', '明年我也中！', '厉害了！',
  '这运气没谁了！', '老板大气！', '蹭蹭喜气！', '发财了！'
]

function initDanmaku() {
  danmakuList.value = []
  const count = 40 // 生成弹幕数量
  for (let i = 0; i < count; i++) {
    const text = danmakuTexts[Math.floor(Math.random() * danmakuTexts.length)]
    const top = Math.random() * 90 // 0-90% 的容器高度
    const duration = 15 + Math.random() * 20 // 15-35s 滚动时间，慢一点更清晰
    const delay = Math.random() * 30 // 0-30s 随机延迟，拉大间隔防止扎堆
    const fontSize = 1.2 + Math.random() * 1.5 + 'rem'
    const color = Math.random() > 0.6 ? '#FFD700' : '#FFFFFF' // 40% 金色，60% 白色
    
    danmakuList.value.push({
      id: i,
      text,
      style: {
        top: `${top}%`,
        left: '100%', // 从屏幕右侧外开始
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
        fontSize,
        color
      }
    })
  }
}

watch(drawStatus, (newVal) => {
  if (newVal === 'result') {
    initDanmaku()
  } else {
    danmakuList.value = []
  }
})

// Canvas 相关
let canvas, ctx
let animationId
let particles = []
let speedLines = []
let floatingDots = []

// 烟花独立 Canvas 上下文
let fireworkCanvas, fireworkCtx
let fireworkAnimationId
let fireworks = [] // 烟花火箭
let sparkParticles = [] // 烟花爆炸微粒
let showFireworks = ref(false) // 是否显示烟花

// 烟花粒子类 (升空阶段)
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

    // 加速
    this.speed *= this.acceleration

    const vx = Math.cos(this.angle) * this.speed
    const vy = Math.sin(this.angle) * this.speed
    this.distanceTraveled = Math.sqrt(Math.pow(this.x + vx - this.startX, 2) + Math.pow(this.y + vy - this.startY, 2))

    if (this.distanceTraveled >= this.distanceToTarget) {
      // 到达目标，创建爆炸
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
    
    // 绘制头部小圆点
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.targetRadius, 0, Math.PI * 2)
    ctx.stroke()
  }
}

// 爆炸粒子类 (SparkParticle)
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

// 创建爆炸粒子
function createSparkParticles(x, y, hue) {
  const count = 150
  for (let i = 0; i < count; i++) {
    sparkParticles.push(new SparkParticle(x, y, hue))
  }
}

// 启动烟花系统
let fireworkInterval = null
function startFireworks() {
  showFireworks.value = true

  // 初始化 Canvas
  if (!fireworkCanvas) {
    fireworkCanvas = document.getElementById('firework-canvas')
    if (fireworkCanvas) {
      fireworkCtx = fireworkCanvas.getContext('2d')
      resizeFireworkCanvas()
      window.addEventListener('resize', resizeFireworkCanvas)
    }
  }

  // 防止重复启动动画循环
  if (!fireworkAnimationId) {
    animateFireworks()
  }

  // 烟花发射循环
  function loop() {
    if (!showFireworks.value) return
    
    if (drawStatus.value === 'result') {
      const startX = window.innerWidth / 2 + (Math.random() - 0.5) * window.innerWidth * 0.5
      const targetX = Math.random() * window.innerWidth
      const targetY = Math.random() * window.innerHeight * 0.5
      const hue = Math.random() * 360
      fireworks.push(new FireworkParticle(startX, window.innerHeight, targetX, targetY, hue))
    }
    
    // 随机时间间隔
    const delay = Math.random() * 800 + 200
    fireworkInterval = setTimeout(loop, delay)
  }
  
  loop()
}

// 停止烟花
function stopFireworks() {
  showFireworks.value = false
  if (fireworkInterval) {
    clearTimeout(fireworkInterval)
    fireworkInterval = null
  }
  // 清空粒子
  fireworks = []
  sparkParticles = []
  
  if (fireworkAnimationId) {
    cancelAnimationFrame(fireworkAnimationId)
    fireworkAnimationId = null
  }

  // 立即清空画布
  if (fireworkCtx && fireworkCanvas) {
    fireworkCtx.clearRect(0, 0, fireworkCanvas.width, fireworkCanvas.height)
  }
}

// 调整烟花 Canvas 大小
function resizeFireworkCanvas() {
  if (fireworkCanvas) {
    fireworkCanvas.width = window.innerWidth
    fireworkCanvas.height = window.innerHeight
  }
}

// 烟花动画循环
function animateFireworks() {
  if (!fireworkCtx || !fireworkCanvas) {
      fireworkAnimationId = requestAnimationFrame(animateFireworks)
      return
  }

  // 设置拖尾效果
  fireworkCtx.globalCompositeOperation = 'destination-out'
  fireworkCtx.fillStyle = 'rgba(0, 0, 0, 0.2)'
  fireworkCtx.fillRect(0, 0, fireworkCanvas.width, fireworkCanvas.height)
  fireworkCtx.globalCompositeOperation = 'lighter'

  // 更新和绘制烟花（升空阶段）
  let i = fireworks.length
  while (i--) {
    fireworks[i].draw(fireworkCtx)
    fireworks[i].update(i)
  }

  // 更新和绘制粒子（爆炸阶段）
  let j = sparkParticles.length
  while (j--) {
    sparkParticles[j].draw(fireworkCtx)
    sparkParticles[j].update(j)
  }

  fireworkAnimationId = requestAnimationFrame(animateFireworks)
}

// 模拟参与人员名单
const participants = [
  '王若丞', '梁修根', '何汉林', '米超', '孙正茂', '胡保群', '周秀锦', '侯牧余',
  '吴敏莉', '曾昭志', '胡华刚', '李世飞', '周秀锦', '叶延宇', '陈黛',
  '张雪娅', '周莉', '张云柱', '曾远兵', '王家英', '李成义', '贺律师',
  '夏艺', '周秀锦', '盛文锦', '李文羿', '吴道银', '邓伦',
  '杨永梅', '李文羿', '舒桐', '刘博', '罗新', '王波', '周秀锦', '梁修根', '糖糖',
  '姚明珍', '罗治芳', '张莉', '舒星瑜', '冯青', '王丹', '邓磊',
  '黄文江', '刘灿媚', '南孚池', '圆润超', '曾翠兰', '王母', '周秀锦',
  '赵远波', '张娴', '丁东', '舒星瑜', '邓磊', '周莉', '陆淑',
  '周秀锦', '徐英', '李白琼', '舒桐', '曾翠兰', '邓俊', '朱源',
  '黄建荣', '李春阳', '忍多尔', '龙母', '李安郭', '邓望', '郑熹',
  '王博', '何忠明', '何应会', '叶延宇', '余江游', '李青阳', '朱万均'
]

// 粒子类（名字）- Z轴飞行效果
class NameParticle {
  constructor(centerX, centerY, name, isWinner = false, index = 0, total = 1) {
    this.name = name
    this.isWinner = isWinner
    this.centerX = centerX
    this.centerY = centerY
    this.index = index
    this.total = total

    // 基础字体大小
    this.baseFontSize = 20 + Math.random() * 10

    // 初始化飞行参数
    this.reset()
  }

  // 重置粒子状态，用于循环飞行
  reset() {
    // 均匀分布方向（使用黄金角度 + 索引，确保均匀分布）
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)) // 黄金角度约137.5度
    const baseAngle = goldenAngle * this.index
    const angleOffset = (Math.random() - 0.5) * 0.3 // 添加小的随机偏移
    const angle = baseAngle + angleOffset

    const spreadRadius = 400 + Math.random() * 400 // 扩散半径

    // X, Y 方向（屏幕平面）
    this.dirX = Math.cos(angle) * spreadRadius
    this.dirY = Math.sin(angle) * spreadRadius

    // Z轴坐标（深度）- 根据索引设置不同的起始深度，形成层次感
    // 让不同的粒子从不同的深度开始，产生波浪效果
    const layerOffset = (this.index % 10) * 0.15 // 每10个名字一层，层与层间隔0.15
    this.z = -layerOffset // 负数表示还在"等待区"，update时会逐渐增加到0.01
    this.zSpeed = 0.004 + Math.random() * 0.006 // 进一步降低速度
    this.maxZ = 1.2 // 延长最大深度，让淡出更充分

    // 透明度
    this.alpha = 0
    this.edgeFade = 1 // 边缘淡出系数
  }

  update(canvasWidth, canvasHeight) {
    // Z轴向前移动（接近观众）
    this.z += this.zSpeed

    // 如果粒子还在"等待区"（z < 0.01），不进行绘制和计算
    if (this.z < 0.01) {
      this.alpha = 0
      return
    }

    // 计算屏幕坐标（用于边缘淡出检测）
    const scale = this.z / this.maxZ
    const screenX = this.centerX + this.dirX * scale
    const screenY = this.centerY + this.dirY * scale

    // 调试日志 - 只打印第一个粒子的前几次更新
    if (this.name === '王若丞' && this.z < 0.1) {
      console.log('Update:', this.name, 'z:', this.z.toFixed(3), 'screenX:', screenX.toFixed(0), 'screenY:', screenY.toFixed(0))
    }

    // 边缘淡出效果（距离屏幕边缘越近，越淡）
    const edgeDistance = 250 // 边缘淡出距离
    let edgeFadeX = 1
    let edgeFadeY = 1

    // X轴边缘淡出（只在接近边缘时计算）
    if (screenX < edgeDistance) {
      edgeFadeX = Math.max(0, screenX / edgeDistance)
    } else if (screenX > canvasWidth - edgeDistance) {
      edgeFadeX = Math.max(0, (canvasWidth - screenX) / edgeDistance)
    }

    // Y轴边缘淡出（只在接近边缘时计算）
    if (screenY < edgeDistance) {
      edgeFadeY = Math.max(0, screenY / edgeDistance)
    } else if (screenY > canvasHeight - edgeDistance) {
      edgeFadeY = Math.max(0, (canvasHeight - screenY) / edgeDistance)
    }

    // 取两个方向中较小的淡出值
    this.edgeFade = Math.min(edgeFadeX, edgeFadeY)

    // Z轴淡入淡出效果
    let zAlpha = 1
    if (this.z < 0.15) {
      // 淡入阶段（15%）
      zAlpha = this.z / 0.15
    } else if (this.z > 0.6) {
      // 淡出阶段（从60%开始，持续到120%）
      zAlpha = Math.max(0, (this.maxZ - this.z) / (this.maxZ - 0.6))
    }

    // 综合透明度（Z轴淡出 × 边缘淡出）
    // 确保透明度不会小于0
    this.alpha = Math.max(0, Math.min(1, zAlpha * this.edgeFade))

    // 调试日志
    if (this.name === '王若丞' && this.z < 0.1) {
      console.log('  -> zAlpha:', zAlpha.toFixed(3), 'edgeFade:', this.edgeFade.toFixed(3), 'alpha:', this.alpha.toFixed(3))
    }
  }

  // 检查是否超出屏幕（需要重置）
  isDead() {
    return this.z >= this.maxZ
  }

  // 检查是否应该被完全移除（停止抽奖时）
  shouldRemove() {
    return this.z >= this.maxZ || (this.z > 0.15 && this.alpha <= 0.01)
  }

  draw(ctx) {
    // 如果还在等待区或z无效，不绘制
    if (this.z <= 0.01) return

    // 透视投影计算屏幕坐标
    const scale = this.z / this.maxZ
    const screenX = this.centerX + this.dirX * scale
    const screenY = this.centerY + this.dirY * scale

    // 根据深度计算大小（越近越大）
    // 使用对数曲线使小的粒子也能看见
    const normalizedZ = this.z / this.maxZ // 0 到 1
    const sizeScale = 0.3 + normalizedZ * 2.5 // 从0.3开始，最大到2.8
    const fontSize = this.baseFontSize * sizeScale

    // 即使超出边界也继续绘制，依靠 alpha 淡出
    // 只在极端情况下才跳过绘制
    if (screenX < -800 || screenX > canvas.width + 800 ||
        screenY < -800 || screenY > canvas.height + 800) {
      return
    }

    ctx.save()
    ctx.translate(screenX, screenY)
    // 移除旋转，保持名字水平
    ctx.globalAlpha = this.alpha

    // 绘制名字背景
    ctx.font = `900 ${fontSize}px "Microsoft YaHei", sans-serif`
    const textWidth = ctx.measureText(this.name).width
    const padding = 8 + sizeScale * 4

    // 背景渐变
    const gradient = ctx.createLinearGradient(-textWidth/2 - padding, 0, textWidth/2 + padding, 0)
    gradient.addColorStop(0, this.isWinner ? 'rgba(255, 215, 0, 0.95)' : 'rgba(255, 215, 0, 0.85)')
    gradient.addColorStop(1, this.isWinner ? 'rgba(255, 165, 0, 0.95)' : 'rgba(255, 140, 0, 0.85)')

    ctx.fillStyle = gradient
    ctx.shadowColor = 'rgba(255, 215, 0, 0.6)'
    ctx.shadowBlur = 10 + sizeScale * 5

    // 圆角矩形
    const rectHeight = fontSize + padding
    this.roundRect(ctx, -textWidth/2 - padding, -fontSize/2 - padding/2, textWidth + padding*2, rectHeight, 8)
    ctx.fill()

    // 绘制文字
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

// 速度线类 - Z轴飞行效果
class SpeedLine {
  constructor(centerX, centerY) {
    this.centerX = centerX
    this.centerY = centerY

    // 随机方向
    const angle = Math.random() * Math.PI * 2
    const radius = 200 + Math.random() * 400

    this.dirX = Math.cos(angle) * radius
    this.dirY = Math.sin(angle) * radius

    // Z轴深度
    this.z = 0.01
    this.zSpeed = 0.015 + Math.random() * 0.02
    this.maxZ = 1

    this.length = 80 + Math.random() * 120 // 增加长度：80-200，更像光束
    this.width = 2 + Math.random() * 3 // 增加宽度：2-5
    this.alpha = 0
  }

  update() {
    this.z += this.zSpeed

    // 淡入淡出
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

    // 边界检查
    if (screenX < -100 || screenX > canvas.width + 100 ||
        screenY < -100 || screenY > canvas.height + 100) {
      return
    }

    ctx.save()

    // 计算光束的起点和终点，让光束更长
    const prevScale = Math.max(0, (this.z - 0.1) / this.maxZ) // 增加拖尾长度
    const prevX = this.centerX + this.dirX * prevScale
    const prevY = this.centerY + this.dirY * prevScale

    // 创建渐变效果，从起点到终点
    const gradient = ctx.createLinearGradient(prevX, prevY, screenX, screenY)
    gradient.addColorStop(0, 'rgba(255, 215, 0, 0)') // 起点透明
    gradient.addColorStop(0.5, `rgba(255, 215, 0, ${this.alpha * 0.8})`) // 中间最亮
    gradient.addColorStop(1, `rgba(255, 215, 0, ${this.alpha})`) // 终点

    ctx.strokeStyle = gradient
    ctx.lineWidth = this.width * scale * 1.5 // 增加线宽
    ctx.lineCap = 'round'

    // 添加发光效果
    ctx.shadowColor = '#FFD700'
    ctx.shadowBlur = 15 * scale // 发光模糊

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

    // 边界处理
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

// 初始化 Canvas
function initCanvas() {
  canvas = document.getElementById('particle-canvas')
  if (!canvas) return

  ctx = canvas.getContext('2d')
  resizeCanvas()

  // 创建背景漂浮微粒
  createFloatingDots()

  // 启动动画
  animate()

  window.addEventListener('resize', resizeCanvas)
}

// 调整 Canvas 大小
function resizeCanvas() {
  if (!canvas) return
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
}

// 创建漂浮微粒
function createFloatingDots() {
  floatingDots = []
  const count = 100
  for (let i = 0; i < count; i++) {
    floatingDots.push(new FloatingDot(canvas.width, canvas.height))
  }
}

// 动画循环
let animateFrameCount = 0
function animate() {
  animationId = requestAnimationFrame(animate)

  if (!ctx || !canvas) {
    console.error('animate() stopped: ctx or canvas is null')
    return
  }

  animateFrameCount++
  // 每100帧打印一次状态
  if (animateFrameCount % 100 === 0) {
    console.log('animate() running, particles count:', particles.length)
  }

  // 清空画布
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 更新并绘制背景漂浮微粒（在待抽奖和抽奖中显示）
  if (drawStatus.value === 'idle' || drawStatus.value === 'drawing') {
    floatingDots.forEach(dot => {
      dot.update(canvas.width, canvas.height)
      dot.draw(ctx)
    })
  }

  // 更新并绘制速度线
  speedLines = speedLines.filter(line => !line.isDead())
  speedLines.forEach(line => {
    line.update()
    line.draw(ctx)
  })

  // 更新并绘制名字粒子
  const beforeFilter = particles.length

  if (drawStatus.value === 'drawing') {
    // 抽奖中：粒子死亡后重置，循环飞行
    particles.forEach(particle => {
      if (particle.isDead()) {
        particle.reset() // 重置粒子，重新开始飞行
      }
      particle.update(canvas.width, canvas.height)
      particle.draw(ctx)
    })
  } else {
    // 停止抽奖：移除所有粒子
    particles = particles.filter(p => !p.shouldRemove())
    particles.forEach(particle => {
      particle.update(canvas.width, canvas.height)
      particle.draw(ctx)
    })
  }

  const afterFilter = particles.length
  if (beforeFilter !== afterFilter) {
    console.log(`Filtered particles: ${beforeFilter} -> ${afterFilter}`)
  }
}

// 开始抽奖
let drawTimer = null
function startDraw() {
  if (drawStatus.value !== 'idle') return

  // 确保 canvas 已初始化
  if (!canvas || !ctx) {
    console.error('Canvas not initialized!')
    initCanvas()
  }

  // 播放开始音效
  playSound('start')

  drawStatus.value = 'drawing'

  // 创建名字粒子云
  const centerX = canvas.width / 2
  const centerY = canvas.height / 2

  console.log('Starting draw, canvas size:', canvas.width, canvas.height)
  console.log('Center:', centerX, centerY)

  // 随机选择中奖者
  const selectedIndices = new Set()
  while (selectedIndices.size < currentPrize.value.count) {
    const randomIndex = Math.floor(Math.random() * participants.length)
    selectedIndices.add(randomIndex)
  }

  const selectedNames = []

  // 创建所有参与者的粒子（一次性创建，不再分批延迟）
  participants.forEach((name, index) => {
    const isWinner = selectedIndices.has(index)
    if (isWinner) selectedNames.push(name)

    // 传入 index 和 total 用于均匀分布
    const particle = new NameParticle(centerX, centerY, name, isWinner, index, participants.length)
    particles.push(particle)
  })

  console.log('Created', particles.length, 'particles')

  // 创建速度线（持续生成）
  const lineInterval = setInterval(() => {
    if (drawStatus.value !== 'drawing') {
      clearInterval(lineInterval)
      return
    }
    for (let i = 0; i < 3; i++) {
      speedLines.push(new SpeedLine(centerX, centerY))
    }
  }, 50)

  winners.value = selectedNames
  drawnCount.value = selectedNames.length

  // 默认20秒后显示结果（如果用户没有手动停止）
  drawTimer = setTimeout(() => {
    stopDraw()
  }, 20000)
}

// 停止抽奖
function stopDraw() {
  if (drawStatus.value !== 'drawing') return

  if (drawTimer) {
    clearTimeout(drawTimer)
    drawTimer = null
  }

  // 标记为停止状态，让粒子逐渐消失
  drawStatus.value = 'stopping'

  // 等待所有粒子消失后显示结果（最多1秒）
  setTimeout(() => {
    particles = [] // 清空所有粒子
    speedLines = [] // 清空速度线
    drawStatus.value = 'result'

    // 播放中奖揭晓音效
    playSound('end')

    // 启动烟花效果
    startFireworks()
  }, 1000)
}

// 重置场景
function resetScene() {
  if (drawTimer) {
    clearTimeout(drawTimer)
    drawTimer = null
  }

  // 停止烟花
  stopFireworks()
  fireworks = []

  drawStatus.value = 'idle'
  drawnCount.value = 0
  winners.value = []
  particles = []
  speedLines = []
}

// 切换奖项
function selectPrize(prize) {
  if (drawStatus.value !== 'idle') return // 抽奖中不允许切换
  currentPrize.value = prize
  totalCount.value = prize.count
  showPrizeSelector.value = false
}

// 音频播放相关
let audioElements = { start: null, end: null }

/**
 * 播放音频
 * @param {string} type - 音频类型: 'start' 或 'end'
 */
function playSound(type) {
  try {
    // 如果已有相同类型的音频在播放，先停止
    if (audioElements[type]) {
      audioElements[type].pause()
      audioElements[type].currentTime = 0
    }

    // 从 public/audio/ 目录加载音频
    audioElements[type] = new Audio(`/audio/${type}.mp3`)
    audioElements[type].volume = 0.8 // 设置音量 80%
    audioElements[type].play()
  } catch (error) {
    console.error(`播放${type}音频失败:`, error)
  }
}

/**
 * 停止所有音频
 */
function stopAllSounds() {
  Object.keys(audioElements).forEach(key => {
    if (audioElements[key]) {
      audioElements[key].pause()
      audioElements[key].currentTime = 0
    }
  })
}

// 返回后台
function goBack() {
  emit('back')
}

onMounted(() => {
  document.documentElement.classList.add('dark')
  setTimeout(() => {
    initCanvas()
  }, 100)
})

onUnmounted(() => {
  document.documentElement.classList.remove('dark')

  // 停止所有音频
  stopAllSounds()

  // 停止烟花
  stopFireworks()
  fireworks = []

  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  if (fireworkAnimationId) {
    cancelAnimationFrame(fireworkAnimationId)
  }

  window.removeEventListener('resize', resizeCanvas)
  window.removeEventListener('resize', resizeFireworkCanvas)
})
</script>

<template>
  <div class="sphere-screen">
    <!-- 动态背景层 -->
    <div class="dynamic-bg">
      <!-- 放射状渐变 -->
      <div class="radial-gradient"></div>
    </div>

    <!-- Canvas 粒子层 -->
    <canvas id="particle-canvas" class="particle-canvas"></canvas>

    <!-- 顶部控制栏 -->
    <header class="screen-header">
      <div class="prize-info">
        <div class="prize-title">{{ currentPrize.name }}</div>
        <div class="prize-subtitle">{{ currentPrize.subtitle }}</div>
      </div>

      <div class="draw-counter">
        <span class="counter-label">中奖人数:</span>
        <span class="counter-value">{{ drawnCount }}/{{ totalCount }}</span>
      </div>
    </header>

    <!-- 主要内容区域 -->
    <main class="screen-main">
      <!-- 待抽奖状态：显示礼盒 -->
      <transition name="fade">
        <div v-if="drawStatus === 'idle'" class="gift-container">
          <div class="gift-box">
            <div class="gift-glow"></div>
            <div class="gift-icon">🎁</div>
          </div>
          <div class="draw-info">
            <div class="draw-text">一次抽取 {{ currentPrize.count }} 人</div>
          </div>
        </div>
      </transition>

      <!-- 中奖结果 -->
      <transition name="result-fade">
        <div v-if="drawStatus === 'result'" class="result-container" :class="winnersLayoutType">
          <!-- 展示模式（≤10人）：大卡片居中金光闪闪 -->
          <template v-if="winnersLayoutType === 'showcase'">
            <div class="showcase-winners">
              <div
                v-for="(name, index) in winners"
                :key="index"
                class="showcase-card"
                :class="{ 'is-grand-prize': currentPrize.name === '特等奖' }"
                :style="{
                  background: prizeLevelStyle.gradient,
                  '--glow-color': prizeLevelStyle.glow,
                  animationDelay: `${index * 0.15}s`
                }"
              >
                <span class="winner-name-large">{{ name }}</span>
                <div class="card-shine"></div>
              </div>
            </div>
          </template>

          <!-- 网格模式（>10人）：紧凑卡片 -->
          <template v-else>
            <div class="compact-grid">
              <div
                v-for="(name, index) in winners"
                :key="index"
                class="compact-card"
                :style="{ animationDelay: `${index * 0.02}s` }"
              >
                {{ name }}
              </div>
            </div>
          </template>
        </div>
      </transition>
    </main>

    <!-- 烟花 Canvas -->
    <canvas id="firework-canvas" class="firework-canvas"></canvas>

    <!-- 弹幕层 -->
    <div v-if="drawStatus === 'result'" class="danmaku-container">
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
        <!-- 中间主按钮 -->
        <button
          v-if="drawStatus === 'idle'"
          class="main-btn draw-btn"
          @click="startDraw"
        >
          开始抽奖
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
          奖品已抽完
        </button>
      </div>
    </footer>

    <!-- 奖项选择器（左下角） -->
    <div class="prize-selector" :class="{ active: showPrizeSelector }">
      <button
        class="prize-selector-btn"
        @click="showPrizeSelector = !showPrizeSelector"
        :disabled="drawStatus !== 'idle'"
      >
        <span class="prize-selector-label">{{ currentPrize.name }}</span>
        <span class="prize-selector-icon">{{ showPrizeSelector ? '▲' : '▼' }}</span>
      </button>

      <transition name="prize-options">
        <div v-if="showPrizeSelector" class="prize-options">
          <button
            v-for="(prize, index) in prizeOptions"
            :key="index"
            class="prize-option"
            :class="{ selected: prize.name === currentPrize.name }"
            @click="selectPrize(prize)"
          >
            <div class="prize-option-name">{{ prize.name }}</div>
            <div class="prize-option-subtitle">{{ prize.subtitle }}</div>
          </button>
        </div>
      </transition>
    </div>

    <!-- 返回后台按钮（右下角） -->
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

/* 动态背景层 */
.dynamic-bg {
  position: absolute;
  inset: 0;
  z-index: 1;
}

/* 放射状渐变背景 */
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

/* Canvas 粒子层 */
.particle-canvas {
  position: absolute;
  inset: 0;
  z-index: 150;
  pointer-events: none;
  /* display: none; */ /* 恢复显示 */
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

.draw-counter {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: rgba(0, 0, 0, 0.4);
  border: 2px solid #FFD700;
  border-radius: 50px;
  backdrop-filter: blur(10px);
  margin-left: auto;
}

.counter-label {
  color: rgba(255, 215, 0, 0.8);
  font-size: 0.95rem;
}

.counter-value {
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

/* 淡入淡出动画 */
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

/* ========== 展示模式（5人及以下）：大卡片居中 ========== */
.showcase-winners {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2rem;
  max-width: 90%;
  margin-top: 2rem;
}

.showcase-card {
  position: relative;
  display: flex;
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

/* 特等奖特殊样式 - 字体大一倍且居中 */
.showcase-card.is-grand-prize {
  min-width: 600px;
  min-height: 250px;
  padding: 4rem 5rem;
  border-width: 5px;
  transform: translateY(30px); /* 整体往下偏移 */
}

.showcase-card.is-grand-prize .winner-name-large {
  font-size: 7rem;
  line-height: 1.1;
  text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3), 0 0 40px rgba(255, 215, 0, 0.5);
}

.showcase-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%);
  pointer-events: none;
}

.winner-name-large {
  font-size: 3.5rem;
  font-weight: 900;
  color: #8B0000;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  letter-spacing: 0.1em;
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

/* ========== 网格模式（>10人）：紧凑卡片 ========== */
.compact-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
  max-width: 90%;
  margin-top: 1rem;
}

.compact-card {
  padding: 0.6rem 1rem;
  background: transparent;
  border: 2px solid rgba(255, 215, 0, 0.6);
  border-radius: 10px;
  color: #FFD700;
  font-weight: 700;
  font-size: 1rem;
  text-align: center;
  box-shadow: 0 4px 15px rgba(255, 215, 0, 0.2);
  animation: compact-appear 0.4s ease-out backwards;
  transition: all 0.3s ease;
}

.compact-card:hover {
  transform: translateY(-3px) scale(1.02);
  box-shadow: 0 8px 25px rgba(255, 215, 0, 0.4);
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.35), rgba(255, 140, 0, 0.35));
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

/* ========== 烟花 Canvas ========== */
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

.draw-btn {
  background: linear-gradient(135deg, #FFD700, #FFA500);
  color: #8B0000;
}

.draw-btn:hover {
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

/* 奖项选择器（左下角） */
.prize-selector {
  position: fixed;
  bottom: 2rem;
  left: 2rem;
  z-index: 200;
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
  min-width: 150px;
}

.prize-selector-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.8);
  box-shadow: 0 0 30px rgba(255, 215, 0, 0.5);
  transform: translateY(-2px);
}

.prize-selector-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.prize-selector-label {
  flex: 1;
  text-align: left;
}

.prize-selector-icon {
  font-size: 0.8rem;
  transition: transform 0.3s;
}

.prize-selector.active .prize-selector-icon {
  transform: rotate(180deg);
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
  min-width: 200px;
}

.prize-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 1rem 1.5rem;
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
  font-weight: 900;
  font-size: 1.2rem;
  margin-bottom: 0.25rem;
}

.prize-option-subtitle {
  font-size: 0.9rem;
  color: rgba(255, 215, 0, 0.7);
}

/* 下拉选项动画 */
.prize-options-enter-active,
.prize-options-leave-active {
  transition: all 0.3s ease;
}

.prize-options-enter-from,
.prize-options-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* 返回后台按钮（右下角） */
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

/* 响应式 */
@media (max-width: 1400px) {
  .compact-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
}

@media (max-width: 1024px) {
  .showcase-card {
    padding: 1.5rem 2rem;
  }

  .winner-name-large {
    font-size: 2.5rem;
  }

  .showcase-card.is-grand-prize {
    min-width: 500px;
    min-height: 200px;
    padding: 3rem 4rem;
    transform: translateY(20px);
  }

  .showcase-card.is-grand-prize .winner-name-large {
    font-size: 5rem;
  }
}

@media (max-width: 768px) {
  .screen-header {
    padding: 1rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .showcase-winners {
    gap: 1rem;
  }

  .showcase-card {
    padding: 1rem 1.5rem;
    width: 100%;
    max-width: 300px;
  }

  .winner-name-large {
    font-size: 2rem;
  }

  .showcase-card.is-grand-prize {
    min-width: 350px;
    min-height: 150px;
    padding: 2rem 2.5rem;
    transform: translateY(15px);
  }

  .showcase-card.is-grand-prize .winner-name-large {
    font-size: 3.5rem;
  }

  .compact-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 0.5rem;
  }

  .compact-card {
    font-size: 0.9rem;
    padding: 0.5rem 0.75rem;
  }

  .gift-icon {
    font-size: 10rem;
  }
}

/* ========== 弹幕效果 ========== */
.danmaku-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 25%; /* 只有屏幕上方 1/4 区域 */
  z-index: 300; /* 在结果层之上 */
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
    transform: translateX(-150vw); /* 移动到屏幕左侧外 */
  }
}
</style>
