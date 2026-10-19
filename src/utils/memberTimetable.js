const centerTimeZone = 'Asia/Ho_Chi_Minh'
const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: centerTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
const timeFormatter = new Intl.DateTimeFormat('vi-VN', { timeZone: centerTimeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const dayNames = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật']

export function timetableDateKey(value = Date.now()) {
  if (value == null || value === '') return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const parts = Object.fromEntries(dateFormatter.formatToParts(date).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function shiftTimetableDate(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function timetableWeekStart(value = Date.now()) {
  const key = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? value : timetableDateKey(value)
  const day = new Date(`${key}T00:00:00Z`).getUTCDay()
  return shiftTimetableDate(key, -((day + 6) % 7))
}

export function timetableTime(value) {
  if (value == null || value === '') return 'Chưa cập nhật'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? timeFormatter.format(date) : 'Chưa cập nhật'
}

export function buildWeeklyTimetable(registrations, weekStart) {
  const days = dayNames.map((label, index) => {
    const key = shiftTimetableDate(weekStart, index)
    return { key, label, dateLabel: `${key.slice(8, 10)}/${key.slice(5, 7)}` }
  })
  const rows = new Map()
  let count = 0
  for (const item of registrations) {
    const dayIndex = days.findIndex(day => day.key === timetableDateKey(item.startsAt))
    if (dayIndex < 0) continue
    const start = timetableTime(item.startsAt)
    const end = timetableTime(item.endsAt)
    const endDay = timetableDateKey(item.endsAt)
    const nextDay = Boolean(endDay && endDay > days[dayIndex].key)
    const key = `${start}-${end}-${nextDay}`
    if (!rows.has(key)) rows.set(key, { key, start, end, nextDay, cells: days.map(() => []) })
    rows.get(key).cells[dayIndex].push(item)
    count += 1
  }
  return { days, rows: [...rows.values()].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end)), count }
}
