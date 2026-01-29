<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  prizes: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['edit', 'delete', 'update:prizes'])

const searchQuery = ref('')
const draggedIndex = ref(null)

// 拖拽排序相关
function handleDragStart(event, index) {
  draggedIndex.value = index
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', index)
  event.target.classList.add('dragging')
}

function handleDragEnd(event) {
  event.target.classList.remove('dragging')
  draggedIndex.value = null
}

function handleDragOver(event, index) {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
}

function handleDrop(event, targetIndex) {
  event.preventDefault()
  if (draggedIndex.value === null || draggedIndex.value === targetIndex) return

  const prizes = [...props.prizes]
  const draggedItem = prizes[draggedIndex.value]
  prizes.splice(draggedIndex.value, 1)
  prizes.splice(targetIndex, 0, draggedItem)

  emit('update:prizes', prizes)
  draggedIndex.value = null
}

const filteredPrizes = computed(() => {
  if (!searchQuery.value) return props.prizes
  const query = searchQuery.value.toLowerCase()
  return props.prizes.filter(prize =>
    prize.name.toLowerCase().includes(query)
  )
})

// 分页配置
const PAGE_SIZE = 10
const currentPage = ref(1)

// 总页数
const totalPages = computed(() => Math.ceil(filteredPrizes.value.length / PAGE_SIZE))

// 当前页数据
const paginatedPrizes = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE
  return filteredPrizes.value.slice(start, end)
})

// 当前页显示的起始和结束索引
const pageStart = computed(() => (currentPage.value - 1) * PAGE_SIZE + 1)
const pageEnd = computed(() => Math.min(currentPage.value * PAGE_SIZE, filteredPrizes.value.length))

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

// 搜索时重置页码
import { watch } from 'vue'
watch(searchQuery, () => {
  currentPage.value = 1
})

function toggleResetPool(prize) {
  const updated = props.prizes.map(p =>
    p.id === prize.id ? { ...p, canReset: !p.canReset } : p
  )
  emit('update:prizes', updated)
}

function getStatusClass(status) {
  const statusMap = {
    ready: 'status-ready',
    incomplete: 'status-incomplete',
    closed: 'status-closed'
  }
  return statusMap[status] || 'status-ready'
}

function getStatusText(status) {
  const textMap = {
    ready: '已就绪',
    incomplete: '资料不全',
    closed: '已结束'
  }
  return textMap[status] || '已就绪'
}
</script>

<template>
  <section class="table-section">
    <div class="table-container">
      <div class="table-header">
        <h3>当前奖项列表(可拖拽排序)</h3>
        <div class="search-box">
          <span class="material-symbols-outlined search-icon">search</span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索奖项名称..."
            class="search-input"
          />
        </div>
      </div>

      <div class="table-wrapper">
        <table class="prize-table">
          <thead>
            <tr>
              <th class="th-drag"></th>
              <th class="th-info">奖项信息</th>
              <th class="th-center">发放数量</th>
              <th class="th-center">单次抽取</th>
              <th class="th-status">当前状态</th>
              <th class="th-actions text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(prize, index) in paginatedPrizes"
              :key="prize.id"
              class="prize-row"
              :class="{ 'draggable-row': true }"
              draggable="true"
              @dragstart="handleDragStart($event, (currentPage - 1) * PAGE_SIZE + index)"
              @dragend="handleDragEnd"
              @dragover="handleDragOver($event, (currentPage - 1) * PAGE_SIZE + index)"
              @drop="handleDrop($event, (currentPage - 1) * PAGE_SIZE + index)"
            >
              <td class="td-drag">
                <span class="material-symbols-outlined drag-handle">drag_indicator</span>
              </td>
              <td class="td-info">
                <div class="prize-info">
                  <div class="prize-image" :style="prize.image ? { backgroundImage: `url(${prize.image})` } : {}">
                    <span v-if="!prize.image" class="material-symbols-outlined">gift</span>
                  </div>
                  <div class="prize-details">
                    <p class="prize-name">
                      {{ prize.name }}
                      <span v-if="prize.isSpecial" class="material-symbols-outlined star-icon">star</span>
                    </p>
                    <p class="prize-desc">{{ prize.description }}</p>
                  </div>
                </div>
              </td>
              <td class="td-center">
                <span class="quantity">{{ prize.count }}</span>
              </td>
              <td class="td-center">
                <span class="batch-count">{{ prize.batchCount || 1 }} 人</span>
              </td>
              <td class="td-status">
                <span :class="['status-badge', getStatusClass(prize.status)]">
                  {{ getStatusText(prize.status) }}
                </span>
              </td>
              <td class="td-actions">
                <div class="action-buttons">
                  <button class="action-btn edit" @click="emit('edit', prize)">
                    <span class="material-symbols-outlined">edit</span>
                    编辑
                  </button>
                  <button class="action-btn delete" @click="emit('delete', prize.id)">
                    <span class="material-symbols-outlined">delete</span>
                    删除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="filteredPrizes.length === 0" class="empty-state">
          <span class="material-symbols-outlined empty-icon">inbox</span>
          <p>暂无奖项数据</p>
        </div>
      </div>

      <!-- 分页控制器 -->
      <div v-if="totalPages > 1" class="table-footer">
        <p class="pagination-info">
          显示第 {{ pageStart }} 至 {{ pageEnd }} 条记录，共 {{ filteredPrizes.length }} 条
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
  </section>
</template>

