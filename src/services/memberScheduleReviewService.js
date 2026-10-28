import { getAllUnreadNotifications, markNotificationRead } from './notificationService'
import { getAllMyRegistrations } from './memberClassService'
import { isSessionUpdateNotification, pendingSessionReviews } from '../utils/sessionNotifications.js'

export async function getPendingSessionReviews() {
  const notifications = (await getAllUnreadNotifications()).filter(isSessionUpdateNotification)
  if (!notifications.length) return []
  const { items } = await getAllMyRegistrations()
  const pending = pendingSessionReviews(notifications, items)
  for (const { registration } of pending) {
    if (registration && (!Number.isFinite(Date.parse(registration.startsAt))
      || !Number.isFinite(Date.parse(registration.endsAt)) || Date.parse(registration.endsAt) <= Date.parse(registration.startsAt))) {
      throw new Error('Chưa tải đủ ngày giờ của lịch học mới. Vui lòng thử lại trước khi xác nhận.')
    }
  }
  return pending
}

export async function confirmSessionReview(review) {
  // Recheck before acknowledging: a manager may have changed this session again.
  const latest = await getPendingSessionReviews()
  const current = latest.find(item => item.key === review.key)
  if (!current) return { pending: latest, changed: false }
  if (current.version !== review.version) return { pending: latest, changed: true }
  for (const notification of current.notifications) await markNotificationRead(notification.id)
  return { pending: await getPendingSessionReviews(), changed: false }
}
