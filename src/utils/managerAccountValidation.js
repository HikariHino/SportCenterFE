import { timetableDateKey } from './memberTimetable.js'
import { getNewPasswordValidationError } from './passwordValidation.js'
import { getVietnamPhoneValidationError } from './profileValidation.js'
import { getTextLengthValidationError } from './textLengthValidation.js'

export const MANAGER_ACCOUNT_LIMITS = { fullName: 100, email: 256, phone: 10, address: 200, fitnessGoal: 100 }
export const MANAGER_PHONE_PATTERN = '0[0-9]{9}'
export const MANAGER_PHONE_MESSAGE = 'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng 0.'
export const managerBirthDateLimit = (now = Date.now()) => timetableDateKey(now)

function accountError({ fullName, email, password, phone }, requirePhone) {
  if (typeof fullName !== 'string' || !fullName.trim()) return { field: 'fullName', message: 'Vui lòng nhập họ và tên, không chỉ gồm khoảng trắng.' }
  if (fullName.length > MANAGER_ACCOUNT_LIMITS.fullName) return { field: 'fullName', message: 'Họ và tên không được vượt quá 100 ký tự.' }
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
  const error = accountError(form, false)
  if (error) return error
  return ['Manager', 'Receptionist', 'Coach'].includes(form.role) ? null : { field: 'role', message: 'Vui lòng chọn vai trò nhân viên hợp lệ.' }
}
