import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let window, server, api, ClassManagement, Provider, createRoot
let policies, failPolicies, saved, writes
const descriptors = new Map()
const room = { id: 3, name: 'Studio Yoga', capacity: 25, isActive: true }
const sportClass = { id: 14, className: 'Yoga sáng', sportId: 2, coachId: 5, roomId: 3, maxCapacity: 20, startDate: '2020-01-01', endDate: '2099-12-31', isActive: true }
before(async () => {
  window = new Window({ url: 'http://localhost/manager' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, localStorage: window.localStorage, sessionStorage: window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  api.defaults.adapter = async config => {
    const respond = data => ({ data: { success: true, data }, status: 200, statusText: 'OK', headers: {}, config })
    if (config.method !== 'get') {
      writes.push(JSON.parse(config.data))
      saved.push({ id: 81, classId: 14, status: 'Scheduled', ...JSON.parse(config.data) })
      return respond(saved.at(-1))
    }
    switch (config.url.toLowerCase()) {
      case '/sports': return respond([{ id: 2, name: 'Yoga' }])
      case '/coaches': return respond([{ id: 5, fullName: 'HLV An' }])
      case '/rooms': return respond([room])
      case '/classes/manage': return respond([sportClass])
      case '/classes/14': return respond(sportClass)
      case '/classes/14/sessions': return respond(saved)
      case '/cancellation-policies':
        if (failPolicies) throw new Error('Policy read failed')
        return respond(policies)
      default: return respond([])
    }
  }
  ClassManagement = (await server.ssrLoadModule('/src/pages/CenterManager/ClassManagement.jsx')).default
  Provider = (await server.ssrLoadModule('/src/contexts/ManagerWorkspaceContext.jsx')).ManagerWorkspaceProvider
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
const click = text => act(async () => {
  const button = [...document.querySelectorAll('button')].find(button => button.textContent.includes(text))
  assert.ok(button, text)
  button.click()
})
async function screen(run) {
  saved = []; writes = []; failPolicies = false
  policies = [{ id: 1, name: 'Inactive', isActive: false }, { id: 7, name: 'Standard', minimumHoursBeforeStart: 4, isActive: true }, { id: 9, name: 'Flexible', minimumHoursBeforeStart: 2, isActive: true }]
  const container = document.body.appendChild(document.createElement('div'))
  const root = createRoot(container)
  try {
    await act(async () => root.render(h(Provider, { sessionKey: 'test' }, h(ClassManagement))))
    await click('Buổi học')
    await run()
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
}
test('creating a class session uses the chosen active policy when policy 1 is inactive', () => screen(async () => {
  await click('Thêm buổi học')
  const select = document.querySelector('[name="cancellationPolicyId"]')
  assert.equal(select.value, '7')
  assert.deepEqual([...select.options].map(option => option.value), ['', '7', '9'])
  await act(async () => { select.value = '9'; select.dispatchEvent(new window.Event('change', { bubbles: true })) })
  const form = select.closest('form')
  await act(async () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(writes.length, 1)
  assert.equal(writes[0].cancellationPolicyId, 9)
  assert.equal(document.querySelector('.class-session-form-modal'), null)
}))
test('no active policies explains the missing setup and prevents session creation', () => screen(async () => {
  policies = policies.filter(policy => policy.isActive === false)
  await click('Thêm buổi học')
  const form = document.querySelector('.class-session-form-modal form')
  assert.match(form.textContent, /Chưa có chính sách hủy đang hoạt động/)
  assert.equal(form.querySelector('[type="submit"]').disabled, true)
  await act(async () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(writes.length, 0)
}))
test('failed policy loading can be retried without closing or losing the session form', () => screen(async () => {
  failPolicies = true
  await click('Thêm buổi học')
  const form = document.querySelector('.class-session-form-modal form')
  assert.match(form.textContent, /Không thể tải chính sách hủy/)
  assert.equal(form.querySelector('[type="submit"]').disabled, true)
  const startsAt = form.querySelector('[name="sessionStartsAt"]').value
  failPolicies = false
  await click('Thử lại')
  assert.equal(form.querySelector('[name="cancellationPolicyId"]').value, '7')
  assert.equal(form.querySelector('[name="sessionStartsAt"]').value, startsAt)
  assert.equal(form.querySelector('[type="submit"]').disabled, false)
}))
