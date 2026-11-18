import { Type } from 'lucide-react'
import { useFontSize } from '../contexts/FontSizeContext'
import { FONT_SIZE_OPTIONS } from '../utils/fontSizePreference'
import '../style/FontSizeControl.css'

export default function FontSizeControl() {
  const preference = useFontSize()
  if (!preference) return null
  const { fontSize, changeFontSize } = preference
  return <section className="font-size-settings" aria-label="Cỡ chữ website">
    <header><Type size={23} aria-hidden="true" /><div><h2>Cỡ chữ website</h2><p>Áp dụng cho toàn bộ website. Lớn là cỡ chữ tối đa.</p></div></header>
    <div className="font-size-options" role="group" aria-label="Chọn cỡ chữ">
      {FONT_SIZE_OPTIONS.map(option => <button type="button" key={option.value} aria-label={`Cỡ chữ ${option.label.toLocaleLowerCase('vi-VN')}`} aria-pressed={fontSize === option.value} onClick={() => changeFontSize(option.value)}>{option.label}</button>)}
    </div>
  </section>
}
