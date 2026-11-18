import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h, StrictMode } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let window, server, root, Manager, MemoryRouter, AuthProvider, ThemeProvider, api
const descriptors = new Map(), requests = [], intervals = new Map(), errors = []
let nextInterval = 0, offline = false, createdRoom = null
let roomSession, waitForRoomSessionRead
const rows = factory => Array.from({ length: 23 }, (_, index) => factory(index + 1))
const classes = rows(id => ({ id, className: `Lớp ${id}`, sportId: 1, coachId: 1, maxCapacity: 30, isActive: true, sportName: 'Tennis', coachName: 'HLV An' }))
const rooms = rows(id => ({ id, name: `Phòng ${id}`, roomType: 'General', capacity: 30, isActive: true, location: 'Tầng 1' }))
const members = rows(id => ({ id, memberId: id, fullName: `Hội viên ${id}`, email: `member${id}@example.com`, phone: '0912345678', isActive: true }))
const packages = rows(id => ({ id, packageName: `Gói ${id}`, packageType: 'PT', price: 1000, durationInDays: 30, isActive: true }))

before(async () => {
  window = new Window({ url: 'http://localhost:3000/manager' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator, HTMLElement: window.HTMLElement,
    HTMLDialogElement: window.HTMLDialogElement, Node: window.Node, CustomEvent: window.CustomEvent,
    localStorage: window.localStorage, sessionStorage: window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  // Test application intervals without advancing wall-clock time.
  const nativeSet = globalThis.setInterval, nativeClear = globalThis.clearInterval
  descriptors.set('setInterval', Object.getOwnPropertyDescriptor(globalThis, 'setInterval'))
  descriptors.set('clearInterval', Object.getOwnPropertyDescriptor(globalThis, 'clearInterval'))
  window.setInterval = globalThis.setInterval = (callback, delay) => { const id = ++nextInterval; intervals.set(id, { callback, delay }); return id }
  window.clearInterval = globalThis.clearInterval = id => { if (!intervals.delete(id)) nativeClear(id) }
  sessionStorage.setItem('token', 'manager-client-test')
  sessionStorage.setItem('user', JSON.stringify({ id: 1, fullName: 'Quản lý An', role: 'manager' }))
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module-sync', 'module', 'import'] } },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  Manager = (await server.ssrLoadModule('/src/pages/CenterManager/CenterManager.jsx')).default
  MemoryRouter = (await server.ssrLoadModule('react-router-dom')).MemoryRouter
  AuthProvider = (await server.ssrLoadModule('/src/contexts/AuthContext.jsx')).AuthProvider
  ThemeProvider = (await server.ssrLoadModule('/src/contexts/ThemeContext.jsx')).ThemeProvider
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  api.defaults.adapter = async config => {
    requests.push({ url: config.url, method: config.method, params: config.params, signal: config.signal })
    if (offline) throw new Error('offline')
    let data = []
    const url = config.url.toLowerCase()
    if (url === '/reports/overview') data = { totalActiveMembers: 23, totalActiveClasses: 23, totalRevenue: 23000, currentMonthRevenue: 1000 }
    if (url === '/reports/revenue') data = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, revenue: 1000 }))
    if (url === '/users/staff') data = rows(id => ({ id, fullName: `Nhân sự ${id}`, email: `staff${id}@example.com`, role: 'Coach', isActive: true }))
    if (url === '/rooms') data = config.method === 'post' ? (createdRoom = { ...JSON.parse(config.data), id: 24 }) : createdRoom ? [...rooms, createdRoom] : [...rooms]
    if (url === '/classes/manage' || url === '/classes') data = { items: classes, total: classes.length, page: config.params?.page || 1, pageSize: 100 }
    if (/^\/classes\/\d+\/sessions$/.test(url)) {
      const items = url === '/classes/1/sessions' && roomSession ? [roomSession] : []
      if (items.length) await waitForRoomSessionRead
      data = { items, total: items.length, page: config.params?.page || 1, pageSize: 100 }
    }
    if (url === '/sports') data = rows(id => ({ id, name: `Bộ môn ${id}`, isActive: true }))
    if (url === '/coaches') data = rows(id => ({ id, fullName: `HLV ${id}`, isActive: true }))
    if (url === '/membership-packages/manage' || url === '/membership-packages') data = packages
    if (url.includes('cancellation-policies')) data = rows(id => ({ id, name: `Chính sách ${id}`, minimumHoursBeforeStart: 2, isActive: true }))
    if (url === '/payments') data = rows(id => ({ id, memberId: id, subscriptionId: id, amount: 1000, status: 'Completed', paymentMethod: 'Cash', createdAt: '2026-11-17T08:00:00Z' }))
    if (url === '/members') data = members
    if (url === '/supporttickets') data = rows(id => ({ id, memberId: id, memberName: `Hội viên ${id}`, title: `Phiếu ${id}`, description: 'Cần hỗ trợ', status: 'Open', priority: 'Normal', createdAt: '2026-11-17T08:00:00Z' }))
    return { data: { success: true, data }, status: 200, statusText: 'OK', headers: {}, config }
  }
  const container = document.createElement('div'); document.body.append(container)
  root = (await import('react-dom/client')).createRoot(container, { onUncaughtError: error => errors.push(error) })
  await act(async () => root.render(h(StrictMode, null, h(MemoryRouter, { initialEntries: ['/manager'] }, h(ThemeProvider, null, h(AuthProvider, null, h(Manager)))))))
})
after(async () => {
  if (root) await act(async () => root.unmount())
  assert.equal(intervals.size, 0, 'unmount removes Manager polling timers')
  await server?.close(); await window?.happyDOM.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})
