import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'

let window, server, createRoot, Staff, Auth, api, reviewRatings, failure, requests, sessionRatings, sessionFailure
const descriptors = new Map()
const staff = [
  { userId: 3, coachId: 1, fullName: 'Coach An', role: 'Coach', isActive: true, dateOfBirth: '1990-05-20T00:00:00Z' },
  { userId: 8, coachId: 2, fullName: 'Coach Bình', role: 'Coach', isActive: true },
  { userId: 9, fullName: 'Lễ tân', role: 'Receptionist', isActive: true },
]

before(async () => {
  window = new Window({ url: 'http://localhost/manager' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, localStorage: window.localStorage, sessionStorage: window.sessionStorage,
    IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ configFile: false, esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  Staff = (await server.ssrLoadModule('/src/pages/CenterManager/StaffManagement.jsx')).default
  Auth = (await server.ssrLoadModule('/src/contexts/AuthContext.jsx')).AuthProvider
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  createRoot = (await import('react-dom/client')).createRoot
  api.defaults.adapter = async config => {
    requests.push(config)
    let data = staff
    if (config.url === '/class-sessions') {
      const id = Number(config.params.coachId)
      const items = [1, 2, 3].map(offset => ({ id: id * 100 + offset, coachId: id, status: 'Completed' }))
      data = { items, total: items.length, page: config.params.page }
    }
    if (config.url.startsWith('/class-sessions/') && config.url.endsWith('/reviews')) {
      if (sessionFailure) throw new Error('Không thể tải đánh giá buổi học')
      const id = Number(config.url.split('/')[2])
      const rating = sessionRatings[(id % 100) - 1]
      const items = rating == null ? [] : [{ id: id + 1000, rating }]
      data = { items, total: items.length, page: config.params.page }
    }
    if (config.url.startsWith('/coaches/') && config.url.endsWith('/reviews')) {
      if (failure) throw new Error('offline')
      const id = Number(config.url.split('/')[2])
      const average = reviewRatings?.[0] ?? (id === 2 ? 3.5 : 4.75)
      data = { coachId: id, items: [], total: reviewRatings?.length === 0 ? 0 : 40, page: config.params.page,
        averageRating: average, reviewCount: reviewRatings?.length === 0 ? 0 : 40 }
    }
    return { data: { success: true, data }, status: 200, headers: {}, config }
  }
})

after(async () => {
  await server?.close(); await window?.happyDOM.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

async function screen(run) {
  reviewRatings = null; failure = false; requests = []; sessionRatings = [5, 3, 1]; sessionFailure = false
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  try {
    await act(async () => root.render(h(Auth, null, h(Staff))))
    await run()
  } finally { await act(async () => root.unmount()); container.remove() }
}
const click = selector => act(async () => { const node = document.querySelector(selector); assert.ok(node); node.click() })
const box = () => document.querySelector('.staff-coach-rating')

test('staff profile displays coach birth date, direct coach score and session quality from their respective sources', () => screen(async () => {
  assert.equal(requests.filter(item => item.url.endsWith('/reviews')).length, 0)
  await click('[aria-label="Xem hồ sơ Coach An"]')
  assert.match(box().textContent, /4,75\/5 sao/)
  assert.match(box().textContent, /40 lượt đánh giá/)
  const read = requests.find(item => item.url.startsWith('/coaches/') && item.url.endsWith('/reviews'))
  assert.equal(read.url, '/coaches/1/reviews')
  assert.deepEqual(read.params, { page: 1, pageSize: 1 })
  assert.match(document.querySelector('.staff-coach-birthdate').textContent, /20\/05\/1990/)
  assert.match(document.querySelector('.staff-session-quality').textContent, /3\/5 sao/)
  assert.match(document.querySelector('.staff-session-quality').textContent, /3 lượt đánh giá buổi học/)
  assert.equal(requests.find(item => item.url === '/class-sessions').params.coachId, 1)
  await click('[aria-label="Đóng hồ sơ nhân sự"]')
  await click('[aria-label="Xem hồ sơ Coach Bình"]')
  assert.match(box().textContent, /3,5\/5 sao/)
  assert.match(document.querySelector('.staff-coach-birthdate').textContent, /Chưa cập nhật/)
  await click('[aria-label="Đóng hồ sơ nhân sự"]')
  const before = requests.length
  await click('[aria-label="Xem hồ sơ Lễ tân"]')
  assert.equal(box(), null)
  assert.equal(document.querySelector('.staff-coach-birthdate'), null)
  assert.equal(document.querySelector('.staff-session-quality'), null)
  assert.equal(requests.length, before)
}))

test('session quality empty and error states are independent of direct coach reviews', () => screen(async () => {
  sessionRatings = []
  await click('[aria-label="Xem hồ sơ Coach An"]')
  assert.match(document.querySelector('.staff-session-quality').textContent, /Chưa có đánh giá/)
  assert.match(box().textContent, /4,75\/5 sao/)
  await click('[aria-label="Đóng hồ sơ nhân sự"]')
  sessionFailure = true
  await click('[aria-label="Xem hồ sơ Coach An"]')
  assert.match(document.querySelector('.staff-session-quality').textContent, /Chưa tải được chất lượng buổi học/)
  assert.match(box().textContent, /4,75\/5 sao/)
  sessionFailure = false; sessionRatings = [5, 3, 1]
  await click('.staff-session-quality button')
  assert.match(document.querySelector('.staff-session-quality').textContent, /3\/5 sao/)
}))

test('no reviews show an empty state instead of zero stars', () => screen(async () => {
  reviewRatings = []
  await click('[aria-label="Xem hồ sơ Coach An"]')
  assert.match(box().textContent, /Chưa có đánh giá/)
  assert.doesNotMatch(box().textContent, /0\/5/)
}))

test('errors and malformed totals do not masquerade as an unrated coach and allow retry', () => screen(async () => {
  failure = true
  await click('[aria-label="Xem hồ sơ Coach An"]')
  assert.match(box().textContent, /Chưa tải được điểm đánh giá/)
  assert.doesNotMatch(box().textContent, /Chưa có đánh giá/)
  failure = false; reviewRatings = [8, 3, 1]
  await click('.staff-coach-rating button')
  assert.match(box().textContent, /Chưa tải được điểm đánh giá/)
  reviewRatings = null
  await click('.staff-coach-rating button')
  assert.match(box().textContent, /4,75\/5 sao/)
}))
