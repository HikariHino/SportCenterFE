import api from './api'

/**
 * Trích xuất lỗi từ backend cho Class & Sessions
 */
export function getMemberClassErrorMessage(error, fallback = 'Có lỗi xảy ra khi thao tác với lớp học.') {
  const body = error?.response?.data
  const validationErrors = body?.errors
  if (validationErrors && typeof validationErrors === 'object') {
    const firstKey = Object.keys(validationErrors)[0]
    if (firstKey && Array.isArray(validationErrors[firstKey])) {
      return validationErrors[firstKey][0]
    }
  }
  return body?.message || error?.message || fallback
}

/**
 * Tìm kiếm danh sách các buổi học đang mở
 * GET /api/class-sessions
 */
export async function getAvailableSessions(params = {}) {
  const response = await api.get('/class-sessions', { params })
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải danh sách buổi học.')
  }
  const payload = body?.data ?? body
  return {
    items: Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [],
    total: Number(payload?.total || (Array.isArray(payload) ? payload.length : 0)),
    page: Number(payload?.page || 1),
    pageSize: Number(payload?.pageSize || 20),
  }
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
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải lịch học của bạn.')
  }
  const payload = body?.data ?? body
  return {
    items: Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [],
    total: Number(payload?.total || (Array.isArray(payload) ? payload.length : 0)),
    page: Number(payload?.page || page),
    pageSize: Number(payload?.pageSize || pageSize),
  }
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

export default {
  getMemberClassErrorMessage,
  getAvailableSessions,
  bookSession,
  getMyRegistrations,
  cancelRegistration,
  checkInRegistration,
}
