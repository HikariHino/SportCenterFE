import api from './api'
import { getAllAvailableSessions, getAllMyRegistrations } from './memberClassService'
import { coachReviewUnavailableReason } from '../utils/memberClasses'

const validId = id => Number.isSafeInteger(Number(id)) && Number(id) > 0

export async function getCoachReviews(coachId, { page = 1, pageSize = 100, signal } = {}) {
  if (!validId(coachId)) throw new Error('Chưa xác định được huấn luyện viên.')
  const response = await api.get(`/coaches/${coachId}/reviews`, { params: { page, pageSize }, signal })
  const body = response.data
  if (body?.success === false) throw new Error(body.message || 'Không thể tải đánh giá coach.')
  const data = body?.data ?? body
  if (String(data?.coachId) !== String(coachId) || !Array.isArray(data.items)
    || !Number.isSafeInteger(data.total) || data.total < 0 || Number(data.page) !== page
    || !Number.isSafeInteger(data.reviewCount) || data.reviewCount < 0
    || (data.reviewCount > 0 && (typeof data.averageRating !== 'number' || !Number.isFinite(data.averageRating) || data.averageRating < 1 || data.averageRating > 5))
    || data.items.some(item => !validId(item.id) || String(item.coachId) !== String(coachId) || !validId(item.memberId)
      || !Number.isInteger(item.rating) || item.rating < 1 || item.rating > 5)) {
    throw new Error('Dữ liệu đánh giá coach không hợp lệ. Vui lòng thử lại.')
  }
  return data
}

export async function getAllCoachReviews(coachId, { signal } = {}) {
  const items = [], seen = new Set()
  for (let page = 1; ; page++) {
    const result = await getCoachReviews(coachId, { page, signal })
    for (const item of result.items) {
      if (seen.has(String(item.id))) throw new Error('Máy chủ trả lặp trang đánh giá.')
      seen.add(String(item.id)); items.push(item)
    }
    if (items.length === result.total) return items
    if (!result.items.length || items.length > result.total) throw new Error('Chưa tải đủ đánh giá coach.')
  }
}

export async function loadMemberCoachReview(registrationId) {
  const registration = (await getAllMyRegistrations()).items.find(item => String(item.id) === String(registrationId))
  if (!registration) throw new Error('Không tìm thấy đăng ký buổi học của bạn.')
  const reason = coachReviewUnavailableReason(registration)
  if (reason) throw new Error(reason)
  const session = (await getAllAvailableSessions()).items.find(item => String(item.id) === String(registration.sessionId))
  // Use the session's assigned coach, which can differ from the class coach.
  if (!session || !validId(session.coachId) || !validId(registration.memberId)) {
    throw new Error('Chưa xác định được coach hoặc hội viên của buổi học. Vui lòng tải lại lịch.')
  }
  const reviews = await getAllCoachReviews(session.coachId)
  return { coachId: session.coachId, coachName: session.coachName, memberId: registration.memberId,
    review: reviews.find(item => String(item.memberId) === String(registration.memberId)) || null }
}

export async function saveMemberCoachReview(registrationId, expectedCoachId, { rating, comment = '' }) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Vui lòng chọn từ 1 đến 5 sao.')
  if (typeof comment !== 'string' || comment.length > 2000) throw new Error('Nhận xét tối đa 2.000 ký tự.')
  const context = await loadMemberCoachReview(registrationId)
  if (String(context.coachId) !== String(expectedCoachId)) throw new Error('Coach của buổi học đã thay đổi. Vui lòng mở lại đánh giá.')
  const payload = { rating, comment: comment.trim() || null }
  const response = context.review
    ? await api.put(`/coaches/${context.coachId}/reviews`, payload)
    : await api.post(`/coaches/${context.coachId}/reviews`, payload)
  const body = response.data
  if (body?.success === false) throw new Error(body.message || 'Không thể lưu đánh giá coach.')
  const review = body?.data ?? body
  if (!validId(review?.id) || String(review.coachId) !== String(context.coachId)
    || String(review.memberId) !== String(context.memberId) || review.rating !== rating) {
    throw new Error('Chưa xác nhận được đánh giá đã lưu. Vui lòng mở lại để kiểm tra.')
  }
  return review
}
