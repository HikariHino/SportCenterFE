import api from './api'

export function getClassErrorMessage(error, fallback = 'Có lỗi xảy ra khi thao tác với lớp học.') {
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
 * 1. QUẢN LÝ LỚP HỌC (SportClassesController)
 */

/**
 * GET /api/classes/manage
 * Quản lý xem danh sách lớp học (gồm cả lớp đã ngừng hoạt động)
 */
export async function getManagedClasses(params = {}) {
  const response = await api.get('/classes/manage', { params })
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải danh sách lớp học.')
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
 * GET /api/classes
 * Tìm kiếm danh sách lớp học mở cho tất cả người dùng (Member, Khách vãng lai)
 */
export async function getPublicClasses(params = {}) {
  const response = await api.get('/classes', { params })
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải danh sách lớp học.')
  }
  const payload = body?.data ?? body
  return {
    items: Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [],
    total: Number(payload?.total || (Array.isArray(payload) ? payload.length : 0)),
    page: Number(payload?.page || 1),
    pageSize: Number(payload?.pageSize || 20),
  }
}

export const getClasses = getPublicClasses

/**
 * GET /api/classes/{id}
 * Xem chi tiết một lớp học
 */
export async function getClassById(id) {
  const response = await api.get(`/classes/${id}`)
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải thông tin lớp học.')
  }
  return body?.data ?? body
}

/**
 * POST /api/classes
 * Quản lý tạo lớp học mới
 */
export async function createSportClass(data) {
  const payload = {
    className: data.className.trim(),
    sportId: Number(data.sportId),
    coachId: Number(data.coachId),
    price: Number(data.price),
    maxCapacity: Number(data.maxCapacity),
    schedule: data.schedule ? data.schedule.trim() : null,
    startDate: data.startDate,
    endDate: data.endDate,
    isActive: data.isActive !== false,
  }
  if (data.roomId) {
    payload.roomId = Number(data.roomId)
  }
  if (data.roomName) {
    payload.roomName = data.roomName
  }
  const response = await api.post('/classes', payload)
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tạo lớp học.')
  }
  return body?.data ?? body
}

/**
 * PUT /api/classes/{id}
 * Quản lý cập nhật thông tin lớp học (đổi HLV, đổi lịch định kỳ, cập nhật sĩ số, v.v.)
 */
export async function updateSportClass(id, data) {
  const payload = {
    className: data.className.trim(),
    sportId: Number(data.sportId),
    coachId: Number(data.coachId),
    price: Number(data.price),
    maxCapacity: Number(data.maxCapacity),
    schedule: data.schedule ? data.schedule.trim() : null,
    startDate: data.startDate,
    endDate: data.endDate,
    isActive: data.isActive !== false,
  }
  if (data.roomId) {
    payload.roomId = Number(data.roomId)
  }
  if (data.roomName) {
    payload.roomName = data.roomName
  }
  const response = await api.put(`/classes/${id}`, payload)
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể cập nhật lớp học.')
  }
  return body?.data ?? body
}

/**
 * DELETE /api/classes/{id}
 * Quản lý ngừng hoạt động / đóng lớp học (xóa mềm bằng IsActive = false)
 */
export async function deactivateSportClass(id) {
  const response = await api.delete(`/classes/${id}`)
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể đóng lớp học.')
  }
  return body
}

/**
 * 2. QUẢN LÝ BUỔI HỌC (ClassSessionsController)
 */

/**
 * GET /api/classes/{id}/sessions
 * Xem danh sách các buổi học của một lớp
 */
export async function getClassSessions(classId, params = {}) {
  const response = await api.get(`/classes/${classId}/sessions`, { params })
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải danh sách buổi học.')
  }
  const payload = body?.data ?? body
  return {
    items: Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [],
    total: Number(payload?.total || (Array.isArray(payload) ? payload.length : 0)),
  }
}

/**
 * POST /api/classes/{id}/sessions
 * Thêm buổi học mới vào lớp
 */
export async function createClassSession(classId, data) {
  const payload = {
    coachId: Number(data.coachId),
    cancellationPolicyId: Number(data.cancellationPolicyId || 1),
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    capacity: Number(data.capacity),
  }
  if (data.roomId) {
    payload.roomId = Number(data.roomId)
  }
  const response = await api.post(`/classes/${classId}/sessions`, payload)
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tạo buổi học.')
  }
  return body?.data ?? body
}

/**
 * PUT /api/classes/{id}/sessions/{sessionId}
 * Dời lịch buổi học (Reschedule), đổi HLV, cập nhật sức chứa buổi học
 */
export async function updateClassSession(classId, sessionId, data) {
  const payload = {
    coachId: Number(data.coachId),
    cancellationPolicyId: Number(data.cancellationPolicyId || 1),
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    capacity: Number(data.capacity),
  }
  if (data.roomId) {
    payload.roomId = Number(data.roomId)
  }
  const response = await api.put(`/classes/${classId}/sessions/${sessionId}`, payload)
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể cập nhật buổi học.')
  }
  return body?.data ?? body
}

/**
 * POST /api/class-sessions/{id}/cancel
 * Hủy buổi học đột xuất kèm lý do
 */
export async function cancelClassSession(sessionId, reason) {
  const response = await api.post(`/class-sessions/${sessionId}/cancel`, {
    reason: reason.trim(),
  })
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể hủy buổi học.')
  }
  return body
}

/**
 * POST /api/class-sessions/{id}/complete
 * Đánh dấu buổi học hoàn thành
 */
export async function completeClassSession(sessionId) {
  const response = await api.post(`/class-sessions/${sessionId}/complete`)
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể hoàn thành buổi học.')
  }
  return body
}

/**
 * GET /api/class-sessions/{id}/roster
 * Xem danh sách học viên đăng ký của buổi học
 */
export async function getSessionRoster(sessionId) {
  const response = await api.get(`/class-sessions/${sessionId}/roster`)
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải danh sách học viên.')
  }
  const payload = body?.data ?? body
  return Array.isArray(payload) ? payload : []
}

/**
 * 3. HỖ TRỢ PHÒNG TẬP (RoomsController)
 */

/**
 * GET /api/rooms
 * Lấy danh sách phòng tập để gán hoặc kiểm tra
 */
export async function getRooms(isActive) {
  try {
    const params = isActive !== undefined ? { isActive } : {}
    const response = await api.get('/rooms', { params })
    const body = response.data
    const payload = body?.data ?? body
    return Array.isArray(payload) ? payload : []
  } catch {
    return []
  }
}

export default {
  getClassErrorMessage,
  getManagedClasses,
  getClassById,
  createSportClass,
  updateSportClass,
  deactivateSportClass,
  getClassSessions,
  createClassSession,
  updateClassSession,
  cancelClassSession,
  completeClassSession,
  getSessionRoster,
  getRooms,
}
