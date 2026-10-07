import axios from 'axios'

import { clearSession, getRefreshTokenKey, getToken, updateSessionTokens } from '../utils/auth'

const baseURL = import.meta.env.VITE_API_BASE || '/api'

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

let refreshRequest = null

function extractTokenData(body) {
  const data = body?.data ?? body
  return {
    token: data?.token || data?.accessToken,
    refreshTokenKey: data?.refreshTokenKey || data?.refreshToken,
  }
}

async function refreshAccessToken() {
  const refreshTokenKey = getRefreshTokenKey()
  if (!refreshTokenKey) throw new Error('Không có refresh token.')

  if (!refreshRequest) {
    refreshRequest = axios.post(`${baseURL}/Auth/refresh-token`, { refreshTokenKey }, {
      headers: { 'Content-Type': 'application/json' },
    }).then((response) => {
      const tokens = extractTokenData(response.data)
      if (!tokens.token) throw new Error('Máy chủ không trả về access token mới.')
      updateSessionTokens(tokens.token, tokens.refreshTokenKey || refreshTokenKey)
      return tokens.token
    }).finally(() => {
      refreshRequest = null
    })
  }

  return refreshRequest
}

// Request interceptor - attach token
api.interceptors.request.use(
  (config) => {
    const token = config.skipAuth ? null : getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config
    if (error.response?.status !== 401 || config?.skipAuth) {
      return Promise.reject(error)
    }

    if (!config || config._retry) {
      clearSession()
      if (window.location.pathname !== '/login') window.location.href = '/login'
      return Promise.reject(error)
    }

    config._retry = true
    try {
      const token = await refreshAccessToken()
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
      return api(config)
    } catch (refreshError) {
      clearSession()
      if (window.location.pathname !== '/login') window.location.href = '/login'
      return Promise.reject(refreshError)
    }
  }
)

export default api
