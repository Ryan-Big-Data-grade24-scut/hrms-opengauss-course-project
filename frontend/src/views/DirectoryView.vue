<template>
  <section class="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/5 md:p-6">
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-[#9fb3c8]">Directory</p>
        <h3 class="mt-2 text-2xl font-black text-[#102a43]">组织通讯录</h3>
      </div>
      <div class="flex gap-2">
        <el-input
          v-model="keyword"
          clearable
          placeholder="搜索姓名/工号/邮箱"
          class="w-52"
          @input="filterData"
        />
        <button
          class="rounded-full border border-[#bcccdc] px-4 py-2 text-sm font-semibold text-[#486581] transition hover:border-[#486581]"
          @click="loadAll"
        >
          刷新
        </button>
      </div>
    </div>

    <div v-if="!groupedData || !Object.keys(groupedData).length" class="py-12 text-center text-[#9fb3c8]">
      暂无数据
    </div>

    <div v-else class="mt-6 space-y-6">
      <div v-for="(members, deptName) in groupedData" :key="deptName" class="rounded-2xl border border-[#d9e2ec] p-4">
        <h4 class="mb-3 text-lg font-black text-[#102a43]">{{ deptName }}</h4>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="emp in members"
            :key="emp.employee_id"
            class="rounded-xl border border-[#d9e2ec] p-3 transition hover:border-[#486581]"
          >
            <p class="font-semibold text-[#102a43]">{{ emp.full_name }}</p>
            <p class="mt-1 text-xs text-[#486581]">{{ emp.employee_no }} · {{ emp.position_name || '无岗位' }}</p>
            <p class="mt-1 text-xs text-[#486581]">{{ emp.phone || '无电话' }}</p>
            <p class="mt-1 text-xs text-[#486581]">{{ emp.email || '无邮箱' }}</p>
            <p v-if="emp.manager_name" class="mt-1 text-xs text-[#486581]">上级: {{ emp.manager_name }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-6 rounded-[30px] bg-[#102a43] p-5 text-white shadow-sm">
      <p class="text-xs uppercase tracking-[0.3em] text-white/55">Stats</p>
      <div class="mt-3 text-sm text-white/80">
        <p>共 {{ totalEmployees }} 名在职员工，分布在 {{ totalDepartments }} 个部门</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchDirectory } from '../api/http'

const emit = defineEmits(['update-title'])

const keyword = ref('')
const rawData = ref([])

const groupedData = computed(() => {
  const filtered = keyword.value
    ? rawData.value.filter(
        (e) =>
          e.full_name.toLowerCase().includes(keyword.value.toLowerCase()) ||
          e.employee_no.toLowerCase().includes(keyword.value.toLowerCase()) ||
          (e.email && e.email.toLowerCase().includes(keyword.value.toLowerCase())),
      )
    : rawData.value

  const groups = {}
  filtered.forEach((emp) => {
    if (!groups[emp.department_name]) groups[emp.department_name] = []
    groups[emp.department_name].push(emp)
  })
  return groups
})

const totalEmployees = computed(() => rawData.value.length)
const totalDepartments = computed(() => Object.keys(groupedData.value).length)

function filterData() {}

async function loadAll() {
  try {
    const res = await fetchDirectory()
    rawData.value = res.data || []
  } catch (error) {
    ElMessage.error(error.message)
  }
}

onMounted(async () => {
  emit('update-title', '组织通讯录')
  await loadAll()
})
</script>
