export const PROFILE_FULL_NAME_MAX_LENGTH = 60
export const PROFILE_PHONE_LENGTH = 10

export function getFullNameValidationError(value) {
  const fullName = String(value || '').trim()
  if (!fullName) return 'Họ và tên không được để trống.'
  if ([...fullName].length > PROFILE_FULL_NAME_MAX_LENGTH) return `Họ và tên không được vượt quá ${PROFILE_FULL_NAME_MAX_LENGTH} ký tự.`
  return ''
}

export function getVietnamPhoneValidationError(value, { required = false } = {}) {
  const phoneNumber = String(value || '').trim()
  if (!phoneNumber) return required ? 'Số điện thoại không được để trống.' : ''
  if (!/^0[0-9]{9}$/.test(phoneNumber)) return 'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng 0.'
  return ''
}

export function getEmailValidationError(value) {
  const email = String(value || '').trim()
  if (!email) return 'Email không được để trống.'
  if (!/^[^\s@]+@[^\s@]+\.com$/i.test(email)) return 'Email phải có @ và kết thúc bằng .com.'
  return ''
}
