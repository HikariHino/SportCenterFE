import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { act, createElement as h, useState } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let window, server, createRoot, Schedule, Provider, useCache, holdRosters, pending, requests, sessions, rosters
let portalNotices, concurrentEnrollment, failRegistration, failSessionReload, holdRegistration, finishRegistration
const descriptors = new Map()
const start = new Date(); start.setHours(18, 0, 0, 0)
const fixtureSessions = [730, 731].map((id, index) => ({ id, classId: 5 + index, className: `Tennis ${index ? 'B' : 'A'}`,
  startsAt: new Date(+start + index * 3600000).toISOString(), endsAt: new Date(+start + (index + 1) * 3600000).toISOString(),
  status: 'Scheduled', coachId: 41, coachName: 'Coach test', sportId: 3, capacity: 20, currentEnrollment: 1, availableSeats: 19 }))
const clone = value => JSON.parse(JSON.stringify(value))
const member = (memberId, sessionId) => ({ registrationId: sessionId * 10 + memberId, memberId,
  fullName: `Học viên ${memberId}`, registrationStatus: 'Registered', attendanceStatus: null })

before(async () => {
  window = new Window({ url: 'http://localhost:3000/receptionist' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, localStorage: window.localStorage, sessionStorage: window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, esbuild: { jsx: 'automatic' },
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  Schedule = (await server.ssrLoadModule('/src/pages/Receptionist/ScheduleView.jsx')).ReceptionistScheduleView
  const context = await server.ssrLoadModule('/src/contexts/ReceptionistWorkspaceContext.jsx')
  Provider = context.ReceptionistWorkspaceProvider; useCache = context.useReceptionistCache
  const api = (await server.ssrLoadModule('/src/services/api.js')).default
  api.defaults.adapter = async config => {
    requests.push(config)
    const response = data => ({ data: { success: true, data: clone(data) }, status: 200, headers: {}, config })
    if (config.url === '/sports') return response([{ id: 3, name: 'Tennis' }])
    if (config.url === '/coaches') return response([{ id: 41, fullName: 'Coach test' }])
    if (config.url === '/classes') {
      const items = [...new Map(sessions.map(item => [item.classId, { id: item.classId, className: item.className,
        sportId: 3, sportName: 'Tennis', coachId: 41, coachName: 'Coach test', maxCapacity: 20 }])).values()]
      return response({ items, total: items.length })
    }
    if (config.url === '/class-sessions') {
      if (failSessionReload && requests.some(item => item.method === 'post')) throw new Error('Không tải lại được lịch')
      return response({ items: sessions, total: sessions.length })
    }
    const classId = Number(config.url.match(/^\/classes\/(\d+)\/sessions$/)?.[1])
    if (classId) {
      const items = sessions.filter(item => item.classId === classId)
      return response({ items, total: items.length })
    }
    const rosterId = Number(config.url.match(/^\/class-sessions\/(\d+)\/roster$/)?.[1])
    if (rosterId) {
      if (holdRosters) return new Promise((resolve, reject) => pending.push({ sessionId: rosterId, signal: config.signal,
        resolve: items => resolve(response(items || rosters.get(rosterId))), reject }))
      return response(rosters.get(rosterId))
    }
    const registration = config.url.match(/^\/class-sessions\/(\d+)\/registrations\/members\/(\d+)$/)
    if (registration) {
      if (failRegistration) throw new Error('Không thể đăng ký hội viên')
      const id = Number(registration[1]), memberId = Number(registration[2])
      const save = () => {
        const chosen = sessions.find(item => item.id === id)
        chosen.currentEnrollment += 1 + concurrentEnrollment
        chosen.availableSeats -= 1 + concurrentEnrollment
        rosters.get(id).push(member(memberId, id))
        return response({ id: 990, sessionId: id, memberId, status: 'Registered' })
      }
      if (holdRegistration) return new Promise(resolve => { finishRegistration = () => resolve(save()) })
      return save()
    }
    throw new Error(`Unexpected schedule request: ${config.method} ${config.url}`)
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

function SharedSelection() {
  const cache = useCache()
  const [selected, setSelected] = useState(null)
  return h(Schedule, { selectedSession: selected, onSelectSession: setSelected,
    showNotice: () => { if (portalNotices) cache.invalidate(['sessions:*', 'classes:*']) } })
}
async function screen(run, { sharedClass = false } = {}) {
  holdRosters = false; pending = []; requests = []
  portalNotices = failRegistration = failSessionReload = holdRegistration = false; concurrentEnrollment = 0; finishRegistration = null
  sessions = clone(fixtureSessions)
  if (sharedClass) Object.assign(sessions[1], { classId: 5, className: 'Tennis A' })
  rosters = new Map([[730, [member(1, 730)]], [731, [member(2, 731)]]])
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  try {
    await act(async () => root.render(h(Provider, { sessionKey: 'schedule-test' }, h(SharedSelection))))
    await choose(container.querySelectorAll('.reception-schedule-flow select')[0], '3')
    await choose(container.querySelectorAll('.reception-schedule-flow select')[1], '41')
    assert.equal(container.querySelectorAll('.reception-schedule-session-list article').length, 2)
    await run(container, () => act(async () => root.unmount()))
  } finally {
    await act(async () => root.unmount())
    if (finishRegistration) await act(async () => { finishRegistration(); finishRegistration = null })
    await act(async () => { pending.forEach(item => item.resolve()); pending = [] })
    container.remove()
  }
}
async function click(container, selector, predicate = () => true) {
  const button = [...container.querySelectorAll(selector)].find(predicate)
  assert.ok(button, selector)
  await act(async () => button.click())
}
async function choose(select, value) {
  await act(async () => { select.value = value; select.dispatchEvent(new window.Event('change', { bubbles: true })) })
}
const open = (container, name) => click(container, '.reception-schedule-session-list article > button:first-child', button => button.textContent.includes(name))
const active = container => container.querySelector('.reception-active-session')

test('normal selection still loads the correct roster when selection is shared with the parent', () => screen(async container => {
  await open(container, 'Tennis A')
  assert.match(active(container).querySelector('h2').textContent, /Tennis A/)
  assert.match(active(container).querySelector('.reception-roster-table').textContent, /Học viên 1/)
  await open(container, 'Tennis B')
  assert.match(active(container).querySelector('h2').textContent, /Tennis B/)
  assert.match(active(container).querySelector('.reception-roster-table').textContent, /Học viên 2/)
}))

test('a late response for A cannot replace the already loaded roster of B', () => screen(async container => {
  holdRosters = true
  await open(container, 'Tennis A'); await open(container, 'Tennis B')
  await act(async () => pending[1].resolve())
  await act(async () => pending[0].resolve())
  assert.match(active(container).querySelector('h2').textContent, /Tennis B/)
  assert.match(active(container).textContent, /Học viên 2/)
  assert.doesNotMatch(active(container).textContent, /Học viên 1|Không thể tải học viên/)
}))

test('an obsolete failure cannot stop the latest roster loader or replace its error state', () => screen(async container => {
  holdRosters = true
  await open(container, 'Tennis A'); await open(container, 'Tennis B')
  await act(async () => pending[0].reject(new Error('Old A failure')))
  assert.ok(active(container).querySelector('[aria-label="Đang tải nội dung"]'))
  assert.doesNotMatch(active(container).textContent, /Old A failure|Chưa có học viên/)
  await act(async () => pending[1].resolve())
  assert.match(active(container).textContent, /Học viên 2/)
}))

test('reselecting the same session supersedes its previous roster request', () => screen(async container => {
  holdRosters = true
  await open(container, 'Tennis A'); await open(container, 'Tennis A')
  await act(async () => pending[1].resolve([member(9, 730)]))
  await act(async () => pending[0].resolve())
  assert.match(active(container).textContent, /Học viên 9/)
  assert.doesNotMatch(active(container).textContent, /Học viên 1/)
}))

test('changing the class cancels the old roster and keeps the selected-session panel cleared', () => screen(async container => {
  holdRosters = true
  await open(container, 'Tennis A')
  await click(container, '.reception-schedule-class-filter', button => button.textContent.includes('Tennis B'))
  assert.equal(Boolean(active(container)), false)
  assert.equal(pending[0].signal?.aborted, true)
  await act(async () => pending[0].resolve())
  assert.equal(Boolean(active(container)), false)
}))

test('unmounting the schedule aborts the pending roster request', () => screen(async (container, unmount) => {
  holdRosters = true
  await open(container, 'Tennis A')
  await unmount()
  assert.equal(pending[0].signal?.aborted, true)
  await act(async () => pending[0].resolve())
}))

async function register(container, sessionId) {
  const card = [...container.querySelectorAll('.reception-schedule-class-list article')].find(item => item.textContent.includes('Tennis A'))
  await click(card, '.reception-schedule-add-member')
  const form = container.querySelector('.reception-add-member-dialog form')
  if (sessionId) await choose(form.querySelector('select'), String(sessionId))
  await act(async () => {
    const input = form.querySelector('input[type=number]')
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, '9')
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  await act(async () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
}
function assertEnrollment(container, count) {
  assert.match(active(container).querySelector('.reception-active-session-meta').textContent, new RegExp(`${count}/20 học viên`))
  const card = container.querySelector('.reception-schedule-session-list article')
  assert.match(card.querySelector('p').textContent, new RegExp(`${count}/20 học viên`))
  assert.match(card.textContent, new RegExp(`Còn ${20 - count} chỗ`))
  assert.equal(requests.filter(item => item.method === 'post').length, 1)
}

test('successful registration refreshes the roster, selected details, agenda seats and daily total', () => screen(async container => {
  await open(container, 'Tennis A')
  await register(container)
  assert.match(active(container).querySelector('.reception-roster-table').textContent, /Học viên 9/)
  assertEnrollment(container, 2)
  assert.equal(container.querySelector('.reception-schedule-summary section > span:last-child strong').textContent, '3')
}))

test('the portal notification refresh also updates the selected details and uses authoritative concurrent counts', () => screen(async container => {
  portalNotices = true; concurrentEnrollment = 2
  await open(container, 'Tennis A')
  await register(container)
  assertEnrollment(container, 4)
}))

test('registering into another session updates its seats without replacing the currently selected roster', () => screen(async container => {
  await open(container, 'Tennis A')
  await register(container, 731)
  assert.match(active(container).querySelector('h2').textContent, /#730/)
  assert.match(active(container).querySelector('.reception-active-session-meta').textContent, /1\/20 học viên/)
  assert.doesNotMatch(active(container).querySelector('.reception-roster-table').textContent, /Học viên 9/)
  const cards = container.querySelectorAll('.reception-schedule-session-list article')
  assert.match(cards[1].querySelector('p').textContent, /2\/20 học viên/)
  assert.match(cards[1].textContent, /Còn 18 chỗ/)
}, { sharedClass: true }))

test('a failed registration retains the original enrollment and reports the failure', () => screen(async container => {
  failRegistration = true
  await open(container, 'Tennis A'); await register(container)
  assertEnrollment(container, 1)
  assert.match(container.querySelector('.reception-add-member-dialog [role=alert]').textContent, /Không thể đăng ký/)
}))

test('a failed post-registration refresh can retry the read without repeating the registration', () => screen(async container => {
  failSessionReload = true
  await open(container, 'Tennis A'); await register(container)
  assert.match(container.querySelector('.reception-schedule-agenda').textContent, /Không tải lại được lịch/)
  failSessionReload = false
  await click(container, '.reception-schedule-agenda .reception-inline-error button')
  assertEnrollment(container, 2)
}))

test('a registration response for A cannot reopen A after the user selects B', () => screen(async container => {
  holdRegistration = true
  await open(container, 'Tennis A'); await register(container)
  await open(container, 'Tennis B')
  await act(async () => { finishRegistration(); finishRegistration = null })
  assert.match(active(container).querySelector('h2').textContent, /Tennis B/)
  assert.match(active(container).querySelector('.reception-roster-table').textContent, /Học viên 2/)
  assert.equal(requests.filter(item => item.url.endsWith('/730/roster')).length, 1)
}))
