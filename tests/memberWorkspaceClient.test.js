import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h, StrictMode } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let window, server, root, createRoot, Member, ConversationSidebar, AuthProvider, ThemeProvider, MemoryRouter, api
const descriptors = new Map(), requests = [], intervals = new Map(), errors = []
let nextInterval = 0, offline = false, serverName = 'Nguyễn Văn An'
let paymentStatus = 'Pending', subscriptionStatus = 'Pending'
let largeLists = false
const rows = factory => Array.from({ length: 23 }, (_, index) => factory(index))
const packageRows = () => rows(index => ({ id: index + 1, packageName: `Danh mục ${index + 1}`, packageType: index ? 'PT' : 'Standard', price: 1000, durationInDays: 30, isActive: true }))
const paymentRows = () => rows(index => ({ id: index + 3, subscriptionId: index + 7, amount: 1000, status: 'Completed', paymentMethod: 'PayOS', createdAt: '2026-11-16T08:00:00Z' }))
const subscriptionRows = () => rows(index => ({ id: index + 7, packageId: index + 1, packageName: `Danh mục ${index + 1}`, packageType: index ? 'PT' : 'Standard', agreedPrice: 1000, durationInDays: 30, status: 'Active', startDate: '2026-11-15T00:00:00Z', endDate: '2027-11-15T00:00:00Z' }))
const sessionRows = () => rows(index => ({ id: index + 1, classId: 1, className: 'Lớp phân trang', status: 'Scheduled', capacity: 30, currentEnrollment: 0, startsAt: `2027-01-${String(index + 1).padStart(2, '0')}T08:00:00Z`, endsAt: `2027-01-${String(index + 1).padStart(2, '0')}T09:00:00Z` }))

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
  ConversationSidebar = (await server.ssrLoadModule('/src/pages/member/MemberAiConversationSidebar.jsx')).default
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
    if (config.url === '/member-subscriptions/mine') data = [{ id: 7, packageId: 1, packageName: 'Gói tải sẵn', packageType: 'Standard', agreedPrice: 1000, durationInDays: 30, status: subscriptionStatus, startDate: '2026-11-15T00:00:00Z', endDate: '2027-11-15T00:00:00Z' }]
    if (config.url === '/SupportTickets/my-tickets') data = [{ id: 1, title: 'Phiếu đã tải sẵn', description: 'Cần tư vấn', status: 'Open', createdAt: '2026-11-16T08:00:00Z' }]
    if (config.url === '/notifications') data = [{ id: 1, title: 'Thông báo đã tải sẵn', content: 'Thông tin tài khoản', isRead: false, sentAt: '2026-11-16T08:00:00Z' }]
    if (config.url.includes('/history') && config.url.startsWith('/ai/')) data = { items: [], total: 0, page: config.params.page, pageSize: config.params.pageSize }
    if (largeLists) {
      if (config.url === '/membership-packages') data = packageRows()
      if (config.url === '/member-subscriptions/mine') data = subscriptionRows()
      if (/^\/member-subscriptions\/\d+$/.test(config.url)) data = { ...subscriptionRows().find(item => String(item.id) === config.url.split('/').at(-1)), payments: paymentRows() }
      if (config.url === '/payments') data = paymentRows()
      if (config.url === '/notifications') data = rows(index => ({ id: index + 1, title: `Thông báo ${index + 1}`, content: 'Nội dung thông báo', isRead: false, sentAt: '2026-11-16T08:00:00Z' }))
      if (config.url === '/SupportTickets/my-tickets') data = rows(index => ({ id: index + 1, title: `Phiếu ${index + 1}`, description: 'Cần tư vấn', status: 'Open', createdAt: '2026-11-16T08:00:00Z' }))
      if (config.url === '/GymCheckIns/my-history') data = rows(index => ({ id: index + 1, checkInTime: `2026-10-${String(index + 1).padStart(2, '0')}T08:00:00Z`, checkOutTime: index % 3 === 1 ? `2026-10-${String(index + 1).padStart(2, '0')}T09:00:00Z` : null, status: ['InGym', 'CheckedOut', 'ForgotCheckOut'][index % 3] }))
      if (config.url === '/TrainingPlans/members/9') data = rows(index => ({ id: index + 1, planName: `Giáo án ${index + 1}`, status: 'Active', exercises: rows(exercise => ({ id: exercise + 1, exerciseName: `Bài tập ${exercise + 1}`, sets: 3, reps: 12 })) }))
      if (config.url === '/classes') data = rows(index => ({ id: index + 1, className: `Lớp ${index + 1}`, sportName: 'Tennis' }))
      if (config.url === '/class-sessions' || /^\/classes\/\d+\/sessions$/.test(config.url)) data = sessionRows()
      if (config.url === '/class-registrations/mine') data = sessionRows().map((item, index) => ({ ...item, id: index + 101, sessionId: index + 1001, status: 'Registered', startsAt: item.startsAt.replace('2027-01', '2027-02'), endsAt: item.endsAt.replace('2027-01', '2027-02') }))
      if (config.url.startsWith('/ai/') && config.url.endsWith('/history')) {
        const history = rows(index => ({ id: index + 1, question: `Câu hỏi ${index + 1}`, answer: 'Câu trả lời', goal: `Mục tiêu ${index + 1}`, level: 'Beginner', daysPerWeek: 3, createdAt: '2026-11-16T08:00:00Z' }))
        const { page, pageSize } = config.params
        data = { items: history.slice((page - 1) * pageSize, page * pageSize), total: history.length, page, pageSize }
      }
    }
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

