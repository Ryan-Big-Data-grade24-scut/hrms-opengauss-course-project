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
            class="rounded-2xl px-4 py-3 text-sm font-medium text-white/78 transition hover:bg-white/10 hover:text-white"
            active-class="bg-[#f0b429] text-[#102a43] hover:bg-[#f0b429]"
          >
            {{ item.label }}
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
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import { logout } from '../api/http'
import { clearSession, getProfileCache } from '../services/session'

const router = useRouter()
const pageTitle = ref('员工总览')
const profile = computed(() => getProfileCache())

const navItems = [
  { to: '/employees', label: '员工管理' },
  { to: '/departments', label: '部门岗位' },
  { to: '/leaves', label: '请假审批' },
  { to: '/profile', label: '个人中心' },
]

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
</script>
