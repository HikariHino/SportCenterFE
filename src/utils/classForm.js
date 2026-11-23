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

export function classFormValidationErrors(data, now = Date.now(), { allowPastStart = true } = {}) {
  const errors = {}
  if (typeof data.className !== 'string' || !data.className.trim()) errors.className = 'Vui lòng nhập tên lớp học, không chỉ gồm khoảng trắng.'
  else if (data.className.trim().length > 200) errors.className = 'Tên lớp học phải có từ 1 đến 200 ký tự.'
  const positiveInteger = value => ['string', 'number'].includes(typeof value) && String(value).trim() !== '' && Number.isSafeInteger(Number(value)) && Number(value) > 0
  if (!positiveInteger(data.sportId)) errors.sportId = 'Vui lòng chọn môn thể thao.'
  if (!positiveInteger(data.coachId)) errors.coachId = 'Vui lòng chọn huấn luyện viên phụ trách.'
  if (!positiveInteger(data.maxCapacity) || Number(data.maxCapacity) > 10000) errors.maxCapacity = 'Sĩ số tối đa phải là số nguyên từ 1 đến 10.000.'
  let start, end
  for (const field of ['startDate', 'endDate']) {
    if (!data[field] || !String(data[field]).trim()) errors[field] = field === 'startDate' ? 'Vui lòng nhập ngày bắt đầu khóa.' : 'Vui lòng nhập ngày kết thúc khóa.'
    else {
      try { if (field === 'startDate') start = classDate(data[field]); else end = classDate(data[field], true) }
      catch (error) { errors[field] = error.message }
    }
  }
  if (start && !allowPastStart && timetableDateKey(start) < timetableDateKey(now)) errors.startDate = 'Ngày bắt đầu khóa không được trước hôm nay (giờ Việt Nam).'
  if (start && end && Date.parse(start) >= Date.parse(end)) errors.endDate = 'Ngày kết thúc phải sau ngày bắt đầu khóa học.'
  else if (end && Date.parse(end) <= now) errors.endDate = 'Ngày kết thúc khóa học phải sau thời điểm hiện tại.'
  return errors
}

export function buildClassPayload(data, now = Date.now(), options = {}) {
  const fieldErrors = classFormValidationErrors(data, now, options)
  if (Object.keys(fieldErrors).length) throw Object.assign(new Error(Object.values(fieldErrors)[0]), { fieldErrors })
  const className = data.className.trim()
  const sportId = Number(data.sportId), coachId = Number(data.coachId), maxCapacity = Number(data.maxCapacity)

  const startDate = classDate(data.startDate)
  const endDate = classDate(data.endDate, true)
  if (Date.parse(startDate) >= Date.parse(endDate)) throw new Error('Ngày kết thúc phải sau ngày bắt đầu khóa học.')
  if (Date.parse(endDate) <= now) throw new Error('Ngày kết thúc khóa học phải sau thời điểm hiện tại.')

  const payload = { className, sportId, coachId, maxCapacity, startDate, endDate, schedule: data.schedule ? data.schedule.trim() : null, isActive: data.isActive !== false }
  if (data.roomId) payload.roomId = Number(data.roomId)
  if (data.roomName) payload.roomName = data.roomName
  return payload
}
