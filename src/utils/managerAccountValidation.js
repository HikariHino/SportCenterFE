import { getNewPasswordValidationError } from './passwordValidation.js'
import { getVietnamPhoneValidationError, getFullNameValidationError, profileDateLimit } from './profileValidation.js'
import { getTextLengthValidationError } from './textLengthValidation.js'
import { getFullNameCharactersError } from './fullNameValidation.js'
import { getAccountEmailValidationError } from './emailValidation.js'

export const MANAGER_ACCOUNT_LIMITS = { fullName: 100, email: 256, phone: 10, address: 200, fitnessGoal: 100 }
export const STAFF_ASSIGNABLE_ROLES = ['Coach', 'Receptionist']
export const MANAGER_PHONE_PATTERN = '0[0-9]{9}'
export const MANAGER_PHONE_MESSAGE = 'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng 0.'
export const managerBirthDateLimit = profileDateLimit

function accountError({ fullName, email, password, phone }, requirePhone) {
  if (typeof fullName !== 'string' || !fullName.trim()) return { field: 'fullName', message: 'Vui lòng nhập họ và tên, không chỉ gồm khoảng trắng.' }
  if (fullName.length > MANAGER_ACCOUNT_LIMITS.fullName) return { field: 'fullName', message: 'Họ và tên không được vượt quá 100 ký tự.' }
  const nameError = getFullNameCharactersError(fullName)
  if (nameError) return { field: 'fullName', message: nameError }
  if (typeof email !== 'string' || !email.trim()) return { field: 'email', message: 'Vui lòng nhập email.' }
  if (email.length > MANAGER_ACCOUNT_LIMITS.email) return { field: 'email', message: 'Email không được vượt quá 256 ký tự.' }
  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(email.trim())) {
    return { field: 'email', message: 'Email không hợp lệ.' }
  }
  const passwordError = getNewPasswordValidationError(password)
  if (passwordError) return { field: 'password', message: passwordError }
  if (phone != null && typeof phone !== 'string') return { field: 'phone', message: MANAGER_PHONE_MESSAGE }
  const phoneError = getVietnamPhoneValidationError(phone, { required: requirePhone })
  return phoneError ? { field: 'phone', message: phoneError } : null
}

export function getManagerMemberValidationError(form = {}, now = Date.now()) {
  const error = accountError(form, true)
  if (error) return error
  if (form.dateOfBirth != null && form.dateOfBirth !== '') {
    const date = form.dateOfBirth
    const parsed = typeof date === 'string' ? Date.parse(`${date}T00:00:00.000Z`) : NaN
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number(date.slice(0, 4)) < 1
      || !Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== date) {
      return { field: 'dateOfBirth', message: 'Ngày sinh không hợp lệ.' }
    }
    if (date > managerBirthDateLimit(now)) return { field: 'dateOfBirth', message: 'Ngày sinh không được ở tương lai.' }
  }
  for (const [field, label] of [['address', 'Địa chỉ'], ['fitnessGoal', 'Mục tiêu tập luyện']]) {
    const message = getTextLengthValidationError(form[field], label, MANAGER_ACCOUNT_LIMITS[field])
    if (message) return { field, message }
  }
  return null
}

export function getManagerStaffValidationError(form = {}) {
  const first = Object.entries(getManagerStaffValidationErrors(form))[0]
  return first ? { field: first[0], message: first[1] } : null
}

export function getManagerStaffValidationErrors(form = {}, accounts = []) {
  const errors = {}
  const nameError = getFullNameValidationError(form.fullName)
  if (nameError) errors.fullName = nameError
  let emailError = getAccountEmailValidationError(form.email)
  if (!emailError) {
    const [local, domain] = form.email.trim().split('@')
    if (local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..') || !domain.includes('.')
      || !/^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i.test(domain.split('.').at(-1))) emailError = 'Email không hợp lệ. Vui lòng nhập đầy đủ tên và tên miền, ví dụ: ten@example.com.'
  }
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
