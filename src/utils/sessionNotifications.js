// The existing backend emits this title and a session number in the content.
// Keep the server notification intact; use it only to offer a schedule shortcut.
export function isSessionUpdateNotification(item) {
  return String(item?.title || '').normalize('NFC').trim().toLowerCase() === 'cập nhật lịch buổi học'
}

export function sessionNotificationId(item) {
  if (!isSessionUpdateNotification(item)) return null
  return String(item.content || '').match(/^Buổi #(\d+)\s*-/u)?.[1] ?? null
}
