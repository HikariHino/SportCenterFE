import { useId, useMemo } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Clock3, MapPin, User } from 'lucide-react'
import { classStatusLabel } from '../utils/memberClasses'
import { buildWeeklyTimetable, shiftTimetableDate, timetableDateKey, timetableWeekStart } from '../utils/memberTimetable'
import '../style/WeeklyTimetable.css'

export default function WeeklyTimetable({ items, weekStart, onWeekChange, onSelect, now = Date.now(), title = 'Thời khóa biểu hàng tuần', description = 'Lịch học theo giờ Việt Nam · Chọn buổi học để xem chi tiết' }) {
  const titleId = useId()
  const { days, rows, count } = useMemo(() => buildWeeklyTimetable(items, weekStart), [items, weekStart])
  const today = timetableDateKey(now)
  const currentWeek = timetableWeekStart(now)
  const weekLabel = `${days[0].dateLabel} – ${days[6].dateLabel}/${days[6].key.slice(0, 4)}`

  return <section className="member-timetable" aria-labelledby={titleId}>
    <header className="member-timetable-heading">
      <div><h3 id={titleId}>{title}</h3><p>{description}</p></div>
      <span className="member-timetable-count">{count} buổi học</span>
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
        <thead><tr><th scope="col">Khung giờ</th>{days.map(day => <th key={day.key} scope="col" className={day.key === today ? 'is-today' : ''} aria-current={day.key === today ? 'date' : undefined}>{day.label}<span>{day.dateLabel}{day.key === today && ' · Hôm nay'}</span></th>)}</tr></thead>
        <tbody>{rows.length ? rows.map(row => <tr key={row.key}>
          <th scope="row"><Clock3 size={15} /><span>{row.start}</span><small>{row.end}{row.nextDay && ' (+1 ngày)'}</small></th>
          {row.cells.map((items, index) => <td key={days[index].key} className={days[index].key === today ? 'is-today' : ''}>
            {items.length ? items.map(item => {
              const isCancelled = ['cancelled', 'canceled'].includes(String(item.status).toLowerCase()) || ['cancelled', 'canceled'].includes(String(item.sessionStatus).toLowerCase())
              return <button type="button" className={`member-timetable-session${isCancelled ? ' is-cancelled' : ''}`} key={item.id} onClick={() => onSelect(item.id)}>
                <strong><BookOpen size={16} />{item.className || `Buổi học #${item.sessionId || item.id}`}</strong>
                <span className="member-timetable-session-time"><Clock3 size={14} />{row.start} – {row.end}{row.nextDay && ' (+1 ngày)'}</span>
                <span><MapPin size={14} />{item.roomName || 'Chưa cập nhật phòng'}</span>
                <span><User size={14} />{item.coachName || 'Chưa phân công HLV'}</span>
                <small>{isCancelled ? 'Đã hủy' : classStatusLabel(item.status)}</small>
              </button>
            }) : <span className="member-timetable-empty" aria-label="Không có buổi học">—</span>}
          </td>)}
        </tr>) : <tr><td className="member-timetable-no-sessions" colSpan={8}>Không có buổi học trong tuần này. Bạn có thể chuyển tuần hoặc chọn ngày khác.</td></tr>}</tbody>
      </table>
    </div>
  </section>
}
