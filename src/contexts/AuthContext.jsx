import { createContext, useContext, useState } from 'react'

import { clearSession, getSavedUser, saveSession } from '../utils/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getSavedUser)

  const login = (userData, token, remember = true) => {
    const savedUser = saveSession(userData, token, remember)
    setUser(savedUser)
    return savedUser
  }

  const logout = () => {
    clearSession()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
