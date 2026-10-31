import { useId } from 'react'
import { gymCheckInStatus, gymCheckInStatusLabel, gymDateKey, shiftGymDate } from '../utils/gymCheckInHistory'
import '../style/GymHistoryControls.css'

export function GymDateRangeFields({ value, onChange, onPreset, disabled }) {
  const id = useId()
  const today = gymDateKey()
  return <>
    <label htmlFor={`${id}-from`}>Từ ngày<input id={`${id}-from`} type="date" value={value.fromDate} disabled={disabled} onChange={event => onChange({ ...value, fromDate: event.target.value })} /></label>
    <label htmlFor={`${id}-to`}>Đến ngày<input id={`${id}-to`} type="date" value={value.toDate} disabled={disabled} onChange={event => onChange({ ...value, toDate: event.target.value })} /></label>
    <div className="gym-history-presets" aria-label="Chọn nhanh khoảng ngày">
      {[['Hôm nay', today, today], ['7 ngày', shiftGymDate(today, -6), today], ['Tất cả', '', '']].map(([label, fromDate, toDate]) =>
        <button type="button" key={label} disabled={disabled} onClick={() => onPreset({ fromDate, toDate })}>{label}</button>)}
    </div>
  </>
}

export function GymCheckInStatus({ item }) {
  return <span className="gym-checkin-status" data-status={gymCheckInStatus(item)}>{gymCheckInStatusLabel(item)}</span>
}
