import { loadClassTimetables } from './sessionSchedulingService'
import { completeClassSession, getClassErrorMessage } from './sportClassService'
import { isScheduledSession } from '../utils/sessionScheduling'

export const SESSION_COMPLETION_EVENT = 'sportcenter:sessions-completed'

// Read every page before writing, so a partial catalog cannot hide expired sessions.
export async function completeExpiredClassSessions({ signal, onCompleted = () => {} } = {}) {
  const groups = await loadClassTimetables(signal)
  const now = Date.now()
  const expired = new Map()
  for (const { sportClass, items } of groups) {
    for (const session of items) {
      const start = Date.parse(session.startsAt), end = Date.parse(session.endsAt)
      if (Number.isSafeInteger(Number(session.id)) && Number(session.id) > 0
        && isScheduledSession(session) && Number.isFinite(start) && Number.isFinite(end)
        && start < end && end <= now) {
        expired.set(String(session.id), { ...session, classId: sportClass.id })
      }
    }
  }
  const completed = [], failed = []
  try {
    for (const session of expired.values()) {
      signal?.throwIfAborted()
      try {
        await completeClassSession(session.id)
        completed.push({ ...session, status: 'Completed' })
      } catch (error) {
        failed.push({ session, message: getClassErrorMessage(error, 'Không thể lưu trạng thái hoàn thành.') })
      }
    }
    return { completed, failed }
  } finally {
    // Publish confirmed writes even when the view closes during a request.
    if (completed.length) onCompleted(completed)
  }
}
