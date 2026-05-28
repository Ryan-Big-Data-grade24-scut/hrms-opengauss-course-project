<template>
  <section class="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/5 md:p-6">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-[#9fb3c8]">User Management</p>
        <h3 class="mt-2 text-2xl font-black text-[#102a43]">用户管理</h3>
      </div>
      <button
        class="rounded-full bg-[#102a43] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0b1f33]"
        @click="openCreate"
      >
        新增用户
      </button>
    </div>

    <el-table class="mt-5" :data="users" stripe v-loading="loading">
      <el-table-column prop="username" label="用户名" width="120" />
      <el-table-column prop="full_name" label="姓名" width="120" />
      <el-table-column prop="phone" label="电话" width="140" />
      <el-table-column prop="email" label="邮箱" min-width="180" />
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
            {{ row.status === 1 ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="角色" min-width="150">
        <template #default="{ row }">
          <el-tag v-for="role in row.roles" :key="role" class="mr-1" size="small">
            {{ role }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" type="primary" @click="openRoleAssign(row)">角色</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="mt-5 flex justify-end">
      <el-pagination
        layout="prev, pager, next, total"
        :total="total"
        :page-size="pageSize"
        :current-page="page"
        @current-change="handlePageChange"
      />
    </div>

    <!-- Create/Edit User Dialog -->
    <el-dialog v-model="userDialogVisible" :title="editingId ? '编辑用户' : '新增用户'" width="450px">
      <el-form label-width="100px">
        <el-form-item label="用户名">
          <el-input v-model="userForm.username" :disabled="Boolean(editingId)" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="userForm.full_name" />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="userForm.phone" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="userForm.email" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="userForm.password" type="password" :placeholder="editingId ? '留空则不修改' : '默认 123456'" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="userForm.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="userDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitUser">保存</el-button>
      </template>
    </el-dialog>

    <!-- Role Assignment Dialog -->
    <el-dialog v-model="roleDialogVisible" title="分配角色" width="400px">
      <el-checkbox-group v-model="selectedRoleIds">
        <div v-for="role in allRoles" :key="role.role_id" class="mb-3">
          <el-checkbox :label="role.role_id" :value="role.role_id">
            {{ role.role_name }} ({{ role.role_code }})
          </el-checkbox>
        </div>
      </el-checkbox-group>
      <template #footer>
        <el-button @click="roleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRoles">保存角色</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  createUser,
  deleteUser,
  fetchRoles,
  fetchUsers,
  replaceUserRoles,
  updateUser,
} from '../api/http'

const emit = defineEmits(['update-title'])

const loading = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const users = ref([])

// ---- User dialog ----
const userDialogVisible = ref(false)
const editingId = ref(null)
const userForm = reactive({
  username: '',
  full_name: '',
  phone: '',
  email: '',
  password: '',
  status: 1,
})

// ---- Role dialog ----
const roleDialogVisible = ref(false)
const roleUserId = ref(null)
const allRoles = ref([])
const selectedRoleIds = ref([])

function resetForm() {
  editingId.value = null
  Object.assign(userForm, {
    username: '',
    full_name: '',
    phone: '',
    email: '',
    password: '',
    status: 1,
  })
}

async function loadUsers() {
  loading.value = true
  try {
    const result = await fetchUsers({ page: page.value, page_size: pageSize.value })
    users.value = result.data.list
    total.value = result.data.total
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    loading.value = false
  }
}

function handlePageChange(nextPage) {
  page.value = nextPage
  loadUsers()
}

function openCreate() {
  resetForm()
  userDialogVisible.value = true
}

function openEdit(row) {
  editingId.value = row.user_id
  Object.assign(userForm, {
    username: row.username,
    full_name: row.full_name || '',
    phone: row.phone || '',
    email: row.email || '',
    password: '',
    status: row.status ?? 1,
  })
  userDialogVisible.value = true
}

async function submitUser() {
  try {
    const payload = { ...userForm }
    if (!payload.password) delete payload.password
    if (editingId.value) {
      await updateUser(editingId.value, payload)
      ElMessage.success('用户已更新')
    } else {
      await createUser(payload)
      ElMessage.success('用户已创建')
    }
    userDialogVisible.value = false
    await loadUsers()
  } catch (error) {
    ElMessage.error(error.message)
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确认删除用户 ${row.username}？`, '提示', { type: 'warning' })
    await deleteUser(row.user_id)
    ElMessage.success('用户已删除')
    await loadUsers()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(error.message || '删除失败')
  }
}

async function openRoleAssign(row) {
  roleUserId.value = row.user_id
  selectedRoleIds.value = []
  if (!allRoles.value.length) {
    try {
      const res = await fetchRoles()
      allRoles.value = res.data || []
    } catch (error) {
      ElMessage.error(error.message)
      return
    }
  }
  // Map role codes to role IDs for current user
  if (row.roles) {
    selectedRoleIds.value = allRoles.value
      .filter((r) => row.roles.includes(r.role_code))
      .map((r) => r.role_id)
  }
  roleDialogVisible.value = true
}

async function submitRoles() {
  try {
    await replaceUserRoles(roleUserId.value, { role_ids: selectedRoleIds.value })
    ElMessage.success('角色已更新')
    roleDialogVisible.value = false
    await loadUsers()
  } catch (error) {
    ElMessage.error(error.message)
  }
}

onMounted(() => {
  emit('update-title', '用户管理')
  loadUsers()
})
</script>
