<template>
  <div class="space-y-6">
    <div>
      <p class="text-xs uppercase tracking-widest text-gray-400">System Settings</p>
      <h3 class="mt-1 text-2xl font-black text-gray-900">系统设置</h3>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <router-link to="/leaves" class="rounded-2xl bg-white p-5 shadow-sm hover:shadow-md transition block">
        <p class="font-bold text-gray-800">请假审批</p>
        <p class="mt-1 text-xs text-gray-400">管理请假申请和审批流程</p>
      </router-link>
      <router-link to="/departments" class="rounded-2xl bg-white p-5 shadow-sm hover:shadow-md transition block">
        <p class="font-bold text-gray-800">部门岗位</p>
        <p class="mt-1 text-xs text-gray-400">部门与岗位 CRUD 管理</p>
      </router-link>
      <router-link to="/users" class="rounded-2xl bg-white p-5 shadow-sm hover:shadow-md transition block">
        <p class="font-bold text-gray-800">用户管理</p>
        <p class="mt-1 text-xs text-gray-400">系统用户与角色管理</p>
      </router-link>
      <router-link to="/audits" class="rounded-2xl bg-white p-5 shadow-sm hover:shadow-md transition block">
        <p class="font-bold text-gray-800">审计日志</p>
        <p class="mt-1 text-xs text-gray-400">操作审计记录查询</p>
      </router-link>
      <router-link to="/employees" class="rounded-2xl bg-white p-5 shadow-sm hover:shadow-md transition block">
        <p class="font-bold text-gray-800">员工管理</p>
        <p class="mt-1 text-xs text-gray-400">传统员工 CRUD 界面</p>
      </router-link>
      <router-link to="/locations" class="rounded-2xl bg-white p-5 shadow-sm hover:shadow-md transition block">
        <p class="font-bold text-gray-800">办公地点</p>
        <p class="mt-1 text-xs text-gray-400">地点与职务管理</p>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
const emit = defineEmits(['update-title'])
onMounted(() => emit('update-title', '系统设置'))
</script>
