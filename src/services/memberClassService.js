import api from './api'

function readPage(body, page, pageSize, fallback) {
  if (body?.success === false) throw new Error(body.message || fallback)
  const payload = body?.data ?? body
  if (Array.isArray(payload)) {
    return { items: payload.slice((page - 1) * pageSize, page * pageSize), total: payload.length, page, pageSize }
  }
  if (!Array.isArray(payload?.items)) throw new Error('Dữ liệu danh sách lớp học không hợp lệ. Vui lòng thử lại.')
  return {
    items: payload.items,
    total: Number(payload.total ?? payload.totalCount ?? payload.items.length),
    page: Number(payload.page || page),
    pageSize: Number(payload.pageSize || pageSize),
  }
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
  const items = []
  let page = 1
  let result
  do {
    result = await getMyRegistrations({ page, pageSize: 100 })
    if (result.page !== page || (!result.items.length && items.length < result.total)) {
      throw new Error('Chưa tải đủ lịch học của bạn. Vui lòng thử lại.')
    }
    items.push(...result.items)
    page += 1
  } while (items.length < result.total)
  return { items, total: items.length, page: 1, pageSize: 100 }
}

/**
 * Hội viên hủy một lượt đăng ký buổi học
 * POST /api/class-registrations/{id}/cancel
 * @param {number} registrationId
 * @param {string} reason
 */
export async function cancelRegistration(registrationId, reason = 'Hội viên tự hủy lịch') {
  const response = await api.post(`/class-registrations/${registrationId}/cancel`, {
    reason: reason.trim() || 'Hội viên tự hủy lịch',
  })
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể hủy lượt đăng ký.')
  }
  return body?.data ?? body
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
  const response = await api.post(`/class-registrations/${registrationId}/review`, {
    rating, comment: comment.trim() || null,
  })
  const body = response.data
  if (body?.success === false) throw new Error(body.message || 'Không thể gửi đánh giá buổi học.')
  return body?.data ?? body
}

export default {
  getMemberClassErrorMessage,
  getAvailableSessions,
  bookSession,
  getMyRegistrations,
  getAllMyRegistrations,
  cancelRegistration,
  checkInRegistration,
  reviewRegistration,
}
