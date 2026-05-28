<template>
  <section class="space-y-6">
    <!-- Summary Cards -->
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/5">
        <p class="text-xs uppercase tracking-[0.3em] text-[#9fb3c8]">Total Employees</p>
        <div class="mt-3 flex items-end justify-between">
          <p class="text-4xl font-black text-[#102a43]">{{ stats.total_employees }}</p>
        </div>
        <div class="mt-3 flex gap-3 text-xs text-[#486581]">
          <span class="text-green-600">在职 {{ stats.active_employees }}</span>
          <span class="text-red-500">离职 {{ stats.inactive_employees }}</span>
        </div>
      </div>

      <div class="rounded-[30px] bg-[#102a43] p-5 text-white shadow-sm">
        <p class="text-xs uppercase tracking-[0.3em] text-white/60">Departments</p>
        <p class="mt-3 text-4xl font-black">{{ stats.total_departments }}</p>
        <p class="mt-2 text-xs text-white/70">启用中的部门</p>
      </div>

      <RouterLink to="/leaves" class="rounded-[30px] bg-[#f0b429] p-5 text-[#102a43] shadow-sm transition hover:bg-[#dda20a]">
        <p class="text-xs uppercase tracking-[0.3em] text-[#102a43]/50">Pending Leaves</p>
        <p class="mt-3 text-4xl font-black">{{ stats.pending_leaves }}</p>
        <p class="mt-2 text-xs text-[#102a43]/70">点击查看详情 →</p>
      </RouterLink>

      <div class="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/5">
        <p class="text-xs uppercase tracking-[0.3em] text-[#9fb3c8]">Quick Actions</p>
        <div class="mt-3 grid gap-2">
          <RouterLink to="/employees" class="rounded-full border border-[#d9e2ec] px-3 py-1.5 text-center text-xs font-semibold text-[#102a43] transition hover:border-[#486581]">
            员工管理
          </RouterLink>
          <RouterLink to="/departments" class="rounded-full border border-[#d9e2ec] px-3 py-1.5 text-center text-xs font-semibold text-[#102a43] transition hover:border-[#486581]">
            部门岗位
          </RouterLink>
        </div>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="grid gap-5 xl:grid-cols-2">
      <!-- Department Stats -->
      <div class="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/5">
        <p class="text-xs uppercase tracking-[0.3em] text-[#9fb3c8]">Dept Distribution</p>
        <h3 class="mt-2 text-lg font-black text-[#102a43]">各部门人数分布</h3>
        <div class="mt-4 space-y-3">
          <div v-for="dept in stats.dept_stats" :key="dept.department_name" class="flex items-center gap-3">
            <span class="w-28 truncate text-sm font-medium text-[#486581]">{{ dept.department_name }}</span>
            <div class="flex-1 overflow-hidden rounded-full bg-[#f0f4f8]">
              <div
                class="h-3 rounded-full bg-[#102a43] transition-all"
                :style="{ width: deptPercent(dept.employee_count) + '%' }"
              />
            </div>
            <span class="w-8 text-right text-sm font-bold text-[#102a43]">{{ dept.employee_count }}</span>
          </div>
          <p v-if="!stats.dept_stats?.length" class="py-4 text-center text-sm text-[#9fb3c8]">暂无数据</p>
        </div>
      </div>

      <!-- Leave Type Stats -->
      <div class="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/5">
        <p class="text-xs uppercase tracking-[0.3em] text-[#9fb3c8]">Leave Overview</p>
        <h3 class="mt-2 text-lg font-black text-[#102a43]">请假类型统计</h3>
        <div class="mt-4 overflow-hidden rounded-2xl border border-[#d9e2ec]">
          <table class="w-full text-sm">
            <thead class="bg-[#f0f4f8] text-[#486581]">
              <tr>
                <th class="px-4 py-2 text-left font-semibold">类型</th>
                <th class="px-4 py-2 text-center font-semibold">总数</th>
                <th class="px-4 py-2 text-center font-semibold text-amber-600">待审</th>
                <th class="px-4 py-2 text-center font-semibold text-green-600">批准</th>
                <th class="px-4 py-2 text-center font-semibold text-red-500">驳回</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in stats.leave_type_stats" :key="item.leave_name" class="border-t border-[#d9e2ec]">
                <td class="px-4 py-2 font-medium text-[#102a43]">{{ item.leave_name }}</td>
                <td class="px-4 py-2 text-center font-bold">{{ item.total }}</td>
                <td class="px-4 py-2 text-center font-bold text-amber-600">{{ item.pending }}</td>
                <td class="px-4 py-2 text-center font-bold text-green-600">{{ item.approved }}</td>
                <td class="px-4 py-2 text-center font-bold text-red-500">{{ item.rejected }}</td>
              </tr>
              <tr v-if="!stats.leave_type_stats?.length">
                <td colspan="5" class="py-4 text-center text-[#9fb3c8]">暂无数据</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Recent Audit Changes -->
    <div class="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs uppercase tracking-[0.3em] text-[#9fb3c8]">Recent Activity</p>
          <h3 class="mt-2 text-lg font-black text-[#102a43]">最近操作记录</h3>
        </div>
        <RouterLink to="/audits" class="text-xs font-semibold text-[#486581] transition hover:text-[#102a43]">
          查看全部 →
        </RouterLink>
      </div>
      <div class="mt-4 divide-y divide-[#d9e2ec]">
        <div v-for="item in stats.recent_changes" :key="item.audit_id" class="flex items-center justify-between py-2.5">
          <div class="flex items-center gap-3">
            <span
              class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
              :class="actionBadge(item.action_type)"
            >
              {{ item.action_type }}
            </span>
            <span class="text-sm font-medium text-[#102a43]">{{ item.username }}</span>
            <span class="text-sm text-[#486581]">对 {{ item.target_type }} {{ item.action_detail }}</span>
          </div>
          <span class="text-xs text-[#9fb3c8]">{{ formatTime(item.created_at) }}</span>
        </div>
        <p v-if="!stats.recent_changes?.length" class="py-4 text-center text-sm text-[#9fb3c8]">暂无操作记录</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchDashboardStats } from '../api/http'

const emit = defineEmits(['update-title'])

const stats = reactive({
  total_employees: 0,
  active_employees: 0,
  inactive_employees: 0,
  total_departments: 0,
  pending_leaves: 0,
  dept_stats: [],
  leave_type_stats: [],
  recent_changes: [],
})

const maxDeptCount = ref(1)

function deptPercent(count) {
  if (!maxDeptCount.value) return 0
  return Math.round((count / maxDeptCount.value) * 100)
}

function actionBadge(type) {
  const map = {
    create: 'bg-green-100 text-green-700',
    update: 'bg-blue-100 text-blue-700',
    delete: 'bg-red-100 text-red-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-orange-100 text-orange-700',
  }
  return map[type] || 'bg-gray-100 text-gray-700'
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

onMounted(async () => {
  emit('update-title', '数据概览')
  try {
    const result = await fetchDashboardStats()
    Object.assign(stats, result.data)
    if (stats.dept_stats?.length) {
      maxDeptCount.value = Math.max(...stats.dept_stats.map((d) => d.employee_count), 1)
    }
  } catch (error) {
    ElMessage.error(error.message)
  }
})
</script>
