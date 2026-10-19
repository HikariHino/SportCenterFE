import { shiftTimetableDate, timetableDateKey, timetableTime } from './memberTimetable.js'
import { getClassDateRange } from './recurringSessions.js'
import { sessionTimeLockReason } from './sessionEnrollment.js'

export function canRescheduleSession(session, now = Date.now()) {
  return String(session?.status || session?.Status || 'Scheduled').toLowerCase() === 'scheduled'
    && Date.parse(session?.startsAt) > now && Date.parse(session?.endsAt) > Date.parse(session?.startsAt)
    && !sessionTimeLockReason(session)
}

export function sessionRescheduleDraft(session, target = {}) {
  return {
    date: target.date || timetableDateKey(session.startsAt),
    startTime: target.startTime || timetableTime(session.startsAt),
    endTime: target.endTime || timetableTime(session.endsAt),
    endsNextDay: target.nextDay ?? (timetableDateKey(session.endsAt) > timetableDateKey(session.startsAt)),
  }
}

export function buildSessionReschedule(session, draft, { sportClass, now = Date.now() } = {}) {
  const lockReason = sessionTimeLockReason(session)
  if (lockReason) throw new Error(lockReason)
  if (!canRescheduleSession(session, now)) throw new Error('Chỉ có thể đổi lịch buổi học chưa bắt đầu và chưa bị hủy hoặc hoàn thành.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || !Number.isFinite(Date.parse(`${draft.date}T00:00:00Z`))
    || new Date(`${draft.date}T00:00:00Z`).toISOString().slice(0, 10) !== draft.date) throw new Error('Vui lòng chọn ngày học hợp lệ.')
  const validTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')
  if (!validTime(draft.startTime) || !validTime(draft.endTime)) throw new Error('Vui lòng nhập giờ bắt đầu và giờ kết thúc hợp lệ.')
  const startsAt = new Date(`${draft.date}T${draft.startTime}:00+07:00`).toISOString()
  const endDate = draft.endsNextDay ? shiftTimetableDate(draft.date, 1) : draft.date
  const endsAt = new Date(`${endDate}T${draft.endTime}:00+07:00`).toISOString()
  if (Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error('Giờ kết thúc phải sau giờ bắt đầu. Chọn kết thúc vào ngày hôm sau nếu học qua đêm.')
  if (Date.parse(startsAt) <= now) throw new Error('Thời gian mới phải sau thời điểm hiện tại.')
  const course = sportClass || { startDate: session.classStartDate, endDate: session.classEndDate }
  const range = getClassDateRange(course)
  if (!range.start || !range.end) throw new Error('Lớp chưa có thời gian hợp lệ. Vui lòng cập nhật ngày bắt đầu và kết thúc của lớp.')
  const bound = (value, end = false) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? Date.parse(`${value}T${end ? '23:59:59.999' : '00:00:00'}+07:00`) : Date.parse(value)
  if (Date.parse(startsAt) < bound(course.startDate) || Date.parse(endsAt) > bound(course.endDate, true)) {
    throw new Error(`Buổi học phải nằm trong thời gian của lớp: ${range.start.split('-').reverse().join('/')} – ${range.end.split('-').reverse().join('/')}.`)
  }
  const coachId = Number(session.coachId ?? course.coachId)
  const cancellationPolicyId = Number(session.cancellationPolicyId)
  const capacity = Number(session.capacity)
  if (![coachId, cancellationPolicyId, capacity].every(value => Number.isInteger(value) && value > 0)) {
    throw new Error('Thiếu thông tin huấn luyện viên, chính sách hủy hoặc sức chứa. Vui lòng tải lại lịch.')
  }
  return { startsAt, endsAt, coachId, cancellationPolicyId, capacity }
}

export function sessionsOverlap(first, second) {
  return Date.parse(first.startsAt) < Date.parse(second.endsAt) && Date.parse(second.startsAt) < Date.parse(first.endsAt)
}
