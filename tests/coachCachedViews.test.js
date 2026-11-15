import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, workspace, reads, views, MemoryRouter, AuthProvider
const descriptors = new Map()
before(async () => {
  for (const [key, value] of Object.entries({ localStorage: { getItem: () => null }, sessionStorage: { getItem: () => null }, window: { location: { search: '', pathname: '/coach' } } })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, esbuild: { jsx: 'automatic' },
    ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module-sync', 'module', 'import'] } },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  workspace = await server.ssrLoadModule('/src/contexts/CoachWorkspaceContext.jsx')
  reads = await server.ssrLoadModule('/src/services/coachWorkspaceReads.js')
  AuthProvider = (await server.ssrLoadModule('/src/contexts/AuthContext.jsx')).AuthProvider
  MemoryRouter = (await server.ssrLoadModule('react-router-dom')).MemoryRouter
  views = {}
  for (const [file, name] of [['AttendanceView', 'AttendanceView'], ['StudentsView', 'StudentsView'], ['OverviewView', 'OverviewView'], ['ProfileView', 'CoachProfileView'], ['RoomsView', 'CoachRoomsView']]) views[name] = (await server.ssrLoadModule('/src/pages/Coach/' + file + '.jsx'))[name]
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

function renderView(name, setup, props = {}) {
  function Seeded() {
    const cache = workspace.useCoachCache()
    const week = reads.coachWeekRange()
    const startsAt = new Date(Date.parse(week.from) + 12 * 3600000).toISOString()
    const endsAt = new Date(Date.parse(startsAt) + 3600000).toISOString()
    const session = { id: 30, classId: 5, className: 'Tennis Coach A', startsAt, endsAt, status: 'Scheduled', capacity: 10, currentEnrollment: 1 }
    cache.setData(reads.coachSessionsKey(week), { items: [session], total: 1 })
    cache.setData('student-catalog', { sessions: [session], classCatalog: [{ id: 5, className: 'Tennis Coach A', sportName: 'Tennis' }] })
    cache.setData('roster:30', [{ registrationId: 10, memberId: 9, fullName: 'Nguyễn Văn An', registrationStatus: 'Registered', attendanceStatus: 'Present' }])
    cache.setData('rooms:active', [{ id: 2, name: 'Phòng Gym A', capacity: 20, isActive: true }])
    cache.setData('profile', { userId: 4, fullName: 'Coach A', email: 'coach@example.com' })
    cache.setData('overview:' + reads.coachOverviewRange().from, { metrics: [], sessions: [], weekSessions: [], students: [], attendance: { present: 0, absent: 0, excused: 0, pending: 0 } })
    setup?.(cache)
    return h(views[name], { active: true, query: '', showNotice() {}, onNavigate() {}, selectedSessionId: '30', ...props })
  }
  return renderToStaticMarkup(h(MemoryRouter, null, h(AuthProvider, null, h(workspace.CoachWorkspaceProvider, { sessionKey: 'coach-a' }, h(Seeded)))))
}

test('all Coach tabs render cached content without returning to their initial full-view loader', () => {
  for (const [name, text] of [['AttendanceView', 'Tennis Coach A'], ['StudentsView', 'Nguyễn Văn An'], ['OverviewView', 'Công việc ưu tiên'], ['CoachProfileView', 'coach@example.com'], ['CoachRoomsView', 'Phòng Gym A']]) {
    const html = renderView(name)
    assert.ok(html.includes(text), name)
    assert.doesNotMatch(html, /aria-label="Đang tải nội dung"/, name)
  }
})

test('background refresh keeps rooms visible and displays a compact updating message', () => {
  const html = renderView('CoachRoomsView', cache => cache.load('rooms:active', () => new Promise(() => {}), { force: true }))
  assert.match(html, /Phòng Gym A/)
  assert.match(html, /Đang cập nhật dữ liệu mới/)
  assert.doesNotMatch(html, /aria-label="Đang tải nội dung"/)
})

test('a different Coach workspace starts without the previous account data', () => {
  function Empty() {
    const cache = workspace.useCoachCache()
    assert.equal(cache.snapshot('profile').hasData, false)
    assert.equal(cache.snapshot('student-catalog').hasData, false)
    return h(views.CoachProfileView, { active: true })
  }
  const html = renderToStaticMarkup(h(workspace.CoachWorkspaceProvider, { sessionKey: 'coach-b' }, h(Empty)))
  assert.doesNotMatch(html, /coach@example.com/)
  assert.match(html, /Đang tải/)
})
