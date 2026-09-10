import { BrowserRouter, Routes, Route } from 'react-router-dom'
import SportDashboard from './pages/SportDashboard'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SportDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
