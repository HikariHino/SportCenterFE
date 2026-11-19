import { sessionsOverlap } from './sessionReschedule.js'
import { timetableDateKey } from './memberTimetable.js'

const normalized = value => String(value || '').toLowerCase().replace(/[\s_-]/g, '')
const cancelled = value => ['cancelled', 'canceled'].includes(normalized(value))

export const isCancelledRegistration = item => cancelled(item.status) || cancelled(item.sessionStatus)

export function partitionMemberRegistrations(items) {
  const active = [], cancelledItems = []
  for (const item of items) {
    if (isCancelledRegistration(item)) cancelledItems.push(item)
    else active.push(item)
  }
  const timestamp = item => {
    const value = Date.parse(item.startsAt)
    return Number.isFinite(value) ? value : 0
  }
  cancelledItems.sort((left, right) => timestamp(right) - timestamp(left))
  return { active, cancelled: cancelledItems }
}

export function classStatusLabel(value) {
  return {
    scheduled: 'Đã lên lịch', open: 'Đang mở', registered: 'Đã đăng ký',
    confirmed: 'Đã xác nhận', pending: 'Chờ xác nhận', cancelled: 'Đã hủy',
    canceled: 'Đã hủy', completed: 'Hoàn thành', attended: 'Đã tham gia',
    checkedin: 'Đã điểm danh', present: 'Có mặt', late: 'Đi trễ',
    absent: 'Vắng mặt', noshow: 'Vắng mặt', excused: 'Vắng có phép', inprogress: 'Đang diễn ra',
  }[normalized(value)] || value || 'Chưa cập nhật'
}

export function registrationAttendance(item) {
  if (cancelled(item.status) || cancelled(item.sessionStatus)) return null
  const states = {
    present: { code: 'present', label: 'Có mặt', tone: 'success' },
    attended: { code: 'present', label: 'Có mặt', tone: 'success' },
    late: { code: 'late', label: 'Đi trễ', tone: 'warning' },
    absent: { code: 'absent', label: 'Vắng mặt', tone: 'danger' },
    noshow: { code: 'absent', label: 'Vắng mặt', tone: 'danger' },
    excused: { code: 'excused', label: 'Vắng có phép', tone: 'warning' },
    checkedin: { code: 'checkedin', label: 'Đã điểm danh', tone: 'success' },
  }
  const recorded = normalized(item.attendanceStatus)
  if (states[recorded]) return states[recorded]
  if (!recorded && states[normalized(item.status)]) return states[normalized(item.status)]
  // A timestamp confirms check-in, but must not override an explicit attendance
  // status: a coach can change a previous check-in to Absent or Excused.
  if (!recorded && [item.checkInTime, item.checkedInAt].some(value => Number.isFinite(Date.parse(value)))) return states.checkedin
  if (!recorded && ['attendanceStatus', 'checkInTime', 'checkedInAt'].some(field => Object.hasOwn(item, field) && (item[field] === null || item[field] === ''))) {
    return { code: 'pending', label: 'Chưa điểm danh', tone: 'neutral' }
  }
  // Missing data is not evidence of absence or participation, even after completion.
  return { code: 'unknown', label: 'Chưa cập nhật điểm danh', tone: 'neutral' }
}

export function cancellationDeadline(item) {
  if (item.cancellationDeadline) return Number.isFinite(Date.parse(item.cancellationDeadline)) ? item.cancellationDeadline : null
  const hours = item.cancellationPolicy?.minimumHoursBeforeStart ?? item.minimumHoursBeforeStart
  const start = Date.parse(item.startsAt)
  if (hours == null || !Number.isFinite(Number(hours)) || Number(hours) < 0 || !Number.isFinite(start)) return null
  const deadline = new Date(start - Number(hours) * 3600000)
  return Number.isFinite(deadline.getTime()) ? deadline.toISOString() : null
}

export function cancellationUnavailableReason(item, now = Date.now()) {
  if (cancelled(item.status) || cancelled(item.sessionStatus)) return 'Buổi học hoặc đăng ký đã bị hủy.'
  if (normalized(item.status) !== 'registered' || normalized(item.sessionStatus) !== 'scheduled') return 'Chỉ hủy đăng ký của buổi học đang được lên lịch.'
  if (item.attendanceStatus || item.checkInTime || item.checkedInAt) return 'Buổi học đã có kết quả điểm danh, không thể hủy đăng ký.'
  const deadline = Date.parse(cancellationDeadline(item))
  if (!Number.isFinite(deadline) || !Number.isFinite(now)) return 'Chưa xác định được hạn hủy. Vui lòng làm mới lịch học.'
  if (now > deadline) return 'Đã quá hạn hủy theo chính sách của buổi học.'
  return item.canCancel === false ? 'Buổi học hiện không cho phép hủy đăng ký. Vui lòng làm mới lịch học.' : ''
}

export function checkInUnavailableReason(item, now = Date.now()) {
  const start = Date.parse(item.startsAt), end = Date.parse(item.endsAt)
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(now) || end <= start) return 'Chưa xác định được thời gian điểm danh. Vui lòng làm mới lịch học.'
  if (timetableDateKey(start) !== timetableDateKey(now)) return 'Chỉ điểm danh trong ngày diễn ra buổi học (giờ Việt Nam).'
  const opensAt = start - 30 * 60000
  if (now < opensAt) {
    const label = new Date(opensAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' })
    return `Chưa đến giờ điểm danh. Chỉ được điểm danh từ 30 phút trước giờ học đến trước khi buổi học kết thúc. Bạn có thể điểm danh từ ${label} (giờ Việt Nam).`
  }
  return now >= end ? 'Buổi học đã kết thúc, không thể điểm danh.' : ''
}

