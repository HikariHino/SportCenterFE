import { getStaffAttendanceAvailability } from './staffAttendance.js'

const normalized = value => String(value || '').trim().toLowerCase()

export function isFrontDeskPresent(student) {
  return ['present', 'late'].includes(normalized(student.attendanceStatus))
    || (!student.attendanceStatus && Boolean(student.checkInTime))
}

export function frontDeskCheckInReason(session, student, now = Date.now()) {
  if (!session) return 'Chọn buổi học để điểm danh.'
  if (isFrontDeskPresent(student)) return 'Học viên đã được điểm danh.'
  if (student.attendanceStatus) return 'Học viên đã có kết quả điểm danh.'
  if (!['registered', 'completed'].includes(normalized(student.registrationStatus))) return 'Lượt đăng ký không còn hợp lệ để điểm danh.'
  const availability = getStaffAttendanceAvailability(session, now)
  return availability.open ? '' : availability.message
}

export function frontDeskSessionStatus(session, now = Date.now()) {
  const status = normalized(session.status)
  if (['cancelled', 'canceled'].includes(status)) return 'Đã hủy'
  if (status === 'completed') return 'Đã hoàn thành'
  if (status !== 'scheduled') return session.status || 'Chưa cập nhật'
  if (Date.parse(session.endsAt) <= now) return 'Đã diễn ra'
  if (Date.parse(session.startsAt) <= now) return 'Đang diễn ra'
  return 'Đã lên lịch'
}
