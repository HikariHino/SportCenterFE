const duplicateEmail = 'Email đã được sử dụng. Vui lòng nhập email khác.'
const duplicatePhone = 'Số điện thoại đã được sử dụng. Vui lòng nhập số khác.'

export function getMemberContactConflicts(form, accounts) {
  const emailKey = value => typeof value === 'string' ? value.trim().toLowerCase() : ''
  const phoneKey = value => typeof value === 'string' ? value.trim().replace(/[\s().-]/g, '').replace(/^\+84/, '0') : ''
  const errors = {}
  if (emailKey(form.email) && accounts.some(account => emailKey(account.email) === emailKey(form.email))) errors.email = duplicateEmail
  if (phoneKey(form.phone) && accounts.some(account => phoneKey(account.phone ?? account.phoneNumber) === phoneKey(form.phone))) errors.phone = duplicatePhone
  return errors
}

export function getMemberRegistrationFieldErrors(error) {
  const result = {}
  const fields = ['fullName', 'email', 'password', 'phone', 'dateOfBirth', 'gender', 'address', 'fitnessGoal']
  for (const [key, value] of Object.entries(error?.fieldErrors || error?.response?.data?.errors || {})) {
    const name = key.split('.').at(-1).toLowerCase()
    const field = name === 'phonenumber' ? 'phone' : fields.find(item => item.toLowerCase() === name)
    const message = (Array.isArray(value) ? value : [value]).find(item => typeof item === 'string' && item.trim())
    if (field && message) result[field] = message
  }
  if (fields.includes(error?.field)) result[error.field] = error.message
  const message = error?.response?.data?.message || error?.message || ''
  const duplicate = /đã.*(?:sử dụng|tồn tại|đăng ký)|trùng|already.*(?:registered|used|exists|taken)|duplicate/i.test(message)
  if (duplicate && /email/i.test(message)) result.email = duplicateEmail
  if (duplicate && /số điện thoại|phone/i.test(message)) result.phone = duplicatePhone
  return result
}
