export function canUseCoachDemo(search, isDevelopment) {
  if (!isDevelopment) return false
  return new URLSearchParams(search).get('demo') === 'coach'
}

export function isCoachDemoLocation(location, isDevelopment) {
  return location?.pathname === '/coach' && canUseCoachDemo(location.search, isDevelopment)
}

export function getCoachPlanDemoStudent(search, isDevelopment) {
  const params = new URLSearchParams(search)
  if (!canUseCoachDemo(search, isDevelopment) || params.get('planDemo') !== 'ai') return null
  return { memberId: 'DEMO', name: 'Học viên Demo', isDemo: true }
}
