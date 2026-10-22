import { getAllClassSessions } from './sportClassService'
import { cancelRoomSessions } from './roomTimetableService'

export async function cancelSessionsForClass({ classId, sessions, reason }, onProgress) {
  if (!Number.isInteger(Number(classId)) || Number(classId) <= 0) throw new Error('Vui lòng chọn lớp học hợp lệ.')
  if (!sessions.length) throw new Error('Vui lòng chọn ít nhất một buổi học để hủy.')
  const latest = await getAllClassSessions(classId)
  const byId = new Map(latest.map(item => [String(item.id), item]))
  const current = sessions.map(item => {
    const saved = byId.get(String(item.id))
    if (!saved || String(saved.classId) !== String(classId)) {
      throw new Error('Có buổi học không còn thuộc lớp đã chọn. Vui lòng đóng xác nhận và tải lại danh sách.')
    }
    if (Date.parse(saved.startsAt) !== Date.parse(item.startsAt) || Date.parse(saved.endsAt) !== Date.parse(item.endsAt)) {
      throw new Error('Lịch học đã thay đổi. Vui lòng đóng xác nhận và tải lại danh sách trước khi hủy.')
    }
    return { ...item, ...saved }
  })
  return cancelRoomSessions({ sessions: current, reason }, onProgress)
}
