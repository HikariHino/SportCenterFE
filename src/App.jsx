import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import SportDashboard from './pages/SportDashboard'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import Coach from './pages/Coach/Coach'
import { useAuth } from './contexts/AuthContext'
import Member from './pages/member/Member'
import CenterManager from './pages/CenterManager/CenterManager'
import { getToken, isManagerRole } from './utils/auth'

function CoachRoute() {
  const { user } = useAuth()
  const isCoach = user?.role === 'coach' && Boolean(getToken())
  return isCoach ? <Coach /> : <Navigate to="/login" replace state={{ from: '/coach' }} />
}

function ManagerRoute() {
  const { user } = useAuth()
  const isManager = isManagerRole(user?.role) && Boolean(getToken())
  return isManager ? <CenterManager /> : <Navigate to="/login" replace state={{ from: '/manager' }} />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SportDashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/coach" element={<CoachRoute />} />
        <Route path="/manager" element={<ManagerRoute />} />
        <Route path="/member" element={<Member />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
