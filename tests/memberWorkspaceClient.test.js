import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h, StrictMode } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let window, server, root, createRoot, Member, AuthProvider, ThemeProvider, MemoryRouter, api
const descriptors = new Map(), requests = [], intervals = new Map(), errors = []
let nextInterval = 0, offline = false, serverName = 'Nguyễn Văn An'
let paymentStatus = 'Pending', subscriptionStatus = 'Pending'

before(async () => {
  window = new Window({ url: 'http://localhost:3000/member' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, HTMLDialogElement: window.HTMLDialogElement, Node: window.Node,
    localStorage: window.localStorage, sessionStorage: window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  window.setInterval = (callback, delay) => { const id = ++nextInterval; intervals.set(id, { callback, delay }); return id }
  window.clearInterval = id => intervals.delete(id)
  sessionStorage.setItem('token', 'member-client-test')
  sessionStorage.setItem('user', JSON.stringify({ id: 9, fullName: serverName, email: 'member@example.com', role: 'member' }))
  sessionStorage.setItem('loginSessionId', 'client-session')
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module-sync', 'module', 'import'] } },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  Member = (await server.ssrLoadModule('/src/pages/member/Member.jsx')).default
  AuthProvider = (await server.ssrLoadModule('/src/contexts/AuthContext.jsx')).AuthProvider
  ThemeProvider = (await server.ssrLoadModule('/src/contexts/ThemeContext.jsx')).ThemeProvider
  MemoryRouter = (await server.ssrLoadModule('react-router-dom')).MemoryRouter
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  api.defaults.adapter = async config => {
    requests.push({ url: config.url, method: config.method, params: config.params })
    if (offline) throw new Error('offline')
    let data = []
    if (config.url === '/profile') data = { fullName: serverName, email: 'member@example.com', phoneNumber: '0912345678', gender: 'Male' }
    if (config.url === '/members/me') data = { memberId: 9, fullName: serverName, email: 'member@example.com' }
    if (config.url === '/GymCheckIns/my-qr') data = { qrData: 'MEMBER-9', fullName: serverName, memberId: 9 }
    if (config.url === '/payments/3/sync') { paymentStatus = 'Completed'; subscriptionStatus = 'Active'; data = { id: 3, subscriptionId: 7, amount: 1000, status: paymentStatus, paymentMethod: 'PayOS' } }
    if (config.url === '/payments') data = [{ id: 3, subscriptionId: 7, amount: 1000, status: paymentStatus, paymentMethod: 'PayOS' }]
    if (config.url === '/membership-packages') data = [{ id: 1, packageName: 'Gói tải sẵn', packageType: 'Standard', price: 1000, durationInDays: 30, isActive: true }]
    if (config.url === '/member-subscriptions/me') data = [{ id: 7, packageId: 1, packageName: 'Gói tải sẵn', packageType: 'Standard', agreedPrice: 1000, durationInDays: 30, status: subscriptionStatus, startDate: '2026-11-15T00:00:00Z', endDate: '2027-11-15T00:00:00Z' }]
    if (config.url === '/SupportTickets/my-tickets') data = [{ id: 1, title: 'Phiếu đã tải sẵn', description: 'Cần tư vấn', status: 'Open', createdAt: '2026-11-16T08:00:00Z' }]
    if (config.url === '/notifications') data = [{ id: 1, title: 'Thông báo đã tải sẵn', content: 'Thông tin tài khoản', isRead: false, sentAt: '2026-11-16T08:00:00Z' }]
    if (config.url.includes('/history') && config.url.startsWith('/ai/')) data = { items: [], total: 0, page: config.params.page, pageSize: config.params.pageSize }
    return { data: { success: true, data }, status: 200, statusText: 'OK', headers: {}, config }
  }
  createRoot = (await import('react-dom/client')).createRoot
  const container = document.createElement('div'); document.body.append(container)
  root = createRoot(container, { onUncaughtError: error => errors.push(error) })
  await act(async () => {
    root.render(h(StrictMode, null, h(MemoryRouter, { initialEntries: ['/member'] }, h(ThemeProvider, null, h(AuthProvider, null, h(Member))))))
  })
})

after(async () => {
  if (root) await act(async () => root.unmount())
  assert.equal(intervals.size, 0, 'unmount clears every refresh timer')
  await server?.close()
  await window?.happyDOM.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

const tick = delay => act(async () => { for (const timer of [...intervals.values()]) if (timer.delay === delay) timer.callback() })
const count = url => requests.filter(request => request.url === url).length
const clickTab = label => act(async () => {
  const button = [...document.querySelectorAll('.member-sidebar-item')].find(item => item.textContent.includes(label))
  assert.ok(button, label)
  button.click()
})

test('entry warms every Member tab using reads and shares the subscription/profile requests', () => {
  assert.deepEqual(errors, [])
  assert.equal(document.querySelectorAll('.member-view-content').length, 10)
  assert.equal(document.querySelectorAll('.member-view-content[hidden]').length, 9)
  for (const url of ['/profile', '/member-subscriptions/me', '/membership-packages', '/payments', '/GymCheckIns/my-qr', '/GymCheckIns/my-history', '/class-registrations/mine', '/TrainingPlans/members/9', '/SupportTickets/my-tickets', '/notifications', '/ai/chat/history', '/ai/workout-recommendations/history']) assert.ok(count(url) > 0, url)
  assert.equal(count('/member-subscriptions/me'), 1)
  assert.equal(count('/members/me'), 1)
  assert.ok(requests.every(request => request.method === 'get'))
})

test('switching tabs reuses the same view and draft without fetching again', async () => {
  const profile = document.querySelector('.member-profile-view')
  const input = document.querySelector('#member-profile-fullName')
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'Nguyễn Văn Bình')
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  const before = requests.length
  for (const button of [...document.querySelectorAll('.member-sidebar-item')]) await clickTab(button.textContent)
  await clickTab('Hỗ trợ khách hàng')
  assert.match(document.querySelector('.member-view-content:not([hidden])').textContent, /Phiếu đã tải sẵn/)
  await clickTab('Tài khoản')
  assert.equal(document.querySelector('.member-profile-view'), profile)
  assert.equal(document.querySelector('#member-profile-fullName').value, 'Nguyễn Văn Bình')
  assert.equal(requests.length, before)
})

test('background refresh updates fast tabs at 10 seconds, normal tabs at 30, and preserves edited profile fields', async () => {
  const beforePayments = count('/payments'), beforeSupport = count('/SupportTickets/my-tickets'), beforeProfile = count('/profile')
  await tick(10000)
  assert.equal(count('/payments'), beforePayments + 1)
  assert.equal(count('/SupportTickets/my-tickets'), beforeSupport)
  assert.equal(count('/profile'), beforeProfile)
  serverName = 'Nguyễn Văn Nam'
  await tick(30000)
  assert.equal(count('/SupportTickets/my-tickets'), beforeSupport + 1)
  assert.equal(count('/profile'), beforeProfile + 1)
  assert.equal(document.querySelector('#member-profile-fullName').value, 'Nguyễn Văn Bình')
})

test('failed background refresh keeps warm data and never returns the view to its initial loader', async () => {
  await act(async () => document.querySelector('.member-notification').click())
  assert.match(document.querySelector('.member-notifications-preview').textContent, /Thông báo đã tải sẵn/)
  offline = true
  await tick(10000)
  await tick(30000)
  assert.match(document.querySelector('.member-notifications-preview').textContent, /Thông báo đã tải sẵn/)
  offline = false
  await act(async () => document.querySelector('.member-notification').click())
  await clickTab('Hỗ trợ khách hàng')
  assert.match(document.querySelector('.member-view-content:not([hidden])').textContent, /Phiếu đã tải sẵn/)
  assert.deepEqual(errors, [])
})

test('payment synchronization updates the already mounted subscription tab immediately', async () => {
  await clickTab('Thanh toán trực tuyến')
  await act(async () => [...document.querySelectorAll('.mpay-record-actions button')].find(button => button.textContent.includes('Chi tiết')).click())
  assert.ok(document.querySelector('.mpay-dialog[open]'))
  const subscriptionsBefore = count('/member-subscriptions/me')
  await act(async () => [...document.querySelectorAll('.mpay-dialog button')].find(button => button.textContent.includes('Đồng bộ trạng thái')).click())
  assert.ok(count('/member-subscriptions/me') > subscriptionsBefore)
  await clickTab('Gói tập & Thẻ hội viên')
  assert.equal(document.querySelector('.mpay-dialog[open]'), null, 'inactive tabs cannot keep native dialogs open')
  assert.match(document.querySelector('.member-view-content:not([hidden])').textContent, /Đang hiệu lực/)
  assert.match(document.querySelector('.member-sub-current').textContent, /Gói tải sẵn/)
  assert.deepEqual(errors, [])
})

test('changing accounts creates a fresh workspace instead of reusing the previous member data', async () => {
  serverName = 'Lê Văn Hai'; subscriptionStatus = 'Pending'; paymentStatus = 'Pending'
  sessionStorage.setItem('token', 'second-member-token')
  sessionStorage.setItem('user', JSON.stringify({ id: 10, fullName: serverName, email: 'second@example.com', role: 'member' }))
  const before = count('/payments')
  await act(async () => root.render(h(StrictMode, null, h(MemoryRouter, null, h(ThemeProvider, null, h(AuthProvider, { key: 'second-account' }, h(Member)))))))
  assert.equal(count('/payments'), before + 1)
  assert.equal(document.querySelector('.member-sub-current'), null)
  assert.match(document.querySelector('.member-sidebar-account').textContent, /Lê Văn Hai/)
  assert.deepEqual(errors, [])
})
