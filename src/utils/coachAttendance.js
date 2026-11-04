const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
})

export function getCoachAttendanceAvailability(session, now = Date.now()) {
  const closed = message => ({ open: false, message })
  if (!session) return closed('Chưa chọn buổi huấn luyện')
  const status = String(session.rawStatus || session.status || '').trim().toLowerCase()
  if (['cancelled', 'canceled'].includes(status)) return closed('Buổi học đã bị hủy')
  if (status === 'completed') return closed('Buổi học đã hoàn thành, không thể điểm danh')
  if (status !== 'scheduled') return closed('Chỉ điểm danh buổi học đang được lên lịch')
  const start = Date.parse(session.startsAt), end = Date.parse(session.endsAt)
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(now) || start >= end) {
    return closed('Chưa có thời gian buổi học hợp lệ để điểm danh')
  }
  if (dateFormatter.format(start) !== dateFormatter.format(now)) return closed('Chỉ điểm danh trong ngày diễn ra buổi học (giờ Việt Nam)')
  if (now < start - 30 * 60_000) return closed('Chưa đến giờ điểm danh. Chỉ mở từ 30 phút trước giờ bắt đầu')
  if (now >= end) return closed('Buổi học đã kết thúc, không thể điểm danh')
  return { open: true, message: 'Có thể ghi nhận hoặc cập nhật điểm danh từ 30 phút trước giờ bắt đầu đến trước khi buổi học kết thúc' }
}
