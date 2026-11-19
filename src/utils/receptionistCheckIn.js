import { getStaffAttendanceAvailability } from './staffAttendance.js'
const normalized = value => String(value || '').trim().toLowerCase()

export function receptionistCheckInReason(registration, now = Date.now()) {
  if (!registration?.sessionId) return 'Lượt đăng ký chưa được gắn buổi học.'
  if (registration.attendanceStatus || registration.checkInTime) return 'Hội viên đã có kết quả điểm danh cho buổi học này.'
  if (!['registered', 'completed'].includes(normalized(registration.status))) return 'Lượt đăng ký không còn hợp lệ để điểm danh.'
  const availability = getStaffAttendanceAvailability({ ...registration, status: registration.sessionStatus }, now)
  return availability.open ? '' : availability.message
}
