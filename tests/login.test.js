import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { ACTIVE_LOGIN_KEY, getRefreshTokenKey, getAccessTokenExpiry } from '../src/utils/auth.js'
import { canUsePayments, clearSession, getAuthDestination, getAuthErrorMessage, getLoginData, getLoginErrorMessage, getLoginRedirectPath, getLoginSessionId, getSavedUser, getToken, saveSession, updateSessionTokens } from '../src/utils/auth.js'

function memoryStorage() {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
}

beforeEach(() => {
  globalThis.localStorage = memoryStorage()
  globalThis.sessionStorage = memoryStorage()
})

const authResponse = {
  userId: 12,
  email: 'member@example.test',
  fullName: 'Test Member',
  role: 'Member',
  token: 'test-access-token',
  refreshTokenKey: 'test-refresh-token',
}

test('login identity survives token refresh but changes on every explicit login, preserving cached chats', () => {
  localStorage.setItem('sportcenter.ai.conversations.v1:12', 'saved-conversations')
  saveSession(authResponse, authResponse.token, true)
  const loginId = getLoginSessionId()
  assert.ok(loginId)
  assert.equal(localStorage.getItem('loginSessionId'), loginId)
  updateSessionTokens('refreshed-token', 'refreshed-key')
  assert.equal(getLoginSessionId(), loginId)
  // Rehydrating a remembered login in a new tab keeps its login identity.
  globalThis.sessionStorage = memoryStorage()
  assert.equal(getToken(), 'refreshed-token')
  assert.equal(getLoginSessionId(), loginId)
  clearSession()
  assert.equal(localStorage.getItem('sportcenter.ai.conversations.v1:12'), 'saved-conversations')
  saveSession(authResponse, authResponse.token, false)
  assert.notEqual(getLoginSessionId(), loginId)
  assert.equal(localStorage.getItem('loginSessionId'), null)
  assert.equal(localStorage.getItem('sportcenter.ai.conversations.v1:12'), 'saved-conversations')
})

test('payment returns are available to BE payment roles while external redirects and unrelated roles remain blocked', () => {
  const callback = '/payment/success?orderCode=15&status=PAID#receipt'
  for (const role of ['member', 'receptionist', 'manager', 'centermanager']) {
    assert.equal(canUsePayments(role), true)
    assert.equal(getAuthDestination(role, callback), callback)
    assert.notEqual(getAuthDestination(role, 'https://example.com/payment/success'), 'https://example.com/payment/success')
  }
  for (const role of ['coach', 'admin', '', undefined]) assert.equal(canUsePayments(role), false)
  assert.equal(getAuthDestination('coach', callback), '/coach')
  const login = getLoginRedirectPath({ pathname: '/payment/cancel', search: '?orderCode=15&cancel=true', hash: '#receipt' })
  const from = new URLSearchParams(login.split('?')[1]).get('returnTo')
  assert.equal(from, '/payment/cancel?orderCode=15&cancel=true#receipt')
  assert.equal(getAuthDestination('member', from), from)
  assert.equal(getLoginRedirectPath({ pathname: '/manager', search: '?view=users' }), '/login')
})

test('payment callbacks survive sign-in with their order code and cannot redirect to external URLs', () => {
  for (const path of ['/payment/success?orderCode=15&status=PAID', '/payment/cancel?orderCode=15&cancel=true']) {
    assert.equal(getAuthDestination('member', path), path)
  }
  for (const path of ['https://example.com/payment/success', '//example.com/payment/success', '/payment/success/other', '/manager']) {
    assert.equal(getAuthDestination('member', path), '/member')
  }
  assert.equal(getAuthDestination('coach', '/payment/success?orderCode=15'), '/coach')
})

