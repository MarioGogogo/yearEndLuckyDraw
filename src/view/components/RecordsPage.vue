<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as XLSX from 'xlsx'

// 导入缓存管理和抽奖算法模块
import {
  loadParticipants,
  saveParticipants,
  loadWinnerRecords,
  saveWinnerRecords,
  deleteWinnersByPrizeName
} from '../../utils/lotteryStorage'

// 缓存 key
const STORAGE_KEY = 'lottery_winner_records'

// ========== 自定义弹窗状态 ==========
const showModal = ref(false)
const modalType = ref('confirm') // confirm | alert
const modalTitle = ref('')
const modalMessage = ref('')
const modalOnConfirm = ref(null)
const modalLoading = ref(false)

// 显示确认弹窗
function showConfirmModal(title, message, onConfirm) {
  modalType.value = 'confirm'
  modalTitle.value = title
  modalMessage.value = message
  modalOnConfirm.value = onConfirm
  showModal.value = true
}

// 显示提示弹窗
function showAlertModal(title, message) {
  modalType.value = 'alert'
  modalTitle.value = title
  modalMessage.value = message
  modalOnConfirm.value = null
  showModal.value = true
}

// 弹窗确认
function handleModalConfirm() {
  if (modalOnConfirm.value) {
    modalLoading.value = true
    modalOnConfirm.value()
    modalLoading.value = false
  }
  showModal.value = false
}

// 弹窗取消/关闭
function handleModalClose() {
  showModal.value = false
}

// 本地状态（初始为空，从缓存加载）
const records = ref([])
const isLoading = ref(false)

// 搜索/筛选
const searchQuery = ref('')
const statusFilter = ref('all')
const prizeFilter = ref('all')

// 分页配置
const PAGE_SIZE = 10
const currentPage = ref(1)

// 下拉框状态
const prizeDropdownOpen = ref(false)
const statusDropdownOpen = ref(false)

function togglePrizeDropdown() {
  prizeDropdownOpen.value = !prizeDropdownOpen.value
  if (prizeDropdownOpen.value) statusDropdownOpen.value = false
}

function toggleStatusDropdown() {
  statusDropdownOpen.value = !statusDropdownOpen.value
  if (statusDropdownOpen.value) prizeDropdownOpen.value = false
}

function selectPrize(value) {
  prizeFilter.value = value
  prizeDropdownOpen.value = false
}

function selectStatus(value) {
  statusFilter.value = value
  statusDropdownOpen.value = false
}

// 按奖项清空记录的状态
const showClearPrizeModal = ref(false)
const selectedPrizeToClear = ref('')
const clearPrizeLoading = ref(false)
const clearPrizeDropdownOpen = ref(false)

function toggleClearPrizeDropdown() {
  clearPrizeDropdownOpen.value = !clearPrizeDropdownOpen.value
}

function selectClearPrize(name) {
  selectedPrizeToClear.value = name
  clearPrizeDropdownOpen.value = false
}

// 计算下拉菜单位置
const clearDropdownStyle = ref({})

function updateClearDropdownPosition() {
  const trigger = document.querySelector('.clear-prize-dropdown-trigger')
  if (trigger) {
    const rect = trigger.getBoundingClientRect()
    clearDropdownStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 8}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      maxHeight: '200px',
      overflowY: 'auto',
      zIndex: 10000
    }
  }
}

watch(clearPrizeDropdownOpen, (val) => {
  if (val) {
    nextTick(() => updateClearDropdownPosition())
  }
})

// 一键清空所有中奖记录和状态
function clearAllWinnerRecords() {
  showConfirmModal(
    '清空所有中奖记录',
    '确定要清空所有中奖记录并将所有中奖人重置为待抽奖状态吗？此操作将清除所有中奖数据，且无法撤销。',
    () => {
      // 1. 重置所有参与人员的状态
      const participants = loadParticipants()
      let resetCount = 0
      participants.forEach(p => {
        if (p.status === 'won') {
          p.status = 'pending'
          p.winTime = null
          resetCount++
        }
      })
      saveParticipants(participants)

      // 2. 清空中奖记录
      saveWinnerRecords([])

      showAlertModal(
        '清空成功',
        `已重置 ${resetCount} 位中奖人的状态，并清空所有中奖记录`
      )
      loadFromCache() // 刷新列表
    }
  )
}

