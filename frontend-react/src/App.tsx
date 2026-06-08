import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import StrategicAnalytics from './pages/StrategicAnalytics'
import SkillsPage from './pages/SkillsPage'
import OrgPeoplePage from './pages/OrgPeoplePage'
import ServiceHall from './pages/ServiceHall'
import AttendancePage from './pages/AttendancePage'
import PerformancePage from './pages/PerformancePage'
import RequirePermission from './components/RequirePermission'
import NotFound from './components/NotFound'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    localStorage.getItem('token')
    setChecking(false)
  }, [])

  if (checking) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
      </div>
    )
  }

  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PermissionGuard({ permission, permissions, children }: { permission?: string; permissions?: string[]; children: React.ReactNode }) {
  return (
    <RequirePermission permission={permission} permissions={permissions}>
      {children}
    </RequirePermission>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/service-hall" replace />} />
          <Route path="service-hall" element={<ServiceHall />} />
          <Route path="org-people" element={
            <PermissionGuard permissions={['employee.manage', 'directory.view', 'team.view', 'profile.view.all', 'profile.view.team', 'profile.view.self']}>
              <OrgPeoplePage />
            </PermissionGuard>
          } />
          <Route path="skills" element={
            <PermissionGuard permission="skill.manage">
              <SkillsPage />
            </PermissionGuard>
          } />
          <Route path="analytics" element={
            <PermissionGuard permission="analytics.view">
              <StrategicAnalytics />
            </PermissionGuard>
          } />
          <Route path="attendance" element={
            <PermissionGuard permissions={['attendance.view', 'attendance.view.self', 'attendance.view.team', 'attendance.view.all', 'attendance.manage']}>
              <AttendancePage />
            </PermissionGuard>
          } />
          <Route path="performance" element={
            <PermissionGuard permissions={['performance.view', 'performance.view.self', 'performance.view.team', 'performance.manage']}>
              <PerformancePage />
            </PermissionGuard>
          } />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
