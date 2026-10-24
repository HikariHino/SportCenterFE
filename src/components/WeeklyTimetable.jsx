import { useId, useMemo, useRef, useState } from 'react'
import { BookOpen, CheckSquare, ChevronLeft, ChevronRight, Clock3, MapPin, Plus, Square, User } from 'lucide-react'
import { classStatusLabel } from '../utils/memberClasses'
import { buildWeeklyTimetable, shiftTimetableDate, timetableDateKey, timetableWeekStart } from '../utils/memberTimetable'
import '../style/WeeklyTimetable.css'
import { sessionEnrollmentCount } from '../utils/sessionEnrollment'
import AttendanceStatus from './AttendanceStatus'

export default function WeeklyTimetable({ items, weekStart, onWeekChange, onSelect, totalCount, onReschedule, onCreate, canReschedule = () => true, getStatusLabel = item => classStatusLabel(item.status), interactionDisabled = false, selectionMode = false, selectedSessionIds = [], canSelectSession = () => true, showAttendance = false, showCancellationReason = false, now = Date.now(), title = 'Thời khóa biểu hàng tuần', description = 'Lịch học theo giờ Việt Nam · Chọn buổi học để xem chi tiết' }) {
  const titleId = useId()
  const dragged = useRef(null)
  const suppressClickUntil = useRef(0)
  const [draggedId, setDraggedId] = useState(null)
  const [dropTarget, setDropTarget] = useState('')
  const selectedIds = new Set(selectedSessionIds.map(String))
  const { days, rows, count } = useMemo(() => buildWeeklyTimetable(items, weekStart), [items, weekStart])
  const today = timetableDateKey(now)
  const weekLabel = `${days[0].dateLabel} – ${days[6].dateLabel}/${days[6].key.slice(0, 4)}`
  const clearDrag = () => { dragged.current = null; setDraggedId(null); setDropTarget('') }
  const targetKey = target => `${target.date}-${target.startTime || 'day'}-${target.endTime || ''}-${Boolean(target.nextDay)}`
  const canCreate = target => !interactionDisabled && !selectionMode && target.date >= today
    && (!target.startTime || Date.parse(`${target.date}T${target.startTime}:00+07:00`) > now)
  const createSession = target => {
    if (onCreate && canCreate(target) && Date.now() > suppressClickUntil.current) onCreate(target)
  }
  const dropProps = target => {
    if (!onReschedule || interactionDisabled || selectionMode) return {}
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
        <button type="button" aria-label="Tuần sau" onClick={() => onWeekChange(shiftTimetableDate(weekStart, 7))}><ChevronRight size={17} /></button>
      </div>
    </div>
    <div className="member-timetable-scroll" role="region" aria-label="Bảng lịch học tuần, có thể cuộn ngang" tabIndex={0}>
      <table className="member-timetable-table">
        <caption className="member-timetable-sr-only">Thời khóa biểu tuần {weekLabel}</caption>
        <thead><tr><th scope="col">Khung giờ</th>{days.map(day => <th key={day.key} scope="col" {...dropProps({ date: day.key })} className={`${day.key === today ? 'is-today' : ''}${dropTarget === targetKey({ date: day.key }) ? ' is-drop-target' : ''}`} aria-current={day.key === today ? 'date' : undefined}>
          {onCreate ? <button type="button" className="member-timetable-create-day" data-create-date={day.key} disabled={!canCreate({ date: day.key })} aria-label={`Tạo buổi học ${day.label}, ngày ${day.dateLabel}/${day.key.slice(0, 4)}`} onClick={() => createSession({ date: day.key })}>
            {day.label}<span>{day.dateLabel}{day.key === today && ' · Hôm nay'}</span>
          </button> : <>{day.label}<span>{day.dateLabel}{day.key === today && ' · Hôm nay'}</span></>}
        </th>)}</tr></thead>
        <tbody>{rows.length ? rows.map(row => <tr key={row.key}>
          <th scope="row"><Clock3 size={15} /><span>{row.start}</span><small>{row.end}{row.nextDay && ' (+1 ngày)'}</small></th>
          {row.cells.map((items, index) => <td key={days[index].key} {...dropProps({ date: days[index].key, startTime: row.start, endTime: row.end, nextDay: row.nextDay })} className={`${days[index].key === today ? 'is-today' : ''}${dropTarget === targetKey({ date: days[index].key, startTime: row.start, endTime: row.end, nextDay: row.nextDay }) ? ' is-drop-target' : ''}`}>
            {items.length ? items.map(item => {
              const isCancelled = ['cancelled', 'canceled'].includes(String(item.status || item.Status).trim().toLowerCase()) || ['cancelled', 'canceled'].includes(String(item.sessionStatus).trim().toLowerCase())
              const movable = Boolean(onReschedule && !interactionDisabled && !selectionMode && canReschedule(item))
              const selected = selectedIds.has(String(item.id))
              return <button type="button" className={`member-timetable-session${isCancelled ? ' is-cancelled' : ''}${movable ? ' is-movable' : ''}${selectionMode && selected ? ' is-selected' : ''}${draggedId === item.id ? ' is-dragging' : ''}`} key={item.id} data-session-id={item.id} aria-pressed={selectionMode ? selected : undefined} disabled={selectionMode && (interactionDisabled || !canSelectSession(item, now))} draggable={movable} onDragStart={event => {
                if (!movable) { event.preventDefault(); return }
                dragged.current = item
                setDraggedId(item.id)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', String(item.id))
              }} onDragEnd={() => { suppressClickUntil.current = Date.now() + 250; clearDrag() }} onClick={() => { if (Date.now() > suppressClickUntil.current) onSelect(item.id) }}>
                {selectionMode && <span className="member-timetable-selection">{selected ? <CheckSquare size={16} /> : <Square size={16} />}{selected ? 'Đã chọn' : canSelectSession(item, now) ? 'Chọn buổi học' : 'Không thể hủy'}</span>}
                <strong><BookOpen size={16} />{item.className || `Buổi học #${item.sessionId || item.id}`}</strong>
                <span className="member-timetable-session-time"><Clock3 size={14} />{row.start} – {row.end}{row.nextDay && ' (+1 ngày)'}</span>
                <span><MapPin size={14} />{item.roomName || 'Chưa cập nhật phòng'}</span>
                <span><User size={14} />{item.coachName || 'Chưa phân công HLV'}</span>
                <small>{isCancelled ? 'Đã hủy' : getStatusLabel(item, now)}</small>
                {showCancellationReason && isCancelled && <small className="member-timetable-cancellation-reason">Lý do hủy: {item.cancellationReason?.trim() || 'Chưa cập nhật'}</small>}
                {showAttendance && <AttendanceStatus item={item} />}
                {movable && <small className="member-timetable-drag-hint">Kéo để đổi lịch</small>}
                {onReschedule && !isCancelled && sessionEnrollmentCount(item) > 0 && <small>{sessionEnrollmentCount(item)} học viên đã đăng ký</small>}
              </button>
            }) : onCreate ? <button type="button" className="member-timetable-create-slot" data-create-date={days[index].key} data-create-time={row.start} disabled={!canCreate({ date: days[index].key, startTime: row.start })} aria-label={`Tạo buổi học ngày ${days[index].dateLabel}/${days[index].key.slice(0, 4)}, ${row.start} đến ${row.end}${row.nextDay ? ' ngày hôm sau' : ''}`} onClick={() => createSession({ date: days[index].key, startTime: row.start, endTime: row.end, nextDay: row.nextDay })}><Plus size={17} /><span>Thêm buổi học</span></button>
              : <span className="member-timetable-empty" aria-label="Không có buổi học">—</span>}
          </td>)}
        </tr>) : onCreate ? <tr>
          <th scope="row">Chọn giờ</th>
          {days.map(day => <td key={day.key} {...dropProps({ date: day.key })} className={`${day.key === today ? 'is-today' : ''}${dropTarget === targetKey({ date: day.key }) ? ' is-drop-target' : ''}`}>
            <button type="button" className="member-timetable-create-slot" data-create-date={day.key} disabled={!canCreate({ date: day.key })} aria-label={`Tạo buổi học ngày ${day.dateLabel}/${day.key.slice(0, 4)}`} onClick={() => createSession({ date: day.key })}><Plus size={17} /><span>Thêm buổi học</span></button>
          </td>)}
        </tr> : <tr><td className="member-timetable-no-sessions" colSpan={8}>Không có buổi học trong tuần này. Bạn có thể chuyển tuần hoặc chọn ngày khác.</td></tr>}</tbody>
      </table>
    </div>
  </section>
}
