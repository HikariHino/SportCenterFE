import { getAuthDestination, isManagerRole } from './auth.js'

export function getLandingAction(user, view = 'classes', packageId) {
  const query = new URLSearchParams({ view })
  if (view === 'subscriptions') {
    query.set('catalog', '1')
    if (Number.isSafeInteger(Number(packageId)) && Number(packageId) > 0) query.set('packageId', String(packageId))
  }
  if (view === 'classes') query.set('browse', '1')
  const memberPath = `/member?${query}`
  if (!user) return { to: '/login', state: { from: memberPath } }
  if (user.role === 'member') return { to: memberPath }
  if (isManagerRole(user.role)) {
    const sections = { classes: 'classes', subscriptions: 'packages', payments: 'frontdesk', checkin: 'frontdesk', support: 'frontdesk' }
    return { to: `/manager?view=${sections[view] || 'overview'}` }
  }
  if (user.role === 'receptionist') {
    const sections = { classes: 'Buổi học', subscriptions: 'Hội viên', payments: 'Thanh toán', checkin: 'Check-in', support: 'Hỗ trợ' }
    return { to: `/receptionist?${new URLSearchParams({ view: sections[view] || 'Tổng quan' })}` }
  }
  const destination = getAuthDestination(user.role)
  return { to: destination === '/' ? '/login' : destination }
}

export function getLandingPortal(user) {
  if (!user) return { to: '/register', label: 'Trở thành hội viên' }
  const labels = { member: 'Cổng hội viên', coach: 'Cổng huấn luyện viên', receptionist: 'Cổng lễ tân' }
  const to = getAuthDestination(user.role)
  return { to: to === '/' ? '/login' : to, label: isManagerRole(user.role) ? 'Quản lý trung tâm' : labels[user.role] || 'Đăng nhập hội viên' }
}
