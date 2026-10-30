import { getMembershipPackageById } from './membershipPackageService'
import { createMemberSubscription, createReceptionistMemberSubscription, getMySubscriptions, getReceptionistMemberSubscriptions, getSubscriptionUpgradePreview } from './memberSubscriptionService'
import { membershipPackageType, packageRegistrationReason, subscriptionPackageReason, subscriptionPurchaseTerms, subscriptionStatus, currentSubscriptionForPackage } from '../utils/memberSubscriptions.js'

export async function prepareSubscriptionPurchase(packageId, memberId) {
  const [pkg, subscriptions, preview] = await Promise.all([
    getMembershipPackageById(packageId),
    memberId == null ? getMySubscriptions() : getReceptionistMemberSubscriptions(memberId),
    getSubscriptionUpgradePreview(packageId, memberId),
  ])
  if (!pkg || String(pkg.id) !== String(packageId)) throw new Error('Không tìm thấy gói đã chọn. Vui lòng tải lại.')
  // SubscriptionDTO omits descriptions and full prices. Resolve current packages
  // so an earlier upgrade's partial payment cannot make a downgrade look valid.
  const currentPackageIds = [...new Set(subscriptions
    .filter(item => ['active', 'pending'].includes(subscriptionStatus(item)))
    .map(item => String(item.packageId)))]
  const packages = await Promise.all(currentPackageIds.map(async id => {
    if (id === String(pkg.id)) return pkg
    const currentPackage = await getMembershipPackageById(id)
    if (!currentPackage || String(currentPackage.id) !== id || !Number.isFinite(Number(currentPackage.price))
      || Number(currentPackage.price) <= 0 || !Number.isInteger(Number(currentPackage.durationInDays)) || Number(currentPackage.durationInDays) <= 0) {
      throw new Error('Chưa tải được thông tin gói hiện tại. Vui lòng tải lại trước khi đăng ký.')
    }
    return currentPackage
  }))
  let reason = subscriptionPackageReason(pkg, subscriptions, packages)
  const current = currentSubscriptionForPackage(pkg, subscriptions, packages)
  if (!reason && membershipPackageType(pkg) === 'Standard'
    && ((current && (!preview.canUpgrade || String(preview.currentSubscriptionId) !== String(current.id)))
      || (!current && preview.canUpgrade))) {
    reason = 'Trung tâm chưa xác nhận nâng cấp từ gói Standard đang dùng. Vui lòng tải lại; không thể đăng ký thêm gói Standard song song.'
  }
  if (!reason && membershipPackageType(pkg) === 'Standard' && preview.currentSubscriptionId != null && !preview.canUpgrade) {
    reason = preview.message || 'Chỉ có thể nâng cấp lên gói Standard có giá trị cao hơn.'
  }
  if (!reason && membershipPackageType(pkg) === 'Standard' && current && Number.isFinite(Date.parse(current.endDate))
    && Date.parse(preview.newEndDate) < Date.parse(current.endDate)) {
    reason = 'Ngày hết hạn sau nâng cấp không được sớm hơn ngày hết hạn của gói Standard hiện tại.'
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
