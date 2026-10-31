const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
})
const normalized = value => String(value || '').trim().toLowerCase()

export function receptionistCheckInReason(registration, now = Date.now()) {
  if (!registration?.sessionId) return 'Lượt đăng ký chưa được gắn buổi học.'
  if (registration.attendanceStatus || registration.checkInTime) return 'Hội viên đã có kết quả điểm danh cho buổi học này.'
  if (normalized(registration.status) !== 'registered') return 'Lượt đăng ký không còn hợp lệ để điểm danh.'
  if (normalized(registration.sessionStatus) !== 'scheduled') return 'Chỉ điểm danh buổi học đang được lên lịch.'
  const start = Date.parse(registration.startsAt), end = Date.parse(registration.endsAt)
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(now) || start >= end) {
    return 'Chưa có thời gian buổi học hợp lệ để điểm danh.'
  }
  if (dateFormatter.format(start) !== dateFormatter.format(now)) return 'Chỉ điểm danh trong ngày diễn ra buổi học (giờ Việt Nam).'
  if (now < start - 30 * 60_000) return 'Chưa đến giờ điểm danh. Chỉ mở từ 30 phút trước giờ bắt đầu.'
  if (now >= end) return 'Buổi học đã kết thúc, không thể điểm danh.'
  return ''
}
