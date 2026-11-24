import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'

let window, server, createRoot, ClassesView, api
const descriptors = new Map()
const clock = Date.parse('2026-11-24T12:00:00Z'), originalNow = Date.now
const completed = { id: 101, memberId: 69, sessionId: 10, classId: 1, className: 'Yoga cơ bản', coachName: 'Coach An',
  status: 'Completed', sessionStatus: 'Completed', attendanceStatus: 'Present',
  startsAt: '2026-11-23T08:00:00+07:00', endsAt: '2026-11-23T09:00:00+07:00', hasReviewed: false }
let registration, posts, coachReview, calls, sessionPosts, failCoachRead, sessionConflict

before(async () => {
  Date.now = () => clock
  window = new Window({ url: 'http://localhost:3000/member' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, localStorage: window.localStorage, sessionStorage: window.sessionStorage,
    IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ configFile: false, esbuild: { jsx: 'automatic' },
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false },
    appType: 'custom', logLevel: 'error' })
  ClassesView = (await server.ssrLoadModule('/src/pages/member/ClassesView.jsx')).ClassesView
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  createRoot = (await import('react-dom/client')).createRoot
  api.defaults.adapter = async config => {
    calls.push(config.url)
    let data = []
    if (config.url === '/class-registrations/mine') data = { items: [registration], total: 1, page: 1, pageSize: 100 }
    if (config.url === '/classes') data = { items: [], total: 0, page: 1, pageSize: 100 }
    if (config.url === '/class-sessions') data = { items: [{ id: 10, coachId: 7, coachName: 'Coach An' }], total: 1, page: 1, pageSize: 100 }
    if (config.url === '/coaches/7/reviews') {
      if (failCoachRead) throw new Error('Không tải được đánh giá coach')
      data = { coachId: 7, averageRating: coachReview?.rating ?? null, reviewCount: coachReview ? 1 : 0, items: coachReview ? [coachReview] : [], total: coachReview ? 1 : 0, page: 1 }
    }
    if (['post', 'put'].includes(config.method)) {
      if (config.url === '/class-registrations/101/review') {
        const payload = JSON.parse(config.data)
        sessionPosts.push(payload)
        data = { id: 301, registrationId: 101, ...payload, createdAt: new Date(clock).toISOString() }
        registration = { ...registration, hasReviewed: true, review: data }
        if (sessionConflict) throw new Error('Đánh giá buổi học đã được lưu bởi yêu cầu khác.')
        return { data: { success: true, data }, status: 200, headers: {}, config }
      }
      assert.equal(config.url, '/coaches/7/reviews')
      const payload = JSON.parse(config.data)
      posts.push(payload)
      data = { id: 201, coachId: 7, memberId: 69, ...payload, createdAt: new Date(clock).toISOString() }
      coachReview = data
    }
    return { data: { success: true, data }, status: 200, headers: {}, config }
  }
})

