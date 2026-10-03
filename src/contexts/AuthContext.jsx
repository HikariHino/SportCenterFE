import { createContext, useContext, useState } from 'react'

import { logout as logoutApi } from '../services/authService'
import { clearSession, getRefreshTokenKey, getSavedUser, saveSession } from '../utils/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getSavedUser)

  const login = (userData, token, remember = true) => {
    const savedUser = saveSession(userData, token, remember)
    setUser(savedUser)
    return savedUser
  }

  const logout = async () => {
    const refreshTokenKey = getRefreshTokenKey()
    try {
      if (refreshTokenKey) await logoutApi({ refreshTokenKey })
    } catch {
      // Local logout must still complete when the server session is already expired or offline.
    } finally {
      clearSession()
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
