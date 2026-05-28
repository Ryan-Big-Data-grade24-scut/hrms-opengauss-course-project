<template>
  <section class="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
    <div class="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/5 md:p-6">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-xs uppercase tracking-[0.3em] text-[#9fb3c8]">Leave Requests</p>
          <h3 class="mt-2 text-2xl font-black text-[#102a43]">{{ tabLabel }}</h3>
        </div>
        <div class="flex gap-2">
          <template v-if="activeTab === 'all'">
            <button
              class="rounded-full bg-[#102a43] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0b1f33]"
              @click="openCreateLeave"
            >
              新增请假
            </button>
          </template>
          <button
            class="rounded-full border border-[#bcccdc] px-4 py-2 text-sm font-semibold text-[#486581] transition hover:border-[#486581]"
            @click="loadData"
          >
            刷新
          </button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="mt-4 flex gap-1 rounded-2xl bg-[#f0f4f8] p-1">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="flex-1 rounded-xl py-2 text-sm font-semibold transition"
          :class="activeTab === tab.key ? 'bg-white text-[#102a43] shadow-sm' : 'text-[#486581] hover:text-[#102a43]'"
          @click="switchTab(tab.key)"
        >
          {{ tab.label }}
          <span v-if="tab.key === 'pending' && pendingTotal > 0" class="ml-1 rounded-full bg-[#f0b429] px-1.5 py-0.5 text-xs text-[#102a43]">
            {{ pendingTotal }}
          </span>
        </button>
      </div>

      <!-- Filters -->
      <div class="mt-4 grid gap-3 md:grid-cols-3">
        <el-select v-if="activeTab === 'all'" v-model="leaveFilter.status" clearable placeholder="审批状态" @change="loadData">
          <el-option label="待审批" value="pending" />
          <el-option label="已批准" value="approved" />
          <el-option label="已驳回" value="rejected" />
        </el-select>
        <el-select v-if="activeTab === 'mine'" v-model="mineFilter.status" clearable placeholder="审批状态" @change="loadData">
          <el-option label="待审批" value="pending" />
          <el-option label="已批准" value="approved" />
          <el-option label="已驳回" value="rejected" />
        </el-select>
        <el-input v-if="activeTab === 'all'" v-model="leaveFilter.employee_name" clearable placeholder="按员工姓名搜索" @clear="loadData" />
      </div>

      <!-- Table -->
      <el-table class="mt-5" :data="displayLeaves" stripe v-loading="loading">
        <el-table-column prop="employee_no" label="工号" width="100" />
        <el-table-column prop="full_name" label="姓名" width="100" />
        <el-table-column prop="leave_type" label="类型" width="100" />
        <el-table-column prop="leave_name" label="请假类型" width="110" />
        <el-table-column prop="start_date" label="开始日期" width="110" />
        <el-table-column prop="end_date" label="结束日期" width="110" />
        <el-table-column prop="reason" label="原因" min-width="130" show-overflow-tooltip />
        <el-table-column prop="approval_status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.approval_status)" size="small">
              {{ statusLabel(row.approval_status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="approver_name" label="审批人" width="100" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <template v-if="activeTab !== 'mine' && row.approval_status === 'pending'">
              <el-button size="small" type="success" @click="handleApprove(row)">批准</el-button>
              <el-button size="small" type="warning" @click="handleReject(row)">驳回</el-button>
            </template>
            <el-tag v-else type="info" size="small">已处理</el-tag>
          </template>
        </el-table-column>
      </el-table>

      <!-- Pagination -->
      <div v-if="activeTab === 'all'" class="mt-5 flex justify-end">
        <el-pagination
          layout="prev, pager, next, total"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @current-change="handlePageChange"
        />
      </div>
    </div>

    <!-- Side Stats -->
    <div class="space-y-5">
      <div class="rounded-[30px] bg-[#102a43] p-5 text-white shadow-sm">
        <p class="text-xs uppercase tracking-[0.3em] text-white/55">Approval Stats</p>
        <div class="mt-4 grid gap-3">
          <div class="rounded-3xl bg-white/10 p-4">
            <p class="text-xs uppercase tracking-[0.2em] text-white/55">Pending</p>
            <p class="mt-2 text-3xl font-black">{{ pendingCount }}</p>
          </div>
          <div class="rounded-3xl bg-white/10 p-4">
            <p class="text-xs uppercase tracking-[0.2em] text-white/55">Approved</p>
            <p class="mt-2 text-3xl font-black">{{ approvedCount }}</p>
          </div>
        </div>
      </div>

      <div class="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/5">
        <p class="text-xs uppercase tracking-[0.3em] text-[#9fb3c8]">Notes</p>
        <ul class="mt-4 space-y-3 text-sm leading-6 text-[#486581]">
          <li>审批操作会写入审批人和审批时间。</li>
          <li>可按照状态筛选请假记录。</li>
        </ul>
      </div>
    </div>

    <!-- Approve/Reject Comment Dialog -->
    <el-dialog v-model="commentDialogVisible" :title="commentDialogTitle" width="400px">
      <el-input
        v-model="approvalComment"
        type="textarea"
        :rows="3"
        placeholder="请输入审批意见（可选）"
      />
      <template #footer>
        <el-button @click="commentDialogVisible = false">取消</el-button>
        <el-button :type="commentAction === 'approve' ? 'success' : 'warning'" @click="submitComment">
          {{ commentAction === 'approve' ? '批准' : '驳回' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Create Leave Dialog -->
    <el-dialog v-model="createDialogVisible" title="新增请假" width="450px">
      <el-form label-width="100px">
        <el-form-item label="员工">
          <el-select v-model="leaveForm.employee_id" filterable placeholder="选择员工">
            <el-option
              v-for="emp in employees"
              :key="emp.employee_id"
              :label="`${emp.employee_no} - ${emp.full_name}`"
              :value="emp.employee_id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="请假类型">
          <el-select v-model="leaveForm.leave_type_id" placeholder="选择类型">
            <el-option
              v-for="lt in leaveTypes"
              :key="lt.leave_type_id"
              :label="lt.leave_name"
              :value="lt.leave_type_id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="开始日期">
          <el-input v-model="leaveForm.start_date" placeholder="2026-04-15" />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-input v-model="leaveForm.end_date" placeholder="2026-04-16" />
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="leaveForm.reason" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreateLeave">提交</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'

import {
  approveLeave,
  createLeave,
  fetchEmployees,
  fetchLeaveTypes,
  fetchLeaves,
  fetchMyLeaves,
  fetchPendingLeaves,
  rejectLeave,
} from '../api/http'
import { getProfileCache } from '../services/session'

const emit = defineEmits(['update-title'])

const loading = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const leaves = ref([])
const pendingLeaves = ref([])
const myLeaves = ref([])
const pendingTotal = ref(0)
const employees = ref([])
const leaveTypes = ref([])

const activeTab = ref('all')

const tabs = [
  { key: 'all', label: '全部请假' },
  { key: 'pending', label: '待我审批' },
  { key: 'mine', label: '我的申请' },
]

const tabLabel = computed(() => {
  const t = tabs.find((t) => t.key === activeTab.value)
  return t ? t.label : '请假审批列表'
})

const displayLeaves = computed(() => {
  if (activeTab.value === 'pending') return pendingLeaves.value
  if (activeTab.value === 'mine') {
    if (mineFilter.status) {
      return myLeaves.value.filter((l) => l.approval_status === mineFilter.status)
    }
    return myLeaves.value
  }
  return leaves.value
})

const leaveFilter = reactive({
  status: '',
  employee_name: '',
})

const mineFilter = reactive({
  status: '',
})

const profile = computed(() => getProfileCache())

// ---- Approve / Reject comment ----
const commentDialogVisible = ref(false)
const commentDialogTitle = ref('')
const commentAction = ref('approve')
const currentLeaveId = ref(null)
const approvalComment = ref('')

// ---- Create leave ----
const createDialogVisible = ref(false)
const leaveForm = reactive({
  employee_id: null,
  leave_type_id: null,
  start_date: '',
  end_date: '',
  reason: '',
})

const pendingCount = computed(
  () => leaves.value.filter((item) => item.approval_status === 'pending').length,
)
const approvedCount = computed(
  () => leaves.value.filter((item) => item.approval_status === 'approved').length,
)

function statusTag(status) {
  if (status === 'approved') return 'success'
  if (status === 'rejected') return 'danger'
  return 'warning'
}
function statusLabel(status) {
  if (status === 'approved') return '已批准'
  if (status === 'rejected') return '已驳回'
  return '待审批'
}

function switchTab(tabKey) {
  activeTab.value = tabKey
  loadData()
}

async function loadData() {
  loading.value = true
  try {
    if (activeTab.value === 'all') {
      const result = await fetchLeaves({
        page: page.value,
        page_size: pageSize.value,
        approval_status: leaveFilter.status || undefined,
      })
      leaves.value = result.data.list
      total.value = result.data.total
    } else if (activeTab.value === 'pending') {
      const result = await fetchPendingLeaves()
      pendingLeaves.value = result.data || []
      pendingTotal.value = pendingLeaves.value.length
    } else if (activeTab.value === 'mine') {
      const myEmpId = profile.value?.employee_id
      if (myEmpId) {
        const result = await fetchMyLeaves(myEmpId)
        myLeaves.value = result.data || []
      } else {
        myLeaves.value = []
      }
    }
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    loading.value = false
  }
}

function handlePageChange(nextPage) {
  page.value = nextPage
  loadData()
}

function handleApprove(row) {
  currentLeaveId.value = row.leave_id
  commentAction.value = 'approve'
  commentDialogTitle.value = `批准请假 - ${row.full_name}`
  approvalComment.value = ''
  commentDialogVisible.value = true
}

function handleReject(row) {
  currentLeaveId.value = row.leave_id
  commentAction.value = 'reject'
  commentDialogTitle.value = `驳回请假 - ${row.full_name}`
  approvalComment.value = ''
  commentDialogVisible.value = true
}

async function submitComment() {
  try {
    const payload = {}
    if (approvalComment.value) {
      payload.approval_comment = approvalComment.value
    }
    if (commentAction.value === 'approve') {
      await approveLeave(currentLeaveId.value, payload)
    } else {
      await rejectLeave(currentLeaveId.value, payload)
    }
    ElMessage.success(commentAction.value === 'approve' ? '已批准' : '已驳回')
    commentDialogVisible.value = false
    await loadData()
  } catch (error) {
    ElMessage.error(error.message)
  }
}

function openCreateLeave() {
  Object.assign(leaveForm, {
    employee_id: null,
    leave_type_id: null,
    start_date: '',
    end_date: '',
    reason: '',
  })
  createDialogVisible.value = true
}

async function submitCreateLeave() {
  try {
    const lt = leaveTypes.value.find((t) => t.leave_type_id === leaveForm.leave_type_id)
    await createLeave({
      employee_id: leaveForm.employee_id,
      leave_type: lt?.leave_code || '',
      leave_type_id: leaveForm.leave_type_id,
      start_date: leaveForm.start_date,
      end_date: leaveForm.end_date,
      reason: leaveForm.reason,
    })
    ElMessage.success('请假已提交')
    createDialogVisible.value = false
    await loadData()
  } catch (error) {
    ElMessage.error(error.message)
  }
}

onMounted(async () => {
  emit('update-title', '请假审批')
  await Promise.all([
    loadData(),
    fetchEmployees({ page: 1, page_size: 100 }).then((r) => {
      employees.value = r.data.list
    }),
    fetchLeaveTypes().then((r) => {
      leaveTypes.value = r.data || []
    }),
    fetchPendingLeaves().then((r) => {
      pendingTotal.value = (r.data || []).length
    }),
  ])
})
</script>
