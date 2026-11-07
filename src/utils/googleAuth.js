export function getGoogleClientId(value) {
  const clientId = typeof value === 'string' ? value.trim() : ''
  return /^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i.test(clientId) ? clientId : ''
}

export const getGoogleLoginErrorMessage = error => getGoogleAuthErrorMessage(error, false)
export const getGoogleRegistrationErrorMessage = error => getGoogleAuthErrorMessage(error, true)

function getGoogleAuthErrorMessage(error, signup) {
  const action = signup ? 'Đăng ký' : 'Đăng nhập'
  const alternative = signup ? 'đăng ký bằng email' : 'đăng nhập bằng email và mật khẩu'
  const status = error?.response?.status
  const body = error?.response?.data
  const message = String(body?.message || body?.error || error?.message || '').toLowerCase()
  if (message.includes('account is disabled')) return 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ trung tâm.'
  if (message.includes('email is not verified')) return 'Email Google chưa được xác minh. Vui lòng xác minh email rồi thử lại.'
  if (status === 503 || message.includes('not configured')) return `${action} Google hiện chưa khả dụng. Bạn có thể ${alternative}.`
  if (status === 401) return 'Phiên xác thực Google không hợp lệ hoặc đã hết hạn. Vui lòng chọn lại tài khoản.'
  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') return `Kết nối quá thời gian chờ. Vui lòng thử ${action.toLowerCase()} Google lại.`
  if (error?.code === 'ERR_NETWORK') return 'Không thể kết nối với máy chủ. Vui lòng kiểm tra kết nối và thử lại.'
  return `${action} Google không thành công. Vui lòng thử lại hoặc ${alternative}.`
}
