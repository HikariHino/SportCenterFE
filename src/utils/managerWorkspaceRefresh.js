export function managerRefreshInterval(key) {
  return /^(overview|today-checkins|members|payments|classes|class-sessions|attendance|subscriptions|roster)(:|$)/.test(key) ? 10000 : 30000
}

export function managerRelatedResources(key) {
  if (key === 'staff') return ['coaches', 'overview']
  if (key === 'rooms') return ['classes', 'overview']
  if (key === 'packages') return ['public-packages', 'overview']
  if (key === 'classes') return ['report-classes', 'overview', 'booking-classes', 'attendance:classes', 'class-sessions:*']
  if (key === 'members') return ['overview']
  if (key === 'today-checkins') return ['overview', 'today-checkins:history:*']
  if (key === 'payments') return ['overview', 'subscriptions:*']
  return []
}

export function watchManagerResource(refresh, interval, { viewport = window, document = globalThis.document } = {}) {
  const visible = () => { if (document.visibilityState === 'visible') refresh() }
  const timer = viewport.setInterval(visible, interval)
  viewport.addEventListener('focus', visible)
  document.addEventListener('visibilitychange', visible)
  return () => { viewport.clearInterval(timer); viewport.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible) }
}
