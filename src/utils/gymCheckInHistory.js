export const GYM_TIME_ZONE = 'Asia/Ho_Chi_Minh'
export const GYM_CHECK_IN_STATUSES = ['All', 'InGym', 'CheckedOut', 'ForgotCheckOut']

export function gymTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return NaN
  // BE DateTime values without an offset still represent UTC.
  return Date.parse(/^\d{4}-\d{2}-\d{2}T[\d:.]+$/.test(value) ? `${value}Z` : value)
}

export function gymDateKey(value = Date.now()) {
  const stamp = typeof value === 'string' ? gymTimestamp(value) : Number(value)
  if (!Number.isFinite(stamp)) return ''
  const date = new Date(stamp + 7 * 60 * 60_000)
  return date.toISOString().slice(0, 10)
}

export function shiftGymDate(date, days) {
  const stamp = Date.parse(`${date}T00:00:00Z`)
  return Number.isFinite(stamp) ? new Date(stamp + days * 86400_000).toISOString().slice(0, 10) : ''
}

export function gymDateRangeReason({ fromDate = '', toDate = '' } = {}) {
  for (const value of [fromDate, toDate]) {
    const stamp = Date.parse(`${value}T00:00:00Z`)
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== value)) {
      return 'Vui lòng chọn ngày hợp lệ.'
    }
  }
  return fromDate && toDate && fromDate > toDate ? 'Ngày bắt đầu không được sau ngày kết thúc.' : ''
}

export function formatGymDate(value, dateOnly = false) {
  const stamp = gymTimestamp(value)
  return Number.isFinite(stamp) ? new Date(stamp).toLocaleString('vi-VN', { timeZone: GYM_TIME_ZONE,
    dateStyle: 'short', ...(dateOnly ? {} : { timeStyle: 'short' }) }) : '—'
}

export function gymHistoryParams(filters = {}) {
  const reason = gymDateRangeReason(filters)
  if (reason) throw new Error(reason)
  const params = {}
  // BE rounds filters to whole UTC days. Fetch covering UTC dates, then trim
  // the result to exact Vietnam calendar dates below (including 00:00–06:59).
  if (filters.fromDate) params.fromDate = shiftGymDate(filters.fromDate, -1)
  if (filters.toDate) params.toDate = filters.toDate
  if (filters.memberId != null && filters.memberId !== '') {
    if (!Number.isSafeInteger(Number(filters.memberId)) || Number(filters.memberId) <= 0) throw new Error('Mã hội viên phải là số nguyên lớn hơn 0.')
    params.memberId = Number(filters.memberId)
  }
  if (filters.search?.trim()) params.search = filters.search.trim()
  if (filters.status) {
    if (!GYM_CHECK_IN_STATUSES.includes(filters.status)) throw new Error('Trạng thái check-in không hợp lệ.')
    if (filters.status !== 'All') params.status = filters.status
  }
  return params
}

export function filterGymHistoryDates(items, { fromDate = '', toDate = '' } = {}) {
  return items.filter(item => {
    const date = gymDateKey(item.checkInTime)
    return date && (!fromDate || date >= fromDate) && (!toDate || date <= toDate)
  }).sort((a, b) => gymTimestamp(b.checkInTime) - gymTimestamp(a.checkInTime))
}

export function gymCheckInStatus(item, now = Date.now()) {
  const status = GYM_CHECK_IN_STATUSES.slice(1).find(value => value.toLowerCase() === String(item.status || '').toLowerCase())
  if (status) return status
  if (item.checkOutTime) return 'CheckedOut'
  const stamp = gymTimestamp(item.checkInTime)
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === new Date(now).toISOString().slice(0, 10) ? 'InGym' : 'ForgotCheckOut'
}

export const gymCheckInStatusLabel = item => ({ InGym: 'Đang tập', CheckedOut: 'Đã ra về', ForgotCheckOut: 'Quên check-out' }[gymCheckInStatus(item)])

export function gymDurationMinutes(item) {
  if (item.durationMinutes != null && Number.isFinite(Number(item.durationMinutes)) && Number(item.durationMinutes) >= 0) return Number(item.durationMinutes)
  if (!item.checkOutTime) return null
  const minutes = (gymTimestamp(item.checkOutTime) - gymTimestamp(item.checkInTime)) / 60_000
  return Number.isFinite(minutes) && minutes >= 0 ? Math.round(minutes) : null
}

export function gymDurationLabel(minutes) {
  if (minutes == null || !Number.isFinite(Number(minutes))) return '—'
  const value = Math.max(0, Math.round(Number(minutes)))
  return value < 60 ? `${value} phút` : `${Math.floor(value / 60)} giờ${value % 60 ? ` ${value % 60} phút` : ''}`
}

export function summarizeGymHistory(items) {
  const groups = new Map()
  for (const item of [...items].sort((a, b) => gymTimestamp(b.checkInTime) - gymTimestamp(a.checkInTime))) {
    const id = String(item.memberId)
    if (!groups.has(id)) groups.set(id, { memberId: item.memberId, memberCode: item.memberCode, memberName: item.memberName,
      phoneNumber: item.phoneNumber, currentPackageName: item.packageName, totalCheckIns: 0, totalDurationMinutes: 0,
      lastCheckInTime: item.checkInTime, isCurrentlyInGym: false })
    const group = groups.get(id)
    group.totalCheckIns += 1
    group.totalDurationMinutes += gymDurationMinutes(item) ?? 0
    group.isCurrentlyInGym ||= gymCheckInStatus(item) === 'InGym'
  }
  return [...groups.values()]
}
