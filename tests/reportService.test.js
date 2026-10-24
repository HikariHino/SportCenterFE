import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, api, getClassStatusReport
const storageDescriptors = new Map()
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    storageDescriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  getClassStatusReport = (await server.ssrLoadModule('/src/services/reportService.js')).getClassStatusReport
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of storageDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

const report = (classId = 3, overrides = {}) => ({ classId, className: 'Gym Nâng Cao', coachName: 'Lê Chí Nhân',
  maxCapacity: 20, totalRegistration: 8, fillRatePercentage: 40, ...overrides })
const session = (id, overrides = {}) => ({ id, classId: 3, status: 'Scheduled', ...overrides })
const student = (memberId, registrationStatus = 'Registered', overrides = {}) => ({ memberId, registrationStatus, ...overrides })

function mockReport({ reports = [report()], sessions = {}, rosters = {}, pageSize = 2, failRoster, transformSessions, transformRoster, delay = 0 } = {}) {
  const state = { reads: [], active: 0, maxActive: 0 }
  api.defaults.adapter = async config => {
    assert.equal(config.method, 'get')
    state.reads.push({ url: config.url, params: config.params, signal: config.signal })
    state.active++
    state.maxActive = Math.max(state.maxActive, state.active)
    try {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay))
      let data
      if (config.url === '/Reports/class-status') data = reports
      else if (/^\/classes\/\d+\/sessions$/.test(config.url)) {
        const classId = Number(config.url.split('/')[2]), page = Number(config.params.page)
        const items = sessions[classId] ?? []
        data = { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page }
        if (transformSessions) data = transformSessions(data, page)
      } else if (/^\/class-sessions\/\d+\/roster$/.test(config.url)) {
        const id = Number(config.url.split('/')[2])
        if (id === failRoster) throw new Error('Không tải được danh sách học viên')
        data = rosters[id] ?? []
        if (transformRoster) data = transformRoster(data)
      } else throw new Error('Unexpected request: ' + config.url)
      return { data: { success: true, data }, status: 200, headers: {}, config }
    } finally { state.active-- }
  }
  return state
}

test('8 registrations by the same 2 members across 4 sessions produce 2/20 and 10%, loading every page', async () => {
  const sessions = { 3: [1, 2, 3, 4].map(id => session(id)) }
  const rosters = Object.fromEntries([1, 2, 3, 4].map(id => [id,
    [student(id % 2 ? 11 : '11', 'Registered', { registrationId: id * 10 }),
      student(22, 'Confirmed', { registrationId: id * 10 + 1 })]]))
  const state = mockReport({ sessions, rosters })
  assert.deepEqual(await getClassStatusReport(), [report(3, { totalRegistration: 2, fillRatePercentage: 10 })])
  assert.deepEqual(state.reads.filter(item => item.url === '/classes/3/sessions').map(item => item.params.page), [1, 2])
  assert.equal(state.reads.filter(item => item.url.endsWith('/roster')).length, 4)
})

test('exclude cancelled sessions, cancelled registrations and pending registrations; count rebooked members once', async () => {
  const state = mockReport({ sessions: { 3: [session(1), session(2, { status: ' CANCELED ' }), session(3, { status: 'Cancelled' }), session(4, { status: 'Completed' })] },
    rosters: {
      1: [student(11), student(11, 'Cancelled'), student(11, 'Registered', { registrationId: 99 }),
        student(33, ' CANCELLED '), student(44, 'Canceled'), student(55, 'Pending')],
      2: [student(66)], 3: [student(77)],
      4: [student(11, 'Attended'), student(22, 'Completed', { attendanceStatus: 'Absent' })],
    } })
  const [result] = await getClassStatusReport()
  assert.equal(result.totalRegistration, 2)
  assert.equal(result.fillRatePercentage, 10)
  assert.deepEqual(state.reads.filter(item => item.url.endsWith('/roster')).map(item => item.url).sort(),
    ['/class-sessions/1/roster', '/class-sessions/4/roster'])
})

test('deduplication is scoped to each class, preserves capacity, and uses the corrected count for each percentage', async () => {
  mockReport({ reports: [report(), report(4, { maxCapacity: 25, className: 'Yoga' })],
    sessions: { 3: [session(1)], 4: [session(2, { classId: 4 })] },
    rosters: { 1: [student(11), student(22)], 2: [student(11)] } })
  const results = await getClassStatusReport()
  assert.deepEqual(results.map(({ classId, totalRegistration, maxCapacity, fillRatePercentage }) =>
    ({ classId, totalRegistration, maxCapacity, fillRatePercentage })), [
    { classId: 3, totalRegistration: 2, maxCapacity: 20, fillRatePercentage: 10 },
    { classId: 4, totalRegistration: 1, maxCapacity: 25, fillRatePercentage: 4 },
  ])
})

test('classes with no sessions or only cancelled registrations have zero members without reusing the aggregate count', async () => {
  for (const setup of [{}, { sessions: { 3: [session(1)] }, rosters: { 1: [student(11, 'Cancelled')] } }]) {
    mockReport(setup)
    const [result] = await getClassStatusReport()
    assert.equal(result.totalRegistration, 0)
    assert.equal(result.maxCapacity, 20)
    assert.equal(result.fillRatePercentage, 0)
  }
})

test('roster failures reject the report instead of publishing a partial count or the incorrect aggregate', async () => {
  mockReport({ sessions: { 3: [session(1), session(2)] }, rosters: { 1: [student(11)] }, failRoster: 2 })
  await assert.rejects(getClassStatusReport(), /Không tải được danh sách/)
})

test('incomplete or repeated session pages reject the report', async () => {
  for (const transformSessions of [
    (data, page) => page === 2 ? { ...data, items: [] } : data,
    data => ({ ...data, items: [session(1)] }),
  ]) {
    mockReport({ sessions: { 3: [session(1), session(2), session(3)] }, transformSessions })
    await assert.rejects(getClassStatusReport(), /Chưa tải đủ|trùng trang/)
  }
})

test('malformed rosters, missing member IDs and unknown registration statuses do not silently lower the count', async () => {
  for (const roster of [{ items: [] }, [student(null)], [student(11, '')], [student(11, 'Unknown')]]) {
    mockReport({ sessions: { 3: [session(1)] }, transformRoster: () => roster })
    await assert.rejects(getClassStatusReport(), /không hợp lệ|Chưa xác định/)
  }
})

test('malformed report capacities and foreign sessions reject rather than produce a misleading percentage', async () => {
  for (const setup of [{ reports: {} }, { reports: [report(3, { maxCapacity: null })] },
    { sessions: { 3: [session(1, { classId: 4 })] } }]) {
    mockReport(setup)
    await assert.rejects(getClassStatusReport(), /không hợp lệ|Chưa xác định/)
  }
})

test('read concurrency stays at four and an abort signal is forwarded to all report reads', async () => {
  const controller = new AbortController()
  const state = mockReport({ sessions: { 3: Array.from({ length: 10 }, (_, index) => session(index + 1)) }, delay: 2 })
  await getClassStatusReport({ signal: controller.signal })
  assert.ok(state.maxActive > 1 && state.maxActive <= 4)
  assert.ok(state.reads.every(item => item.signal === controller.signal))
})

test('an empty report needs no session or roster reads', async () => {
  const state = mockReport({ reports: [] })
  assert.deepEqual(await getClassStatusReport(), [])
  assert.equal(state.reads.length, 1)
})
