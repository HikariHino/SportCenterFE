import api from './api'
import { bookingUnavailableReason, hasActiveMembership, registeredSessionIds, reviewUnavailableReason } from '../utils/memberClasses.js'
import { getMySubscriptions } from './memberSubscriptionService'

function readPage(body, page, pageSize, fallback) {
  if (body?.success === false) throw new Error(body.message || fallback)
  const payload = body?.data ?? body
  if (Array.isArray(payload)) {
    return { items: payload.slice((page - 1) * pageSize, page * pageSize), total: payload.length, page, pageSize }
  }
  if (!Array.isArray(payload?.items)) throw new Error('Dữ liệu danh sách lớp học không hợp lệ. Vui lòng thử lại.')
  const total = Number(payload.total ?? payload.totalCount ?? payload.items.length)
  if (!Number.isFinite(total) || total < 0) throw new Error('Tổng số kết quả không hợp lệ. Vui lòng thử lại.')
  return {
    items: payload.items,
    total,
    page: Number(payload.page || page),
    pageSize: Number(payload.pageSize || pageSize),
  }
}

async function allPages(loader) {
  const items = []
  const seen = new Set()
  for (let page = 1; ; page += 1) {
    const result = await loader({ page, pageSize: 100 })
    if (result.page !== page || (!result.items.length && items.length < result.total)) throw new Error('Chưa tải đủ danh sách. Vui lòng thử lại.')
    for (const item of result.items) {
      if (item.id == null || seen.has(String(item.id))) throw new Error('Dữ liệu bị trùng trang hoặc thiếu mã. Vui lòng tải lại.')
      seen.add(String(item.id))
      items.push(item)
    }
    if (items.length >= result.total) return { items, total: items.length, page: 1, pageSize: 100 }
  }
}

export async function getMemberClasses(params = {}) {
  const response = await api.get('/classes', { params })
  return readPage(response.data, params.page || 1, params.pageSize || 12, 'Không thể tải danh sách lớp học.')
}

export const getAllMemberClasses = () => allPages(getMemberClasses)
export const getAllAvailableSessions = () => allPages(getAvailableSessions)

export async function getMemberClassSessions(classId) {
  return allPages(async params => {
    const response = await api.get(`/classes/${classId}/sessions`, { params })
    return readPage(response.data, params.page, params.pageSize, 'Không thể tải các buổi học của lớp.')
  })
}

/**
 * Trích xuất lỗi từ backend cho Class & Sessions
 */
export function getMemberClassErrorMessage(error, fallback = 'Có lỗi xảy ra khi thao tác với lớp học.') {
  const body = error?.response?.data
  const validationErrors = body?.errors
  if (validationErrors && typeof validationErrors === 'object') {
    const firstKey = Object.keys(validationErrors)[0]
    if (firstKey && Array.isArray(validationErrors[firstKey])) {
      const firstVal = validationErrors[firstKey][0]
      const lowerVal = String(firstVal).toLowerCase()
      if (
        lowerVal.includes('gói') ||
        lowerVal.includes('subscription') ||
        lowerVal.includes('package') ||
        lowerVal.includes('membership') ||
        lowerVal.includes('thành viên')
      ) {
        return 'Không thể đặt lịch khi chưa đăng ký gói thành viên.'
      }
      return firstVal
    }
  }
  const raw = body?.message || body?.detail || (typeof body === 'string' && body) || error?.message || fallback
  const lower = String(raw).toLowerCase()
  if (
    lower.includes('gói') ||
    lower.includes('subscription') ||
    lower.includes('package') ||
    lower.includes('membership') ||
    lower.includes('thành viên') ||
    lower.includes('chưa đăng ký') ||
    lower.includes('không có gói') ||
    lower.includes('no active') ||
    lower.includes('not active') ||
    lower.includes('expired') ||
    lower.includes('hết hạn')
  ) {
    return 'Không thể đặt lịch khi chưa đăng ký gói thành viên.'
  }
  return raw
}

/**
 * Tìm kiếm danh sách các buổi học đang mở
 * GET /api/class-sessions
 */
export async function getAvailableSessions(params = {}) {
  const response = await api.get('/class-sessions', { params })
  return readPage(response.data, params.page || 1, params.pageSize || 20, 'Không thể tải danh sách buổi học.')
}

/**
 * Hội viên đăng ký một buổi học
 * POST /api/class-sessions/{sessionId}/registrations
 * @param {number} sessionId
 */
export async function bookSession(sessionId) {
  const response = await api.post(`/class-sessions/${sessionId}/registrations`)
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể đặt lịch buổi học.')
  }
  return body?.data ?? body
}

/**
 * Hội viên xem các lượt đăng ký lớp học của mình
 * GET /api/class-registrations/mine?page=1&pageSize=20
 */
export async function getMyRegistrations({ page = 1, pageSize = 20 } = {}) {
  const response = await api.get('/class-registrations/mine', {
    params: { page, pageSize },
  })
  return readPage(response.data, page, pageSize, 'Không thể tải lịch học của bạn.')
}

// The weekly timetable must include registrations beyond the first API page.
export async function getAllMyRegistrations() {
  return allPages(getMyRegistrations)
}