test('direct AuthResponse without success logs in, persists the session and selects the member route', () => {
  const data = getLoginData(authResponse)
  const user = saveSession(data, data.token, true)
  assert.equal(getAuthDestination(user.role), '/member')
  assert.deepEqual(getSavedUser(), user)
  assert.equal(localStorage.getItem('token'), authResponse.token)
  assert.equal(localStorage.getItem('refreshTokenKey'), authResponse.refreshTokenKey)
  assert.equal(sessionStorage.getItem('token'), authResponse.token)
})

test('wrapped response keeps login compatibility and remember=false uses session storage', () => {
  const data = getLoginData({ success: true, statusCode: 200, data: { ...authResponse, role: 'Coach' } })
  const user = saveSession(data, data.token, false)
  assert.equal(getAuthDestination(user.role), '/coach')
  assert.deepEqual(getSavedUser(), user)
  assert.equal(sessionStorage.getItem('refreshTokenKey'), authResponse.refreshTokenKey)
  assert.equal(localStorage.getItem('token'), null)
})

test('accessToken alias and wrapper without success are supported', () => {
  for (const wrap of [data => data, data => ({ data })]) {
    const data = getLoginData(wrap({ ...authResponse, token: undefined, accessToken: 'new-access-token', role: 'Manager' }))
    const user = saveSession(data, data.token)
    assert.equal(localStorage.getItem('token'), 'new-access-token')
    assert.equal(getAuthDestination(user.role), '/manager')
  }
})

test('a new browser login retires the old tab without adopting or deleting the new account', () => {
  const coachTabStorage = sessionStorage
  const coach = saveSession({ ...authResponse, role: 'Coach', token: 'coach-token' }, 'coach-token', true)

  const receptionistTabStorage = memoryStorage()
  globalThis.sessionStorage = receptionistTabStorage
  const receptionist = saveSession({ ...authResponse, userId: 15, role: 'Receptionist', token: 'receptionist-token' }, 'receptionist-token', true)

  assert.equal(getToken(), 'receptionist-token')
  assert.deepEqual(getSavedUser(), receptionist)

  globalThis.sessionStorage = coachTabStorage
  assert.equal(getToken(), null)
  assert.equal(getSavedUser(), null)
  clearSession()
  assert.equal(getToken(), null)
  assert.equal(localStorage.getItem('token'), 'receptionist-token')
  globalThis.sessionStorage = receptionistTabStorage
  assert.deepEqual(getSavedUser(), receptionist)
})

test('a private tab without a refresh token never borrows another remembered account refresh token', () => {
  saveSession(authResponse, authResponse.token, true)
  sessionStorage.setItem('token', 'private-token')
  sessionStorage.setItem('loginSessionId', 'different-login')
  sessionStorage.removeItem('refreshTokenKey')
  assert.equal(getToken(), null)
  assert.equal(getRefreshTokenKey(), null)
  assert.equal(localStorage.getItem('refreshTokenKey'), authResponse.refreshTokenKey)
})

for (const oldRemember of [false, true]) for (const newRemember of [false, true]) {
  test(`new login retires old tabs with remember=${oldRemember}/${newRemember}, including after reload`, () => {
    saveSession(authResponse, 'old-token', oldRemember)
    const oldTab = sessionStorage
    globalThis.sessionStorage = memoryStorage()
    saveSession({ ...authResponse, userId: 15 }, 'new-token', newRemember)
    const newTab = sessionStorage
    globalThis.sessionStorage = oldTab
    assert.equal(getToken(), null)
    assert.equal(getSavedUser(), null)
    assert.equal(getRefreshTokenKey(), null)
    assert.equal(updateSessionTokens('late-old-refresh', 'late-refresh'), false)
    clearSession()
    assert.equal(getToken(), null, 'reload cannot silently adopt the new account')
    globalThis.sessionStorage = newTab
    assert.equal(getToken(), 'new-token')
    globalThis.sessionStorage = memoryStorage()
    assert.equal(getToken(), newRemember ? 'new-token' : null, 'fresh tabs only restore remembered credentials')
  })
}

