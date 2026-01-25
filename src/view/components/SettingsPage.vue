<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

// 缓存 key
const STORAGE_KEY = 'lottery_settings'

// 默认设置
const defaultSettings = {
  // 抽奖规则
  allowRepeatWins: false,          // 是否允许同一人多次中奖
  resetPoolEnabled: false,         // 中奖人不在场时回池重抽
  maxWinPerPerson: 1,              // 每人最多中奖次数

  // 抽奖模式
  drawMode: 'random',              // random-随机, weighted-加权
  weightedBy: 'department',        // weighted时按什么加权: department/position

  // 页面模式
  pageMode: 'sphere3d',            // yima-一马当先, trendy-现代国潮, sphere3d-星耀抽奖

  // 动画速度
  animationSpeed: 'normal',        // fast/normal/slow
  animationDuration: {
    fast: 1500,
    normal: 3000,
    slow: 5000
  },

  // 音效
  soundEnabled: true,              // 总开关
  bgmEnabled: true,                // 背景音乐
  sfxEnabled: true,                // 音效提示

  // 倒计时
  countdownEnabled: false,         // 开启确认倒计时
  countdownSeconds: 5,             // 确认倒计时（秒）

  // 数据保存
  autoSave: true,                  // 自动保存
  autoSaveInterval: 30,            // 自动保存间隔（秒）

  // 显示设置
  showWinnerAvatar: false,         // 显示中奖人头像
  showWinnerDept: false,           // 显示中奖人部门
  barrageEnabled: true,            // 开启弹幕
  confirmBeforeAward: false         // 颁奖前确认
}

// 本地状态
const settings = ref({ ...defaultSettings })
const hasChanges = ref(false)

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

// 加载缓存
function loadFromCache() {
  try {
    const cached = localStorage.getItem(STORAGE_KEY)
    if (cached) {
      const savedSettings = JSON.parse(cached)
      settings.value = { ...defaultSettings, ...savedSettings }
    }
  } catch (e) {
    console.error('加载设置失败:', e)
  }
}

// 保存缓存
function saveToCache() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
    hasChanges.value = false
  } catch (e) {
    console.error('保存设置失败:', e)
  }
}

// 监听变化
watch(settings, () => {
  hasChanges.value = true
}, { deep: true })

const emit = defineEmits(['go-draw'])

function handleSave() {
  saveToCache()
  // 添加保存反馈 (可选，后续可以在端测优化)
}

// 重置按钮
function handleReset() {
  showConfirmModal(
    '恢复默认设置',
    '确定要恢复所有设置为默认值吗？\n\n此操作将清除所有当前配置，且无法撤销。',
    () => {
      settings.value = { ...defaultSettings }
      saveToCache()
      showAlertModal('操作成功', '已恢复所有设置为默认值')
    }
  )
}

// 速度选项
const speedOptions = [
  { value: 'fast', label: '快速', duration: 1500, desc: '1.5秒快速揭晓' },
  { value: 'normal', label: '正常', duration: 3000, desc: '3秒正常速度' },
  { value: 'slow', label: '慢速', duration: 5000, desc: '5秒慢速展示' }
]

// 页面模式选项
const pageModeOptions = [
  { value: 'yima', label: '一马当先' },
  { value: 'trendy', label: '现代国潮' },
  { value: 'sphere3d', label: '星耀抽奖' }
]

// 个人中奖上限选项
const maxWinOptions = [
  { value: 1, label: '1 次' },
  { value: 2, label: '2 次' },
  { value: 3, label: '3 次' },
  { value: 5, label: '5 次' },
  { value: 999, label: '不限制' }
]

const pageModeDropdownOpen = ref(false)
function togglePageModeDropdown() {
  pageModeDropdownOpen.value = !pageModeDropdownOpen.value
}
function selectPageMode(value) {
  settings.value.pageMode = value
  pageModeDropdownOpen.value = false
}

const maxWinDropdownOpen = ref(false)
function toggleMaxWinDropdown() {
  maxWinDropdownOpen.value = !maxWinDropdownOpen.value
}
function selectMaxWin(value) {
  settings.value.maxWinPerPerson = value
  maxWinDropdownOpen.value = false
}

