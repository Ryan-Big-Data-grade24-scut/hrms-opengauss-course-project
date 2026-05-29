<template>
  <div class="space-y-6">
    <div>
      <p class="text-xs uppercase tracking-widest text-gray-400">Talent Discovery</p>
      <h3 class="mt-1 text-2xl font-black text-gray-900">人才发现</h3>
    </div>

    <div class="flex gap-3">
      <input v-model="searchText" placeholder="描述你需要的技能..."
             class="flex-1 rounded-2xl border border-gray-200 px-5 py-3 text-sm outline-none focus:border-orange-400"
             @keyup.enter="doSearch"/>
      <button class="rounded-2xl bg-gray-900 px-6 py-3 text-sm font-bold text-white hover:bg-gray-800"
              @click="doSearch">搜索</button>
    </div>

    <div class="grid gap-4 md:grid-cols-4">
      <div class="rounded-2xl bg-white p-4 shadow-sm">
        <p class="text-xs text-gray-400">按岗位</p>
        <select v-model="filterPosition" @change="doSearch"
                class="mt-2 w-full rounded-xl border border-gray-200 p-2 text-sm outline-none">
          <option value="">全部岗位</option>
          <option v-for="p in positions" :key="p.position_id" :value="p.position_id">{{ p.position_name }}</option>
        </select>
      </div>
      <div class="rounded-2xl bg-white p-4 shadow-sm">
        <p class="text-xs text-gray-400">按部门</p>
        <select v-model="filterDept" @change="doSearch"
                class="mt-2 w-full rounded-xl border border-gray-200 p-2 text-sm outline-none">
          <option value="">全部部门</option>
          <option v-for="d in departments" :key="d.department_id" :value="d.department_id">{{ d.department_name }}</option>
        </select>
      </div>
    </div>

    <div class="rounded-2xl bg-white shadow-sm" v-if="results.length">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-gray-500 border-b">
            <th class="p-3 font-medium">匹配度</th>
            <th class="p-3 font-medium">姓名</th>
            <th class="p-3 font-medium">当前岗位</th>
            <th class="p-3 font-medium">部门</th>
            <th class="p-3 font-medium">技能亮点</th>
            <th class="p-3 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in results" :key="r.employee_id" class="border-b hover:bg-gray-50">
            <td class="p-3">
              <span class="font-bold" :class="r.match_pct > 80 ? 'text-green-600' : r.match_pct > 50 ? 'text-yellow-600' : 'text-gray-500'">
                {{ r.match_pct }}%
              </span>
            </td>
            <td class="p-3 font-medium">{{ r.full_name }}</td>
            <td class="p-3 text-gray-500">{{ r.position_name }}</td>
            <td class="p-3 text-gray-500">{{ r.department_name }}</td>
            <td class="p-3 text-gray-500">{{ r.skills_summary || '-' }}</td>
            <td class="p-3">
              <button class="text-xs text-orange-500 hover:underline" @click="viewProfile(r.employee_id)">档案</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="rounded-2xl bg-white p-8 text-center text-gray-400 shadow-sm">
      选择筛选条件后搜索，或从下方查看所有员工技能匹配
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api/http'

const emit = defineEmits(['update-title'])
const router = useRouter()
const searchText = ref('')
const filterPosition = ref('')
const filterDept = ref('')
const results = ref([])
const positions = ref([])
const departments = ref([])

async function doSearch() {
  try {
    const res = await api.get('/employees', { params: { page: 1, page_size: 50 } })
    const employees = res.data?.list || []
    const deptRes = await api.get('/departments')
    departments.value = deptRes.data || []

    const enriched = []
    for (const emp of employees) {
      if (filterPosition.value && emp.position_id != filterPosition.value) continue
      if (filterDept.value && emp.department_id != filterDept.value) continue
      // Fetch skill match for each employee
      try {
        const matchRes = await api.get('/match/employee', { params: { employee_id: emp.employee_id } })
        const matches = matchRes.data || []
        if (matches.length) {
          enriched.push({
            ...emp,
            match_pct: matches[0].match_pct,
            skills_summary: '-'
          })
        }
      } catch (e) {}
    }
    enriched.sort((a, b) => (b.match_pct || 0) - (a.match_pct || 0))
    results.value = enriched.slice(0, 20)
  } catch (e) {
    results.value = []
  }
}

function viewProfile(id) {
  router.push('/profile?employee_id=' + id)
}

onMounted(() => {
  emit('update-title', '人才发现')
  doSearch()
})
</script>
