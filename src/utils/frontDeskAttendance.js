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
  if (!['scheduled', 'completed'].includes(normalized(session.status))) return 'Không thể điểm danh buổi học đã hủy hoặc chưa có trạng thái hợp lệ.'
  const start = Date.parse(session.startsAt), end = Date.parse(session.endsAt)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return 'Buổi học chưa có thời gian hợp lệ.'
  if (now < start - 30 * 60 * 1000) return 'Chưa đến giờ điểm danh (mở trước giờ học 30 phút).'
  if (now > end + 12 * 60 * 60_000) return 'Đã quá hạn điểm danh (12 giờ sau khi buổi học kết thúc).'
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
