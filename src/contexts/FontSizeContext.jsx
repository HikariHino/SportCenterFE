import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react'
import { FONT_SIZE_STORAGE_KEY, readFontSizePreference, validFontSize } from '../utils/fontSizePreference'

const FontSizeContext = createContext(null)

export function FontSizeProvider({ children }) {
  const [fontSize, setFontSize] = useState(readFontSizePreference)
  useLayoutEffect(() => {
    document.documentElement.dataset.fontSize = fontSize
  }, [fontSize])

  useEffect(() => {
    const onStorage = event => {
      if (event.key === FONT_SIZE_STORAGE_KEY || event.key === null) setFontSize(readFontSizePreference())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const changeFontSize = next => {
    if (!validFontSize(next)) return
    setFontSize(next)
    try { localStorage.setItem(FONT_SIZE_STORAGE_KEY, next) } catch { /* The setting still applies when storage is unavailable. */ }
  }

  return <FontSizeContext.Provider value={{ fontSize, changeFontSize }}>{children}</FontSizeContext.Provider>
}

export const useFontSize = () => useContext(FontSizeContext)
