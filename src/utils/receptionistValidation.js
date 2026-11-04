import { getVietnamPhoneValidationError } from './profileValidation.js'
import { getNewPasswordValidationError } from './passwordValidation.js'
import { getTextLengthValidationError } from './textLengthValidation.js'
import { getFullNameCharactersError } from './fullNameValidation.js'

export const RECEPTIONIST_PHONE_PATTERN = '0[0-9]{9}'
export const RECEPTIONIST_PHONE_MESSAGE = 'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng 0.'

function phoneValidationError(value) {
  if (value != null && typeof value !== 'string') return RECEPTIONIST_PHONE_MESSAGE
  return getVietnamPhoneValidationError(value)
}

export function getReceptionistMemberValidationError({ fullName, phone, password, email, address, fitnessGoal } = {}) {
  if (typeof fullName !== 'string' || !fullName.trim()) {
    return { field: 'fullName', message: 'Vui lòng nhập họ và tên, không chỉ gồm khoảng trắng.' }
  }
  if (fullName.trim().length > 100) return { field: 'fullName', message: 'Họ và tên không được vượt quá 100 ký tự.' }
  const nameError = getFullNameCharactersError(fullName)
  if (nameError) return { field: 'fullName', message: nameError }
  const phoneError = phoneValidationError(phone)
  if (phoneError) return { field: 'phone', message: phoneError }
  const passwordError = getNewPasswordValidationError(password)
  if (passwordError) return { field: 'password', message: passwordError }
  for (const [field, value, label, max] of [
    ['email', email, 'Email', 256], ['address', address, 'Địa chỉ', 200], ['fitnessGoal', fitnessGoal, 'Mục tiêu tập luyện', 100],
  ]) {
    const message = getTextLengthValidationError(value, label, max)
    if (message) return { field, message }
  }
  return null
}

export function getReceptionistManualCheckInValidationError({ memberId, phoneNumber } = {}) {
  const id = typeof memberId === 'string' ? memberId.trim() : memberId
  const hasId = id != null && id !== ''
  const hasPhone = phoneNumber != null && phoneNumber !== '' && (typeof phoneNumber !== 'string' || phoneNumber.trim() !== '')
  if (!hasId && !hasPhone) return { field: 'memberId', message: 'Vui lòng nhập mã hội viên hoặc số điện thoại.' }
  if (hasId && ((typeof id !== 'number' && typeof id !== 'string') || !/^[0-9]+$/.test(String(id))
    || !Number.isSafeInteger(Number(id)) || Number(id) < 1 || Number(id) > 2147483647)) {
    return { field: 'memberId', message: 'Mã hội viên phải là số nguyên từ 1 đến 2147483647.' }
  }
  const phoneError = phoneValidationError(phoneNumber)
  return phoneError ? { field: 'phoneNumber', message: phoneError } : null
}
