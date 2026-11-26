import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let window, server, api, RoomManagement, Provider, createRoot
let policies, failPolicies, saved, writes
const descriptors = new Map()
const room = { id: 3, name: 'Studio Yoga', capacity: 25, isActive: true }
const sportClass = { id: 14, className: 'Yoga sáng', sportId: 2, coachId: 5, roomId: 3, maxCapacity: 20, startDate: '2099-11-23', endDate: '2099-12-23', isActive: true }
before(async () => {
  window = new Window({ url: 'http://localhost/manager?view=rooms' })
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
      assert.equal(config.method, 'post')
      assert.equal(config.url, '/classes/14/sessions')
      const payload = JSON.parse(config.data)
      writes.push(payload)
      saved.push({ id: 81 + saved.length, classId: 14, status: 'Scheduled', ...payload })
      return respond(saved.at(-1))
    }
    switch (config.url.toLowerCase()) {
      case '/coaches': return respond([{ id: 5, fullName: 'HLV An' }])
      case '/rooms': return respond([room])
      case '/rooms/3/check-availability': return respond({ isAvailable: true })
      case '/classes/manage': return respond([sportClass])
      case '/classes/14': return respond(sportClass)
      case '/classes/14/sessions': return respond(saved)
      case '/cancellation-policies':
        if (failPolicies) throw new Error('Không thể tải chính sách hủy.')
        return respond(policies)
      default: assert.fail(`Unexpected request: ${config.url}`)
    }
  }
  RoomManagement = (await server.ssrLoadModule('/src/pages/CenterManager/RoomManagement.jsx')).default
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
const click = selector => act(async () => {
  const button = document.querySelector(selector)
  assert.ok(button, selector)
  assert.equal(button.disabled, false, selector)
  button.click()
})
const change = (selector, value) => act(async () => {
  const input = document.querySelector(selector)
  assert.ok(input, selector)
  if (input.tagName === 'SELECT') input.value = value
  else Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
  input.dispatchEvent(new window.Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
})
const submit = () => act(async () => document.querySelector('.room-recurring-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
async function screen(run) {
  saved = []; writes = []; failPolicies = false
  policies = [{ id: 1, name: 'Inactive', isActive: false }, { id: 7, name: 'Standard', minimumHoursBeforeStart: 4, isActive: true }, { id: 9, name: 'Flexible', minimumHoursBeforeStart: 2, isActive: true }]
  const container = document.body.appendChild(document.createElement('div'))
  const root = createRoot(container)
  try {
    await act(async () => root.render(h(Provider, { sessionKey: 'test' }, h(RoomManagement))))
    await click('.room-card-schedule-trigger')
    await run()
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
}
test('creating a room session uses the chosen active policy when policy 1 is inactive', () => screen(async () => {
  await click('.room-timetable-add')
  const select = document.querySelector('[name="cancellationPolicyId"]')
  assert.equal(select.value, '7')
  assert.deepEqual([...select.options].map(option => option.value), ['', '7', '9'])
  await change('[name="classId"]', '14')
  await change('[name="cancellationPolicyId"]', '9')
  await click('.room-recurring-submit')
  assert.equal(writes.length, 1)
  assert.equal(writes[0].cancellationPolicyId, 9)
  assert.equal(writes[0].roomId, 3)
  assert.equal(writes[0].coachId, 5)
  assert.equal(document.querySelector('.room-recurring-form'), null)
}))

test('no active policies explains the missing setup and prevents room session creation', () => screen(async () => {
  policies = policies.filter(policy => policy.isActive === false)
  await click('.room-timetable-add')
  await change('[name="classId"]', '14')
  const form = document.querySelector('.room-recurring-form')
  assert.match(form.textContent, /Chưa có chính sách hủy đang hoạt động/)
  assert.equal(form.querySelector('[type="submit"]').disabled, true)
  await submit()
  assert.equal(writes.length, 0)
  assert.match(form.querySelector('[role="alert"]').textContent, /chính sách hủy đang hoạt động/)
}))

test('failed policy loading can be retried without losing the selected calendar date or times', () => screen(async () => {
  failPolicies = true
  await change('.room-timetable-dialog .member-timetable-toolbar input[type="date"]', '2099-11-23')
  await click('.member-timetable-create-slot[data-create-date="2099-11-23"]')
  const form = document.querySelector('.room-recurring-form')
  assert.match(form.textContent, /Không thể tải chính sách hủy/)
  assert.equal(form.querySelector('[type="submit"]').disabled, true)
  const fields = ['date', 'startTime', 'endTime']
  const original = fields.map(name => form.querySelector(`[name="${name}"]`).value)
  assert.equal(original[0], '2099-11-23')
  failPolicies = false
  await click('.room-recurring-error button')
  assert.equal(form.querySelector('[name="cancellationPolicyId"]').value, '7')
  assert.deepEqual(fields.map(name => form.querySelector(`[name="${name}"]`).value), original)
  await change('[name="classId"]', '14')
  assert.equal(form.querySelector('[type="submit"]').disabled, false)
  await click('.room-recurring-submit')
  assert.equal(writes.length, 1)
  assert.equal(writes[0].cancellationPolicyId, 7)
}))
