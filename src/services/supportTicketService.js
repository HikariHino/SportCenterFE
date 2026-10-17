import api from './api'

/**
 * Trích xuất lỗi từ backend cho Support Tickets
 */
export function getTicketErrorMessage(error, fallback = 'Có lỗi xảy ra khi xử lý phiếu hỗ trợ.') {
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
 * Lấy tất cả phiếu hỗ trợ của hội viên (Dành cho Lễ tân / Quản lý)
 * GET /api/SupportTickets?status={status}
 * @param {string} [status]
 */
export async function getAllSupportTickets(status) {
  const params = status && status !== 'all' ? { status } : {}
  const response = await api.get('/SupportTickets', { params })
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải danh sách phiếu hỗ trợ.')
  }
  const payload = body?.data ?? body
  return Array.isArray(payload) ? payload : []
}

/**
 * Phản hồi & Giải quyết phiếu hỗ trợ
 * PUT /api/SupportTickets/{id}/resolve
 * @param {number} ticketId
 * @param {{ status: string, resolutionNote?: string }} payload
 */
export async function resolveSupportTicket(ticketId, { status, resolutionNote }) {
  const response = await api.put(`/SupportTickets/${ticketId}/resolve`, {
    status: status.trim(),
    resolutionNote: resolutionNote ? resolutionNote.trim() : null,
  })
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể cập nhật trạng thái phiếu hỗ trợ.')
  }
  return body?.data ?? body
}

/**
 * Hội viên gửi phiếu khiếu nại / yêu cầu hỗ trợ mới
 * POST /api/SupportTickets
 * @param {{ title: string, description: string, priority?: string }} payload
 */
export async function createSupportTicket({ title, description, priority = 'Normal' }) {
  const response = await api.post('/SupportTickets', {
    title: title.trim(),
    description: description.trim(),
    priority: priority || 'Normal',
  })
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tạo phiếu hỗ trợ.')
  }
  return body?.data ?? body
}

/**
 * Hội viên xem danh sách phiếu hỗ trợ của mình
 * GET /api/SupportTickets/my-tickets
 * @returns {Promise<Array<{ id: number, title: string, description: string, status: string, priority: string, memberName: string, handledByUserName?: string, resolutionNote?: string, createdAt: string, resolvedAt?: string }>>}
 */
export async function getMySupportTickets() {
  const response = await api.get('/SupportTickets/my-tickets')
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải danh sách phiếu hỗ trợ.')
  }
  const payload = body?.data ?? body
  return Array.isArray(payload) ? payload : []
}

export default {
  getTicketErrorMessage,
  getAllSupportTickets,
  resolveSupportTicket,
  createSupportTicket,
  getMySupportTickets,
}

