<template>
  <section class="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/5 md:p-6">
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-[#9fb3c8]">Organization</p>
        <h3 class="mt-2 text-2xl font-black text-[#102a43]">组织架构</h3>
      </div>
      <button
        class="rounded-full border border-[#bcccdc] px-4 py-2 text-sm font-semibold text-[#486581] transition hover:border-[#486581]"
        @click="loadAll"
      >
        刷新
      </button>
    </div>

    <div class="mt-6">
      <el-tree
        :data="treeData"
        :props="treeProps"
        default-expand-all
        node-key="department_id"
        class="org-tree"
      >
        <template #default="{ node, data }">
          <div class="flex items-center gap-2 py-1">
            <span class="font-semibold text-[#102a43]">{{ data.department_name }}</span>
            <el-tag size="small" type="info">{{ data._memberCount || 0 }} 人</el-tag>
          </div>
        </template>
      </el-tree>
    </div>

    <div class="mt-6 rounded-[30px] bg-[#f0b429] p-5 text-[#102a43] shadow-sm">
      <p class="text-xs uppercase tracking-[0.3em] text-[#102a43]/50">Notes</p>
      <p class="mt-3 text-sm leading-7">部门层级结构，包含每个部门的在职人数统计。</p>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchDepartments } from '../api/http'

const emit = defineEmits(['update-title'])

const treeData = ref([])
const treeProps = {
  children: 'children',
  label: 'department_name',
}

function buildTree(depts) {
  const map = {}
  const roots = []
  depts.forEach((d) => {
    d.children = []
    d._memberCount = d.actual_headcount || 0
    map[d.department_id] = d
  })
  depts.forEach((d) => {
    if (d.parent_department_id && map[d.parent_department_id]) {
      map[d.parent_department_id].children.push(d)
    } else {
      roots.push(d)
    }
  })
  return roots
}

async function loadAll() {
  try {
    const res = await fetchDepartments()
    const activeDepts = (res.data || []).filter((d) => d.status === 1)
    treeData.value = buildTree(activeDepts)
  } catch (error) {
    ElMessage.error(error.message)
  }
}

onMounted(async () => {
  emit('update-title', '组织架构')
  await loadAll()
})
</script>

<style scoped>
:deep(.org-tree .el-tree-node__content) {
  padding: 4px 0;
  height: auto;
}
</style>
