import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let window, server, createRoot, Staff, AuthProvider, api, writes, failure, release, staffContacts, memberContacts, failContacts
const descriptors = new Map()
before(async () => {
  window = new Window({ url: 'http://localhost/manager' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator, HTMLElement: window.HTMLElement,
    localStorage: window.localStorage, sessionStorage: window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  api.defaults.adapter = async config => {
    const respond = data => ({ data: { success: true, data }, status: 200, headers: {}, config })
    if (config.method === 'get') {
      if (failContacts && ['/users/staff', '/members'].includes(config.url)) throw new Error('Không thể kiểm tra thông tin tài khoản')
      return respond(config.url === '/users/staff' ? staffContacts : config.url === '/members' ? memberContacts : [])
    }
    assert.equal(config.url, '/users/staff')
    writes.push(JSON.parse(config.data))
    if (failure) throw { response: { status: 409, data: failure } }
    return new Promise(resolve => { release = () => resolve(respond({ userId: 7, ...JSON.parse(config.data) })) })
  }
  Staff = (await server.ssrLoadModule('/src/pages/CenterManager/StaffManagement.jsx')).default
  AuthProvider = (await server.ssrLoadModule('/src/contexts/AuthContext.jsx')).AuthProvider
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
  writes = []; failure = null; release = null; staffContacts = []; memberContacts = []; failContacts = false
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  try {
    await act(async () => root.render(h(AuthProvider, null, h(Staff))))
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent.includes('Thêm nhân viên')).click())
    await run(container.querySelector('form'))
  } finally {
    if (release) await act(async () => release())
    await act(async () => root.unmount()); container.remove()
  }
}
const change = (name, value) => act(async () => {
  const input = document.querySelector(`.staff-modal [name="${name}"]`)
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
  input.dispatchEvent(new window.Event('input', { bubbles: true }))
})
const submit = form => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
async function valid() {
  await change('fullName', 'Nguyễn Văn An')
  await change('email', 'coach@fpt.edu.vn')
  await change('password', ' pass123 ')
  await change('phone', '0912345678')
}
test('empty staff form shows field errors together, focuses first error and does not call API', () => screen(async form => {
  await act(async () => submit(form))
  for (const field of ['fullName', 'email', 'password', 'phone']) {
    const input = form.elements.namedItem(field)
    assert.equal(input.getAttribute('aria-invalid'), 'true')
    assert.ok(document.getElementById(input.getAttribute('aria-describedby'))?.textContent)
  }
  assert.equal(document.activeElement, form.elements.namedItem('fullName'))
  assert.equal(form.elements.namedItem('phone').required, true)
  assert.equal(writes.length, 0)
}))
test('field validation catches malformed names, emails, Unicode password bytes and invalid phones', () => screen(async form => {
  await valid()
  for (const [field, value] of [['fullName', 'Nguyễn 123'], ['email', 'a..b@example.com'], ['password', 'é'.repeat(37)], ['phone', '091234567']]) {
    await change(field, value)
    await act(async () => submit(form))
    assert.equal(form.elements.namedItem(field).getAttribute('aria-invalid'), 'true')
    assert.equal(writes.length, 0)
    await change(field, { fullName: 'Nguyễn An', email: 'coach@fpt.edu.vn', password: ' pass123 ', phone: '0912345678' }[field])
    assert.equal(form.elements.namedItem(field).getAttribute('aria-invalid'), 'false')
  }
}))
test('valid staff form submits only once on rapid clicks, locks fields and preserves password bytes', () => screen(async form => {
  await valid()
  await act(async () => { submit(form); submit(form) })
  assert.equal(writes.length, 1)
  assert.equal(writes[0].password, ' pass123 ')
  assert.equal(writes[0].phone, '0912345678')
  assert.equal(writes[0].role, 'Coach')
  for (const field of ['fullName', 'email', 'password', 'phone', 'role']) assert.equal(form.elements.namedItem(field).disabled, true)
  await act(async () => release())
  assert.equal(document.querySelector('.staff-modal'), null)
}))
test('backend validation maps email and phone errors to fields, preserves the form and permits corrected retry', () => screen(async form => {
  await valid()
  failure = { errors: { Email: ['Email đã được sử dụng.'], PhoneNumber: ['Số điện thoại đã được sử dụng.'] } }
  await act(async () => submit(form))
  assert.match(document.querySelector('#staff-create-email-error').textContent, /Email đã/)
  assert.match(document.querySelector('#staff-create-phone-error').textContent, /đã được/)
  assert.equal(form.elements.namedItem('fullName').value, 'Nguyễn Văn An')
  assert.equal(form.elements.namedItem('email').disabled, false)
  await change('email', 'newcoach@example.com')
  await change('phone', '0912345678')
  failure = null
  await act(async () => submit(form))
  assert.equal(writes.length, 2)
  await act(async () => release())
  assert.equal(document.querySelector('.staff-modal'), null)
}))

test('newly created staff phone duplicates are blocked even when absent from the mounted staff list', () => screen(async form => {
  await valid()
  await change('phone', '0947022366')
  // Reproduce the screenshot: another account is created after this form loaded.
  staffContacts = [{ userId: 82, fullName: 'Le Thanh Nha', email: 'other@example.com', phone: '0947022366', isActive: false }]
  await act(async () => submit(form))
  assert.equal(writes.length, 0)
  assert.match(document.querySelector('#staff-create-phone-error').textContent, /đã được sử dụng/)
  await change('phone', '0947022367')
  await act(async () => submit(form))
  assert.equal(writes.length, 1)
  assert.equal(writes[0].phone, '0947022367')
  await act(async () => release())
}))

test('staff creation checks member accounts and normalizes phone aliases and email case', () => screen(async form => {
  await valid()
  memberContacts = [{ memberId: 8, email: ' COACH@FPT.EDU.VN ', phoneNumber: '+84 912 345 678' }]
  await act(async () => submit(form))
  assert.equal(writes.length, 0)
  assert.match(document.querySelector('#staff-create-email-error').textContent, /đã được sử dụng/)
  assert.match(document.querySelector('#staff-create-phone-error').textContent, /đã được sử dụng/)
}))

test('incomplete email suffix and unreadable account lists cannot create staff', () => screen(async form => {
  await valid()
  await change('email', 'min@gmail.c')
  await act(async () => submit(form))
  assert.equal(writes.length, 0)
  assert.ok(document.querySelector('#staff-create-email-error'))
  await change('email', 'min@gmail.com')
  failContacts = true
  await act(async () => submit(form))
  assert.equal(writes.length, 0)
  assert.match(document.querySelector('#staff-create-error').textContent, /Không thể kiểm tra/)
  failContacts = false
  memberContacts = { items: [] }
  await act(async () => submit(form))
  assert.equal(writes.length, 0)
  assert.match(document.querySelector('#staff-create-error').textContent, /Chưa tải đủ/)
}))
