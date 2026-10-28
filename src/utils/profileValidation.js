export const PROFILE_LIMITS = { fullName: 200, phoneNumber: 30, gender: 10, address: 500, fitnessGoal: 100, emergencyContact: 100 }
const labels = { fullName: 'Họ và tên', phoneNumber: 'Số điện thoại', gender: 'Giới tính', address: 'Địa chỉ thường trú', fitnessGoal: 'Mục tiêu tập luyện', emergencyContact: 'Liên hệ khẩn cấp' }
const fields = [...Object.keys(PROFILE_LIMITS), 'dateOfBirth', 'password', 'currentPassword']

export const normalizeProfilePhone = value => value.trim().replace(/[\s().-]/g, '')
// Compare equivalent local/+84 forms without changing the API's phone format.
export function getProfilePhoneConflict(value, conflict) {
  const key = phone => typeof phone === 'string' ? normalizeProfilePhone(phone).replace(/^\+84/, '0') : ''
  return conflict?.phoneNumber && key(value) === key(conflict.phoneNumber) ? conflict.message : undefined
}
// Match ProfileService's DateTime.UtcNow.Date comparison and the stored date-only value.
export const profileDateLimit = (now = Date.now()) => new Date(now).toISOString().slice(0, 10)

export function profileValidationErrors(values, { partial = false, requirePhone = false, requireDateOfBirth = false, phoneConflict = null, now = Date.now() } = {}) {
  const errors = {}
  for (const [field, max] of Object.entries(PROFILE_LIMITS)) {
    if (values[field] == null) continue
    if (typeof values[field] !== 'string') errors[field] = `${labels[field]} không hợp lệ.`
    else if (values[field].trim().length > max) errors[field] = `${labels[field]} không được vượt quá ${max} ký tự.`
  }
  if ((!partial || values.fullName != null) && !String(values.fullName || '').trim()) errors.fullName = 'Vui lòng nhập họ và tên, không chỉ gồm khoảng trắng.'
  const phone = typeof values.phoneNumber === 'string' ? values.phoneNumber.trim() : ''
  if (requirePhone && !phone) errors.phoneNumber = 'Vui lòng nhập số điện thoại.'
  else if (phone && !errors.phoneNumber && !/^(?:0|\+84)[0-9]{9}$/.test(normalizeProfilePhone(phone))) {
    errors.phoneNumber = 'Số điện thoại cần 10 chữ số bắt đầu bằng 0 hoặc dùng mã +84.'
  }
  if (!errors.phoneNumber && getProfilePhoneConflict(phone, phoneConflict)) errors.phoneNumber = getProfilePhoneConflict(phone, phoneConflict)
  if (values.gender != null && !['', 'Male', 'Female', 'Other'].includes(String(values.gender).trim())) errors.gender = 'Vui lòng chọn giới tính trong danh sách.'
  const dob = values.dateOfBirth
  if (requireDateOfBirth && !dob) errors.dateOfBirth = 'Vui lòng nhập ngày sinh.'
  else if (partial && dob === '') errors.dateOfBirth = 'Ngày sinh không hợp lệ.'
  else if (dob != null && dob !== '') {
    const key = typeof dob === 'string' ? dob.slice(0, 10) : ''
    const parsed = Date.parse(`${key}T00:00:00.000Z`)
    if (typeof dob !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(dob)
      || Number(key.slice(0, 4)) < 1 || !Number.isFinite(parsed)
      || new Date(parsed).toISOString().slice(0, 10) !== key || !Number.isFinite(Date.parse(dob))) errors.dateOfBirth = 'Ngày sinh không hợp lệ.'
    else if (key > profileDateLimit(now)) errors.dateOfBirth = 'Ngày sinh không được ở tương lai.'
  }
  if (values.password != null) {
    if (typeof values.password !== 'string' || values.password.length < 8 || values.password.length > 72) errors.password = 'Mật khẩu mới phải từ 8 đến 72 ký tự.'
    else if (values.password === values.currentPassword) errors.password = 'Mật khẩu mới phải khác mật khẩu hiện tại.'
    if (typeof values.currentPassword !== 'string' || !values.currentPassword.length) errors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại.'
  }
  return errors
}

export function passwordChangeErrors({ currentPassword, newPassword, confirmPassword }) {
  const { password, ...errors } = profileValidationErrors({ currentPassword, password: newPassword ?? '' }, { partial: true })
  if (password) errors.newPassword = password
  if (!confirmPassword) errors.confirmPassword = 'Vui lòng xác nhận mật khẩu mới.'
  else if (confirmPassword !== newPassword) errors.confirmPassword = 'Xác nhận mật khẩu mới không khớp.'
  return errors
}

export function normalizeProfileUpdate(values) {
  return Object.fromEntries(fields.filter(field => values[field] !== undefined).map(field => {
    const value = values[field]
    if (typeof value !== 'string' || ['password', 'currentPassword'].includes(field)) return [field, value]
    if (field === 'phoneNumber') return [field, value.trim() ? normalizeProfilePhone(value) : null]
    return [field, value.trim()]
  }))
}

export function profileFieldErrors(error) {
  if (error?.fieldErrors) return error.fieldErrors
  const result = {}
  const body = error?.response?.data
  for (const [key, messages] of Object.entries(body?.errors || {})) {
    const name = key.split('.').at(-1)
    const field = fields.find(field => field.toLowerCase() === name.toLowerCase())
    const message = (Array.isArray(messages) ? messages : [messages]).find(value => typeof value === 'string' && value.trim())
    if (field && message) result[field] = message
  }
  const message = body?.message || error?.message || ''
  if (!Object.keys(result).length) {
    if (/số điện thoại|phone number/i.test(message)) result.phoneNumber = message
    else if (/ngày sinh|date of birth/i.test(message)) result.dateOfBirth = message
    else if (/họ (?:và )?tên|full name/i.test(message)) result.fullName = message
  }
  return result
}

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
