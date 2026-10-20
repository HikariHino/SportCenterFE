const normalized = value => String(value || '').trim().toLowerCase()

export function isFrontDeskPresent(student) {
  return normalized(student.attendanceStatus) === 'present'
    || (!student.attendanceStatus && Boolean(student.checkInTime))
}

export function frontDeskCheckInReason(session, student, now = Date.now()) {
  if (!session) return 'Chọn buổi học để điểm danh.'
  if (isFrontDeskPresent(student)) return 'Học viên đã được điểm danh.'
  if (student.attendanceStatus) return 'Học viên đã có kết quả điểm danh.'
  if (normalized(student.registrationStatus) !== 'registered') return 'Lượt đăng ký không còn hợp lệ để điểm danh.'
  if (normalized(session.status) !== 'scheduled') return 'Chỉ điểm danh buổi học đang được lên lịch.'
  const start = Date.parse(session.startsAt), end = Date.parse(session.endsAt)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return 'Buổi học chưa có thời gian hợp lệ.'
  if (now < start - 30 * 60 * 1000) return 'Chưa đến giờ điểm danh (mở trước giờ học 30 phút).'
  if (now >= end) return 'Buổi học đã kết thúc.'
  return ''
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
