import axios from 'axios'
import { clearSession, getToken, setSession } from '../services/session'

const http = axios.create({
  baseURL: '/api',
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
