export function subscriptionStatus(subscription, now = Date.now()) {
  const status = String(subscription?.status || '').trim().toLowerCase()
  if (status === 'canceled') return 'cancelled'
  const end = Date.parse(subscription?.endDate)
  if (status === 'active' && Number.isFinite(end) && end <= now) return 'expired'
  return status
}

export function subscriptionStatusLabel(subscription, now = Date.now()) {
  return { active: 'Đang hiệu lực', pending: 'Chờ thanh toán', expired: 'Đã hết hạn', cancelled: 'Đã hủy', upgraded: 'Đã nâng cấp' }[subscriptionStatus(subscription, now)] || subscription?.status || 'Chưa cập nhật'
}

// A cancelled payment link does not itself cancel the subscription in BE.
export function subscriptionPaymentState(subscription) {
  if (subscriptionStatus(subscription) !== 'pending' || !Array.isArray(subscription?.payments) || !subscription.payments.length) return ''
  const normalize = payment => String(payment.status || '').trim().toLowerCase().replace(/^canceled$/, 'cancelled')
  if (subscription.payments.some(item => normalize(item) === 'needsreview')) return 'needsreview'
  if (subscription.payments.some(item => ['completed', 'paid'].includes(normalize(item)))) return 'completed'
  if (subscription.payments.some(item => normalize(item) === 'pending')) return 'pending'
  const latest = [...subscription.payments].sort((a, b) => Number(b.id) - Number(a.id))[0]
  return ['cancelled', 'expired', 'failed'].includes(normalize(latest)) ? normalize(latest) : ''
}

export function subscriptionDisplayStatusLabel(subscription, now = Date.now()) {
  const payment = subscriptionPaymentState(subscription)
  return subscriptionStatus(subscription, now) === 'pending'
    ? { cancelled: 'Đã hủy thanh toán', expired: 'Thanh toán hết hạn', failed: 'Thanh toán thất bại', needsreview: 'Thanh toán cần đối soát', completed: 'Đã thanh toán · Chờ kích hoạt' }[payment] || subscriptionStatusLabel(subscription, now)
    : subscriptionStatusLabel(subscription, now)
}

export function mergeConfirmedSubscriptionCancellations(subscriptions, confirmed) {
  return subscriptions.map(item => {
    const cancelled = confirmed.get(String(item.id))
    return cancelled && subscriptionStatus(item) === 'pending' && subscriptionStatus(cancelled) === 'cancelled'
      ? { ...item, ...cancelled } : item
  })
}

export function subscriptionRegistrationReason(subscriptions, now = Date.now()) {
  if (!Array.isArray(subscriptions)) return 'Chưa thể kiểm tra gói đã đăng ký. Vui lòng tải lại trước khi đăng ký gói mới.'
  if (subscriptions.some(item => !['active', 'pending', 'expired', 'cancelled', 'upgraded'].includes(subscriptionStatus(item, now)))) return 'Chưa xác định được trạng thái gói đã đăng ký. Vui lòng làm mới trước khi đăng ký gói mới.'
  return ''
}

export function packageRegistrationReason(pkg) {
  if (!pkg?.id) return 'Chưa có thông tin gói để đăng ký.'
  if (pkg.isActive === false) return 'Gói tập này đang tạm ngừng đăng ký.'
  return ''
}

// Match PackageTypeHelper in BE: type is derived from the name and description.
export function membershipPackageType(pkg) {
  const name = String(pkg?.packageName || '').toLowerCase()
  const description = String(pkg?.description || '').toLowerCase()
  return name.includes('pt') || ['pt', 'huấn luyện viên', '1-1'].some(text => description.includes(text)) ? 'PT' : 'Standard'
}

export const membershipPackageTypeLabel = pkg => membershipPackageType(pkg) === 'PT' ? 'PT 1-1' : 'Standard'

export function currentSubscriptionForPackage(pkg, subscriptions, packages = [], now = Date.now()) {
  const type = membershipPackageType(pkg)
  return subscriptions.find(item => subscriptionStatus(item, now) === 'active' && membershipPackageType({
    ...item, ...packages.find(candidate => String(candidate.id) === String(item.packageId)),
  }) === type)
}

export function subscriptionPackageReason(pkg, subscriptions, packages = [], now = Date.now()) {
  const unavailable = subscriptionRegistrationReason(subscriptions, now) || packageRegistrationReason(pkg)
  if (unavailable) return unavailable
  if (subscriptions.some(item => String(item.packageId) === String(pkg.id) && subscriptionStatus(item, now) === 'pending')) {
    return 'Bạn đã có đơn chờ thanh toán cho gói này. Vui lòng thanh toán hoặc hủy đơn đó.'
  }
  if (membershipPackageType(pkg) === 'PT') {
    return subscriptions.some(item => String(item.packageId) === String(pkg.id) && subscriptionStatus(item, now) === 'active')
      ? 'Bạn đã có gói PT này đang hoạt động.' : ''
  }
  const current = currentSubscriptionForPackage(pkg, subscriptions, packages, now)
  // When the old package is no longer in the catalog, its description may be
  // unavailable in SubscriptionDTO. Let the BE preview determine its type.
  const knownCurrent = current && packages.some(item => String(item.id) === String(current.packageId))
  return knownCurrent && Number(pkg.price) <= Number(current.agreedPrice)
    ? 'Chỉ có thể nâng cấp Standard lên gói có giá trị cao hơn gói đang dùng.' : ''
}

export function subscriptionPurchaseTerms({ pkg, preview }) {
  return JSON.stringify([
    pkg.id, membershipPackageType(pkg), pkg.durationInDays, preview.canUpgrade,
    preview.currentSubscriptionId, preview.currentAgreedPrice, preview.targetPackageId,
    preview.targetPackagePrice, preview.discountAmount, preview.amountToPay,
    // New purchases start at payment time; preview timestamps naturally move.
    ...(preview.canUpgrade ? [preview.newStartDate, preview.newEndDate] : []),
  ])
}
