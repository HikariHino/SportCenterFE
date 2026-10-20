import { bookingUnavailableReason } from './memberClasses.js'
import { sessionsOverlap } from './sessionReschedule.js'

const status = value => String(value || '').trim().toLowerCase()
const cancelled = value => ['cancelled', 'canceled'].includes(status(value))
const occupiesSchedule = item => ['registered', 'confirmed', 'booked', 'checkedin', 'attended'].includes(status(item.status))
  && !cancelled(item.sessionStatus) && status(item.sessionStatus) !== 'completed'
const validInterval = item => Number.isFinite(Date.parse(item.startsAt)) && Number.isFinite(Date.parse(item.endsAt))
  && Date.parse(item.startsAt) < Date.parse(item.endsAt)

const searchText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim()

export function filterFrontDeskMembers(members, query) {
  const text = searchText(query)
  if (!text) return members
  const digits = text.replace(/\D/g, '')
  return members.filter(member => text.split(/\s+/).every(word => searchText(member.fullName).includes(word))
    || (digits && /^[\d\s()+.-]+$/.test(text) && String(member.phone || '').replace(/\D/g, '').includes(digits)))
}

export function isExistingSessionRegistration(item, sessionId) {
  return !cancelled(item.status) && String(item.sessionId) === String(sessionId)
}

export function memberBookingReason({ member, subscriptions, registrations }, now = Date.now()) {
  if (!member || member.isActive === false) return 'Học viên đã ngừng hoạt động, không thể đăng ký buổi học.'
  if (!subscriptions.some(item => status(item.status) === 'active'
    && Date.parse(item.startDate) <= now && Date.parse(item.endDate) > now)) {
    return 'Học viên cần có gói tập đang còn hiệu lực để đăng ký buổi học.'
  }
  if (registrations.some(item => occupiesSchedule(item) && !validInterval(item))) {
    return 'Lịch đã đăng ký của học viên thiếu thời gian học. Vui lòng làm mới hoặc cập nhật lịch trước khi đăng ký.'
  }
  return ''
}

export function frontDeskSessionEligibility(session, registrations, now = Date.now()) {
  if (registrations.some(item => isExistingSessionRegistration(item, session.id))) {
    return { code: 'registered', reason: 'Đã đăng ký buổi học này' }
  }
  const unavailable = bookingUnavailableReason(session, false, now)
  if (unavailable) return { code: 'unavailable', reason: unavailable }
  if (status(session.status) !== 'scheduled' || !validInterval(session)) {
    return { code: 'unavailable', reason: 'Buổi học chưa có lịch hợp lệ để đăng ký' }
  }
  const conflict = registrations.find(item => occupiesSchedule(item) && sessionsOverlap(session, item))
  if (conflict) {
    const time = new Date(conflict.startsAt).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short',
    })
    return { code: 'conflict', reason: `Trùng lịch ${conflict.className || 'buổi học đã đăng ký'} lúc ${time}`, conflict }
  }
  return { code: 'available', reason: '' }
}

// Select chronologically, including only sessions that do not overlap with
// the member's existing timetable or another session selected in this batch.
export function selectableFrontDeskSessions(sessions, registrations, now = Date.now()) {
  const chosen = [], planned = [...registrations]
  for (const session of [...sessions].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))) {
    if (frontDeskSessionEligibility(session, planned, now).reason) continue
    chosen.push(session)
    planned.push({ ...session, sessionId: session.id, status: 'Registered', sessionStatus: 'Scheduled' })
  }
  return chosen
}
