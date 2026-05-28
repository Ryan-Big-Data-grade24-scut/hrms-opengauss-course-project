<template>
  <div class="min-h-screen bg-[#f5f1e8] text-slate-900">
    <div class="mx-auto flex min-h-screen max-w-[1600px]">
      <aside class="hidden w-72 flex-col border-r border-black/6 bg-[#102a43] px-6 py-8 text-white lg:flex">
        <div class="mb-8">
          <p class="text-xs uppercase tracking-[0.35em] text-white/60">HRMS</p>
          <h1 class="mt-3 text-3xl font-black leading-tight">Pulse Admin</h1>
          <p class="mt-3 text-sm text-white/70">
            数据库课设前端控制台，直接联你当前的 openGauss 后端。
          </p>
        </div>

        <nav class="flex flex-1 flex-col gap-2">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="relative rounded-2xl px-4 py-3 text-sm font-medium text-white/78 transition hover:bg-white/10 hover:text-white"
            active-class="bg-[#f0b429] text-[#102a43] hover:bg-[#f0b429]"
          >
            {{ item.label }}
            <span v-if="item.badge && item.badge > 0" class="absolute right-3 top-2 rounded-full bg-[#d64545] px-1.5 py-0.5 text-[10px] font-bold text-white">
              {{ item.badge }}
            </span>
          </RouterLink>
        </nav>

        <div class="rounded-3xl bg-white/10 p-4 text-sm text-white/80">
          <p class="font-semibold text-white">当前账号</p>
          <p class="mt-2">{{ profile?.full_name || '未登录' }}</p>
          <p class="mt-1 text-xs text-white/65">{{ profile?.username || '' }}</p>
        </div>
      </aside>

      <div class="flex min-h-screen flex-1 flex-col">
        <header class="border-b border-black/6 bg-white/80 px-5 py-4 backdrop-blur md:px-8">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p class="text-xs uppercase tracking-[0.3em] text-[#486581]">Course Project</p>
              <h2 class="mt-1 text-2xl font-black text-[#102a43]">{{ title }}</h2>
            </div>

            <div class="flex items-center gap-3">
              <RouterLink
                to="/profile"
                class="rounded-full border border-[#d9e2ec] bg-white px-4 py-2 text-sm font-semibold text-[#102a43] no-underline transition hover:border-[#486581]"
              >
                我的信息
              </RouterLink>
              <button
                class="rounded-full bg-[#d64545] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b93737]"
                @click="handleLogout"
              >
                退出登录
              </button>
            </div>
          </div>
        </header>

        <main class="flex-1 px-4 py-5 md:px-8 md:py-8">
          <RouterView @update-title="setTitle" />
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import { logout, fetchPendingLeaves } from '../api/http'
import { clearSession, getProfileCache } from '../services/session'

const router = useRouter()
const pageTitle = ref('数据概览')
const profile = computed(() => getProfileCache())
const pendingBadge = ref(0)

const navItems = computed(() => [
  { to: '/', label: '数据概览' },
  { to: '/employees', label: '员工管理' },
  { to: '/departments', label: '部门岗位' },
  { to: '/org-chart', label: '组织架构' },
  { to: '/directory', label: '组织通讯录' },
  { to: '/locations', label: '办公地点' },
  { to: '/jobs', label: '职务管理' },
  { to: '/leaves', label: '请假审批', badge: pendingBadge.value },
  { to: '/users', label: '用户管理' },
  { to: '/audits', label: '审计日志' },
  { to: '/profile', label: '个人中心' },
])

const title = computed(() => pageTitle.value)

function setTitle(nextTitle) {
  if (nextTitle) pageTitle.value = nextTitle
}

async function handleLogout() {
  try {
    await logout()
    ElMessage.success('已退出登录')
  } finally {
    clearSession()
    router.push('/login')
  }
}

onMounted(async () => {
  try {
    const result = await fetchPendingLeaves()
    pendingBadge.value = (result.data || []).length
  } catch {
    pendingBadge.value = 0
  }
})
</script>