function confirmClearPrizeRecords() {
  if (!selectedPrizeToClear.value) return

  clearPrizeLoading.value = true
  try {
    const result = deleteWinnersByPrizeName(selectedPrizeToClear.value)
    showAlertModal(
      '清空成功',
      `已删除 ${result.deletedCount} 条中奖记录，${result.participantsReset} 位中奖人已重置为待抽奖状态`
    )
    loadFromCache() // 刷新列表
  } catch (e) {
    showAlertModal('操作失败', '清空记录时发生错误')
  } finally {
    clearPrizeLoading.value = false
    showClearPrizeModal.value = false
    selectedPrizeToClear.value = ''
  }
}

const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'claimed', label: '已领取' },
  { value: 'pending', label: '待领取' },
  { value: 'expired', label: '已过期' }
]

// 加载缓存
function loadFromCache() {
  try {
    const cached = localStorage.getItem(STORAGE_KEY)
    if (cached) {
      records.value = JSON.parse(cached)
    }
  } catch (e) {
    console.error('加载缓存失败:', e)
  }
}

// 保存缓存
function saveToCache() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records.value))
  } catch (e) {
    console.error('保存缓存失败:', e)
  }
}

// 统计数据
const totalRecords = computed(() => filteredRecords.value.length)

const claimedCount = computed(() =>
  filteredRecords.value.filter(r => r.status === 'claimed').length
)

const pendingCount = computed(() =>
  filteredRecords.value.filter(r => r.status === 'pending').length
)

const expiredCount = computed(() =>
  filteredRecords.value.filter(r => r.status === 'expired').length
)

const claimedRate = computed(() => {
  if (totalRecords.value === 0) return 0
  return ((claimedCount.value / totalRecords.value) * 100).toFixed(1)
})

// 获取所有奖项名称（用于筛选）
const prizeNames = computed(() => {
  const names = [...new Set(records.value.map(r => r.prizeName))]
  return names.sort()
})

// 筛选后的记录
const filteredRecords = computed(() => {
  let result = records.value

  // 搜索筛选
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(r =>
      r.winnerName.toLowerCase().includes(query) ||
      r.winnerDept.toLowerCase().includes(query) ||
      r.prizeName.toLowerCase().includes(query)
    )
  }

  // 状态筛选
  if (statusFilter.value !== 'all') {
    result = result.filter(r => r.status === statusFilter.value)
  }

  // 奖项筛选
  if (prizeFilter.value !== 'all') {
    result = result.filter(r => r.prizeName === prizeFilter.value)
  }

  return result
})

// 计算总页数
const totalPages = computed(() => Math.ceil(filteredRecords.value.length / PAGE_SIZE))

// 当前页的数据
const currentPageData = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE
  return filteredRecords.value.slice(start, end)
})

// 当前页显示的起始和结束索引
const pageStart = computed(() => (currentPage.value - 1) * PAGE_SIZE + 1)

const pageEnd = computed(() => Math.min(currentPage.value * PAGE_SIZE, filteredRecords.value.length))

// 获取状态类名
function getStatusClass(status) {
  const statusMap = {
    claimed: 'status-claimed',
    pending: 'status-pending',
    expired: 'status-expired'
  }
  return statusMap[status] || 'status-pending'
}

function getStatusText(status) {
  const textMap = {
    claimed: '已领取',
    pending: '待领取',
    expired: '已过期'
  }
  return textMap[status] || '待领取'
}

// 获取奖品稀有度颜色
function getRarityClass(prizeName) {
  if (prizeName.includes('特等奖')) return 'rarity-legendary'
  if (prizeName.includes('一等奖')) return 'rarity-epic'
  if (prizeName.includes('二等奖')) return 'rarity-rare'
  return 'rarity-common'
}

// 分页函数
function goToPage(page) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

// 重置筛选
function resetFilters() {
  searchQuery.value = ''
  statusFilter.value = 'all'
  prizeFilter.value = 'all'
  currentPage.value = 1
}

