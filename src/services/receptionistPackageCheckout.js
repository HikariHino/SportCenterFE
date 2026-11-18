import { getMembershipPackages } from './membershipPackageService'
import { createReceptionistMemberSubscription, getReceptionistMemberSubscriptions, getReceptionistSubscriptionById } from './memberSubscriptionService'
import { loadSubscriptionPackageReferences, prepareSubscriptionPurchase } from './subscriptionPurchaseService'
import { subscriptionPackageReason, subscriptionPurchaseTerms, subscriptionStatus } from '../utils/memberSubscriptions'
import { getToken } from '../utils/auth'
import { checkoutReceptionistSubscription } from './receptionistPaymentService'

const validId = value => /^[1-9]\d*$/.test(String(value)) && Number(value) <= 2147483647
const creating = new Map()

function validateSubscriptions(items, memberId) {
  if (!Array.isArray(items) || items.some(item => !validId(item?.id) || String(item.memberId) !== String(memberId))) {
    throw new Error('Dữ liệu đăng ký không khớp hội viên. Vui lòng tải lại.')
  }
  return items
}

export async function loadReceptionistPackageOptions(memberId) {
  if (!validId(memberId)) throw new Error('Vui lòng chọn hội viên hợp lệ.')
  const [catalog, items] = await Promise.all([getMembershipPackages(), getReceptionistMemberSubscriptions(memberId)])
  const subscriptions = validateSubscriptions(items, memberId)
  const packages = await loadSubscriptionPackageReferences(subscriptions, catalog)
  return catalog.map(pkg => ({ ...pkg, disabledReason: subscriptionPackageReason(pkg, subscriptions, packages)
    || (!Number.isFinite(Number(pkg.price)) || Number(pkg.price) <= 0 ? 'Giá gói tập không hợp lệ.' : '') }))
}

export async function prepareReceptionistPackageCheckout(packageId, memberId) {
  if (!validId(memberId) || !validId(packageId)) throw new Error('Vui lòng chọn hội viên và gói tập hợp lệ.')
  const purchase = await prepareSubscriptionPurchase(packageId, memberId)
  validateSubscriptions(purchase.subscriptions, memberId)
  return purchase
}

export function createReceptionistCheckoutOrder(purchase) {
  const key = JSON.stringify([getToken(), purchase?.memberId, purchase?.pkg?.id])
  if (creating.has(key)) return creating.get(key)
  const request = createOrder(purchase).finally(() => creating.delete(key))
  creating.set(key, request)
  return request
}

async function createOrder(purchase) {
  if (!purchase || !validId(purchase.memberId) || !validId(purchase.pkg?.id)) throw new Error('Thông tin gói tập chưa sẵn sàng.')
  const fresh = await prepareReceptionistPackageCheckout(purchase.pkg.id, purchase.memberId)
  if (fresh.reason || subscriptionPurchaseTerms(fresh) !== subscriptionPurchaseTerms(purchase)) return { changed: true, purchase: fresh }
  const order = await createReceptionistMemberSubscription(fresh.memberId, fresh.pkg.id)
  if (!validId(order?.id) || String(order.memberId) !== String(purchase.memberId) || String(order.packageId) !== String(purchase.pkg.id)
    || subscriptionStatus(order) !== 'pending' || Number(order.agreedPrice) !== Number(fresh.preview.amountToPay)) {
    throw new Error('Chưa xác nhận được đơn đúng hội viên, gói tập và số tiền. Hãy tải lại trạng thái trước khi tiếp tục.')
  }
  return { changed: false, purchase: fresh, subscription: order }
}

export async function checkoutReceptionistPackageOrder(input) {
  const { memberId, packageId, subscriptionId } = input
  if (![memberId, packageId, subscriptionId].every(validId)) throw new Error('Hội viên, gói hoặc đơn đăng ký không hợp lệ.')
  const [catalog, items] = await Promise.all([getMembershipPackages(), getReceptionistMemberSubscriptions(memberId)])
  const subscriptions = validateSubscriptions(items, memberId)
  const order = subscriptions.find(item => String(item.id) === String(subscriptionId))
  if (!order || String(order.packageId) !== String(packageId)) throw new Error('Đơn đăng ký không khớp gói tập đã chọn.')
  const pkg = catalog.find(item => String(item.id) === String(packageId))
  if (!pkg) throw new Error('Gói đã chọn không còn trong danh mục. Hãy kiểm tra lại trước khi thanh toán.')
  const others = subscriptions.filter(item => String(item.id) !== String(subscriptionId))
  const packages = await loadSubscriptionPackageReferences(others, catalog)
  const reason = subscriptionPackageReason(pkg, others, packages)
  if (reason) throw new Error(reason)
  return checkoutReceptionistSubscription(input)
}

export async function recoverReceptionistCheckoutOrder(memberId, packageId) {
  if (!validId(memberId) || !validId(packageId)) throw new Error('Thông tin hội viên hoặc gói tập không hợp lệ.')
  const items = validateSubscriptions(await getReceptionistMemberSubscriptions(memberId), memberId)
  const candidates = items.filter(item => String(item.packageId) === String(packageId) && subscriptionStatus(item) === 'pending')
  if (candidates.length > 1) throw new Error('Có nhiều đơn đang chờ cho gói này. Hãy kiểm tra danh sách thanh toán trước khi tiếp tục.')
  if (!candidates.length) return null
  const order = await getReceptionistSubscriptionById(candidates[0].id)
  if (String(order?.memberId) !== String(memberId) || String(order.packageId) !== String(packageId) || String(order.id) !== String(candidates[0].id)
    || subscriptionStatus(order) !== 'pending' || !Array.isArray(order.payments) || !Number.isFinite(Number(order.agreedPrice)) || Number(order.agreedPrice) <= 0) {
    throw new Error('Đơn đã thay đổi. Hãy kiểm tra danh sách thanh toán trước khi tiếp tục.')
  }
  return order
}
