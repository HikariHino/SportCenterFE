import { getNewPasswordValidationError } from './passwordValidation.js'
import { getVietnamPhoneValidationError, getFullNameValidationError, profileDateLimit } from './profileValidation.js'
import { getTextLengthValidationError } from './textLengthValidation.js'
import { getAccountEmailValidationError } from './emailValidation.js'
import { getRegistrationBirthDateError } from './authRegistrationValidation.js'

export const MANAGER_ACCOUNT_LIMITS = { fullName: 100, email: 256, phone: 10, address: 200, fitnessGoal: 100 }
export const STAFF_ASSIGNABLE_ROLES = ['Coach', 'Receptionist']
export const MANAGER_PHONE_PATTERN = '0[0-9]{9}'
export const MANAGER_PHONE_MESSAGE = 'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng 0.'
export const managerBirthDateLimit = profileDateLimit
export const MEMBER_PHONE_PATTERN = '0[35789][0-9]{8}'
export const MEMBER_PHONE_MESSAGE = 'Số di động Việt Nam phải gồm 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.'

function getStrictAccountEmailError(value) {
  const error = getAccountEmailValidationError(value)
  if (error) return error
  const [local, domain] = value.trim().split('@')
  if (local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..') || !domain.includes('.')
    || !/^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i.test(domain.split('.').at(-1))) {
    return 'Email không hợp lệ. Vui lòng nhập đầy đủ tên và tên miền, ví dụ: ten@example.com.'
  }
  return ''
}

export function getManagerMemberValidationError(form = {}, now = Date.now()) {
  const first = Object.entries(getManagerMemberValidationErrors(form, now))[0]
  return first ? { field: first[0], message: first[1] } : null
}

export function getManagerMemberValidationErrors(form = {}, now = Date.now()) {
  const errors = {}
  const nameError = getFullNameValidationError(form.fullName)
  if (nameError) errors.fullName = nameError
  const emailError = getStrictAccountEmailError(form.email)
  if (emailError) errors.email = emailError
  const passwordError = getNewPasswordValidationError(form.password)
  if (passwordError) errors.password = passwordError
  if (typeof form.phone !== 'string' || !form.phone.trim()) errors.phone = 'Vui lòng nhập số điện thoại.'
  else if (!new RegExp(`^${MEMBER_PHONE_PATTERN}$`).test(form.phone.trim())) errors.phone = MEMBER_PHONE_MESSAGE
  const birthError = getRegistrationBirthDateError(form.dateOfBirth, now)
  if (birthError) errors.dateOfBirth = birthError
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth)) errors.dateOfBirth = 'Ngày sinh không hợp lệ.'
  if (!['Male', 'Female', 'Other'].includes(form.gender)) errors.gender = 'Vui lòng chọn giới tính trong danh sách.'
  for (const [field, label] of [['address', 'Địa chỉ'], ['fitnessGoal', 'Mục tiêu tập luyện']]) {
    const message = getTextLengthValidationError(form[field], label, MANAGER_ACCOUNT_LIMITS[field])
    if (message) errors[field] = message
    else if (typeof form[field] === 'string' && form[field].length && !form[field].trim()) errors[field] = `${label} không được chỉ gồm khoảng trắng.`
  }
  return errors
}

export function getManagerStaffValidationError(form = {}) {
  const first = Object.entries(getManagerStaffValidationErrors(form))[0]
  return first ? { field: first[0], message: first[1] } : null
}

export function getManagerStaffValidationErrors(form = {}, accounts = []) {
  const errors = {}
  const nameError = getFullNameValidationError(form.fullName)
  if (nameError) errors.fullName = nameError
  const emailError = getStrictAccountEmailError(form.email)
  if (emailError) errors.email = emailError
  const passwordError = getNewPasswordValidationError(form.password)
  if (passwordError) errors.password = passwordError
  const phoneError = form.phone != null && typeof form.phone !== 'string' ? MANAGER_PHONE_MESSAGE : getVietnamPhoneValidationError(form.phone, { required: true })
  if (phoneError) errors.phone = phoneError
  if (!STAFF_ASSIGNABLE_ROLES.includes(form.role)) errors.role = 'Vui lòng chọn vai trò Huấn luyện viên hoặc Lễ tân.'
  const emailKey = value => typeof value === 'string' ? value.trim().toLowerCase() : ''
  const phoneKey = value => typeof value === 'string' ? value.trim().replace(/[\s().-]/g, '').replace(/^\+84/, '0') : ''
  if (!errors.email && accounts.some(account => emailKey(account.email) === emailKey(form.email))) errors.email = 'Email đã được sử dụng. Vui lòng nhập email khác.'
  if (!errors.phone && accounts.some(account => phoneKey(account.phone ?? account.phoneNumber) === phoneKey(form.phone))) errors.phone = 'Số điện thoại đã được sử dụng. Vui lòng nhập số khác.'
  return errors
}

export function getManagerStaffFieldErrors(error) {
  const fields = ['fullName', 'email', 'password', 'phone', 'role']
  const result = {}
  for (const [key, value] of Object.entries(error?.fieldErrors || error?.response?.data?.errors || {})) {
    const name = key.split('.').at(-1).toLowerCase()
    const field = name === 'phonenumber' ? 'phone' : fields.find(item => item.toLowerCase() === name)
    const message = (Array.isArray(value) ? value : [value]).find(item => typeof item === 'string' && item.trim())
    if (field && message) result[field] = message
  }
  if (fields.includes(error?.field)) result[error.field] = error.message
  if (!Object.keys(result).length) {
    const message = error?.response?.data?.message || ''
    if (/email/i.test(message)) result.email = message
    else if (/số điện thoại|phone/i.test(message)) result.phone = message
  }
  return result
}
