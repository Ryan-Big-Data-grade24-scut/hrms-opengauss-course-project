<template>
  <section class="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/5 md:p-6">
    <div>
      <p class="text-xs uppercase tracking-[0.3em] text-[#9fb3c8]">Audit Log</p>
      <h3 class="mt-2 text-2xl font-black text-[#102a43]">审计日志</h3>
    </div>

    <div class="mt-5 grid gap-3 md:grid-cols-4">
      <el-input v-model="filters.username" clearable placeholder="用户名" @clear="loadAudits" />
      <el-input v-model="filters.action_type" clearable placeholder="操作类型" @clear="loadAudits" />
      <el-input v-model="filters.target_type" clearable placeholder="目标类型" @clear="loadAudits" />
      <el-input v-model="filters.start_time" clearable placeholder="开始时间 2026-01-01" @clear="loadAudits" />
    </div>
    <div class="mt-3">
      <button
        class="rounded-full bg-[#f0b429] px-4 py-2 text-sm font-bold text-[#102a43] transition hover:bg-[#dda20a]"
        @click="loadAudits"
      >
        查询
      </button>
    </div>

    <el-table class="mt-5" :data="audits" stripe v-loading="loading">
      <el-table-column prop="audit_id" label="ID" width="70" />
      <el-table-column prop="username" label="用户名" width="110" />
      <el-table-column prop="action_type" label="操作类型" width="110" />
      <el-table-column prop="target_type" label="目标类型" width="120" />
      <el-table-column prop="target_id" label="目标ID" width="80" />
      <el-table-column prop="action_detail" label="详情" min-width="220" show-overflow-tooltip />
      <el-table-column prop="created_at" label="时间" min-width="170" />
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
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'

import { fetchAudits } from '../api/http'

const emit = defineEmits(['update-title'])

const loading = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const audits = ref([])

const filters = reactive({
  username: '',
  action_type: '',
  target_type: '',
  start_time: '',
})

async function loadAudits() {
  loading.value = true
  try {
    const result = await fetchAudits({
      page: page.value,
      page_size: pageSize.value,
      username: filters.username || undefined,
      action_type: filters.action_type || undefined,
      target_type: filters.target_type || undefined,
      start_time: filters.start_time || undefined,
    })
    audits.value = result.data.list
    total.value = result.data.total
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    loading.value = false
  }
}

function handlePageChange(nextPage) {
  page.value = nextPage
  loadAudits()
}

onMounted(() => {
  emit('update-title', '审计日志')
  loadAudits()
})
</script>
