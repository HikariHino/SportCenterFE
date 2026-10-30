import api from './api'
import { getToken } from '../utils/auth'

function unwrap(body, fallback) {
  if (body?.success === false || Number(body?.statusCode) >= 400) {
    throw new Error(body.message || fallback)
  }

  return body?.data ?? body
}

/** GET /api/member-subscriptions/mine */
export async function getMySubscriptions() {
  const response = await api.get('/member-subscriptions/mine')
  const payload = unwrap(response.data, 'Không thể tải danh sách đăng ký gói.')
  if (!Array.isArray(payload)) throw new Error('Dữ liệu gói đã đăng ký không hợp lệ. Vui lòng tải lại.')
  return payload
}

/** POST /api/member-subscriptions */
export async function createMemberSubscription(packageId) {
  const response = await api.post('/member-subscriptions', { packageId })
  return unwrap(response.data, 'Không thể đăng ký gói hội viên.')
}

/** GET /api/member-subscriptions/upgrade-preview */
export async function getSubscriptionUpgradePreview(targetPackageId, memberId) {
  const response = await api.get('/member-subscriptions/upgrade-preview', {
    params: { targetPackageId, ...(memberId == null ? {} : { memberId }) },
  })
  const preview = unwrap(response.data, 'Không thể xem trước thông tin nâng cấp gói.')
  if (!preview || String(preview.targetPackageId) !== String(targetPackageId) || typeof preview.canUpgrade !== 'boolean'
    || !['targetPackagePrice', 'discountAmount', 'amountToPay', 'currentAgreedPrice'].every(field => preview[field] != null && Number.isFinite(Number(preview[field])) && Number(preview[field]) >= 0)
    || Number(preview.targetPackagePrice) <= 0 || Number(preview.amountToPay) <= 0
    || (preview.canUpgrade && (preview.currentSubscriptionId == null || !Number.isFinite(Date.parse(preview.newStartDate))
      || !Number.isFinite(Date.parse(preview.newEndDate)) || Date.parse(preview.newEndDate) <= Date.parse(preview.newStartDate)))) {
    throw new Error('Thông tin số tiền nâng cấp không hợp lệ. Vui lòng tải lại trước khi đăng ký.')
  }
  return preview
}

/** POST /api/member-subscriptions/members/{memberId} */
export async function createReceptionistMemberSubscription(memberId, packageId) {
  const response = await api.post(`/member-subscriptions/members/${memberId}`, { packageId })
  return unwrap(response.data, 'Không thể đăng ký gói cho hội viên.')
}

/** GET /api/member-subscriptions/members/{memberId} */
export async function getReceptionistMemberSubscriptions(memberId) {
  const response = await api.get(`/member-subscriptions/members/${memberId}`)
  const payload = unwrap(response.data, 'Không thể tải các gói của hội viên.')
  if (!Array.isArray(payload)) throw new Error('Dữ liệu gói của hội viên không hợp lệ. Vui lòng tải lại.')
  return payload
}

/** GET /api/member-subscriptions/{id} */
export async function getReceptionistSubscriptionById(id) {
  const response = await api.get(`/member-subscriptions/${id}`)
  return unwrap(response.data, 'Không thể tải chi tiết đăng ký gói.')
}

/**
 * Hủy đăng ký gói đang chờ thanh toán (Pending)
 * POST /api/member-subscriptions/{id}/cancel
 * @param {number} subscriptionId
 */
export async function cancelPendingSubscription(subscriptionId) {
  const response = await api.post(`/member-subscriptions/${subscriptionId}/cancel`)
  return unwrap(response.data, 'Không thể hủy đăng ký gói.')
}

/** POST /api/member-subscriptions/{id}/cancel */
export const cancelReceptionistSubscription = cancelPendingSubscription

/** GET /api/member-subscriptions/{id} */
export const getSubscriptionById = getReceptionistSubscriptionById

/** POST /api/member-subscriptions/{id}/cancel */
export const cancelSubscription = cancelPendingSubscription

