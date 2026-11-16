import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { createWorkspaceResourceCache, prefetchWorkspaceResources } from '../src/utils/workspaceResourceCache.js'

let server, api, reads, coach
const descriptors = new Map()
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  reads = await server.ssrLoadModule('/src/services/coachWorkspaceReads.js')
  coach = await server.ssrLoadModule('/src/services/coachService.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})
const response = (config, data) => ({ config, status: 200, headers: {}, data: { success: true, data } })
const session = { id: 30, classId: 5, className: 'Lớp Tennis', startsAt: '2026-11-16T08:00:00Z', endsAt: '2026-11-16T09:00:00Z', status: 'Scheduled' }

test('equal session queries share a key while different dates, pages and sessions remain isolated', () => {
  assert.equal(reads.coachSessionsKey({ page: 1, pageSize: 100 }), reads.coachSessionsKey({}))
  const week = reads.coachWeekRange('2026-11-16')
  assert.equal(week.from, '2026-11-15T17:00:00.000Z')
  assert.equal(week.to, '2026-11-22T17:00:00.000Z')
  assert.notEqual(reads.coachSessionsKey(week), reads.coachSessionsKey({ ...week, page: 2 }))
  assert.notEqual(reads.coachSessionsKey(week), reads.coachSessionsKey({ ...week, to: '2026-12-01T00:00:00Z' }))
  assert.equal(reads.coachRosterKey(30), reads.coachRosterKey('30'))
  assert.notEqual(reads.coachRosterKey(30), reads.coachAttendancesKey(30))
})

test('Overview, attendance and Students share one in-flight roster read', async () => {
  const cache = createWorkspaceResourceCache()
  let calls = 0, release
  api.defaults.adapter = config => { calls++; return new Promise(resolve => { release = () => resolve(response(config, [{ memberId: 9, fullName: 'Học viên A' }])) }) }
  const key = reads.coachRosterKey(30)
  const first = cache.load(key, () => coach.getCoachSessionRoster(30))
  const second = cache.load(key, () => coach.getCoachSessionRoster('30'))
  const third = cache.load(key, () => coach.getCoachSessionRoster(30))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(calls, 1)
  release()
  await Promise.all([first, second, third])
  assert.equal((await cache.load(key, () => coach.getCoachSessionRoster(30)))[0].memberId, 9)
  assert.equal(calls, 1)
})

test('student catalog restores missing class metadata and reuses its exact session and class reads', async () => {
  const cache = createWorkspaceResourceCache(), calls = []
  api.defaults.adapter = async config => {
    calls.push([config.method, config.url])
    if (config.url === '/class-sessions/mine') return response(config, { items: [session, { ...session, id: 31 }], total: 2 })
    if (config.url === '/classes') return response(config, { items: [], total: 0 })
    return response(config, { id: 5, className: 'Lớp Tennis', sportName: 'Tennis' })
  }
  const first = await reads.loadCoachStudentCatalog(cache)
  const second = await reads.loadCoachStudentCatalog(cache)
  assert.equal(first.sessions.length, 2)
  assert.equal(second.classCatalog[0].sportName, 'Tennis')
  assert.deepEqual(calls, [['get', '/class-sessions/mine'], ['get', '/classes'], ['get', '/classes/5']])
})

test('read prefetch warms Coach tabs without attendance writes, AI generation or plan creation', async () => {
  const cache = createWorkspaceResourceCache(), calls = []
  api.defaults.adapter = async config => {
    calls.push([config.method, config.url])
    if (config.url === '/class-sessions/mine') return response(config, { items: [session], total: 1 })
    if (config.url === '/classes') return response(config, { items: [{ id: 5, className: 'Lớp Tennis' }], total: 1 })
    if (config.url === '/Rooms') return response(config, [{ id: 2, name: 'Phòng A' }])
    return response(config, { userId: 4, fullName: 'Coach A' })
  }
  await prefetchWorkspaceResources(cache, reads.coachReadTasks(cache))
  assert.equal(cache.snapshot('student-catalog').data.sessions[0].id, 30)
  assert.equal(cache.snapshot('profile').data.userId, 4)
  assert.equal(cache.snapshot('rooms:active').data[0].id, 2)
  assert.ok(calls.every(([method]) => method === 'get'))
  assert.equal(calls.filter(([, url]) => url === '/classes').length, 1)
  assert.equal(calls.filter(([, url]) => url === '/class-sessions/mine').length, 2) // Full list and current week differ.
})

test('cached scheduled sessions cannot bypass a fresh attendance check after BE cancels the session', async () => {
  const cache = createWorkspaceResourceCache()
  cache.setData(reads.coachSessionsKey(), { items: [session], total: 1 })
  const calls = []
  api.defaults.adapter = async config => { calls.push([config.method, config.url]); return response(config, { items: [{ ...session, status: 'Cancelled' }], total: 1, page: 1, pageSize: 100 }) }
  await assert.rejects(coach.markCoachAttendance({ memberId: 9, sessionId: 30, status: 'Present' }))
  assert.deepEqual(calls, [['get', '/class-sessions/mine']])
  assert.equal(cache.snapshot(reads.coachSessionsKey()).data.items[0].status, 'Scheduled')
})

test('Coach catalogs include sessions/classes past the first server page for local ten-row pagination', async () => {
  const sessions = Array.from({ length: 125 }, (_, index) => ({ ...session, id: index + 1, classId: index + 1 }))
  const classes = sessions.map(item => ({ id: item.classId, className: 'Lớp ' + item.classId, sportName: 'Tennis' }))
  const requests = []
  api.defaults.adapter = async config => {
    requests.push([config.url, config.params.page])
    const rows = config.url === '/class-sessions/mine' ? sessions : classes
    const { page, pageSize } = config.params
    return response(config, { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize })
  }
  const cache = createWorkspaceResourceCache()
  const result = await reads.loadCoachStudentCatalog(cache)
  assert.equal(result.sessions.length, 125)
  assert.equal(result.classCatalog.length, 125)
  assert.ok(requests.some(([url, page]) => url === '/class-sessions/mine' && page === 2))
  assert.ok(requests.some(([url, page]) => url === '/classes' && page === 2))
  assert.equal(result.sessions.at(-1).id, 125)
})
