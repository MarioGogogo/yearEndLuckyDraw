<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import * as XLSX from 'xlsx'

const props = defineProps({
  participants: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:participants'])

// 缓存 key
const STORAGE_KEY = 'lottery_participants'

// 本地状态
const localParticipants = ref([])
const isDragging = ref(false)
const fileInput = ref(null)

// 新增人员弹窗状态
const showAddModal = ref(false)
const newParticipant = ref({
  name: '',
  department: '',
  gender: 'male', // 默认男
  contact: ''
})

// 分页配置
const PAGE_SIZE = 10
const currentPage = ref(1)

// 计算总页数
const totalPages = computed(() => Math.ceil(totalCount.value / PAGE_SIZE))

// 当前页的数据
const currentPageData = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE
  return localParticipants.value.slice(start, end)
})

// 当前页显示的起始和结束索引
const pageStart = computed(() => (currentPage.value - 1) * PAGE_SIZE + 1)

const pageEnd = computed(() => Math.min(currentPage.value * PAGE_SIZE, totalCount.value))

// 跳转到指定页
function goToPage(page) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

// 上一页
function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

// 下一页
function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

// 获取中间页码（智能显示）
function getMiddlePages() {
  const pages = []
  const total = totalPages.value
  const current = currentPage.value

  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
  } else {
    let start = Math.max(2, current - 2)
    let end = Math.min(total - 1, current + 2)

    // 确保显示5个中间页
    if (end - start < 4) {
      if (current <= 4) {
        end = 6
      } else {
        start = total - 5
      }
    }

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
  }

  return pages
}

// 重置到第一页（当数据变化时）
watch(localParticipants, () => {
  if (currentPage.value > totalPages.value && totalPages.value > 0) {
    currentPage.value = 1
  }
})

// 监听外部 participants 变化
watch(() => props.participants, (newVal) => {
  localParticipants.value = newVal
}, { immediate: true, deep: true })

// 加载缓存
function loadFromCache() {
  try {
    const cached = localStorage.getItem(STORAGE_KEY)
    if (cached) {
      localParticipants.value = JSON.parse(cached)
    }
  } catch (e) {
    console.error('加载缓存失败:', e)
  }
}

// 保存缓存
function saveToCache() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localParticipants.value))
    emit('update:participants', localParticipants.value)
  } catch (e) {
    console.error('保存缓存失败:', e)
  }
}

// 统计数据
const totalCount = computed(() => localParticipants.value.length)

const pendingCount = computed(() =>
  localParticipants.value.filter(p => p.status === 'pending').length
)

const winnerCount = computed(() =>
  localParticipants.value.filter(p => p.status === 'won').length
)

const pendingPercent = computed(() => {
  if (totalCount.value === 0) return 0
  return ((pendingCount.value / totalCount.value) * 100).toFixed(1)
})

const winnerPercent = computed(() => {
  if (totalCount.value === 0) return 0
  return ((winnerCount.value / totalCount.value) * 100).toFixed(1)
})

// ========== 重复检测功能 ==========
const showDuplicateModal = ref(false)
const duplicateCheckResult = ref([])
const duplicateCheckType = ref('name') // 'name' 或 'nameAndDept'

// 检测重复员工
function checkDuplicates() {
  const participants = localParticipants.value
  const duplicates = []

  // 按姓名分组
  const nameGroups = {}
  participants.forEach(p => {
    const key = p.name.trim()
    if (!nameGroups[key]) {
      nameGroups[key] = []
    }
    nameGroups[key].push(p)
  })

  // 找出重复的姓名
  Object.keys(nameGroups).forEach(name => {
    if (nameGroups[name].length > 1) {
      duplicates.push({
        name,
        count: nameGroups[name].length,
        items: nameGroups[name].map(p => ({
          id: p.id,
          name: p.name,
          department: p.department || '未知部门',
          status: p.status
        }))
      })
    }
  })

  duplicateCheckResult.value = duplicates
  showDuplicateModal.value = true
}

