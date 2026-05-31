import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import StrategicAnalytics from './pages/StrategicAnalytics'
import SkillsPage from './pages/SkillsPage'
import OrgPeoplePage from './pages/OrgPeoplePage'
import ApprovalCenter from './pages/ApprovalCenter'
import ServiceHall from './pages/ServiceHall'
import AttendancePage from './pages/AttendancePage'
import PerformancePage from './pages/PerformancePage'
import LeavePage from './pages/LeavePage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/service-hall" replace />} />
          <Route path="service-hall" element={<ServiceHall />} />
          <Route path="org-people" element={<OrgPeoplePage />} />
          <Route path="skills" element={<SkillsPage />} />
          <Route path="analytics" element={<StrategicAnalytics />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="performance" element={<PerformancePage />} />
          <Route path="leaves" element={<LeavePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
