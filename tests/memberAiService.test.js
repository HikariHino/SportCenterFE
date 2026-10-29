import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, api, service
const storageDescriptors = new Map()
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    storageDescriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  service = await server.ssrLoadModule('/src/services/memberAiService.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of storageDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

test('chat sends only the trimmed question and uses the existing authenticated client', async () => {
  const controller = new AbortController()
  api.defaults.adapter = async config => {
    assert.equal(config.url, '/ai/chat')
    assert.equal(config.method, 'post')
    assert.deepEqual(JSON.parse(config.data), { question: 'Lịch học của tôi?' })
    assert.equal(config.signal, controller.signal)
    assert.equal(config.timeout, 90000)
    assert.notEqual(config.skipAuth, true)
    return { data: { success: true, data: { answer: '  Thứ hai lúc 18:00.\nHLV An.  ' } }, status: 200, headers: {}, config }
  }
  assert.equal(await service.askMemberAi('  Lịch học của tôi?  ', { signal: controller.signal }), 'Thứ hai lúc 18:00.\nHLV An.')
})

test('empty and overlong questions never reach the server; 1000 characters is accepted', async () => {
  let calls = 0
  api.defaults.adapter = async config => {
    calls++
    return { data: { data: { answer: 'OK' } }, status: 200, headers: {}, config }
  }
  for (const question of ['', ' \n ', null, 'a'.repeat(1001)]) await assert.rejects(service.askMemberAi(question))
  assert.equal(calls, 0)
  assert.equal(await service.askMemberAi('a'.repeat(1000)), 'OK')
  assert.equal(calls, 1)
})

test('failed envelopes and missing answers cannot appear as a successful AI reply', async () => {
  for (const body of [{ success: false, message: 'Không tìm thấy hồ sơ hội viên.' }, { success: true, data: { answer: '' } }, { data: { answer: {} } }, { message: 'OK' }]) {
    api.defaults.adapter = async config => ({ data: body, status: 200, headers: {}, config })
    await assert.rejects(service.askMemberAi('Câu hỏi'))
  }
})

test('cancelling prevents an in-flight request from becoming a successful reply', async () => {
  const controller = new AbortController()
  api.defaults.adapter = async config => {
    controller.abort()
    return { data: { data: { answer: 'Late answer' } }, status: 200, headers: {}, config }
  }
  await assert.rejects(service.askMemberAi('Câu hỏi', { signal: controller.signal }), error => error.code === 'ERR_CANCELED')
})

test('AI outages, permission failures and timeouts produce member-friendly messages', () => {
  const error = (status, message) => ({ response: { status, data: { message } } })
  assert.match(service.getMemberAiErrorMessage(error(403)), /hội viên/)
  assert.match(service.getMemberAiErrorMessage(error(401)), /đăng nhập/)
  assert.match(service.getMemberAiErrorMessage(error(429)), /chờ/)
  assert.match(service.getMemberAiErrorMessage(error(503, 'AI:ApiKey missing')), /tạm thời không khả dụng/)
  assert.match(service.getMemberAiErrorMessage(error(504)), /quá lâu/)
  assert.match(service.getMemberAiErrorMessage({ code: 'ECONNABORTED' }), /quá lâu/)
  assert.match(service.getMemberAiErrorMessage({ code: 'ERR_NETWORK' }), /kết nối/)
  assert.equal(service.getMemberAiErrorMessage(error(404, 'Không tìm thấy hồ sơ hội viên.')), 'Không tìm thấy hồ sơ hội viên.')
  assert.equal(service.getMemberAiErrorMessage({ response: { status: 400, data: { errors: { Question: ['Câu hỏi tối đa 1000 ký tự.'] } } } }), 'Câu hỏi tối đa 1000 ký tự.')
})

test('workout recommendations send the chosen goal, level and days without a member ID', async () => {
  const controller = new AbortController()
  api.defaults.adapter = async config => {
    assert.equal(config.url, '/ai/workout-recommendations')
    assert.equal(config.method, 'post')
    assert.deepEqual(JSON.parse(config.data), { goal: 'Tăng cơ', level: 'Intermediate', daysPerWeek: 4 })
    assert.equal(config.signal, controller.signal)
    assert.equal(config.timeout, 90000)
    assert.notEqual(config.skipAuth, true)
    return { data: { success: true, data: { answer: '  ## Lịch tập 4 ngày\n\nNội dung gợi ý.  ' } }, status: 200, headers: {}, config }
  }
  assert.equal(await service.getMemberWorkoutRecommendation({ memberId: 987, goal: '  Tăng cơ  ', level: 'Intermediate', daysPerWeek: '4' }, { signal: controller.signal }), '## Lịch tập 4 ngày\n\nNội dung gợi ý.')
})

test('invalid workout settings are rejected before any request reaches the server', async () => {
  let calls = 0
  api.defaults.adapter = async config => { calls++; return { data: { data: { answer: 'OK' } }, status: 200, headers: {}, config } }
  const valid = { goal: 'Tăng cơ', level: 'Beginner', daysPerWeek: 3 }
  for (const request of [null, {}, { ...valid, goal: '  ' }, { ...valid, goal: 'a'.repeat(201) },
    { ...valid, level: 'Expert' }, ...[0, 8, 1.5, '', true, undefined].map(daysPerWeek => ({ ...valid, daysPerWeek }))]) {
    await assert.rejects(service.getMemberWorkoutRecommendation(request), error => Boolean(error.fieldErrors && Object.keys(error.fieldErrors).length))
  }
  assert.equal(calls, 0)
  for (const level of ['Beginner', 'Intermediate', 'Advanced']) {
    for (const daysPerWeek of [1, 7]) await service.getMemberWorkoutRecommendation({ goal: 'a'.repeat(200), level, daysPerWeek })
  }
  assert.equal(calls, 6)
})

test('workout failures and empty responses do not become valid recommendations', async () => {
  const request = { goal: 'Tăng sức bền', level: 'Beginner', daysPerWeek: 3 }
  for (const data of [{ success: false, message: 'Dịch vụ AI đang gián đoạn.' }, { data: { answer: ' ' } }, { data: { items: [] } }]) {
    api.defaults.adapter = async config => ({ data, status: 200, headers: {}, config })
    await assert.rejects(service.getMemberWorkoutRecommendation(request))
  }
  const controller = new AbortController()
  api.defaults.adapter = async config => {
    controller.abort()
    return { data: { data: { answer: 'Kết quả đến muộn' } }, status: 200, headers: {}, config }
  }
  await assert.rejects(service.getMemberWorkoutRecommendation(request, { signal: controller.signal }), error => error.code === 'ERR_CANCELED')
})
