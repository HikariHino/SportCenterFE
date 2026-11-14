import { confirmReceptionistSubscriptionPayment, getReceptionistSubscriptionById } from './memberSubscriptionService'
import { createPayment, getPaymentById, isTemporaryPaymentError, syncPayment } from './paymentService'
import { getToken } from '../utils/auth'
import { paymentStatus } from '../utils/memberPayments'

const validId = value => /^[1-9]\d*$/.test(String(value)) && Number(value) <= 2147483647
const methods = ['PayOS', 'Cash', 'BankTransfer', 'CreditCard']
const checkouts = new Map()
const uncertainResult = 'Chưa xác nhận được kết quả thanh toán. Hãy tải lại đơn và biên nhận trước khi thử lại; không thu tiền lần nữa.'

export function getReceptionistPaymentError(error, fallback = 'Không thể xử lý thanh toán. Vui lòng thử lại.') {
  const body = error?.response?.data
  const message = body?.message || (body?.errors && Object.values(body.errors).flat()[0]) || error?.message
  if (/Key cannot be null|API.?key|checksum.?key|not configured/i.test(message || '')) {
    return 'Máy chủ chưa cấu hình đầy đủ PayOS. Vui lòng liên hệ quản trị kiểm tra cấu hình thanh toán rồi thử lại.'
  }
  if (typeof message !== 'string' || message.length > 400 || /LINQ|DbSet|System\.[A-Z]|Microsoft\.|stack\s*trace|could not be translated/i.test(message)) return fallback
  return message || fallback
}

export function receptionistCheckoutUrl(payment, now = Date.now()) {
  if (String(payment?.paymentMethod).toLowerCase() !== 'payos' || paymentStatus(payment) !== 'pending'
    || Number(payment.amountReceived || 0) !== 0
    || (payment.expiresAt && (!Number.isFinite(Date.parse(payment.expiresAt)) || Date.parse(payment.expiresAt) <= now))) return ''
  try {
    const url = new URL(payment.checkoutUrl)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''
  } catch { return '' }
}

/** Read the current order immediately before collecting money or requesting a PayOS link. */
export function checkoutReceptionistSubscription(input = {}) {
  const { subscriptionId, memberId, paymentMethod, amount, paymentReceived } = input
  if (!validId(subscriptionId) || !validId(memberId)) return Promise.reject(new Error('Vui lòng chọn hội viên và đơn đăng ký hợp lệ.'))
  if (!methods.includes(paymentMethod)) return Promise.reject(new Error('Phương thức thanh toán không hợp lệ.'))
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) return Promise.reject(new Error('Số tiền của đơn không hợp lệ.'))
  if (paymentMethod !== 'PayOS' && paymentReceived !== true) return Promise.reject(new Error('Vui lòng xác nhận đã thực nhận đủ tiền.'))
  const key = JSON.stringify([getToken(), String(subscriptionId)])
  if (checkouts.has(key)) return checkouts.get(key)
  const request = checkout(input).finally(() => checkouts.delete(key))
  checkouts.set(key, request)
  return request
}

async function checkout({ subscriptionId, memberId, paymentMethod, amount, paymentReceived }) {
  const subscription = await getReceptionistSubscriptionById(subscriptionId)
  if (String(subscription?.id) !== String(subscriptionId) || String(subscription.memberId) !== String(memberId)) throw new Error('Đơn đăng ký không khớp hội viên đã chọn. Vui lòng tải lại.')
  if (String(subscription.status).toLowerCase() !== 'pending') throw new Error('Đơn không còn chờ thanh toán. Vui lòng tải lại trạng thái.')
  if (Number(subscription.agreedPrice) !== Number(amount)) throw new Error('Giá đã chốt của đơn đã thay đổi. Vui lòng tải lại trước khi thu tiền.')
  if (!Array.isArray(subscription.payments)) throw new Error('Chưa tải đủ lịch sử thanh toán. Vui lòng tải lại đơn.')
  for (const payment of subscription.payments) {
    const status = paymentStatus(payment)
    if (['completed', 'needsreview'].includes(status) || Number(payment.amountReceived) > 0) throw new Error('Đơn đã có tiền hoặc cần đối soát. Vui lòng kiểm tra biên nhận trước khi thu tiếp.')
    if (status === 'pending' && (paymentMethod !== 'PayOS' || String(payment.paymentMethod).toLowerCase() !== 'payos')) throw new Error('Đơn đang có giao dịch chờ xử lý. Hãy đồng bộ hoặc hủy giao dịch đó trước khi thu tại quầy.')
    if (!['pending', 'cancelled', 'expired', 'failed'].includes(status)) throw new Error('Trạng thái biên nhận chưa xác định. Vui lòng kiểm tra trước khi thu tiền.')
  }
  try {
    const payment = paymentMethod === 'PayOS'
      ? await createPayment(Number(subscriptionId))
      : await confirmReceptionistSubscriptionPayment(subscriptionId, { amount: Number(amount), paymentMethod, paymentReceived })
    if (String(payment.subscriptionId) !== String(subscriptionId) || Number(payment.amount) !== Number(amount)
      || (paymentMethod === 'PayOS' && String(payment.memberId) !== String(memberId))) throw new Error(uncertainResult)
    return payment
  } catch (error) {
    const transportError = error.response ? error : error.cause || error
    const uncertain = !transportError.response || isTemporaryPaymentError(transportError)
    const message = getReceptionistPaymentError(error)
    const wrapped = new Error(/cấu hình.*PayOS/.test(message) ? message : uncertain ? uncertainResult : message, { cause: error })
    wrapped.requiresRefresh = true
    throw wrapped
  }
}

function validatePaymentResult(result, expected) {
  if (!result || String(result.id) !== String(expected.id) || String(result.memberId) !== String(expected.memberId)
    || String(result.subscriptionId) !== String(expected.subscriptionId)
    || String(result.payOSOrderCode) !== String(expected.payOSOrderCode)
    || String(result.paymentMethod).toLowerCase() !== 'payos'
    || Number(result.amount) !== Number(expected.amount)
    || !['pending', 'completed', 'cancelled', 'expired', 'failed', 'needsreview'].includes(paymentStatus(result))) {
    throw new Error('Kết quả đồng bộ không khớp giao dịch. Vui lòng tải lại chi tiết.')
  }
  return result
}

export async function syncReceptionistPayment(payment) {
  if (!validId(payment?.id) || String(payment.paymentMethod).toLowerCase() !== 'payos') throw new Error('Giao dịch không hỗ trợ đồng bộ PayOS.')
  try {
    return { payment: validatePaymentResult(await syncPayment(payment.id), payment), warning: '' }
  } catch (error) {
    if (!isTemporaryPaymentError(error)) throw error
    // A webhook may have committed even if the sync response was lost.
    const current = validatePaymentResult(await getPaymentById(payment.id), payment)
    return { payment: current, warning: paymentStatus(current) === 'completed' ? '' : 'Chưa đồng bộ được với PayOS. Đang hiển thị trạng thái đã lưu; hãy thử lại, không thu tiền thêm.' }
  }
}
