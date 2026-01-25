/**
 * 年会抽奖系统 - 缓存管理模块
 * 负责所有数据的本地存储和读取
 */

// 缓存 Key 常量定义
const STORAGE_KEYS = {
  // 人员名单（含中奖状态）
  PARTICIPANTS: 'lottery_participants',

  // 奖项配置
  PRIZES: 'lottery_prizes',

  // 全局系统设置
  SETTINGS: 'lottery_settings',

  // 中奖记录
  WINNER_RECORDS: 'lottery_winner_records',

  // 完整系统数据（包含以上所有）
  SYSTEM_DATA: 'lottery_system_data'
}

/**
 * 加载参与人员名单
 * @returns {Array} 参与人员数组
 */
export function loadParticipants() {
  try {
    // 优先使用新的缓存 key
    const cached = localStorage.getItem(STORAGE_KEYS.PARTICIPANTS)
    if (cached) {
      return JSON.parse(cached)
    }
    // 兼容旧版本的缓存 key (如果之前有的话)
    return []
  } catch (e) {
    console.error('加载参与人员失败:', e)
    return []
  }
}

/**
 * 保存参与人员名单
 * @param {Array} participants - 参与人员数组
 */
export function saveParticipants(participants) {
  try {
    localStorage.setItem(STORAGE_KEYS.PARTICIPANTS, JSON.stringify(participants))
  } catch (e) {
    console.error('保存参与人员失败:', e)
  }
}

/**
 * 加载奖项配置
 * @returns {Array} 奖项配置数组
 */
export function loadPrizes() {
  try {
    // 优先使用新的缓存 key
    const cached = localStorage.getItem(STORAGE_KEYS.PRIZES)
    if (cached) {
      return JSON.parse(cached)
    }
    // 兼容旧版本的缓存 key
    const oldCached = localStorage.getItem('lottery_config')
    if (oldCached) {
      const oldData = JSON.parse(oldCached)
      if (oldData.prizes && oldData.prizes.length > 0) {
        // 迁移旧数据到新缓存
        savePrizes(oldData.prizes)
        return oldData.prizes
      }
    }
    return []
  } catch (e) {
    console.error('加载奖项配置失败:', e)
    return []
  }
}

/**
 * 保存奖项配置
 * @param {Array} prizes - 奖项配置数组
 */
export function savePrizes(prizes) {
  try {
    localStorage.setItem(STORAGE_KEYS.PRIZES, JSON.stringify(prizes))
  } catch (e) {
    console.error('保存奖项配置失败:', e)
  }
}

/**
 * 加载全局设置
 * @returns {Object} 全局设置对象
 */
export function loadSettings() {
  try {
    const cached = localStorage.getItem(STORAGE_KEYS.SETTINGS)
    if (cached) {
      return JSON.parse(cached)
    }
    return null
  } catch (e) {
    console.error('加载全局设置失败:', e)
    return null
  }
}

/**
 * 保存全局设置
 * @param {Object} settings - 全局设置对象
 */
export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
  } catch (e) {
    console.error('保存全局设置失败:', e)
  }
}

/**
 * 加载中奖记录
 * @returns {Array} 中奖记录数组
 */
export function loadWinnerRecords() {
  try {
    const cached = localStorage.getItem(STORAGE_KEYS.WINNER_RECORDS)
    if (cached) {
      return JSON.parse(cached)
    }
    return []
  } catch (e) {
    console.error('加载中奖记录失败:', e)
    return []
  }
}

/**
 * 保存中奖记录
 * @param {Array} records - 中奖记录数组
 */
export function saveWinnerRecords(records) {
  try {
    localStorage.setItem(STORAGE_KEYS.WINNER_RECORDS, JSON.stringify(records))
  } catch (e) {
    console.error('保存中奖记录失败:', e)
  }
}

/**
 * 添加中奖记录
 * @param {Object} winner - 中奖人员信息
 * @param {Object} prize - 奖项信息
 */
export function addWinnerRecord(winner, prize) {
  const records = loadWinnerRecords()
  const newRecord = {
    id: Date.now(),
    winnerId: winner.id,
    winnerName: winner.name,
    winnerDept: winner.department,
    winnerAvatar: winner.avatar || null,
    prizeId: prize.id,
    prizeName: prize.name,
    prizeLevel: prize.level || 0,
    drawTime: new Date().toISOString()
  }
  records.unshift(newRecord)
  saveWinnerRecords(records)
  return newRecord
}

/**
 * 加载完整的系统数据
 * 用于大屏初始化时一次性加载所有配置
 * @returns {Object} 系统数据对象
 */
export function loadSystemData() {
  try {
    const cached = localStorage.getItem(STORAGE_KEYS.SYSTEM_DATA)
    if (cached) {
      return JSON.parse(cached)
    }
    return null
  } catch (e) {
    console.error('加载系统数据失败:', e)
    return null
  }
}