const count = url => requests.filter(request => request.url.toLowerCase() === url.toLowerCase()).length
const tab = label => act(async () => { const button = [...document.querySelectorAll('.manager-nav button')].find(button => button.textContent.includes(label)); assert.ok(button, label); button.click() })
const tick = interval => act(async () => { for (const timer of [...intervals.values()]) if (timer.delay === interval) timer.callback() })

test('Manager warms all primary tabs with reads and deduplicates common resources', () => {
  assert.deepEqual(errors, [])
  assert.equal(document.querySelectorAll('.manager-view-content').length, 8)
  for (const url of ['/Reports/overview', '/Reports/revenue', '/users/staff', '/Rooms', '/sports', '/classes/manage', '/membership-packages/manage', '/payments', '/members', '/SupportTickets']) assert.ok(count(url), url)
  assert.equal(count('/users/staff'), 1)
  assert.equal(count('/payments'), 1)
  assert.equal(count('/Rooms'), 1)
  assert.ok(requests.every(request => request.method === 'get'))
})

test('changing Manager tabs preserves their mounted views without initial reloads', async () => {
  const staff = document.querySelector('.staff-mgmt'), roomView = document.querySelector('.room-mgmt')
  const before = requests.length
  for (const label of ['Nhân sự', 'Danh mục', 'Phòng tập', 'Gói thẻ', 'Chính sách', 'Báo cáo', 'Quầy lễ tân', 'Hồ sơ', 'Tổng quan']) await tab(label)
  assert.equal(document.querySelector('.staff-mgmt'), staff)
  assert.equal(document.querySelector('.room-mgmt'), roomView)
  assert.equal(requests.length, before)
  assert.deepEqual(errors, [])
})

test('Manager polling uses 10 seconds for operations and 30 seconds for catalogs', async () => {
  const paymentsBefore = count('/payments'), packagesBefore = count('/membership-packages/manage')
  await tick(10000)
  assert.equal(count('/payments'), paymentsBefore + 1)
  assert.equal(count('/membership-packages/manage'), packagesBefore)
  await tick(30000)
  assert.equal(count('/membership-packages/manage'), packagesBefore + 1)
  assert.deepEqual(errors, [])
})

test('Manager lists show 10, 10 and 3 records with continuous STT', async () => {
  for (const [view, label] of [['Nhân sự','Danh sách nhân sự'],['Phòng tập','Phòng tập'],['Gói thẻ','Gói thẻ hội viên'],['Chính sách','Chính sách hủy lịch'],['Danh mục','Danh sách lớp học']]) {
    await tab(view)
    const pager = () => [...document.querySelectorAll('.manager-view-content:not([hidden]) .manager-pagination')].find(node => node.getAttribute('aria-label') === 'Phân trang ' + label)
    assert.ok(pager(), label)
    const rows = () => [...pager().parentElement.querySelector('.manager-list-scroll').querySelectorAll('[data-stt]')]
    assert.equal(rows().length, 10, label)
    await act(async () => pager().querySelector(`[aria-label="Trang sau: ${label}"]`).click())
    assert.equal(rows()[0].dataset.stt, '11', label)
    await act(async () => pager().querySelector(`[aria-label="Trang sau: ${label}"]`).click())
    assert.equal(rows().length, 3, label)
    assert.equal(rows()[0].dataset.stt, '21', label)
  }
})

