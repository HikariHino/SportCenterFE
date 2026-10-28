export const paymentStatus = payment => String(payment?.status || '').trim().toLowerCase().replace(/[\s_-]/g, '').replace(/^canceled$/, 'cancelled')
export const closedPaymentStatuses = new Set(['cancelled', 'expired', 'failed', 'refunded'])
const isPayOS = payment => String(payment?.paymentMethod || '').trim().toLowerCase() === 'payos'
export const canSyncPayOSPayment = payment => isPayOS(payment) && ['pending', 'needsreview', 'cancelled', 'expired', 'failed'].includes(paymentStatus(payment))
export const canCancelPayOSPayment = payment => isPayOS(payment) && paymentStatus(payment) === 'pending' && Number(payment.amountReceived || 0) === 0
export const canCheckoutPayOSPayment = payment => canCancelPayOSPayment(payment) && typeof payment.checkoutUrl === 'string' && Boolean(payment.checkoutUrl.trim())

export function paymentCheckoutMessage(payment) {
  if (paymentStatus(payment) === 'needsreview' || (paymentStatus(payment) !== 'completed' && Number(payment?.amountReceived) > 0)) return 'Giao dịch đã nhận tiền và cần đối soát. Vui lòng đồng bộ trạng thái hoặc liên hệ trung tâm trước khi thanh toán tiếp.'
  return {
    completed: 'Thanh toán đã hoàn tất và gói đã được kích hoạt.',
    cancelled: 'Giao dịch PayOS đã hủy. Chỉ tạo thanh toán mới nếu đơn gói vẫn đang chờ thanh toán.',
    expired: 'Liên kết PayOS đã hết hạn. Chỉ tạo thanh toán mới nếu đơn gói vẫn đang chờ thanh toán.',
    failed: 'Giao dịch PayOS thất bại. Vui lòng kiểm tra trạng thái đơn trước khi tạo thanh toán mới.',
    pending: canCheckoutPayOSPayment(payment) ? 'Giao dịch đang chờ thanh toán qua PayOS.' : 'Giao dịch đang chờ nhưng chưa có liên kết thanh toán. Vui lòng đồng bộ trạng thái trước khi thử lại.',
  }[paymentStatus(payment)] || 'Chưa xác định được trạng thái giao dịch. Vui lòng tải lại trước khi thanh toán.'
}
export function paymentStatusLabel(payment) {
  return { completed: 'Đã thanh toán', pending: 'Chờ thanh toán', cancelled: 'Đã hủy', expired: 'Hết hạn', failed: 'Thất bại', needsreview: 'Cần đối soát', refunded: 'Đã hoàn tiền' }[paymentStatus(payment)] || payment?.status || 'Chưa cập nhật'
}
export function paymentReceivedAmount(payment) {
  return Number(payment.amountReceived) > 0 ? Number(payment.amountReceived) : Number(payment.amount) || 0
}
export function paymentSummary(payments) {
  const completed = payments.filter(payment => paymentStatus(payment) === 'completed')
  return {
    total: payments.length, completed: completed.length,
    pending: payments.filter(payment => paymentStatus(payment) === 'pending').length,
    review: payments.filter(payment => paymentStatus(payment) === 'needsreview').length,
    closed: payments.filter(payment => closedPaymentStatuses.has(paymentStatus(payment))).length,
    paid: completed.reduce((sum, payment) => sum + paymentReceivedAmount(payment), 0),
  }
}
export function filterMemberPayments(payments, search = '', status = 'all') {
  const input = search.trim().toLowerCase()
  const paymentId = input.match(/^#?pay-(\d+)$/)?.[1]
  const subscriptionId = input.match(/^#?sub-(\d+)$/)?.[1]
  const term = input.replace(/^#/, '')
  return payments.filter(payment => (status === 'all' || (status === 'closed' ? closedPaymentStatuses.has(paymentStatus(payment)) : paymentStatus(payment) === status))
    && (paymentId ? String(payment.id) === paymentId : subscriptionId ? String(payment.subscriptionId) === subscriptionId
      : !term || [payment.id, payment.subscriptionId, payment.payOSOrderCode, payment.transactionReference, payment.packageName].some(value => String(value ?? '').toLowerCase().includes(term))))
}
