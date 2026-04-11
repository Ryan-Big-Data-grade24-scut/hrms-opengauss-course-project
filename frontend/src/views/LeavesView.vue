<template>
  <section class="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
    <div class="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/5 md:p-6">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-xs uppercase tracking-[0.3em] text-[#9fb3c8]">Leave Requests</p>
          <h3 class="mt-2 text-2xl font-black text-[#102a43]">请假审批列表</h3>
        </div>
        <button
          class="rounded-full border border-[#bcccdc] px-4 py-2 text-sm font-semibold text-[#486581] transition hover:border-[#486581]"
          @click="loadLeaves"
        >
          刷新
        </button>
      </div>

      <el-table class="mt-5" :data="leaves" stripe>
        <el-table-column prop="employee_no" label="工号" width="110" />
        <el-table-column prop="full_name" label="姓名" width="110" />
        <el-table-column prop="leave_type" label="类型" width="120" />
        <el-table-column prop="start_date" label="开始日期" min-width="120" />
        <el-table-column prop="end_date" label="结束日期" min-width="120" />
        <el-table-column prop="approval_status" label="状态" width="120" />
      </el-table>
    </div>

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
          <li>当前后端已经支持请假列表查询。</li>
          <li>审批按钮接口已经在后端预留好，可继续往前端补。</li>
          <li>这页很适合你们演示“员工表和请假表的一对多关系”。</li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'

import { fetchLeaves } from '../api/http'

const emit = defineEmits(['update-title'])
const leaves = ref([])

const pendingCount = computed(
  () => leaves.value.filter((item) => item.approval_status === 'pending').length,
)
const approvedCount = computed(
  () => leaves.value.filter((item) => item.approval_status === 'approved').length,
)

async function loadLeaves() {
  try {
    const result = await fetchLeaves({ page: 1, page_size: 20 })
    leaves.value = result.data.list
  } catch (error) {
    ElMessage.error(error.message)
  }
}

onMounted(async () => {
  emit('update-title', '请假审批')
  await loadLeaves()
})
</script>
