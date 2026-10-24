import { useMemo } from 'react'
import { BookOpen, CalendarDays, Clock3, MapPin, Search, User } from 'lucide-react'
import WeeklyTimetable from '../../components/WeeklyTimetable'
import AttendanceStatus from '../../components/AttendanceStatus'
import { buildWeeklyTimetable, timetableDateKey, timetableTime, timetableWeekStart } from '../../utils/memberTimetable'
import { classStatusLabel } from '../../utils/memberClasses'

export default function MemberWeeklySchedule({ items, weekStart, onWeekChange, onSelect, onBrowse, now }) {
  const { days, rows, count } = useMemo(() => buildWeeklyTimetable(items, weekStart), [items, weekStart])
  const today = timetableDateKey(now)
  return <div className="member-weekly-schedule">
    <WeeklyTimetable items={items} weekStart={weekStart} onWeekChange={onWeekChange} onSelect={onSelect} now={now} showAttendance showCancellationReason title="Thời khóa biểu" />
    <div className="member-schedule-agenda" aria-label="Lịch học theo ngày">
      {count ? days.map((day, index) => {
        const sessions = rows.flatMap(row => row.cells[index])
        if (!sessions.length) return null
        return <section className="member-agenda-day" key={day.key} aria-label={`${day.label}, ${day.dateLabel}`}>
          <h4 aria-current={day.key === today ? 'date' : undefined}><CalendarDays size={16} />{day.label}<span>{day.dateLabel}{day.key === today && ' · Hôm nay'}</span></h4>
          {sessions.map(item => {
            const cancelled = [item.status, item.sessionStatus].some(value => ['cancelled', 'canceled'].includes(String(value || '').trim().toLowerCase()))
            return <button type="button" className={`member-agenda-session${cancelled ? ' is-cancelled' : ''}`} key={item.id} data-registration-id={item.id} onClick={() => onSelect(item.id)}>
              <span className="member-agenda-time"><Clock3 size={14} />{timetableTime(item.startsAt)} – {timetableTime(item.endsAt)}{timetableDateKey(item.endsAt) > day.key && ' (+1 ngày)'}</span>
              <strong><BookOpen size={16} />{item.className || `Buổi học #${item.sessionId || item.id}`}</strong>
              <span><MapPin size={14} />{item.roomName || 'Chưa cập nhật phòng'}</span>
              <span><User size={14} />{item.coachName || 'Chưa phân công HLV'}</span>
              <small className="member-agenda-status">{cancelled ? 'Đã hủy' : classStatusLabel(item.status)}</small>
              {cancelled && <small>Lý do hủy: {item.cancellationReason?.trim() || 'Chưa cập nhật'}</small>}
              <AttendanceStatus item={item} />
            </button>
          })}
        </section>
      }) : <div className="member-agenda-empty" role="status"><CalendarDays size={30} /><strong>Tuần này chưa có buổi học</strong><p>Bạn có thể chuyển tuần hoặc tìm lớp để đặt lịch mới.</p></div>}
    </div>
    <footer className="member-schedule-footer"><p><Clock3 size={15} />Lịch hiển thị theo giờ Việt Nam (UTC+7).</p><div>{weekStart !== timetableWeekStart(now) && <button type="button" onClick={() => onWeekChange(timetableWeekStart(now))}>Về tuần hiện tại</button>}<button type="button" onClick={onBrowse}><Search size={15} />Tìm lớp học</button></div></footer>
  </div>
}
