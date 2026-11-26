import { getBrowserSessionPresence } from './browserSessionPresence.js'

export function getUserDisplayName(user) {
  return [user?.fullName, user?.name, user?.email]
    .find(value => typeof value === 'string' && value.trim())?.trim() || 'Hội viên'
}

export function getUserInitials(user) {
  return getUserDisplayName(user).split(/\s+/).slice(-2)
    .map(part => Array.from(part)[0]).join('').toLocaleUpperCase('vi-VN')
}

const sessionKeys = ['user', 'token', 'refreshTokenKey', 'loginSessionId']
export const SESSION_EXPIRED_EVENT = 'sportcenter:session-expired'
export const ACTIVE_LOGIN_KEY = 'sportcenter:active-login'
const replacedSessionKey = 'sportcenter:session-replaced'
export const BROWSER_SESSION_KEY = 'sportcenter:browser-session'
// Run before mounting routes or making authenticated requests. Persistent
// credentials alone are not evidence of an open tab for an unremembered login.
export async function initializeBrowserSession({ presence = getBrowserSessionPresence(), navigationType = globalThis.performance?.getEntriesByType?.('navigation')?.[0]?.type } = {}) {
  const id = localStorage.getItem(BROWSER_SESSION_KEY)
  if (!id) return
  const reload = navigationType === 'reload' && sessionStorage.getItem('loginSessionId') === id && sessionStorage.getItem('token')
  const alive = await presence.hasLiveTab(id)
  // Another tab can log in/out while the presence check is pending.
  if (localStorage.getItem(BROWSER_SESSION_KEY) !== id || localStorage.getItem(ACTIVE_LOGIN_KEY) !== id) return
  if (alive || reload) { presence.start(id); return }
  if (localStorage.getItem('loginSessionId') === id) {
    for (const key of sessionKeys) localStorage.removeItem(key)
    localStorage.setItem(ACTIVE_LOGIN_KEY, `signed-out:${id}`)
  }
  localStorage.removeItem(BROWSER_SESSION_KEY)
  for (const key of sessionKeys) sessionStorage.removeItem(key)
  sessionStorage.setItem(replacedSessionKey, 'true')
}

// Share one login across tabs, including when it is not remembered.
// A superseded tab must not silently adopt the new account's stored credentials.
export function reconcileBrowserSession() {
  if (sessionStorage.getItem(replacedSessionKey)) {
    getBrowserSessionPresence().stop()
    return false
  }
  const activeLogin = localStorage.getItem(ACTIVE_LOGIN_KEY)
  if (activeLogin && sessionStorage.getItem('token')
    && sessionStorage.getItem('loginSessionId') !== activeLogin) {
    for (const key of sessionKeys) sessionStorage.removeItem(key)
    sessionStorage.setItem(replacedSessionKey, 'true')
    getBrowserSessionPresence().stop()
    if (typeof globalThis.window?.dispatchEvent === 'function' && typeof window.Event === 'function') {
      window.dispatchEvent(new window.Event(SESSION_EXPIRED_EVENT))
    }
    return false
  }
  return true
}

