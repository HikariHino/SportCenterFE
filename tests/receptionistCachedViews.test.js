import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, workspace, views, MemoryRouter, AuthProvider
const descriptors = new Map()
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, esbuild: { jsx: 'automatic' },
    ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module-sync', 'module', 'import'] } },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  workspace = await server.ssrLoadModule('/src/contexts/ReceptionistWorkspaceContext.jsx')
  AuthProvider = (await server.ssrLoadModule('/src/contexts/AuthContext.jsx')).AuthProvider
  MemoryRouter = (await server.ssrLoadModule('react-router-dom')).MemoryRouter
  views = {}
  for (const [file, name] of [['MembersView', 'MembersView'], ['PaymentsView', 'PaymentsView'], ['CheckInView', 'CheckInView'], ['RoomsView', 'RoomsView'], ['OverviewView', 'Overview'], ['ProfileView', 'ReceptionistProfileView'], ['SupportTicketsView', 'SupportTicketsView'], ['ScheduleView', 'ReceptionistScheduleView']]) {
    views[name] = (await server.ssrLoadModule('/src/pages/Receptionist/' + file + '.jsx'))[name]
  }
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

const data = {
  members: [{ memberId: 9, fullName: 'Nguyễn Văn An', email: 'an@example.com', isActive: true }],
  rooms: [{ id: 2, name: 'Phòng Gym A', roomType: 'Gym', capacity: 20, isActive: true }],
  payments: [{ id: 90, memberId: 9, subscriptionId: 48, amount: 2000, paymentMethod: 'Cash', status: 'Completed' }],
  checkins: [], sports: [{ id: 3, name: 'Tennis' }], coaches: [{ id: 5, fullName: 'Coach A' }],
  'pending-orders': { orders: [], failedMembers: [] },
  'support:all': [{ id: 7, memberName: 'Nguyễn Văn An', title: 'Hỗ trợ lịch tập', description: 'Xin đổi buổi', status: 'Open', priority: 'Normal' }],
  profile: { userId: 1, fullName: 'Lễ Tân A', email: 'recep@example.com', roleName: 'Receptionist' },
}

function renderView(name, setup) {
  function Seeded() {
    const cache = workspace.useReceptionistCache()
    Object.entries(data).forEach(([key, value]) => cache.setData(key, value))
    setup?.(cache)
    return h(views[name], { query: '', showNotice() {}, onNavigate() {} })
  }
  return renderToStaticMarkup(h(MemoryRouter, null, h(AuthProvider, null,
    h(workspace.ReceptionistWorkspaceProvider, { sessionKey: 'test-receptionist' }, h(Seeded)))))
}

test('all eight tabs render prefetched data on the first paint instead of the full-view spinner', () => {
  for (const [view, text] of [
    ['MembersView', 'Nguyễn Văn An'], ['PaymentsView', '#90'], ['RoomsView', 'Phòng Gym A'],
    ['Overview', 'Phòng Gym A'], ['CheckInView', 'Quét mã QR hội viên'],
    ['ReceptionistProfileView', 'recep@example.com'], ['SupportTicketsView', 'Hỗ trợ lịch tập'],
    ['ReceptionistScheduleView', 'Tennis'],
  ]) {
    const html = renderView(view)
    assert.ok(html.includes(text), view)
    assert.doesNotMatch(html, /aria-label="Đang tải nội dung"/, view)
  }
})

test('a pending background refresh keeps the member table visible while showing a small updating message', () => {
  const html = renderView('MembersView', cache => cache.load('members', () => new Promise(() => {}), { force: true }))
  assert.match(html, /Nguyễn Văn An/)
  assert.match(html, /Đang cập nhật dữ liệu mới/)
  assert.doesNotMatch(html, /aria-label="Đang tải nội dung"/)
})

test('warming check-in data never opens a camera or renders a scanner before the user requests it', () => {
  const html = renderView('CheckInView')
  assert.match(html, /Quét QR bằng camera/)
  assert.doesNotMatch(html, /<video|reception-qr-camera-dialog/)
})

test('a new workspace begins without the previous account profile or member records', () => {
  function Unseeded() {
    const cache = workspace.useReceptionistCache()
    assert.equal(cache.snapshot('profile').hasData, false)
    assert.equal(cache.snapshot('members').hasData, false)
    return h(views.MembersView, { query: '' })
  }
  const html = renderToStaticMarkup(h(workspace.ReceptionistWorkspaceProvider, { sessionKey: 'another-receptionist' }, h(Unseeded)))
  assert.match(html, /aria-label="Đang tải nội dung"/)
  assert.doesNotMatch(html, /Nguyễn Văn An|recep@example.com/)
})

test('large cached Receptionist lists render ten rows and retain totals for pagination', () => {
  for (const [view, key, makeItem] of [
    ['MembersView', 'members', id => ({ memberId: id, fullName: 'Hội viên ' + id, isActive: true })],
    ['PaymentsView', 'payments', id => ({ id, memberId: 9, amount: 2000, paymentMethod: 'Cash', status: 'Completed' })],
    ['RoomsView', 'rooms', id => ({ id, name: 'Phòng ' + id, roomType: 'Gym', capacity: 20, isActive: true })],
    ['CheckInView', 'checkins', id => ({ id, memberId: id, memberName: 'Hội viên ' + id, memberCode: 'SC-' + id })],
    ['SupportTicketsView', 'support:all', id => ({ id, memberName: 'Hội viên ' + id, title: 'Phiếu ' + id, status: 'Open', priority: 'Normal' })],
  ]) {
    const html = renderView(view, cache => cache.setData(key, Array.from({ length: 23 }, (_, index) => makeItem(index + 1))))
    assert.equal((html.match(/data-stt=/g) || []).length, 10, view)
    assert.match(html, /1–10 \/ 23/, view)
    assert.match(html, /data-stt="10"/, view)
    assert.doesNotMatch(html, /data-stt="11"/, view)
  }
})
