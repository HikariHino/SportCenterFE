import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h, StrictMode } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let window, server, createRoot, Coach, Router, Auth, Theme, requests
const descriptors = new Map()
const start = new Date(); start.setHours(18, 0, 0, 0)
const sessions = [730, 731].map((id, index) => ({ id, classId: 5 + index, className: `Tennis ${index ? 'B' : 'A'}`,
  sportName: 'Tennis', startsAt: start.toISOString(), endsAt: new Date(+start + 90 * 60000).toISOString(),
  status: 'Scheduled', capacity: 20, currentEnrollment: 1 }))

before(async () => {
  window = new Window({ url: 'http://localhost:3000/coach' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, localStorage: window.localStorage, sessionStorage: window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module-sync', 'module', 'import'] } },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  Coach = (await server.ssrLoadModule('/src/pages/Coach/Coach.jsx')).default
  Router = (await server.ssrLoadModule('react-router-dom')).MemoryRouter
  Auth = (await server.ssrLoadModule('/src/contexts/AuthContext.jsx')).AuthProvider
  Theme = (await server.ssrLoadModule('/src/contexts/ThemeContext.jsx')).ThemeProvider
  const api = (await server.ssrLoadModule('/src/services/api.js')).default
  api.defaults.adapter = async config => {
    assert.equal(config.method, 'get', 'navigation must not write attendance')
    requests.push(config.url)
    const response = data => ({ data: { success: true, data }, status: 200, headers: {}, config })
    if (config.url === '/class-sessions/mine') return response({ items: sessions, total: sessions.length })
    if (config.url === '/notifications') return response({ items: [], total: 0 })
    const rosterId = Number(config.url.match(/^\/class-sessions\/(\d+)\/roster$/)?.[1])
    if (rosterId) return response([{ registrationId: rosterId + 100, memberId: rosterId,
      fullName: `Học viên ${rosterId}`, registrationStatus: 'Registered', attendanceStatus: null }])
    if (config.url.startsWith('/Attendances/session/')) return response([])
    if (config.url === '/classes') return response({ items: sessions.map(item => ({ id: item.classId, className: item.className, sportName: 'Tennis' })), total: 2 })
    if (config.url.toLowerCase() === '/rooms') return response([])
    if (config.url === '/profile') return response({ userId: 41, fullName: 'Coach test', email: 'coach@example.com' })
    throw new Error(`Unexpected navigation read: ${config.url}`)
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

async function settle() {
  // React lazy imports finish asynchronously even after the click's act scope.
  await act(async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setTimeout(resolve, 5)) })
}
async function screen(run, { rememberedSession, initialView = '/coach' } = {}) {
  requests = []
  localStorage.clear(); sessionStorage.clear()
  sessionStorage.setItem('token', 'coach-navigation-test')
  sessionStorage.setItem('user', JSON.stringify({ id: 41, role: 'coach', fullName: 'Coach test' }))
  if (rememberedSession) sessionStorage.setItem('coach:selected-session', JSON.stringify(rememberedSession))
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  try {
    await act(async () => root.render(h(StrictMode, null, h(Router, { initialEntries: [initialView] }, h(Theme, null, h(Auth, null, h(Coach)))))))
    await settle()
    await run(container)
  } finally {
    await act(async () => root.unmount()); container.remove()
  }
}
const visibleView = container => container.querySelector('.coach-view-content:not([hidden])')
const tab = (container, label) => click(container, `.coach-nav button`, button => button.textContent.includes(label))
async function click(container, selector, matches = () => true) {
  const button = [...container.querySelectorAll(selector)].find(matches)
  assert.ok(button, `Missing button: ${selector}`)
  await act(async () => button.click())
  await settle()
}
function assertDetails(container, id) {
  const page = visibleView(container).querySelector('.coach-attendance-page')
  assert.ok(page, 'one click should open attendance, not the timetable')
  assert.match(page.querySelector('.coach-attendance-selected-session').textContent, new RegExp(`Buổi #${id}`))
  assert.match(page.querySelector('.coach-attendance-table').textContent, new RegExp(`Học viên ${id}`))
  assert.ok(requests.includes(`/Attendances/session/${id}`))
}

test('a session row on the overview directly opens that session and its roster on the first visit', () => screen(async container => {
  await click(visibleView(container), 'button.coach-session', button => button.textContent.includes('Tennis A'))
  assertDetails(container, 730)
}))

test('a priority action opens the corresponding attendance session directly', () => screen(async container => {
  await click(visibleView(container), '.coach-focus-main > button')
  assertDetails(container, 730)
}))

test('an already mounted calendar opens another session and can reopen the same session after returning', () => screen(async container => {
  await tab(container, 'Lịch huấn luyện')
  assert.ok(visibleView(container).querySelector('.coach-attendance-timetable'))
  await tab(container, 'Tổng quan')
  await click(visibleView(container), 'button.coach-session', button => button.textContent.includes('Tennis B'))
  assertDetails(container, 731)
  await click(visibleView(container), '.coach-schedule-detail-back')
  assert.ok(visibleView(container).querySelector('.coach-attendance-timetable'))
  await tab(container, 'Tổng quan')
  await click(visibleView(container), 'button.coach-session', button => button.textContent.includes('Tennis B'))
  assertDetails(container, 731)
}))

test('view all and sidebar calendar links show the timetable after a session was opened', () => screen(async container => {
  await click(visibleView(container), 'button.coach-session')
  assertDetails(container, 730)
  await tab(container, 'Tổng quan')
  await click(visibleView(container), '.coach-card-head button', button => button.textContent.includes('Xem toàn bộ lịch'))
  assert.ok(visibleView(container).querySelector('.coach-attendance-timetable'))
  assert.equal(visibleView(container).querySelector('.coach-attendance-page'), null)
  await click(visibleView(container), '[data-session-id="731"]')
  assertDetails(container, 731)
  await tab(container, 'Tổng quan')
  await tab(container, 'Lịch huấn luyện')
  assert.ok(visibleView(container).querySelector('.coach-attendance-timetable'))
}))

test('a remembered selection alone leaves the timetable open until a session is explicitly clicked', () => screen(async container => {
  assert.ok(visibleView(container).querySelector('.coach-attendance-timetable'))
  assert.equal(requests.filter(url => url.startsWith('/Attendances/')).length, 0)
  await click(visibleView(container), '[data-session-id="730"]')
  assertDetails(container, 730)
}, { rememberedSession: sessions[0], initialView: '/coach?view=L%E1%BB%8Bch+hu%E1%BA%A5n+luy%E1%BB%87n' }))

test('overview statistics keep opening the calendar rather than the priority sessions attendance', () => screen(async container => {
  await click(visibleView(container), 'button.coach-session')
  assertDetails(container, 730)
  await tab(container, 'Tổng quan')
  await click(visibleView(container), '[aria-label^="Buổi dạy hôm nay:"]')
  assert.ok(visibleView(container).querySelector('.coach-attendance-timetable'))
  assert.equal(visibleView(container).querySelector('.coach-attendance-page'), null)
}))
