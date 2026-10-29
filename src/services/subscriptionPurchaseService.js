import { getMembershipPackageById } from './membershipPackageService'
import { createMemberSubscription, createReceptionistMemberSubscription, getMySubscriptions, getReceptionistMemberSubscriptions, getSubscriptionUpgradePreview } from './memberSubscriptionService'
import { membershipPackageType, packageRegistrationReason, subscriptionPackageReason, subscriptionPurchaseTerms } from '../utils/memberSubscriptions.js'

export async function prepareSubscriptionPurchase(packageId, memberId) {
  const [pkg, subscriptions, preview] = await Promise.all([
    getMembershipPackageById(packageId),
    memberId == null ? getMySubscriptions() : getReceptionistMemberSubscriptions(memberId),
    getSubscriptionUpgradePreview(packageId, memberId),
  ])
  if (!pkg || String(pkg.id) !== String(packageId)) throw new Error('Không tìm thấy gói đã chọn. Vui lòng tải lại.')
  let reason = subscriptionPackageReason(pkg, subscriptions)
  if (membershipPackageType(pkg) === 'Standard' && preview.currentSubscriptionId != null && !preview.canUpgrade) {
    reason = preview.message || 'Chỉ có thể nâng cấp lên gói Standard có giá trị cao hơn.'
  }
  return { pkg, subscriptions, preview, memberId, reason: packageRegistrationReason(pkg) || reason }
}

// Only the package ID is submitted. Prices, credits and activation dates belong
// to BE; never send a locally calculated amount as the purchase terms.
export async function createReviewedSubscription(purchase) {
  const fresh = await prepareSubscriptionPurchase(purchase.pkg.id, purchase.memberId)
  if (fresh.reason) return { purchase: fresh, changed: true }
  if (subscriptionPurchaseTerms(fresh) !== subscriptionPurchaseTerms(purchase)) return { purchase: fresh, changed: true }
  const subscription = fresh.memberId == null
    ? await createMemberSubscription(fresh.pkg.id)
    : await createReceptionistMemberSubscription(fresh.memberId, fresh.pkg.id)
  if (!subscription?.id) throw new Error('Chưa xác nhận được đơn đăng ký. Vui lòng tải lại danh sách trước khi thử lại.')
  return { purchase: fresh, subscription, changed: false }
}
