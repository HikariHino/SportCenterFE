import api from './api'
import { normalizeProfileUpdate, profileValidationErrors } from '../utils/profileValidation.js'

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
 * Email changes use the separate OTP endpoints.
 */
export async function updateProfile(dto) {
  const fieldErrors = profileValidationErrors(dto, { partial: true })
  if (Object.keys(fieldErrors).length) throw Object.assign(new Error(Object.values(fieldErrors)[0]), { fieldErrors })
  const payload = normalizeProfileUpdate(dto)
  const response = await api.put('/profile', payload)
  const body = response.data
  if (body?.success === false || Number(body?.statusCode) >= 400) {
    throw Object.assign(new Error(body.message || 'Không thể cập nhật hồ sơ.'), { response })
  }
  return body?.data ?? body
}

export async function requestChangeEmailOtp(newEmail) {
  const response = await api.post('/profile/change-email/request-otp', { newEmail: newEmail.trim().toLowerCase() })
  if (response.data?.success === false || Number(response.data?.statusCode) >= 400) throw Object.assign(new Error(response.data.message || 'Không thể gửi mã xác nhận email.'), { response })
  return response.data
}

export async function verifyChangeEmailOtp(newEmail, otp) {
  if (!/^\d{6}$/.test(otp.trim())) throw new Error('Mã OTP phải có 6 chữ số.')
  const response = await api.post('/profile/change-email/verify-otp', { newEmail: newEmail.trim().toLowerCase(), otp: otp.trim() })
  const body = response.data
  if (body?.success === false || Number(body?.statusCode) >= 400) throw Object.assign(new Error(body.message || 'Không thể xác nhận thay đổi email.'), { response })
  return body?.data ?? body
}

export default {
  getProfileErrorMessage,
  getProfile,
  updateProfile,
  requestChangeEmailOtp,
  verifyChangeEmailOtp,
}