<style scoped>
.table-section {
  flex: 1;
  padding-bottom: 3rem;
}

.table-container {
  background: white;
  border-radius: 1.5rem;
  border: 1px solid #e6dbdb;
  overflow: hidden;
}

:global(.dark) .table-container {
  background: #2d1a1a;
  border-color: #3d2a2a;
}

.table-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e6dbdb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

:global(.dark) .table-header {
  border-color: #3d2a2a;
}

.table-header h3 {
  font-size: 1.125rem;
  font-weight: 700;
  color: #181111;
}

:global(.dark) .table-header h3 {
  color: white;
}

.search-box {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 1.125rem;
  color: #9ca3af;
}

.search-input {
  padding: 0.5rem 1rem 0.5rem 2.25rem;
  background: #f8f5f5;
  border: none;
  border-radius: 9999px;
  font-size: 0.875rem;
  width: 16rem;
  color: #181111;
}

:global(.dark) .search-input {
  background: #3d2a2a;
  color: white;
}
.search-input:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(244, 37, 37, 0.2);
}

.table-wrapper {
  overflow-x: auto;
}

.prize-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.prize-table th {
  padding: 1rem 1.5rem;
  background: rgba(248, 245, 245, 0.5);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #8a6060;
}

:global(.dark) .prize-table th {
  background: rgba(61, 42, 42, 0.5);
  color: #9ca3af;
}

.prize-table th.th-center,
.prize-table td.td-center {
  text-align: center;
}

.prize-table th.th-actions,
.prize-table td.td-actions {
  text-align: center;
}

.prize-row {
  border-bottom: 1px solid #e6dbdb;
  transition: background-color 0.2s;
}

:global(.dark) .prize-row {
  border-color: #3d2a2a;
}

.prize-row:hover {
  background: rgba(248, 245, 245, 0.3);
}

:global(.dark) .prize-row:hover {
  background: rgba(255, 255, 255, 0.05);
}

/* 拖拽相关样式 */
.th-drag {
  width: 40px !important;
}

.td-drag {
  width: 40px !important;
  padding: 1.25rem 0.5rem !important;
}

.drag-handle {
  color: #9ca3af;
  cursor: grab;
  transition: color 0.2s;
  font-size: 1.25rem;
}

.drag-handle:hover {
  color: #f42525;
}

.drag-handle:active {
  cursor: grabbing;
}

.draggable-row {
  cursor: move;
}

.draggable-row.dragging {
  opacity: 0.5;
  background: rgba(244, 37, 37, 0.1);
}

:global(.dark) .draggable-row.dragging {
  background: rgba(244, 37, 37, 0.2);
}

.prize-table td {
  padding: 1.25rem 1.5rem;
}

/* 奖项信息列 */
.td-info {
  min-width: 300px;
}

.prize-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.prize-image {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 1rem;
  background: #f8f5f5;
  border: 2px solid rgba(212, 175, 55, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background-size: cover;
  background-position: center;
}

:global(.dark) .prize-image {
  background: #3d2a2a;
  border-color: #4d3a3a;
}

.prize-image :deep(.material-symbols-outlined) {
  font-size: 1.5rem;
  color: #8a6060;
}

.prize-details {
  flex: 1;
}

.prize-name {
  font-weight: 600;
  color: #181111;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

:global(.dark) .prize-name {
  color: white;
}

.star-icon {
  font-size: 1.125rem;
  color: #D4AF37;
}

.prize-desc {
  font-size: 0.875rem;
  color: #8a6060;
  margin-top: 0.25rem;
}

:global(.dark) .prize-desc {
  color: #9ca3af;
}

/* 数量 & 单次抽取 */
.quantity, .batch-count {
  font-size: 1.125rem;
  font-weight: 700;
  color: #181111;
}

.batch-count {
  color: #f42525;
}

:global(.dark) .quantity, :global(.dark) .amount {
  color: white;
}

:global(.dark) .amount {
  color: #f87171;
}

/* 开关 */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 2.75rem;
  height: 1.5rem;
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

/* 状态标签 */
.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
  border: 1px solid;
}

.status-ready {
  background: #dcfce7;
  color: #16a34a;
  border-color: #bbf7d0;
}

:global(.dark) .status-ready {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  border-color: rgba(34, 197, 94, 0.3);
}

.status-incomplete {
  background: #fef3c7;
  color: #d97706;
  border-color: #fde68a;
}

:global(.dark) .status-incomplete {
  background: rgba(217, 119, 6, 0.2);
  color: #fbbf24;
  border-color: rgba(217, 119, 6, 0.3);
}

.status-closed {
  background: #f3f4f6;
  color: #6b7280;
  border-color: #e5e7eb;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
}

.action-btn {
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  border: 1px solid #e6dbdb;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
}

:global(.dark) .action-btn {
  border-color: #3d2a2a;
  color: #9ca3af;
}

.action-btn:hover {
  background: #f8f5f5;
  border-color: #f42525;
  color: #f42525;
}

:global(.dark) .action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.action-btn :deep(.material-symbols-outlined) {
  font-size: 1rem;
}

.action-btn.delete {
  color: #ef4444;
  border-color: #fecaca;
}

.action-btn.delete:hover {
  background: #fef2f2;
  border-color: #ef4444;
}

:global(.dark) .action-btn.delete {
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.3);
}

:global(.dark) .action-btn.delete:hover {
  background: rgba(239, 68, 68, 0.1);
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
</style>
