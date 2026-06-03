const BASE = '/api'

async function request(path: string, opts?: RequestInit) {
  const token = localStorage.getItem('token')
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts?.headers },
  })
  if (res.status === 401) {
    localStorage.clear()
    window.location.href = '/?expired=1'
    throw new Error('会话已过期，请重新登录')
  }
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Request failed')
  return data
}

export const api = {
  login: (u: string, p: string) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) }),
  profile: () => request('/auth/profile'),
  employees: (params?: string) => request('/employees' + (params ? '?' + params : '')),
  departments: () => request('/departments'),
  positions: (departmentId?: number) => request('/positions' + (departmentId ? '?department_id=' + departmentId : '')),
  skillsRequired: (positionId: number) => request('/skills/required?position_id=' + positionId),
  skillsOverview: () => request('/skills/analytics/overview'),
  skillsGap: () => request('/skills/gap'),
  skillsHeatmap: () => request('/skills/heatmap'),
  attrition: () => request('/predict/attrition'),
  trainAttrition: () => request('/predict/attrition/train', { method: 'POST' }),
  getEmployeeBundle: (id: number) => request(`/org/employee/${id}`),
  employeeSkills: (empId: number) => request('/employees/skills?employee_id=' + empId),
  allSkills: () => request('/skills'),
  addEmployeeSkill: (empId: number, skillId: number, level: number) =>
    request('/employees/skills', { method: 'POST', body: JSON.stringify({ action: 'add', employee_id: empId, skill_id: skillId, proficiency_level: level }) }),
  updateEmployeeSkill: (empId: number, skillId: number, level: number) =>
    request('/employees/skills', { method: 'POST', body: JSON.stringify({ action: 'update', employee_id: empId, skill_id: skillId, proficiency_level: level }) }),
  deleteEmployeeSkill: (empId: number, skillId: number) =>
    request(`/employees/skills?employee_id=${empId}&skill_id=${skillId}`, { method: 'DELETE' }),
  employeeProjects: (empId: number) => request(`/employees/${empId}/projects`),
  addEmployeeProject: (empId: number, data: any) =>
    request(`/employees/${empId}/projects`, { method: 'POST', body: JSON.stringify(data) }),
  updateEmployeeProject: (empId: number, projectId: number, data: any) =>
    request(`/employees/${empId}/projects/${projectId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEmployeeProject: (empId: number, projectId: number) =>
    request(`/employees/${empId}/projects/${projectId}`, { method: 'DELETE' }),
}