/**
 * 保存完整的系统数据
 * 用于一次性保存所有配置
 * @param {Object} systemData - 系统数据对象
 */
export function saveSystemData(systemData) {
  try {
    localStorage.setItem(STORAGE_KEYS.SYSTEM_DATA, JSON.stringify(systemData))
  } catch (e) {
    console.error('保存系统数据失败:', e)
  }
}

/**
 * 检查系统是否已配置
 * @returns {Object} 检查结果 { isReady: boolean, missingItems: string[] }
 */
export function checkSystemReady() {
  const missingItems = []

  // 检查参与人员
  const participants = loadParticipants()
  if (!participants || participants.length === 0) {
    missingItems.push('参与人员名单')
  }

  // 检查奖项配置
  const prizes = loadPrizes()
  if (!prizes || prizes.length === 0) {
    missingItems.push('奖项配置')
  }

  return {
    isReady: missingItems.length === 0,
    missingItems
  }
}

/**
 * 获取待抽奖人员列表
 * 根据设置决定是否过滤已中奖人员
 * @returns {Array} 待抽奖人员数组
 */
export function getEligibleParticipants() {
  const settings = loadSettings()
  const participants = loadParticipants()

  // 如果允许重复中奖，返回所有人
  if (settings?.allowRepeatWins) {
    return participants
  }

  // 否则只返回未中奖的人员
  return participants.filter(p => p.status !== 'won')
}

/**
 * 更新人员中奖状态
 * @param {string|number} personId - 人员ID
 * @param {string} status - 新状态 ('pending' | 'won')
 */
export function updateParticipantStatus(personId, status) {
  const participants = loadParticipants()
  const index = participants.findIndex(p => p.id === personId)

  if (index !== -1) {
    participants[index].status = status
    participants[index].winTime = status === 'won' ? new Date().toISOString() : null
    saveParticipants(participants)
  }
}

/**
 * 重置所有人员状态
 */
export function resetAllParticipants() {
  const participants = loadParticipants()
  participants.forEach(p => {
    p.status = 'pending'
    p.winTime = null
  })
  saveParticipants(participants)
}

/**
 * 清除所有缓存数据
 */
export function clearAllData() {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key)
  })
}

/**
 * 导出系统数据（用于备份）
 * @returns {Object} 完整系统数据
 */
export function exportSystemData() {
  return {
    version: '1.0.0',
    exportTime: new Date().toISOString(),
    participants: loadParticipants(),
    prizes: loadPrizes(),
    settings: loadSettings(),
    winnerRecords: loadWinnerRecords()
  }
}

/**
 * 导入系统数据（用于恢复）
 * @param {Object} data - 系统数据对象
 */
export function importSystemData(data) {
  if (data.participants) {
    saveParticipants(data.participants)
  }
  if (data.prizes) {
    savePrizes(data.prizes)
  }
  if (data.settings) {
    saveSettings(data.settings)
  }
  if (data.winnerRecords) {
    saveWinnerRecords(data.winnerRecords)
  }
}

export { STORAGE_KEYS }

/**
 * 获取某个奖项的已抽取数量
 * @param {string|number} prizeId - 奖项ID
 * @returns {number} 已抽取的中奖人数
 */
export function getPrizeDrawCount(prizeId) {
  const records = loadWinnerRecords()
  return records.filter(r => r.prizeId === prizeId).length
}

/**
 * 判断奖项是否已抽取完毕
 * @param {Object} prize - 奖项对象
 * @returns {boolean} 是否已抽完
 */
export function isPrizeCompleted(prize) {
  if (!prize || !prize.id) return true
  const drawCount = getPrizeDrawCount(prize.id)
  return drawCount >= prize.count
}

/**
 * 根据奖项名称删除该奖项的所有中奖记录并重置相关人员状态
 * @param {string} prizeName - 奖项名称
 * @returns {Object} 操作结果 { deletedCount: number, participantsReset: number }
 */
export function deleteWinnersByPrizeName(prizeName) {
  const records = loadWinnerRecords()
  const prizeRecords = records.filter(r => r.prizeName === prizeName)

  // 1. 重置相关中奖人的参与状态
  const participants = loadParticipants()
  let participantsReset = 0

  prizeRecords.forEach(record => {
    const participantIndex = participants.findIndex(p =>
      p.id === record.winnerId ||
      (p.name === record.winnerName && p.department === record.winnerDept)
    )
    if (participantIndex !== -1) {
      participants[participantIndex].status = 'pending'
      participants[participantIndex].winTime = null
      participantsReset++
    }
  })
  saveParticipants(participants)

  // 2. 删除该奖项的所有中奖记录
  const remainingRecords = records.filter(r => r.prizeName !== prizeName)
  saveWinnerRecords(remainingRecords)

  return {
    deletedCount: prizeRecords.length,
    participantsReset
  }
}
