import api from './api'
import { getClassSessionDateRange } from '../utils/classSessionDates.js'
import { buildClassPayload } from '../utils/classForm.js'
import { validateSessionWrite, withSessionWriteLock } from './sessionSchedulingService'

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

export async function getManagedClassesWithSessionDates(params = {}) {
  const result = await getManagedClasses(params)
  const items = []
  for (let offset = 0; offset < result.items.length; offset += 4) {
    const batch = await Promise.all(result.items.slice(offset, offset + 4).map(async sportClass => {
      try {
        const sessions = await getAllClassSessions(sportClass.id)
        return { ...sportClass, sessionDateRange: getClassSessionDateRange(sessions), sessionDatesError: '' }
      } catch (error) {
        return { ...sportClass, sessionDateRange: null, sessionDatesError: getClassErrorMessage(error, 'Không thể tải ngày học của lớp.') }
      }
    }))
    items.push(...batch)
  }
  return { ...result, items }
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
  const payload = buildClassPayload(data)
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
  const payload = buildClassPayload(data)
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
export async function getClassSessions(classId, params = {}, { signal } = {}) {
  const response = await api.get(`/classes/${classId}/sessions`, { params, signal })
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải danh sách buổi học.')
  }
  const payload = body?.data ?? body
  const items = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : null
  if (!items) throw new Error('Dữ liệu buổi học không hợp lệ. Vui lòng thử lại.')
  const total = Number(payload?.total ?? payload?.totalCount ?? items.length)
  if (!Number.isFinite(total) || total < 0) throw new Error('Tổng số buổi học không hợp lệ. Vui lòng thử lại.')
  return {
    items,
    total,
    page: Number(payload?.page || params.page || 1),
  }
}

export async function getAllClassSessions(classId, { signal } = {}) {
  const items = []
  const seen = new Set()
  for (let page = 1; ; page += 1) {
    const result = await getClassSessions(classId, { page, pageSize: 100 }, { signal })
    if (result.page !== page || (!result.items.length && items.length < result.total)) throw new Error('Chưa tải đủ các buổi học của lớp. Vui lòng thử lại.')
    for (const item of result.items) {
      if (seen.has(String(item.id))) throw new Error('Dữ liệu buổi học bị trùng trang. Vui lòng thử lại.')
      seen.add(String(item.id))
      items.push(item)
    }
    if (items.length >= result.total) return items
  }
}

/**
 * POST /api/classes/{id}/sessions
 * Thêm buổi học mới vào lớp
 */
export async function createClassSession(classId, data) {
  return withSessionWriteLock(async () => {
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
    await validateSessionWrite(classId, payload)
    const response = await api.post(`/classes/${classId}/sessions`, payload)
    const body = response.data
    if (body?.success === false) {
      throw new Error(body.message || 'Không thể tạo buổi học.')
    }
    return body?.data ?? body
  })
}

/**
 * PUT /api/classes/{id}/sessions/{sessionId}
 * Dời lịch buổi học (Reschedule), đổi HLV, cập nhật sức chứa buổi học
 */
export async function updateClassSession(classId, sessionId, data) {
  return withSessionWriteLock(async () => {
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
    await validateSessionWrite(classId, payload, sessionId)
    const response = await api.put(`/classes/${classId}/sessions/${sessionId}`, payload)
    const body = response.data
    if (body?.success === false) {
      throw new Error(body.message || 'Không thể cập nhật buổi học.')
    }
    return body?.data ?? body
  })
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
  getManagedClassesWithSessionDates,
  getClassById,
  createSportClass,
  updateSportClass,
  deactivateSportClass,
  getClassSessions,
  getAllClassSessions,
  createClassSession,
  updateClassSession,
  cancelClassSession,
  completeClassSession,
  getSessionRoster,
  getRooms,
}
