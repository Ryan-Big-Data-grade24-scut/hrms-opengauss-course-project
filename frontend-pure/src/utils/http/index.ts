import axios from 'axios'

const http = axios.create({ baseURL: '/api', timeout: 15000 })

http.interceptors.request.use(c => {
  const t = localStorage.getItem('token')
  if (t) c.headers.Authorization = 'Bearer ' + t
  return c
})

http.interceptors.response.use(
  r => r.data,
  e => { if (e.response?.status === 401) { localStorage.removeItem('token'); window.location.href = '/login' }; return Promise.reject(e) }
)

export default http
