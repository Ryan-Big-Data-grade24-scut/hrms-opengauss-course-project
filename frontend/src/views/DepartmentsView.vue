<template>
  <section class="grid gap-5 xl:grid-cols-[1fr_1fr]">
    <div class="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/5 md:p-6">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs uppercase tracking-[0.3em] text-[#9fb3c8]">Departments</p>
          <h3 class="mt-2 text-2xl font-black text-[#102a43]">部门列表</h3>
        </div>
        <button
          class="rounded-full bg-[#102a43] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0b1f33]"
          @click="openDeptCreate"
        >
          新增部门
        </button>
      </div>

      <el-table class="mt-5" :data="departments" stripe>
        <el-table-column prop="department_name" label="名称" min-width="120" />
        <el-table-column prop="department_code" label="编码" width="100" />
        <el-table-column prop="location_name" label="办公地点" width="130" />
        <el-table-column prop="manager_name" label="负责人" width="100" />
        <el-table-column label="编制/实际" width="100">
          <template #default="{ row }">
            <span :class="{ 'text-red-600 font-bold': row.headcount && row.actual_headcount > row.headcount }">
              {{ row.headcount ?? '-' }} / {{ row.actual_headcount ?? 0 }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDeptEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDeptDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="space-y-5">
      <div class="rounded-[30px] bg-[#102a43] p-5 text-white shadow-sm">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs uppercase tracking-[0.3em] text-white/55">Positions</p>
            <h3 class="mt-2 text-2xl font-black">岗位列表</h3>
          </div>
          <button
            class="rounded-full bg-[#f0b429] px-4 py-2 text-sm font-bold text-[#102a43] transition hover:bg-[#dda20a]"
            @click="openPosCreate"
          >
            新增岗位
          </button>
        </div>

        <el-table class="mt-5" :data="positions" stripe size="small">
          <el-table-column prop="position_name" label="名称" min-width="110" />
          <el-table-column prop="position_code" label="编码" width="100" />
          <el-table-column prop="department_name" label="部门" width="100" />
          <el-table-column prop="level_name" label="职级" width="80" />
          <el-table-column label="编制/实际" width="100">
            <template #default="{ row }">
              <span :class="{ 'text-yellow-300 font-bold': row.headcount && row.actual_headcount > row.headcount }">
                {{ row.headcount ?? '-' }} / {{ row.actual_headcount ?? 0 }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="70">
            <template #default="{ row }">
              <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
                {{ row.status === 1 ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="openPosEdit(row)">编辑</el-button>
              <el-button size="small" type="danger" @click="handlePosDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="rounded-[30px] bg-[#f0b429] p-5 text-[#102a43] shadow-sm">
        <p class="text-xs uppercase tracking-[0.3em] text-[#102a43]/50">Notes</p>
        <p class="mt-3 text-sm leading-7">部门和岗位现已支持 CRUD 操作。关联 location/job 表。</p>
      </div>
    </div>

    <!-- Department Dialog -->
    <el-dialog v-model="deptDialogVisible" :title="deptEditingId ? '编辑部门' : '新增部门'" width="500px">
      <el-form label-width="120px">
        <el-form-item label="部门名称">
          <el-input v-model="deptForm.department_name" />
        </el-form-item>
        <el-form-item label="编码">
          <el-input v-model="deptForm.department_code" />
        </el-form-item>
        <el-form-item label="办公地点">
          <el-select v-model="deptForm.location_id" clearable placeholder="选择地点">
            <el-option
              v-for="loc in locations"
              :key="loc.location_id"
              :label="loc.location_name"
              :value="loc.location_id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="负责人">
          <el-input v-model="deptForm.manager_name" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="deptForm.description" type="textarea" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="deptForm.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="deptDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitDept">保存</el-button>
      </template>
    </el-dialog>

    <!-- Position Dialog -->
    <el-dialog v-model="posDialogVisible" :title="posEditingId ? '编辑岗位' : '新增岗位'" width="500px">
      <el-form label-width="120px">
        <el-form-item label="岗位名称">
          <el-input v-model="posForm.position_name" />
        </el-form-item>
        <el-form-item label="编码">
          <el-input v-model="posForm.position_code" />
        </el-form-item>
        <el-form-item label="所属部门">
          <el-select v-model="posForm.department_id" clearable placeholder="选择部门">
            <el-option
              v-for="dept in departments"
              :key="dept.department_id"
              :label="dept.department_name"
              :value="dept.department_id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="职务">
          <el-select v-model="posForm.job_id" clearable placeholder="选择职务">
            <el-option
              v-for="job in jobs"
              :key="job.job_id"
              :label="job.job_title"
              :value="job.job_id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="职级">
          <el-input v-model="posForm.level_name" />
        </el-form-item>
        <el-form-item label="编制人数">
          <el-input-number v-model="posForm.headcount" :min="1" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="posForm.description" type="textarea" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="posForm.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="posDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitPos">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  createDepartment,
  createPosition,
  deleteDepartment,
  deletePosition,
  fetchDepartments,
  fetchJobs,
  fetchLocations,
  fetchPositions,
  updateDepartment,
  updatePosition,
} from '../api/http'

const emit = defineEmits(['update-title'])

const departments = ref([])
const positions = ref([])
const locations = ref([])
const jobs = ref([])

// ---- Department dialog ----
const deptDialogVisible = ref(false)
const deptEditingId = ref(null)
const deptForm = reactive({
  department_name: '',
  department_code: '',
  location_id: null,
  manager_name: '',
  description: '',
  status: 1,
})

// ---- Position dialog ----
const posDialogVisible = ref(false)
const posEditingId = ref(null)
const posForm = reactive({
  position_name: '',
  position_code: '',
  department_id: null,
  job_id: null,
  level_name: '',
  headcount: 1,
  description: '',
  status: 1,
})

function resetDeptForm() {
  deptEditingId.value = null
  Object.assign(deptForm, {
    department_name: '',
    department_code: '',
    location_id: null,
    manager_name: '',
    description: '',
    status: 1,
  })
}

function resetPosForm() {
  posEditingId.value = null
  Object.assign(posForm, {
    position_name: '',
    position_code: '',
    department_id: null,
    job_id: null,
    level_name: '',
    headcount: 1,
    description: '',
    status: 1,
  })
}

async function loadAll() {
  try {
    const [deptRes, posRes, locRes, jobRes] = await Promise.all([
      fetchDepartments(),
      fetchPositions(),
      fetchLocations(),
      fetchJobs(),
    ])
    departments.value = deptRes.data
    positions.value = posRes.data
    locations.value = locRes.data || []
    jobs.value = jobRes.data || []
  } catch (error) {
    ElMessage.error(error.message)
  }
}

function openDeptCreate() {
  resetDeptForm()
  deptDialogVisible.value = true
}
function openDeptEdit(row) {
  deptEditingId.value = row.department_id
  Object.assign(deptForm, {
    department_name: row.department_name,
    department_code: row.department_code || '',
    location_id: row.location_id || null,
    manager_name: row.manager_name || '',
    description: row.description || '',
    status: row.status ?? 1,
  })
  deptDialogVisible.value = true
}

async function submitDept() {
  try {
    if (deptEditingId.value) {
      await updateDepartment(deptEditingId.value, deptForm)
      ElMessage.success('部门已更新')
    } else {
      await createDepartment(deptForm)
      ElMessage.success('部门已创建')
    }
    deptDialogVisible.value = false
    await loadAll()
  } catch (error) {
    ElMessage.error(error.message)
  }
}

async function handleDeptDelete(row) {
  try {
    await ElMessageBox.confirm(`确认删除部门 ${row.department_name}？`, '提示', { type: 'warning' })
    await deleteDepartment(row.department_id)
    ElMessage.success('部门已删除')
    await loadAll()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(error.message || '删除失败')
  }
}

function openPosCreate() {
  resetPosForm()
  posDialogVisible.value = true
}
function openPosEdit(row) {
  posEditingId.value = row.position_id
  Object.assign(posForm, {
    position_name: row.position_name,
    position_code: row.position_code || '',
    department_id: row.department_id || null,
    job_id: row.job_id || null,
    level_name: row.level_name || '',
    headcount: row.headcount ?? 1,
    description: row.description || '',
    status: row.status ?? 1,
  })
  posDialogVisible.value = true
}

async function submitPos() {
  try {
    if (posEditingId.value) {
      await updatePosition(posEditingId.value, posForm)
      ElMessage.success('岗位已更新')
    } else {
      await createPosition(posForm)
      ElMessage.success('岗位已创建')
    }
    posDialogVisible.value = false
    await loadAll()
  } catch (error) {
    ElMessage.error(error.message)
  }
}

async function handlePosDelete(row) {
  try {
    await ElMessageBox.confirm(`确认删除岗位 ${row.position_name}？`, '提示', { type: 'warning' })
    await deletePosition(row.position_id)
    ElMessage.success('岗位已删除')
    await loadAll()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(error.message || '删除失败')
  }
}

onMounted(async () => {
  emit('update-title', '部门与岗位')
  await loadAll()
})
</script>
