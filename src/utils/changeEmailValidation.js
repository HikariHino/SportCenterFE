export const normalizeChangeEmail = value => String(value || '').trim().toLowerCase()

export function changeEmailError(value, currentEmail, rejectedEmails = new Map()) {
  const email = normalizeChangeEmail(value)
  if (!email) return 'Vui lòng nhập email mới.'
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(email)) return 'Email không hợp lệ.'
  if (email === normalizeChangeEmail(currentEmail)) return 'Email mới phải khác email hiện tại.'
  return rejectedEmails.get(email) || ''
}

export function isChangeEmailConflict(error) {
  const body = error?.response?.data
  if (Number(error?.response?.status) === 409 || Number(body?.statusCode) === 409) return true
  const message = body?.message || error?.message || ''
  return /email/i.test(message) && /đã (?:được )?(?:sử dụng|đăng ký)|already (?:in use|used|registered|exists|taken)/i.test(message)
}
