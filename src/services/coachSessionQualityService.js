import api from './api'

async function readPages(url, params, signal) {
  const items = [], seen = new Set()
  for (let page = 1; ; page++) {
    signal?.throwIfAborted()
    const response = await api.get(url, { params: { ...params, page, pageSize: 100 }, signal })
    const body = response.data
    if (body?.success === false) throw new Error(body.message || 'Không thể tải chất lượng buổi học.')
    const data = body?.data ?? body
    if (!Array.isArray(data?.items) || !Number.isSafeInteger(data.total) || data.total < 0 || Number(data.page) !== page) {
      throw new Error('Dữ liệu buổi học hoặc đánh giá không hợp lệ.')
    }
    for (const item of data.items) {
      if (!Number.isSafeInteger(Number(item.id)) || Number(item.id) <= 0 || seen.has(String(item.id))) {
        throw new Error('Danh sách buổi học hoặc đánh giá bị thiếu mã hoặc trùng trang.')
      }
      seen.add(String(item.id)); items.push(item)
    }
    if (items.length === data.total) return items
    if (!data.items.length || items.length > data.total) throw new Error('Chưa tải đủ dữ liệu để tính chất lượng buổi học.')
  }
}

// ClassReviews rates individual sessions; CoachReviews rates the coach directly.
export async function getCoachSessionQuality(coachId, { signal } = {}) {
  if (!Number.isSafeInteger(Number(coachId)) || Number(coachId) <= 0) throw new Error('Mã coach không hợp lệ.')
  const sessions = await readPages('/class-sessions', { coachId: Number(coachId) }, signal)
  if (sessions.some(session => !Number.isSafeInteger(Number(session.coachId)) || Number(session.coachId) <= 0)) {
    throw new Error('Chưa xác định được coach phụ trách buổi học.')
  }
  // Filter by the session coach, rather than the default coach of its class.
  const assigned = sessions.filter(session => String(session.coachId) === String(coachId))
  const seenReviews = new Set()
  let reviewCount = 0, stars = 0
  for (let offset = 0; offset < assigned.length; offset += 4) {
    const groups = await Promise.all(assigned.slice(offset, offset + 4).map(session =>
      readPages(`/class-sessions/${session.id}/reviews`, {}, signal)))
    for (const reviews of groups) {
      for (const review of reviews) {
        if (seenReviews.has(String(review.id)) || !Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5) {
          throw new Error('Điểm đánh giá buổi học không hợp lệ.')
        }
        seenReviews.add(String(review.id)); stars += review.rating; reviewCount++
      }
    }
  }
  return { averageRating: reviewCount ? stars / reviewCount : null, reviewCount }
}
