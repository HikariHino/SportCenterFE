import { useId, useMemo } from 'react'
import WeeklyTimetable from '../../components/WeeklyTimetable'
import { isCancelledSession, isScheduledSession } from '../../utils/sessionScheduling'

const formatDateTime = value => value ? new Date(value).toLocaleString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short',
}) : 'Chưa cập nhật'

export default function RoomSessionTimetable({ items, onSelect, ...timetableProps }) {
  const headingId = useId()
  const { scheduled, cancelled } = useMemo(() => {
    const scheduled = [], cancelled = []
    for (const item of items) {
      if (isCancelledSession(item)) cancelled.push(item)
      else if (isScheduledSession(item)) scheduled.push(item)
    }
    cancelled.sort((left, right) => Date.parse(right.startsAt) - Date.parse(left.startsAt))
    return { scheduled, cancelled }
  }, [items])

  return <>
    <WeeklyTimetable {...timetableProps} items={scheduled} totalCount={scheduled.length} onSelect={onSelect} />
    <p className="room-timetable-note">Các ô trống là khung giờ chưa có buổi học trong lịch. Các buổi đã hủy được liệt kê ở mục riêng bên dưới và không chiếm lịch phòng.</p>
    <details className="room-cancelled-sessions">
      <summary id={headingId}>Buổi học đã hủy <span>{cancelled.length} buổi</span></summary>
      <p>Toàn bộ buổi học đã hủy của phòng, sắp xếp theo ngày học từ mới đến cũ.</p>
      {cancelled.length ? <div className="room-cancelled-sessions-scroll" role="region" aria-labelledby={headingId} tabIndex={0}>
        <table>
          <caption className="member-timetable-sr-only">Danh sách buổi học đã hủy của phòng</caption>
          <thead><tr><th scope="col">Lớp học</th><th scope="col">Bắt đầu</th><th scope="col">Kết thúc</th><th scope="col">Huấn luyện viên</th><th scope="col">Lý do hủy</th><th scope="col">Thao tác</th></tr></thead>
          <tbody>{cancelled.map(item => <tr key={item.id}>
            <th scope="row">{item.className || `Buổi học #${item.id}`}</th>
            <td>{formatDateTime(item.startsAt)}</td>
            <td>{formatDateTime(item.endsAt)}</td>
            <td>{item.coachName || 'Chưa phân công'}</td>
            <td>{item.cancellationReason || 'Chưa cập nhật'}</td>
            <td><button type="button" onClick={() => onSelect(item.id)}>Xem chi tiết<span className="member-timetable-sr-only"> buổi học #{item.id}</span></button></td>
          </tr>)}</tbody>
        </table>
      </div> : <p role="status">Phòng chưa có buổi học nào bị hủy.</p>}
    </details>
  </>
}
