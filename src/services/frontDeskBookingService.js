import api from './api'
import { loadSchedulingPages } from './sessionSchedulingService'
import { registerMemberForSession } from './receptionistClassService'
import { getClassErrorMessage } from './sportClassService'
import { frontDeskSessionEligibility, isExistingSessionRegistration, memberBookingReason } from '../utils/frontDeskBooking.js'

async function read(url, signal) {
  const response = await api.get(url, { signal })
  if (response.data?.success === false) throw new Error(response.data.message || 'Không thể tải thông tin đăng ký.')
  return response.data?.data ?? response.data
}

export const getFrontDeskBookingClasses = signal => loadSchedulingPages('/classes', signal)
export const getFrontDeskBookingSessions = (classId, signal) => loadSchedulingPages(`/classes/${classId}/sessions`, signal)
export const getFrontDeskMemberRegistrations = (memberId, signal) => loadSchedulingPages(`/class-registrations/members/${memberId}`, signal)

export async function getFrontDeskMemberBooking(memberId, signal) {
  const [member, subscriptions, registrations] = await Promise.all([
    read(`/members/${memberId}`, signal), read(`/member-subscriptions/members/${memberId}`, signal),
    getFrontDeskMemberRegistrations(memberId, signal),
  ])
  if (!member || String(member.memberId ?? member.id) !== String(memberId) || !Array.isArray(subscriptions)) {
    throw new Error('Thông tin học viên hoặc gói tập không hợp lệ. Vui lòng tải lại.')
  }
  return { member, subscriptions, registrations }
}

const writes = new Map()
function withMemberBookingLock(memberId, write) {
  const key = String(memberId)
  const next = (writes.get(key) || Promise.resolve()).then(write, write)
  const settled = next.catch(() => {})
  writes.set(key, settled)
  return next.finally(() => { if (writes.get(key) === settled) writes.delete(key) })
}

export function registerFrontDeskClassSessions({ classId, memberId, sessionIds }, onProgress = () => {}) {
  return withMemberBookingLock(memberId, async () => {
    const ids = [...new Set(sessionIds.map(String))]
    if (![classId, memberId, ...ids].every(value => Number.isSafeInteger(Number(value)) && Number(value) > 0) || !ids.length) {
      throw new Error('Vui lòng chọn học viên, lớp học và ít nhất một buổi học hợp lệ.')
    }
    const [context, sportClass, sessions] = await Promise.all([
      getFrontDeskMemberBooking(memberId), read(`/classes/${classId}`), getFrontDeskBookingSessions(classId),
    ])
    const memberReason = memberBookingReason(context)
    if (memberReason) throw new Error(memberReason)
    if (!sportClass || String(sportClass.id) !== String(classId) || sportClass.isActive === false) throw new Error('Lớp học không còn mở đăng ký.')
    const result = { registered: [], existing: [], blocked: [], remaining: [], error: '' }
    const planned = [...context.registrations], pending = []
    // Check the entire selection before creating any registrations.
    for (const id of ids) {
      const session = sessions.find(item => String(item.id) === id && (item.classId == null || String(item.classId) === String(classId)))
      if (!session) { result.blocked.push({ id, reason: 'Buổi học không còn thuộc lớp đã chọn.' }); continue }
      const eligibility = frontDeskSessionEligibility(session, planned)
      if (eligibility.code === 'registered') { result.existing.push(id); continue }
      if (eligibility.reason) { result.blocked.push({ id, reason: eligibility.reason }); continue }
      pending.push(id)
      planned.push({ ...session, sessionId: session.id, status: 'Registered', sessionStatus: 'Scheduled' })
    }
    if (result.blocked.length) {
      result.remaining = pending
      result.error = 'Chưa đăng ký vì có buổi học không còn hợp lệ. Vui lòng kiểm tra lại lịch.'
      return result
    }
    for (let index = 0; index < pending.length; index += 1) {
      const id = pending[index]
      onProgress({ completed: index, total: pending.length })
      try {
        // Re-read both schedules before each write. The server also checks
        // duplicates, capacity and conflicts inside its booking transaction.
        const [fresh, catalog] = await Promise.all([getFrontDeskMemberBooking(memberId), getFrontDeskBookingSessions(classId)])
        const reason = memberBookingReason(fresh)
        if (reason) throw new Error(reason)
        const session = catalog.find(item => String(item.id) === id && (item.classId == null || String(item.classId) === String(classId)))
        if (!session) throw new Error('Buổi học không còn thuộc lớp đã chọn.')
        const eligibility = frontDeskSessionEligibility(session, fresh.registrations)
        if (eligibility.code === 'registered') { result.existing.push(id); continue }
        if (eligibility.reason) throw new Error(eligibility.reason)
        try { await registerMemberForSession(id, memberId) }
        catch (error) {
          // A saved registration whose response was lost must not be posted twice.
          let confirmed = false
          try { confirmed = (await getFrontDeskMemberRegistrations(memberId)).some(item => isExistingSessionRegistration(item, id)) } catch { /* Retry starts with a fresh complete timetable. */ }
          if (!confirmed) throw error
        }
        result.registered.push(id)
      } catch (error) {
        result.error = getClassErrorMessage(error, 'Không thể đăng ký buổi học. Vui lòng thử lại.')
        result.blocked = [{ id, reason: result.error }]
        result.remaining = pending.slice(index)
        return result
      }
    }
    onProgress({ completed: pending.length, total: pending.length })
    return result
  })
}
