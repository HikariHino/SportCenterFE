import { getSessionRoom, roomSessionForTimetable } from './roomTimetable.js'
import { sessionsOverlap } from './sessionReschedule.js'
import { getClassDateRange } from './recurringSessions.js'
import { sessionEnrollmentCount } from './sessionEnrollment.js'
import { shiftTimetableDate } from './memberTimetable.js'

export const isCancelledSession = item => ['cancelled', 'canceled'].includes(String(item.status || item.Status || '').trim().toLowerCase())
export const isScheduledSession = item => String(item.status || item.Status || '').trim().toLowerCase() === 'scheduled'

export function assertCoachScheduleAvailable({ data, sportClass, rooms = [], groups, current }) {
  for (const group of groups) {
    for (const item of group.items) {
      if (current && String(group.sportClass.id) === String(sportClass.id) && String(item.id) === String(current.id)) continue
      if (isCancelledSession(item) || !sessionsOverlap(data, item)) continue
      if (String(item.coachId ?? group.sportClass.coachId) !== String(data.coachId)) continue
      const occupiedRoom = getSessionRoom(item, group.sportClass, rooms)
      const roomName = occupiedRoom?.name || rooms.find(room => occupiedRoom?.id != null && String(room.id) === String(occupiedRoom.id))?.name
      const formatTime = value => new Date(value).toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
      throw new Error(`Huấn luyện viên đã có lịch dạy trùng giờ ở lớp “${item.className || group.sportClass.className || `#${group.sportClass.id}`}”${occupiedRoom ? ` tại ${roomName || `phòng #${occupiedRoom.id}`}` : ''}, từ ${formatTime(item.startsAt)} đến ${formatTime(item.endsAt)} (giờ Việt Nam). Vui lòng chọn khung giờ hoặc huấn luyện viên khác.`)
    }
  }
}

export function assertSessionTimeRange({ startsAt, endsAt }, sportClass, now = Date.now()) {
  const start = Date.parse(startsAt), end = Date.parse(endsAt)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw new Error('Thời gian bắt đầu và kết thúc buổi học không hợp lệ.')
  if (start <= now) throw new Error('Buổi học phải bắt đầu sau thời điểm hiện tại.')
  const range = getClassDateRange(sportClass)
  const bound = (value, endOfDay = false) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? Date.parse(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}+07:00`) : Date.parse(value)
  if (!range.start || !range.end) throw new Error('Lớp chưa có ngày bắt đầu và kết thúc hợp lệ. Vui lòng cập nhật thời gian của lớp trước khi xếp lịch.')
  if (start < bound(sportClass.startDate) || end > bound(sportClass.endDate, true)) throw new Error('Buổi học phải nằm trong ngày bắt đầu và kết thúc của lớp.')
}

export function buildDatedSession({ date, startTime, endTime, endsNextDay = false }, { sportClass, now = Date.now() } = {}) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? Date.parse(`${date}T00:00:00Z`) : NaN
  if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== date) throw new Error('Vui lòng chọn ngày học hợp lệ.')
  const validTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')
  if (!validTime(startTime) || !validTime(endTime)) throw new Error('Vui lòng nhập giờ bắt đầu và kết thúc hợp lệ.')
  if (!endsNextDay && endTime <= startTime) throw new Error('Giờ kết thúc phải sau giờ bắt đầu. Chọn kết thúc vào ngày hôm sau nếu học qua đêm.')
  const item = {
    date, weekday: (new Date(day).getUTCDay() + 6) % 7,
    startsAt: new Date(`${date}T${startTime}:00+07:00`).toISOString(),
    endsAt: new Date(`${endsNextDay ? shiftTimetableDate(date, 1) : date}T${endTime}:00+07:00`).toISOString(),
  }
  assertSessionTimeRange(item, sportClass, now)
  return item
}

export function assertSessionCapacity(capacity, room, sportClass, current) {
  const limits = [Number(room.capacity), Number(sportClass.maxCapacity)]
  if (limits.some(value => !Number.isInteger(value) || value < 1)) throw new Error('Chưa xác nhận được sức chứa của phòng hoặc lớp. Vui lòng tải lại dữ liệu.')
  const limit = Math.min(...limits)
  if (!Number.isInteger(Number(capacity)) || Number(capacity) < 1 || Number(capacity) > limit) {
    throw new Error(`Sức chứa buổi học phải từ 1 đến ${limit} học viên (phòng: ${room.capacity}, lớp: ${sportClass.maxCapacity}).`)
  }
  const enrolled = sessionEnrollmentCount(current)
  if (Number(capacity) < enrolled) throw new Error(`Sức chứa không được nhỏ hơn ${enrolled} học viên đã đăng ký.`)
}

export function assertSessionSchedule({ data, sportClass, room, rooms, groups, current, now = Date.now() }) {
  if (!room || room.isActive === false) throw new Error('Phòng không tồn tại hoặc đã ngừng hoạt động.')
  if (sportClass.isActive === false) throw new Error('Lớp đã ngừng hoạt động, không thể mở hoặc đổi lịch buổi học.')
  assertSessionCapacity(data.capacity, room, sportClass, current)
  assertSessionTimeRange(data, sportClass, now)
  if (current && (isCancelledSession(current) || String(current.status || current.Status).toLowerCase() === 'completed' || Date.parse(current.startsAt) <= now)) throw new Error('Không thể chỉnh buổi học đã bắt đầu, đã hủy hoặc đã hoàn thành.')
  if (![data.coachId, data.cancellationPolicyId].every(value => Number.isInteger(Number(value)) && Number(value) > 0)) throw new Error('Vui lòng chọn huấn luyện viên và chính sách hủy hợp lệ.')
  const assigned = getSessionRoom(current || {}, sportClass, rooms)
  if (assigned && !roomSessionForTimetable(current || {}, sportClass, rooms, room)) throw new Error('Buổi học hoặc lớp đã thuộc phòng khác. Vui lòng chọn đúng phòng đã gán.')
  for (const group of groups) {
    for (const item of group.items) {
      if (current && String(group.sportClass.id) === String(sportClass.id) && String(item.id) === String(current.id)) continue
      if (isCancelledSession(item) || !sessionsOverlap(data, item)) continue
      if (roomSessionForTimetable(item, group.sportClass, rooms, room)) throw new Error(`Phòng ${room.name} đã có buổi học ${item.className || group.sportClass.className} trong khung giờ này.`)
      if (String(group.sportClass.id) === String(sportClass.id)) throw new Error('Lớp đã có buổi học giao nhau với khung giờ này.')
    }
  }
  assertCoachScheduleAvailable({ data, sportClass, rooms, groups, current })
}
