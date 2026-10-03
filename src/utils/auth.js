export function getUserDisplayName(user) {
  return [user?.fullName, user?.name, user?.email]
    .find(value => typeof value === 'string' && value.trim())?.trim() || 'Hội viên'
}

export function getUserInitials(user) {
  return getUserDisplayName(user).split(/\s+/).slice(-2)
    .map(part => Array.from(part)[0]).join('').toLocaleUpperCase('vi-VN')
}

export function getToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token')
}

export function getRefreshTokenKey() {
  return localStorage.getItem('refreshTokenKey') || sessionStorage.getItem('refreshTokenKey')
}

function getSessionStorage() {
  if (localStorage.getItem('token') || localStorage.getItem('refreshTokenKey')) return localStorage
  if (sessionStorage.getItem('token') || sessionStorage.getItem('refreshTokenKey')) return sessionStorage
  return null
}

export function clearSession() {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem('user')
    storage.removeItem('token')
    storage.removeItem('refreshTokenKey')
  }
}

export function getSavedUser() {
  try {
    if (!getToken()) return null
    const storage = localStorage.getItem('token') ? localStorage : sessionStorage
    return JSON.parse(storage.getItem('user'))
  } catch {
    clearSession()
    return null
  }
}

export function updateSessionTokens(token, refreshTokenKey) {
  const storage = getSessionStorage()
  if (!storage || typeof token !== 'string' || !token.trim()) return false
  storage.setItem('token', token.trim())
  if (typeof refreshTokenKey === 'string' && refreshTokenKey.trim()) {
    storage.setItem('refreshTokenKey', refreshTokenKey.trim())
  }
  return true
}

export function saveSession(userData, token, remember = true) {
  const accessToken = token || userData?.token || userData?.accessToken
  if (typeof accessToken !== 'string' || !accessToken.trim()) {
    throw new Error('Không nhận được phiên đăng nhập hợp lệ. Vui lòng đăng nhập lại.')
  }
  const user = {
    userId: userData.userId,
    id: userData.userId,
    email: userData.email,
    fullName: userData.fullName,
    name: userData.fullName,
    role: String(userData.role || '').trim().toLowerCase(),
  }
  clearSession()
  const storage = remember ? localStorage : sessionStorage
  storage.setItem('user', JSON.stringify(user))
  storage.setItem('token', accessToken.trim())
  const refreshTokenKey = userData?.refreshTokenKey || userData?.refreshToken
  if (typeof refreshTokenKey === 'string' && refreshTokenKey.trim()) {
    storage.setItem('refreshTokenKey', refreshTokenKey.trim())
  }
  return user
}

export function isManagerRole(role) {
  return ['manager', 'centermanager'].includes(String(role || '').toLowerCase().replace(/[\s_-]/g, ''))
}

export function getAuthDestination(role, from) {
  // Only return routes supported by the app and accessible to this role.
  if (from === '/' || from === '/#memberships') return from
  if (isManagerRole(role)) return '/manager'
  if (role === 'coach') return '/coach'
  if (role === 'member') return '/member'
  return '/'
}

export function getAuthErrorMessage(error, fallback) {
  const body = error.response?.data
  const details = body?.errors
  const messages = (Array.isArray(details) ? details : details && typeof details === 'object' ? Object.values(details).flat() : [details])
    .filter(value => typeof value === 'string' && value.trim())
  if (messages.length) return messages.join(' ')
  if (typeof body?.message === 'string' && body.message.trim()) return body.message
  if (error.response?.status === 401) return 'Email hoặc mật khẩu không chính xác.'
  if (error.response?.status === 409) return 'Email đã được đăng ký. Vui lòng dùng email khác hoặc đăng nhập.'
  if (error.isAxiosError && !error.response) return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.'
  return error.isAxiosError ? fallback : error.message || fallback
}
