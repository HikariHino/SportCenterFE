import { createMember } from './memberService'
import { createStaffUser } from './userService'
import { getManagerMemberValidationError, getManagerStaffValidationError, getManagerStaffValidationErrors } from '../utils/managerAccountValidation.js'
import api from './api'
import { getMemberContactConflicts } from '../utils/memberRegistrationErrors.js'

let pendingMemberCreation = Promise.resolve()
export async function createManagerMember(form) {
  const error = getManagerMemberValidationError(form)
  if (error) throw Object.assign(new Error(error.message), { field: error.field })
  const values = {
    ...form,
    fullName: form.fullName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    dateOfBirth: form.dateOfBirth ? `${form.dateOfBirth}T00:00:00.000Z` : null,
    address: form.address?.trim() || null,
    fitnessGoal: form.fitnessGoal?.trim() || null,
  }
  const request = pendingMemberCreation.then(async () => {
    const groups = await Promise.all([readAccountContacts('/users/staff'), readAccountContacts('/members')])
    const fieldErrors = getMemberContactConflicts(values, groups.flat())
    if (Object.keys(fieldErrors).length) throw Object.assign(new Error(Object.values(fieldErrors)[0]), { fieldErrors })
    return createMember(values)
  })
  pendingMemberCreation = request.catch(() => {})
  return request
}

async function readAccountContacts(path) {
  const response = await api.get(path)
  const body = response.data
  if (body?.success === false || Number(body?.statusCode) >= 400) throw Object.assign(new Error(body.message || 'Chưa thể kiểm tra email và số điện thoại. Vui lòng thử lại.'), { response })
  const items = body?.data ?? body
  if (!Array.isArray(items)) throw new Error('Chưa tải đủ dữ liệu để kiểm tra email và số điện thoại. Vui lòng làm mới và thử lại.')
  return items
}

let pendingStaffCreation = Promise.resolve()
export function createManagerStaff(form) {
  const error = getManagerStaffValidationError(form)
  if (error) return Promise.reject(Object.assign(new Error(error.message), { field: error.field }))
  const values = { ...form, phone: form.phone.trim() }
  // Re-read both account lists immediately before creating. Never treat an
  // unreadable list as empty, and include inactive accounts in uniqueness checks.
  const request = pendingStaffCreation.then(async () => {
    const groups = await Promise.all([readAccountContacts('/users/staff'), readAccountContacts('/members')])
    const fieldErrors = getManagerStaffValidationErrors(values, groups.flat())
    if (Object.keys(fieldErrors).length) throw Object.assign(new Error(Object.values(fieldErrors)[0]), { fieldErrors })
    return createStaffUser(values)
  })
  pendingStaffCreation = request.catch(() => {})
  return request
}
