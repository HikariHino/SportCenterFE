export function sessionEnrollmentCount(session) {
  const values = [session?.currentEnrollment, session?.enrolledCount, session?.registeredCount]
    .filter(value => value != null && value !== '')
    .map(value => typeof value === 'number' || (typeof value === 'string' && value.trim()) ? Number(value) : NaN)
  const positive = values.filter(value => Number.isInteger(value) && value > 0)
  if (positive.length) return Math.max(...positive)
  return values.length && values.every(value => Number.isInteger(value) && value >= 0) ? Math.max(...values) : null
}