// 关闭重复检测弹窗
function closeDuplicateModal() {
  showDuplicateModal.value = false
  duplicateCheckResult.value = []
}

// 移除重复员工（保留第一个）
function removeDuplicateItem(id) {
  if (confirm('确定要移除这条重复记录吗？')) {
    localParticipants.value = localParticipants.value.filter(p => p.id !== id)
    saveToCache()
    // 重新检测
    checkDuplicates()
  }
}

// 生成状态徽章颜色
function getStatusClass(status) {
  return status === 'won' ? 'status-won' : 'status-pending'
}

function getStatusText(status) {
  return status === 'won' ? '已中奖' : '待抽奖'
}

// 获取名字首字
function getInitials(name) {
  return name.charAt(0).toUpperCase()
}

// 获取随机颜色
function getColorClass(name) {
  const colorIndex = ['primary', 'amber', 'green', 'blue', 'purple', 'pink']
  const index = name.charCodeAt(0) % colorIndex.length
  return `color-${colorIndex[index]}`
}

// 处理文件上传
function handleFileUpload(event) {
  const file = event.target.files[0]
  if (!file) return

  const validTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv'
  ]
  const validExtensions = ['.xlsx', '.xls', '.csv']

  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))

  if (!validTypes.includes(file.type) && !validExtensions.includes(ext)) {
    alert('请上传 Excel 文件（.xlsx、.xls 或 .csv）')
    return
  }

  parseExcel(file)
}

// 解析 Excel
function parseExcel(file) {
  const reader = new FileReader()

  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result)
      const workbook = XLSX.read(data, { type: 'array' })
      const firstSheet = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheet]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      const newParticipants = jsonData.map((row, index) => {
        const name = row.姓名 || row.name || row.Name || row['姓名'] || ''
        return {
          id: Date.now() + index,
          name: String(name).trim(),
          department: String(row.部门 || row.department || row.Department || row['部门'] || '').trim(),
          email: String(row.邮箱 || row.email || row.Email || row['邮箱'] || row['邮箱地址'] || '').trim(),
          phone: String(row.手机 || row.phone || row['手机'] || row['手机号'] || '').trim(),
          status: 'pending',
          createdAt: new Date().toISOString()
        }
      }).filter(p => p.name)

      if (newParticipants.length === 0) {
        alert('未能解析到有效数据，请检查文件格式')
        return
      }

      const action = confirm(
        `解析到 ${newParticipants.length} 条有效数据。\n\n` +
        `点击「确定」追加到现有名单，点击「取消」替换现有名单`
      )

      if (action) {
        localParticipants.value = [...localParticipants.value, ...newParticipants]
      } else {
        localParticipants.value = newParticipants
      }

      saveToCache()
    } catch (error) {
      console.error('解析失败:', error)
      alert('文件解析失败，请检查文件格式是否正确')
    }
  }

  reader.onerror = () => alert('文件读取失败')
  reader.readAsArrayBuffer(file)
  event.target.value = ''
}

// 拖拽处理
function handleDragEnter(e) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave(e) {
  e.preventDefault()
  isDragging.value = false
}

function handleDrop(e) {
  e.preventDefault()
  isDragging.value = false

  const file = e.dataTransfer.files[0]
  if (file) {
    const event = { target: { files: [file] } }
    handleFileUpload(event)
  }
}

// 下载模板
function downloadTemplate() {
  const template = [
    { 姓名: '张三', 部门: '技术部', 邮箱: 'zhangsan@company.com', 手机: '13800138000' },
    { 姓名: '李四', 部门: '市场部', 邮箱: 'lisi@company.com', 手机: '13900139000' }
  ]

  const worksheet = XLSX.utils.json_to_sheet(template)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '员工名单')

  XLSX.writeFile(workbook, '员工名单导入模板.xlsx')
}

