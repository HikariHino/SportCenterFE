import { getMembershipPackageById } from './membershipPackageService'
import { createMemberSubscription, createReceptionistMemberSubscription, getMySubscriptions, getReceptionistMemberSubscriptions, getSubscriptionUpgradePreview } from './memberSubscriptionService'
import { membershipPackageType, packageRegistrationReason, subscriptionPackageReason, subscriptionPurchaseTerms, subscriptionStatus, currentSubscriptionForPackage } from '../utils/memberSubscriptions.js'

export async function prepareSubscriptionPurchase(packageId, memberId) {
  const [pkg, subscriptions] = await Promise.all([
    getMembershipPackageById(packageId),
    memberId == null ? getMySubscriptions() : getReceptionistMemberSubscriptions(memberId),
  ])
  if (!pkg || String(pkg.id) !== String(packageId)) throw new Error('Không tìm thấy gói đã chọn. Vui lòng tải lại.')
  // Only legacy subscription responses need a catalog lookup to identify type.
  const currentPackageIds = [...new Set(subscriptions
    .filter(item => ['active', 'pending'].includes(subscriptionStatus(item)))
    .filter(item => !['Standard', 'PT'].includes(item.packageType))
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
  const preview = membershipPackageType(pkg) === 'Standard'
    ? await getSubscriptionUpgradePreview(packageId, memberId)
    : {
      canUpgrade: false, message: 'Gói PT được đăng ký độc lập, thanh toán nguyên giá và không khấu trừ gói Standard.',
      currentSubscriptionId: null, currentAgreedPrice: 0,
      targetPackageId: pkg.id, targetPackageName: pkg.packageName, targetPackagePrice: pkg.price,
      discountAmount: 0, amountToPay: pkg.price, newStartDate: null, newEndDate: null,
    }
  if (!Number.isFinite(Number(preview.amountToPay)) || Number(preview.amountToPay) <= 0) throw new Error('Giá gói tập không hợp lệ. Vui lòng tải lại.')
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