test('entry warms enabled Member tabs and skips the hidden workout view', () => {
  assert.deepEqual(errors, [])
  const firstTab = document.querySelector('.member-sidebar-item')
  assert.equal(firstTab.textContent, 'Ra/Vào trung tâm')
  assert.equal(firstTab.getAttribute('aria-current'), 'page')
  assert.equal(document.querySelector('.member-view-content:not([hidden]) h2').textContent, 'Ra/Vào trung tâm')
  assert.equal(document.querySelectorAll('.member-view-content').length, 9)
  assert.equal(document.querySelectorAll('.member-view-content[hidden]').length, 8)
  for (const url of ['/profile', '/member-subscriptions/mine', '/membership-packages', '/payments', '/GymCheckIns/my-qr', '/GymCheckIns/my-history', '/class-registrations/mine', '/TrainingPlans/members/9', '/SupportTickets/my-tickets', '/notifications', '/ai/chat/history']) assert.ok(count(url) > 0, url)
  assert.equal(count('/ai/workout-recommendations/history'), 0)
  assert.equal(count('/member-subscriptions/mine'), 1)
  assert.equal(count('/members/me'), 1)
  assert.ok(requests.every(request => request.method === 'get'))
})

test('switching tabs reuses the same view and draft without fetching again', async () => {
  await clickTab('Tài khoản')
  const profile = document.querySelector('.member-profile-view')
  await act(async () => [...document.querySelectorAll('.member-profile-editor-heading button')].find(button => button.textContent.includes('Chỉnh sửa')).click())
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
  const subscriptionsBefore = count('/member-subscriptions/mine')
  await act(async () => [...document.querySelectorAll('.mpay-dialog button')].find(button => button.textContent.includes('Đồng bộ trạng thái')).click())
  assert.ok(count('/member-subscriptions/mine') > subscriptionsBefore)
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

const pager = label => [...document.querySelectorAll('.member-pagination')].find(node => node.getAttribute('aria-label') === `Phân trang ${label}`)
function listRows(label) {
  const body = [...document.querySelectorAll('.member-list-scroll')].find(node => node.getAttribute('aria-label') === `${label} - nội dung`)
  const list = body.querySelector(':scope > [aria-label]')
  return [...(list.tagName === 'TABLE' ? list.querySelector('tbody').children : list.children)].filter(row => row.hasAttribute('data-stt'))
}
const nextPage = label => act(async () => pager(label).querySelector(`[aria-label="Trang sau: ${label}"]`).click())
async function checkThreePages(label) {
  assert.equal(listRows(label).length, 10, label)
  assert.equal(listRows(label)[0].dataset.stt, '1', label)
  await nextPage(label)
  assert.equal(listRows(label).length, 10, label)
  assert.equal(listRows(label)[0].dataset.stt, '11', label)
  await nextPage(label)
  assert.equal(listRows(label).length, 3, label)
  assert.equal(listRows(label)[0].dataset.stt, '21', label)
}

test('all Member business lists and nested payment/exercise tables expose all 23 records in pages of ten', async () => {
  largeLists = true
  await tick(10000); await tick(30000)
  await clickTab('Gói tập & Thẻ hội viên')
  await checkThreePages('Thẻ đang sử dụng')
  await checkThreePages('Đơn đăng ký gói tập')
  assert.ok(listRows('Đơn đăng ký gói tập').every(row => !row.classList.contains('member-numbered-item')), 'subscription cards have no STT label')
  await act(async () => document.querySelector('.member-sub-current .member-button').click())
  await checkThreePages('Thanh toán đính kèm')
  await act(async () => document.querySelector('.member-modal-close').click())
  await act(async () => [...document.querySelectorAll('.member-sub-tabs button')].find(button => button.textContent.includes('Khám phá')).click())
  await checkThreePages('Danh mục gói tập')
  await clickTab('Thanh toán trực tuyến'); await checkThreePages('Lịch sử thanh toán')
  assert.ok(listRows('Lịch sử thanh toán').every(row => !row.classList.contains('member-numbered-item')), 'payment cards have no STT label')
  await clickTab('Ra/Vào trung tâm'); await checkThreePages('Lịch sử tập luyện')
  const statusFilter = document.querySelector('.gym-history-status select')
  const historyRequests = count('/GymCheckIns/my-history')
  for (const [status, expected] of [['InGym', 8], ['CheckedOut', 8], ['ForgotCheckOut', 7], ['All', 10]]) {
    await act(async () => {
      statusFilter.value = status
      statusFilter.dispatchEvent(new window.Event('change', { bubbles: true }))
    })
    const visits = listRows('Lịch sử tập luyện')
    assert.equal(visits.length, expected)
    assert.equal(visits[0].dataset.stt, '1', 'changing status returns to page one')
    if (status !== 'All') assert.ok(visits.every(visit => visit.querySelector('.gym-checkin-status').dataset.status === status))
  }
  assert.equal(count('/GymCheckIns/my-history'), historyRequests, 'status filtering reuses the loaded date range')
  assert.deepEqual(listRows('Lịch sử tập luyện').map(visit => visit.querySelector('.gym-record-date > span').textContent),
    Array.from({ length: 10 }, (_, index) => `Lượt tập #${23 - index}`), 'newest check-in times appear first')
  await clickTab('Hỗ trợ khách hàng'); await checkThreePages('Phiếu hỗ trợ')
  await clickTab('Thông báo hệ thống'); await checkThreePages('Thông báo hệ thống')
  await clickTab('Lộ trình tập luyện'); await checkThreePages('Bài tập trong giáo án'); await checkThreePages('Giáo án tập luyện')
  assert.deepEqual(errors, [])
})

test('the hidden AI workout component still paginates its saved history', async () => {
  const MemberAiWorkout = (await server.ssrLoadModule('/src/pages/member/MemberAiWorkout.jsx')).default
  const container = document.body.appendChild(document.createElement('div'))
  const workoutRoot = createRoot(container)
  const previousLargeLists = largeLists
  largeLists = true
  try {
    await act(async () => workoutRoot.render(h(MemberAiWorkout, { active: true, onNavigate() {} })))
    await checkThreePages('Lịch sử gợi ý bài tập')
  } finally {
    await act(async () => workoutRoot.unmount())
    container.remove()
    largeLists = previousLargeLists
  }
})

test('class pages use ten records and keep selected sessions when moving between pages', async () => {
  await clickTab('Lớp học & Đặt lịch')
  await act(async () => [...document.querySelectorAll('.member-classes-layout-toggle button')].find(button => button.textContent.includes('Danh sách')).click())
  await checkThreePages('Lịch đã đặt')
  await act(async () => [...document.querySelectorAll('.member-classes-tabs button')].find(button => button.textContent.includes('Tìm lớp học')).click())
  await checkThreePages('Lớp học')
  assert.ok(requests.some(request => request.url === '/classes' && request.params.pageSize === 10))
  await act(async () => { const select = pager('Lớp học').querySelector('select'); select.value = '1'; select.dispatchEvent(new window.Event('change', { bubbles: true })) })
  await act(async () => document.querySelector('.member-course-card').click())
  assert.equal(listRows('Buổi học của lớp').length, 10)
  const first = document.querySelector('.member-session-choice input')
  assert.equal(first.disabled, false)
  await act(async () => first.click())
  await nextPage('Buổi học của lớp')
  await act(async () => document.querySelector('.member-session-choice input').click())
  await act(async () => pager('Buổi học của lớp').querySelector('[aria-label="Trang trước: Buổi học của lớp"]').click())
  assert.equal(document.querySelector('.member-session-choice input').checked, true)
  await nextPage('Buổi học của lớp')
  assert.equal(document.querySelector('.member-session-choice input').checked, true)
  await nextPage('Buổi học của lớp'); assert.equal(listRows('Buổi học của lớp').length, 3)
  assert.deepEqual(errors, [])
})

test('AI conversation pages show ten conversations and keep older imported history reachable', async () => {
  await clickTab('Trợ lý AI')
  assert.equal(listRows('Cuộc trò chuyện AI').length, 2)
  await act(async () => document.querySelector('.member-ai-load-history').click())
  await act(async () => document.querySelector('.member-ai-load-history').click())
  assert.equal(document.querySelector('.member-ai-load-history'), null)
  await act(async () => document.querySelector('.member-ai-conversation-list button[title="Lịch sử từ máy chủ"]').click())
  assert.equal(document.querySelectorAll('.member-ai-turn').length, 23)
  assert.ok(requests.filter(request => request.url === '/ai/chat/history').every(request => request.params.pageSize === 10))
  const conversations = rows(index => ({ id: `conversation-${index}`, title: `Cuộc trò chuyện ${index}`, updatedAt: '2026-11-16T08:00:00Z', messages: [{ id: index, question: 'Câu hỏi', answer: 'Trả lời', status: 'success' }] }))
  await act(async () => root.render(h(ConversationSidebar, { workspace: { conversations, activeId: conversations[0].id }, history: { page: 1, pageSize: 10, data: { page: 1, total: 23 }, latest() {}, reload() {}, setPage() {} }, onSelect() {}, onNew() {} })))
  await checkThreePages('Cuộc trò chuyện AI')
  assert.deepEqual(errors, [])
})
