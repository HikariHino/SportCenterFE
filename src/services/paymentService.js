import api from './api'
import { getToken } from '../utils/auth'

function unwrap(body, fallback) {
  if (body?.success === false || Number(body?.statusCode) >= 400) {
    throw new Error(body.message || fallback)
  }

  return body?.data ?? body
}

/** GET /api/payments - phạm vi dữ liệu phụ thuộc vai trò tài khoản. */
export async function getPayments() {
  const response = await api.get('/payments')
  const payload = unwrap(response.data, 'Không thể tải lịch sử thanh toán.')
  if (!Array.isArray(payload)) throw new Error('Dữ liệu lịch sử thanh toán không hợp lệ. Vui lòng tải lại.')
  return payload
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
  const payment = unwrap(response.data, 'Không thể tạo yêu cầu thanh toán.')
  if (!Number.isSafeInteger(Number(payment?.id)) || Number(payment.id) <= 0
    || String(payment.subscriptionId) !== String(subscriptionId)
    || String(payment.paymentMethod).toLowerCase() !== 'payos'
    || !['pending', 'completed', 'cancelled', 'expired', 'failed', 'needsreview'].includes(String(payment.status).toLowerCase())) {
    throw new Error('Kết quả tạo thanh toán không khớp đơn đăng ký. Vui lòng tải lại trước khi thử lại.')
  }
  return payment
}

/** POST /api/payments/{id}/sync - Đồng bộ trạng thái mới nhất từ PayOS. */
const pendingSyncs = new Map()
export function syncPayment(id) {
  const key = JSON.stringify([getToken(), String(id)])
  if (pendingSyncs.has(key)) return pendingSyncs.get(key)
  const request = api.post(`/payments/${id}/sync`)
    .then(response => unwrap(response.data, 'Không thể đồng bộ trạng thái thanh toán.'))
    .finally(() => pendingSyncs.delete(key))
  pendingSyncs.set(key, request)
  return request
}

export function isTemporaryPaymentError(error) {
  const status = Number(error?.response?.status)
  if ([408, 409, 429, 500, 502, 503, 504].includes(status)) return true
  if (!error?.response && (error?.isAxiosError || ['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'].includes(error?.code))) return true
  // The current BE maps Npgsql's transient InvalidOperationException to HTTP 400.
  return status === 400 && /transient failure|could not serialize|serialization failure|40001|deadlock|40P01/i
    .test(error.response.data?.message || '')
}

const settledStatuses = new Set(['completed', 'cancelled', 'expired', 'failed', 'needsreview'])
const isSettled = payment => settledStatuses.has(String(payment.status || '').trim().toLowerCase())
const pendingVerifications = new Map()

/** Verify the return page against BE state; URL status/cancel flags are not proof of payment. */
export function verifyPaymentResult(orderCode, { refresh = false } = {}) {
  if (!/^[1-9]\d*$/.test(String(orderCode || ''))) return Promise.reject(new Error('Đường dẫn thiếu mã đơn thanh toán hợp lệ.'))
  const key = JSON.stringify([getToken(), String(orderCode), refresh])
  if (pendingVerifications.has(key)) return pendingVerifications.get(key)
  const request = verifyPayment(orderCode, refresh).finally(() => pendingVerifications.delete(key))
  pendingVerifications.set(key, request)
  return request
}

async function verifyPayment(orderCode, refresh) {
  const payments = await getMyPayments()
  let payment = payments.find(item => String(item.payOSOrderCode) === String(orderCode))
  if (!payment || !Number.isSafeInteger(Number(payment.id)) || Number(payment.id) <= 0) throw new Error('Không tìm thấy giao dịch PayOS vừa thực hiện.')
  const id = payment.id
  const validate = result => {
    if (!result || String(result.id) !== String(id) || String(result.payOSOrderCode) !== String(orderCode) || !result.status) {
      throw new Error('Thông tin xác nhận không khớp giao dịch. Vui lòng kiểm tra lịch sử thanh toán.')
    }
    return result
  }
  const status = String(payment.status || '').trim().toLowerCase()
  if (status === 'completed' || (!refresh && status !== 'needsreview' && isSettled(payment))) return payment
  // Keep one verification in flight across StrictMode effects. Retry sequentially
  // so a webhook can commit before we read again, without creating a new payment.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      payment = validate(await syncPayment(id))
      if (isSettled(payment)) return payment
    } catch (error) {
      if (!isTemporaryPaymentError(error)) throw error
    }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 600 * (attempt + 1)))
    try {
      payment = validate(await getPaymentById(id))
      if (isSettled(payment)) return payment
    } catch (error) {
      if (!isTemporaryPaymentError(error)) throw error
    }
  }
  // A pending payment remains unconfirmed even if the redirect claims PAID.
  return payment
}

/** POST /api/payments/{id}/cancel - Hủy giao dịch PayOS đang chờ. */
export async function cancelPayment(id, reason = 'Hội viên hủy thanh toán') {
  const response = await api.post(`/payments/${id}/cancel`, { reason })
  return unwrap(response.data, 'Không thể hủy yêu cầu thanh toán.')
}
