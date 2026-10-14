import api from './api'

function unwrap(body, fallback) {
  if (body?.success === false) {
    throw new Error(body.message || fallback)
  }

  return body?.data ?? body
}

/** GET /api/payments - phạm vi dữ liệu phụ thuộc vai trò tài khoản. */
export async function getPayments() {
  const response = await api.get('/payments')
  const payload = unwrap(response.data, 'Không thể tải lịch sử thanh toán.')
  return Array.isArray(payload) ? payload : []
}

export const getMyPayments = getPayments

/** GET /api/payments/{id} */
export async function getPaymentById(id) {
  const response = await api.get(`/payments/${id}`)
  return unwrap(response.data, 'Không thể tải chi tiết thanh toán.')
}

/** POST /api/payments - Tạo hoặc lấy lại link PayOS cho đăng ký đang chờ. */
export async function createPayment(subscriptionId) {
  const response = await api.post('/payments', { subscriptionId })
  return unwrap(response.data, 'Không thể tạo yêu cầu thanh toán.')
}

/** POST /api/payments/{id}/sync - Đồng bộ trạng thái mới nhất từ PayOS. */
export async function syncPayment(id) {
  const response = await api.post(`/payments/${id}/sync`)
  return unwrap(response.data, 'Không thể đồng bộ trạng thái thanh toán.')
}

/** POST /api/payments/{id}/cancel - Hủy giao dịch PayOS đang chờ. */
export async function cancelPayment(id, reason = 'Hội viên hủy thanh toán') {
  const response = await api.post(`/payments/${id}/cancel`, { reason })
  return unwrap(response.data, 'Không thể hủy yêu cầu thanh toán.')
}
