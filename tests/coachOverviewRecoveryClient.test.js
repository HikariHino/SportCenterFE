import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let window, server, createRoot, Overview, Provider, useCache, cache, calls, failedRosters, failedSchedule, sessions
const descriptors = new Map()
const start = new Date(); start.setHours(10, 0, 0, 0)
const session = { id: 730, classId: 5, className: 'Tennis A', startsAt: start.toISOString(),
  endsAt: new Date(+start + 90 * 60000).toISOString(), status: 'Scheduled', capacity: 20, currentEnrollment: 2 }
const rosters = new Map([730, 731].map((id, index) => [id, [1 + index, 2 + index].map(memberId => ({
  memberId, registrationId: id * 10 + memberId, fullName: `Học viên ${memberId}`, attendanceStatus: null,
}))]))

before(async () => {
  window = new Window({ url: 'http://localhost:3000/coach' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, localStorage: window.localStorage, sessionStorage: window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  Overview = (await server.ssrLoadModule('/src/pages/Coach/OverviewView.jsx')).OverviewView
  const context = await server.ssrLoadModule('/src/contexts/CoachWorkspaceContext.jsx')
  Provider = context.CoachWorkspaceProvider; useCache = context.useCoachCache
  const api = (await server.ssrLoadModule('/src/services/api.js')).default
  api.defaults.adapter = async config => {
    assert.equal(config.method, 'get', 'overview must never write attendance')
    calls.push(config.url)
    const response = data => ({ data: { success: true, data }, status: 200, headers: {}, config })
    const fail = status => { throw Object.assign(new Error('Không tải được dữ liệu'), { response: { status } }) }
    if (config.url === '/class-sessions/mine') {
      if (failedSchedule) fail(failedSchedule)
      return response({ items: sessions, total: sessions.length })
    }
    const rosterId = Number(config.url.match(/^\/class-sessions\/(\d+)\/roster$/)?.[1])
    if (rosters.has(rosterId)) {
      if (failedRosters.has(rosterId)) fail(failedRosters.get(rosterId))
      return response(rosters.get(rosterId))
    }
    throw new Error(`Unexpected overview read: ${config.url}`)
  }
  createRoot = (await import('react-dom/client')).createRoot
})

after(async () => {
  await server?.close(); await window?.happyDOM.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

function View() {
  cache = useCache()
  return h(Overview, { onNavigate() {} })
}
async function screen(run, failures = []) {
  calls = []; failedRosters = new Map(failures); failedSchedule = 0
  sessions = [session, { ...session, id: 731, className: 'Tennis B' }]
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  try {
    await act(async () => root.render(h(Provider, { sessionKey: 'overview-recovery' }, h(View))))
    await run(container)
  } finally {
    await act(async () => root.unmount()); container.remove()
  }
}
const metric = container => container.querySelector('[aria-label^="Học viên hôm nay:"] strong').textContent
const retry = container => act(async () => {
  const button = [...container.querySelectorAll('button')].find(item => item.textContent.includes('Thử lại'))
  assert.ok(button, 'read errors must offer a retry'); button.click()
})
function assertIncomplete(container) {
  assert.equal(metric(container), '—', 'incomplete rosters are not a valid zero or partial student count')
  assert.match(container.querySelector('[role=alert]').textContent, /học viên.*chưa đầy đủ/)
  assert.equal(container.querySelectorAll('button.coach-session').length, 2, 'failed rosters must not hide the timetable')
  for (const number of container.querySelectorAll('.coach-attendance-breakdown strong')) assert.equal(number.textContent, '—')
  assert.match(container.querySelector('.coach-day-progress-card footer').textContent, /Chưa thể tổng hợp/)
}

test('complete rosters count unique students and all attendance registrations', () => screen(async container => {
  assert.equal(metric(container), '3')
  assert.equal(container.querySelector('[role=alert]'), null)
  assert.match(container.querySelector('.coach-day-progress-card footer').textContent, /4 lượt/)
}))

test('all roster failures keep sessions visible and mark student and attendance totals as unknown', () =>
  screen(async container => assertIncomplete(container), [[730, 503], [731, 503]]))

test('a partial roster outage cannot present partial counts as complete and retry restores all totals', () =>
  screen(async container => {
    assertIncomplete(container)
    failedRosters.clear()
    await retry(container)
    assert.equal(metric(container), '3')
    assert.equal(container.querySelector('[role=alert]'), null)
    assert.match(container.querySelector('.coach-day-progress-card footer').textContent, /4 lượt/)
    assert.equal(calls.filter(url => url === '/class-sessions/730/roster').length, 1, 'retry reuses the successful roster')
    assert.equal(calls.filter(url => url === '/class-sessions/731/roster').length, 2)
  }, [[731, 503]]))

test('manual retry can recover a denied nested roster instead of reusing its cached 403', () =>
  screen(async container => {
    assertIncomplete(container)
    failedRosters.clear()
    await retry(container)
    assert.equal(metric(container), '3')
    assert.equal(calls.filter(url => url.endsWith('/731/roster')).length, 2)
  }, [[731, 403]]))

test('a failed background roster refresh stops displaying previously complete totals', () => screen(async container => {
  assert.equal(metric(container), '3')
  failedRosters.set(731, 503)
  await act(async () => cache.invalidate(['overview:*', 'roster:*']))
  assertIncomplete(container)
  failedRosters.clear()
  await retry(container)
  assert.equal(metric(container), '3')
}))

test('manual retry also recovers a denied nested session read', () => screen(async container => {
  failedSchedule = 403
  await act(async () => cache.invalidate(['overview:*', 'sessions:*']))
  assert.ok(container.querySelector('[role=alert]'))
  const before = calls.filter(url => url === '/class-sessions/mine').length
  failedSchedule = 0
  await retry(container)
  assert.equal(container.querySelector('[role=alert]'), null)
  assert.equal(calls.filter(url => url === '/class-sessions/mine').length, before + 1)
}))

test('a genuinely empty day retains valid zero statistics without an error', () => screen(async container => {
  sessions = []
  await act(async () => cache.invalidate(['overview:*', 'sessions:*']))
  assert.equal(metric(container), '0')
  assert.equal(container.querySelector('[role=alert]'), null)
  assert.match(container.textContent, /Hôm nay chưa có lịch/)
}))
