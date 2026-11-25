import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

export default function ThemeToggle({ compact = true }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const label = isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'

  return (
    <button className={`theme-toggle${compact ? ' theme-toggle--icon' : ''}`} type="button" onClick={toggleTheme} aria-label={label} title={label}>
      <span className="theme-toggle-icon" data-theme={theme} aria-hidden="true">
        <Sun className="theme-toggle-sun" size={18} />
        <Moon className="theme-toggle-moon" size={18} />
      </span>
      {!compact && <span>{isDark ? 'Chế độ sáng' : 'Chế độ tối'}</span>}
    </button>
  )
}
