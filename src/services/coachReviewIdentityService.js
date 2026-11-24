import { getProfile } from './profileService'
import { getMyCoachSessions } from './coachService'
import { getCoaches } from './classCatalogService'

const validId = id => Number.isSafeInteger(Number(id)) && Number(id) > 0

// User IDs and coach IDs belong to different tables. Never use a user ID as
// the coach ID, or match coaches by their display names.
export async function getMyReviewCoach() {
  const profile = await getProfile()
  if (validId(profile?.coachId)) return { id: profile.coachId, fullName: profile.fullName }
  const result = await getMyCoachSessions({ page: 1, pageSize: 1 })
  const session = result.items.find(item => validId(item.coachId))
  if (session) return { id: session.coachId, fullName: profile?.fullName || session.coachName }
  const coaches = await getCoaches()
  const matches = coaches.filter(coach => validId(coach.id) && (
    (validId(profile?.userId) && String(coach.userId) === String(profile.userId))
    || (typeof profile?.email === 'string' && profile.email.trim() && typeof coach.email === 'string'
      && coach.email.trim().toLowerCase() === profile.email.trim().toLowerCase())
  ))
  if (matches.length !== 1) throw new Error('Chưa xác định được hồ sơ huấn luyện viên của bạn. Vui lòng thử lại hoặc liên hệ quản lý.')
  return matches[0]
}
