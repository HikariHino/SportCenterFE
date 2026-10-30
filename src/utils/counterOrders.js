import { subscriptionStatus } from './memberSubscriptions.js'
import { paymentStatus } from './memberPayments.js'

// List rows can omit receipts. The cancellation service always reads the full,
// current order before writing, including payments made in another session.
export function counterOrderCancellationReason(subscription, currentPayment) {
  if (subscriptionStatus(subscription) !== 'pending') return 'Chỉ hủy đơn đang chờ thanh toán và chưa thu tiền.'
  if (subscription.payments != null && !Array.isArray(subscription.payments)) return 'Chưa tải được biên nhận. Vui lòng làm mới đơn trước khi hủy.'
  const payments = [...(subscription.payments || []), ...(currentPayment ? [currentPayment] : [])]
  if (payments.some(item => ['completed', 'paid'].includes(paymentStatus(item)))) return 'Đơn đã thanh toán, không thể hủy tại quầy.'
  if (payments.some(item => paymentStatus(item) === 'needsreview' || Number(item.amountReceived) > 0)) return 'Đơn đã nhận tiền hoặc cần đối soát, chưa thể hủy.'
  return ''
}