// 倒计时选项
const countdownOptions = [3, 5, 10]

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
  if (pageModeDropdownOpen.value && !dropdown) {
    pageModeDropdownOpen.value = false
  }
  if (maxWinDropdownOpen.value && !dropdown) {
    maxWinDropdownOpen.value = false
  }
}
</script>

<template>
  <div class="settings-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <h2>全局系统设置</h2>
        <p>配置抽奖系统的全局参数。</p>
      </div>
      <div class="header-actions">
        <button
          class="reset-btn"
          @click="handleReset"
        >
          <span class="material-symbols-outlined">refresh</span>
          恢复默认
        </button>
        <button
          class="save-btn"
          :disabled="!hasChanges"
          @click="handleSave"
        >
          <span class="material-symbols-outlined">save</span>
          保存设置
        </button>
      </div>
    </div>

    <!-- 设置卡片区域 -->
    <div class="settings-grid">
      <!-- 🎲 抽奖规则 -->
      <div class="settings-card">
        <div class="card-header">
          <span class="card-icon">🎲</span>
          <div>
            <h3>抽奖规则</h3>
            <p>控制抽奖的基本规则和行为</p>
          </div>
        </div>

        <div class="card-body">
          <div class="setting-item">
            <div class="setting-info">
              <label>允许重复中奖</label>
              <p>是否允许同一员工中奖多次</p>
            </div>
            <label class="toggle-switch">
              <input v-model="settings.allowRepeatWins" type="checkbox" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <label>回池重抽</label>
              <p>中奖人不在场时将名额放回奖池</p>
            </div>
            <label class="toggle-switch">
              <input v-model="settings.resetPoolEnabled" type="checkbox" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div v-if="!settings.allowRepeatWins" class="setting-item">
            <div class="setting-info">
              <label>个人中奖上限</label>
              <p>每人最多可中奖几次</p>
            </div>
            <div class="custom-dropdown">
              <button
                class="dropdown-trigger"
                @click="toggleMaxWinDropdown"
              >
                <span class="trigger-text">{{ maxWinOptions.find(o => o.value === settings.maxWinPerPerson)?.label }}</span>
                <span class="dropdown-arrow" :class="{ open: maxWinDropdownOpen }">▼</span>
              </button>
              <Transition name="dropdown">
                <div v-if="maxWinDropdownOpen" class="dropdown-menu">
                  <button
                    v-for="opt in maxWinOptions"
                    :key="opt.value"
                    class="dropdown-item"
                    :class="{ active: settings.maxWinPerPerson === opt.value }"
                    @click="selectMaxWin(opt.value)"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </Transition>
            </div>
          </div>
        </div>
      </div>

      <!-- 🎯 抽奖模式 -->
      <div class="settings-card">
        <div class="card-header">
          <span class="card-icon">🎯</span>
          <div>
            <h3>抽奖模式</h3>
            <p>选择抽奖算法和权重方式</p>
          </div>
        </div>

        <div class="card-body">
          <div class="setting-item vertical">
            <label>抽奖算法</label>
            <div class="radio-group">
              <label class="radio-item">
                <input v-model="settings.drawMode" type="radio" value="random" />
                <span class="radio-custom"></span>
                <div class="radio-content">
                  <span class="radio-label">随机抽取</span>
                  <span class="radio-desc">所有候选人概率相等</span>
                </div>
              </label>
              <label class="radio-item">
                <input v-model="settings.drawMode" type="radio" value="weighted" />
                <span class="radio-custom"></span>
                <div class="radio-content">
                  <span class="radio-label">加权抽取</span>
                  <span class="radio-desc">按部门或职级分配不同权重</span>
                </div>
              </label>
            </div>
          </div>

          <div v-if="settings.drawMode === 'weighted'" class="setting-item">
            <div class="setting-info">
              <label>权重依据</label>
              <p>按什么维度分配权重</p>
            </div>
            <select v-model="settings.weightedBy" class="setting-select">
              <option value="department">按部门</option>
              <option value="position">按职级</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 🎨 页面模式 -->
      <div class="settings-card">
        <div class="card-header">
          <span class="card-icon">🎨</span>
          <div>
            <h3>页面模式</h3>
            <p>选择抽奖页面的展示风格</p>
          </div>
        </div>

        <div class="card-body">
          <div class="setting-item">
            <div class="setting-info">
              <label>页面模式</label>
              <p>选择抽奖页面的展示风格</p>
            </div>
            <div class="custom-dropdown">
              <button
                class="dropdown-trigger"
                @click="togglePageModeDropdown"
              >
                <span class="trigger-text">{{ pageModeOptions.find(o => o.value === settings.pageMode)?.label }}</span>
                <span class="dropdown-arrow" :class="{ open: pageModeDropdownOpen }">▼</span>
              </button>
              <Transition name="dropdown">
                <div v-if="pageModeDropdownOpen" class="dropdown-menu">
                  <button
                    v-for="opt in pageModeOptions"
                    :key="opt.value"
                    class="dropdown-item"
                    :class="{ active: settings.pageMode === opt.value }"
                    @click="selectPageMode(opt.value)"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </Transition>
            </div>
          </div>
        </div>
      </div>

      <!-- ⚡ 动画速度 -->
      <div class="settings-card">
        <div class="card-header">
          <span class="card-icon">⚡</span>
          <div>
            <h3>动画速度</h3>
            <p>控制抽奖动画的展示速度</p>
          </div>
        </div>

        <div class="card-body">
          <div class="setting-item vertical">
            <label>动画时长</label>
            <div class="speed-options">
              <label
                v-for="option in speedOptions"
                :key="option.value"
                class="speed-option"
                :class="{ active: settings.animationSpeed === option.value }"
              >
                <input
                  v-model="settings.animationSpeed"
                  type="radio"
                  :value="option.value"
                />
                <span class="speed-label">{{ option.label }}</span>
                <span class="speed-desc">{{ option.desc }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- 🔊 音效设置 -->
      <div class="settings-card">
        <div class="card-header">
          <span class="card-icon">🔊</span>
          <div>
            <h3>音效设置</h3>
            <p>控制抽奖过程中的声音提示</p>
          </div>
        </div>

        <div class="card-body">
          <div class="setting-item">
            <div class="setting-info">
              <label>音效总开关</label>
              <p>开启或关闭所有声音</p>
            </div>
            <label class="toggle-switch">
              <input v-model="settings.soundEnabled" type="checkbox" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="setting-item" :class="{ disabled: !settings.soundEnabled }">
            <div class="setting-info">
              <label>背景音乐</label>
              <p>抽奖过程中的背景音乐</p>
            </div>
            <label class="toggle-switch">
              <input v-model="settings.bgmEnabled" type="checkbox" :disabled="!settings.soundEnabled" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="setting-item" :class="{ disabled: !settings.soundEnabled }">
            <div class="setting-info">
              <label>中奖音效</label>
              <p>中奖时的提示音</p>
            </div>
            <label class="toggle-switch">
              <input v-model="settings.sfxEnabled" type="checkbox" :disabled="!settings.soundEnabled" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- ⏱️ 倒计时设置 -->
      <div class="settings-card">
        <div class="card-header">
          <span class="card-icon">⏱️</span>
          <div>
            <h3>倒计时设置</h3>
            <p>抽奖确认环节的倒计时时长</p>
          </div>
        </div>

        <div class="card-body">
          <div class="setting-item">
            <div class="setting-info">
              <label>开启倒计时</label>
              <p>中奖确认后进入倒计时环节</p>
            </div>
            <label class="toggle-switch">
              <input v-model="settings.countdownEnabled" type="checkbox" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="setting-item vertical" :class="{ disabled: !settings.countdownEnabled }">
            <label>确认倒计时</label>
            <div class="countdown-options">
              <label
                v-for="sec in countdownOptions"
                :key="sec"
                class="countdown-option"
                :class="{ active: settings.countdownSeconds === sec }"
              >
                <input
                  v-model="settings.countdownSeconds"
                  type="radio"
                  :value="sec"
                  :disabled="!settings.countdownEnabled"
                />
                <span>{{ sec }} 秒</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- 💾 数据保存 -->
      <div class="settings-card">
        <div class="card-header">
          <span class="card-icon">💾</span>
          <div>
            <h3>数据保存</h3>
            <p>抽奖数据的自动保存策略</p>
          </div>
        </div>

        <div class="card-body">
          <div class="setting-item">
            <div class="setting-info">
              <label>自动保存</label>
              <p>抽奖过程自动保存到本地</p>
            </div>
            <label class="toggle-switch">
              <input v-model="settings.autoSave" type="checkbox" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <label>显示中奖人头像</label>
              <p>中奖名单中显示头像</p>
            </div>
            <label class="toggle-switch">
              <input v-model="settings.showWinnerAvatar" type="checkbox" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <label>显示中奖人部门</label>
              <p>中奖名单中显示部门信息</p>
            </div>
            <label class="toggle-switch">
              <input v-model="settings.showWinnerDept" type="checkbox" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- 💬 互动设置 -->
      <div class="settings-card">
        <div class="card-header">
          <span class="card-icon">💬</span>
          <div>
            <h3>互动设置</h3>
            <p>管理抽奖过程中的互动功能</p>
          </div>
        </div>

        <div class="card-body">
          <div class="setting-item">
            <div class="setting-info">
              <label>开启弹幕</label>
              <p>在抽奖过程中显示用户弹幕</p>
            </div>
            <label class="toggle-switch">
              <input v-model="settings.barrageEnabled" type="checkbox" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-footer">
      <div class="info-card">
        <span class="material-symbols-outlined">info</span>
        <p>更改后请保存设置</p>
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
</template>

<style scoped>
.settings-page {
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

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.reset-btn,
.save-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.reset-btn {
  background: white;
  border: 1px solid #e6dbdb;
  color: #8a6060;
}

:global(.dark) .reset-btn {
  background: rgba(255, 255, 255, 0.1);
  border-color: #3d2a2a;
  color: #9ca3af;
}

.reset-btn:hover {
  background: rgba(244, 37, 37, 0.05);
  border-color: #f42525;
  color: #f42525;
}

.save-btn {
  background: #f42525;
  border: none;
  color: white;
}

.save-btn:hover:not(:disabled) {
  background: #dc2626;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.save-btn :deep(.material-symbols-outlined),
.reset-btn :deep(.material-symbols-outlined) {
  font-size: 1.25rem;
}

/* 设置卡片网格 */
.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

.settings-card {
  background: white;
  border-radius: 1rem;
  border: 1px solid rgba(244, 37, 37, 0.1);
}

:global(.dark) .settings-card {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(244, 37, 37, 0.1);
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.5rem;
  border-bottom: 1px solid rgba(244, 37, 37, 0.05);
}

:global(.dark) .card-header {
  border-color: rgba(244, 37, 37, 0.1);
}

.card-icon {
  font-size: 1.75rem;
}

.card-header h3 {
  font-size: 1.125rem;
  font-weight: 700;
  color: #181111;
}

:global(.dark) .card-header h3 {
  color: white;
}

.card-header p {
  font-size: 0.875rem;
  color: #8a6060;
  margin-top: 0.25rem;
}

:global(.dark) .card-header p {
  color: #9ca3af;
}

.card-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* 设置项 */
.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.setting-item.vertical {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.setting-item.disabled {
  opacity: 0.5;
}

.setting-item label {
  font-weight: 600;
  color: #181111;
  font-size: 0.95rem;
}

:global(.dark) .setting-item label {
  color: white;
}

.setting-info p {
  font-size: 0.8rem;
  color: #8a6060;
  margin-top: 0.25rem;
}

:global(.dark) .setting-info p {
  color: #9ca3af;
}

.setting-select {
  padding: 0.625rem 2.5rem 0.625rem 1rem;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 0.75rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: #181111;
  cursor: pointer;
  appearance: none;
  transition: all 0.2s ease;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23f42525' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 1.25rem;
}

.setting-select:hover {
  border-color: #f42525;
  box-shadow: 0 0 0 3px rgba(244, 37, 37, 0.1);
}

.setting-select:focus {
  outline: none;
  border-color: #f42525;
  box-shadow: 0 0 0 3px rgba(244, 37, 37, 0.2);
}

:global(.dark) .setting-select {
  background-color: #1f1a1a;
  border-color: #3d2a2a;
  color: white;
}

:global(.dark) .setting-select:hover {
  border-color: #f42525;
  box-shadow: 0 0 0 3px rgba(244, 37, 37, 0.2);
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
  padding: 0.625rem 1rem;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 0.75rem;
  font-size: 0.95rem;
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
  border-color: #f42525;
  box-shadow: 0 0 0 3px rgba(244, 37, 37, 0.2);
}

:global(.dark) .dropdown-trigger {
  background: #1f1a1a;
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
}

.dropdown-arrow {
  font-size: 0.7rem;
  color: #f42525;
  transition: transform 0.2s ease;
}

.dropdown-arrow.open {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: white;
  border: 2px solid #f42525;
  border-radius: 0.75rem;
  overflow: hidden;
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
  font-size: 0.95rem;
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

/* 开关样式 */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 3rem;
  height: 1.5rem;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: #e5e7eb;
  border-radius: 9999px;
  transition: all 0.3s;
}

:global(.dark) .toggle-slider {
  background: #4b5563;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  background: white;
  border: 1px solid #d1d5db;
  top: 2px;
  left: 2px;
  transition: all 0.3s;
}

.toggle-switch input:checked + .toggle-slider {
  background: #f42525;
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(1.5rem);
  border-color: #f42525;
}

.toggle-switch input:disabled + .toggle-slider {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 单选按钮组 */
.radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

.radio-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  background: #f8f5f5;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

:global(.dark) .radio-item {
  background: rgba(255, 255, 255, 0.05);
}

.radio-item:hover {
  background: rgba(244, 37, 37, 0.05);
}

.radio-item input {
  display: none;
}

.radio-custom {
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid #d1d5db;
  border-radius: 50%;
  flex-shrink: 0;
  position: relative;
  transition: all 0.2s;
}

.radio-item input:checked + .radio-custom {
  border-color: #f42525;
}

.radio-item input:checked + .radio-custom::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 0.625rem;
  height: 0.625rem;
  background: #f42525;
  border-radius: 50%;
}

.radio-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.radio-label {
  font-weight: 600;
  color: #181111;
}

:global(.dark) .radio-label {
  color: white;
}

.radio-desc {
  font-size: 0.8rem;
  color: #8a6060;
}

:global(.dark) .radio-desc {
  color: #9ca3af;
}

/* 速度选项 */
.speed-options {
  display: flex;
  gap: 0.75rem;
  width: 100%;
}

.speed-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: #f8f5f5;
  border: 2px solid transparent;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

:global(.dark) .speed-option {
  background: rgba(255, 255, 255, 0.05);
}

.speed-option:hover {
  border-color: rgba(244, 37, 37, 0.3);
}

.speed-option.active {
  border-color: #f42525;
  background: rgba(244, 37, 37, 0.05);
}

.speed-option input {
  display: none;
}

.speed-label {
  font-weight: 600;
  color: #181111;
  font-size: 0.95rem;
}

:global(.dark) .speed-label {
  color: white;
}

.speed-desc {
  font-size: 0.75rem;
  color: #8a6060;
  text-align: center;
}

:global(.dark) .speed-desc {
  color: #9ca3af;
}

/* 倒计时选项 */
.countdown-options {
  display: flex;
  gap: 0.75rem;
  width: 100%;
}

.countdown-option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.625rem 1rem;
  background: #f8f5f5;
  border: 2px solid transparent;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 600;
  color: #374151;
}

:global(.dark) .countdown-option {
  background: rgba(255, 255, 255, 0.05);
  color: #d1d5db;
}

.countdown-option:hover {
  border-color: rgba(244, 37, 37, 0.3);
}

.countdown-option.active {
  border-color: #f42525;
  background: rgba(244, 37, 37, 0.1);
  color: #f42525;
}

.countdown-option input {
  display: none;
}

/* 底部提示 */
.settings-footer {
  margin-top: 2rem;
}

.info-card {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: rgba(244, 37, 37, 0.05);
  border: 1px solid rgba(244, 37, 37, 0.2);
  border-radius: 0.75rem;
}

:global(.dark) .info-card {
  background: rgba(244, 37, 37, 0.1);
}

.info-card .material-symbols-outlined {
  color: #f42525;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.info-card p {
  font-size: 0.875rem;
  color: #8a6060;
  line-height: 1.5;
}

:global(.dark) .info-card p {
  color: #9ca3af;
}

@media (max-width: 1024px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }

  .speed-options {
    flex-direction: column;
  }
}

@media (max-width: 640px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    justify-content: flex-end;
  }

  .setting-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
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
</style>
