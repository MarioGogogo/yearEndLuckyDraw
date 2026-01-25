/**
 * 年会抽奖系统 - 公平抽奖算法模块
 * 提供随机抽取和加权抽取算法
 */

import { loadSettings } from './lotteryStorage'

/**
 * 使用 Web Crypto API 生成密码学安全的随机数
 * 比 Math.random() 更公平、更安全
 * @param {number} max - 随机数上限（不包含）
 * @returns {number} 0 到 max-1 之间的随机整数
 */
function secureRandom(max) {
  const randomBuffer = new Uint32Array(1)
  crypto.getRandomValues(randomBuffer)
  // 使用模运算可能存在微小偏差，但对于抽奖场景可忽略
  return randomBuffer[0] % max
}

/**
 * Fisher-Yates 洗牌算法（使用安全随机数）
 * 彻底打乱数组，确保公平性
 * @param {Array} array - 要打乱的数组
 * @returns {Array} 打乱后的新数组
 */
function secureShuffle(array) {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = secureRandom(i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * 计算部门的默认权重
 * 部门人数越少，权重越高（让小部门有更多中奖机会）
 * @param {string} department - 部门名称
 * @param {Array} participants - 所有参与人员
 * @param {number} baseWeight - 基础权重
 * @returns {number} 计算后的权重
 */
function getDepartmentWeight(department, participants, baseWeight = 1) {
  const deptCount = participants.filter(p => p.department === department).length
  const totalCount = participants.length

  if (deptCount === 0) return baseWeight

  // 权重 = 基础权重 * (总人数 / 部门人数) 的平方根
  // 这样既考虑了部门人数，又不会让权重差异过大
  const weight = baseWeight * Math.sqrt(totalCount / deptCount)

  return Math.round(weight * 100) / 100
}

/**
 * 计算职级的默认权重
 * 根据职级设定不同的权重
 * @param {string} position - 职级名称
 * @returns {number} 职级权重
 */
function getPositionWeight(position) {
  // 职级权重配置（可根据实际需求调整）
  const positionWeights = {
    '实习生': 1.5,
    '初级': 1.2,
    '中级': 1.0,
    '高级': 0.8,
    '资深': 0.6,
    '专家': 0.4,
    '主管': 0.8,
    '经理': 0.6,
    '总监': 0.4,
    '副总裁': 0.2,
    '总裁': 0.1
  }

  // 模糊匹配职级
  const lowerPos = (position || '').toLowerCase()
  for (const [key, weight] of Object.entries(positionWeights)) {
    if (lowerPos.includes(key.toLowerCase())) {
      return weight
    }
  }

  return 1.0 // 默认权重
}

/**
 * 构建加权轮盘赌的累加权重数组
 * @param {Array} participants - 参与人员
 * @param {string} weightBy - 权重依据 ('department' | 'position')
 * @returns {Array} 累加权重数组 [{ participant, cumulativeWeight, weight }]
 */
function buildWeightedPool(participants, weightBy) {
  const pool = []
  let cumulativeWeight = 0

  participants.forEach(person => {
    let weight = 1.0

    if (weightBy === 'department') {
      weight = getDepartmentWeight(person.department, participants)
    } else if (weightBy === 'position') {
      weight = getPositionWeight(person.position || person.jobTitle)
    }

    cumulativeWeight += weight
    pool.push({
      participant: person,
      cumulativeWeight,
      weight
    })
  })

  return pool
}

/**
 * 从加权池中随机抽取一个人
 * @param {Array} weightedPool - 加权池数组
 * @param {number} totalWeight - 总权重
 * @returns {Object} 抽中的人员
 */
function weightedSelect(weightedPool, totalWeight) {
  const randomValue = secureRandom(Math.floor(totalWeight * 100)) / 100

  // 二分查找快速定位
  let left = 0
  let right = weightedPool.length - 1

  while (left < right) {
    const mid = Math.floor((left + right) / 2)
    if (weightedPool[mid].cumulativeWeight < randomValue) {
      left = mid + 1
    } else {
      right = mid
    }
  }

  return weightedPool[left].participant
}

/**
 * 随机抽取算法（等概率）
 * 使用安全的随机数和洗牌算法
 * @param {Array} participants - 参与人员数组
 * @param {number} count - 抽取人数
 * @returns {Array} 抽中的中奖人员数组
 */
export function randomDraw(participants, count) {
  if (!participants || participants.length === 0) {
    return []
  }

  if (count >= participants.length) {
    // 如果抽取人数大于等于总人数，返回所有人员
    return [...participants]
  }

  // 使用 Fisher-Yates 洗牌后取前 count 个
  const shuffled = secureShuffle(participants)
  return shuffled.slice(0, count)
}

/**
 * 加权抽取算法
 * 根据部门或职级分配不同权重进行抽取
 * @param {Array} participants - 参与人员数组
 * @param {number} count - 抽取人数
 * @param {string} weightBy - 权重依据 ('department' | 'position')
 * @returns {Array} 抽中的中奖人员数组
 */
export function weightedDraw(participants, count, weightBy = 'department') {
  if (!participants || participants.length === 0) {
    return []
  }

  if (count >= participants.length) {
    return [...participants]
  }

  const winners = []
  const remaining = [...participants]

  for (let i = 0; i < count; i++) {
    if (remaining.length === 0) break

    // 构建当前剩余人员的加权池
    const weightedPool = buildWeightedPool(remaining, weightBy)
    const totalWeight = weightedPool[weightedPool.length - 1].cumulativeWeight

    // 抽取
    const winner = weightedSelect(weightedPool, totalWeight)

    // 移除已中奖人员（避免重复中奖）
    const removeIndex = remaining.findIndex(p => p.id === winner.id)
    if (removeIndex !== -1) {
      remaining.splice(removeIndex, 1)
    }

    winners.push(winner)
  }

  return winners
}

/**
 * 统一的抽奖入口函数
 * 根据系统设置自动选择算法
 * @param {Array} participants - 参与人员数组
 * @param {number} count - 抽取人数
 * @param {Object} settings - 系统设置（可选，默认从缓存读取）
 * @returns {Array} 抽中的中奖人员数组
 */
export function draw(participants, count, settings = null) {
  const finalSettings = settings || loadSettings()

  // 如果未配置设置，使用随机抽取
  if (!finalSettings || !finalSettings.drawMode) {
    return randomDraw(participants, count)
  }

  // 根据设置选择算法
  if (finalSettings.drawMode === 'weighted' && finalSettings.weightedBy) {
    return weightedDraw(participants, count, finalSettings.weightedBy)
  }

  // 默认使用随机抽取
  return randomDraw(participants, count)
}

/**
 * 获取抽奖算法的说明信息
 * @param {Object} settings - 系统设置
 * @returns {string} 算法说明
 */
export function getAlgorithmInfo(settings = null) {
  const finalSettings = settings || loadSettings()

  if (!finalSettings) {
    return '随机抽取：所有候选人概率相等'
  }

  if (finalSettings.drawMode === 'weighted') {
    const byText = finalSettings.weightedBy === 'department' ? '部门' : '职级'
    return `加权抽取：按${byText}分配权重，部门/职级越小权重越高`
  }

  return '随机抽取：所有候选人概率相等'
}

/**
 * 验证抽奖结果的公平性
 * @param {Array} participants - 原始参与人员
 * @param {Array} winners - 中奖人员
 * @param {Object} settings - 系统设置
 * @returns {Object} 验证结果
 */
export function validateDrawResult(participants, winners, settings = null) {
  const finalSettings = settings || loadSettings()

  // 检查是否有重复中奖（不允许重复中奖的情况下）
  if (!finalSettings?.allowRepeatWins) {
    const winnerIds = winners.map(w => w.id)
    const uniqueIds = new Set(winnerIds)
    if (winnerIds.length !== uniqueIds.size) {
      return {
        isValid: false,
        reason: '存在重复中奖人员'
      }
    }
  }

  // 检查中奖人员是否在原始名单中
  const participantIds = new Set(participants.map(p => p.id))
  for (const winner of winners) {
    if (!participantIds.has(winner.id)) {
      return {
        isValid: false,
        reason: `中奖人员 ${winner.name} 不在原始名单中`
      }
    }
  }

  return {
    isValid: true,
    winnerCount: winners.length,
    totalParticipants: participants.length
  }
}

/**
 * 获取部门统计信息
 * @param {Array} participants - 参与人员数组
 * @returns {Object} 部门统计 { 部门名称: 人数 }
 */
export function getDepartmentStats(participants) {
  const stats = {}
  participants.forEach(p => {
    const dept = p.department || '未分类'
    stats[dept] = (stats[dept] || 0) + 1
  })
  return stats
}

/**
 * 获取职级统计信息
 * @param {Array} participants - 参与人员数组
 * @returns {Object} 职级统计 { 职级名称: 人数 }
 */
export function getPositionStats(participants) {
  const stats = {}
  participants.forEach(p => {
    const pos = p.position || p.jobTitle || '未分类'
    stats[pos] = (stats[pos] || 0) + 1
  })
  return stats
}
