<template>
  <div class="space-y-6">
    <div>
      <p class="text-xs uppercase tracking-widest text-gray-400">Org Panorama</p>
      <h3 class="mt-1 text-2xl font-black text-gray-900">组织全景图</h3>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <div class="rounded-2xl bg-white p-5 shadow-sm">
        <p class="text-sm font-bold text-gray-700 mb-3">部门概况</p>
        <div v-for="d in deptStats" :key="d.department_id"
             class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
          <div>
            <span class="font-medium text-sm">{{ d.department_name }}</span>
            <span class="ml-2 text-xs text-gray-400">{{ d.headcount }} 人</span>
          </div>
          <div class="text-xs text-gray-500">
            技能覆盖率 {{ d.skill_coverage }} · 平均 {{ d.avg_skill_level }}/5
          </div>
        </div>
      </div>

      <div class="rounded-2xl bg-white p-5 shadow-sm">
        <p class="text-sm font-bold text-gray-700 mb-3">关键人物 <!-- TODO 修复 router 引用 --></p>
        <p class="text-xs text-gray-400 mb-3">依赖人数最多的人员</p>
        <div v-for="c in critical" :key="c.employee_id"
             class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
          <div>
            <span class="font-medium text-sm">{{ c.full_name }}</span>
            <span class="ml-2 text-xs text-gray-400">{{ c.department_name }}</span>
          </div>
          <div class="text-xs text-orange-500 font-bold">{{ c.team_size }} 依赖</div>
        </div>
      </div>
    </div>

    <div class="rounded-2xl bg-white p-5 shadow-sm">
      <p class="text-sm font-bold text-gray-700 mb-3">组织树</p>
      <div v-for="node in orgTree" :key="node.employee_id" class="py-1"
           :style="{ marginLeft: (node.depth * 24) + 'px' }">
        <div class="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50">
          <div class="h-2 w-2 rounded-full"
               :class="node.depth === 0 ? 'bg-orange-400' : 'bg-gray-300'"></div>
          <span class="text-sm font-medium">{{ node.full_name }}</span>
          <span class="text-xs text-gray-400">{{ node.department_name }}</span>
          <span class="text-xs text-gray-300">· {{ node.position_name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import api from '../api/http'

const emit = defineEmits(['update-title'])
const deptStats = ref([])
const critical = ref([])
const orgTree = ref([])

onMounted(async () => {
  emit('update-title', '组织全景')
  try {
    const [deptRes, critRes, treeRes] = await Promise.all([
      api.get('/org/departments'),
      api.get('/org/critical'),
      api.get('/org/tree'),
    ])
    deptStats.value = deptRes.data || []
    critical.value = critRes.data || []
    orgTree.value = treeRes.data || []
  } catch (e) { /* ignore */ }
})
</script>
