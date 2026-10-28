export const paymentStatus = payment => String(payment?.status || '').trim().toLowerCase().replace(/[\s_-]/g, '').replace(/^canceled$/, 'cancelled')
export const closedPaymentStatuses = new Set(['cancelled', 'expired', 'failed', 'refunded'])
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
