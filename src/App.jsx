import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import SportDashboard from './pages/SportDashboard'
import Login from './pages/Login'
import Register from './pages/Register'
import Coach from './pages/Coach/Coach'
import { useAuth } from './contexts/AuthContext'
import Member from './pages/member/Member'

function CoachRoute() {
  const { user } = useAuth()
  const isCoach = user?.role === 'coach' && Boolean(localStorage.getItem('token'))
  return isCoach ? <Coach /> : <Navigate to="/login" replace state={{ from: '/coach' }} />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SportDashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/coach" element={<CoachRoute />} />
        <Route path="/member" element={<Member />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
