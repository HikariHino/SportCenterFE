/** Staff attendance follows the BE window, including sessions crossing midnight. */
export function getStaffAttendanceAvailability(session, now = Date.now()) {
  const closed = message => ({ open: false, message })
  if (!session) return closed('Chưa chọn buổi học để điểm danh')
  const status = String(session.rawStatus || session.status || '').trim().toLowerCase()
  if (['cancelled', 'canceled'].includes(status)) return closed('Buổi học đã bị hủy')
  if (!['scheduled', 'completed'].includes(status)) return closed('Trạng thái buổi học không hợp lệ để điểm danh')
  const start = Date.parse(session.startsAt), end = Date.parse(session.endsAt)
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(now) || start >= end) {
    return closed('Chưa có thời gian buổi học hợp lệ để điểm danh')
  }
  if (now < start - 30 * 60_000) return closed('Chưa đến giờ điểm danh. Chỉ mở từ 30 phút trước giờ bắt đầu')
  if (now > end + 12 * 60 * 60_000) return closed('Đã quá thời hạn điểm danh: 12 giờ sau khi buổi học kết thúc')
  return { open: true, message: 'Có thể ghi nhận hoặc cập nhật điểm danh từ 30 phút trước giờ bắt đầu đến 12 giờ sau khi buổi học kết thúc' }
}
