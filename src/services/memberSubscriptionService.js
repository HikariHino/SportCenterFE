import api from './api'

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
 * @param {{ amount: number, paymentMethod: 'Cash'|'BankTransfer'|'CreditCard', paymentReceived?: boolean }} data
 */
export async function confirmSubscriptionPayment(subscriptionId, { amount, paymentMethod, paymentReceived = true }) {
  const response = await api.post(`/member-subscriptions/${subscriptionId}/payments`, {
    amount: Number(amount),
    paymentMethod,
    paymentReceived: Boolean(paymentReceived),
  })
  return unwrap(response.data, 'Không thể xác nhận thanh toán gói.')
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