// 重置员工状态
function resetParticipant(id) {
  const participant = localParticipants.value.find(p => p.id === id)
  if (!participant) return

  // 如果已经是待抽奖状态，不需要重置
  if (participant.status === 'pending') {
    return
  }

  if (participant.status === 'won') {
    if (confirm('确定要将该员工重置为待抽奖状态吗？')) {
      participant.status = 'pending'
      saveToCache()
    }
  } else {
    // 其他状态也重置为 pending
    participant.status = 'pending'
    saveToCache()
  }
}

// 移除员工
function removeParticipant(id) {
  if (confirm('确定要移除该员工吗？')) {
    localParticipants.value = localParticipants.value.filter(p => p.id !== id)
    saveToCache()
  }
}

// 新增人员
function addParticipant() {
  newParticipant.value = {
    name: '',
    department: '',
    gender: 'male',
    contact: ''
  }
  showAddModal.value = true
}

function closeAddModal() {
  showAddModal.value = false
}

// 清空所有
function clearAll() {
  if (confirm('确定要清空所有参与人员吗？此操作不可恢复！')) {
    localParticipants.value = []
    saveToCache()
  }
}

function submitAddParticipant() {
  if (!newParticipant.value.name) {
    alert('请输入姓名')
    return
  }

  const person = {
    id: Date.now(),
    name: newParticipant.value.name.trim(),
    department: newParticipant.value.department.trim() || '未分类',
    gender: newParticipant.value.gender,
    email: newParticipant.value.contact.trim(),
    phone: '',
    status: 'pending',
    createdAt: new Date().toISOString()
  }

  localParticipants.value = [person, ...localParticipants.value]
  saveToCache()
  closeAddModal()
}

// 初始化
onMounted(() => {
  if (localParticipants.value.length === 0) {
    loadFromCache()
  }
  // 监听 localStorage 变化（其他页面修改数据后同步）
  window.addEventListener('storage', handleStorageChange)
})

onUnmounted(() => {
  window.removeEventListener('storage', handleStorageChange)
})

// 处理其他页面修改 localStorage
function handleStorageChange(e) {
  if (e.key === STORAGE_KEY) {
    loadFromCache()
  }
}
</script>

