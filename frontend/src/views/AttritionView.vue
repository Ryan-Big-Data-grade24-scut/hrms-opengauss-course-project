<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-xs uppercase tracking-widest text-gray-400">Attrition Warning</p>
        <h3 class="mt-1 text-2xl font-black text-gray-900">离职预警看板</h3>
      </div>
      <button
        class="rounded-full bg-orange-400 px-5 py-2 text-sm font-bold text-white hover:bg-orange-500"
        @click="retrainModel"
      >
        重新训练模型
      </button>
    </div>

    <div class="grid gap-4 md:grid-cols-4" v-if="stats">
      <div class="rounded-2xl bg-white p-4 shadow-sm">
        <p class="text-xs uppercase text-gray-400">总人数</p>
        <p class="mt-1 text-3xl font-black">{{ stats.total }}</p>
      </div>
      <div class="rounded-2xl bg-red-50 p-4 shadow-sm">
        <p class="text-xs uppercase text-red-500">高风险 >80%</p>
        <p class="mt-1 text-3xl font-black text-red-600">{{ stats.high }}</p>
      </div>
      <div class="rounded-2xl bg-yellow-50 p-4 shadow-sm">
        <p class="text-xs uppercase text-yellow-600">中风险 50-80%</p>
        <p class="mt-1 text-3xl font-black text-yellow-700">{{ stats.medium }}</p>
      </div>
      <div class="rounded-2xl bg-green-50 p-4 shadow-sm">
        <p class="text-xs uppercase text-green-600">低风险 <50%</p>
        <p class="mt-1 text-3xl font-black text-green-700">{{ stats.low }}</p>
      </div>
    </div>

    <div class="rounded-2xl bg-white shadow-sm">
      <div class="p-4 border-b border-gray-100 flex items-center justify-between">
        <span class="font-bold text-gray-800">高风险员工</span>
        <span class="text-xs text-gray-400">上次训练: {{ lastTrained || '未训练' }}</span>
      </div>
      <table class="w-full text-sm" v-if="predictions.length">
        <thead>
          <tr class="text-left text-gray-500 border-b">
            <th class="p-3 font-medium">姓名</th>
            <th class="p-3 font-medium">部门</th>
            <th class="p-3 font-medium">风险评分</th>
            <th class="p-3 font-medium">司龄(月)</th>
            <th class="p-3 font-medium">敬业度</th>
            <th class="p-3 font-medium">未晋升(月)</th>
            <th class="p-3 font-medium">换经理</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in predictions" :key="p.employee_id"
              class="border-b border-gray-50 hover:bg-gray-50"
              :class="{'bg-red-50': p.risk_score > 80}">
            <td class="p-3 font-medium">{{ p.full_name }}</td>
            <td class="p-3 text-gray-500">{{ p.department_name }}</td>
            <td class="p-3">
              <span class="font-bold" :class="riskColor(p.risk_score)">{{ p.risk_score }}%</span>
              <div class="mt-1 h-1.5 w-20 rounded-full bg-gray-200">
                <div class="h-1.5 rounded-full"
                     :class="riskBar(p.risk_score)"
                     :style="{width: p.risk_score + '%'}"></div>
              </div>
            </td>
            <td class="p-3">{{ p.tenure }}</td>
            <td class="p-3">{{ p.engagement_score }}</td>
            <td class="p-3">{{ p.last_promotion_months }}</td>
            <td class="p-3">{{ p.manager_changes }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="p-8 text-center text-gray-400">
        {{ loading ? '加载中...' : '暂无数据。请先训练模型或确认 V5 迁移已运行。' }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import api from '../api/http'

const emit = defineEmits(['update-title'])
const loading = ref(false)
const predictions = ref([])
const lastTrained = ref('')
const stats = ref(null)

function riskColor(score) {
  if (score > 80) return 'text-red-600'
  if (score > 50) return 'text-yellow-600'
  return 'text-green-600'
}
function riskBar(score) {
  if (score > 80) return 'bg-red-500'
  if (score > 50) return 'bg-yellow-500'
  return 'bg-green-500'
}

async function loadPredictions() {
  loading.value = true
  try {
    const res = await api.get('/predict/attrition')
    predictions.value = res.data || []
    const total = predictions.value.length
    const high = predictions.value.filter(p => p.risk_score > 80).length
    const medium = predictions.value.filter(p => p.risk_score > 50 && p.risk_score <= 80).length
    stats.value = { total, high, medium, low: total - high - medium }
  } catch (e) {
    predictions.value = []
    stats.value = { total: 0, high: 0, medium: 0, low: 0 }
  } finally {
    loading.value = false
  }
}

async function loadModelInfo() {
  try {
    const res = await api.get('/predict/model')
    if (res.data && res.data.length) {
      lastTrained.value = res.data[0].createtime
    }
  } catch (e) { /* ignore */ }
}

async function retrainModel() {
  try {
    await api.post('/predict/attrition/train')
    ElMessage.success('模型训练完成')
    await loadPredictions()
    await loadModelInfo()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

onMounted(async () => {
  emit('update-title', '离职预警')
  await loadModelInfo()
  await loadPredictions()
})
</script>
