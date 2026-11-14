import { paymentStatus } from './memberPayments.js'

export const receptionistPaymentStatuses = [
  ['all', 'Tất cả'], ['completed', 'Thành công'], ['pending', 'Chờ thanh toán'], ['needsreview', 'Cần đối soát'],
  ['cancelled', 'Đã hủy'], ['expired', 'Hết hạn'], ['failed', 'Thất bại'], ['refunded', 'Hoàn tiền'],
]
export const receptionistPaymentMethods = [['all', 'Mọi phương thức'], ['payos', 'PayOS'], ['cash', 'Tiền mặt'], ['banktransfer', 'Chuyển khoản'], ['creditcard', 'Thẻ tín dụng']]
export const receptionistPaymentMethodLabel = method => receptionistPaymentMethods.find(([key]) => key === String(method).toLowerCase())?.[1] || method || 'Chưa có'

export function filterReceptionistPayments(payments, { query = '', status = 'all', method = 'all' } = {}) {
  const term = query.trim().replace(/^#/, '').toLocaleLowerCase('vi')
  return payments.filter(payment => (status === 'all' || paymentStatus(payment) === status)
    && (method === 'all' || String(payment.paymentMethod).toLowerCase() === method)
    && (!term || [payment.id, payment.memberId, payment.subscriptionId, payment.payOSOrderCode, payment.transactionReference, payment.packageName, payment.memberName]
      .some(value => String(value ?? '').toLocaleLowerCase('vi').includes(term))))
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0) || Number(b.id) - Number(a.id))
}
