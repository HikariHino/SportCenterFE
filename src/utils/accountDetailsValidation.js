import { getAccountEmailValidationError } from './emailValidation.js'
import { getProfilePhoneValidationError, profileValidationErrors } from './profileValidation.js'

// Keep account service validation aligned with the form, including callers
// that do not go through native HTML validity checks.
export function getAccountDetailsValidationError({ email, phone, dateOfBirth, gender }, now = Date.now()) {
  const emailError = getAccountEmailValidationError(email)
  if (emailError) return { field: 'email', message: emailError }
  const phoneError = getProfilePhoneValidationError(phone)
  if (phoneError) return { field: 'phone', message: phoneError }
  const errors = profileValidationErrors({ dateOfBirth: dateOfBirth === '' ? undefined : dateOfBirth, gender }, { partial: true, now })
  const field = Object.keys(errors)[0]
  return field ? { field, message: errors[field] } : null
}
