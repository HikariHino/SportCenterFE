import axios from 'axios'

import { clearSession, getAccessTokenExpiry, getLoginRedirectPath, getLoginSessionId, getRefreshTokenKey, getToken, reconcileBrowserSession, SESSION_EXPIRED_EVENT, updateSessionTokens } from '../utils/auth'
import { isCoachDemoLocation } from '../utils/coachDemoAccess'

const baseURL = import.meta.env.VITE_API_BASE || '/api'

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

const refreshRequests = new Map()
const isCurrentSession = id => Boolean(getToken()) && getLoginSessionId() === id
const changedSession = config => new axios.CanceledError('Phiên đăng nhập đã thay đổi.', config)
const isTerminalRefreshError = error => [400, 401, 403].includes(error.response?.status) || error.sessionInvalid

function expireSession(id) {
  if (id && !isCurrentSession(id)) return
  clearSession()
  if (typeof window.dispatchEvent === 'function' && typeof window.Event === 'function') {
    window.dispatchEvent(new window.Event(SESSION_EXPIRED_EVENT))
  }
  if (window.location.pathname !== '/login') window.location.href = getLoginRedirectPath(window.location)
}

function sessionError(config) {
  const error = new axios.AxiosError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'ERR_SESSION_EXPIRED', config)
  error.response = { status: 401, data: { message: error.message }, config }
  config._retry = true
  return error
}

function invalidRefresh() {
  return Object.assign(new Error('Không nhận được phiên đăng nhập mới. Vui lòng đăng nhập lại.'), { sessionInvalid: true })
}

function refreshAccessToken(sessionId, rejectedToken) {
  if (refreshRequests.has(sessionId)) return refreshRequests.get(sessionId)
  const renew = async () => {
    if (!isCurrentSession(sessionId)) throw changedSession()
    // A late 401 or another browser tab may already have a newer token.
    if (getToken() !== rejectedToken) return getToken()
    const refreshTokenKey = getRefreshTokenKey()
    if (!refreshTokenKey) throw invalidRefresh()
    const response = await axios.post(`${baseURL}/Auth/refresh-token`, { refreshTokenKey }, {
      headers: { 'Content-Type': 'application/json' }, timeout: 15000,
    })
    if (!isCurrentSession(sessionId)) throw changedSession()
    const body = response.data
    const data = body?.data ?? body
    const token = data?.token || data?.accessToken
    if (body?.success === false || Number(body?.statusCode) >= 400 || typeof token !== 'string' || !token.trim()) throw invalidRefresh()
    const expiresAt = getAccessTokenExpiry(token)
    if (expiresAt !== null && expiresAt <= Date.now()) throw invalidRefresh()
    if (!updateSessionTokens(token.trim(), data?.refreshTokenKey || data?.refreshToken || refreshTokenKey)) throw changedSession()
    return token.trim()
  }
  // Refresh tokens are single-use. Tabs sharing one remembered login serialize
  // renewal and reuse the credentials written by the tab that renewed first.
  const locks = globalThis.navigator?.locks
  const request = Promise.resolve().then(() => locks?.request
    ? locks.request(`sportcenter:refresh:${sessionId}`, renew) : renew())
    .finally(() => { if (refreshRequests.get(sessionId) === request) refreshRequests.delete(sessionId) })
  refreshRequests.set(sessionId, request)
  return request
}

api.interceptors.request.use(async config => {
  if (config.skipAuth) return config
  if (!reconcileBrowserSession()) throw changedSession(config)
  let token = getToken()
  if (!token) return config
  const sessionId = getLoginSessionId()
  if (config._authSessionId && config._authSessionId !== sessionId) throw changedSession(config)
  config._authSessionId = sessionId
  const expiresAt = getAccessTokenExpiry(token)
  const demo = isCoachDemoLocation(globalThis.window?.location, import.meta.env.DEV)
  if (!demo && (refreshRequests.has(sessionId)
    || (expiresAt !== null && expiresAt <= Date.now() + (getRefreshTokenKey() ? 30000 : 0)))) {
    try { token = await refreshAccessToken(sessionId, token) }
    catch (error) {
      if (isTerminalRefreshError(error)) {
        if (getToken() && !isCurrentSession(sessionId)) throw changedSession(config)
        expireSession(sessionId)
        throw sessionError(config)
      }
      throw error
    }
  }
  if (!isCurrentSession(sessionId)) throw changedSession(config)
  config.headers.Authorization = `Bearer ${token}`
  return config
}, error => Promise.reject(error))

api.interceptors.response.use(response => {
  if (response.config?._authSessionId && !isCurrentSession(response.config._authSessionId)) throw changedSession(response.config)
  return response
}, async error => {
  const config = error.config
  if (error.code === 'ERR_SESSION_EXPIRED') return Promise.reject(error)
  if (error.response?.status !== 401 || config?.skipAuth) return Promise.reject(error)
  if (isCoachDemoLocation(globalThis.window?.location, import.meta.env.DEV)) return Promise.reject(error)
  const sessionId = config?._authSessionId
  if (sessionId && !isCurrentSession(sessionId)) return Promise.reject(changedSession(config))
  if (!config || config._retry || !getToken()) {
    expireSession(sessionId)
    return Promise.reject(error)
  }
  config._retry = true
  try {
    const rejectedToken = config.headers?.Authorization?.replace(/^Bearer /, '')
    const token = await refreshAccessToken(sessionId, rejectedToken)
    config.headers.Authorization = `Bearer ${token}`
    return api(config)
  } catch (refreshError) {
    if (isTerminalRefreshError(refreshError)) {
      expireSession(sessionId)
      return Promise.reject(error)
    }
    // A network outage during renewal can recover on a later background read.
    return Promise.reject(refreshError)
  }
})

export default api
