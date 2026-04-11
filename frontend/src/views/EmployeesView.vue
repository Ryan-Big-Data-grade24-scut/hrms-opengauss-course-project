<template>
  <section class="space-y-6">
    <div class="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
      <div class="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/5 md:p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-xs uppercase tracking-[0.3em] text-[#9fb3c8]">Employees</p>
            <h3 class="mt-2 text-2xl font-black text-[#102a43]">员工总览</h3>
          </div>
          <button
            class="rounded-full bg-[#102a43] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0b1f33]"
            @click="openCreate"
          >
            新增员工
          </button>
        </div>

        <div class="mt-5 grid gap-3 md:grid-cols-4">
          <el-input v-model="filters.keyword" clearable placeholder="按姓名或工号搜索" />
          <el-select v-model="filters.department_id" clearable placeholder="部门">
            <el-option
              v-for="department in departments"
              :key="department.department_id"
              :label="department.department_name"
              :value="department.department_id"
            />
          </el-select>
          <el-select v-model="filters.position_id" clearable placeholder="岗位">
            <el-option
              v-for="position in positions"
              :key="position.position_id"
              :label="position.position_name"
              :value="position.position_id"
            />
          </el-select>
          <el-select v-model="filters.employment_status" clearable placeholder="状态">
            <el-option label="active" value="active" />
            <el-option label="inactive" value="inactive" />
          </el-select>
        </div>

        <div class="mt-4 flex flex-wrap gap-3">
          <button
            class="rounded-full bg-[#f0b429] px-4 py-2 text-sm font-bold text-[#102a43] transition hover:bg-[#dda20a]"
            @click="loadEmployees"
          >
            查询
          </button>
          <button
            class="rounded-full border border-[#bcccdc] px-4 py-2 text-sm font-semibold text-[#486581] transition hover:border-[#486581]"
            @click="resetFilters"
          >
            重置
          </button>
        </div>

        <el-table class="mt-5" :data="employees" stripe v-loading="loading">
          <el-table-column prop="employee_no" label="工号" min-width="120" />
          <el-table-column prop="full_name" label="姓名" min-width="120" />
          <el-table-column prop="department_name" label="部门" min-width="130" />
          <el-table-column prop="position_name" label="岗位" min-width="150" />
          <el-table-column prop="phone" label="电话" min-width="140" />
          <el-table-column prop="employment_status" label="状态" min-width="110" />
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <div class="flex gap-2">
                <button class="rounded-full bg-[#d9e2ec] px-3 py-1 text-xs font-semibold text-[#102a43]" @click="openEdit(row)">
                  编辑
                </button>
                <button class="rounded-full bg-[#fbdada] px-3 py-1 text-xs font-semibold text-[#b93737]" @click="handleDelete(row)">
                  删除
                </button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div class="mt-5 flex justify-end">
          <el-pagination
            layout="prev, pager, next, total"
            :total="total"
            :page-size="pageSize"
            :current-page="page"
            @current-change="handlePageChange"
          />
        </div>
      </div>

      <div class="grid gap-4">
        <div class="rounded-[30px] bg-[#102a43] p-5 text-white shadow-sm">
          <p class="text-xs uppercase tracking-[0.3em] text-white/55">Snapshot</p>
          <p class="mt-3 text-4xl font-black">{{ total }}</p>
          <p class="mt-2 text-sm text-white/72">当前员工记录总数</p>
        </div>

        <div class="rounded-[30px] bg-[#f0b429] p-5 text-[#102a43] shadow-sm">
          <p class="text-xs uppercase tracking-[0.3em] text-[#102a43]/50">Live Filters</p>
          <ul class="mt-3 space-y-2 text-sm font-medium">
            <li>关键字：{{ filters.keyword || '全部' }}</li>
            <li>部门：{{ selectedDepartmentName }}</li>
            <li>岗位：{{ selectedPositionName }}</li>
            <li>状态：{{ filters.employment_status || '全部' }}</li>
          </ul>
        </div>
      </div>
    </div>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑员工' : '新增员工'" width="560px">
      <div class="grid gap-4 md:grid-cols-2">
        <el-input v-model="form.employee_no" :disabled="Boolean(editingId)" placeholder="工号" />
        <el-input v-model="form.full_name" placeholder="姓名" />
        <el-select v-model="form.gender" placeholder="性别">
          <el-option label="M" value="M" />
          <el-option label="F" value="F" />
        </el-select>
        <el-input v-model="form.phone" placeholder="电话" />
        <el-input v-model="form.email" placeholder="邮箱" />
        <el-input v-model="form.hire_date" placeholder="入职日期 2026-04-11" />
        <el-select v-model="form.department_id" placeholder="部门">
          <el-option
            v-for="department in departments"
            :key="department.department_id"
            :label="department.department_name"
            :value="department.department_id"
          />
        </el-select>
        <el-select v-model="form.position_id" placeholder="岗位">
          <el-option
            v-for="position in positions"
            :key="position.position_id"
            :label="position.position_name"
            :value="position.position_id"
          />
        </el-select>
      </div>

      <template #footer>
        <button class="rounded-full border border-[#bcccdc] px-4 py-2 text-sm font-semibold text-[#486581]" @click="dialogVisible = false">
          取消
        </button>
        <button class="ml-3 rounded-full bg-[#102a43] px-4 py-2 text-sm font-semibold text-white" @click="submitForm">
          保存
        </button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  createEmployee,
  deleteEmployee,
  fetchDepartments,
  fetchEmployees,
  fetchPositions,
  updateEmployee,
} from '../api/http'

