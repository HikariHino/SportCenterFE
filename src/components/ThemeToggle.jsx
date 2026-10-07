import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const label = isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'

  return (
    <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={label} title={label}>
      {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
      <span>{isDark ? 'Chế độ sáng' : 'Chế độ tối'}</span>
    </button>
  )
}
