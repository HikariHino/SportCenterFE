import { getNewPasswordValidationError } from './passwordValidation.js'
import { getFullNameCharactersError } from './fullNameValidation.js'
import { timetableDateKey } from './memberTimetable.js'
import { getAccountEmailValidationError } from './emailValidation.js'

export const PROFILE_FULL_NAME_MAX_LENGTH = 100
export const PROFILE_PHONE_MAX_LENGTH = 30
export const PROFILE_PHONE_MESSAGE = 'Số điện thoại cần 10 chữ số bắt đầu bằng 0 hoặc dùng mã +84.'
export const PROFILE_BIRTH_DATE_MIN = '1950-01-01'
export const PROFILE_EMERGENCY_CONTACT_MAX_LENGTH = 30
export const PROFILE_LIMITS = { fullName: PROFILE_FULL_NAME_MAX_LENGTH, phoneNumber: PROFILE_PHONE_MAX_LENGTH, gender: 10, address: 500, fitnessGoal: 100, emergencyContact: PROFILE_EMERGENCY_CONTACT_MAX_LENGTH }
const labels = { fullName: 'Họ và tên', phoneNumber: 'Số điện thoại', gender: 'Giới tính', address: 'Địa chỉ thường trú', fitnessGoal: 'Mục tiêu tập luyện', emergencyContact: 'Liên hệ khẩn cấp' }
const fields = [...Object.keys(PROFILE_LIMITS), 'dateOfBirth', 'password', 'currentPassword']

export const normalizeProfilePhone = value => value.trim().replace(/[\s().-]/g, '')
// Compare equivalent local/+84 forms without changing the API's phone format.
export function getProfilePhoneConflict(value, conflict) {
  const key = phone => typeof phone === 'string' ? normalizeProfilePhone(phone).replace(/^\+84/, '0') : ''
  return conflict?.phoneNumber && key(value) === key(conflict.phoneNumber) ? conflict.message : undefined
}
// Calendar limits use the center's day, regardless of the browser's timezone.
export const profileDateLimit = (now = Date.now()) => timetableDateKey(now)

export function profileBirthDateLimit(now = Date.now()) {
  const [year, month, day] = profileDateLimit(now).split('-').map(Number)
  const birthYear = year - 16
  const lastDay = new Date(Date.UTC(birthYear, month, 0)).getUTCDate()
  return `${birthYear}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

export function profileValidationErrors(values, { partial = false, requirePhone = false, requireDateOfBirth = false, phoneConflict = null, now = Date.now() } = {}) {
  const errors = {}
  for (const [field, max] of Object.entries(PROFILE_LIMITS)) {
    if (values[field] == null) continue
    if (typeof values[field] !== 'string') errors[field] = `${labels[field]} không hợp lệ.`
    else if (values[field].trim().length > max) errors[field] = `${labels[field]} không được vượt quá ${max} ký tự.`
  }
  if ((!partial || values.fullName != null) && !String(values.fullName || '').trim()) errors.fullName = 'Vui lòng nhập họ và tên, không chỉ gồm khoảng trắng.'
  if (values.fullName != null && !errors.fullName) {
    const nameError = getFullNameCharactersError(values.fullName)
    if (nameError) errors.fullName = nameError
  }
  const phone = typeof values.phoneNumber === 'string' ? values.phoneNumber.trim() : ''
  if (!errors.phoneNumber) {
    const phoneError = getProfilePhoneValidationError(values.phoneNumber, { required: requirePhone })
    if (phoneError) errors.phoneNumber = phoneError
  }
  if (!errors.phoneNumber && getProfilePhoneConflict(phone, phoneConflict)) errors.phoneNumber = getProfilePhoneConflict(phone, phoneConflict)
  if (!errors.emergencyContact && getProfilePhoneValidationError(values.emergencyContact)) {
    errors.emergencyContact = `Liên hệ khẩn cấp: ${PROFILE_PHONE_MESSAGE}`
  }
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
    else if (key < PROFILE_BIRTH_DATE_MIN) errors.dateOfBirth = 'Ngày sinh phải từ ngày 01/01/1950 trở đi.'
    else if (key > profileBirthDateLimit(now)) errors.dateOfBirth = 'Bạn chưa đủ 16 tuổi.'
  }
  if (values.password != null) {
    const passwordError = getNewPasswordValidationError(values.password)
    if (passwordError) errors.password = passwordError
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
    const field = name.toLowerCase() === 'phone' ? 'phoneNumber' : fields.find(field => field.toLowerCase() === name.toLowerCase())
    const message = (Array.isArray(messages) ? messages : [messages]).find(value => typeof value === 'string' && value.trim())
    if (field && message) result[field] = message
  }
  const message = body?.message || error?.message || ''
  if (!Object.keys(result).length) {
    if (/số điện thoại|phone/i.test(message)) result.phoneNumber = message
    else if (/ngày sinh|date of birth/i.test(message)) result.dateOfBirth = message
    else if (/họ (?:và )?tên|full name/i.test(message)) result.fullName = message
  }
  return result
}

export function isProfilePhoneConflict(error) {
  const message = profileFieldErrors(error).phoneNumber
  return Boolean(message && (Number(error?.response?.status) === 409 || Number(error?.response?.data?.statusCode) === 409
    || /đã.*(?:sử dụng|tồn tại|đăng ký)|trùng|already.*(?:in use|registered|used|exists|taken)|duplicate/i.test(message)))
}

export function getFullNameValidationError(value) {
  const fullName = String(value || '').trim()
  if (!fullName) return 'Họ và tên không được để trống.'
  if (fullName.length > PROFILE_FULL_NAME_MAX_LENGTH) return `Họ và tên không được vượt quá ${PROFILE_FULL_NAME_MAX_LENGTH} ký tự.`
  return getFullNameCharactersError(value)
}

export function getProfilePhoneValidationError(value, { required = false } = {}) {
  if (value == null || (typeof value === 'string' && !value.trim())) return required ? 'Vui lòng nhập số điện thoại.' : ''
  if (typeof value !== 'string' || value.trim().length > PROFILE_PHONE_MAX_LENGTH || !/^(?:0|\+84)[0-9]{9}$/.test(normalizeProfilePhone(value))) return PROFILE_PHONE_MESSAGE
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
  return getAccountEmailValidationError(email)
}
