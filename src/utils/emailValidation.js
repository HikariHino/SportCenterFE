export const ACCOUNT_EMAIL_MAX_LENGTH = 256

export function getAccountEmailValidationError(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Vui lòng nhập email.'
  if (value.length > ACCOUNT_EMAIL_MAX_LENGTH) return `Email không được vượt quá ${ACCOUNT_EMAIL_MAX_LENGTH} ký tự.`
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(value.trim()) ? '' : 'Email không hợp lệ.'
}
