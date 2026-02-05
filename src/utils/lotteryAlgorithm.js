/**
 * 年会抽奖系统 - 公平抽奖算法模块
 * 提供随机抽取算法
 */

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
 * 统一的抽奖入口函数
 * @param {Array} participants - 参与人员数组
 * @param {number} count - 抽取人数
 * @returns {Array} 抽中的中奖人员数组
 */
export function draw(participants, count) {
  return randomDraw(participants, count)
}

/**
 * 获取抽奖算法的说明信息
 * @returns {string} 算法说明
 */
export function getAlgorithmInfo() {
  return '随机抽取：所有候选人概率相等'
}

/**
 * 验证抽奖结果的公平性
 * @param {Array} participants - 原始参与人员
 * @param {Array} winners - 中奖人员
 * @returns {Object} 验证结果
 */
export function validateDrawResult(participants, winners) {
  // 检查是否有重复中奖
  const winnerIds = winners.map(w => w.id)
  const uniqueIds = new Set(winnerIds)
  if (winnerIds.length !== uniqueIds.size) {
    return {
      isValid: false,
      reason: '存在重复中奖人员'
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