test('same remembered login may share refreshed tokens across tabs without eviction', () => {
  saveSession(authResponse, 'old-token', true)
  const firstTab = sessionStorage
  const identity = localStorage.getItem(ACTIVE_LOGIN_KEY)
  globalThis.sessionStorage = memoryStorage()
  assert.equal(getToken(), 'old-token')
  updateSessionTokens('renewed-token', 'renewed-key')
  globalThis.sessionStorage = firstTab
  assert.equal(getToken(), 'renewed-token')
  assert.equal(getRefreshTokenKey(), 'renewed-key')
  assert.equal(localStorage.getItem(ACTIVE_LOGIN_KEY), identity)
})

test('failed login cannot evict the current session', () => {
  saveSession(authResponse, 'current-token', true)
  const identity = localStorage.getItem(ACTIVE_LOGIN_KEY)
  assert.throws(() => saveSession({}, ' '))
  assert.equal(getToken(), 'current-token')
  assert.equal(localStorage.getItem(ACTIVE_LOGIN_KEY), identity)
})

for (const remember of [false, true]) {
  test(`logging out one tab retires all copies of the same session, remember=${remember}`, () => {
    saveSession(authResponse, 'old-token', remember)
    const firstTab = sessionStorage
    const keys = ['user', 'token', 'refreshTokenKey', 'loginSessionId']
    const secondTab = memoryStorage()
    for (const key of keys) secondTab.setItem(key, firstTab.getItem(key))
    globalThis.sessionStorage = secondTab
    updateSessionTokens('new-token', 'new-refresh')
    clearSession()
    assert.equal(getToken(), null)
    globalThis.sessionStorage = firstTab
    assert.equal(getToken(), null)
    assert.equal(getRefreshTokenKey(), null)
    assert.equal(getSavedUser(), null)
    assert.equal(updateSessionTokens('late-token', 'late-refresh'), false)
    globalThis.sessionStorage = memoryStorage()
    assert.equal(getToken(), null, 'opening another tab cannot restore the logged-out account')
  })
}

test('logout with an older access token still retires the same login after another tab refreshes', () => {
  saveSession(authResponse, 'old-token', true)
  localStorage.setItem('token', 'refreshed-token')
  localStorage.setItem('refreshTokenKey', 'refreshed-key')
  const loginId = sessionStorage.getItem('loginSessionId')
  clearSession()
  assert.equal(localStorage.getItem('token'), null)
  assert.equal(localStorage.getItem(ACTIVE_LOGIN_KEY), `signed-out:${loginId}`)
})

test('expiry metadata supports base64url JWT payloads and opaque tokens without trusting the claims for authorization', () => {
  const token = `header.${Buffer.from(JSON.stringify({ exp: 1900000000, note: 'é🙂' })).toString('base64url')}.signature`
  assert.equal(getAccessTokenExpiry(token), 1900000000000)
  for (const value of [undefined, '', 'opaque-token', 'a.!invalid!.c', `a.${Buffer.from('{"exp":"1900000000"}').toString('base64url')}.c`]) {
    assert.equal(getAccessTokenExpiry(value), null)
  }
})

test('explicit API failure is rejected even if a token is present', () => {
  assert.throws(() => getLoginData({ success: false, message: 'Access denied', data: authResponse }), /Access denied/)
  assert.throws(() => getLoginData({ ...authResponse, statusCode: 401, message: 'Invalid email or password.' }), /Email/)
  assert.equal(getSavedUser(), null)
})

test('empty or malformed success responses cannot create a session', () => {
  for (const body of [null, undefined, '', '<html>Not an API response</html>', {}, { success: true }, { data: { token: '   ' } }, { token: 123 }]) {
    assert.throws(() => getLoginData(body), /phiên đăng nhập hợp lệ/)
  }
  assert.equal(getSavedUser(), null)
})

