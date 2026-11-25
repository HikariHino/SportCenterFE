const notificationDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', hourCycle: 'h23',
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

export function formatNotificationContent(content) {
  if (typeof content !== 'string') return ''
  // Only convert timestamps with an explicit timezone; keep server content intact.
  return content.replace(/\b(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,7})?)?)(Z|[+-]\d{2}:\d{2})?(\s*\(UTC\))?/g,
    (original, value, offset, utcLabel) => {
      if (!offset && !utcLabel) return original
      const stamp = Date.parse(value.replace(/(\.\d{3})\d+$/, '$1') + (offset || 'Z'))
      const dateKey = value.slice(0, 10)
      const dayStamp = Date.parse(`${dateKey}T00:00:00Z`)
      if (!Number.isFinite(stamp) || !Number.isFinite(dayStamp) || new Date(dayStamp).toISOString().slice(0, 10) !== dateKey) return original
      const parts = Object.fromEntries(notificationDateFormatter.formatToParts(stamp).map(part => [part.type, part.value]))
      return `${parts.hour}:${parts.minute} ${parts.day}/${parts.month}/${parts.year}`
    })
}