/**
 * Xác nhận thanh toán trực tiếp tại quầy và kích hoạt gói ngay
 * POST /api/member-subscriptions/{id}/payments
 * @param {number} subscriptionId
 * @param {{ amount: number, paymentMethod: 'Cash'|'BankTransfer'|'CreditCard', paymentReceived: boolean }} data
 */
export function confirmSubscriptionPayment(subscriptionId, { amount, paymentMethod, paymentReceived } = {}) {
  const normalizedAmount = Number(amount)
  if (!Number.isSafeInteger(Number(subscriptionId)) || Number(subscriptionId) <= 0) {
    return Promise.reject(new Error('Mã đăng ký gói không hợp lệ. Vui lòng tải lại.'))
  }
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0 || normalizedAmount > 9999999999999999.99
    || Math.abs(normalizedAmount * 100 - Math.round(normalizedAmount * 100)) > 0.000001) {
    return Promise.reject(new Error('Số tiền phải lớn hơn 0 và có tối đa hai chữ số thập phân.'))
  }
  if (!['Cash', 'BankTransfer', 'CreditCard'].includes(paymentMethod)) {
    return Promise.reject(new Error('Vui lòng chọn phương thức thanh toán tại quầy hợp lệ.'))
  }
  if (paymentReceived !== true) {
    return Promise.reject(new Error('Vui lòng xác nhận đã thực nhận đủ tiền từ hội viên.'))
  }
  const key = JSON.stringify([getToken(), String(subscriptionId)])
  if (counterPayments.has(key)) return counterPayments.get(key)
  const request = recordCounterPayment(subscriptionId, normalizedAmount, paymentMethod)
    .finally(() => counterPayments.delete(key))
  counterPayments.set(key, request)
  return request
}

const counterPayments = new Map()
const unconfirmedCounterPayment = 'Chưa xác nhận được kết quả thu tiền. Vui lòng tải lại trạng thái gói và biên nhận trước khi thử lại; không thu tiền lần nữa.'

async function recordCounterPayment(subscriptionId, amount, paymentMethod) {
  let receipt
  try {
    const response = await api.post(`/member-subscriptions/${subscriptionId}/payments`, {
      amount, paymentMethod, paymentReceived: true,
    })
    receipt = unwrap(response.data, 'Không thể xác nhận thanh toán gói.')
  } catch (error) {
    const body = error.response?.data
    const message = body?.message || (body?.errors && Object.values(body.errors).flat()[0]) || error.message
    const technical = typeof message !== 'string' || message.length > 400
      || /LINQ|DbSet|could not be translated|PackageTypeHelper|Microsoft\.EntityFrameworkCore|System\.[A-Z]|stack\s*trace|https?:\/\//i.test(message)
    if (technical) {
      throw new Error('Máy chủ gặp lỗi khi xử lý thanh toán tại quầy. Chưa xác nhận được việc kích hoạt gói. Vui lòng kiểm tra lại trạng thái gói và biên nhận; nếu vẫn lỗi, liên hệ quản trị hệ thống.', { cause: error })
    }
    if ((error.response?.status >= 500) || (!error.response && (error.isAxiosError || error.code))) {
      throw new Error(unconfirmedCounterPayment, { cause: error })
    }
    throw new Error(message || 'Không thể xác nhận thanh toán gói.', { cause: error })
  }
  if (!Number.isSafeInteger(Number(receipt?.id)) || Number(receipt.id) <= 0
    || String(receipt.subscriptionId) !== String(subscriptionId) || receipt.status !== 'Completed'
    || receipt.paymentMethod !== paymentMethod || Number(receipt.amount) !== amount) {
    throw new Error(unconfirmedCounterPayment)
  }
  return receipt
}

/** POST /api/member-subscriptions/{id}/payments */
export const confirmReceptionistSubscriptionPayment = confirmSubscriptionPayment

export default {
  getMySubscriptions,
  createMemberSubscription,
  getSubscriptionUpgradePreview,
  createReceptionistMemberSubscription,
  getReceptionistMemberSubscriptions,
  getReceptionistSubscriptionById,
  getSubscriptionById,
  confirmSubscriptionPayment,
  confirmReceptionistSubscriptionPayment,
  cancelPendingSubscription,
  cancelSubscription,
  cancelReceptionistSubscription,
}

