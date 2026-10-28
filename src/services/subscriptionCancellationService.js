import { cancelPendingSubscription, getSubscriptionById } from './memberSubscriptionService'
import { cancelPayment, getPaymentById } from './paymentService'
import { getToken } from '../utils/auth'
import { subscriptionStatus } from '../utils/memberSubscriptions.js'
import { paymentStatus } from '../utils/memberPayments.js'

function assertUnpaidClosed(payment) {
  const status = paymentStatus(payment)
  if (status === 'completed' || status === 'paid') throw new Error('Giao dịch đã thanh toán thành công. Không thể hủy đơn gói này.')
  if (status === 'needsreview' || Number(payment.amountReceived) > 0) throw new Error('Giao dịch cần đối soát. Chưa thể hủy đơn gói.')
  if (!['cancelled', 'expired', 'failed'].includes(status)) throw new Error('Chưa xác nhận hủy giao dịch PayOS. Vui lòng đồng bộ hoặc thử lại.')
}

export async function cancelOpenPayment(payment, reason) {
  if (!Number.isSafeInteger(Number(payment?.id)) || Number(payment.id) <= 0) throw new Error('Mã giao dịch thanh toán không hợp lệ.')
  let updated
  try { updated = await cancelPayment(payment.id, reason) }
  catch (error) {
    // A cancellation response may be lost after the gateway has accepted it.
    try { updated = await getPaymentById(payment.id) } catch { throw error }
    if (paymentStatus(updated) === 'pending') throw error
  }
  if (String(updated?.id) !== String(payment.id) || (payment.subscriptionId != null && String(updated.subscriptionId) !== String(payment.subscriptionId))) throw new Error('Kết quả hủy không khớp giao dịch. Vui lòng tải lại.')
  try { assertUnpaidClosed(updated) }
  catch (error) { error.paymentResult = updated; throw error }
  return updated
}

const pendingCancellations = new Map()
export function cancelSubscriptionOrder(subscriptionId, confirmedPayment) {
  if (!Number.isSafeInteger(Number(subscriptionId)) || Number(subscriptionId) <= 0) return Promise.reject(new Error('Mã đơn đăng ký gói không hợp lệ.'))
  const key = JSON.stringify([getToken(), String(subscriptionId)])
  if (pendingCancellations.has(key)) return pendingCancellations.get(key)
  const request = cancelOrder(subscriptionId, confirmedPayment).finally(() => pendingCancellations.delete(key))
  pendingCancellations.set(key, request)
  return request
}

async function cancelOrder(subscriptionId, confirmedPayment) {
  const subscription = await getSubscriptionById(subscriptionId)
  if (!subscription || String(subscription.id) !== String(subscriptionId)) throw new Error('Không tải được đơn đăng ký cần hủy.')
  if (subscriptionStatus(subscription) === 'cancelled') return subscription
  if (subscriptionStatus(subscription) !== 'pending') throw new Error('Chỉ có thể hủy đơn gói chưa thanh toán và đang chờ xử lý.')
  if (!Array.isArray(subscription.payments)) throw new Error('Chưa tải đủ lịch sử thanh toán của đơn. Vui lòng thử lại.')
  const payments = subscription.payments.map(payment => confirmedPayment
    && String(confirmedPayment.subscriptionId) === String(subscriptionId)
    && String(confirmedPayment.id) === String(payment.id) ? confirmedPayment : payment)
  // Check every receipt before cancelling any link, including other attempts.
  for (const payment of payments) {
    const status = paymentStatus(payment)
    if (status === 'completed' || status === 'paid' || status === 'needsreview' || Number(payment.amountReceived) > 0) assertUnpaidClosed(payment)
    if (status !== 'pending' && !['cancelled', 'expired', 'failed'].includes(status)) throw new Error('Chưa xác định được trạng thái thanh toán. Vui lòng đồng bộ trước khi hủy đơn.')
  }
  for (const payment of payments.filter(item => paymentStatus(item) === 'pending')) {
    if (String(payment.paymentMethod).toLowerCase() !== 'payos') throw new Error('Đơn còn giao dịch đang xử lý. Vui lòng liên hệ lễ tân trước khi hủy.')
    await cancelOpenPayment(payment)
  }
  let cancelled
  try { cancelled = await cancelPendingSubscription(subscriptionId) }
  catch (error) {
    try { cancelled = await getSubscriptionById(subscriptionId) } catch { throw error }
    if (subscriptionStatus(cancelled) !== 'cancelled') throw error
  }
  if (String(cancelled?.id) !== String(subscriptionId) || subscriptionStatus(cancelled) !== 'cancelled') {
    throw new Error('Máy chủ chưa xác nhận đơn gói đã hủy. Vui lòng tải lại trạng thái.')
  }
  return cancelled
}

export async function completeCancelledPaymentSubscription(payment) {
  if (paymentStatus(payment) !== 'cancelled') throw new Error('Giao dịch chưa được xác nhận đã hủy.')
  assertUnpaidClosed(payment)
  if (payment.subscriptionId == null) return Promise.resolve(null)
  return cancelSubscriptionOrder(payment.subscriptionId, payment)
}

export async function cancelPaymentAndSubscription(payment) {
  const updated = await cancelOpenPayment(payment)
  try {
    const subscription = updated.subscriptionId == null ? null : await cancelSubscriptionOrder(updated.subscriptionId, updated)
    return { payment: updated, subscription }
  } catch (error) {
    error.cancelledPayment = updated
    throw error
  }
}