test('HTTP credential errors are translated while validation and OTP errors are preserved', () => {
  assert.match(getAuthErrorMessage({ response: { status: 401, data: { message: 'Invalid email or password.' } } }, 'fallback'), /Email/)
  assert.equal(getAuthErrorMessage({ response: { status: 400, data: { errors: { email: ['Email required'] } } } }, 'fallback'), 'Email required')
  assert.equal(getAuthErrorMessage({ response: { status: 401, data: { message: 'OTP expired' } } }, 'fallback'), 'OTP expired')
})

test('credential failures are translated from problem details, raw text and validation errors', () => {
  for (const body of [{ detail: 'Invalid email or password.' }, 'Invalid email or password.', { errors: ['Invalid email or password.'] }]) {
    assert.match(getAuthErrorMessage({ response: { status: 401, data: body } }, 'fallback'), /Email hoặc mật khẩu không chính xác/)
  }
  assert.equal(getAuthErrorMessage({ response: { status: 400, data: { detail: 'OTP expired' } } }, 'fallback'), 'OTP expired')
})

test('login timeouts are distinguished from connection failures', () => {
  assert.match(getAuthErrorMessage({ isAxiosError: true, code: 'ECONNABORTED' }, 'fallback'), /phản hồi quá lâu/)
  assert.match(getAuthErrorMessage({ isAxiosError: true, code: 'ETIMEDOUT' }, 'fallback'), /phản hồi quá lâu/)
  assert.match(getAuthErrorMessage({ isAxiosError: true, code: 'ERR_NETWORK' }, 'fallback'), /Không thể kết nối/)
})

test('login handles unauthorized JSON, empty and HTML responses with a credential message', () => {
  for (const data of [undefined, '', '<html>Unauthorized</html>', { message: 'Invalid email or password.' }]) {
    assert.match(getLoginErrorMessage({ isAxiosError: true, response: { status: 401, data } }), /Email hoặc mật khẩu không chính xác/)
  }
})

test('login translates credential exceptions without exposing the backend stack trace', () => {
  const trace = 'System.UnauthorizedAccessException: Invalid email or password.\r\n   at SportsCenterAPI.Services.Implement.AuthService.LoginAsync(LoginRequestDTO request) in AuthService.cs:line 45'
  for (const data of [trace, { message: trace }, { detail: trace }, { errors: { credentials: [trace] } }]) {
    const message = getLoginErrorMessage({ isAxiosError: true, response: { status: 500, data } })
    assert.match(message, /Email hoặc mật khẩu không chính xác/)
    assert.doesNotMatch(message, /Exception|AuthService|line 45/)
  }
  assert.match(getLoginErrorMessage(new Error(trace)), /Email hoặc mật khẩu không chính xác/)
})

test('login server failures are not misreported as invalid credentials', () => {
  const message = getLoginErrorMessage({ isAxiosError: true, response: { status: 500, data: { message: 'System.InvalidOperationException: database unavailable' } } })
  assert.match(message, /Máy chủ gặp sự cố/)
  assert.doesNotMatch(message, /mật khẩu|Exception|database/)
})

test('login preserves validation, timeout and network errors', () => {
  assert.equal(getLoginErrorMessage({ response: { status: 400, data: { errors: { email: ['Email required'] } } } }), 'Email required')
  assert.match(getLoginErrorMessage({ isAxiosError: true, code: 'ECONNABORTED' }), /phản hồi quá lâu/)
  assert.match(getLoginErrorMessage({ isAxiosError: true, code: 'ERR_NETWORK' }), /Không thể kết nối/)
  assert.match(getLoginErrorMessage(undefined), /Đăng nhập không thành công/)
})

test('failed login bodies with exception details never produce a session', () => {
  assert.throws(() => getLoginData({ statusCode: 500, message: 'System.UnauthorizedAccessException: Invalid email or password.' }), /Email hoặc mật khẩu không chính xác/)
  assert.equal(getSavedUser(), null)
  assert.equal(localStorage.getItem('token'), null)
  assert.equal(sessionStorage.getItem('token'), null)
})
