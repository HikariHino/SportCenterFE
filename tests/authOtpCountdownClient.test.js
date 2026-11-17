import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let window, server, createRoot, Router, Theme, Auth
let now = Date.parse('2026-11-17T01:00:00+07:00'), failSend = false
const originalNow = Date.now, descriptors = new Map(), intervals = new Map(), requests = [], views = {}
let nextTimer = 0
let patternDescriptor
before(async () => {
  window = new Window({ url: 'http://localhost:3000/register' })
  // happy-dom omits HTML's Unicode pattern flag. Use the browser's v semantics
  // for those patterns so native validity does not reject Vietnamese fixtures.
  patternDescriptor = Object.getOwnPropertyDescriptor(window.ValidityState.prototype, 'patternMismatch')
  Object.defineProperty(window.ValidityState.prototype, 'patternMismatch', { configurable: true, get() {
    const pattern = this.element.getAttribute('pattern')
    if (pattern?.includes('\\p{')) return Boolean(this.element.value && !new RegExp(`^(?:${pattern})$`, 'v').test(this.element.value))
    return patternDescriptor.get.call(this)
  } })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, FormData: window.FormData, localStorage: window.localStorage, sessionStorage: window.sessionStorage,
    IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  Date.now = () => now
  window.setInterval = callback => { const id = ++nextTimer; intervals.set(id, callback); return id }
  window.clearInterval = id => intervals.delete(id)
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    define: { 'import.meta.env.VITE_GOOGLE_CLIENT_ID': '""' }, esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module-sync', 'module', 'import'] } },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  const api = (await server.ssrLoadModule('/src/services/api.js')).default
  api.defaults.adapter = async config => {
    requests.push({ url: config.url, body: JSON.parse(config.data || '{}') })
    if (failSend && !config.url.includes('verify')) throw new Error('Chưa gửi được OTP.')
    return { config, status: 200, headers: {}, data: config.url.includes('verify') ? { success: false, message: 'Mã OTP không đúng.' } : { success: true, message: 'Đã gửi OTP.' } }
  }
  views.register = (await server.ssrLoadModule('/src/pages/Register.jsx')).default
  views.reset = (await server.ssrLoadModule('/src/pages/ForgotPassword.jsx')).default
  Router = (await server.ssrLoadModule('react-router-dom')).MemoryRouter
  Theme = (await server.ssrLoadModule('/src/contexts/ThemeContext.jsx')).ThemeProvider
  Auth = (await server.ssrLoadModule('/src/contexts/AuthContext.jsx')).AuthProvider
  createRoot = (await import('react-dom/client')).createRoot
})
after(async () => {
  if (patternDescriptor) Object.defineProperty(window.ValidityState.prototype, 'patternMismatch', patternDescriptor)
  await server?.close(); await window?.happyDOM.close(); Date.now = originalNow
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})
const change = (selector, value) => act(async () => {
  const input = document.querySelector(selector)
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
  input.dispatchEvent(new window.Event('input', { bubbles: true }))
})
const click = selector => act(async () => document.querySelector(selector).click())
const submit = () => act(async () => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
const advance = milliseconds => act(async () => { now += milliseconds; for (const callback of [...intervals.values()]) callback() })
async function screen(view, run) {
  requests.length = 0; failSend = false; now = Date.parse('2026-11-17T01:00:00+07:00')
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  try {
    await act(async () => root.render(h(Router, null, h(Theme, null, h(Auth, null, h(views[view]))))))
    if (view === 'register') {
      for (const [field, value] of Object.entries({ fullname: 'Nguyễn Văn An', phone: '0912345678', email: 'an@example.com', dateOfBirth: '2026-11-17', address: 'Hà Nội', fitnessGoal: 'Tăng sức bền', password: 'Password123!', 'confirm-password': 'Password123!' })) await change('#' + field, value)
      await act(async () => { const gender = document.querySelector('#gender'); gender.value = 'Male'; gender.dispatchEvent(new window.Event('change', { bubbles: true })); document.querySelector('[name="terms"]').click() })
      const invalid = [...document.querySelector('form').elements].filter(field => field.name && !['otp', 'terms'].includes(field.name) && !field.checkValidity()).map(field => ({ name: field.name, value: field.value, reason: field.validationMessage }))
      assert.deepEqual(invalid, [])
    } else await change('#reset-email', 'an@example.com')
    await run()
  } finally {
    await act(async () => root.unmount()); container.remove()
    assert.equal(intervals.size, 0, 'unmount removes countdown timers')
  }
}

test('registration uses the Vietnam date limit and starts a five-minute timer only after successful sending', () => screen('register', async () => {
  assert.equal(document.querySelector('#dateOfBirth').max, '2026-11-17')
  failSend = true
  await click('[name="send-otp"]')
  assert.equal(document.querySelector('.otp-countdown'), null)
  assert.equal(document.querySelector('[name="send-otp"]').disabled, false)
  failSend = false
  await click('[name="send-otp"]')
  assert.equal(requests.length, 2)
  assert.match(document.querySelector('.otp-countdown').textContent, /5:00/)
  assert.match(document.querySelector('[name="send-otp"]').textContent, /30s/)
  assert.equal(document.querySelector('[name="send-otp"]').disabled, true)
}))

test('registration cooldown survives edited details and resend clears the old OTP', () => screen('register', async () => {
  await click('[name="send-otp"]')
  await change('#otp', '012345')
  await change('#address', 'Địa chỉ khác')
  assert.equal(document.querySelector('.otp-countdown'), null)
  assert.equal(document.querySelector('[name="send-otp"]').disabled, true)
  await click('[name="send-otp"]'); assert.equal(requests.length, 1)
  await advance(30000)
  await click('[name="send-otp"]')
  assert.equal(requests.length, 2)
  assert.equal(document.querySelector('#otp').value, '')
  assert.match(document.querySelector('.otp-countdown').textContent, /5:00/)
}))

test('registration can verify during resend cooldown but cannot submit a locally expired OTP', () => screen('register', async () => {
  await click('[name="send-otp"]')
  await change('#otp', '012345'); await submit()
  assert.equal(requests.filter(request => request.url.includes('verify')).length, 1)
  assert.equal(requests.at(-1).body.otp, '012345')
  await advance(300000)
  assert.equal(document.querySelector('.register-submit').disabled, true)
  assert.match(document.querySelector('.otp-countdown').textContent, /hết hạn/)
  await submit()
  assert.equal(requests.filter(request => request.url.includes('verify')).length, 1)
}))

test('password reset shows expiry and resend cooldown, while resending preserves password drafts', () => screen('reset', async () => {
  await submit()
  assert.match(document.querySelector('.otp-countdown').textContent, /5:00/)
  assert.equal(document.querySelector('.reset-actions button').disabled, true)
  await click('.reset-actions button'); assert.equal(requests.length, 1)
  await change('#reset-otp', '012345')
  await change('#reset-password', 'Password123!'); await change('#reset-confirm-password', 'Password123!')
  await advance(30000)
  await click('.reset-actions button')
  assert.equal(requests.length, 2)
  assert.equal(document.querySelector('#reset-otp').value, '')
  assert.equal(document.querySelector('#reset-password').value, 'Password123!')
  assert.match(document.querySelector('.otp-countdown').textContent, /5:00/)
}))

test('failed reset resends keep the original expiry and a sleeping tab cannot verify an expired code', () => screen('reset', async () => {
  await submit(); await advance(30000)
  failSend = true
  await click('.reset-actions button')
  assert.match(document.querySelector('.otp-countdown').textContent, /4:30/)
  assert.equal(document.querySelector('.reset-actions button').disabled, false)
  failSend = false
  await change('#reset-otp', '012345')
  await change('#reset-password', 'Password123!'); await change('#reset-confirm-password', 'Password123!')
  now += 600000
  await submit()
  assert.equal(requests.filter(request => request.url.includes('verify')).length, 0)
  await act(async () => window.dispatchEvent(new window.Event('focus')))
  assert.equal(document.querySelector('.login-submit').disabled, true)
  assert.match(document.querySelector('.otp-countdown').textContent, /hết hạn/)
}))

test('changing reset email does not bypass resend cooldown', () => screen('reset', async () => {
  await submit()
  await click('.reset-actions button:last-child')
  await change('#reset-email', 'other@example.com')
  assert.equal(document.querySelector('.login-submit').disabled, true)
  await submit(); assert.equal(requests.length, 1)
  await advance(30000); await submit()
  assert.equal(requests.length, 2)
  assert.equal(requests.at(-1).body.email, 'other@example.com')
}))
