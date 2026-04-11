<template>
  <section class="grid gap-5 xl:grid-cols-[1fr_1fr]">
    <div class="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/5 md:p-6">
      <p class="text-xs uppercase tracking-[0.3em] text-[#9fb3c8]">Departments</p>
      <div class="mt-3 flex items-center justify-between">
        <h3 class="text-2xl font-black text-[#102a43]">部门列表</h3>
        <span class="rounded-full bg-[#f0b429]/20 px-3 py-1 text-xs font-bold text-[#8d5d00]">
          {{ departments.length }} 个部门
        </span>
      </div>

      <div class="mt-5 space-y-3">
        <div
          v-for="department in departments"
          :key="department.department_id"
          class="rounded-3xl border border-[#e9eef5] bg-[#fcfdff] p-4"
        >
          <div class="flex items-center justify-between gap-4">
            <div>
              <h4 class="text-lg font-bold text-[#102a43]">{{ department.department_name }}</h4>
              <p class="mt-1 text-sm text-[#486581]">负责人：{{ department.manager_name || '未设置' }}</p>
            </div>
            <span class="rounded-full bg-[#d9e2ec] px-3 py-1 text-xs font-semibold text-[#334e68]">
              ID {{ department.department_id }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="space-y-5">
      <div class="rounded-[30px] bg-[#102a43] p-5 text-white shadow-sm">
        <p class="text-xs uppercase tracking-[0.3em] text-white/55">Positions</p>
        <div class="mt-3 flex items-center justify-between">
          <h3 class="text-2xl font-black">岗位列表</h3>
          <span class="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
            {{ positions.length }} 个岗位
          </span>
        </div>

        <div class="mt-5 space-y-3">
          <div
            v-for="position in positions"
            :key="position.position_id"
            class="rounded-3xl bg-white/10 p-4"
          >
            <div class="flex items-center justify-between gap-4">
              <div>
                <h4 class="text-lg font-bold">{{ position.position_name }}</h4>
                <p class="mt-1 text-sm text-white/70">职级：{{ position.level_name || '未设置' }}</p>
              </div>
              <span class="rounded-full bg-[#f0b429] px-3 py-1 text-xs font-bold text-[#102a43]">
                ID {{ position.position_id }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="rounded-[30px] bg-[#f0b429] p-5 text-[#102a43] shadow-sm">
        <p class="text-xs uppercase tracking-[0.3em] text-[#102a43]/50">Why This Page</p>
        <p class="mt-3 text-sm leading-7">
          这页先不做复杂编辑，先把员工模块依赖的部门和岗位字典跑通，适合课程演示时讲清“员工表为什么要关联部门表、岗位表”。
        </p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'

import { fetchDepartments, fetchPositions } from '../api/http'

const emit = defineEmits(['update-title'])
const departments = ref([])
const positions = ref([])

async function bootstrap() {
  emit('update-title', '部门与岗位')
  try {
    const [departmentResult, positionResult] = await Promise.all([fetchDepartments(), fetchPositions()])
    departments.value = departmentResult.data
    positions.value = positionResult.data
  } catch (error) {
    ElMessage.error(error.message)
  }
}

onMounted(bootstrap)
</script>
