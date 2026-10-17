import api from './api'

/**
 * Trích xuất lỗi từ backend cho Profile
 */
export function getProfileErrorMessage(error, fallback = 'Có lỗi xảy ra khi xử lý thông tin cá nhân.') {
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
 * Lấy hồ sơ người dùng đăng nhập hiện tại
 * GET /api/profile
 */
export async function getProfile() {
  const response = await api.get('/profile')
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải thông tin hồ sơ.')
  }
  return body?.data ?? body
}

/**
 * Cập nhật thông tin cá nhân
 * PUT /api/profile
 * @param {{ fullName?: string, phoneNumber?: string, email?: string, password?: string, currentPassword?: string }} dto
 */
export async function updateProfile(dto) {
  const response = await api.put('/profile', dto)
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể cập nhật hồ sơ.')
  }
  return body?.data ?? body
}

export default {
  getProfileErrorMessage,
  getProfile,
  updateProfile,
}
