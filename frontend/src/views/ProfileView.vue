<template>
  <section class="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
    <div class="rounded-[30px] bg-[#102a43] p-6 text-white shadow-sm">
      <p class="text-xs uppercase tracking-[0.35em] text-white/55">Current Session</p>
      <h3 class="mt-4 text-3xl font-black">{{ profile?.full_name || '未登录' }}</h3>
      <p class="mt-2 text-white/72">{{ profile?.username || '' }}</p>

      <div class="mt-6 rounded-3xl bg-white/10 p-4">
        <p class="text-xs uppercase tracking-[0.25em] text-white/55">Roles</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <span
            v-for="role in profile?.roles || []"
            :key="role"
            class="rounded-full bg-[#f0b429] px-3 py-1 text-xs font-bold text-[#102a43]"
          >
            {{ role }}
          </span>
        </div>
      </div>
    </div>

    <div class="rounded-[30px] bg-white p-6 shadow-sm ring-1 ring-black/5">
      <p class="text-xs uppercase tracking-[0.35em] text-[#9fb3c8]">Permissions</p>
      <h3 class="mt-3 text-2xl font-black text-[#102a43]">权限与接口会话</h3>
      <p class="mt-3 text-sm leading-7 text-[#486581]">
        这页直接展示当前登录账号的角色和权限，也适合你们向老师解释 RBAC 设计。
      </p>

      <div class="mt-6 grid gap-3 md:grid-cols-2">
        <div
          v-for="permission in profile?.permissions || []"
          :key="permission"
          class="rounded-3xl border border-[#e9eef5] bg-[#fcfdff] p-4"
        >
          <p class="text-sm font-semibold text-[#102a43]">{{ permission }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { getProfileCache } from '../services/session'

const emit = defineEmits(['update-title'])
const profile = computed(() => getProfileCache())

onMounted(() => {
  emit('update-title', '个人中心')
})
</script>
