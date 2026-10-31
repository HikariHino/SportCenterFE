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

// Explicit API types take precedence; names are only for legacy responses.
export function membershipPackageType(pkg) {
  if (String(pkg?.packageType || '').trim().toLowerCase() === 'pt') return 'PT'
  if (String(pkg?.packageType || '').trim().toLowerCase() === 'standard') return 'Standard'
  const name = String(pkg?.packageName || '').toLowerCase()
  const description = String(pkg?.description || '').toLowerCase()
  return name.includes('pt') || ['pt', 'huấn luyện viên', '1-1'].some(text => description.includes(text)) ? 'PT' : 'Standard'
}

export const membershipPackageTypeLabel = pkg => membershipPackageType(pkg) === 'PT' ? 'PT 1-1' : 'Standard'

export function currentSubscriptionForPackage(pkg, subscriptions, packages = [], now = Date.now()) {
  const type = membershipPackageType(pkg)
  return subscriptions.find(item => subscriptionStatus(item, now) === 'active' && subscriptionPackageType(item, packages) === type)
}

export function subscriptionPackageType(item, packages = []) {
  if (['standard', 'pt'].includes(String(item?.packageType || '').trim().toLowerCase())) return membershipPackageType(item)
  return membershipPackageType({ ...item, ...packages.find(candidate => String(candidate.id) === String(item.packageId)) })
}

// An upgraded subscription's agreedPrice may be only the upgrade surcharge.
// Compare package tiers against the full current package price as well.
export function subscriptionPackageValue(item, packages = []) {
  const currentPackage = packages.find(pkg => String(pkg.id) === String(item.packageId))
  const packagePrice = Number(currentPackage?.price)
  const agreedPrice = Number(item.agreedPrice)
  if (!Number.isFinite(packagePrice) || packagePrice <= 0 || !Number.isFinite(agreedPrice) || agreedPrice <= 0) return null
  return Math.max(packagePrice, agreedPrice)
}

export function subscriptionPackageReason(pkg, subscriptions, packages = [], now = Date.now()) {
  const unavailable = subscriptionRegistrationReason(subscriptions, now) || packageRegistrationReason(pkg)
  if (unavailable) return unavailable
  if (subscriptions.some(item => String(item.packageId) === String(pkg.id) && subscriptionStatus(item, now) === 'pending')) {
    return 'Bạn đã có đơn chờ thanh toán cho gói này. Vui lòng thanh toán hoặc hủy đơn đó.'
  }
  if (subscriptions.some(item => String(item.packageId) === String(pkg.id) && subscriptionStatus(item, now) === 'active'
    && subscriptionPackageType(item, packages) === membershipPackageType(pkg))) {
    return membershipPackageType(pkg) === 'PT'
      ? 'Bạn đã có gói PT này đang hoạt động. Không thể đăng ký thêm gói đang dùng.'
      : 'Bạn đang sử dụng gói Standard này. Chỉ có thể nâng cấp lên gói cao hơn, không thể đăng ký thêm gói hiện tại.'
  }
  if (membershipPackageType(pkg) === 'PT') {
    return ''
  }
  if (subscriptions.some(item => subscriptionStatus(item, now) === 'pending'
    && subscriptionPackageType(item, packages) === 'Standard')) {
    return 'Bạn đã có đơn gói Standard chờ thanh toán. Vui lòng thanh toán hoặc hủy đơn đó trước khi chọn gói Standard khác.'
  }
  const current = subscriptions.filter(item => subscriptionStatus(item, now) === 'active'
    && subscriptionPackageType(item, packages) === 'Standard')
  for (const item of current) {
    const currentPrice = subscriptionPackageValue(item, packages)
    if (!Number.isFinite(Number(pkg.price)) || Number(pkg.price) <= 0 || !Number.isFinite(currentPrice) || currentPrice <= 0) {
      return 'Chưa xác định được giá trị gói hiện tại. Vui lòng tải lại trước khi nâng cấp.'
    }
    if (Number(pkg.price) <= currentPrice) return 'Chỉ có thể nâng cấp Standard lên gói có giá trị cao hơn gói đang dùng. Không thể hạ gói hoặc đăng ký gói ngang giá.'
  }
  return ''
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
