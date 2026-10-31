export function memberChatTurns(history, local) {
  const saved = [...history].reverse().map(item => ({ ...item, id: `saved-${item.id}`, status: 'success' }))
  const counts = new Map()
  const key = item => JSON.stringify([item.question.trim(), item.answer?.trim()])
  for (const item of saved) counts.set(key(item), (counts.get(key(item)) || 0) + 1)
  const unsaved = local.filter(item => {
    if (item.status !== 'success' || !counts.get(key(item))) return true
    counts.set(key(item), counts.get(key(item)) - 1)
    return false
  })
  return [...saved, ...unsaved]
}

export const memberAiHistoryDate = value => {
  const date = new Date(value)
  return value && Number.isFinite(date.getTime()) ? date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }) : 'Chưa cập nhật ngày'
}
