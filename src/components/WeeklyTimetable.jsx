import { useId, useMemo, useRef, useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Clock3, MapPin, User } from 'lucide-react'
import { classStatusLabel } from '../utils/memberClasses'
import { buildWeeklyTimetable, shiftTimetableDate, timetableDateKey, timetableWeekStart } from '../utils/memberTimetable'
import '../style/WeeklyTimetable.css'
import { sessionEnrollmentCount } from '../utils/sessionEnrollment'

export default function WeeklyTimetable({ items, weekStart, onWeekChange, onSelect, totalCount, onReschedule, canReschedule = () => true, interactionDisabled = false, now = Date.now(), title = 'Thời khóa biểu hàng tuần', description = 'Lịch học theo giờ Việt Nam · Chọn buổi học để xem chi tiết' }) {
  const titleId = useId()
  const dragged = useRef(null)
  const suppressClickUntil = useRef(0)
  const [draggedId, setDraggedId] = useState(null)
  const [dropTarget, setDropTarget] = useState('')
  const { days, rows, count } = useMemo(() => buildWeeklyTimetable(items, weekStart), [items, weekStart])
  const today = timetableDateKey(now)
  const currentWeek = timetableWeekStart(now)
  const weekLabel = `${days[0].dateLabel} – ${days[6].dateLabel}/${days[6].key.slice(0, 4)}`
  const clearDrag = () => { dragged.current = null; setDraggedId(null); setDropTarget('') }
  const targetKey = target => `${target.date}-${target.startTime || 'day'}-${target.endTime || ''}-${Boolean(target.nextDay)}`
  const dropProps = target => {
    if (!onReschedule || interactionDisabled) return {}
    const key = targetKey(target)
    return {
      'data-drop-date': target.date,
      'data-drop-time': target.startTime,
      onDragOver: event => {
        if (!dragged.current) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setDropTarget(key)
      },
      onDragLeave: event => { if (!event.currentTarget.contains(event.relatedTarget)) setDropTarget(previous => previous === key ? '' : previous) },
      onDrop: event => {
        const item = dragged.current
        if (!item) return
        event.preventDefault()
        event.stopPropagation()
        suppressClickUntil.current = Date.now() + 250
        clearDrag()
        onReschedule(item, target)
      },
    }
  }

  return <section className="member-timetable" aria-labelledby={titleId}>
    <header className="member-timetable-heading">
      <div><h3 id={titleId}>{title}</h3><p>{description}</p></div>
      <span className="member-timetable-count">{totalCount == null ? `${count} buổi học` : `${count} buổi tuần này · ${totalCount} buổi tổng cộng`}</span>
    </header>
    <div className="member-timetable-toolbar">
      <strong aria-live="polite">Tuần {weekLabel}</strong>
      <div className="member-timetable-navigation">
        <label>Chọn ngày<input type="date" value={weekStart} onChange={event => { if (event.target.value) onWeekChange(timetableWeekStart(event.target.value)) }} /></label>
        <button type="button" aria-label="Tuần trước" onClick={() => onWeekChange(shiftTimetableDate(weekStart, -7))}><ChevronLeft size={17} /></button>
        <button type="button" disabled={weekStart === currentWeek} onClick={() => onWeekChange(currentWeek)}>Tuần này</button>
        <button type="button" aria-label="Tuần sau" onClick={() => onWeekChange(shiftTimetableDate(weekStart, 7))}><ChevronRight size={17} /></button>
      </div>
    </div>
    <div className="member-timetable-scroll" role="region" aria-label="Bảng lịch học tuần, có thể cuộn ngang" tabIndex={0}>
      <table className="member-timetable-table">
        <caption className="member-timetable-sr-only">Thời khóa biểu tuần {weekLabel}</caption>
        <thead><tr><th scope="col">Khung giờ</th>{days.map(day => <th key={day.key} scope="col" {...dropProps({ date: day.key })} className={`${day.key === today ? 'is-today' : ''}${dropTarget === targetKey({ date: day.key }) ? ' is-drop-target' : ''}`} aria-current={day.key === today ? 'date' : undefined}>{day.label}<span>{day.dateLabel}{day.key === today && ' · Hôm nay'}</span></th>)}</tr></thead>
        <tbody>{rows.length ? rows.map(row => <tr key={row.key}>
          <th scope="row"><Clock3 size={15} /><span>{row.start}</span><small>{row.end}{row.nextDay && ' (+1 ngày)'}</small></th>
          {row.cells.map((items, index) => <td key={days[index].key} {...dropProps({ date: days[index].key, startTime: row.start, endTime: row.end, nextDay: row.nextDay })} className={`${days[index].key === today ? 'is-today' : ''}${dropTarget === targetKey({ date: days[index].key, startTime: row.start, endTime: row.end, nextDay: row.nextDay }) ? ' is-drop-target' : ''}`}>
            {items.length ? items.map(item => {
              const isCancelled = ['cancelled', 'canceled'].includes(String(item.status).toLowerCase()) || ['cancelled', 'canceled'].includes(String(item.sessionStatus).toLowerCase())
              const movable = Boolean(onReschedule && !interactionDisabled && canReschedule(item))
              return <button type="button" className={`member-timetable-session${isCancelled ? ' is-cancelled' : ''}${movable ? ' is-movable' : ''}${draggedId === item.id ? ' is-dragging' : ''}`} key={item.id} data-session-id={item.id} draggable={movable} onDragStart={event => {
                if (!movable) { event.preventDefault(); return }
                dragged.current = item
                setDraggedId(item.id)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', String(item.id))
              }} onDragEnd={() => { suppressClickUntil.current = Date.now() + 250; clearDrag() }} onClick={() => { if (Date.now() > suppressClickUntil.current) onSelect(item.id) }}>
                <strong><BookOpen size={16} />{item.className || `Buổi học #${item.sessionId || item.id}`}</strong>
                <span className="member-timetable-session-time"><Clock3 size={14} />{row.start} – {row.end}{row.nextDay && ' (+1 ngày)'}</span>
                <span><MapPin size={14} />{item.roomName || 'Chưa cập nhật phòng'}</span>
                <span><User size={14} />{item.coachName || 'Chưa phân công HLV'}</span>
                <small>{isCancelled ? 'Đã hủy' : classStatusLabel(item.status)}</small>
                {movable && <small className="member-timetable-drag-hint">Kéo để đổi lịch</small>}
                {onReschedule && !isCancelled && sessionEnrollmentCount(item) > 0 && <small>{sessionEnrollmentCount(item)} học viên đã đăng ký</small>}
              </button>
            }) : <span className="member-timetable-empty" aria-label="Không có buổi học">—</span>}
          </td>)}
        </tr>) : <tr><td className="member-timetable-no-sessions" colSpan={8}>Không có buổi học trong tuần này. Bạn có thể chuyển tuần hoặc chọn ngày khác.</td></tr>}</tbody>
      </table>
    </div>
  </section>
}
