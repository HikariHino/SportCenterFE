import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import { FontSizeProvider } from './contexts/FontSizeContext.jsx'
import './style/Theme.css'
import { initializeBrowserSession } from './utils/auth.js'

initializeBrowserSession().then(() => createRoot(document.getElementById('root')).render(
  <StrictMode>
    <FontSizeProvider>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </FontSizeProvider>
  </StrictMode>,
))
