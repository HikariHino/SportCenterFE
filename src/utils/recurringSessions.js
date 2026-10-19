import { shiftTimetableDate, timetableDateKey } from './memberTimetable.js'

export function parseRecurringWeekdays(value) {
  const text = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/chu\s*nhat/g, 'cn').replace(/thu\s*/g, '').replace(/t(?=[2-7])/g, '')
  if (!text.trim() || text.replace(/cn|[2-7]|[\s,;/]/g, '')) {
    throw new Error('Nhập các thứ từ 2 đến 7 hoặc CN, ví dụ: 246, 357 hoặc 2, 4, 6.')
  }
  const days = [...new Set((text.match(/cn|[2-7]/g) || []).map(day => day === 'cn' ? 6 : Number(day) - 2))].sort((a, b) => a - b)
  if (!days.length) throw new Error('Vui lòng chọn ít nhất một ngày trong tuần.')
  return days
}

export function formatRecurringWeekdays(days) {
  return days.map(day => day === 6 ? 'CN' : String(day + 2)).join(', ')
}

export function getClassDateRange(sportClass) {
  const dateKey = value => {
    if (!value) return ''
    const date = new Date(value)
    const rawKey = String(value).slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawKey) || !Number.isFinite(date.getTime())
      || Number(rawKey.slice(0, 4)) < 2000 || new Date(`${rawKey}T00:00:00Z`).toISOString().slice(0, 10) !== rawKey) return ''
    return timetableDateKey(value)
  }
  return { start: dateKey(sportClass?.startDate), end: dateKey(sportClass?.endDate) }
}

export function buildRecurringSessions({ weekdays, startTime, endTime }, { sportClass, now = Date.now() } = {}) {
  const { start: classStart, end: classEnd } = getClassDateRange(sportClass)
  if (!classStart || !classEnd) throw new Error('Lớp chưa có ngày bắt đầu và kết thúc hợp lệ. Vui lòng cập nhật thời gian của lớp trước khi xếp lịch.')
  const timestamp = (value, endOfDay = false) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? Date.parse(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}+07:00`) : Date.parse(value)
  const firstInstant = timestamp(sportClass.startDate)
  const lastInstant = timestamp(sportClass.endDate, true)
  if (firstInstant >= lastInstant || classStart > classEnd) throw new Error('Ngày kết thúc của lớp phải sau ngày bắt đầu. Vui lòng cập nhật thông tin lớp.')
  const validTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')
  if (!validTime(startTime) || !validTime(endTime)) throw new Error('Vui lòng nhập giờ bắt đầu và kết thúc hợp lệ.')
  if (endTime <= startTime) throw new Error('Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày.')
  const days = parseRecurringWeekdays(weekdays)
  const items = []
  let skippedPast = 0
  let skippedOutsideRange = 0
  for (let date = classStart; date <= classEnd; date = shiftTimetableDate(date, 1)) {
    const day = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
    if (!days.includes(day)) continue
    const startsAt = new Date(`${date}T${startTime}:00+07:00`).toISOString()
    const endsAt = new Date(`${date}T${endTime}:00+07:00`).toISOString()
    if (Date.parse(startsAt) < firstInstant || Date.parse(endsAt) > lastInstant) {
      skippedOutsideRange += 1
      continue
    }
    if (Date.parse(startsAt) <= now) { skippedPast += 1; continue }
    items.push({ date, weekday: day, startsAt, endsAt })
  }
  return { items, skippedPast, skippedOutsideRange }
}
