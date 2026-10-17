import { SearchX } from 'lucide-react'

export function EmptyState({ title = 'Chưa có dữ liệu', text }) {
  return <div className="coach-empty"><SearchX size={28} /><strong>{title}</strong><p>{text}</p></div>
}

export const timeFormatter = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export const sessionDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export const checkInFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export const initials = name => String(name || 'Học viên').split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toLocaleUpperCase('vi-VN')

export const registrationLabel = status => ({
  registered: 'Đã đăng ký',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}[String(status || '').toLowerCase()] || status || 'Chưa xác định')

export const attendanceLabel = status => ({
  present: 'Đã điểm danh',
  late: 'Đi trễ',
  absent: 'Vắng mặt',
  excused: 'Có phép',
}[String(status || '').toLowerCase()] || 'Chưa điểm danh')

export const attendanceTone = status => ({
  present: 'present',
  late: 'late',
  absent: 'absent',
  excused: 'excused',
}[String(status || '').toLowerCase()] || 'pending')

export const attendanceValue = status => ({
  present: 'Present',
  absent: 'Absent',
  excused: 'Excused',
}[String(status || '').toLowerCase()] || 'Present')

export const attendanceOptions = [
  ['Present', 'Có mặt'],
  ['Absent', 'Vắng mặt'],
  ['Excused', 'Có phép'],
]

export const mapRosterStudent = student => ({
  id: student.registrationId,
  registrationId: student.registrationId,
  memberId: student.memberId,
  name: student.fullName || 'Học viên chưa cập nhật tên',
  registrationStatus: registrationLabel(student.registrationStatus),
  attendanceStatus: attendanceLabel(student.attendanceStatus),
  attendanceTone: attendanceTone(student.attendanceStatus),
  attendanceValue: attendanceValue(student.attendanceStatus),
  checkInTime: student.checkInTime ? checkInFormatter.format(new Date(student.checkInTime)) : 'Chưa check-in',
})

export const formatSessionOption = session => {
  const start = new Date(session.startsAt)
  const end = new Date(session.endsAt)
  return `${session.className} · ${sessionDateFormatter.format(start)} · ${timeFormatter.format(start)}–${timeFormatter.format(end)}`
}

export const getStudentsError = error => error.response?.data?.message || error.message || 'Không thể kết nối tới API học viên theo buổi.'

