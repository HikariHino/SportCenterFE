import { getCoachClassDetails, getCoachClasses, getMyCoachSessions } from './coachService'
import { getRooms } from './roomService'
import { getProfile } from './profileService'
import { shiftTimetableDate, timetableWeekStart } from '../utils/memberTimetable'

export const coachSessionsKey = ({ from, to, page = 1, pageSize = 100 } = {}) =>
  'sessions:' + JSON.stringify([from || null, to || null, Number(page), Number(pageSize)])
export const coachRosterKey = id => 'roster:' + String(id)
export const coachAttendancesKey = id => 'attendances:' + String(id)

export function coachOverviewRange(now = new Date()) {
  const from = new Date(now)
  from.setHours(0, 0, 0, 0)
  const to = new Date(from)
  to.setDate(to.getDate() + 8)
  return { from: from.toISOString(), to: to.toISOString(), pageSize: 100 }
}

export function coachWeekRange(weekStart = timetableWeekStart(Date.now())) {
  return { from: new Date(weekStart + 'T00:00:00+07:00').toISOString(), to: new Date(shiftTimetableDate(weekStart, 7) + 'T00:00:00+07:00').toISOString(), pageSize: 100 }
}

// Safe reads only. No attendance writes, AI generation or plan creation.
export async function loadCoachStudentCatalog(cache) {
  const [sessionResult, classResult] = await Promise.allSettled([
    cache.load(coachSessionsKey(), () => getMyCoachSessions({ pageSize: 100 })),
    cache.load('classes', () => getCoachClasses({ page: 1, pageSize: 100 })),
  ])
  if (sessionResult.status === 'rejected') throw sessionResult.reason
  const sessions = sessionResult.value.items
  const listedClasses = classResult.status === 'fulfilled' ? classResult.value.items : []
  const listedIds = new Set(listedClasses.map(item => String(item.id)))
  const missingIds = [...new Set(sessions.map(item => String(item.classId || '')).filter(id => id && !listedIds.has(id)))]
  const missing = await Promise.allSettled(missingIds.map(id => cache.load('class:' + id, () => getCoachClassDetails(id))))
  return { sessions, classCatalog: [...listedClasses, ...missing.filter(item => item.status === 'fulfilled').map(item => item.value)] }
}

export function coachReadTasks(cache) {
  const week = coachWeekRange()
  return [
    [coachSessionsKey(week), () => getMyCoachSessions(week)],
    [coachSessionsKey(), () => getMyCoachSessions({ pageSize: 100 })],
    ['classes', () => getCoachClasses({ page: 1, pageSize: 100 })],
    ['rooms:active', () => getRooms(true)], ['profile', getProfile],
    ['student-catalog', () => loadCoachStudentCatalog(cache)],
  ]
}
