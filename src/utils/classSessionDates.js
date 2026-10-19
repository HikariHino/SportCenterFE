export function getClassSessionDateRange(sessions) {
  let first = Infinity
  let last = -Infinity
  for (const session of sessions) {
    if (['cancelled', 'canceled'].includes(String(session.status || session.Status || '').trim().toLowerCase())) continue
    if (!session.startsAt || !session.endsAt) continue
    const start = Date.parse(session.startsAt)
    const end = Date.parse(session.endsAt)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || new Date(start).getUTCFullYear() <= 1) continue
    first = Math.min(first, start)
    last = Math.max(last, end)
  }
  return {
    startDate: Number.isFinite(first) ? new Date(first).toISOString() : null,
    endDate: Number.isFinite(last) ? new Date(last).toISOString() : null,
  }
}
