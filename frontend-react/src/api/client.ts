const BASE = '/api'

async function request(path: string, opts?: RequestInit) {
  const token = localStorage.getItem('token')
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts?.headers },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Request failed')
  return data
}

export const api = {
  login: (u: string, p: string) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) }),
  profile: () => request('/auth/profile'),
  employees: (params?: string) => request('/employees' + (params ? '?' + params : '')),
  departments: () => request('/departments'),
  positions: () => request('/positions'),
  skillsGap: () => request('/skills/gap'),
  skillsHeatmap: () => request('/skills/heatmap'),
  attrition: () => request('/predict/attrition'),
  trainAttrition: () => request('/predict/attrition/train', { method: 'POST' }),
  getEmployeeBundle: (id: number) => request(`/org/employee/${id}`),
  allSkills: () => request('/skills'),
  addEmployeeSkill: (empId: number, skillId: number, level: number) =>
    request('/employees/skills', { method: 'POST', body: JSON.stringify({ employee_id: empId, skill_id: skillId, proficiency_level: level }) }),
  deleteEmployeeSkill: (empId: number, skillId: number) =>
    request(`/employees/skills?employee_id=${empId}&skill_id=${skillId}`, { method: 'DELETE' }),
  employeeProjects: (empId: number) => request(`/employees/${empId}/projects`),
  addEmployeeProject: (empId: number, data: any) =>
    request(`/employees/${empId}/projects`, { method: 'POST', body: JSON.stringify(data) }),
}
