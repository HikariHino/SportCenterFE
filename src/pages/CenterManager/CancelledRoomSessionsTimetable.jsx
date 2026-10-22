import { useState } from 'react'
import WeeklyTimetable from '../../components/WeeklyTimetable'
import { getCancelledRoomTimetableWeek, roomSessionStatusLabel } from '../../utils/roomTimetable'

export default function CancelledRoomSessionsTimetable({ items, initialWeek, onSelect, now }) {
  const [weekStart, setWeekStart] = useState(() => getCancelledRoomTimetableWeek(items, initialWeek))
  const populatedWeek = getCancelledRoomTimetableWeek(items, weekStart)

  return <div className="room-cancelled-timetable">
    <WeeklyTimetable items={items} weekStart={weekStart} onWeekChange={setWeekStart} onSelect={onSelect} totalCount={items.length} now={now} title="Thời khóa biểu buổi học đã hủy" description="Chọn buổi đã hủy để xem chi tiết · Lịch này không chiếm phòng" getStatusLabel={roomSessionStatusLabel} showCancellationReason />
    {populatedWeek !== weekStart && <div className="room-timetable-other-week" role="status"><p>Tuần đang xem không có buổi đã hủy.</p><button type="button" onClick={() => setWeekStart(populatedWeek)}>Xem tuần từ {populatedWeek.split('-').reverse().join('/')}</button></div>}
  </div>
}
