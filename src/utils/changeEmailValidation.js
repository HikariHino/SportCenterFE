import { getAccountEmailValidationError } from './emailValidation.js'

export const normalizeChangeEmail = value => String(value || '').trim().toLowerCase()

// Coach and Receptionist accept the same domain formats as the registration
// email input. Other account forms keep their existing validation policy.
export function getStaffEmailValidationError(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Email không được để trống.'
  const email = value.trim()
  if (email.length > 254 || !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(email)) return 'Email không hợp lệ.'
  return getAccountEmailValidationError(email)
}

export function changeEmailError(value, currentEmail, rejectedEmails = new Map()) {
  const email = normalizeChangeEmail(value)
  if (!email) return 'Vui lòng nhập email mới.'
  if (getStaffEmailValidationError(email)) return 'Email không hợp lệ.'
  if (email === normalizeChangeEmail(currentEmail)) return 'Email mới phải khác email hiện tại.'
  return rejectedEmails.get(email) || ''
}

export function isChangeEmailConflict(error) {
  const body = error?.response?.data
  if (Number(error?.response?.status) === 409 || Number(body?.statusCode) === 409) return true
  const fieldMessages = Object.entries(body?.errors || {}).filter(([key]) => /email/i.test(key)).flatMap(([, value]) => Array.isArray(value) ? value : [value])
  const message = [body?.message, error?.message, ...fieldMessages].filter(value => typeof value === 'string').join(' ')
  return (/email/i.test(message) || fieldMessages.length > 0) && /đã.*(?:sử dụng|đăng ký|tồn tại)|trùng|already.*(?:in use|used|registered|exists|taken)|duplicate/i.test(message)
}
