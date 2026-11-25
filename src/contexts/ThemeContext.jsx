import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createThemeTransition } from '../utils/themeTransition'

const ThemeContext = createContext(null)
const storageKey = 'sportcenter-theme'
const systemQuery = '(prefers-color-scheme: dark)'
const validTheme = value => value === 'light' || value === 'dark'

function getSavedTheme() {
  try {
    const saved = localStorage.getItem(storageKey)
    return validTheme(saved) ? saved : null
  } catch {
    return null
  }
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(getSavedTheme)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(systemQuery).matches)
  const theme = preference || (systemDark ? 'dark' : 'light')
  const transition = useRef(null)
  const initialized = useRef(false)

  useLayoutEffect(() => {
    if (!transition.current) transition.current = createThemeTransition()
    transition.current.apply(theme, { animate: initialized.current })
    initialized.current = true
  }, [theme])

  useLayoutEffect(() => {
    return () => {
      transition.current?.dispose()
      transition.current = null
      initialized.current = false
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia(systemQuery)
    const onSystemChange = event => setSystemDark(event.matches)
    const onStorage = event => {
      if (event.key === storageKey || event.key === null) {
        setPreference(getSavedTheme())
      }
    }
    setSystemDark(media.matches)
    media.addEventListener('change', onSystemChange)
    window.addEventListener('storage', onStorage)
    return () => {
      media.removeEventListener('change', onSystemChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  function toggleTheme() {
    setPreference(current => (current || (systemDark ? 'dark' : 'light')) === 'dark' ? 'light' : 'dark')
  }

  useEffect(() => {
    if (!preference) return
    try { localStorage.setItem(storageKey, preference) }
    catch { /* Switching still works when browser storage is unavailable. */ }
  }, [preference])

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
