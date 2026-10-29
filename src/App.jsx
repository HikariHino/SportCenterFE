import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { canUsePayments, getToken, isManagerRole } from './utils/auth'
import { canUseCoachDemo } from './utils/coachDemoAccess'

const SportDashboard = lazy(() => import('./pages/SportDashboard'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const Coach = lazy(() => import('./pages/Coach/Coach'))
const Receptionist = lazy(() => import('./pages/Receptionist/Receptionist'))
const Member = lazy(() => import('./pages/member/Member'))
const PaymentResult = lazy(() => import('./pages/member/PaymentResult'))
const CenterManager = lazy(() => import('./pages/CenterManager/CenterManager'))

function RouteFallback() {
  return <main role="status" aria-live="polite" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#526177', background: '#f4f7fa', fontFamily: "'Be Vietnam Pro', sans-serif" }}>Đang tải trang...</main>
}

function CoachRoute() {
  const { user } = useAuth()
  const location = useLocation()
  const isCoach = user?.role === 'coach' && Boolean(getToken())
  const isDemo = canUseCoachDemo(location.search, import.meta.env.DEV)
  return isCoach || isDemo ? <Coach /> : <Navigate to="/login" replace state={{ from: '/coach' }} />
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
  const location = useLocation()
  const isMember = user?.role === 'member' && Boolean(getToken())
  return isMember ? children : <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}`, message: location.pathname.startsWith('/payment/') ? 'Đăng nhập để kiểm tra kết quả thanh toán và cập nhật gói hội viên.' : undefined }} />
}

function PaymentRoute() {
  const { user } = useAuth()
  const location = useLocation()
  return canUsePayments(user?.role) && Boolean(getToken()) ? <PaymentResult /> : <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}`, message: 'Đăng nhập để kiểm tra kết quả thanh toán.' }} />
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<SportDashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/coach" element={<CoachRoute />} />
          <Route path="/manager" element={<ManagerRoute />} />
          <Route path="/receptionist" element={<ReceptionistRoute />} />
          <Route path="/member" element={<MemberRoute><Member /></MemberRoute>} />
          <Route path="/payment/success" element={<PaymentRoute />} />
          <Route path="/payment/cancel" element={<PaymentRoute />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
