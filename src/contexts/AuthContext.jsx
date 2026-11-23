import { createContext, useContext, useEffect, useState } from 'react'

import { logout as logoutApi } from '../services/authService'
import { ACTIVE_LOGIN_KEY, clearSession, getRefreshTokenKey, getSavedUser, reconcileBrowserSession, saveSession, SESSION_EXPIRED_EVENT } from '../utils/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getSavedUser)

  useEffect(() => {
    const expired = () => setUser(null)
    const sync = () => { if (!reconcileBrowserSession()) setUser(null) }
    const storage = event => { if (event.key === ACTIVE_LOGIN_KEY || event.key === null) sync() }
    const visible = () => { if (document.visibilityState === 'visible') sync() }
    window.addEventListener(SESSION_EXPIRED_EVENT, expired)
    window.addEventListener('storage', storage)
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', visible)
    sync()
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, expired)
      window.removeEventListener('storage', storage)
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [])

  const login = (userData, token, remember = true) => {
    const savedUser = saveSession(userData, token, remember)
    setUser(savedUser)
    return savedUser
  }

  const endSession = () => {
    clearSession()
    setUser(null)
  }

  const logout = async () => {
    const refreshTokenKey = getRefreshTokenKey()
    // End all tabs now, even if the server is slow or offline. A late logout
    // response must not clear a newer login established while it was pending.
    endSession()
    try {
      if (refreshTokenKey) await logoutApi({ refreshTokenKey })
    } catch {
      // Local logout must still complete when the server session is already expired or offline.
    }
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, endSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
