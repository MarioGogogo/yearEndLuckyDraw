<script setup>
import { ref } from 'vue'
import * as XLSX from 'xlsx'

const props = defineProps({
  participants: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:participants'])

const isDragging = ref(false)
const uploadProgress = ref(0)
const uploadStatus = ref('')
const fileInput = ref(null)

// 拖拽进入
function handleDragEnter(e) {
  e.preventDefault()
  isDragging.value = true
}

// 拖拽离开
function handleDragLeave(e) {
  e.preventDefault()
  isDragging.value = false
}

// 拖拽结束
function handleDragEnd(e) {
  e.preventDefault()
  isDragging.value = false
}

// 解析 Excel 文件
function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })

        // 获取第一个工作表
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]

        // 转换为 JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        resolve(jsonData)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsArrayBuffer(file)
  })
}

// 处理文件
async function handleFile(file) {
  if (!file) return

  // 验证文件类型
  const validTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
  const validExtensions = ['.xlsx', '.xls']

  const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))

  if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
    alert('请上传 Excel 文件（.xlsx 或 .xls）')
    return
  }

  uploadStatus.value = '正在解析文件...'
  uploadProgress.value = 30

  try {
    const jsonData = await parseExcel(file)
    uploadProgress.value = 60

    // 处理数据 - 支持多种列名格式
    const processedData = jsonData.map((row, index) => {
      // 尝试匹配常见列名
      const name = row.姓名 || row.name || row.Name || row['姓名'] || row['名字'] || ''
      const phone = row.手机 || row.phone || row.Phone || row['手机'] || row['手机号'] || ''
      const department = row.部门 || row.department || row.Department || row['部门'] || ''

      return {
        id: Date.now() + index,
        name: String(name).trim(),
        phone: String(phone).trim(),
        department: String(department).trim(),
        rawData: { ...row }
      }
    }).filter(item => item.name) // 过滤掉没有姓名的记录

    uploadProgress.value = 90

    // 确认导入
    if (processedData.length === 0) {
      alert('未能解析到有效的参与人员数据，请检查文件格式')
      uploadStatus.value = ''
      uploadProgress.value = 0
      return
    }

    const action = confirm(
      `解析到 ${processedData.length} 条有效数据。\n\n` +
      `点击「确定」追加到现有名单，点击「取消」替换现有名单`
    )

    if (action) {
      // 追加
      emit('update:participants', [...props.participants, ...processedData])
      uploadStatus.value = `成功追加 ${processedData.length} 条数据`
    } else {
      // 替换
      emit('update:participants', processedData)
      uploadStatus.value = `成功导入 ${processedData.length} 条数据`
    }

    uploadProgress.value = 100

    // 3秒后清除状态
    setTimeout(() => {
      uploadStatus.value = ''
      uploadProgress.value = 0
    }, 3000)

  } catch (error) {
    console.error('解析失败:', error)
    alert('文件解析失败，请检查文件格式是否正确')
    uploadStatus.value = ''
    uploadProgress.value = 0
  }
}

// 文件选择
function handleFileSelect(e) {
  const file = e.target.files[0]
  handleFile(file)
  e.target.value = '' // 清空选择
}

// 拖放处理
function handleDrop(e) {
  e.preventDefault()
  isDragging.value = false

  const file = e.dataTransfer.files[0]
  handleFile(file)
}

// 手动添加人员
const manualEntry = ref({
  name: '',
  phone: '',
  department: ''
})

function addManualEntry() {
  if (!manualEntry.value.name.trim()) {
    alert('请输入姓名')
    return
  }

  const newParticipant = {
    id: Date.now(),
    name: manualEntry.value.name.trim(),
    phone: manualEntry.value.phone.trim(),
    department: manualEntry.value.department.trim()
  }

  emit('update:participants', [...props.participants, newParticipant])
  manualEntry.value = { name: '', phone: '', department: '' }
}

// 删除人员
function removeParticipant(id) {
  emit('update:participants', props.participants.filter(p => p.id !== id))
}

// 批量删除选中
const selectedIds = ref(new Set())

function toggleSelect(id) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
}

