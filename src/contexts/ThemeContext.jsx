import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'

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
  const previousTheme = useRef(theme)

  useLayoutEffect(() => {
    const root = document.documentElement
    const shouldAnimate = previousTheme.current !== theme
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (shouldAnimate) root.classList.add('theme-transitioning')
    root.dataset.theme = theme
    root.style.colorScheme = theme
    previousTheme.current = theme

    // Remove the temporary override after the 280ms color transition.
    const timer = shouldAnimate
      ? window.setTimeout(() => root.classList.remove('theme-transitioning'), 350)
      : null
    return () => {
      window.clearTimeout(timer)
      root.classList.remove('theme-transitioning')
    }
  }, [theme])

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
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setPreference(nextTheme)
    try {
      localStorage.setItem(storageKey, nextTheme)
    } catch {
      // Switching still works when browser storage is unavailable.
    }
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
