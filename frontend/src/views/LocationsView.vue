<template>
  <section class="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/5 md:p-6">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-[#9fb3c8]">Locations</p>
        <h3 class="mt-2 text-2xl font-black text-[#102a43]">办公地点</h3>
      </div>
      <button
        class="rounded-full bg-[#102a43] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0b1f33]"
        @click="openCreate"
      >
        新增地点
      </button>
    </div>

    <el-table class="mt-5" :data="locations" stripe v-loading="loading">
      <el-table-column prop="location_code" label="编码" width="130" />
      <el-table-column prop="location_name" label="名称" min-width="160" />
      <el-table-column prop="city" label="城市" width="120" />
      <el-table-column prop="address_line" label="地址" min-width="220" />
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
            {{ row.status === 1 ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- Create/Edit Dialog -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑地点' : '新增地点'" width="500px">
      <el-form label-width="120px">
        <el-form-item label="编码">
          <el-input v-model="form.location_code" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="form.location_name" />
        </el-form-item>
        <el-form-item label="国家代码">
          <el-input v-model="form.country_code" placeholder="CN" />
        </el-form-item>
        <el-form-item label="城市">
          <el-input v-model="form.city" />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="form.address_line" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { createLocation, deleteLocation, fetchLocations, updateLocation } from '../api/http'

const emit = defineEmits(['update-title'])

const loading = ref(false)
const locations = ref([])
const dialogVisible = ref(false)
const editingId = ref(null)

const form = reactive({
  location_code: '',
  location_name: '',
  country_code: '',
  city: '',
  address_line: '',
  status: 1,
})

function resetForm() {
  editingId.value = null
  Object.assign(form, {
    location_code: '',
    location_name: '',
    country_code: '',
    city: '',
    address_line: '',
    status: 1,
  })
}

async function loadLocations() {
  loading.value = true
  try {
    const result = await fetchLocations()
    locations.value = result.data || []
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  resetForm()
  dialogVisible.value = true
}

function openEdit(row) {
  editingId.value = row.location_id
  Object.assign(form, {
    location_code: row.location_code,
    location_name: row.location_name,
    country_code: row.country_code || '',
    city: row.city || '',
    address_line: row.address_line || '',
    status: row.status ?? 1,
  })
  dialogVisible.value = true
}

async function submitForm() {
  try {
    if (editingId.value) {
      await updateLocation(editingId.value, form)
      ElMessage.success('地点已更新')
    } else {
      await createLocation(form)
      ElMessage.success('地点已创建')
    }
    dialogVisible.value = false
    await loadLocations()
  } catch (error) {
    ElMessage.error(error.message)
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确认删除地点 ${row.location_name}？`, '提示', { type: 'warning' })
    await deleteLocation(row.location_id)
    ElMessage.success('地点已删除')
    await loadLocations()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(error.message || '删除失败')
  }
}

onMounted(() => {
  emit('update-title', '办公地点')
  loadLocations()
})
</script>