const newLoginSessionId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`

// Separate from JWTs: refreshing an access token must not start a new chat.
export function getLoginSessionId() {
  hydrateTabSession()
  let id = sessionStorage.getItem('loginSessionId')
  if (!id) {
    id = newLoginSessionId()
    sessionStorage.setItem('loginSessionId', id)
    if (sessionStorage.getItem('token') && sessionStorage.getItem('token') === localStorage.getItem('token')) localStorage.setItem('loginSessionId', id)
  }
  return id
}

function hydrateTabSession() {
  if (!reconcileBrowserSession()) return
  if (sessionStorage.getItem('token')) {
    const loginId = sessionStorage.getItem('loginSessionId')
    // Token renewal preserves the login identity shared by these tabs.
    if (loginId && loginId === localStorage.getItem('loginSessionId') && localStorage.getItem('token')) {
      for (const key of ['token', 'refreshTokenKey']) {
        const value = localStorage.getItem(key)
        if (value !== null) sessionStorage.setItem(key, value)
      }
    }
    syncTabSessionPresence()
    return
  }
  if (!localStorage.getItem('token')) {
    getBrowserSessionPresence().stop()
    return
  }
  const activeLogin = localStorage.getItem(ACTIVE_LOGIN_KEY)
  if (activeLogin && localStorage.getItem('loginSessionId') !== activeLogin) return
  for (const key of sessionKeys) {
    const value = localStorage.getItem(key)
    if (value !== null) sessionStorage.setItem(key, value)
  }
  syncTabSessionPresence()
}

function syncTabSessionPresence() {
  const id = sessionStorage.getItem('loginSessionId')
  const presence = getBrowserSessionPresence()
  // A tab that adopts a login after startup must also keep that login alive.
  if (id && sessionStorage.getItem('token') && localStorage.getItem(BROWSER_SESSION_KEY) === id
    && localStorage.getItem(ACTIVE_LOGIN_KEY) === id) presence.start(id)
  else presence.stop()
}

// The expiry only schedules renewal. The backend still validates the JWT.
export function getAccessTokenExpiry(token) {
  try {
    const payload = String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(globalThis.atob(payload))
    return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : null
  } catch { return null }
}

export function getToken() {
  hydrateTabSession()
  return sessionStorage.getItem('token')
}

export function getRefreshTokenKey() {
  hydrateTabSession()
  return sessionStorage.getItem('refreshTokenKey')
}

export function clearSession() {
  const alreadyReplaced = Boolean(sessionStorage.getItem(replacedSessionKey))
  const loginId = sessionStorage.getItem('loginSessionId')
  const activeLogin = localStorage.getItem(ACTIVE_LOGIN_KEY)
  const tabToken = sessionStorage.getItem('token')
  const rememberedToken = localStorage.getItem('token')
  for (const key of sessionKeys) sessionStorage.removeItem(key)
  sessionStorage.setItem(replacedSessionKey, 'true')
  getBrowserSessionPresence().stop()

  // Compare login identities, not rotating access tokens: another tab may have
  // renewed the same session just before logout. Never retire a newer login.
  const ownsSession = !alreadyReplaced && (loginId && activeLogin
    ? loginId === activeLogin : !tabToken || !rememberedToken || tabToken === rememberedToken)
  if (ownsSession) {
    for (const key of sessionKeys) localStorage.removeItem(key)
    localStorage.removeItem(BROWSER_SESSION_KEY)
    if (tabToken) localStorage.setItem(ACTIVE_LOGIN_KEY, `signed-out:${loginId || newLoginSessionId()}`)
  }
}

export function getSavedUser() {
  try {
    if (!getToken()) return null
    return JSON.parse(sessionStorage.getItem('user') || localStorage.getItem('user'))
  } catch {
    clearSession()
    return null
  }
}

export function updateSessionTokens(token, refreshTokenKey) {
  hydrateTabSession()
  const currentToken = sessionStorage.getItem('token')
  if (!currentToken || typeof token !== 'string' || !token.trim()) return false
  const mirrorsRememberedSession = localStorage.getItem('token') === currentToken

  sessionStorage.setItem('token', token.trim())
  if (typeof refreshTokenKey === 'string' && refreshTokenKey.trim()) {
    sessionStorage.setItem('refreshTokenKey', refreshTokenKey.trim())
  }

  if (mirrorsRememberedSession) {
    localStorage.setItem('token', token.trim())
    if (typeof refreshTokenKey === 'string' && refreshTokenKey.trim()) {
      localStorage.setItem('refreshTokenKey', refreshTokenKey.trim())
    }
  }
  return true
}

export function getLoginData(body) {
  // Auth endpoints may return AuthResponse directly or inside an ApiResponse.
  if (body?.success === false || Number(body?.statusCode) >= 400) {
    throw new Error(getLoginErrorMessage({ response: { data: body, status: body?.statusCode } }))
  }

  const data = body?.data ?? body
  const token = [data?.token, data?.accessToken]
    .find(value => typeof value === 'string' && value.trim())
  if (!token) {
    throw new Error('Máy chủ không trả về phiên đăng nhập hợp lệ. Vui lòng thử lại.')
  }

  return { ...data, token: token.trim() }
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
  sessionStorage.removeItem(replacedSessionKey)
  // A new non-remembered login must also retire an older remembered account.
  for (const key of sessionKeys) localStorage.removeItem(key)
  const refreshTokenKey = userData?.refreshTokenKey || userData?.refreshToken
  const loginSessionId = newLoginSessionId()
  const storages = [sessionStorage, localStorage]

  for (const storage of storages) {
    storage.setItem('user', JSON.stringify(user))
    storage.setItem('token', accessToken.trim())
    storage.setItem('loginSessionId', loginSessionId)
    if (typeof refreshTokenKey === 'string' && refreshTokenKey.trim()) {
      storage.setItem('refreshTokenKey', refreshTokenKey.trim())
    }
  }
  if (remember) {
    localStorage.removeItem(BROWSER_SESSION_KEY)
    getBrowserSessionPresence().stop()
  } else {
    localStorage.setItem(BROWSER_SESSION_KEY, loginSessionId)
    getBrowserSessionPresence().start(loginSessionId)
  }
  // Publish last so other tabs never observe a half-written login.
  localStorage.setItem(ACTIVE_LOGIN_KEY, loginSessionId)
  return user
}

export function isManagerRole(role) {
  return ['manager', 'centermanager'].includes(String(role || '').toLowerCase().replace(/[\s_-]/g, ''))
}

export function canUsePayments(role) {
  return isManagerRole(role) || ['member', 'receptionist'].includes(String(role || '').trim().toLowerCase())
}

export function getLoginRedirectPath({ pathname, search = '', hash = '' }) {
  return /^\/payment\/(?:success|cancel)$/.test(pathname)
    ? `/login?returnTo=${encodeURIComponent(`${pathname}${search}${hash}`)}` : '/login'
}

export function getAuthDestination(role, from) {
  // Only return routes supported by the app and accessible to this role.
  if (from === '/' || from === '/#memberships') return from
  if (canUsePayments(role) && typeof from === 'string' && /^\/payment\/(?:success|cancel)(?:\?[^#]*)?(?:#.*)?$/.test(from)) return from
  if (isManagerRole(role)) return '/manager'
  if (role === 'coach') return '/coach'
  if (role === 'receptionist') return '/receptionist'
  if (role === 'member') {
    if (typeof from === 'string' && /^\/member(?:\?[^#]*)?(?:#.*)?$/.test(from)) return from
    return '/member'
  }
  return '/'
}

export function getAuthErrorMessage(error, fallback) {
  const body = error?.response?.data
  const details = body?.errors
  const messages = (Array.isArray(details) ? details : details && typeof details === 'object' ? Object.values(details).flat() : [details])
    .filter(value => typeof value === 'string' && value.trim())
  const serverMessage = [body?.message, body?.detail, typeof body === 'string' ? body : null]
    .find(value => typeof value === 'string' && value.trim())
  // Translate the backend's credential error without replacing OTP or validation errors.
  if ([...messages, serverMessage].some(value => typeof value === 'string' && /^Invalid email or password\.?$/i.test(value.trim()))) {
    return 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại hoặc chọn Quên mật khẩu.'
  }
  if (messages.length) return messages.join(' ')
  if (typeof body?.message === 'string' && body.message.trim()) return body.message
  if (typeof body?.detail === 'string' && body.detail.trim()) return body.detail
  if (error.response?.status === 401) return 'Email hoặc mật khẩu không chính xác.'
  if (error.response?.status === 409) return 'Email đã được đăng ký. Vui lòng dùng email khác hoặc đăng nhập.'
  if (['ECONNABORTED', 'ETIMEDOUT'].includes(error.code)) return 'Máy chủ phản hồi quá lâu. Vui lòng thử lại sau ít phút.'
  if (error.isAxiosError && !error.response) return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.'
  return error.isAxiosError ? fallback : error.message || fallback
}

export function getLoginErrorMessage(error) {
  const fallback = 'Đăng nhập không thành công. Vui lòng thử lại.'
  const invalidCredentials = 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại hoặc chọn Quên mật khẩu.'
  const body = error?.response?.data
  const status = Number(error?.response?.status || body?.statusCode)
  const details = body?.errors
  const messages = [
    body?.message, body?.detail, typeof body === 'string' ? body : null, error?.message,
    ...(Array.isArray(details) ? details : details && typeof details === 'object' ? Object.values(details).flat() : [details]),
  ].filter(value => typeof value === 'string')

  // Development responses can include a .NET exception followed by a stack trace.
  const credentialError = /^(?:System\.UnauthorizedAccessException:\s*)?Invalid email or password\.?\s*$/im
  if (status === 401 || messages.some(value => credentialError.test(value.trim()))) {
    return invalidCredentials
  }
  if (status >= 500) return 'Máy chủ gặp sự cố. Vui lòng thử lại sau.'

  return getAuthErrorMessage(error ?? {}, fallback)
}
