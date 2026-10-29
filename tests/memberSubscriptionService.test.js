import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, api, service
const descriptors = new Map()
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  service = await server.ssrLoadModule('/src/services/memberSubscriptionService.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})
test('mine validates array data so an unreadable history cannot appear to be empty', async () => {
  for (const data of [[], [{ id: 1, status: 'Active' }]]) {
    api.defaults.adapter = async config => ({ data: { success: true, data }, status: 200, headers: {}, config })
    assert.deepEqual(await service.getMySubscriptions(), data)
  }
  for (const data of [null, {}, { items: [] }]) {
    api.defaults.adapter = async config => ({ data: { success: true, data }, status: 200, headers: {}, config })
    await assert.rejects(service.getMySubscriptions(), /không hợp lệ/)
  }
})
test('subscription application errors never resolve as successful reads or registrations', async () => {
  api.defaults.adapter = async config => ({ data: { statusCode: 409, message: 'Đã có gói đang hiệu lực.' }, status: 200, headers: {}, config })
  await assert.rejects(service.getMySubscriptions(), /hiệu lực/)
  await assert.rejects(service.createMemberSubscription(2), /hiệu lực/)
})
