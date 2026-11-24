import { getNewPasswordValidationError } from './passwordValidation.js'
import { getTextLengthValidationError } from './textLengthValidation.js'
import { getFullNameCharactersError } from './fullNameValidation.js'
import { getAccountDetailsValidationError } from './accountDetailsValidation.js'
import { profileBirthDateLimit, profileValidationErrors } from './profileValidation.js'

export const AUTH_REGISTRATION_LIMITS = { fullName: 100, email: 256, address: 200, fitnessGoal: 100 }
export const REGISTRATION_AGE_NOTICE = 'Lưu ý: Bạn phải đủ 16 tuổi trở lên để đăng ký tài khoản.'

export const registrationBirthDateLimit = profileBirthDateLimit

export function getRegistrationBirthDateError(dateOfBirth, now = Date.now()) {
  const error = profileValidationErrors({ dateOfBirth }, { partial: true, requireDateOfBirth: true, now }).dateOfBirth
  return error || ''
}

export function getAuthRegistrationValidationError(form, now = Date.now()) {
  for (const [field, label] of [['fullName', 'Họ và tên'], ['email', 'Email'], ['address', 'Địa chỉ'], ['fitnessGoal', 'Mục tiêu tập luyện']]) {
    const message = getTextLengthValidationError(form[field], label, AUTH_REGISTRATION_LIMITS[field])
    if (message) return { field, message }
  }
  const nameError = getFullNameCharactersError(form.fullName)
  if (nameError) return { field: 'fullName', message: nameError }
  const passwordError = getNewPasswordValidationError(form.password)
  if (passwordError) return { field: 'password', message: passwordError }
  const accountError = getAccountDetailsValidationError(form, now)
  if (accountError) return accountError
  const birthError = getRegistrationBirthDateError(form.dateOfBirth, now)
  return birthError ? { field: 'dateOfBirth', message: birthError } : null
}
