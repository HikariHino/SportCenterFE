import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, workspace, reads, views, MemoryRouter, AuthProvider, StudentDialog
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
  StudentDialog = (await server.ssrLoadModule('/src/pages/Coach/StudentDetailsDialog.jsx')).default
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
    setup?.(cache, session)
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

test('background refresh keeps rooms visible without displaying an update banner', () => {
  const html = renderView('CoachRoomsView', cache => cache.load('rooms:active', () => new Promise(() => {}), { force: true }))
  assert.match(html, /Phòng Gym A/)
  assert.doesNotMatch(html, /Đang cập nhật dữ liệu mới/)
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

test('Coach roster and room lists show ten numbered rows while keeping totals and pagination visible', () => {
  const members = Array.from({ length: 23 }, (_, index) => ({ registrationId: index + 100, memberId: index + 1, fullName: 'Học viên ' + (index + 1), registrationStatus: 'Registered' }))
  const studentsHtml = renderView('StudentsView', cache => cache.setData('roster:30', members))
  assert.equal((studentsHtml.match(/data-stt=/g) || []).length, 10)
  assert.match(studentsHtml, /1–10 \/ 23/)
  assert.match(studentsHtml, /data-stt="10"/)
  assert.doesNotMatch(studentsHtml, /data-stt="11"/)
  assert.match(studentsHtml, /coach-paged-table/)
  // Pager is a sibling of the scroll area, so rows cannot scroll it away.
  assert.match(studentsHtml, /<\/button><\/div><\/div><nav class="coach-pagination"/)
  const roomsHtml = renderView('CoachRoomsView', cache => cache.setData('rooms:active', Array.from({ length: 23 }, (_, index) => ({ id: index + 1, name: 'Phòng ' + index, isActive: true }))))
  assert.equal((roomsHtml.match(/data-stt=/g) || []).length, 10)
  assert.match(roomsHtml, /1–10 \/ 23/)
})

test('Overview shows the complete daily schedule without pagination while other Coach lists stay paginated', () => {
  const html = renderView('OverviewView', (cache, session) => cache.setData('overview:' + reads.coachOverviewRange().from, {
    sessions: Array.from({ length: 23 }, (_, index) => ({ ...session, id: index + 1, tone: 'next', time: '15:00', duration: '60 phút', enrollment: 1 })),
    weekSessions: [], students: [], metrics: [], attendance: { present: 0, absent: 0, excused: 0, pending: 0 },
  }))
  assert.equal((html.match(/data-stt=/g) || []).length, 23)
  assert.match(html, /data-stt="23"/)
  assert.doesNotMatch(html, /Phân trang Lịch huấn luyện hôm nay|10 dòng\/trang/)
})

test('the student list offers a dialog per row and renders no student detail panel before a click', () => {
  const html = renderView('StudentsView')
  assert.match(html, /coach-student-list-layout/)
  assert.match(html, /aria-label="Xem thông tin học viên Nguyễn Văn An"/)
  assert.match(html, /aria-haspopup="dialog" aria-expanded="false"/)
  assert.doesNotMatch(html, /coach-student-profile|coach-student-details-dialog|coach-profile-main/)
})

test('student popup contains the requested student and keeps check-in restrictions and plan actions', () => {
  const student = { id: '10', memberId: 9, registrationId: 10, name: 'Nguyễn Văn An', registrationStatus: 'Đã đăng ký', attendanceTone: 'pending', attendanceStatus: 'Chưa điểm danh', checkInTime: 'Chưa có' }
  const props = { student, session: { className: 'Tennis A', startsAt: '2026-11-16T08:00:00Z', endsAt: '2026-11-16T09:00:00Z' }, sportName: 'Tennis', availability: { open: false, message: 'Buổi học đã hoàn thành.' }, onClose() {}, onCheckIn() {}, onCreatePlan() {}, onViewPlans() {} }
  const html = renderToStaticMarkup(h(StudentDialog, props))
  assert.match(html, /<dialog[^>]*aria-labelledby=/)
  for (const text of ['Nguyễn Văn An', '#9', '#10', 'Tennis A', 'Tạo giáo án', 'Xem giáo án', 'Buổi học đã hoàn thành.']) assert.ok(html.includes(text), text)
  assert.match(html, /disabled="" title="Buổi học đã hoàn thành\."/)
  assert.match(html, /aria-label="Đóng thông tin học viên"/)
  const busy = renderToStaticMarkup(h(StudentDialog, { ...props, checkingIn: true, availability: { open: true, message: 'Có thể check-in.' } }))
  assert.match(busy, /aria-busy="true"/)
  assert.match(busy, /disabled="" aria-label="Đóng thông tin học viên"/)
  assert.match(busy, /Đang check-in/)
})
