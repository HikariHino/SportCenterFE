import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let window, server, createRoot, View, api, calls, failure, profile, sessions, coaches, hold, release
const descriptors = new Map()
before(async () => {
  window = new Window({ url: 'http://localhost/coach' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator, HTMLElement: window.HTMLElement,
    localStorage: window.localStorage, sessionStorage: window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  View = (await server.ssrLoadModule('/src/components/CoachReviewsView.jsx')).default
  createRoot = (await import('react-dom/client')).createRoot
})
after(async () => {
  await server?.close(); await window?.happyDOM.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})
async function screen(props, run, setup = () => {}) {
  calls = []; failure = false; hold = false; release = null
  profile = { userId: 99, coachId: 7, fullName: 'Coach An', email: 'an@example.com' }
  sessions = [{ id: 30, coachId: 7 }]
  coaches = [{ id: 7, userId: 99, fullName: 'Coach An' }, { id: 8, userId: 44, fullName: 'Coach Bình' }]
  setup()
  api.defaults.adapter = async config => {
    calls.push({ url: config.url, method: config.method, params: config.params })
    assert.equal(config.method, 'get', 'review browsing must never write')
    let data
    if (config.url === '/profile') data = profile
    else if (config.url === '/coaches') data = coaches
    else if (config.url === '/class-sessions/mine') data = { items: sessions, total: sessions.length, page: 1 }
    else {
      assert.match(config.url, /^\/coaches\/[78]\/reviews$/)
      if (failure) throw new Error('Không thể tải đánh giá coach.')
      const coachId = Number(config.url.split('/')[2]), page = config.params.page
      const items = coachId === 8 ? [] : Array.from({ length: 11 }, (_, i) => ({ id: i + 1, coachId, memberId: i + 50,
        memberName: `Hội viên ${i + 1}`, rating: 5, comment: i ? null : '<script>Nhận xét dài</script>\nHướng dẫn tốt', createdAt: '2026-11-24T01:00:00Z' }))
      data = { coachId, averageRating: items.length ? 4.5 : null, reviewCount: items.length, total: items.length, page,
        items: items.slice((page - 1) * 10, page * 10) }
      if (hold && coachId === 7) await new Promise(resolve => { release = resolve })
    }
    return { config, data: { success: true, data }, status: 200, headers: {} }
  }
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  try {
    await act(async () => root.render(h(View, props)))
    await run(container, root)
  } finally {
    if (release) await act(async () => release())
    await act(async () => root.unmount()); container.remove()
  }
}
const click = node => act(async () => node.click())
const select = (container, value) => act(async () => {
  const node = container.querySelector('.coach-reviews-picker select')
  node.value = value; node.dispatchEvent(new window.Event('change', { bubbles: true }))
})

test('Coach sees their own reviews, server summary, pagination and safely rendered comments without a coach selector', () => screen({ own: true }, async container => {
  assert.equal(container.querySelector('.coach-reviews-picker'), null)
  assert.match(container.textContent, /4,5\/5 sao/)
  assert.match(container.textContent, /11 lượt đánh giá/)
  assert.equal(container.querySelectorAll('.coach-reviews-item').length, 10)
  assert.equal(container.querySelector('script'), null)
  assert.match(container.textContent, /Hướng dẫn tốt/)
  await click(container.querySelector('[aria-label="Trang sau: Đánh giá coach"]'))
  assert.equal(container.querySelectorAll('.coach-reviews-item').length, 1)
  assert.match(container.textContent, /Hội viên 11/)
  assert.match(container.textContent, /không để lại nhận xét/)
  assert.ok(calls.filter(item => item.url.endsWith('/reviews')).every(item => item.url === '/coaches/7/reviews'))
  assert.equal(calls.at(-1).params.page, 2)
}))

test('Coach identity uses assigned coach ID rather than user ID when profile has no coach ID', () => screen({ own: true }, async container => {
  assert.match(container.textContent, /11 lượt đánh giá/)
  assert.ok(calls.some(item => item.url === '/class-sessions/mine'))
  assert.ok(calls.some(item => item.url === '/coaches/7/reviews'))
}, () => { delete profile.coachId }))

test('a coach without sessions resolves through their linked user account, never through a matching name', () => screen({ own: true }, async container => {
  assert.match(container.textContent, /11 lượt đánh giá/)
}, () => { delete profile.coachId; sessions = []; coaches.unshift({ id: 8, userId: 123, fullName: 'Coach An' }) }))

test('unresolved coach identity shows an error and does not request another coach reviews', () => screen({ own: true }, async container => {
  assert.match(container.querySelector('[role=alert]').textContent, /Chưa xác định/)
  assert.equal(calls.some(item => item.url.endsWith('/reviews')), false)
}, () => { delete profile.coachId; sessions = []; coaches = [{ id: 8, fullName: 'Coach An' }] }))

test('Receptionist can select another coach and sees an honest empty state', () => screen({}, async container => {
  assert.ok(container.querySelector('.coach-reviews-picker'))
  await select(container, '8')
  assert.match(container.textContent, /Coach Bình/)
  assert.match(container.textContent, /Chưa có đánh giá/)
  assert.equal(container.querySelectorAll('.coach-reviews-item').length, 0)
  assert.equal(calls.some(item => item.url === '/profile'), false)
}))

test('review errors support retry and refresh without displaying false zero ratings', () => screen({}, async container => {
  assert.ok(container.querySelector('[role=alert]'))
  assert.doesNotMatch(container.textContent, /Chưa có đánh giá/)
  failure = false
  await click([...container.querySelectorAll('button')].find(node => node.textContent === 'Thử lại'))
  assert.match(container.textContent, /11 lượt đánh giá/)
  const before = calls.length
  await click([...container.querySelectorAll('button')].find(node => node.textContent.includes('Làm mới')))
  assert.equal(calls.length, before + 1)
}, () => { failure = true }))

test('switching coach ignores a late response from the previous selection', () => screen({}, async container => {
  assert.ok(release)
  await select(container, '8')
  await act(async () => release())
  assert.match(container.textContent, /Coach Bình/)
  assert.doesNotMatch(container.textContent, /Hướng dẫn tốt/)
}, () => { hold = true }))

test('an inactive reviews tab does not request data until opened', () => screen({ active: false }, async (container, root) => {
  assert.equal(calls.length, 0)
  await act(async () => root.render(h(View, { active: true })))
  assert.match(container.textContent, /11 lượt đánh giá/)
}))
