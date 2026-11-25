import { roomSessionForTimetable } from './roomTimetable.js'
import { sessionEnrollmentCount } from './sessionEnrollment.js'

export function assertRoomMutationAllowed({ room, rooms, groups, capacity, deactivate = false, now = Date.now() }) {
  for (const { sportClass, items } of groups) {
    for (const item of items) {
      const session = roomSessionForTimetable(item, sportClass, rooms, room)
      if (!session || ['cancelled', 'canceled', 'completed'].includes(String(session.status).trim().toLowerCase())) continue
      const end = Date.parse(session.endsAt)
      if (!Number.isFinite(end)) throw new Error(`Chưa xác nhận được thời gian buổi #${session.id}. Vui lòng kiểm tra lịch phòng trước khi thay đổi.`)
      if (end <= now) continue
      const label = `buổi #${session.id} của lớp “${session.className || sportClass.id}”`
      if (deactivate) throw new Error(`Phòng còn ${label} chưa kết thúc. Vui lòng dời hoặc hủy buổi học trước khi ngừng hoạt động phòng.`)
      const sessionCapacity = Number(session.capacity)
      if (!Number.isInteger(sessionCapacity) || sessionCapacity < 1) throw new Error(`Chưa xác nhận được sức chứa ${label}. Vui lòng kiểm tra lịch phòng trước khi giảm sức chứa.`)
      const enrolled = sessionEnrollmentCount(session)
      const required = Math.max(sessionCapacity, enrolled ?? 0)
      if (Number(capacity) < required) throw new Error(`Không thể giảm sức chứa phòng xuống ${capacity}: ${label} có sức chứa ${sessionCapacity}${enrolled != null ? ` và ${enrolled} học viên đăng ký` : ''}. Sức chứa phòng phải từ ${required} người trở lên.`)
    }
  }
}
