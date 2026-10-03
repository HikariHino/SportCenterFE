import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { getAuthDestination, getAuthErrorMessage, getLoginData, getSavedUser, saveSession } from '../src/utils/auth.js'

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

test('direct AuthResponse without success logs in, persists the session and selects the member route', () => {
  const data = getLoginData(authResponse)
  const user = saveSession(data, data.token, true)
  assert.equal(getAuthDestination(user.role), '/member')
  assert.deepEqual(getSavedUser(), user)
  assert.equal(localStorage.getItem('token'), authResponse.token)
  assert.equal(localStorage.getItem('refreshTokenKey'), authResponse.refreshTokenKey)
  assert.equal(sessionStorage.getItem('token'), null)
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
