import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, api, service
const storageDescriptors = new Map()

before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    storageDescriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    configFile: false,
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    logLevel: 'error',
  })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  service = await server.ssrLoadModule('/src/services/authService.js')
})

after(async () => {
  await server?.close()
  for (const [key, descriptor] of storageDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

test('password reset request treats a successful message-only response as success', async () => {
  api.defaults.adapter = async config => {
    assert.equal(config.url, '/Auth/request-reset-password')
    assert.deepEqual(JSON.parse(config.data), { email: 'coach@sportscenter.com' })
    return { data: { message: 'OTP sent.' }, status: 200, headers: {}, config }
  }

  assert.deepEqual(await service.requestResetPassword({ email: 'coach@sportscenter.com' }), {
    message: 'OTP sent.',
    success: true,
  })
})

test('password reset verification treats a successful message-only response as success', async () => {
  api.defaults.adapter = async config => {
    assert.equal(config.url, '/Auth/verify-reset-password')
    assert.deepEqual(JSON.parse(config.data), {
      email: 'coach@sportscenter.com',
      otp: '123456',
      newPassword: 'Password@456',
      confirmPassword: 'Password@456',
    })
    return { data: { message: 'Password updated successfully.' }, status: 200, headers: {}, config }
  }

  const result = await service.verifyResetPassword({
    email: 'coach@sportscenter.com',
    otp: '123456',
    newPassword: 'Password@456',
    confirmPassword: 'Password@456',
  })
  assert.equal(result.success, true)
})

test('password reset keeps an explicit API failure', async () => {
  api.defaults.adapter = async config => ({ data: { success: false, message: 'OTP invalid.' }, status: 200, headers: {}, config })
  assert.equal((await service.requestResetPassword({ email: 'coach@sportscenter.com' })).success, false)
})
