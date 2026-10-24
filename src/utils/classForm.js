import { timetableDateKey } from './memberTimetable.js'

const validDateKey = value => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value

export function classDateInput(value) {
  if (!value) return ''
  const key = timetableDateKey(value)
  return validDateKey(key) && Number(key.slice(0, 4)) >= 2000 ? key : ''
}

function classDate(value, endOfDay = false) {
  const text = String(value || '').trim()
  const key = text.slice(0, 10)
  if (!validDateKey(key)) throw new Error('Vui lòng nhập ngày bắt đầu và ngày kết thúc hợp lệ.')
  if (Number(key.slice(0, 4)) < 2000) throw new Error('Ngày của khóa học phải từ năm 2000 trở đi.')
  if (text.length === 10) return `${key}T${endOfDay ? '23:59:59.999' : '00:00:00'}+07:00`
  if (!/^\d{4}-\d{2}-\d{2}T/.test(text) || !Number.isFinite(Date.parse(text)) || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(text)) throw new Error('Thời gian khóa học không hợp lệ.')
  return text
}

export function buildClassPayload(data, now = Date.now()) {
  const className = String(data.className || '').trim()
  if (!className || className.length > 200) throw new Error('Tên lớp học phải có từ 1 đến 200 ký tự.')
  const sportId = Number(data.sportId)
  const coachId = Number(data.coachId)
  const maxCapacity = Number(data.maxCapacity)
  if (!Number.isInteger(sportId) || sportId < 1) throw new Error('Vui lòng chọn môn thể thao.')
  if (!Number.isInteger(coachId) || coachId < 1) throw new Error('Vui lòng chọn huấn luyện viên phụ trách.')
  if (!Number.isInteger(maxCapacity) || maxCapacity < 1 || maxCapacity > 10000) throw new Error('Sĩ số tối đa phải là số nguyên từ 1 đến 10.000.')

  const startDate = classDate(data.startDate)
  const endDate = classDate(data.endDate, true)
  if (Date.parse(startDate) >= Date.parse(endDate)) throw new Error('Ngày kết thúc phải sau ngày bắt đầu khóa học.')
  if (Date.parse(endDate) <= now) throw new Error('Ngày kết thúc khóa học phải sau thời điểm hiện tại.')

  const payload = { className, sportId, coachId, maxCapacity, startDate, endDate, schedule: data.schedule ? data.schedule.trim() : null, isActive: data.isActive !== false }
  if (data.roomId) payload.roomId = Number(data.roomId)
  if (data.roomName) payload.roomName = data.roomName
  return payload
}
