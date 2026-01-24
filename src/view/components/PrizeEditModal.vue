<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  prize: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'save'])

const isClosing = ref(false)

const form = ref({
  name: '',
  count: 1,
  amount: 1000,
  description: '',
  image: '',
  canReset: true
})

// 监听 prize 变化，同步表单数据
watch(() => props.prize, (newPrize) => {
  if (newPrize) {
    form.value = {
      name: newPrize.name || '',
      count: newPrize.count || 1,
      amount: newPrize.amount || 0,
      description: newPrize.description || '',
      image: newPrize.image || '',
      canReset: newPrize.canReset !== undefined ? newPrize.canReset : true
    }
  }
}, { immediate: true })

function handleSave() {
  if (isClosing.value) return
  isClosing.value = true
  emit('close')
  setTimeout(() => {
    emit('save', { ...form.value, id: props.prize?.id })
    isClosing.value = false
  }, 500)
}

function handleClose() {
  if (isClosing.value) return
  isClosing.value = true
  emit('close')
  setTimeout(() => {
    isClosing.value = false
  }, 500)
}

function handleImageUpload(event) {
  const file = event.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      form.value.image = e.target.result
    }
    reader.readAsDataURL(file)
  }
}

function handleDrop(event) {
  event.preventDefault()
  const file = event.dataTransfer.files[0]
  if (file && file.type.startsWith('image/')) {
    const reader = new FileReader()
    reader.onload = (e) => {
      form.value.image = e.target.result
    }
    reader.readAsDataURL(file)
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <section v-if="show" class="modal-overlay" @click.self="handleClose">
        <div class="modal-container">
          <div class="modal-header">
            <h4 class="modal-title">
              <span class="material-symbols-outlined">edit_square</span>
              编辑奖项：{{ prize?.name || '新建奖项' }}
            </h4>
            <button class="close-btn" @click="handleClose">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <div class="modal-body">
            <!-- 奖项名称 -->
            <div class="form-group">
              <label>奖项名称</label>
              <input
                v-model="form.name"
                type="text"
                class="form-input"
                placeholder="请输入奖项名称"
              />
            </div>

            <!-- 数量和稀有度 -->
            <div class="form-row">
              <div class="form-group">
                <label>发放数量</label>
                <input
                  v-model.number="form.count"
                  type="number"
                  min="1"
                  class="form-input"
                />
              </div>
              <div class="form-group">
                <label>奖品金额 (元)</label>
                <input
                  v-model.number="form.amount"
                  type="number"
                  min="0"
                  class="form-input"
                  placeholder="请输入金额"
                />
              </div>
            </div>

            <!-- 奖项描述 -->
            <div class="form-group">
              <label>奖项描述</label>
              <textarea
                v-model="form.description"
                class="form-input textarea"
                rows="3"
                placeholder="请输入奖项描述"
              ></textarea>
            </div>

            <!-- 奖项配图 -->
            <div class="form-group">
              <label>奖项配图</label>
              <div
                class="upload-zone"
                :class="{ hasImage: form.image }"
                @dragover.prevent
                @drop="handleDrop"
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  class="file-input"
                  @change="handleImageUpload"
                />
                <div v-if="form.image" class="preview-image">
                  <img :src="form.image" alt="奖品图片" />
                </div>
                <div v-else class="upload-placeholder">
                  <span class="material-symbols-outlined upload-icon">cloud_upload</span>
                  <p>点击或拖拽图片 <span class="upload-hint">上传</span> (PNG/JPG)</p>
                </div>
              </div>
            </div>

            <!-- 回池重抽开关 -->
            <div class="toggle-card">
              <div class="toggle-info">
                <p class="toggle-title">回池重抽</p>
                <p class="toggle-desc">若中奖人不在场，则将该名额重回奖池</p>
              </div>
              <label class="toggle-switch">
                <input v-model="form.canReset" type="checkbox" />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div class="modal-footer">
            <button class="save-btn" @click="handleSave">
              保存修改
            </button>
          </div>
        </div>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: transparent;
  z-index: 40;
  display: flex;
  justify-content: flex-end;
  align-items: flex-end;
  padding: 2rem;
}

.modal-container {
  width: 400px;
  background: white;
  border-radius: 1.5rem;
  border: 1px solid rgba(244, 37, 37, 0.2);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 4px rgba(244, 37, 37, 0.05);
  overflow: hidden;
}

:global(.dark) .modal-container {
  background: #2d1a1a;
}

.modal-header {
  background: #f42525;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: white;
}

.modal-title {
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.modal-title :deep(.material-symbols-outlined) {
  font-size: 1.25rem;
}

.close-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
  transition: color 0.2s;
}

.close-btn:hover {
  color: white;
}

.close-btn :deep(.material-symbols-outlined) {
  font-size: 1.25rem;
}

.modal-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #8a6060;
}