export async function bookClassSessions({ classId, sessionIds }, onProgress = () => {}) {
  const ids = [...new Set(sessionIds.map(String))]
  if (!ids.length) throw new Error('Không có buổi học nào được chọn để đăng ký.')
  const [catalog, mine, subscriptions] = await Promise.all([getMemberClassSessions(classId), getAllMyRegistrations(), getMySubscriptions()])
  if (!hasActiveMembership(subscriptions)) throw new Error('Bạn cần có gói hội viên đang còn hiệu lực để đăng ký buổi học.')
  const registered = registeredSessionIds(mine.items)
  let planned = [...mine.items]
  const result = { registered: [], existing: [], skipped: [], remaining: [], error: '' }
  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index]
    const session = catalog.items.find(item => String(item.id) === id && (item.classId == null || String(item.classId) === String(classId)))
    if (registered.has(id)) { result.existing.push(id); continue }
    const reason = session ? bookingUnavailableReason(session, false, Date.now(), planned) : 'Buổi học không còn tồn tại trong lớp.'
    if (reason) { result.skipped.push({ id, reason }); continue }
    onProgress({ completed: index, total: ids.length })
    try {
      await bookSession(id)
      result.registered.push(id)
      registered.add(id)
      planned.push({ ...session, sessionId: session.id, status: 'Registered', sessionStatus: 'Scheduled' })
    } catch (error) {
      // A response may be lost after a successful POST. Reconcile before offering
      // retry, so the member is never asked to book a confirmed session twice.
      let recovered = false
      try {
        const latest = (await getAllMyRegistrations()).items
        recovered = registeredSessionIds(latest).has(id)
        if (recovered) planned = latest
      } catch { /* Retry will reload registrations before any further POST. */ }
      if (recovered) {
        result.registered.push(id)
        registered.add(id)
        planned.push({ ...session, sessionId: session.id, status: 'Registered', sessionStatus: 'Scheduled' })
        continue
      }
      result.remaining = ids.slice(index)
      result.error = error?.response?.data?.message || getMemberClassErrorMessage(error)
      return result
    }
  }
  onProgress({ completed: ids.length, total: ids.length })
  return result
}

/**
 * Hội viên hủy một lượt đăng ký buổi học
 * POST /api/class-registrations/{id}/cancel
 * @param {number} registrationId
 * @param {string} reason
 * @param {number} expectedSessionId Buổi được hội viên chọn trên lịch.
 */
export async function cancelRegistration(registrationId, reason = 'Hội viên tự hủy lịch', expectedSessionId) {
  if (!Number.isSafeInteger(Number(registrationId)) || Number(registrationId) <= 0
    || (expectedSessionId != null && (!Number.isSafeInteger(Number(expectedSessionId)) || Number(expectedSessionId) <= 0))) {
    throw new Error('Chưa xác định được đăng ký buổi học cần hủy. Vui lòng làm mới lịch.')
  }
  const response = await api.post(`/class-registrations/${registrationId}/cancel`, {
    reason: reason.trim() || 'Hội viên tự hủy lịch',
  })
  const body = response.data
  if (body?.success === false || Number(body?.statusCode) >= 400) {
    throw new Error(body.message || 'Không thể hủy lượt đăng ký.')
  }
  const registration = body?.data ?? body
  if (String(registration?.id) !== String(registrationId)
    || (expectedSessionId != null && String(registration.sessionId) !== String(expectedSessionId))
    || !['cancelled', 'canceled'].includes(String(registration.status).trim().toLowerCase())) {
    throw new Error('Chưa xác nhận được đúng buổi học đã hủy. Vui lòng làm mới lịch để kiểm tra trạng thái.')
  }
  return registration
}

/**
 * Hội viên check-in cho buổi học
 * POST /api/class-registrations/{id}/check-in
 * @param {number} registrationId
 */
export async function checkInRegistration(registrationId) {
  const response = await api.post(`/class-registrations/${registrationId}/check-in`)
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể check-in buổi học.')
  }
  return body?.data ?? body
}

/** POST /api/class-registrations/{id}/review — ReviewRequest from backend Swagger. */
export async function reviewRegistration(registrationId, { rating, comment = '' }) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Vui lòng chọn điểm đánh giá từ 1 đến 5 sao.')
  }
  if (comment.trim().length > 2000) throw new Error('Nhận xét không được vượt quá 2.000 ký tự.')
  const current = (await getAllMyRegistrations()).items.find(item => String(item.id) === String(registrationId))
  if (!current) throw new Error('Không tìm thấy đăng ký buổi học của bạn. Vui lòng làm mới lịch đã đặt.')
  const reason = reviewUnavailableReason(current)
  if (reason) throw new Error(reason)
  const response = await api.post(`/class-registrations/${registrationId}/review`, {
    rating, comment: comment.trim() || null,
  })
  const body = response.data
  if (body?.success === false) throw new Error(body.message || 'Không thể gửi đánh giá buổi học.')
  return body?.data ?? body
}

export default {
  getMemberClassErrorMessage,
  getMemberClasses,
  getAllMemberClasses,
  getMemberClassSessions,
  getAvailableSessions,
  getAllAvailableSessions,
  bookClassSessions,
  bookSession,
  getMyRegistrations,
  getAllMyRegistrations,
  cancelRegistration,
  checkInRegistration,
  reviewRegistration,
}