export function reviewUnavailableReason(item, now = Date.now()) {
  if (item.hasReviewed || item.review || item.reviewedAt || item.rating) return 'Bạn đã đánh giá buổi học này.'
  if (cancelled(item.status) || cancelled(item.sessionStatus)) return 'Không thể đánh giá buổi học đã hủy.'
  const attendance = normalized(item.attendanceStatus)
  if (!['present', 'late'].includes(attendance)) {
    if (['absent', 'excused', 'noshow'].includes(attendance) || ['absent', 'excused', 'noshow'].includes(normalized(item.status))) {
      return 'Bạn không tham gia buổi học này nên không thể đánh giá.'
    }
    return 'Chưa có điểm danh Có mặt hoặc Đi trễ. Bạn chưa thể đánh giá buổi học này.'
  }
  const end = Date.parse(item.endsAt)
  if (!Number.isSafeInteger(Number(item.sessionId)) || Number(item.sessionId) <= 0
    || normalized(item.status) !== 'completed' || normalized(item.sessionStatus) !== 'completed'
    || !Number.isFinite(end) || end > now) return 'Chỉ đánh giá khi buổi học và đăng ký đã hoàn thành, sau giờ kết thúc.'
  return item.canReview === false ? 'Buổi học này hiện không cho phép đánh giá.' : ''
}

export function registrationActions(item, now = Date.now()) {
  const status = normalized(item.status)
  const isCancelled = cancelled(item.status) || cancelled(item.sessionStatus)
  const ended = Date.parse(item.endsAt) <= now || normalized(item.sessionStatus) === 'completed' || status === 'completed'
  const checkedIn = Boolean(item.checkInTime || item.checkedInAt) || ['attended', 'checkedin'].includes(status)
    || ['present', 'late', 'checkedin', 'attended'].includes(normalized(item.attendanceStatus))
  const reviewed = Boolean(item.hasReviewed || item.review || item.reviewedAt || item.rating)
  const active = ['registered', 'confirmed', 'booked'].includes(status)
  const cancelReason = cancellationUnavailableReason(item, now)
  const checkInEligible = !isCancelled && active && !checkedIn && !ended && item.canCheckIn !== false
  const checkInReason = checkInEligible ? checkInUnavailableReason(item, now) : ''
  const reviewReason = reviewUnavailableReason(item, now)
  return {
    checkedIn, reviewed, ended,
    cancel: !cancelReason,
    cancelReason: !isCancelled && !ended && active ? cancelReason : '',
    checkIn: checkInEligible && !checkInReason,
    checkInReason,
    review: !reviewReason,
    reviewReason: ended && !reviewed && !isCancelled ? reviewReason : '',
  }
}

export function bookingUnavailableReason(session, registered = false, now = Date.now(), registrations = []) {
  if (cancelled(session.status)) return 'Buổi học đã hủy'
  if (normalized(session.status) === 'completed' || !Number.isFinite(Date.parse(session.startsAt)) || Date.parse(session.startsAt) <= now) return 'Đã đóng đăng ký'
  if (normalized(session.status) !== 'scheduled') return 'Buổi học không còn nhận đăng ký'
  if (registered || session.isRegistered) return 'Đã đăng ký'
  const count = session.currentEnrollment ?? session.enrolledCount ?? session.registeredCount
  if (Number(session.availableSlots ?? session.availableSeats ?? NaN) === 0 || (session.capacity != null && count != null && Number(count) >= Number(session.capacity))) return 'Đã hết chỗ'
  if (session.canRegister === false) return 'Chưa thể đăng ký'
  const conflict = registrations.some(item => !cancelled(item.status) && !cancelled(item.sessionStatus)
    && normalized(item.status) !== 'completed' && normalized(item.sessionStatus) !== 'completed'
    && String(item.sessionId) !== String(session.id) && sessionsOverlap(session, item))
  if (conflict) return 'Trùng lịch với buổi học đã đăng ký hoặc đang chọn'
  return ''
}

// Keep the input order so an explicit selection takes priority over later choices.
export function selectableMemberSessions(sessions, registrations, now = Date.now()) {
  const selected = [], planned = [...registrations]
  const registered = registeredSessionIds(registrations)
  for (const session of sessions) {
    if (bookingUnavailableReason(session, registered.has(String(session.id)), now, planned)) continue
    selected.push(session)
    planned.push({ ...session, sessionId: session.id, status: 'Registered', sessionStatus: 'Scheduled' })
  }
  return selected
}

export function registeredSessionIds(registrations) {
  return new Set(registrations.filter(item => !cancelled(item.status)).map(item => String(item.sessionId)).filter(id => id !== 'undefined' && id !== 'null'))
}

export function hasActiveMembership(subscriptions, now = Date.now()) {
  return subscriptions.some(item => normalized(item.status) === 'active'
    && Date.parse(item.startDate) <= now
    && Date.parse(item.endDate) > now)
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
