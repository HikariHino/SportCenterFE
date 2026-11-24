import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let window, server, createRoot, FrontDesk, Receptionist, writes
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
  const api = (await server.ssrLoadModule('/src/services/api.js')).default
  api.defaults.adapter = async config => {
    if (config.method !== 'get') writes.push(JSON.parse(config.data))
    return { data: { success: true, data: config.method === 'get' ? [] : { memberId: 7 } }, status: 200, headers: {}, config }
  }
  FrontDesk = (await server.ssrLoadModule('/src/pages/CenterManager/FrontDeskOperations.jsx')).default
  Receptionist = (await server.ssrLoadModule('/src/pages/Receptionist/MembersView.jsx')).MembersView
  createRoot = (await import('react-dom/client')).createRoot
})
after(async () => {
  await server?.close()
  await window?.happyDOM.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})
async function screen(run, receptionist = false) {
  writes = []
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  try {
    await act(async () => root.render(receptionist ? h(Receptionist, { query: '', showNotice() {} }) : h(FrontDesk)))
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent.includes(receptionist ? 'Đăng ký hội viên' : 'Thêm hội viên')).click())
    await run(container.querySelector(receptionist ? '.reception-dialog form' : '.fdesk-dialog form'))
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
}
const change = (form, name, value) => act(async () => {
  const input = form.elements.namedItem(name)
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
  input.dispatchEvent(new window.Event('input', { bubbles: true }))
})
const submit = form => act(async () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))

test('counter member form shows all required errors together and focuses the first invalid field', () => screen(async form => {
  await submit(form)
  for (const field of ['fullName', 'email', 'password', 'phone', 'dateOfBirth']) {
    const input = form.elements.namedItem(field)
    assert.equal(input.getAttribute('aria-invalid'), 'true', field)
    assert.ok(document.getElementById(input.getAttribute('aria-describedby'))?.textContent)
  }
  assert.equal(document.activeElement.name, 'fullName')
  assert.equal(writes.length, 0)
  await change(form, 'fullName', 'Nguyễn Văn An')
  assert.equal(form.elements.fullName.getAttribute('aria-invalid'), 'false')
  assert.equal(form.elements.email.getAttribute('aria-invalid'), 'true')
}))

test('counter member form blocks invalid contact details and underage birthdays, then submits corrected data', t => {
  t.mock.method(Date, 'now', () => Date.parse('2026-11-24T10:00:00+07:00'))
  return screen(async form => {
    assert.equal(form.elements.dateOfBirth.max, '2010-11-24')
    assert.equal(form.elements.dateOfBirth.min, '1950-01-01')
    for (const [field, value] of Object.entries({ fullName: 'Nguyễn Văn An', email: 'an@localhost', password: 'Password123!', phone: '0112345678', dateOfBirth: '2010-11-25' })) await change(form, field, value)
    await submit(form)
    for (const field of ['email', 'phone', 'dateOfBirth']) assert.equal(form.elements[field].getAttribute('aria-invalid'), 'true')
    assert.equal(writes.length, 0)
    for (const [field, value] of Object.entries({ email: 'an@fpt.edu.vn', phone: '0912345678', dateOfBirth: '2010-11-24' })) await change(form, field, value)
    await submit(form)
    assert.equal(writes.length, 1)
    assert.equal(writes[0].dateOfBirth, '2010-11-24T00:00:00.000Z')
    assert.equal(document.querySelector('.fdesk-dialog form'), null)
  })
})

test('receptionist member creation blocks pre-1950 and under-sixteen dates before requests', t => {
  t.mock.method(Date, 'now', () => Date.parse('2026-11-24T10:00:00+07:00'))
  return screen(async form => {
    assert.equal(form.elements.dateOfBirth.min, '1950-01-01')
    assert.equal(form.elements.dateOfBirth.max, '2010-11-24')
    for (const [field, value] of Object.entries({ fullName: 'Nguyễn Văn An', email: 'an@fpt.edu.vn', password: 'Password123!', phone: '0912345678' })) await change(form, field, value)
    for (const dob of ['1900-01-01', '1949-12-31', '2015-01-01', '2010-11-25']) {
      await change(form, 'dateOfBirth', dob)
      await submit(form)
      assert.equal(form.elements.dateOfBirth.getAttribute('aria-invalid'), 'true')
      assert.ok(document.querySelector('#reception-create-member-error')?.textContent)
      assert.equal(writes.length, 0)
    }
    await change(form, 'dateOfBirth', '1950-01-01')
    await submit(form)
    assert.equal(writes.length, 1)
  }, true)
})
