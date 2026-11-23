import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { createWorkspaceResourceCache } from '../src/utils/workspaceResourceCache.js'

let server, api
const descriptors = new Map(), session = new Map(), remembered = new Map()
const storage = map => ({ getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) })
before(async () => {
  for (const [key, value] of Object.entries({ sessionStorage: storage(session), localStorage: storage(remembered),
    window: { location: { pathname: '/manager', search: '', href: '' } } })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

test('an expired session without a refresh token retains 401 and stops protected background reads', async () => {
  session.clear(); remembered.clear()
  session.set('token', 'expired-test-token')
  session.set('user', JSON.stringify({ id: 1, role: 'manager' }))
  let calls = 0
  const cache = createWorkspaceResourceCache()
  api.defaults.adapter = async config => {
    calls++
    throw Object.assign(new Error('Unauthorized'), { config, response: { status: 401, data: { message: 'Phiên đăng nhập không hợp lệ.' } } })
  }
  const load = () => api.get('/class-sessions/30/roster')
  await assert.rejects(cache.load('roster', load), error => error.response?.status === 401)
  for (let tick = 0; tick < 10; tick++) await assert.rejects(cache.load('roster', load, { force: true, background: true }), error => error.response?.status === 401)
  assert.equal(calls, 1)
  assert.equal(session.get('token'), undefined)
  assert.equal(window.location.href, '/login')
})

test('permission errors preserve the active session and do not trigger token refresh', async () => {
  session.clear(); remembered.clear()
  session.set('token', 'valid-test-token')
  let calls = 0
  api.defaults.adapter = async config => {
    calls++
    throw Object.assign(new Error('Forbidden'), { config, response: { status: 403, data: { message: 'Không có quyền.' } } })
  }
  await assert.rejects(api.get('/class-sessions/30/roster'), error => error.response?.status === 403)
  assert.equal(calls, 1)
  assert.equal(session.get('token'), 'valid-test-token')
})
