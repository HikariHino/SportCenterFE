import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import SportDashboard from './pages/SportDashboard'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import Coach from './pages/Coach/Coach'
import Receptionist from './pages/Receptionist/Receptionist'
import { useAuth } from './contexts/AuthContext'
import Member from './pages/member/Member'
import PaymentResult from './pages/member/PaymentResult'
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

function ReceptionistRoute() {
  const { user } = useAuth()
  const isReceptionist = user?.role === 'receptionist' && Boolean(getToken())
  return isReceptionist ? <Receptionist /> : <Navigate to="/login" replace state={{ from: '/receptionist' }} />
}

function MemberRoute({ children }) {
  const { user } = useAuth()
  const isMember = user?.role === 'member' && Boolean(getToken())
  return isMember ? children : <Navigate to="/login" replace state={{ from: '/member' }} />
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
        <Route path="/receptionist" element={<ReceptionistRoute />} />
        <Route path="/member" element={<MemberRoute><Member /></MemberRoute>} />
        <Route path="/payment/success" element={<MemberRoute><PaymentResult /></MemberRoute>} />
        <Route path="/payment/cancel" element={<MemberRoute><PaymentResult cancelled /></MemberRoute>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
