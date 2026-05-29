import axios from 'axios'
import { clearSession, getToken, setSession } from '../services/session'

const apiBaseURL = import.meta.env.VITE_API_BASE_URL ?? '/api'

const http = axios.create({
  baseURL: apiBaseURL,
  timeout: 10000,
})

http.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      clearSession()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    const message =
      error.response?.data?.message || error.message || 'Request failed'
    return Promise.reject(new Error(message))
  },
)

export async function login(payload) {
  const result = await http.post('/auth/login', payload)
  setSession(result.data.token, result.data.profile)
  return result
}

export async function logout() {
  try {
    await http.post('/auth/logout')
  } finally {
    clearSession()
  }
}

export async function fetchProfile() {
  return http.get('/auth/profile')
}

export async function fetchEmployees(params) {
  return http.get('/employees', { params })
}

export async function createEmployee(payload) {
  return http.post('/employees', payload)
}

export async function updateEmployee(employeeId, payload) {
  return http.put(`/employees/${employeeId}`, payload)
}

export async function deleteEmployee(employeeId) {
  return http.delete(`/employees/${employeeId}`)
}

export async function fetchDepartments() {
  return http.get('/departments')
}

export async function fetchPositions() {
  return http.get('/positions')
}

export async function fetchLeaves(params) {
  return http.get('/leaves', { params })
}

export async function fetchAudits(params) {
  return http.get('/audits', { params })
}

// ---- Department CRUD ----
export async function createDepartment(payload) {
  return http.post('/departments', payload)
}
export async function updateDepartment(id, payload) {
  return http.put(`/departments/${id}`, payload)
}
export async function deleteDepartment(id) {
  return http.delete(`/departments/${id}`)
}

// ---- Position CRUD ----
export async function createPosition(payload) {
  return http.post('/positions', payload)
}
export async function updatePosition(id, payload) {
  return http.put(`/positions/${id}`, payload)
}
export async function deletePosition(id) {
  return http.delete(`/positions/${id}`)
}

// ---- Leave approve/reject/create ----
export async function approveLeave(id, payload) {
  return http.put(`/leaves/${id}/approve`, payload)
}
export async function rejectLeave(id, payload) {
  return http.put(`/leaves/${id}/reject`, payload)
}
export async function createLeave(payload) {
  return http.post('/leaves', payload)
}

// ---- Location CRUD ----
export async function fetchLocations() {
  return http.get('/locations')
}
export async function createLocation(payload) {
  return http.post('/locations', payload)
}
export async function updateLocation(id, payload) {
  return http.put(`/locations/${id}`, payload)
}
export async function deleteLocation(id) {
  return http.delete(`/locations/${id}`)
}

// ---- Job CRUD ----
export async function fetchJobs() {
  return http.get('/jobs')
}
export async function createJob(payload) {
  return http.post('/jobs', payload)
}
export async function updateJob(id, payload) {
  return http.put(`/jobs/${id}`, payload)
}
export async function deleteJob(id) {
  return http.delete(`/jobs/${id}`)
}

// ---- Leave Type CRUD ----
export async function fetchLeaveTypes() {
  return http.get('/leave-types')
}
export async function createLeaveType(payload) {
  return http.post('/leave-types', payload)
}
export async function updateLeaveType(id, payload) {
  return http.put(`/leave-types/${id}`, payload)
}
export async function deleteLeaveType(id) {
  return http.delete(`/leave-types/${id}`)
}

// ---- Employee Profile ----
export async function fetchEmployeeProfile(employeeId) {
  return http.get(`/employees/${employeeId}/profile`)
}
export async function updateEmployeeProfile(employeeId, payload) {
  return http.put(`/employees/${employeeId}/profile`, payload)
}

// ---- Employee Job History ----
export async function fetchEmployeeJobHistory(employeeId) {
  return http.get(`/employees/${employeeId}/job-history`)
}
export async function createEmployeeJobHistory(employeeId, payload) {
  return http.post(`/employees/${employeeId}/job-history`, payload)
}

// ---- User management (admin) ----
export async function fetchUsers(params) {
  return http.get('/users', { params })
}
export async function createUser(payload) {
  return http.post('/users', payload)
}
export async function updateUser(userId, payload) {
  return http.put(`/users/${userId}`, payload)
}
export async function deleteUser(userId) {
  return http.delete(`/users/${userId}`)
}

// ---- Roles ----
export async function fetchRoles() {
  return http.get('/roles')
}
export async function replaceUserRoles(userId, payload) {
  return http.put(`/users/${userId}/roles`, payload)
}

export default http
