import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, UserRound } from 'lucide-react'
import { filterFrontDeskMembers } from '../../utils/frontDeskBooking'
import '../../style/CenterManager/FrontDeskMemberPicker.css'

export default function FrontDeskMemberPicker({ id, members, loading, disabled, value, onChange, label: fieldLabel = 'Học viên', required = false }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const listRef = useRef(null)
  const selected = members.find(member => String(member.memberId) === String(value))
  const matches = useMemo(() => filterFrontDeskMembers(members, query), [members, query])
  const results = matches.slice(0, 20)
  const label = member => `${member.fullName} · ${member.phone || 'Chưa có SĐT'} · #${member.memberId}`
  const choose = member => {
    if (!member || member.isActive === false) return
    onChange(String(member.memberId))
    setOpen(false)
    setQuery('')
    setActive(-1)
  }
  const move = direction => {
    const enabled = results.map((member, index) => member.isActive !== false ? index : -1).filter(index => index >= 0)
    if (!enabled.length) { setActive(-1); return }
    const position = enabled.indexOf(active)
    const next = position < 0 ? (direction > 0 ? 0 : enabled.length - 1) : (position + direction + enabled.length) % enabled.length
    setActive(enabled[next])
  }

  useEffect(() => {
    if (open && active >= 0) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  return <div className="fdesk-input-group fdesk-member-picker">
    <label htmlFor={id}><UserRound size={16} /> {fieldLabel}{required && ' (*)'}</label>
    <div className="fdesk-booking-search"><Search size={16} /><input id={id} type="search" role="combobox"
      autoComplete="off" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-results`}
      aria-required={required} required={required}
      aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
      placeholder={loading ? 'Đang tải học viên...' : 'Tìm theo tên hoặc số điện thoại'}
      value={open ? query : selected ? label(selected) : query} disabled={disabled || loading}
      onFocus={() => { setQuery(''); setOpen(true); setActive(-1) }} onBlur={() => setOpen(false)}
      onChange={event => { setQuery(event.target.value); setOpen(true); setActive(-1); if (value) onChange('') }}
      onKeyDown={event => {
        if (event.key === 'Escape') { setOpen(false); setActive(-1) }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); move(event.key === 'ArrowDown' ? 1 : -1) }
        if (event.key === 'Enter' && open) { event.preventDefault(); choose(results[active]) }
      }} /></div>
    {open && <div className="fdesk-member-dropdown">
      <div ref={listRef} id={`${id}-results`} role="listbox" aria-label="Học viên phù hợp">{results.map((member, index) => <div
        key={member.memberId} id={`${id}-option-${index}`} role="option" aria-selected={index === active}
        aria-disabled={member.isActive === false} className={`fdesk-member-option${index === active ? ' is-active' : ''}`}
        onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(member)}>
        <strong>{member.fullName}</strong><span>{member.phone || 'Chưa có SĐT'} · #{member.memberId}{member.isActive === false ? ' · Đã ngừng hoạt động' : ''}</span>
      </div>)}</div>
      <p className="fdesk-member-hint" role="status">{!matches.length ? 'Không tìm thấy học viên phù hợp.' : matches.length > results.length ? `Hiển thị ${results.length}/${matches.length} học viên. Nhập thêm tên hoặc số điện thoại để thu hẹp kết quả.` : `${matches.length} học viên phù hợp`}</p>
    </div>}
  </div>
}