after(async () => {
  await server?.close()
  await window?.happyDOM.close()
  Date.now = originalNow
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

async function screen(changes, run) {
  registration = { ...completed, ...changes }
  posts = []; coachReview = null; calls = []; sessionPosts = []; failCoachRead = false; sessionConflict = false
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  try {
    await act(async () => { root.render(h(ClassesView)); await new Promise(resolve => setTimeout(resolve, 30)) })
    await run()
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
}
const click = node => act(async () => { assert.ok(node); node.click() })
const submit = () => act(async () => {
  document.querySelector('dialog form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
})
const sessionForm = () => document.querySelector('.member-session-review-pane:not([hidden]) form')
const submitSession = () => act(async () => sessionForm().dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
const openSessionReview = async () => {
  await click(document.querySelector('[data-session-id="101"]'))
  await click([...document.querySelectorAll('.member-review-tabs button')].find(button => button.textContent === 'Đánh giá buổi học'))
}
const changeComment = (selector, value) => act(async () => {
  const textarea = document.querySelector(selector)
  Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(textarea, value)
  textarea.dispatchEvent(new window.Event('input', { bubbles: true }))
})

test('clicking a completed attended session in either calendar opens coach review and saves it once', async () => {
  for (const [selector, attendanceStatus] of [['[data-session-id="101"]', 'Present'], ['[data-registration-id="101"]', 'Late']]) {
    await screen({ attendanceStatus }, async () => {
      await click(document.querySelector(selector))
      assert.equal(document.querySelector('dialog h2').textContent, 'Đánh giá coach')
      assert.match(document.querySelector('dialog').textContent, /Coach An/)
      assert.equal(document.querySelector('[type=submit]').disabled, true)
      await submit()
      assert.equal(posts.length, 0)
      await click(document.querySelector('input[name="coach-rating"][value="5"]'))
      await act(async () => {
        const textarea = document.querySelector('#member-coach-comment')
        Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(textarea, '  Coach hướng dẫn tận tình  ')
        textarea.dispatchEvent(new window.Event('input', { bubbles: true }))
      })
      await submit()
      assert.deepEqual(posts, [{ rating: 5, comment: 'Coach hướng dẫn tận tình' }])
      assert.match(document.body.textContent, /Đã lưu đánh giá coach thành công/)
      await click(document.querySelector('[aria-label="Đóng đánh giá coach"]'))
      await click(document.querySelector(selector))
      assert.equal(document.querySelector('dialog h2').textContent, 'Đánh giá coach')
      assert.match(document.querySelector('dialog').textContent, /5\/5 sao/)
      assert.match(document.querySelector('dialog').textContent, /Coach hướng dẫn tận tình/)
      assert.equal(document.querySelector('[type=submit]').textContent, 'Cập nhật đánh giá')
      assert.equal(posts.length, 1)
      assert.ok(!calls.some(url => /class-registrations\/\d+\/review/.test(url)))
    })
  }
})

test('absence, missing attendance and incomplete sessions offer no coach review', async () => {
  for (const changes of [{ attendanceStatus: 'Absent' }, { attendanceStatus: null },
    { status: 'Registered', sessionStatus: 'Scheduled' }]) {
    await screen(changes, async () => {
      await click(document.querySelector('[data-session-id="101"]'))
      assert.equal(document.querySelector('dialog h2').textContent, 'Chi tiết buổi học')
      assert.equal(document.querySelector('input[name="class-rating"]'), null)
      assert.ok(![...document.querySelectorAll('dialog button')].some(button => button.textContent.includes('Đánh giá coach')))
      assert.equal(posts.length, 0)
    })
  }
})

test('fresh attendance is checked before saving a coach review from an already open form', async () => {
  await screen({}, async () => {
    await click(document.querySelector('[data-session-id="101"]'))
    await click(document.querySelector('input[name="coach-rating"][value="4"]'))
    registration = { ...registration, attendanceStatus: 'Absent' }
    await submit()
    assert.equal(posts.length, 0)
    assert.match(document.querySelector('dialog').textContent, /không tham gia|điểm danh Có mặt/)
  })
})

test('session review uses a separate registration API, persists independently and cannot be sent twice', async () => {
  for (const attendanceStatus of ['Present', 'Late']) {
    await screen({ attendanceStatus }, async () => {
      await openSessionReview()
      assert.equal(document.querySelector('dialog h2').textContent, 'Đánh giá buổi học')
      assert.equal(sessionForm().querySelector('[type=submit]').disabled, true)
      await submitSession()
      assert.equal(sessionPosts.length, 0)
      await click(document.querySelector('input[name="session-rating"][value="4"]'))
      await changeComment('#member-session-comment', '  Nội dung buổi học tốt  ')
      await submitSession()
      assert.deepEqual(sessionPosts, [{ rating: 4, comment: 'Nội dung buổi học tốt' }])
      assert.equal(posts.length, 0)
      assert.equal(coachReview, null)
      assert.match(sessionForm().textContent, /Đã gửi đánh giá buổi học thành công/)
      assert.equal(document.querySelector('input[name="session-rating"]'), null)
      assert.match(sessionForm().textContent, /4\/5 sao/)
      await click(document.querySelector('[aria-label="Đóng đánh giá coach"]'))
      await openSessionReview()
      assert.match(sessionForm().textContent, /Nội dung buổi học tốt/)
      assert.equal(sessionForm().querySelector('[type=submit]'), null)
      assert.equal(sessionPosts.length, 1)
    })
  }
})

test('coach draft survives switching tabs and a previous session review does not block reviewing the coach', () => screen({ hasReviewed: true, review: { rating: 2, comment: 'Nhận xét buổi cũ' } }, async () => {
  await click(document.querySelector('[data-session-id="101"]'))
  await click(document.querySelector('input[name="coach-rating"][value="5"]'))
  await changeComment('#member-coach-comment', 'Coach hỗ trợ tốt')
  await click(document.querySelectorAll('.member-review-tabs button')[1])
  assert.match(sessionForm().textContent, /2\/5 sao/)
  assert.match(sessionForm().textContent, /Nhận xét buổi cũ/)
  await click(document.querySelectorAll('.member-review-tabs button')[0])
  assert.equal(document.querySelector('input[name="coach-rating"][value="5"]').checked, true)
  assert.equal(document.querySelector('#member-coach-comment').value, 'Coach hỗ trợ tốt')
  await submit()
  assert.equal(posts.length, 1)
  assert.equal(sessionPosts.length, 0)
}))

test('session reviews remain available when coach reviews fail to load', () => screen({}, async () => {
  failCoachRead = true
  await openSessionReview()
  assert.ok(document.querySelector('input[name="session-rating"]'))
  await click(document.querySelector('input[name="session-rating"][value="3"]'))
  await submitSession()
  assert.equal(sessionPosts.length, 1)
  assert.equal(posts.length, 0)
}))

test('switching between coach and session reviews preserves the separate session draft', () => screen({}, async () => {
  await openSessionReview()
  await click(document.querySelector('input[name="session-rating"][value="4"]'))
  await act(async () => {
    const field = document.querySelector('#member-session-comment')
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(field, 'Buổi học tốt')
    field.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  await click(document.querySelectorAll('.member-review-tabs button')[0])
  await click(document.querySelectorAll('.member-review-tabs button')[1])
  assert.equal(document.querySelector('input[name="session-rating"][value="4"]').checked, true)
  assert.equal(document.querySelector('#member-session-comment').value, 'Buổi học tốt')
  assert.equal(posts.length, 0)
  assert.equal(sessionPosts.length, 0)
}))

test('a session review rechecks attendance and reconciles an already saved response before retrying', () => screen({}, async () => {
  await openSessionReview()
  await click(document.querySelector('input[name="session-rating"][value="3"]'))
  registration = { ...registration, attendanceStatus: 'Absent' }
  await submitSession()
  assert.equal(sessionPosts.length, 0)
  assert.match(sessionForm().textContent, /không tham gia/)
  await click(document.querySelector('[aria-label="Đóng đánh giá coach"]'))
  registration = { ...registration, attendanceStatus: 'Present' }
  await openSessionReview()
  await click(document.querySelector('input[name="session-rating"][value="3"]'))
  sessionConflict = true
  await submitSession()
  assert.equal(sessionPosts.length, 1)
  assert.equal(document.querySelector('input[name="session-rating"]'), null)
  assert.match(sessionForm().textContent, /3\/5 sao/)
}))
