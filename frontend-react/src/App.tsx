import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import ProfileTalentHub from './pages/ProfileTalentHub'
import OrgManagement from './pages/OrgManagement'
import StrategicAnalytics from './pages/StrategicAnalytics'
import DirectoryPage from './pages/DirectoryPage'
import SkillsPage from './pages/SkillsPage'
import OrgPeoplePage from './pages/OrgPeoplePage'
import ApprovalCenter from './pages/ApprovalCenter'

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
          <Route index element={<Navigate to="/profile" replace />} />
          <Route path="profile" element={<ProfileTalentHub />} />
          <Route path="org" element={<OrgManagement />} />
          <Route path="org-people" element={<OrgPeoplePage />} />
          <Route path="directory" element={<DirectoryPage />} />
          <Route path="approval" element={<ApprovalCenter />} />
          <Route path="analytics" element={<StrategicAnalytics />} />
          <Route path="skills" element={<SkillsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
