export function sessionEnrollmentCount(session) {
  const values = [session?.currentEnrollment, session?.enrolledCount, session?.registeredCount]
    .filter(value => value != null && value !== '')
    .map(value => typeof value === 'number' || (typeof value === 'string' && value.trim()) ? Number(value) : NaN)
  const positive = values.filter(value => Number.isInteger(value) && value > 0)
  if (positive.length) return Math.max(...positive)
  return values.length && values.every(value => Number.isInteger(value) && value >= 0) ? Math.max(...values) : null
}

export function sessionTimeLockReason(session) {
  const count = sessionEnrollmentCount(session)
  if (count == null) return 'Chưa xác nhận được số học viên đăng ký. Vui lòng tải lại lịch trước khi đổi ngày giờ.'
  return count > 0 ? 'Buổi học đã có học viên đăng ký nên không thể thay đổi ngày giờ.' : ''
}

export function assertSessionTimeChangeAllowed(current, proposed) {
  if (Date.parse(current.startsAt) === Date.parse(proposed.startsAt) && Date.parse(current.endsAt) === Date.parse(proposed.endsAt)) return
  const reason = sessionTimeLockReason(current)
  if (reason) throw new Error(reason)
}
