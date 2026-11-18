export const FONT_SIZE_STORAGE_KEY = 'sportcenter-font-size'
export const DEFAULT_FONT_SIZE = 'large'
export const FONT_SIZE_OPTIONS = [
  { value: 'small', label: 'Nhỏ' },
  { value: 'medium', label: 'Vừa' },
  { value: 'large', label: 'Lớn' },
]

export const validFontSize = value => FONT_SIZE_OPTIONS.some(option => option.value === value)

export function readFontSizePreference() {
  try {
    const saved = localStorage.getItem(FONT_SIZE_STORAGE_KEY)
    return validFontSize(saved) ? saved : DEFAULT_FONT_SIZE
  } catch {
    return DEFAULT_FONT_SIZE
  }
}