test('Manager draft forms survive polling and switching tabs; confirmed creates refresh related views', async () => {
  await tab('Phòng tập')
  await act(async () => [...document.querySelectorAll('.room-mgmt button')].find(button => button.textContent.includes('Thêm phòng tập')).click())
  const input = document.querySelector('.room-modal input.room-form-input')
  assert.ok(input)
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'Phòng kiểm thử mới')
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  await tick(30000)
  assert.equal(input.value, 'Phòng kiểm thử mới')
  await tab('Nhân sự')
  assert.equal(document.querySelector('.room-modal'), null)
  await tab('Phòng tập')
  assert.equal(document.querySelector('.room-modal input.room-form-input').value, 'Phòng kiểm thử mới')
  const overviewBefore = count('/Reports/overview')
  await act(async () => document.querySelector('.room-modal form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(document.querySelector('.room-modal'), null)
  assert.ok(createdRoom)
  assert.ok(count('/Reports/overview') > overviewBefore)
  assert.deepEqual(errors, [])
})

test('FrontDesk and report lists retain all records and use their shared fixed pagers', async () => {
  await tab('Quầy lễ tân')
  for (const label of ['Danh sách hội viên','Phiếu hỗ trợ tại quầy','Lớp học đăng ký','Lớp học điểm danh']) {
    const pager = [...document.querySelectorAll('.manager-pagination')].find(node => node.getAttribute('aria-label') === 'Phân trang ' + label)
    assert.ok(pager, label)
    assert.equal(pager.querySelector('select').value, '1', label)
    assert.equal(pager.querySelector('select').options.length, 3, label)
    assert.doesNotMatch(pager.textContent, /dòng\/trang/, label)
    await act(async () => pager.querySelector(`[aria-label="Trang sau: ${label}"]`).click())
    assert.equal(pager.querySelector('select').value, '2', label)
    assert.equal(pager.parentElement.querySelector('.manager-list-scroll').contains(pager), false)
  }
  await tab('Báo cáo')
  await act(async () => [...document.querySelectorAll('.report-tab-btn')].find(button => button.textContent.includes('Giao dịch')).click())
  const pager = [...document.querySelectorAll('.manager-pagination')].find(node => node.getAttribute('aria-label') === 'Phân trang Báo cáo giao dịch')
  assert.ok(pager)
  assert.equal(pager.querySelector('select').options.length, 3)
  assert.deepEqual(errors, [])
})

test('background failures keep cached Manager records visible', async () => {
  offline = true
  await tick(10000); await tick(30000)
  await tab('Nhân sự')
  assert.match(document.querySelector('.staff-mgmt').textContent, /Nhân sự 23/)
  assert.deepEqual(errors, [])
  offline = false
})

test('switching Manager accounts creates a new cache and resets the previous account forms', async () => {
  sessionStorage.setItem('token', 'manager-second-test')
  sessionStorage.setItem('user', JSON.stringify({ id: 2, fullName: 'Quản lý Bình', role: 'manager' }))
  const before = count('/users/staff')
  await act(async () => root.render(h(StrictMode, null, h(MemoryRouter, { initialEntries: ['/manager'] }, h(ThemeProvider, null, h(AuthProvider, { key: 'second' }, h(Manager)))))))
  assert.equal(count('/users/staff'), before + 1)
  assert.match(document.querySelector('.manager-account').textContent, /Quản lý Bình/)
  assert.equal(document.querySelector('.room-modal'), null)
  assert.deepEqual(errors, [])
})

test('the open room timetable skips catalog polling and allows actions during a schedule refresh', async () => {
  const start = Date.now() + 86_400_000
  roomSession = { id: 101, classId: 1, roomId: 1, status: 'Scheduled', startsAt: new Date(start).toISOString(), endsAt: new Date(start + 3_600_000).toISOString() }
  let releaseRead
  try {
    await tab('Phòng tập')
    await act(async () => document.querySelector('.room-mgmt button[title="Xem thời khóa biểu Phòng 1"]').click())
    const dialog = document.querySelector('.room-timetable-dialog')
    assert.ok(dialog.querySelector('[data-session-id="101"]'))
    const timetableReads = () => requests.filter(request => request.url === '/classes/1/sessions' && request.signal).length
    const readCount = timetableReads()
    const roomsBefore = count('/Rooms')
    const complete = id => act(async () => window.dispatchEvent(new CustomEvent('sportcenter:sessions-completed', { detail: [{ id }] })))

    await tick(30000)
    assert.ok(count('/Rooms') > roomsBefore)
    assert.equal(timetableReads(), readCount, 'refreshing the list of rooms does not reload its timetable')
    await complete(999)
    assert.equal(timetableReads(), readCount, 'completion in another room does not reload this timetable')

    waitForRoomSessionRead = new Promise(resolve => { releaseRead = resolve })
    const refresh = [...dialog.querySelectorAll('button')].find(button => button.textContent.trim() === 'Làm mới')
    await act(async () => refresh.click())
    assert.equal(timetableReads(), readCount + 1)
    assert.match(dialog.textContent, /Đang cập nhật lịch/)
    assert.equal(dialog.querySelector('.room-timetable-add').disabled, false)
    await act(async () => dialog.querySelector('.room-bulk-toggle').click())
    const session = dialog.querySelector('[data-session-id="101"]')
    assert.equal(session.disabled, false)
    await act(async () => session.click())
    assert.equal(session.getAttribute('aria-pressed'), 'true')
    await act(async () => releaseRead())
    assert.equal(session.getAttribute('aria-pressed'), 'true', 'a refresh preserves the selection')

    roomSession = { ...roomSession, status: 'Completed' }
    await complete(roomSession.id)
    assert.equal(timetableReads(), readCount + 2)
    assert.match(dialog.querySelector('[data-session-id="101"]').textContent, /Đã hoàn thành/)
    assert.deepEqual(errors, [])
  } finally {
    await act(async () => releaseRead?.())
    waitForRoomSessionRead = undefined
    roomSession = undefined
  }
})
