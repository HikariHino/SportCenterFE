const normalized = value => String(value || '').toLowerCase().replace(/[\s_-]/g, '')
const cancelled = value => ['cancelled', 'canceled'].includes(normalized(value))

export function classStatusLabel(value) {
  return {
    scheduled: 'Đã lên lịch', open: 'Đang mở', registered: 'Đã đăng ký',
    confirmed: 'Đã xác nhận', pending: 'Chờ xác nhận', cancelled: 'Đã hủy',
    canceled: 'Đã hủy', completed: 'Hoàn thành', attended: 'Đã tham gia',
    checkedin: 'Đã điểm danh', present: 'Có mặt', late: 'Đi trễ',
    absent: 'Vắng mặt', noshow: 'Vắng mặt', inprogress: 'Đang diễn ra',
  }[normalized(value)] || value || 'Chưa cập nhật'
}

export function cancellationDeadline(item) {
  if (item.cancellationDeadline) return item.cancellationDeadline
  const hours = item.cancellationPolicy?.minimumHoursBeforeStart ?? item.minimumHoursBeforeStart
  const start = Date.parse(item.startsAt)
  if (hours == null || !Number.isFinite(Number(hours)) || !Number.isFinite(start)) return null
  return new Date(start - Number(hours) * 3600000).toISOString()
}

export function registrationActions(item, now = Date.now()) {
  const status = normalized(item.status)
  const isCancelled = cancelled(item.status) || cancelled(item.sessionStatus)
  const ended = Date.parse(item.endsAt) <= now || normalized(item.sessionStatus) === 'completed' || status === 'completed'
  const checkedIn = Boolean(item.checkInTime || item.checkedInAt) || ['attended', 'checkedin'].includes(status)
    || ['present', 'late'].includes(normalized(item.attendanceStatus))
  const reviewed = Boolean(item.hasReviewed || item.review || item.reviewedAt || item.rating)
  const active = ['registered', 'confirmed', 'booked'].includes(status)
  const deadline = cancellationDeadline(item)
  const beforeDeadline = !deadline || !(Date.parse(deadline) <= now)
  const beforeStart = !(Date.parse(item.startsAt) <= now)
  return {
    checkedIn, reviewed, ended,
    cancel: !isCancelled && active && !checkedIn && !ended && beforeStart && beforeDeadline && item.canCancel !== false,
    checkIn: !isCancelled && active && !checkedIn && !ended && item.canCheckIn !== false,
    review: !isCancelled && ended && !reviewed && !['noshow', 'absent'].includes(status)
      && !['absent', 'excused'].includes(normalized(item.attendanceStatus)) && item.canReview !== false,
  }
}

export function bookingUnavailableReason(session, registered = false, now = Date.now()) {
  if (cancelled(session.status)) return 'Buổi học đã hủy'
  if (normalized(session.status) === 'completed' || Date.parse(session.startsAt) <= now) return 'Đã đóng đăng ký'
  if (registered || session.isRegistered) return 'Đã đăng ký'
  const count = session.enrolledCount ?? session.registeredCount
  if (session.availableSlots === 0 || (session.capacity != null && count != null && Number(count) >= Number(session.capacity))) return 'Đã hết chỗ'
  if (session.canRegister === false) return 'Chưa thể đăng ký'
  return ''
}

/**
 * Trích xuất phòng tập từ thông tin lớp học (schedule, roomId, roomName)
 */
export function getRoomForClass(cls, roomsList = []) {
  if (!cls) return null
  if (cls.roomId) {
    const found = roomsList.find((r) => r.id === Number(cls.roomId))
    if (found) return found
  }
  if (cls.roomName) {
    const found = roomsList.find((r) => r.name?.toLowerCase() === cls.roomName?.toLowerCase())
    if (found) return found
  }
  if (cls.schedule) {
    // Kiểm tra định dạng [Phòng: ...] hoặc [...]
    const match = cls.schedule.match(/\[Phòng:\s*([^\]]+)\]/i) || cls.schedule.match(/\[([^\]]+)\]/)
    if (match) {
      const candidate = match[1].trim()
      const found = roomsList.find(
        (r) =>
          r.name?.toLowerCase() === candidate.toLowerCase() ||
          candidate.toLowerCase().includes(r.name?.toLowerCase())
      )
      if (found) return found
      return { id: null, name: candidate }
    }
    // Kiểm tra dạng phân cách bằng ký tự |
    if (cls.schedule.includes('|')) {
      const parts = cls.schedule.split('|').map((p) => p.trim())
      for (const part of parts) {
        const found = roomsList.find(
          (r) =>
            r.name?.toLowerCase() === part.toLowerCase() ||
            part.toLowerCase().includes(r.name?.toLowerCase())
        )
        if (found) return found
      }
    }
    // Kiểm tra trực tiếp tên phòng trong chuỗi schedule
    for (const r of roomsList) {
      if (r.name && cls.schedule.toLowerCase().includes(r.name.toLowerCase())) {
        return r
      }
    }
  }
  return null
}
