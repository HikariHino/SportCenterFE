import { getAllClassSessions } from './sportClassService'
import { cancelRoomSessions } from './roomTimetableService'

export async function cancelSessionsForClass({ classId, sessions, reason }, onProgress) {
  if (!Number.isInteger(Number(classId)) || Number(classId) <= 0) throw new Error('Vui lòng chọn lớp học hợp lệ.')
  if (!sessions.length) throw new Error('Vui lòng chọn ít nhất một buổi học để hủy.')
  // GET /api/classes/{classId}/sessions lấy lịch mới nhất trước khi gửi yêu cầu hủy.
  const latest = await getAllClassSessions(classId)
  const byId = new Map(latest.map(item => [String(item.id), item]))
  const current = sessions.map(item => {
    // So khớp ID, lớp, giờ bắt đầu và giờ kết thúc với lúc quản lý chọn buổi.
    const saved = byId.get(String(item.id))
    if (!saved || String(saved.classId) !== String(classId)) {
      throw new Error('Có buổi học không còn thuộc lớp đã chọn. Vui lòng đóng xác nhận và tải lại danh sách.')
    }
    if (Date.parse(saved.startsAt) !== Date.parse(item.startsAt) || Date.parse(saved.endsAt) !== Date.parse(item.endsAt)) {
      throw new Error('Lịch học đã thay đổi. Vui lòng đóng xác nhận và tải lại danh sách trước khi hủy.')
    }
    return { ...item, ...saved }
  })
  // Dùng trạng thái mới nhất để kiểm tra điều kiện và gọi POST /api/class-sessions/{sessionId}/cancel cho từng buổi.
  return cancelRoomSessions({ sessions: current, reason }, onProgress)
}
