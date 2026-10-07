import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import SportDashboard from './pages/SportDashboard'
import Login from './pages/Login'
import Register from './pages/Register'
import Coach from './pages/Coach/Coach'
import Receptionist from './pages/Receptionist/Receptionist'
import { useAuth } from './contexts/AuthContext'
import Member from './pages/member/Member'
import { getToken } from './utils/auth'

function CoachRoute() {
  const { user } = useAuth()
  const isCoach = user?.role === 'coach' && Boolean(getToken())
  return isCoach ? <Coach /> : <Navigate to="/login" replace state={{ from: '/coach' }} />
}

function ReceptionistRoute() {
  const { user } = useAuth()
  const isReceptionist = user?.role === 'receptionist' && Boolean(getToken())
  return isReceptionist ? <Receptionist /> : <Navigate to="/login" replace state={{ from: '/receptionist' }} />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SportDashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/coach" element={<CoachRoute />} />
        <Route path="/receptionist" element={<ReceptionistRoute />} />
        <Route path="/member" element={<Member />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
