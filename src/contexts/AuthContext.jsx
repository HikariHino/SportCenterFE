import { createContext, useContext, useEffect, useRef, useState } from 'react'

import { logout as logoutApi } from '../services/authService'
import { ACTIVE_LOGIN_KEY, adoptPublishedBrowserLogin, clearSession, getRefreshTokenKey, getSavedUser, reconcileBrowserSession, saveSession, SESSION_EXPIRED_EVENT } from '../utils/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getSavedUser)
  const currentUser = useRef(user)
  const observedLogin = useRef(localStorage.getItem(ACTIVE_LOGIN_KEY))
  currentUser.current = user

  useEffect(() => {
    const expired = () => { currentUser.current = null; setUser(null) }
    const sync = () => {
      const activeLogin = localStorage.getItem(ACTIVE_LOGIN_KEY)
      if (!currentUser.current && activeLogin !== observedLogin.current) adoptPublishedBrowserLogin(observedLogin.current)
      observedLogin.current = activeLogin
      const saved = reconcileBrowserSession() ? getSavedUser() : null
      currentUser.current = saved
      setUser(current => JSON.stringify(current) === JSON.stringify(saved) ? current : saved)
    }
    const storage = event => { if (event.key === ACTIVE_LOGIN_KEY || event.key === 'user' || event.key === null) sync() }
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
    currentUser.current = savedUser
    observedLogin.current = localStorage.getItem(ACTIVE_LOGIN_KEY)
    setUser(savedUser)
    return savedUser
  }

  const endSession = () => {
    clearSession()
    currentUser.current = null
    observedLogin.current = localStorage.getItem(ACTIVE_LOGIN_KEY)
    setUser(null)
  }

  const refreshUserProfile = profile => {
    const current = getSavedUser()
    if (!current || String(current.userId ?? current.id) !== String(profile?.userId)) return
    const next = { ...current, fullName: profile.fullName, name: profile.fullName, email: profile.email }
    try {
      sessionStorage.setItem('user', JSON.stringify(next))
      if (localStorage.getItem('loginSessionId') === sessionStorage.getItem('loginSessionId')) localStorage.setItem('user', JSON.stringify(next))
    } catch { /* The current view can still reflect the confirmed profile. */ }
    setUser(next)
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
    <AuthContext.Provider value={{ user, login, logout, endSession, refreshUserProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
