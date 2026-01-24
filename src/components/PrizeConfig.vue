<script setup>
import { ref } from 'vue'

const props = defineProps({
  prizes: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:prizes'])

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

  emit('update:prizes', [...props.prizes, prize])

  // 重置表单
  newPrize.value = { name: '', count: 1, description: '' }
}

// 删除奖品
function removePrize(id) {
  if (confirm('确定要删除这个奖品吗？')) {
    emit('update:prizes', props.prizes.filter(p => p.id !== id))
  }
}

// 编辑奖品
function editPrize(prize) {
  const newName = prompt('请输入新的奖品名称：', prize.name)
  if (newName !== null && newName.trim()) {
    const updated = props.prizes.map(p =>
      p.id === prize.id ? { ...p, name: newName.trim() } : p
    )
    emit('update:prizes', updated)
  }
}

// 调整数量
function adjustCount(prize, delta) {
  const newCount = Math.max(1, prize.count + delta)
  const updated = props.prizes.map(p =>
    p.id === prize.id ? { ...p, count: newCount } : p
  )
  emit('update:prizes', updated)
}

// 上移
function moveUp(index) {
  if (index === 0) return
  const updated = [...props.prizes]
  ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
  emit('update:prizes', updated)
}

// 下移
function moveDown(index) {
  if (index === props.prizes.length - 1) return
  const updated = [...props.prizes]
  ;[updated[index], updated[index + 1]] = [updated[index + 1], updated[index]]
  emit('update:prizes', updated)
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
