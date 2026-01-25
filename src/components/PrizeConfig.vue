<script setup>
import { ref } from 'vue'
import { savePrizes } from '../utils/lotteryStorage'

const props = defineProps({
  prizes: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:prizes'])

// ========== 自定义弹窗状态 ==========
const showModal = ref(false)
const modalType = ref('confirm') // confirm | alert | prompt
const modalTitle = ref('')
const modalMessage = ref('')
const modalOnConfirm = ref(null)
const modalLoading = ref(false)
const modalInputValue = ref('') // 用于prompt弹窗的输入值
const modalInputPlaceholder = ref('') // 输入框占位符

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

// 显示输入弹窗
function showPromptModal(title, message, defaultValue, placeholder, onConfirm) {
  modalType.value = 'prompt'
  modalTitle.value = title
  modalMessage.value = message
  modalInputValue.value = defaultValue || ''
  modalInputPlaceholder.value = placeholder || ''
  modalOnConfirm.value = onConfirm
  showModal.value = true
}

// 弹窗确认
function handleModalConfirm() {
  if (modalOnConfirm.value) {
    modalLoading.value = true
    // 对于prompt类型，传入输入的值
    if (modalType.value === 'prompt') {
      modalOnConfirm.value(modalInputValue.value)
    } else {
      modalOnConfirm.value()
    }
    modalLoading.value = false
  }
  showModal.value = false
}

// 弹窗取消/关闭
function handleModalClose() {
  showModal.value = false
}

// 新增奖品表单
const newPrize = ref({
  name: '',
  count: 1,
  description: ''
})

// 添加奖品
function addPrize() {
  if (!newPrize.value.name.trim()) {
    alert('请输入奖品名称')
    return
  }

  const prize = {
    id: Date.now(),
    name: newPrize.value.name.trim(),
    count: Number(newPrize.value.count) || 1,
    description: newPrize.value.description.trim(),
    createdAt: new Date().toISOString()
  }

  const updatedPrizes = [...props.prizes, prize]
  emit('update:prizes', updatedPrizes)
  savePrizes(updatedPrizes)

  // 重置表单
  newPrize.value = { name: '', count: 1, description: '' }
}

// 删除奖品
function removePrize(id) {
  const prize = props.prizes.find(p => p.id === id)
  const prizeName = prize?.name || '该奖品'
  if (confirm(`确定要删除 "${prizeName}" 吗？`)) {
    const updatedPrizes = props.prizes.filter(p => p.id !== id)
    emit('update:prizes', updatedPrizes)
    savePrizes(updatedPrizes)
  }
}

// 编辑奖品
function editPrize(prize) {
  showPromptModal(
    '编辑奖品',
    '请输入新的奖品名称：',
    prize.name,
    '奖品名称',
    (newName) => {
      if (newName !== null && newName.trim()) {
        const updated = props.prizes.map(p =>
          p.id === prize.id ? { ...p, name: newName.trim() } : p
        )
        emit('update:prizes', updated)
        savePrizes(updated)
      }
    }
  )
}

// 调整数量
function adjustCount(prize, delta) {
  const newCount = Math.max(1, prize.count + delta)
  const updated = props.prizes.map(p =>
    p.id === prize.id ? { ...p, count: newCount } : p
  )
  emit('update:prizes', updated)
  savePrizes(updated)
}

// 上移
function moveUp(index) {
  if (index === 0) return
  const updated = [...props.prizes]
  ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
  emit('update:prizes', updated)
  savePrizes(updated)
}

// 下移
function moveDown(index) {
  if (index === props.prizes.length - 1) return
  const updated = [...props.prizes]
  ;[updated[index], updated[index + 1]] = [updated[index + 1], updated[index]]
  emit('update:prizes', updated)
  savePrizes(updated)
}
</script>

<template>
  <div class="prize-config">
    <div class="card">
      <div class="card-header">
        <h2>🎁 奖品配置</h2>
        <span class="count">共 {{ prizes.length }} 个奖品</span>
      </div>

      <!-- 添加奖品表单 -->
      <div class="add-form">
        <div class="form-row">
          <input
            v-model="newPrize.name"
            type="text"
            placeholder="奖品名称"
            class="form-input"
            @keyup.enter="addPrize"
          />
          <div class="count-input">
            <button class="count-btn" @click="newPrize.count = Math.max(1, newPrize.count - 1)">-</button>
            <input
              v-model.number="newPrize.count"
              type="number"
              min="1"
              class="count-field"
            />
            <button class="count-btn" @click="newPrize.count++">+</button>
          </div>
          <input
            v-model="newPrize.description"
            type="text"
            placeholder="奖品描述（可选）"
            class="form-input flex-1"
            @keyup.enter="addPrize"
          />
          <button class="add-btn" @click="addPrize">➕ 添加</button>
        </div>
      </div>

      <!-- 奖品列表 -->
      <div class="prize-list">
        <transition-group name="list">
          <div
            v-for="(prize, index) in prizes"
            :key="prize.id"
            class="prize-item"
          >
            <div class="prize-info">
              <span class="prize-rank">#{{ index + 1 }}</span>
              <span class="prize-name">{{ prize.name }}</span>
              <span class="prize-count">x{{ prize.count }}</span>
              <span v-if="prize.description" class="prize-desc">{{ prize.description }}</span>
            </div>
            <div class="prize-actions">
              <button class="action-btn" @click="moveUp(index)" :disabled="index === 0" title="上移">⬆️</button>
              <button class="action-btn" @click="moveDown(index)" :disabled="index === prizes.length - 1" title="下移">⬇️</button>
              <button class="action-btn" @click="editPrize(prize)" title="编辑">✏️</button>
              <button class="action-btn delete" @click="removePrize(prize.id)" title="删除">🗑️</button>
            </div>
          </div>
        </transition-group>

        <div v-if="prizes.length === 0" class="empty-state">
          <span class="empty-icon">📦</span>
          <p>暂无奖品，点击上方按钮添加</p>
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
            <div class="modal-icon" :class="{ 'icon-alert': modalType === 'alert', 'icon-confirm': modalType === 'confirm', 'icon-prompt': modalType === 'prompt' }">
              <span class="material-symbols-outlined">
                {{ modalType === 'alert' ? 'check_circle' : 'help' }}
              </span>
            </div>
            <p class="modal-message">{{ modalMessage }}</p>
            <!-- 输入框（仅prompt类型显示） -->
            <input
              v-if="modalType === 'prompt'"
              v-model="modalInputValue"
              type="text"
              class="modal-input"
              :placeholder="modalInputPlaceholder"
              @keyup.enter="handleModalConfirm"
            />
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
.prize-config {
  width: 100%;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #eee;
}

.card-header h2 {
  font-size: 1.3rem;
  color: #2c3e50;
}

.count {
  color: #666;
  font-size: 0.9rem;
}

/* 添加表单样式 */
.add-form {
  background: #f8fafc;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 20px;
}

.form-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.form-input {
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #3498db;
}

.form-input.flex-1 {
  flex: 1;
}

/* 数量输入框 */
.count-input {
  display: flex;
  align-items: center;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.count-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: #f1f5f9;
  cursor: pointer;
  font-size: 1.1rem;
  transition: background 0.2s;
}

.count-btn:hover {
  background: #e2e8f0;
}

.count-field {
  width: 50px;
  height: 36px;
  border: none;
  border-left: 1px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  text-align: center;
  font-size: 0.95rem;
}

.count-field:focus {
  outline: none;
}

.add-btn {
  padding: 10px 20px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: all 0.2s;
  white-space: nowrap;
}

.add-btn:hover {
  background: #2980b9;
}

/* 奖品列表样式 */
.prize-list {
  max-height: 400px;
  overflow-y: auto;
}

.prize-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: #f8fafc;
  border-radius: 10px;
  margin-bottom: 10px;
  transition: all 0.3s;
}

.prize-item:hover {
  background: #f1f5f9;
}

.prize-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.prize-rank {
  background: #3498db;
  color: white;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
}

.prize-name {
  font-weight: 600;
  color: #2c3e50;
  font-size: 1rem;
}

.prize-count {
  background: #27ae60;
  color: white;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.85rem;
}

.prize-desc {
  color: #666;
  font-size: 0.9rem;
  margin-left: auto;
}

.prize-actions {
  display: flex;
  gap: 6px;
}

.action-btn {
  width: 34px;
  height: 34px;
  border: none;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.action-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-btn.delete:hover {
  background: #fee2e2;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.empty-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 10px;
}

/* 列表动画 */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.list-move {
  transition: transform 0.3s ease;
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

/* 输入框样式 */
.modal-input {
  width: 100%;
  padding: 0.75rem 1rem;
  margin-top: 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 1rem;
  color: #181111;
  background: white;
  transition: all 0.2s;
}

.modal-input:focus {
  outline: none;
  border-color: #f42525;
  box-shadow: 0 0 0 3px rgba(244, 37, 37, 0.1);
}

.modal-input::placeholder {
  color: #9ca3af;
}

.dark .modal-input {
  background: #1f1a1a;
  border-color: #3d2a2a;
  color: white;
}

.dark .modal-input:focus {
  border-color: #f42525;
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
