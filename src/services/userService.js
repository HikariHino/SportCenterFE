import api from './api'

/**
 * @typedef {Object} StaffUser
 * @property {number} userId
 * @property {string} fullName
 * @property {string} email
 * @property {string|null} phone
 * @property {'Manager'|'Receptionist'|'Coach'} role
 * @property {boolean} isActive
 * @property {number|null} coachId
 * @property {string} createdAt
 * @property {string|null} updatedAt
 */

/**
 * Helper to extract error message from API response
 */
export function getUserErrorMessage(error, fallback = 'Có lỗi xảy ra khi thao tác người dùng.') {
  const body = error?.response?.data
  const validationErrors = body?.errors
  if (validationErrors && typeof validationErrors === 'object') {
    const firstKey = Object.keys(validationErrors)[0]
    if (firstKey && Array.isArray(validationErrors[firstKey])) {
      return validationErrors[firstKey][0]
    }
  }
  return body?.message || error?.message || fallback
}

/**
 * GET /api/users/staff
 * Lấy danh sách toàn bộ nhân sự (Huấn luyện viên, Lễ tân, Quản lý)
 * @returns {Promise<Array<StaffUser>>}
 */
export async function getStaffUsers() {
  const response = await api.get('/users/staff')
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải danh sách nhân sự.')
  }

  const payload = body?.data ?? body
  return Array.isArray(payload) ? payload : []
}

/**
 * GET /api/users/staff/{id}
 * Lấy chi tiết thông tin một nhân viên theo ID
 * @param {number} id
 * @returns {Promise<StaffUser>}
 */
export async function getStaffUserById(id) {
  const response = await api.get(`/users/staff/${id}`)
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải thông tin nhân viên.')
  }

  return body?.data ?? body
}

/**
 * POST /api/users/staff
 * Tạo mới tài khoản nhân viên (Manager, Receptionist, Coach)
 * @param {Object} data
 * @param {string} data.email
 * @param {string} data.password
 * @param {string} data.fullName
 * @param {string} [data.phone]
 * @param {'Manager'|'Receptionist'|'Coach'} data.role
 * @returns {Promise<StaffUser>}
 */
export async function createStaffUser({ email, password, fullName, phone, role }) {
  const response = await api.post('/users/staff', {
    email: email.trim(),
    password,
    fullName: fullName.trim(),
    phone: phone ? phone.trim() : null,
    role,
  })
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tạo tài khoản nhân viên.')
  }

  return body?.data ?? body
}

/**
 * PUT /api/users/staff/{id}/role
 * Thay đổi vai trò (Role) của nhân viên
 * @param {number} id
 * @param {Object} data
 * @param {'Manager'|'Receptionist'|'Coach'} data.role
 * @returns {Promise<StaffUser>}
 */
export async function updateStaffRole(id, { role }) {
  const response = await api.put(`/users/staff/${id}/role`, { role })
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể cập nhật quyền nhân viên.')
  }

  return body?.data ?? body
}

/**
 * DELETE /api/users/staff/{id}
 * Vô hiệu hóa tài khoản nhân viên (giữ lịch sử Audit Log)
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deactivateStaffUser(id) {
  const response = await api.delete(`/users/staff/${id}`)
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể vô hiệu hóa nhân viên.')
  }

  return body
}

export default {
  getStaffUsers,
  getStaffUserById,
  createStaffUser,
  updateStaffRole,
  deactivateStaffUser,
  getUserErrorMessage,
}
