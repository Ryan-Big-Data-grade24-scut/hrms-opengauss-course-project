<template>
  <div class="min-h-screen bg-[radial-gradient(circle_at_top_left,_#f0b429,_transparent_26%),radial-gradient(circle_at_bottom_right,_#d9e2ec,_transparent_32%),linear-gradient(135deg,_#102a43,_#243b53)] px-4 py-10">
    <div class="mx-auto grid min-h-[85vh] max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section class="px-2 text-white md:px-6">
        <p class="text-xs uppercase tracking-[0.45em] text-white/65">openGauss HRMS</p>
        <h1 class="mt-5 max-w-2xl text-5xl font-black leading-[1.05] md:text-6xl">
          做得快，也要看起来像一个真的系统。
        </h1>
        <p class="mt-5 max-w-xl text-base leading-7 text-white/78">
          这一版前端直接对接你已经完成的后端接口，先把登录、员工、部门、请假和个人中心跑通。
        </p>

        <div class="mt-8 grid max-w-xl gap-4 sm:grid-cols-3">
          <div class="rounded-3xl bg-white/10 p-4 backdrop-blur">
            <p class="text-xs uppercase tracking-[0.25em] text-white/55">CLI Friendly</p>
            <p class="mt-2 text-sm text-white/85">全程支持命令行启动与调试</p>
          </div>
          <div class="rounded-3xl bg-white/10 p-4 backdrop-blur">
            <p class="text-xs uppercase tracking-[0.25em] text-white/55">Fast UI</p>
            <p class="mt-2 text-sm text-white/85">Vite 冷启动快，界面反馈顺滑</p>
          </div>
          <div class="rounded-3xl bg-white/10 p-4 backdrop-blur">
            <p class="text-xs uppercase tracking-[0.25em] text-white/55">Course Ready</p>
            <p class="mt-2 text-sm text-white/85">直接对课程展示最关键的模块</p>
          </div>
        </div>
      </section>

      <section class="rounded-[32px] border border-white/20 bg-white/92 p-6 shadow-2xl shadow-black/20 md:p-8">
        <p class="text-xs uppercase tracking-[0.35em] text-[#9fb3c8]">Sign In</p>
        <h2 class="mt-3 text-3xl font-black text-[#102a43]">进入后台</h2>
        <p class="mt-3 text-sm leading-6 text-[#486581]">
          先用当前后端的演示账号跑通最小闭环，后续我们再继续加员工编辑弹窗和更多筛选能力。
        </p>

        <el-form class="mt-8" label-position="top" @submit.prevent="handleSubmit">
          <el-form-item label="用户名">
            <el-input v-model="form.username" size="large" placeholder="admin" />
          </el-form-item>

          <el-form-item label="密码">
            <el-input v-model="form.password" size="large" show-password placeholder="123456" />
          </el-form-item>

          <button
            class="mt-2 w-full rounded-2xl bg-[#f0b429] px-4 py-3 text-base font-bold text-[#102a43] transition hover:bg-[#dda20a]"
            type="button"
            :disabled="loading"
            @click="handleSubmit"
          >
            {{ loading ? '登录中...' : '登录并进入系统' }}
          </button>
        </el-form>

        <div class="mt-6 rounded-3xl bg-[#f5f7fa] p-4 text-sm text-[#486581]">
          <p class="font-semibold text-[#102a43]">默认测试账号</p>
          <p class="mt-2">用户名：`admin`</p>
          <p>密码：`123456`</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import { login } from '../api/http'

const router = useRouter()
const loading = ref(false)
const form = reactive({
  username: 'admin',
  password: '123456',
})

async function handleSubmit() {
  if (!form.username || !form.password) {
    ElMessage.warning('请先填写用户名和密码')
    return
  }

  loading.value = true
  try {
    await login(form)
    ElMessage.success('登录成功')
    router.push('/employees')
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    loading.value = false
  }
}
</script>
