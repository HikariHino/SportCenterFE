import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { canUsePayments, getAuthDestination, getAuthErrorMessage, getLoginData, getLoginErrorMessage, getLoginRedirectPath, getSavedUser, getToken, saveSession } from '../src/utils/auth.js'

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

test('each browser tab keeps its own account when another remembered login replaces local storage', () => {
  const coachTabStorage = sessionStorage
  const coach = saveSession({ ...authResponse, role: 'Coach', token: 'coach-token' }, 'coach-token', true)

  const receptionistTabStorage = memoryStorage()
  globalThis.sessionStorage = receptionistTabStorage
  const receptionist = saveSession({ ...authResponse, userId: 15, role: 'Receptionist', token: 'receptionist-token' }, 'receptionist-token', true)

  assert.equal(getToken(), 'receptionist-token')
  assert.deepEqual(getSavedUser(), receptionist)

  globalThis.sessionStorage = coachTabStorage
  assert.equal(getToken(), 'coach-token')
  assert.deepEqual(getSavedUser(), coach)
  assert.equal(localStorage.getItem('token'), 'receptionist-token')
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