function selectAll() {
  if (selectedIds.value.size === props.participants.length) {
    selectedIds.value.clear()
  } else {
    props.participants.forEach(p => selectedIds.value.add(p.id))
  }
}

function removeSelected() {
  if (selectedIds.value.size === 0) return
  if (!confirm(`确定要删除选中的 ${selectedIds.value.size} 人吗？`)) return

  emit('update:participants', props.participants.filter(p => !selectedIds.value.has(p.id)))
  selectedIds.value.clear()
}

// 导出名单
function exportParticipants() {
  if (props.participants.length === 0) {
    alert('暂无数据可导出')
    return
  }

  // 创建工作表
  const data = props.participants.map(p => ({
    姓名: p.name,
    手机: p.phone,
    部门: p.department
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '参与人员')

  // 导出
  const fileName = `抽奖名单_${new Date().toLocaleDateString()}.xlsx`
  XLSX.writeFile(workbook, fileName)
}

// 导出中奖记录模板
function downloadTemplate() {
  const template = [
    { 姓名: '示例张三', 手机: '13800138000', 部门: '技术部' },
    { 姓名: '示例李四', 手机: '13900139000', 部门: '市场部' }
  ]

  const worksheet = XLSX.utils.json_to_sheet(template)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '模板')

  XLSX.writeFile(workbook, '抽奖名单模板.xlsx')
}
</script>

<template>
  <div class="participant-upload">
    <div class="card">
      <div class="card-header">
        <h2>👥 参与人员名单</h2>
        <div class="header-actions">
          <button class="template-btn" @click="downloadTemplate">
            📥 下载模板
          </button>
          <button
            class="export-btn"
            @click="exportParticipants"
            :disabled="participants.length === 0"
          >
            📤 导出名单
          </button>
        </div>
      </div>

      <!-- 上传区域 -->
      <div
        class="upload-zone"
        :class="{ dragging: isDragging }"
        @dragenter="handleDragEnter"
        @dragover="handleDragEnter"
        @dragleave="handleDragLeave"
        @dragend="handleDragEnd"
        @drop="handleDrop"
      >
        <input
          ref="fileInput"
          type="file"
          accept=".xlsx,.xls"
          class="file-input"
          @change="handleFileSelect"
        />
        <div class="upload-content">
          <span class="upload-icon">📁</span>
          <p class="upload-text">拖拽 Excel 文件到此处，或 <span class="browse-btn">浏览文件</span></p>
          <p class="upload-hint">支持 .xlsx 和 .xls 格式</p>
        </div>
      </div>

      <!-- 上传进度 -->
      <div v-if="uploadProgress > 0" class="upload-progress">
        <div class="progress-bar" :style="{ width: uploadProgress + '%' }"></div>
        <span class="progress-text">{{ uploadStatus }}</span>
      </div>

      <!-- 手动添加 -->
      <div class="manual-entry">
        <h4>手动添加</h4>
        <div class="manual-form">
          <input
            v-model="manualEntry.name"
            type="text"
            placeholder="姓名"
            class="form-input"
            @keyup.enter="addManualEntry"
          />
          <input
            v-model="manualEntry.phone"
            type="text"
            placeholder="手机号（可选）"
            class="form-input"
            @keyup.enter="addManualEntry"
          />
          <input
            v-model="manualEntry.department"
            type="text"
            placeholder="部门（可选）"
            class="form-input"
            @keyup.enter="addManualEntry"
          />
          <button class="add-btn" @click="addManualEntry">➕ 添加</button>
        </div>
      </div>

      <!-- 批量操作 -->
      <div v-if="participants.length > 0" class="batch-actions">
        <label class="select-all">
          <input
            type="checkbox"
            :checked="selectedIds.size === participants.length && participants.length > 0"
            :indeterminate="selectedIds.size > 0 && selectedIds.size < participants.length"
            @change="selectAll"
          />
          <span>全选</span>
        </label>
        <span class="selected-count">已选择 {{ selectedIds.size }} 人</span>
        <button
          class="batch-delete-btn"
          @click="removeSelected"
          :disabled="selectedIds.size === 0"
        >
          🗑️ 删除选中
        </button>
      </div>

      <!-- 人员列表 -->
      <div class="participant-list">
        <transition-group name="list">
          <div
            v-for="person in participants"
            :key="person.id"
            class="participant-item"
            :class="{ selected: selectedIds.has(person.id) }"
            @click="toggleSelect(person.id)"
          >
            <div class="checkbox">
              <span v-if="selectedIds.has(person.id)">✓</span>
            </div>
            <div class="person-info">
              <span class="person-name">{{ person.name }}</span>
              <span v-if="person.phone" class="person-phone">{{ person.phone }}</span>
              <span v-if="person.department" class="person-dept">{{ person.department }}</span>
            </div>
            <button
              class="delete-btn"
              @click.stop="removeParticipant(person.id)"
              title="删除"
            >
              ×
            </button>
          </div>
        </transition-group>

        <div v-if="participants.length === 0" class="empty-state">
          <span class="empty-icon">👥</span>
          <p>暂无参与人员</p>
          <p class="empty-hint">上传 Excel 文件或手动添加</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.participant-upload {
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

.header-actions {
  display: flex;
  gap: 10px;
}

.template-btn,
.export-btn {
  padding: 8px 16px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.template-btn:hover,
.export-btn:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.export-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 上传区域 */
.upload-zone {
  border: 2px dashed #e2e8f0;
  border-radius: 12px;
  padding: 30px;
  text-align: center;
  transition: all 0.3s;
  position: relative;
  cursor: pointer;
}

.upload-zone:hover,
.upload-zone.dragging {
  border-color: #3498db;
  background: #f0f9ff;
}

.file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.upload-icon {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 10px;
}

.upload-text {
  color: #666;
  font-size: 1rem;
}

.browse-btn {
  color: #3498db;
  font-weight: 600;
}

.upload-hint {
  color: #999;
  font-size: 0.85rem;
  margin-top: 6px;
}

/* 上传进度 */
.upload-progress {
  margin-top: 16px;
  background: #f1f5f9;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  height: 32px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #3498db, #2ecc71);
  transition: width 0.3s ease;
}

.progress-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #2c3e50;
  font-size: 0.9rem;
  font-weight: 500;
}

/* 手动添加 */
.manual-entry {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}

.manual-entry h4 {
  font-size: 1rem;
  color: #666;
  margin-bottom: 12px;
}

.manual-form {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.form-input {
  flex: 1;
  min-width: 120px;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.95rem;
}

.form-input:focus {
  outline: none;
  border-color: #3498db;
}

.add-btn {
  padding: 10px 20px;
  background: #27ae60;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: all 0.2s;
}

.add-btn:hover {
  background: #219a52;
}

/* 批量操作 */
.batch-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
  padding: 12px 16px;
  background: #f8fafc;
  border-radius: 10px;
}

.select-all {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.select-all input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.selected-count {
  color: #666;
  font-size: 0.9rem;
}

.batch-delete-btn {
  margin-left: auto;
  padding: 8px 16px;
  background: #fff5f5;
  color: #e74c3c;
  border: 1px solid #fecaca;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.batch-delete-btn:hover:not(:disabled) {
  background: #fee2e2;
}

.batch-delete-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 人员列表 */
.participant-list {
  margin-top: 20px;
  max-height: 350px;
  overflow-y: auto;
}

.participant-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #f8fafc;
  border-radius: 10px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.participant-item:hover {
  background: #f1f5f9;
}

.participant-item.selected {
  background: #e0f2fe;
  border: 1px solid #7dd3fc;
}

.checkbox {
  width: 22px;
  height: 22px;
  border: 2px solid #cbd5e1;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  color: white;
  transition: all 0.2s;
}

.participant-item.selected .checkbox {
  background: #3498db;
  border-color: #3498db;
}

.person-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.person-name {
  font-weight: 600;
  color: #2c3e50;
}

.person-phone {
  color: #666;
  font-size: 0.9rem;
}

.person-dept {
  background: #e8f5e9;
  color: #27ae60;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
}

.delete-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: #999;
  font-size: 1.3rem;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.delete-btn:hover {
  background: #fee2e2;
  color: #e74c3c;
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

.empty-hint {
  font-size: 0.85rem;
  margin-top: 8px;
}

/* 动画 */
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