const emit = defineEmits(['update-title'])

const loading = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const employees = ref([])
const departments = ref([])
const positions = ref([])
const dialogVisible = ref(false)
const editingId = ref(null)

const filters = reactive({
  keyword: '',
  department_id: '',
  position_id: '',
  employment_status: '',
})

const form = reactive({
  employee_no: '',
  full_name: '',
  gender: 'M',
  phone: '',
  email: '',
  hire_date: '2026-04-11',
  department_id: 1,
  position_id: 1,
})

const selectedDepartmentName = computed(() => {
  if (!filters.department_id) return '全部'
  return departments.value.find((item) => item.department_id === filters.department_id)?.department_name || '全部'
})

const selectedPositionName = computed(() => {
  if (!filters.position_id) return '全部'
  return positions.value.find((item) => item.position_id === filters.position_id)?.position_name || '全部'
})

function resetForm() {
  editingId.value = null
  Object.assign(form, {
    employee_no: '',
    full_name: '',
    gender: 'M',
    phone: '',
    email: '',
    hire_date: '2026-04-11',
    department_id: departments.value[0]?.department_id || 1,
    position_id: positions.value[0]?.position_id || 1,
  })
}

async function bootstrap() {
  emit('update-title', '员工管理')
  const [departmentResult, positionResult] = await Promise.all([fetchDepartments(), fetchPositions()])
  departments.value = departmentResult.data
  positions.value = positionResult.data
  resetForm()
  await loadEmployees()
}

async function loadEmployees() {
  loading.value = true
  try {
    const result = await fetchEmployees({
      page: page.value,
      page_size: pageSize.value,
      keyword: filters.keyword || undefined,
      department_id: filters.department_id || undefined,
      position_id: filters.position_id || undefined,
      employment_status: filters.employment_status || undefined,
    })
    employees.value = result.data.list
    total.value = result.data.total
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    loading.value = false
  }
}

function handlePageChange(nextPage) {
  page.value = nextPage
  loadEmployees()
}

function resetFilters() {
  Object.assign(filters, {
    keyword: '',
    department_id: '',
    position_id: '',
    employment_status: '',
  })
  page.value = 1
  loadEmployees()
}

function openCreate() {
  resetForm()
  dialogVisible.value = true
}

function openEdit(row) {
  editingId.value = row.employee_id
  Object.assign(form, {
    employee_no: row.employee_no,
    full_name: row.full_name,
    gender: row.gender || 'M',
    phone: row.phone || '',
    email: row.email || '',
    hire_date: String(row.hire_date).slice(0, 10),
    department_id: row.department_id,
    position_id: row.position_id,
  })
  dialogVisible.value = true
}

async function submitForm() {
  try {
    if (editingId.value) {
      await updateEmployee(editingId.value, form)
      ElMessage.success('员工信息已更新')
    } else {
      await createEmployee(form)
      ElMessage.success('员工已创建')
    }
    dialogVisible.value = false
    await loadEmployees()
  } catch (error) {
    ElMessage.error(error.message)
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确认删除员工 ${row.full_name} 吗？`, '提示', {
      type: 'warning',
    })
    await deleteEmployee(row.employee_id)
    ElMessage.success('员工已删除')
    await loadEmployees()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

onMounted(bootstrap)
</script>