<template>
  <div class="participants-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <h2>参与人员管理</h2>
        <p>管理金马年年度抽奖活动的员工信息库。</p>
      </div>
      <div class="header-actions">
        <button class="action-btn-outline" @click="addParticipant">
          <span class="material-symbols-outlined">person_add</span>
          <span class="truncate">新增人员</span>
        </button>
        <button class="action-btn-outline check" @click="checkDuplicates">
          <span class="material-symbols-outlined">find_replace</span>
          <span class="truncate">检测重复</span>
        </button>
        <button class="action-btn-outline clear" @click="clearAll">
          <span class="material-symbols-outlined">delete_sweep</span>
          <span class="truncate">清空所有人员</span>
        </button>
      </div>
    </div>

    <!-- 上传区域 -->
    <div class="upload-section">
      <div class="upload-zone" :class="{ dragging: isDragging }" @dragenter="handleDragEnter" @dragover.prevent
        @dragleave="handleDragLeave" @drop="handleDrop">
        <input ref="fileInput" type="file" accept=".xlsx,.xls,.csv" class="file-input" @change="handleFileUpload" />
        <div class="upload-icon-wrap">
          <div class="upload-icon-bg">
            <span class="material-symbols-outlined">upload_file</span>
          </div>
          <div class="upload-text-wrap">
            <p class="upload-title">导入 Excel 名单</p>
            <p class="upload-hint">
              拖拽员工名单到此处或点击上传。支持 .xlsx 和 .csv 格式。
              <a class="download-link" href="#" @click.prevent="downloadTemplate">下载模板</a>
            </p>
          </div>
        </div>
        <button class="upload-btn">
          <span class="truncate">选择文件</span>
        </button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-header">
          <p class="stat-label">总人数</p>
          <span class="material-symbols-outlined stat-icon">groups</span>
        </div>
        <p class="stat-value">{{ totalCount.toLocaleString() }}</p>
        <div class="stat-badge success">
          <span class="material-symbols-outlined">trending_up</span>
          <span>100% 录入</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <p class="stat-label">待抽奖人数</p>
          <span class="material-symbols-outlined stat-icon success">check_circle</span>
        </div>
        <p class="stat-value">{{ pendingCount.toLocaleString() }}</p>
        <div class="stat-badge success">
          <span>{{ pendingPercent }}%</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <p class="stat-label">累计中奖人数</p>
          <span class="material-symbols-outlined stat-icon warning">workspace_premium</span>
        </div>
        <p class="stat-value">{{ winnerCount.toLocaleString() }}</p>
        <div class="stat-badge warning">
          <span>{{ winnerPercent }}%</span>
        </div>
      </div>
    </div>

    <!-- 员工名单表 -->
    <div class="table-container">
      <div class="table-header">
        <h2>员工名单表</h2>
        <div class="table-actions">
          <button class="action-icon-btn" title="筛选">
            <span class="material-symbols-outlined">filter_list</span>
          </button>
          <button class="action-icon-btn" title="刷新">
            <span class="material-symbols-outlined">refresh</span>
          </button>
        </div>
      </div>

      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th class="th-name">姓名</th>
              <th class="th-dept">部门</th>
              <th class="th-contact">联系方式</th>
              <th class="th-status">状态</th>
              <th class="th-actions text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="person in currentPageData" :key="person.id" class="data-row">
              <td class="td-name">
                <div class="name-cell">
                  <div class="avatar" :class="getColorClass(person.name)">
                    {{ getInitials(person.name) }}
                  </div>
                  <span class="name-text">{{ person.name }}</span>
                </div>
              </td>
              <td class="td-dept">{{ person.department || '-' }}</td>
              <td class="td-contact">{{ person.email || person.phone || '-' }}</td>
              <td class="td-status">
                <span :class="['status-badge', getStatusClass(person.status)]">
                  {{ getStatusText(person.status) }}
                </span>
              </td>
              <td class="td-actions">
                <div class="action-buttons">
                  <button class="action-icon-btn" :title="person.status === 'won' ? '重置中奖状态' : '重置参与状态'"
                    @click="resetParticipant(person.id)">
                    <span class="material-symbols-outlined">
                      {{ person.status === 'won' ? 'restart_alt' : 'history' }}
                    </span>
                  </button>
                  <button class="action-icon-btn delete" title="移除员工" @click="removeParticipant(person.id)">
                    <span class="material-symbols-outlined">person_remove</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="localParticipants.length === 0" class="empty-state">
          <span class="material-symbols-outlined empty-icon">inbox</span>
          <p>暂无参与人员数据</p>
          <p class="empty-hint">请上传 Excel 文件或手动添加</p>
        </div>
      </div>

      <div class="table-footer">
        <p class="pagination-info">
          显示第 {{ pageStart }} 至 {{ pageEnd }} 名员工，共 {{ totalCount.toLocaleString() }} 人
        </p>
        <div class="pagination" v-if="totalPages > 1">
          <button class="page-btn" :disabled="currentPage === 1" @click="prevPage">
            &lt;
          </button>
          <div class="page-numbers">
            <button class="page-number" :class="{ active: currentPage === 1 }" @click="goToPage(1)">
              1
            </button>
            <span v-if="currentPage > 3" class="page-ellipsis">...</span>
            <button v-for="page in getMiddlePages()" :key="page" class="page-number"
              :class="{ active: currentPage === page }" @click="goToPage(page)">
              {{ page }}
            </button>
            <span v-if="currentPage < totalPages - 2" class="page-ellipsis">...</span>
            <button class="page-number" :class="{ active: currentPage === totalPages }" @click="goToPage(totalPages)">
              {{ totalPages }}
            </button>
          </div>
          <button class="page-btn" :disabled="currentPage === totalPages" @click="nextPage">
            &gt;
          </button>
        </div>
      </div>
    </div>

    <!-- 提示信息 -->
    <div class="info-card">
      <div class="info-icon">
        <span class="material-symbols-outlined">info</span>
      </div>
      <div class="info-content">
        <h3>批量数据管理</h3>
        <p>
          需要更新大规模人员名单？您可以随时重新上传 Excel 文件。系统将自动识别现有员工并更新其信息，除非另有说明，否则将保留其"已中奖"状态。
        </p>
      </div>
    </div>

    <!-- 新增人员弹窗 -->
    <Transition name="modal">
      <div v-if="showAddModal" class="modal-overlay" @click.self="closeAddModal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>新增参与人员</h3>
            <button class="close-btn" @click="closeAddModal">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="form-group">
                <label>姓名</label>
                <input v-model="newParticipant.name" type="text" placeholder="请输入姓名" />
              </div>
              <div class="form-group">
                <label>部门</label>
                <input v-model="newParticipant.department" type="text" placeholder="请输入部门" />
              </div>
              <div class="form-group">
                <label>性别</label>
                <div class="gender-selection">
                  <label class="gender-label" :class="{ active: newParticipant.gender === 'male' }">
                    <input type="radio" v-model="newParticipant.gender" value="male" /> 男
                  </label>
                  <label class="gender-label" :class="{ active: newParticipant.gender === 'female' }">
                    <input type="radio" v-model="newParticipant.gender" value="female" /> 女
                  </label>
                </div>
              </div>
              <div class="form-group">
                <label>联系方式</label>
                <input v-model="newParticipant.contact" type="text" placeholder="手机号或邮箱" />
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="modal-cancel-btn" @click="closeAddModal">取消</button>
            <button class="modal-submit-btn" @click="submitAddParticipant">确定添加</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 重复检测结果弹窗 -->
    <Transition name="modal">
      <div v-if="showDuplicateModal" class="modal-overlay" @click.self="closeDuplicateModal">
        <div class="modal-content duplicate-modal">
          <div class="modal-header">
            <h3>重复员工检测结果</h3>
            <button class="close-btn" @click="closeDuplicateModal">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="modal-body">
            <div v-if="duplicateCheckResult.length === 0" class="no-duplicate">
              <span class="material-symbols-outlined success-icon">check_circle</span>
              <p>恭喜！未发现重复员工</p>
              <p class="hint">所有员工姓名都是唯一的</p>
            </div>
            <div v-else class="duplicate-list">
              <div class="duplicate-summary">
                <span class="material-symbols-outlined warning-icon">warning</span>
                <p>发现 <strong>{{ duplicateCheckResult.length }}</strong> 组重复姓名</p>
              </div>
              <div class="duplicate-groups">
                <div v-for="group in duplicateCheckResult" :key="group.name" class="duplicate-group">
                  <div class="group-header">
                    <span class="group-name">{{ group.name }}</span>
                    <span class="group-count">{{ group.count }} 人</span>
                  </div>
                  <div class="group-items">
                    <div v-for="(item, index) in group.items" :key="item.id" class="group-item">
                      <div class="item-info">
                        <span class="item-dept">{{ item.department }}</span>
                        <span :class="['item-status', item.status === 'won' ? 'won' : '']">
                          {{ item.status === 'won' ? '已中奖' : '待抽奖' }}
                        </span>
                      </div>
                      <button v-if="index > 0" class="remove-btn" @click="removeDuplicateItem(item.id)" title="移除此记录">
                        <span class="material-symbols-outlined">delete</span>
                      </button>
                      <span v-else class="keep-mark">保留</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="modal-submit-btn" @click="closeDuplicateModal">关闭</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.participants-page {
  max-width: 1024px;
  width: 100%;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.modal-content {
  background: white;
  width: 100%;
  max-width: 500px;
  border-radius: 1.5rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  animation: modal-slide-in 0.3s ease-out;
}

:global(.dark) .modal-content {
  background: #1f1a1a;
  border: 1px solid rgba(244, 37, 37, 0.1);
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #f8f5f5;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

:global(.dark) .modal-header {
  border-color: #3d2a2a;
}

.modal-header h3 {
  font-size: 1.25rem;
  font-weight: 800;
  color: #181111;
}

:global(.dark) .modal-header h3 {
  color: white;
}

.close-btn {
  background: none;
  border: none;
  color: #8a6060;
  cursor: pointer;
  padding: 0.25rem;
  display: flex;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #f42525;
}

.modal-body {
  padding: 1.5rem;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

@media (max-width: 480px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 700;
  color: #181111;
}

:global(.dark) .form-group label {
  color: #d1d5db;
}

.gender-selection {
  display: flex;
  gap: 0.75rem;
  height: 100%;
  align-items: center;
}

.gender-label {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #f8f5f5;
  border: 2px solid transparent;
  border-radius: 0.75rem;
  cursor: pointer;
  font-weight: 600;
  color: #181111;
  transition: all 0.2s;
}

:global(.dark) .gender-label {
  background: #3d2a2a;
  color: white;
}

.gender-label.active {
  border-color: #f42525;
  background: rgba(244, 37, 37, 0.05);
  color: #f42525;
}

.gender-label input {
  display: none;
}

.form-group input {
  padding: 0.75rem 1rem;
  background: #f8f5f5;
  border: 2px solid transparent;
  border-radius: 0.75rem;
  font-size: 0.95rem;
  color: #181111;
  transition: all 0.2s;
}

:global(.dark) .form-group input {
  background: #3d2a2a;
  color: white;
}

.form-group input:focus {
  outline: none;
  background: white;
  border-color: #f42525;
  box-shadow: 0 0 0 4px rgba(244, 37, 37, 0.1);
}

:global(.dark) .form-group input:focus {
  background: #1f1a1a;
}

.modal-footer {
  padding: 1.25rem 1.5rem;
  background: #f8f5f5;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

:global(.dark) .modal-footer {
  background: rgba(255, 255, 255, 0.02);
}

.modal-cancel-btn {
  padding: 0.625rem 1.25rem;
  background: transparent;
  border: none;
  font-weight: 700;
  color: #8a6060;
  cursor: pointer;
}

.modal-submit-btn {
  padding: 0.625rem 1.5rem;
  background: #f42525;
  color: white;
  border: none;
  border-radius: 9999px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-submit-btn:hover {
  background: #dc2626;
  transform: translateY(-1px);
}

@keyframes modal-slide-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 动画效果 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

@media (max-width: 1024px) {
  .participants-page {
    width: 100%;
  }
}

/* 页面头部 */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
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

.action-btn-outline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: white;
  border: 1px solid #e6dbdb;
  border-radius: 9999px;
  color: #181111;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

:global(.dark) .action-btn-outline {
  background: rgba(255, 255, 255, 0.1);
  border-color: #3d2a2a;
  color: white;
}

.action-btn-outline:hover {
  background: rgba(244, 37, 37, 0.05);
  border-color: #f42525;
  color: #f42525;
}

.action-btn-outline.clear {
  color: #f42525;
}

.action-btn-outline.clear:hover {
  background: rgba(244, 37, 37, 0.08);
}

.action-btn-outline :deep(.material-symbols-outlined) {
  font-size: 1.25rem;
}

/* 上传区域 */
.upload-section {
  margin-bottom: 2rem;
}

.upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 2.5rem 1.5rem;
  background: white;
  border: 2px dashed rgba(244, 37, 37, 0.2);
  border-radius: 1.25rem;
  transition: all 0.3s;
  position: relative;
}

:global(.dark) .upload-zone {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(244, 37, 37, 0.2);
}

.upload-zone:hover,
.upload-zone.dragging {
  border-color: rgba(244, 37, 37, 0.4);
}

.file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.upload-icon-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.upload-icon-bg {
  width: 4rem;
  height: 4rem;
  background: rgba(244, 37, 37, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-icon-bg :deep(.material-symbols-outlined) {
  font-size: 2.5rem;
  color: #f42525;
}

.upload-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #181111;
}

:global(.dark) .upload-title {
  color: white;
}

.upload-hint {
  font-size: 0.875rem;
  color: #8a6060;
  text-align: center;
  max-width: 480px;
}

:global(.dark) .upload-hint {
  color: #9ca3af;
}

.download-link {
  color: #f42525;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 4px;
}

.upload-btn {
  padding: 0.6875rem 1.5rem;
  background: #f42525;
  color: white;
  border: none;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.015em;
  cursor: pointer;
  box-shadow: 0 10px 25px -5px rgba(244, 37, 37, 0.2);
  transition: all 0.2s;
}

.upload-btn:hover {
  background: #dc2626;
  transform: scale(1.02);
}

/* 统计卡片 */
.stats-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 2rem;
}

.stat-card {
  flex: 1;
  min-width: 158px;
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

.stat-value {
  font-size: 1.875rem;
  font-weight: 800;
  color: #181111;
  letter-spacing: -0.025em;
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
}

.stat-badge.success {
  background: rgba(7, 136, 7, 0.1);
  color: #078807;
}

.stat-badge.warning {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.stat-badge :deep(.material-symbols-outlined) {
  font-size: 1rem;
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
  letter-spacing: -0.015em;
}

:global(.dark) .table-header h2 {
  color: white;
}

.table-actions {
  display: flex;
  gap: 0.5rem;
}

.action-icon-btn {
  padding: 0.5rem;
  background: transparent;
  border: none;
  border-radius: 50%;
  color: #8a6060;
  cursor: pointer;
  transition: all 0.2s;
}

:global(.dark) .action-icon-btn {
  color: #9ca3af;
}

.action-icon-btn:hover {
  background: #f8f5f5;
}

:global(.dark) .action-icon-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.action-icon-btn.delete:hover {
  color: #dc2626;
}

.action-icon-btn :deep(.material-symbols-outlined) {
  font-size: 1.25rem;
}

/* 数据表格 */
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

.data-table tbody {
  border-top: 1px solid rgba(244, 37, 37, 0.05);
}

.data-row {
  border-bottom: 1px solid rgba(244, 37, 37, 0.05);
  transition: background-color 0.2s;
}

.data-row:hover {
  background: rgba(244, 37, 37, 0.05);
}

.data-table td {
  padding: 1rem 1.5rem;
}

/* 姓名列 */
.td-name {
  min-width: 160px;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
}

.avatar.color-primary {
  background: rgba(244, 37, 37, 0.1);
  color: #f42525;
}

.avatar.color-amber {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.avatar.color-green {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.avatar.color-blue {
  background: rgba(59, 130, 246, 0.1);
  color: #2563eb;
}

.avatar.color-purple {
  background: rgba(168, 85, 247, 0.1);
  color: #9333ea;
}

.avatar.color-pink {
  background: rgba(236, 72, 153, 0.1);
  color: #db2777;
}

.name-text {
  font-weight: 700;
  color: #181111;
}

:global(.dark) .name-text {
  color: white;
}

.td-dept,
.td-contact {
  color: #8a6060;
}

:global(.dark) .td-dept,
:global(.dark) .td-contact {
  color: #d1d5db;
}

/* 状态标签 */
.status-badge {
  display: inline-flex;
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
}

.status-pending {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

:global(.dark) .status-pending {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
}

.status-won {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

:global(.dark) .status-won {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

/* 操作列 */
.td-actions {
  text-align: right;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.25rem;
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

/* 提示卡片 */
.info-card {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  padding: 1.5rem;
  background: rgba(244, 37, 37, 0.05);
  border: 1px solid rgba(244, 37, 37, 0.2);
  border-radius: 1rem;
}

:global(.dark) .info-card {
  background: rgba(244, 37, 37, 0.1);
}

.info-icon {
  color: #f42525;
  margin-top: 0.25rem;
}

.info-icon :deep(.material-symbols-outlined) {
  font-size: 1.25rem;
}

.info-content h3 {
  font-weight: 700;
  color: #181111;
}

:global(.dark) .info-content h3 {
  color: white;
}

.info-content p {
  font-size: 0.875rem;
  color: #8a6060;
  margin-top: 0.25rem;
  line-height: 1.6;
}

:global(.dark) .info-content p {
  color: #d1d5db;
}

/* 检测按钮样式 */
.action-btn-outline.check {
  color: #2563eb;
  border-color: #2563eb;
}

.action-btn-outline.check:hover {
  background: rgba(37, 99, 235, 0.1);
}

/* 重复检测弹窗样式 */
.duplicate-modal {
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.duplicate-modal .modal-body {
  overflow-y: auto;
  max-height: 60vh;
}

.no-duplicate {
  text-align: center;
  padding: 2rem;
}

.no-duplicate .success-icon {
  font-size: 4rem;
  color: #10b981;
  margin-bottom: 1rem;
}

.no-duplicate p {
  font-size: 1.125rem;
  font-weight: 600;
  color: #181111;
  margin-bottom: 0.5rem;
}

:global(.dark) .no-duplicate p {
  color: white;
}

.no-duplicate .hint {
  font-size: 0.875rem;
  color: #8a6060;
  font-weight: 400;
}

.duplicate-summary {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(245, 158, 11, 0.1);
  border-radius: 0.75rem;
  margin-bottom: 1rem;
}

.duplicate-summary .warning-icon {
  font-size: 1.5rem;
  color: #f59e0b;
}

.duplicate-summary p {
  color: #181111;
  font-size: 0.9375rem;
}

:global(.dark) .duplicate-summary p {
  color: white;
}

.duplicate-summary strong {
  color: #f59e0b;
}

.duplicate-groups {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.duplicate-group {
  border: 1px solid #e6dbdb;
  border-radius: 0.75rem;
  overflow: hidden;
}

:global(.dark) .duplicate-group {
  border-color: #3d2a2a;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #f8f5f5;
}

:global(.dark) .group-header {
  background: #2d1f1f;
}

.group-name {
  font-weight: 700;
  color: #181111;
  font-size: 0.9375rem;
}

:global(.dark) .group-name {
  color: white;
}

.group-count {
  font-size: 0.75rem;
  color: #f42525;
  background: rgba(244, 37, 37, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-weight: 600;
}

.group-items {
  padding: 0.5rem;
}

.group-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
}

.group-item:hover {
  background: rgba(0, 0, 0, 0.03);
}

:global(.dark) .group-item:hover {
  background: rgba(255, 255, 255, 0.03);
}

.item-info {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.item-dept {
  font-size: 0.875rem;
  color: #8a6060;
}

:global(.dark) .item-dept {
  color: #9ca3af;
}

.item-status {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.item-status.won {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  background: rgba(244, 37, 37, 0.1);
  border: none;
  border-radius: 0.375rem;
  color: #f42525;
  cursor: pointer;
  transition: all 0.2s;
}

.remove-btn:hover {
  background: #f42525;
  color: white;
}

.remove-btn .material-symbols-outlined {
  font-size: 1rem;
}

.keep-mark {
  font-size: 0.75rem;
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-weight: 600;
}
</style>
