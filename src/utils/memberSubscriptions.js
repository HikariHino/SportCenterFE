export function subscriptionStatus(subscription, now = Date.now()) {
  const status = String(subscription?.status || '').trim().toLowerCase()
  if (status === 'canceled') return 'cancelled'
  const end = Date.parse(subscription?.endDate)
  if (status === 'active' && Number.isFinite(end) && end < now) return 'expired'
  return status
}

export function subscriptionStatusLabel(subscription, now = Date.now()) {
  return { active: 'Đang hiệu lực', pending: 'Chờ thanh toán', expired: 'Đã hết hạn', cancelled: 'Đã hủy' }[subscriptionStatus(subscription, now)] || subscription?.status || 'Chưa cập nhật'
}

export function subscriptionRegistrationReason(subscriptions, now = Date.now()) {
  if (!Array.isArray(subscriptions)) return 'Chưa thể kiểm tra gói đã đăng ký. Vui lòng tải lại trước khi đăng ký gói mới.'
  if (subscriptions.some(item => subscriptionStatus(item, now) === 'active')) return 'Gói tập của bạn vẫn còn hiệu lực. Tạm thời chưa thể đăng ký thêm gói.'
  if (subscriptions.some(item => subscriptionStatus(item, now) === 'pending')) return 'Bạn đã có đơn chờ thanh toán. Vui lòng thanh toán hoặc hủy đơn trước khi đăng ký gói khác.'
  if (subscriptions.some(item => !['active', 'pending', 'expired', 'cancelled'].includes(subscriptionStatus(item, now)))) return 'Chưa xác định được trạng thái gói đã đăng ký. Vui lòng làm mới trước khi đăng ký gói mới.'
  return ''
}

export function packageRegistrationReason(pkg) {
  if (!pkg?.id) return 'Chưa có thông tin gói để đăng ký.'
  if (pkg.isActive === false) return 'Gói tập này đang tạm ngừng đăng ký.'
  return ''
}