:global(.dark) .form-group label {
  color: #9ca3af;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  background: #f8f5f5;
  border: none;
  border-radius: 1rem;
  font-size: 0.95rem;
  font-weight: 500;
  color: #181111;
  transition: ring 0.2s;
}

:global(.dark) .form-input {
  background: #3d2a2a;
  color: white;
}

.form-input:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(244, 37, 37, 0.5);
}

.form-input.textarea {
  resize: vertical;
  min-height: 80px;
}

/* 上传区域 */
.upload-zone {
  border: 2px dashed #e6dbdb;
  border-radius: 1rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: rgba(248, 245, 245, 0.5);
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  min-height: 100px;
}

:global(.dark) .upload-zone {
  background: rgba(61, 42, 42, 0.5);
  border-color: #4d3a3a;
}

.upload-zone:hover,
.upload-zone.hasImage {
  border-color: rgba(244, 37, 37, 0.5);
}

.file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.upload-placeholder {
  text-align: center;
}

.upload-icon {
  font-size: 2rem;
  color: #9ca3af;
  transition: color 0.2s;
}

.upload-zone:hover .upload-icon {
  color: #f42525;
}

.upload-placeholder p {
  font-size: 0.8rem;
  color: #8a6060;
}

:global(.dark) .upload-placeholder p {
  color: #9ca3af;
}

.upload-hint {
  color: #f42525;
  font-weight: 700;
}

.preview-image {
  width: 100%;
  max-height: 150px;
  display: flex;
  justify-content: center;
}

.preview-image img {
  max-width: 100%;
  max-height: 150px;
  object-fit: contain;
  border-radius: 0.5rem;
}

/* 开关卡片 */
.toggle-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: rgba(244, 37, 37, 0.05);
  border-radius: 1rem;
  border: 1px solid rgba(244, 37, 37, 0.1);
}

:global(.dark) .toggle-card {
  background: rgba(244, 37, 37, 0.1);
}

.toggle-info {
  flex: 1;
}

.toggle-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: #f42525;
}

.toggle-desc {
  font-size: 0.7rem;
  color: #8a6060;
  line-height: 1.3;
  margin-top: 0.25rem;
}

:global(.dark) .toggle-desc {
  color: #9ca3af;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 2.75rem;
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
  transform: translateX(1.25rem);
  border-color: white;
}

/* 底部按钮 */
.modal-footer {
  padding: 0.5rem 1.5rem 1.5rem;
}

.save-btn {
  width: 100%;
  padding: 0.75rem 1.5rem;
  background: #f42525;
  color: white;
  border: none;
  border-radius: 9999px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  box-shadow: 0 10px 25px -5px rgba(244, 37, 37, 0.3);
  transition: transform 0.2s;
}

.save-btn:hover {
  transform: scale(1.02);
}

.save-btn:active {
  transform: scale(0.98);
}

/* 动画 */
@keyframes slideIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes slideOut {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(100%);
  }
}

.modal-enter-active .modal-container {
  animation: slideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.modal-leave-active .modal-container {
  animation: slideOut 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
</style>
