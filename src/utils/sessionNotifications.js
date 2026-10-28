// The existing backend emits this title and a session number in the content.
// Keep the server notification intact and load current times from registrations.
export function isSessionUpdateNotification(item) {
  return String(item?.title || '').normalize('NFC').trim().toLowerCase() === 'cập nhật lịch buổi học'
}

export function sessionNotificationId(item) {
  if (!isSessionUpdateNotification(item)) return null
  return String(item.content || '').match(/^Buổi #(\d+)\s*-/u)?.[1] ?? null
}

export function pendingSessionReviews(notifications, registrations) {
  const groups = new Map()
  for (const notification of notifications) {
    if (notification.isRead || !isSessionUpdateNotification(notification)) continue
    const sessionId = sessionNotificationId(notification)
    const key = sessionId || `notification-${notification.id}`
    if (!groups.has(key)) {
      const matches = registrations.filter(item => sessionId != null && String(item.sessionId) === sessionId)
      const registration = matches.find(item => !['cancelled', 'canceled'].includes(String(item.status).trim().toLowerCase())) || matches[0] || null
      groups.set(key, { key, sessionId, registration, notifications: [] })
    }
    groups.get(key).notifications.push(notification)
  }
  return [...groups.values()].map(review => {
    const item = review.registration
    // Compare the exact information shown, including newer notices for this session.
    const version = JSON.stringify([
      review.notifications.map(n => [String(n.id), n.title, n.content, n.sentAt]).sort((a, b) => a[0].localeCompare(b[0])),
      item ? [item.id, item.status, item.sessionStatus, item.className, item.startsAt, item.endsAt, item.coachName, item.roomName, item.cancellationDeadline, item.minimumHoursBeforeStart, item.cancellationPolicy?.minimumHoursBeforeStart] : null,
    ])
    return { ...review, version }
  })
}
