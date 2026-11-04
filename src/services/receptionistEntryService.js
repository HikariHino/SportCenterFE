import { createMember } from './memberService'
import { manualCheckIn, scanQrCheckIn } from './gymCheckInService'
import { getReceptionistManualCheckInValidationError, getReceptionistMemberValidationError } from '../utils/receptionistValidation.js'
import { CHECK_IN_NOTES_MAX_LENGTH, getTextLengthValidationError } from '../utils/textLengthValidation.js'

// These entry points validate Receptionist forms without changing other roles' services.
export async function createReceptionistMember(form) {
  const error = getReceptionistMemberValidationError(form)
  if (error) throw Object.assign(new Error(error.message), { field: error.field })
  return createMember({
    ...form,
    fullName: form.fullName.trim(),
    phone: form.phone?.trim() || null,
    dateOfBirth: form.dateOfBirth || null,
    gender: form.gender || null,
    address: form.address?.trim() || null,
    fitnessGoal: form.fitnessGoal?.trim() || null,
  })
}

export async function manualReceptionistCheckIn(form) {
  const error = getReceptionistManualCheckInValidationError(form)
  if (error) throw Object.assign(new Error(error.message), { field: error.field })
  const notesError = getTextLengthValidationError(form.notes, 'Ghi chú check-in', CHECK_IN_NOTES_MAX_LENGTH)
  if (notesError) throw Object.assign(new Error(notesError), { field: 'notes' })
  return manualCheckIn({
    ...form,
    memberId: typeof form.memberId === 'string' ? form.memberId.trim() : form.memberId,
    phoneNumber: form.phoneNumber?.trim() || null,
  })
}

export async function scanReceptionistQrCheckIn(form) {
  const notesError = getTextLengthValidationError(form.notes, 'Ghi chú check-in', CHECK_IN_NOTES_MAX_LENGTH)
  if (notesError) throw Object.assign(new Error(notesError), { field: 'notes' })
  return scanQrCheckIn(form)
}
