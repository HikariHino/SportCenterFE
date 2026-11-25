import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'

let server, api, service
const descriptors = new Map()
const plan = { id: 7, status: 'Active', startDate: '2020-01-01T00:00:00Z' }
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  service = await server.ssrLoadModule('/src/services/trainingPlanService.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})
function setup({ plans = [plan], result = { ...plan, status: 'Completed' }, failure, readFailure } = {}) {
  const calls = []
  api.defaults.adapter = async config => {
    calls.push({ url: config.url, method: config.method, data: config.data && JSON.parse(config.data) })
    if (readFailure && config.method === 'get') throw new Error('History unavailable')
    if (failure && config.method === 'post') throw Object.assign(new Error('Rejected'), { response: { status: failure } })
    return { config, status: 200, headers: {}, data: { success: true,
      data: config.url === '/members/me' ? { memberId: 9 } : config.method === 'get' ? plans : result } }
  }
  return calls
}
test('Member completion resolves their own member ID and confirms the returned plan before success', async () => {
  const calls = setup()
  assert.equal((await service.completeMyTrainingPlan(7)).status, 'Completed')
  assert.deepEqual(calls.map(call => call.url), ['/members/me', '/TrainingPlans/members/9', '/TrainingPlans/7/complete'])
  assert.ok(calls.every(call => !call.url.endsWith('/status')))
})
test('completed plans need no second write, and unavailable, foreign or future plans never send completion', async () => {
  const existing = setup({ plans: [{ ...plan, status: 'Completed' }] })
  assert.equal((await service.completeMyTrainingPlan(7)).status, 'Completed')
  assert.ok(existing.every(call => call.method === 'get'))
  for (const options of [{ plans: [] }, { plans: [{ ...plan, id: 99 }] }, { plans: [{ ...plan, status: 'Cancelled' }] },
    { plans: [{ ...plan, startDate: '2099-01-01T00:00:00Z' }] }, { readFailure: true }]) {
    const calls = setup(options)
    await assert.rejects(service.completeMyTrainingPlan(7))
    assert.ok(calls.every(call => call.method === 'get'))
  }
})
test('completion cannot report another plan or an unchanged server status as completed', async () => {
  for (const result of [null, { ...plan, id: 99, status: 'Completed' }, plan]) {
    setup({ result }); await assert.rejects(service.completeMyTrainingPlan(7), /Chưa xác nhận/)
  }
  setup({ failure: 403 }); await assert.rejects(service.completeMyTrainingPlan(7), /Rejected/)
  setup({ failure: 404 }); await assert.rejects(service.completeMyTrainingPlan(7), /Máy chủ chưa hỗ trợ/)
})
test('change requests trim text, enforce limits and recheck the saved active plan', async () => {
  const calls = setup()
  await service.requestMyTrainingPlanChange(7, '  Đổi bài tập  ')
  assert.deepEqual(calls.at(-1), { url: '/TrainingPlans/7/request-change', method: 'post', data: { reason: 'Đổi bài tập' } })
  const invalid = setup()
  for (const reason of ['', ' ', null, 'a'.repeat(1001)]) await assert.rejects(service.requestMyTrainingPlanChange(7, reason))
  assert.equal(invalid.length, 0)
  const completed = setup({ plans: [{ ...plan, status: 'Completed' }] })
  await assert.rejects(service.requestMyTrainingPlanChange(7, 'Đổi bài'), /đang áp dụng/)
  assert.ok(completed.every(call => call.method === 'get'))
})
