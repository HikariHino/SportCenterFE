import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'

let window, server, createRoot, Section, RosterDialog, Classes, api
let requests = [], reviews, failure = false
const descriptors = new Map()
const session = { id: 233, coachId: 7, classId: 24, className: 'Yoga cơ bản', status: 'Completed', startsAt: '2026-11-22T08:00:00Z', endsAt: '2026-11-22T09:00:00Z' }
const students = [{ registrationId: 244, memberId: 69, fullName: 'Lê Thanh Nhã', registrationStatus: 'Completed', attendanceStatus: 'Present' }]
const longComment = 'Hướng dẫn rất tận tình.\n' + 'A'.repeat(1900)

before(async () => {
  window = new Window({ url: 'http://localhost:3000/manager' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, localStorage: window.localStorage, sessionStorage: window.sessionStorage,
    IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ configFile: false, esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  Section = (await server.ssrLoadModule('/src/pages/CenterManager/SessionReviewsSection.jsx')).default
  RosterDialog = (await server.ssrLoadModule('/src/pages/CenterManager/SessionRosterDialog.jsx')).default
  Classes = (await server.ssrLoadModule('/src/pages/CenterManager/ClassManagement.jsx')).default
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  createRoot = (await import('react-dom/client')).createRoot
  api.defaults.adapter = async config => {
    requests.push({ url: config.url, page: config.params?.page })
    let data = []
    if (config.url === '/classes/manage') data = { items: [{ id: 24, className: session.className, isActive: true, maxCapacity: 20 }], total: 1, page: 1, pageSize: 100 }
    if (config.url === '/classes/24/sessions') data = { items: [session], total: 1, page: 1, pageSize: 100 }
    if (config.url === '/class-sessions/233/roster') data = students
    if (config.url.endsWith('/reviews')) {
      if (failure) throw new Error('Không thể tải đánh giá')
      const page = config.params.page
      data = { coachId: 7, averageRating: reviews.length ? 4 : null, reviewCount: reviews.length,
        items: reviews.slice((page - 1) * config.params.pageSize, page * config.params.pageSize), total: reviews.length, page }
    }
    return { data: { success: true, data }, status: 200, headers: {}, config }
  }
})

after(async () => {
  await server?.close()
  await window?.happyDOM.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

async function screen(Component, props, run) {
  requests = []; failure = false
  reviews = [{ id: 1, coachId: 7, memberId: 69, rating: 5, comment: longComment, createdAt: session.endsAt }]
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  try {
    await act(async () => { root.render(h(Component, props)); await new Promise(resolve => setTimeout(resolve, 20)) })
    await run(container)
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
}
const click = element => act(async () => { assert.ok(element); element.click() })
const reviewReads = () => requests.filter(item => item.url.endsWith('/reviews'))

async function checkToggle(container) {
  const button = container.querySelector('.session-reviews-toggle')
  assert.equal(button.getAttribute('aria-expanded'), 'false')
  assert.equal(reviewReads().length, 0)
  assert.equal(container.querySelector('.session-review-comment'), null)
  await click(button)
  assert.equal(button.getAttribute('aria-expanded'), 'true')
  assert.deepEqual(reviewReads(), [{ url: '/coaches/7/reviews', page: 1 }])
  assert.equal(container.querySelector('.session-review-comment').textContent, longComment)
  assert.match(container.querySelector('.session-reviews-content').textContent, /Lê Thanh Nhã/)
  assert.match(container.querySelector('.session-reviews-content').textContent, /5\/5 sao/)
  await click(button)
  assert.equal(container.querySelector('.session-reviews-content'), null)
}

test('roster opened from the room timetable keeps reviews collapsed until requested', () =>
  screen(RosterDialog, { session, onClose() {} }, checkToggle))

test('class session roster offers the same collapsed reviews without inserting long comments into the table', () =>
  screen(Classes, {}, async container => {
    await click([...container.querySelectorAll('button')].find(button => button.textContent.trim() === 'Buổi học'))
    await click(container.querySelector('[title="Xem danh sách học viên đăng ký"]'))
    await checkToggle(container)
    assert.doesNotMatch(container.querySelector('.roster-table').textContent, /Hướng dẫn rất tận tình/)
  }))

test('reviews handle request errors, retry, pagination, no comment and an empty session', () =>
  screen(Section, { coachId: 7, students: Array.from({ length: 11 }, (_, index) => ({ memberId: 69 + index })) }, async container => {
    failure = true
    await click(container.querySelector('.session-reviews-toggle'))
    assert.match(container.querySelector('[role=alert]').textContent, /Không thể tải/)
    failure = false
    reviews = Array.from({ length: 11 }, (_, index) => ({ id: index + 1, coachId: 7, memberId: 69 + index, rating: 4, comment: index === 10 ? null : `Nhận xét ${index + 1}` }))
    await click([...container.querySelectorAll('button')].find(button => button.textContent === 'Thử lại'))
    assert.equal(container.querySelectorAll('.session-review-item').length, 10)
    await click([...container.querySelectorAll('button')].find(button => button.textContent.trim() === 'Sau'))
    assert.equal(container.querySelectorAll('.session-review-item').length, 1)
    assert.match(container.textContent, /Học viên không để lại nhận xét/)
    assert.match(container.textContent, /Hội viên #79/)
    reviews = []
    await click(container.querySelector('.session-reviews-toggle'))
    await click(container.querySelector('.session-reviews-toggle'))
    assert.match(container.textContent, /chưa có đánh giá coach/)
  }))
