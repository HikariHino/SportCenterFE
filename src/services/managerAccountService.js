import { createMember } from './memberService'
import { createStaffUser } from './userService'
import { getManagerMemberValidationError, getManagerStaffValidationError } from '../utils/managerAccountValidation.js'

export async function createManagerMember(form) {
  const error = getManagerMemberValidationError(form)
  if (error) throw Object.assign(new Error(error.message), { field: error.field })
  return createMember({
    ...form,
    fullName: form.fullName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    dateOfBirth: form.dateOfBirth ? `${form.dateOfBirth}T00:00:00.000Z` : null,
    address: form.address?.trim() || null,
    fitnessGoal: form.fitnessGoal?.trim() || null,
  })
}

export async function createManagerStaff(form) {
  const error = getManagerStaffValidationError(form)
  if (error) throw Object.assign(new Error(error.message), { field: error.field })
  return createStaffUser({ ...form, phone: form.phone?.trim() || null })
}
