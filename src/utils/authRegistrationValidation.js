import { getNewPasswordValidationError } from './passwordValidation.js'
import { getTextLengthValidationError } from './textLengthValidation.js'
import { getFullNameCharactersError } from './fullNameValidation.js'

export const AUTH_REGISTRATION_LIMITS = { fullName: 100, email: 256, address: 200, fitnessGoal: 100 }

export function getAuthRegistrationValidationError(form) {
  for (const [field, label] of [['fullName', 'Họ và tên'], ['email', 'Email'], ['address', 'Địa chỉ'], ['fitnessGoal', 'Mục tiêu tập luyện']]) {
    const message = getTextLengthValidationError(form[field], label, AUTH_REGISTRATION_LIMITS[field])
    if (message) return { field, message }
  }
  const nameError = getFullNameCharactersError(form.fullName)
  if (nameError) return { field: 'fullName', message: nameError }
  const passwordError = getNewPasswordValidationError(form.password)
  return passwordError ? { field: 'password', message: passwordError } : null
}
