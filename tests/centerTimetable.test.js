import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { timetableDateKey, shiftTimetableDate } from '../src/utils/memberTimetable.js'

let window, server, api, read, views, createRoot, Router, Auth, Theme, Receptionist
const descriptors = new Map()
const today = timetableDateKey()
const session = (id, changes = {}) => ({ id, classId: 3, className: `Lớp ${id}`, coachName: 'HLV An', roomName: 'Phòng Yoga',
  startsAt: `${today}T09:00:00+07:00`, endsAt: `${today}T10:00:00+07:00`, status: 'Scheduled', capacity: 20, ...changes })
before(async () => {
  window = new Window({ url: 'http://localhost/receptionist' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, HTMLDialogElement: window.HTMLDialogElement, Node: window.Node,
    localStorage: window.localStorage, sessionStorage: window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module-sync', 'module', 'import'] } },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  read = (await server.ssrLoadModule('/src/services/centerTimetableService.js')).getCenterTimetable
  views = await server.ssrLoadModule('/src/components/CenterTimetable.jsx')
  Router = (await server.ssrLoadModule('react-router-dom')).MemoryRouter
  Auth = (await server.ssrLoadModule('/src/contexts/AuthContext.jsx')).AuthProvider
  Theme = (await server.ssrLoadModule('/src/contexts/ThemeContext.jsx')).ThemeProvider
  Receptionist = (await server.ssrLoadModule('/src/pages/Receptionist/Receptionist.jsx')).default
  createRoot = (await import('react-dom/client')).createRoot
})
after(async () => {
  await server?.close(); await window?.happyDOM.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})
const mock = handler => {
  const calls = []
  api.defaults.adapter = async config => {
    calls.push(config)
    return { data: { success: true, data: await handler(config) }, status: 200, headers: {}, config }
  }
  return calls
}
test('center-wide reads fetch all pages and include full/completed sessions while excluding every cancelled form', async () => {
  const all = [session(1, { availableSeats: 0 }), session(2, { status: 'Completed' }), session(3, { status: ' Cancelled ' }),
    session(4, { status: undefined, Status: 'CANCELED' }), session(5, { sessionStatus: 'Cancelled' })]
  const calls = mock(config => ({ items: all.slice((config.params.page - 1) * 2, config.params.page * 2), total: 5, page: config.params.page }))
  assert.deepEqual((await read()).map(item => item.id), [1, 2])
  assert.equal(calls.length, 3)
  assert.ok(calls.every(call => call.url === '/class-sessions' && call.params.onlyAvailable === false && !call.params.from && !call.params.to))
})
test('failed, malformed and incomplete pages never resolve as a complete center timetable', async () => {
  for (const data of [{}, { items: [], total: 2 }, { items: [session(1)], total: 'invalid' }, { items: [session(1)], total: 2 },
    { items: [session(1, { startsAt: 'invalid' })], total: 1 }]) {
    mock(() => data)
    await assert.rejects(read())
  }
  api.defaults.adapter = async config => ({ data: { success: false, message: 'Không có quyền xem lịch' }, status: 200, headers: {}, config })
  await assert.rejects(read(), /Không có quyền/)
})

for (const role of ['Manager', 'Receptionist']) {
  test(`${role} can select scheduled and completed sessions and inspect all roster pages`, async () => {
    const items = [session(1), session(2, { status: 'Completed' }), session(3, { status: 'Cancelled' }),
      session(4, { startsAt: `${shiftTimetableDate(today, 7)}T09:00:00+07:00`, endsAt: `${shiftTimetableDate(today, 7)}T10:00:00+07:00` })]
    const students = Array.from({ length: 12 }, (_, index) => ({ registrationId: index + 1, memberId: index + 1,
      fullName: `Học viên ${index + 1}`, registrationStatus: 'Registered', attendanceStatus: 'Present' }))
    const calls = mock(config => config.url === '/class-sessions' ? { items, total: 4, page: 1 }
      : [...students, { registrationId: 99, memberId: 99, fullName: 'Đăng ký đã hủy', registrationStatus: 'Cancelled' }])
    const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
    try {
      await act(async () => root.render(h(views[`${role}CenterTimetable`])))
      assert.ok(container.querySelector('[data-session-id="1"]'))
      assert.ok(container.querySelector('[data-session-id="2"]'))
      assert.equal(container.querySelector('[data-session-id="3"]'), null)
      await act(async () => container.querySelector('[data-session-id="2"]').click())
      const dialog = container.querySelector('dialog')
      assert.ok(dialog.open)
      for (const text of ['Phòng Yoga', 'HLV An', '09:00', '10:00', 'Đã hoàn thành', 'Danh sách học viên (12)']) assert.ok(dialog.textContent.includes(text), text)
      assert.equal(dialog.querySelectorAll('tbody tr').length, 10)
      assert.doesNotMatch(dialog.textContent, /Đăng ký đã hủy/)
      await act(async () => dialog.querySelector('[aria-label="Trang sau: Học viên buổi học"]').click())
      assert.equal(dialog.querySelectorAll('tbody tr').length, 2)
      assert.match(dialog.querySelector('tbody').textContent, /Học viên 12/)
      await act(async () => dialog.querySelector('[aria-label="Đóng chi tiết buổi học"]').click())
      assert.equal(container.querySelector('dialog'), null)
      items[0].status = 'Cancelled'
      await act(async () => container.querySelector('.center-timetable-heading button[aria-label="Làm mới lịch"]').click())
      assert.equal(container.querySelector('[data-session-id="1"]'), null, 'refresh removes a newly cancelled session')
      await act(async () => container.querySelector('[aria-label="Tuần sau"]').click())
      assert.ok(container.querySelector('[data-session-id="4"]'))
      await act(async () => container.querySelector('[data-session-id="4"]').click())
      assert.ok(calls.some(call => call.url === '/class-sessions/4/roster'))
      assert.ok(calls.every(call => call.method === 'get'))
    } finally { await act(async () => root.unmount()); container.remove() }
  })
}

test('Receptionist sidebar exposes the center timetable and accepts its navigation URL', () => {
  const html = renderToStaticMarkup(h(Router, { initialEntries: ['/receptionist?view=' + encodeURIComponent('Thời khóa biểu trung tâm')] }, h(Theme, null, h(Auth, null, h(Receptionist)))))
  const container = document.createElement('div')
  container.innerHTML = html
  const button = [...container.querySelectorAll('.reception-nav button')].find(button => button.textContent.includes('Thời khóa biểu trung tâm'))
  assert.ok(button)
  assert.equal(button.getAttribute('aria-pressed'), 'true')
})
