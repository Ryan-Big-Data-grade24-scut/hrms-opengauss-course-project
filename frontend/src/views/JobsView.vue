<template>
  <section class="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/5 md:p-6">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-[#9fb3c8]">Jobs</p>
        <h3 class="mt-2 text-2xl font-black text-[#102a43]">职务管理</h3>
      </div>
      <button
        class="rounded-full bg-[#102a43] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0b1f33]"
        @click="openCreate"
      >
        新增职务
      </button>
    </div>

    <el-table class="mt-5" :data="jobs" stripe v-loading="loading">
      <el-table-column prop="job_code" label="编码" width="120" />
      <el-table-column prop="job_title" label="职务名称" min-width="160" />
      <el-table-column prop="job_grade" label="职级" width="100" />
      <el-table-column prop="min_salary" label="最低薪资" width="120" />
      <el-table-column prop="max_salary" label="最高薪资" width="120" />
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- Create/Edit Dialog -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑职务' : '新增职务'" width="500px">
      <el-form label-width="120px">
        <el-form-item label="编码">
          <el-input v-model="form.job_code" />
        </el-form-item>
        <el-form-item label="职务名称">
          <el-input v-model="form.job_title" />
        </el-form-item>
        <el-form-item label="职级">
          <el-input v-model="form.job_grade" />
        </el-form-item>
        <el-form-item label="最低薪资">
          <el-input-number v-model="form.min_salary" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="最高薪资">
          <el-input-number v-model="form.max_salary" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { createJob, deleteJob, fetchJobs, updateJob } from '../api/http'

const emit = defineEmits(['update-title'])

const loading = ref(false)
const jobs = ref([])
const dialogVisible = ref(false)
const editingId = ref(null)

const form = reactive({
  job_code: '',
  job_title: '',
  job_grade: '',
  min_salary: null,
  max_salary: null,
  description: '',
})

function resetForm() {
  editingId.value = null
  Object.assign(form, {
    job_code: '',
    job_title: '',
    job_grade: '',
    min_salary: null,
    max_salary: null,
    description: '',
  })
}

async function loadJobs() {
  loading.value = true
  try {
    const result = await fetchJobs()
    jobs.value = result.data || []
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  resetForm()
  dialogVisible.value = true
}

function openEdit(row) {
  editingId.value = row.job_id
  Object.assign(form, {
    job_code: row.job_code,
    job_title: row.job_title,
    job_grade: row.job_grade || '',
    min_salary: row.min_salary ?? null,
    max_salary: row.max_salary ?? null,
    description: row.description || '',
  })
  dialogVisible.value = true
}

async function submitForm() {
  try {
    if (editingId.value) {
      await updateJob(editingId.value, form)
      ElMessage.success('职务已更新')
    } else {
      await createJob(form)
      ElMessage.success('职务已创建')
    }
    dialogVisible.value = false
    await loadJobs()
  } catch (error) {
    ElMessage.error(error.message)
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确认删除职务 ${row.job_title}？`, '提示', { type: 'warning' })
    await deleteJob(row.job_id)
    ElMessage.success('职务已删除')
    await loadJobs()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(error.message || '删除失败')
  }
}

onMounted(() => {
  emit('update-title', '职务管理')
  loadJobs()
})
</script>
