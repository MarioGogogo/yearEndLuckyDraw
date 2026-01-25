<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '确认操作'
  },
  message: {
    type: String,
    default: ''
  },
  confirmText: {
    type: String,
    default: '确定'
  },
  cancelText: {
    type: String,
    default: '取消'
  },
  confirmDanger: {
    type: Boolean,
    default: false
  },
  icon: {
    type: String,
    default: 'help' // help | warning | danger | success
  }
})

const emit = defineEmits(['confirm', 'cancel'])

const isClosing = ref(false)

const iconMap = {
  help: 'help',
  warning: 'warning',
  danger: 'error',
  success: 'check_circle'
}

function handleConfirm() {
  if (isClosing.value) return
  isClosing.value = true
  setTimeout(() => {
    emit('confirm')
    isClosing.value = false
  }, 300)
}

function handleCancel() {
  if (isClosing.value) return
  isClosing.value = true
  setTimeout(() => {
    emit('cancel')
    isClosing.value = false
  }, 300)
}

// 监听 show 变化，重置关闭状态
watch(() => props.show, (newVal) => {
  if (newVal) {
    isClosing.value = false
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-overlay" @click.self="handleCancel">
        <div class="modal-container">
          <div class="modal-header">
            <div class="modal-icon" :class="'icon-' + icon">
              <span class="material-symbols-outlined">{{ iconMap[icon] }}</span>
            </div>
            <h3 class="modal-title">{{ title }}</h3>
          </div>

          <div class="modal-body">
            <p class="modal-message">{{ message }}</p>
          </div>

          <div class="modal-footer">
            <button
              v-if="cancelText"
              class="modal-btn modal-btn-cancel"
              @click="handleCancel"
            >
              {{ cancelText }}
            </button>
            <button
              class="modal-btn"
              :class="{ 'modal-btn-danger': confirmDanger }"
              @click="handleConfirm"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
}

.modal-container {
  background: white;
  border-radius: 1rem;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

:global(.dark) .modal-container {
  background: #2d1a1a;
}

.modal-header {
  padding: 1.5rem 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.modal-icon {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(244, 37, 37, 0.1);
}

.modal-icon.icon-warning,
.modal-icon.icon-danger {
  background: rgba(244, 37, 37, 0.1);
}

.modal-icon.icon-success {
  background: rgba(34, 197, 94, 0.1);
}

.modal-icon :deep(.material-symbols-outlined) {
  font-size: 2rem;
  color: #f42525;
}

.modal-icon.icon-success :deep(.material-symbols-outlined) {
  color: #22c55e;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #181111;
  text-align: center;
}

:global(.dark) .modal-title {
  color: white;
}

.modal-body {
  padding: 0 1.5rem 1.5rem;
}

.modal-message {
  font-size: 0.95rem;
  color: #6b7280;
  text-align: center;
  line-height: 1.6;
  white-space: pre-line;
}

:global(.dark) .modal-message {
  color: #9ca3af;
}

.modal-footer {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem 1.5rem;
  background: #f8f5f5;
}

:global(.dark) .modal-footer {
  background: rgba(255, 255, 255, 0.05);
}

.modal-btn {
  min-width: 100px;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  background: #f42525;
  color: white;
}

.modal-btn:hover {
  background: #dc2626;
  transform: translateY(-1px);
}

.modal-btn-cancel {
  background: white;
  border: 1px solid #e5e7eb;
  color: #6b7280;
}

:global(.dark) .modal-btn-cancel {
  background: #374151;
  border-color: #4b5563;
  color: #9ca3af;
}

.modal-btn-cancel:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

:global(.dark) .modal-btn-cancel:hover {
  background: #4b5563;
}

.modal-btn-danger {
  background: #f42525;
}

.modal-btn-danger:hover {
  background: #dc2626;
}

/* 动画 */
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
  transform: scale(0.9) translateY(10px);
}
</style>
