import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'

let window, server, createRoot, Dialog
const descriptors = new Map()
const deadline = Date.parse('2026-11-20T10:00:00+07:00')
const registration = { id: 101, sessionId: 2, status: 'Registered', sessionStatus: 'Scheduled', className: 'Tennis A',
  startsAt: '2026-11-20T14:00:00+07:00', endsAt: '2026-11-20T15:00:00+07:00', cancellationDeadline: new Date(deadline).toISOString() }

before(async () => {
  window = new Window({ url: 'http://localhost:3000/member' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, localStorage: window.localStorage, sessionStorage: window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ configFile: false, esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  Dialog = (await server.ssrLoadModule('/src/pages/member/ClassesView.jsx')).ActionDialog
  createRoot = (await import('react-dom/client')).createRoot
})
after(async () => {
  await server?.close(); await window?.happyDOM.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

async function screen(run) {
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  let submits = 0
  const render = props => act(async () => root.render(h(Dialog, { action: { type: 'cancel', item: registration }, busy: false,
    onClose() {}, onSubmit() { submits++ }, now: deadline, ...props })))
  try { await render(); await run(render, () => submits) }
  finally { await act(async () => root.unmount()); container.remove() }
}
const submit = () => act(async () => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))

test('cancel confirmation permits the exact cutoff then disables submission and explains expiry', () => screen(async (render, submits) => {
  assert.equal(document.querySelector('[type=submit]').disabled, false)
  assert.match(document.body.textContent, /10:00/)
  await submit(); assert.equal(submits(), 1)
  await render({ now: deadline + 1 })
  assert.equal(document.querySelector('[type=submit]').disabled, true)
  assert.match(document.querySelector('[role=alert]').textContent, /quá hạn hủy/)
  await submit(); assert.equal(submits(), 1)
}))

test('fresh attendance or a missing cancellation policy blocks an already open confirmation', () => screen(async (render, submits) => {
  for (const changes of [{ attendanceStatus: 'Absent' }, { cancellationDeadline: null }]) {
    await render({ action: { type: 'cancel', item: { ...registration, ...changes } } })
    assert.equal(document.querySelector('[type=submit]').disabled, true)
    assert.ok(document.querySelector('[role=alert]'))
    await submit()
  }
  assert.equal(submits(), 0)
}))

test('booking can confirm just before start and blocks at start or when membership is inactive', () => screen(async (render, submits) => {
  const action = { type: 'book', item: { ...registration, id: 2, status: 'Scheduled' } }, start = Date.parse(registration.startsAt)
  await render({ action, now: start - 1, hasActiveSubscription: true })
  assert.equal(document.querySelector('[type=submit]').disabled, false)
  assert.match(document.body.textContent, /Đặt lịch trước giờ bắt đầu/)
  await submit(); assert.equal(submits(), 1)
  await render({ action, now: start, hasActiveSubscription: true })
  assert.equal(document.querySelector('[type=submit]').disabled, true)
  assert.match(document.querySelector('[role=alert]').textContent, /đóng đăng ký/)
  await submit()
  await render({ action, now: start - 1, hasActiveSubscription: false })
  assert.equal(document.querySelector('[type=submit]').disabled, true)
  await submit(); assert.equal(submits(), 1)
}))

test('booking confirmation lists every selected session without ordinal labels or pagination and retains retry filtering', () => screen(async (render, submits) => {
  const sessions = Array.from({ length: 12 }, (_, index) => ({ id: index + 221, status: 'Scheduled',
    startsAt: `2026-12-${String(index + 1).padStart(2, '0')}T17:30:00+07:00`, endsAt: `2026-12-${String(index + 1).padStart(2, '0')}T18:30:00+07:00` }))
  const action = { type: 'bookClass', item: { id: 11, className: 'Gym sức mạnh cơ bản', sessions } }
  await render({ action, hasActiveSubscription: true })
  const list = document.querySelector('[aria-label="Buổi học chờ xác nhận"]')
  assert.equal(list.querySelectorAll('li').length, 12)
  assert.match(list.lastElementChild.textContent, /Buổi #232/)
  assert.equal(list.querySelector('.member-numbered-item'), null)
  assert.equal(document.querySelector('.member-classes-dialog .member-pagination'), null)
  assert.equal(document.querySelector('.member-classes-dialog .member-list-scroll'), null)
  await submit(); assert.equal(submits(), 1)
  await render({ action, hasActiveSubscription: true, bulkResult: { remaining: ['231', '232'], registered: ['221'], existing: [], skipped: [] } })
  assert.deepEqual([...document.querySelectorAll('.member-class-booking-preview strong')].map(item => item.textContent), ['Buổi #231', 'Buổi #232'])
  assert.equal(document.querySelector('.member-classes-dialog .member-pagination'), null)
}))
