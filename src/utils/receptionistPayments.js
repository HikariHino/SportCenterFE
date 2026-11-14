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


/** Pending subscriptions are orders, not payment receipts: never invent a transaction ID or method. */
export function getReceptionistPendingCounterOrders(orders, payments = [], { query = '', status = 'all', method = 'all' } = {}) {
  if (!['all', 'pending'].includes(status) || !['all', 'cash', 'banktransfer', 'creditcard'].includes(method)) return []
  const term = query.trim().replace(/^#(?:sub-)?/i, '').toLocaleLowerCase('vi')
  return orders.filter(order => String(order.status).toLowerCase() === 'pending')
    .flatMap(order => {
      const receipts = [...(Array.isArray(order.payments) ? order.payments : []), ...payments.filter(payment => String(payment.subscriptionId) === String(order.id))]
      // Active gateway requests belong to payment history; never offer an alternative collection.
      if (receipts.some(receipt => ['completed', 'paid'].includes(paymentStatus(receipt))
        || (paymentStatus(receipt) === 'pending' && String(receipt.paymentMethod).toLowerCase() === 'payos'))) return []
      const blockedReason = !Array.isArray(order.payments) ? 'Chưa tải đủ biên nhận. Hãy tải lại.'
        : receipts.some(receipt => paymentStatus(receipt) === 'needsreview' || Number(receipt.amountReceived) > 0) ? 'Đơn cần đối soát, không thu thêm tiền.'
        : receipts.some(receipt => !['cancelled', 'expired', 'failed'].includes(paymentStatus(receipt))) ? 'Đơn còn biên nhận cần kiểm tra. Hãy tải lại trạng thái.'
        : !Number.isFinite(Number(order.agreedPrice)) || Number(order.agreedPrice) <= 0 ? 'Số tiền của đơn không hợp lệ.' : ''
      return [{ ...order, blockedReason }]
    })
    .filter(order => !term || [order.id, order.memberId, order.packageName, order.memberName, order.memberPhone, order.memberEmail]
      .some(value => String(value ?? '').toLocaleLowerCase('vi').includes(term)))
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0) || Number(b.id) - Number(a.id))
}
