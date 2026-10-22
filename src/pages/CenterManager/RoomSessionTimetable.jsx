import { useMemo, useState } from 'react'
import WeeklyTimetable from '../../components/WeeklyTimetable'
import { isCancelledSession, isScheduledSession } from '../../utils/sessionScheduling'
import { getRoomTimetableWeek, roomSessionStatusLabel } from '../../utils/roomTimetable'
import CancelledRoomSessionsTimetable from './CancelledRoomSessionsTimetable'

export default function RoomSessionTimetable({ items, onSelect, onSelectCancelled = onSelect, weekStart, onWeekChange, ...timetableProps }) {
  const [cancelledOpen, setCancelledOpen] = useState(false)
  const { timetableSessions, cancelled } = useMemo(() => {
    const timetableSessions = [], cancelled = []
    for (const item of items) {
      if (isCancelledSession(item)) cancelled.push(item)
      else if (isScheduledSession(item) || String(item.status || item.Status).trim().toLowerCase() === 'completed') timetableSessions.push(item)
    }
    cancelled.sort((left, right) => Date.parse(right.startsAt) - Date.parse(left.startsAt))
    return { timetableSessions, cancelled }
  }, [items])
  const populatedWeek = getRoomTimetableWeek(timetableSessions, weekStart)

  return <>
    <WeeklyTimetable {...timetableProps} weekStart={weekStart} onWeekChange={onWeekChange} items={timetableSessions} totalCount={timetableSessions.length} onSelect={onSelect} getStatusLabel={roomSessionStatusLabel} />
    {populatedWeek !== weekStart && <div className="room-timetable-other-week" role="status">
      <p>Tuần đang xem không có buổi học. Phòng còn {timetableSessions.length} buổi học ở các tuần khác.</p>
      <button type="button" onClick={() => onWeekChange(populatedWeek)}>Xem tuần từ {populatedWeek.split('-').reverse().join('/')}</button>
    </div>}
    <p className="room-timetable-note">Các ô trống là khung giờ chưa có buổi học trong lịch. Bấm “Buổi học đã hủy” để mở thời khóa biểu riêng của các buổi đã hủy; các buổi này không chiếm lịch phòng.</p>
    <details className="room-cancelled-sessions" onToggle={event => setCancelledOpen(event.currentTarget.open)}>
      <summary>Buổi học đã hủy <span>{cancelled.length} buổi</span></summary>
      {cancelledOpen && (cancelled.length ? <CancelledRoomSessionsTimetable items={cancelled} initialWeek={weekStart} onSelect={onSelectCancelled} now={timetableProps.now} /> : <p role="status">Phòng chưa có buổi học nào bị hủy.</p>)}
    </details>
  </>
}