// 导出记录
function exportRecords() {
  const data = currentPageData.value.map(r => ({
    奖项名称: r.prizeName,
    中奖人: r.winnerName,
    部门: r.winnerDept,
    联系方式: r.winnerContact,
    抽奖时间: r.drawTime,
    状态: getStatusText(r.status),
    领取时间: r.claimedTime || '-'
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '中奖记录')

  XLSX.writeFile(workbook, `中奖记录_${new Date().toLocaleDateString()}.xlsx`)
}

// 重置中奖人参与状态
function resetParticipantStatus(record) {
  showConfirmModal(
    '重置参与状态',
    `确定要将 "${record.winnerName}" 的参与状态重置为待抽奖吗？\n\n注意：此操作将从中奖名单中移除该记录，且无法撤销。`,
    () => {
      // 1. 更新参与人员状态为待抽奖
      const participants = loadParticipants()
      const participantIndex = participants.findIndex(p =>
        p.name === record.winnerName && p.department === record.winnerDept
      )

      if (participantIndex !== -1) {
        participants[participantIndex].status = 'pending'
        participants[participantIndex].winTime = null
        saveParticipants(participants)
      }

      // 2. 从当前中奖记录列表中移除该记录
      records.value = records.value.filter(r => r.id !== record.id)
      saveToCache()

      showAlertModal('操作成功', `已将 "${record.winnerName}" 重置为待抽奖状态，并从名单中移除`)
    }
  )
}

// 初始化
onMounted(() => {
  loadFromCache()
  document.addEventListener('click', handleOutsideClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
})

function handleOutsideClick(e) {
  const dropdown = e.target.closest('.custom-dropdown')
  if (!dropdown) {
    prizeDropdownOpen.value = false
    statusDropdownOpen.value = false
    clearPrizeDropdownOpen.value = false
  }
}

// 监听数据变化保存
watch(records, saveToCache, { deep: true })

// 重置页码
watch([searchQuery, statusFilter, prizeFilter], () => {
  currentPage.value = 1
})
</script>

<template>
  <div class="records-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <h2>中奖记录查询</h2>
        <p>查看历史中奖信息及统计数据。</p>
      </div>
      <button class="export-btn" @click="exportRecords">
        <span class="material-symbols-outlined">download</span>
        导出记录
      </button>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-header">
          <p class="stat-label">总中奖人次</p>
          <span class="material-symbols-outlined stat-icon">workspace_premium</span>
        </div>
        <p class="stat-value">{{ totalRecords }}</p>
        <div class="stat-badge">
          <span class="material-symbols-outlined">trending_up</span>
          <span>累计发放</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <p class="stat-label">已领取数量</p>
          <span class="material-symbols-outlined stat-icon success">check_circle</span>
        </div>
        <p class="stat-value">{{ claimedCount }}</p>
        <div class="stat-badge success">
          <span>{{ claimedRate }}% 领取率</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <p class="stat-label">待领取数量</p>
          <span class="material-symbols-outlined stat-icon warning">schedule</span>
        </div>
        <p class="stat-value">{{ pendingCount }}</p>
        <div class="stat-badge warning">
          <span>待处理</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <p class="stat-label">已过期数量</p>
          <span class="material-symbols-outlined stat-icon danger">cancel</span>
        </div>
        <p class="stat-value">{{ expiredCount }}</p>
        <div class="stat-badge danger">
          <span>未领取</span>
        </div>
      </div>
    </div>

    <!-- 筛选区域 -->
    <div class="filter-section">
      <div class="search-box">
        <span class="material-symbols-outlined search-icon">search</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索中奖人、奖项..."
          class="search-input"
        />
      </div>
      <div class="custom-dropdown">
        <button class="dropdown-trigger" @click.stop="togglePrizeDropdown">
          <span class="trigger-text">{{ prizeFilter === 'all' ? '全部奖项' : prizeFilter }}</span>
          <span class="dropdown-arrow" :class="{ open: prizeDropdownOpen }">▼</span>
        </button>
        <Transition name="dropdown">
          <div v-if="prizeDropdownOpen" class="dropdown-menu">
            <button
              class="dropdown-item"
              :class="{ active: prizeFilter === 'all' }"
              @click="selectPrize('all')"
            >
              全部奖项
            </button>
            <button
              v-for="name in prizeNames"
              :key="name"
              class="dropdown-item"
              :class="{ active: prizeFilter === name }"
              @click="selectPrize(name)"
            >
              {{ name }}
            </button>
          </div>
        </Transition>
      </div>

      <div class="custom-dropdown">
        <button class="dropdown-trigger" @click.stop="toggleStatusDropdown">
          <span class="trigger-text">{{ statusOptions.find(o => o.value === statusFilter)?.label }}</span>
          <span class="dropdown-arrow" :class="{ open: statusDropdownOpen }">▼</span>
        </button>
        <Transition name="dropdown">
          <div v-if="statusDropdownOpen" class="dropdown-menu">
            <button
              v-for="opt in statusOptions"
              :key="opt.value"
              class="dropdown-item"
              :class="{ active: statusFilter === opt.value }"
              @click="selectStatus(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </Transition>
      </div>
      <button v-if="searchQuery || statusFilter !== 'all' || prizeFilter !== 'all'"
              class="reset-btn" @click="resetFilters">
        <span class="material-symbols-outlined">clear</span>
        重置
      </button>

      <!-- 清空奖项记录按钮 -->
      <button class="clear-btn" @click="showClearPrizeModal = true">
        <span class="material-symbols-outlined">delete_sweep</span>
        清空奖项记录
      </button>
      <!-- 一键清空所有按钮 -->
      <button class="clear-all-btn" @click="clearAllWinnerRecords">
        <span class="material-symbols-outlined">warning</span>
        一键清空所有
      </button>
    </div>

    <!-- 中奖记录表格 -->
    <div class="table-container">
      <div class="table-header">
        <h2>中奖记录表</h2>
        <p class="table-count">共 {{ totalRecords }} 条记录</p>
      </div>

      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th class="th-prize">奖项信息</th>
              <th class="th-winner">中奖人</th>
              <th class="th-time">抽奖时间</th>
              <th class="th-status">状态</th>
              <th class="th-actions text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="record in currentPageData"
              :key="record.id"
              class="data-row"
            >
              <td class="td-prize">
                <div class="prize-cell">
                  <div class="prize-image" :style="record.prizeImage ? { backgroundImage: `url(${record.prizeImage})` } : {}">
                    <span v-if="!record.prizeImage" class="material-symbols-outlined">gift</span>
                  </div>
                  <div class="prize-info">
                    <span class="prize-name" :class="getRarityClass(record.prizeName)">
                      {{ record.prizeName }}
                    </span>
                  </div>
                </div>
              </td>
              <td class="td-winner">
                <div class="winner-cell">
                  <div class="winner-avatar">{{ record.winnerName.charAt(0) }}</div>
                  <div class="winner-info">
                    <span class="winner-name">{{ record.winnerName }}</span>
                    <span class="winner-dept">{{ record.winnerDept }}</span>
                  </div>
                </div>
              </td>
              <td class="td-time">
                <span class="draw-time">{{ record.drawTime }}</span>
                <span v-if="record.claimedTime" class="claimed-time">
                  领取于 {{ record.claimedTime }}
                </span>
              </td>
              <td class="td-status">
                <span :class="['status-badge', getStatusClass(record.status)]">
                  {{ getStatusText(record.status) }}
                </span>
              </td>
              <td class="td-actions">
                <div class="action-buttons">
                  <button class="action-btn action-reset" @click="resetParticipantStatus(record)">
                    <span class="material-symbols-outlined">restart_alt</span>
                    <span>重置参与状态</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="filteredRecords.length === 0" class="empty-state">
          <span class="material-symbols-outlined empty-icon">history_edu</span>
          <p>暂无中奖记录</p>
          <p class="empty-hint">抽奖开始后将会显示中奖信息</p>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="totalPages > 1" class="table-footer">
        <p class="pagination-info">
          显示第 {{ pageStart }} 至 {{ pageEnd }} 条记录，共 {{ totalRecords }} 条
        </p>
        <div class="pagination">
          <button
            class="page-btn"
            :disabled="currentPage === 1"
            @click="prevPage"
          >
            &lt;
          </button>
          <div class="page-numbers">
            <button
              v-for="page in totalPages"
              :key="page"
              class="page-number"
              :class="{ active: currentPage === page }"
              @click="goToPage(page)"
            >
              {{ page }}
            </button>
          </div>
          <button
            class="page-btn"
            :disabled="currentPage === totalPages"
            @click="nextPage"
          >
            &gt;
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- 自定义弹窗 -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showModal" class="modal-overlay" @click.self="handleModalClose">
        <div class="modal-container">
          <div class="modal-header">
            <h3 class="modal-title">{{ modalTitle }}</h3>
            <button class="modal-close" @click="handleModalClose">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="modal-body">
            <div class="modal-icon" :class="{ 'icon-alert': modalType === 'alert', 'icon-confirm': modalType === 'confirm' }">
              <span class="material-symbols-outlined">
                {{ modalType === 'alert' ? 'check_circle' : 'help' }}
              </span>
            </div>
            <p class="modal-message">{{ modalMessage }}</p>
          </div>
          <div class="modal-footer">
            <button v-if="modalType === 'confirm'" class="modal-btn modal-btn-cancel" @click="handleModalClose">
              取消
            </button>
            <button class="modal-btn modal-btn-confirm" :class="{ 'loading': modalLoading }" @click="handleModalConfirm" :disabled="modalLoading">
              <span v-if="modalLoading" class="loading-spinner"></span>
              <span>{{ modalLoading ? '处理中...' : '确定' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- 清空奖项记录弹窗 -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showClearPrizeModal" class="modal-overlay" @click.self="showClearPrizeModal = false">
        <div class="modal-container">
          <div class="modal-header">
            <h3 class="modal-title">清空奖项中奖记录</h3>
            <button class="modal-close" @click="showClearPrizeModal = false">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="modal-body">
            <div class="modal-icon icon-confirm">
              <span class="material-symbols-outlined">warning</span>
            </div>
            <p class="modal-message">
              确定要清空该奖项的所有中奖记录吗？<br><br>
              <strong>此操作将：</strong><br>
              • 删除该奖项的所有中奖记录<br>
              • 将相关中奖人重置为待抽奖状态<br>
              • 大屏抽奖界面将重新显示该奖项
            </p>
            <div class="form-group">
              <label>选择要清空的奖项：</label>
              <div class="custom-dropdown" style="width: 100%;">
                <button class="dropdown-trigger clear-prize-dropdown-trigger" @click.stop="toggleClearPrizeDropdown">
                  <span class="trigger-text">{{ selectedPrizeToClear || '请选择奖项' }}</span>
                  <span class="dropdown-arrow" :class="{ open: clearPrizeDropdownOpen }">▼</span>
                </button>
              </div>
              <Teleport to="body">
                <Transition name="dropdown">
                  <div v-if="clearPrizeDropdownOpen" class="clear-prize-dropdown" :style="clearDropdownStyle">
                    <button
                      v-for="name in prizeNames"
                      :key="name"
                      class="dropdown-item"
                      :class="{ active: selectedPrizeToClear === name }"
                      @click="selectClearPrize(name)"
                    >
                      {{ name }}
                    </button>
                  </div>
                </Transition>
              </Teleport>
            </div>
          </div>
          <div class="modal-footer">
            <button class="modal-btn modal-btn-cancel" @click="showClearPrizeModal = false">
              取消
            </button>
            <button
              class="modal-btn modal-btn-confirm"
              :disabled="!selectedPrizeToClear || clearPrizeLoading"
              @click="confirmClearPrizeRecords"
            >
              <span v-if="clearPrizeLoading" class="loading-spinner"></span>
              {{ clearPrizeLoading ? '处理中...' : '确定清空' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.records-page {
  width: 100%;
}

/* 页面头部 */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 2rem;
}

.header-content h2 {
  font-size: 2.25rem;
  font-weight: 800;
  color: #181111;
  letter-spacing: -0.033em;
}

:global(.dark) .header-content h2 {
  color: white;
}

.header-content p {
  color: #8a6060;
  margin-top: 0.5rem;
}

:global(.dark) .header-content p {
  color: #9ca3af;
}

.export-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: white;
  border: 1px solid #e6dbdb;
  border-radius: 9999px;
  color: #f42525;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

:global(.dark) .export-btn {
  background: rgba(255, 255, 255, 0.1);
  border-color: #3d2a2a;
}

.export-btn:hover {
  background: rgba(244, 37, 37, 0.05);
}

.export-btn :deep(.material-symbols-outlined) {
  font-size: 1.25rem;
}

/* 统计卡片 */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  padding: 1.5rem;
  background: white;
  border-radius: 1rem;
  border: 1px solid rgba(244, 37, 37, 0.1);
}

:global(.dark) .stat-card {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(244, 37, 37, 0.1);
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.stat-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #8a6060;
}

:global(.dark) .stat-label {
  color: #9ca3af;
}

.stat-icon {
  color: rgba(244, 37, 37, 0.5);
}

.stat-icon.success {
  color: rgba(34, 197, 94, 0.5);
}

.stat-icon.warning {
  color: rgba(245, 158, 11, 0.5);
}

.stat-icon.danger {
  color: rgba(239, 68, 68, 0.5);
}

.stat-value {
  font-size: 1.875rem;
  font-weight: 800;
  color: #181111;
}

:global(.dark) .stat-value {
  color: white;
}

.stat-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.5rem;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
  background: rgba(244, 37, 37, 0.1);
  color: #f42525;
}

.stat-badge.success {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.stat-badge.warning {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.stat-badge.danger {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.stat-badge :deep(.material-symbols-outlined) {
  font-size: 1rem;
}

/* 筛选区域 */
.filter-section {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 200px;
}

.search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.75rem;
  background: white;
  border: 1px solid #e6dbdb;
  border-radius: 1rem;
  font-size: 0.875rem;
  color: #181111;
}

:global(.dark) .search-input {
  background: rgba(255, 255, 255, 0.05);
  border-color: #3d2a2a;
  color: white;
}

.search-input:focus {
  outline: none;
  border-color: #f42525;
}

/* 自定义下拉菜单 */
.custom-dropdown {
  position: relative;
  width: 180px;
}

.dropdown-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid #e6dbdb;
  border-radius: 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #181111;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dropdown-trigger:hover {
  border-color: #f42525;
  box-shadow: 0 0 0 3px rgba(244, 37, 37, 0.1);
}

.dropdown-trigger:focus {
  outline: none;
}

:global(.dark) .dropdown-trigger {
  background: rgba(255, 255, 255, 0.05);
  border-color: #3d2a2a;
  color: white;
}

:global(.dark) .dropdown-trigger:hover {
  border-color: #f42525;
  box-shadow: 0 0 0 3px rgba(244, 37, 37, 0.2);
}

.trigger-text {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-arrow {
  font-size: 0.7rem;
  color: #f42525;
  transition: transform 0.2s ease;
  margin-left: 0.5rem;
}

.dropdown-arrow.open {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  width: 100%;
  max-height: 250px;
  background: white;
  border: 2px solid #f42525;
  border-radius: 0.75rem;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
}

:global(.dark) .dropdown-menu {
  background: #1f1a1a;
  border-color: #f42525;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
}

.dropdown-item {
  width: 100%;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  font-size: 0.875rem;
  font-weight: 600;
  color: #181111;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.dropdown-item:hover {
  background: rgba(244, 37, 37, 0.08);
}

.dropdown-item.active {
  background: rgba(244, 37, 37, 0.12);
  color: #f42525;
}

:global(.dark) .dropdown-item {
  color: white;
}

:global(.dark) .dropdown-item:hover {
  background: rgba(244, 37, 37, 0.15);
}

:global(.dark) .dropdown-item.active {
  background: rgba(244, 37, 37, 0.2);
}

/* 下拉菜单动画 */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.reset-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
  background: #f8f5f5;
  border: 1px solid #e6dbdb;
  border-radius: 1rem;
  font-size: 0.875rem;
  color: #8a6060;
  cursor: pointer;
  transition: all 0.2s;
}

:global(.dark) .reset-btn {
  background: rgba(255, 255, 255, 0.05);
  border-color: #3d2a2a;
  color: #9ca3af;
}

.reset-btn:hover {
  background: rgba(244, 37, 37, 0.05);
  border-color: #f42525;
  color: #f42525;
}

/* 清空奖项记录按钮 */
.clear-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
  background: rgba(244, 37, 37, 0.1);
  border: 1px solid #f42525;
  border-radius: 1rem;
  font-size: 0.875rem;
  color: #f42525;
  cursor: pointer;
  transition: all 0.2s;
}

:global(.dark) .clear-btn {
  background: rgba(244, 37, 37, 0.15);
  border-color: #f42525;
  color: #f87171;
}

.clear-btn:hover {
  background: rgba(244, 37, 37, 0.2);
}

.clear-btn :deep(.material-symbols-outlined) {
  font-size: 1.1rem;
}

/* 一键清空所有按钮 */
.clear-all-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid #ef4444;
  border-radius: 1rem;
  font-size: 0.875rem;
  color: #ef4444;
  cursor: pointer;
  transition: all 0.2s;
}

:global(.dark) .clear-all-btn {
  background: rgba(239, 68, 68, 0.15);
  border-color: #ef4444;
  color: #f87171;
}

.clear-all-btn:hover {
  background: rgba(239, 68, 68, 0.2);
}

.clear-all-btn :deep(.material-symbols-outlined) {
  font-size: 1.1rem;
}

/* 表格容器 */
.table-container {
  background: white;
  border-radius: 1rem;
  border: 1px solid rgba(244, 37, 37, 0.1);
  overflow: hidden;
}

:global(.dark) .table-container {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(244, 37, 37, 0.1);
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(244, 37, 37, 0.05);
}

:global(.dark) .table-header {
  border-color: rgba(244, 37, 37, 0.1);
}

.table-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #181111;
}

:global(.dark) .table-header h2 {
  color: white;
}

.table-count {
  font-size: 0.875rem;
  color: #8a6060;
}

:global(.dark) .table-count {
  color: #9ca3af;
}

.table-wrapper {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.data-table thead {
  background: #f8f5f5;
}

:global(.dark) .data-table thead {
  background: rgba(255, 255, 255, 0.05);
}

.data-table th {
  padding: 1rem 1.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #8a6060;
}

:global(.dark) .data-table th {
  color: #9ca3af;
}

.data-table th.text-right {
  text-align: right;
}

.data-row {
  border-bottom: 1px solid rgba(244, 37, 37, 0.05);
  transition: background-color 0.2s;
}

.data-row:hover {
  background: rgba(244, 37, 37, 0.03);
}

.data-table td {
  padding: 1rem 1.5rem;
  vertical-align: middle;
}

/* 奖项列 */
.td-prize {
  min-width: 240px;
}

.prize-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.prize-image {
  width: 3rem;
  height: 3rem;
  border-radius: 0.75rem;
  background: #f8f5f5;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

:global(.dark) .prize-image {
  background: #3d2a2a;
}

.prize-image :deep(.material-symbols-outlined) {
  font-size: 1.25rem;
  color: #8a6060;
}

.prize-name {
  font-weight: 600;
  color: #181111;
  font-size: 0.9rem;
}

:global(.dark) .prize-name {
  color: white;
}

.prize-name.rarity-legendary {
  color: #f42525;
}

.prize-name.rarity-epic {
  color: #8b5cf6;
}

.prize-name.rarity-rare {
  color: #3b82f6;
}

/* 中奖人列 */
.td-winner {
  min-width: 160px;
}

.winner-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.winner-avatar {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: rgba(244, 37, 37, 0.1);
  color: #f42525;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 700;
}

.winner-info {
  display: flex;
  flex-direction: column;
}

.winner-name {
  font-weight: 600;
  color: #181111;
}

:global(.dark) .winner-name {
  color: white;
}

.winner-dept {
  font-size: 0.8rem;
  color: #8a6060;
}

:global(.dark) .winner-dept {
  color: #9ca3af;
}

/* 时间列 */
.td-time {
  min-width: 180px;
}

.draw-time {
  display: block;
  color: #374151;
  font-size: 0.875rem;
}

:global(.dark) .draw-time {
  color: #d1d5db;
}

.claimed-time {
  display: block;
  font-size: 0.75rem;
  color: #8a6060;
  margin-top: 0.25rem;
}

:global(.dark) .claimed-time {
  color: #9ca3af;
}

/* 状态标签 */
.status-badge {
  display: inline-flex;
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
}

.status-claimed {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

:global(.dark) .status-claimed {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
}

.status-pending {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

:global(.dark) .status-pending {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.status-expired {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

:global(.dark) .status-expired {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

/* 操作列 */
.td-actions {
  text-align: right;
  min-width: 160px;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 1rem;
  background: rgba(244, 37, 37, 0.1);
  border: 1px solid #f42525;
  border-radius: 0.5rem;
  color: #f42525;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: rgba(244, 37, 37, 0.2);
}

.action-btn :deep(.material-symbols-outlined) {
  font-size: 1rem;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 3rem;
  color: #9ca3af;
}

.empty-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 0.5rem;
}

.empty-hint {
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

/* 表格底部 */
.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-top: 1px solid rgba(244, 37, 37, 0.05);
  background: #f8f5f5;
}

:global(.dark) .table-footer {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(244, 37, 37, 0.1);
}

.pagination-info {
  font-size: 0.875rem;
  color: #8a6060;
}

:global(.dark) .pagination-info {
  color: #9ca3af;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.page-numbers {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.page-number {
  min-width: 2rem;
  height: 2rem;
  padding: 0 0.625rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

:global(.dark) .page-number {
  background: #374151;
  border-color: #4b5563;
  color: #d1d5db;
}

.page-number:hover:not(.active) {
  border-color: #f42525;
  color: #f42525;
}

.page-number.active {
  background: #f42525;
  border-color: #f42525;
  color: white;
}

.page-ellipsis {
  color: #9ca3af;
  font-size: 0.875rem;
  padding: 0 0.25rem;
}

.page-btn {
  min-width: 2rem;
  height: 2rem;
  padding: 0 0.5rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

:global(.dark) .page-btn {
  background: #374151;
  border-color: #4b5563;
  color: #d1d5db;
}

.page-btn:hover:not(:disabled) {
  border-color: #f42525;
  color: #f42525;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 1024px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .stats-row {
    grid-template-columns: 1fr;
  }

  .filter-section {
    flex-direction: column;
  }

  .search-box {
    min-width: 100%;
  }

  .filter-select {
    width: 100%;
  }
}
</style>

<style>
/* 自定义弹窗样式 - 全局样式 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-container {
  background: white;
  border-radius: 1rem;
  width: 90%;
  max-width: 420px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.dark .modal-container {
  background: #1f1a1a;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #f0f0f0;
}

.dark .modal-header {
  border-color: #3d2a2a;
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #181111;
}

.dark .modal-title {
  color: white;
}

.modal-close {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: #8a6060;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.modal-close:hover {
  background: rgba(244, 37, 37, 0.1);
  color: #f42525;
}

.modal-body {
  padding: 2rem 1.5rem;
  text-align: center;
}

.modal-icon {
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  margin: 0 auto 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-icon.icon-alert {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.modal-icon.icon-confirm {
  background: rgba(244, 37, 37, 0.15);
  color: #f42525;
}

.modal-icon :deep(.material-symbols-outlined) {
  font-size: 2.5rem;
}

.modal-message {
  font-size: 1rem;
  color: #374151;
  line-height: 1.6;
}

.dark .modal-message {
  color: #d1d5db;
}

.modal-footer {
  display: flex;
  justify-content: center;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  background: #f8f5f5;
  border-top: 1px solid #f0f0f0;
}

.dark .modal-footer {
  background: rgba(255, 255, 255, 0.05);
  border-color: #3d2a2a;
}

.modal-btn {
  min-width: 100px;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.modal-btn-cancel {
  background: white;
  border: 1px solid #e5e7eb;
  color: #6b7280;
}

.modal-btn-cancel:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.dark .modal-btn-cancel {
  background: #374151;
  border-color: #4b5563;
  color: #9ca3af;
}

.dark .modal-btn-cancel:hover {
  background: #4b5563;
}

.modal-btn-confirm {
  background: #f42525;
  border: none;
  color: white;
}

.modal-btn-confirm:hover:not(:disabled) {
  background: #dc2626;
}

.modal-btn-confirm:disabled {
  opacity: 0.7;
  cursor: not-allowed;
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

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.9) translateY(20px);
}

/* loading spinner */
.loading-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 表单样式 */
.form-group {
  margin-top: 1.5rem;
  text-align: left;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.dark .form-group label {
  color: #d1d5db;
}

/* 清空奖项下拉菜单 */
.clear-prize-dropdown {
  background: white;
  border: 2px solid #f42525;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
}

.dark .clear-prize-dropdown {
  background: #1f1a1a;
  border-color: #f42525;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
}

.clear-prize-dropdown .dropdown-item {
  width: 100%;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  font-size: 0.875rem;
  font-weight: 600;
  color: #181111;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.clear-prize-dropdown .dropdown-item:hover {
  background: rgba(244, 37, 37, 0.08);
}

.clear-prize-dropdown .dropdown-item.active {
  background: rgba(244, 37, 37, 0.12);
  color: #f42525;
}

.dark .clear-prize-dropdown .dropdown-item {
  color: white;
}

.dark .clear-prize-dropdown .dropdown-item:hover {
  background: rgba(244, 37, 37, 0.15);
}

.dark .clear-prize-dropdown .dropdown-item.active {
  background: rgba(244, 37, 37, 0.2);
}
</style>
