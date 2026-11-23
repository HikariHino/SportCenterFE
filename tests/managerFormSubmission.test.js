import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let window, server, api, createRoot, Provider
const views = {}, descriptors = new Map(), writes = [], pending = []
before(async () => {
  window = new Window({ url: 'http://localhost:3000/manager' })
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
    const response = data => ({ data: { success: true, data }, status: 200, statusText: 'OK', headers: {}, config })
    if (config.method !== 'get') {
      writes.push({ url: config.url, method: config.method })
      const id = config.method === 'post' ? 100 + writes.length : 1
      return new Promise((resolve, reject) => pending.push({
        succeed: () => resolve(response({ id, ...JSON.parse(config.data || '{}') })),
        fail: () => reject(Object.assign(new Error('Không thể lưu, hãy thử lại.'), { response: { status: 409, data: { message: 'Không thể lưu, hãy thử lại.' } } })),
      }))
    }
    const url = config.url.toLowerCase()
    const data = url === '/sports' ? [{ id: 1, name: 'Tennis', isActive: true }]
      : url === '/coaches' ? [{ id: 1, fullName: 'HLV An' }]
        : url === '/rooms' ? [{ id: 1, name: 'Phòng cũ', roomType: 'General', capacity: 30, location: 'Tầng 1', isActive: true }]
          : url === '/membership-packages/manage' ? [{ id: 1, packageName: 'Gói cũ', packageType: 'PT', price: 1000, durationInDays: 30, isActive: true }]
            : url === '/cancellation-policies' ? [{ id: 1, name: 'Chính sách cũ', minimumHoursBeforeStart: 2, isActive: true }]
              : url === '/classes/manage' ? { items: [{ id: 1, className: 'Lớp cũ', sportId: 1, coachId: 1, maxCapacity: 20, startDate: '2027-01-01', endDate: '2027-12-31', isActive: true }], total: 1 } : []
    return response(data)
  }
  for (const view of ['RoomManagement', 'PackageManagement', 'CancellationPolicyManagement', 'ClassManagement']) views[view] = (await server.ssrLoadModule('/src/pages/CenterManager/' + view + '.jsx')).default
  Provider = (await server.ssrLoadModule('/src/contexts/ManagerWorkspaceContext.jsx')).ManagerWorkspaceProvider
  createRoot = (await import('react-dom/client')).createRoot
})
after(async () => {
  await server?.close(); await window?.happyDOM.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

const scenarios = [
  { view: 'RoomManagement', open: 'Thêm phòng tập', modal: '.room-modal', name: '.room-modal input', url: '/Rooms' },
  { view: 'PackageManagement', open: 'Tạo gói thẻ mới', modal: '.pkg-modal', name: '.pkg-modal input', url: '/membership-packages' },
  { view: 'CancellationPolicyManagement', open: 'Thêm chính sách mới', modal: '.policy-modal', name: '.policy-modal input', url: '/cancellation-policies' },
  { view: 'ClassManagement', tab: 'Bộ môn', open: 'Thêm bộ môn', modal: '.class-modal', name: '.class-modal input', url: '/sports' },
  { view: 'ClassManagement', open: 'Tạo lớp học', modal: '.class-modal', name: '.class-modal input', url: '/classes' },
  { view: 'RoomManagement', edit: '[aria-label^="Chỉnh sửa "]', modal: '.room-modal', name: '.room-modal input', url: '/Rooms/1' },
  { view: 'PackageManagement', edit: '[title="Chỉnh sửa giá bán, quyền lợi hoặc thời hạn"]', modal: '.pkg-modal', name: '.pkg-modal input', url: '/membership-packages/1' },
  { view: 'CancellationPolicyManagement', edit: '[title="Chỉnh sửa chính sách hủy"]', modal: '.policy-modal', name: '.policy-modal input', url: '/cancellation-policies/1' },
  { view: 'ClassManagement', tab: 'Bộ môn', edit: '[aria-label^="Chỉnh sửa bộ môn "]', modal: '.class-modal', name: '.class-modal input', url: '/sports/1' },
  { view: 'ClassManagement', edit: '[title="Chỉnh sửa thông tin chung của lớp học"]', modal: '.class-modal', name: '.class-modal input', url: '/classes/1' },
]
const change = input => value => act(async () => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
  input.dispatchEvent(new window.Event('input', { bubbles: true }))
})
const clickText = text => act(async () => {
  const button = [...document.querySelectorAll('button')].find(button => button.textContent.includes(text))
  assert.ok(button, text); button.click()
})
async function screen(scenario, run) {
  writes.length = 0
  const container = document.body.appendChild(document.createElement('div'))
  const root = createRoot(container)
  try {
    await act(async () => root.render(h(Provider, { sessionKey: scenario.view }, h(views[scenario.view]))))
    if (scenario.tab) await clickText(scenario.tab)
    if (scenario.edit) await act(async () => { const button = document.querySelector(scenario.edit); assert.ok(button, scenario.edit); button.click() })
    else await clickText(scenario.open)
    await run()
  } finally {
    await act(async () => pending.splice(0).forEach(request => request.succeed()))
    await act(async () => root.unmount())
    container.remove()
  }
}
for (const scenario of scenarios) {
  test(`${scenario.view} ${scenario.edit ? 'edit' : scenario.url}: whitespace errors stay inside the dialog and do not call the API`, () => screen(scenario, async () => {
    await change(document.querySelector(scenario.name))('   ')
    await act(async () => document.querySelector(scenario.modal + ' form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.equal(writes.length, 0)
    const error = document.querySelector(scenario.modal + ' [role="alert"]')
    assert.ok(error, 'validation feedback must be inside the open modal')
    assert.equal(document.querySelectorAll('[role="alert"]').length, 1, 'no duplicate error behind the overlay')
    assert.match(error.textContent, /tên|bộ môn/i)
    assert.equal(document.activeElement, scenario.view === 'ClassManagement' && scenario.url === '/classes' ? document.querySelector(scenario.name) : error, 'feedback is reachable without leaving the modal')
    await change(document.querySelector(scenario.name))('Tên đã sửa')
    await act(async () => document.querySelector(scenario.modal + ' form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.equal(writes.length, 1, 'client validation releases the lock so corrected input can be saved')
  }))

  test(`${scenario.view} ${scenario.edit ? 'edit' : scenario.url}: rapid submits send one request, preserve failure feedback and allow a retry`, () => screen(scenario, async () => {
    await change(document.querySelector(scenario.name))('Tên kiểm thử')
    const form = document.querySelector(scenario.modal + ' form')
    const submit = () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    await act(async () => { submit(); submit() })
    assert.equal(writes.filter(write => write.url === scenario.url).length, 1, 'same-tick duplicate is ignored')
    await act(async () => submit())
    assert.equal(writes.length, 1, 'rerenders cannot release an in-flight lock')
    await act(async () => pending.splice(0).forEach(request => request.fail()))
    assert.match(document.querySelector(scenario.modal + ' [role="alert"]').textContent, /Không thể lưu/)
    await act(async () => submit())
    assert.equal(writes.length, 2, 'failure releases the lock for an explicit retry')
    await act(async () => pending.splice(0).forEach(request => request.succeed()))
    assert.equal(document.querySelector(scenario.modal), null, 'successful retry closes the modal')
    if (scenario.edit) await act(async () => document.querySelector(scenario.edit).click())
    else await clickText(scenario.open)
    await change(document.querySelector(scenario.name))('Tên khác')
    await act(async () => document.querySelector(scenario.modal + ' form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.equal(writes.length, 3, 'success releases the lock for the next form')
  }))
}

for (const scenario of [
  { view: 'RoomManagement', edit: '[aria-label^="Ngừng hoạt động "]', modal: '.room-modal', button: '.room-modal-footer .room-btn-danger' },
  { view: 'PackageManagement', edit: '[title="Tạm dừng bán gói này"]', modal: '.pkg-modal', button: '.pkg-modal-footer .pkg-btn-danger' },
  { view: 'CancellationPolicyManagement', edit: '[title="Tạm dừng áp dụng"]', modal: '.policy-modal', button: '.policy-modal-footer .policy-btn-danger' },
]) {
  test(`${scenario.view}: confirmation errors remain in the open modal and repeated clicks cannot duplicate a write`, () => screen(scenario, async () => {
    await act(async () => { document.querySelector(scenario.button).click(); document.querySelector(scenario.button).click() })
    assert.equal(writes.length, 1)
    await act(async () => pending.splice(0).forEach(request => request.fail()))
    assert.match(document.querySelector(scenario.modal + ' [role="alert"]').textContent, /Không thể lưu/)
    await act(async () => document.querySelector(scenario.button).click())
    assert.equal(writes.length, 2)
    await act(async () => pending.splice(0).forEach(request => request.succeed()))
    assert.equal(document.querySelector(scenario.modal), null)
  }))
}

const createClassScenario = { view: 'ClassManagement', open: 'Tạo lớp học', modal: '.class-modal' }
test('create class shows every missing required field and focuses the first without sending a request', () => screen(createClassScenario, async () => {
  const form = document.querySelector('.class-modal form')
  for (const field of ['className', 'maxCapacity', 'startDate', 'endDate']) await change(form.elements.namedItem(field))('')
  for (const field of ['sportId', 'coachId']) await act(async () => {
    const select = form.elements.namedItem(field)
    select.value = ''; select.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
  await act(async () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(writes.length, 0)
  assert.equal(form.elements.namedItem('maxCapacity').value, '', 'clearing capacity does not turn into zero')
  for (const field of ['className', 'sportId', 'coachId', 'maxCapacity', 'startDate', 'endDate']) {
    const input = form.elements.namedItem(field)
    assert.equal(input.getAttribute('aria-invalid'), 'true', field)
    assert.ok(document.getElementById(input.getAttribute('aria-describedby'))?.textContent, field)
  }
  assert.equal(document.activeElement, form.elements.namedItem('className'))
}))

test('correcting a missing class name and invalid end date permits one successful create', () => screen(createClassScenario, async () => {
  const form = document.querySelector('.class-modal form')
  await change(form.elements.namedItem('className'))('   ')
  await change(form.elements.namedItem('startDate'))('2099-02-02')
  await change(form.elements.namedItem('endDate'))('2099-02-01')
  await act(async () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(writes.length, 0)
  assert.match(document.querySelector('[id$="end-error"]').textContent, /sau ngày bắt đầu/)
  await change(form.elements.namedItem('className'))('Lớp Yoga mới')
  await change(form.elements.namedItem('endDate'))('2099-03-01')
  await act(async () => {
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  })
  assert.equal(writes.filter(write => write.url === '/classes').length, 1)
  await act(async () => pending.splice(0).forEach(request => request.succeed()))
  assert.equal(document.querySelector('.class-modal'), null)
}))

test('create class rejects yesterday even when typed manually and accepts today in Vietnam', () => screen(createClassScenario, async () => {
  const form = document.querySelector('.class-modal form')
  const { timetableDateKey, shiftTimetableDate } = await server.ssrLoadModule('/src/utils/memberTimetable.js')
  const today = timetableDateKey()
  assert.equal(form.elements.namedItem('startDate').min, today)
  await change(form.elements.namedItem('className'))('Lớp Yoga hôm nay')
  await change(form.elements.namedItem('startDate'))(shiftTimetableDate(today, -1))
  await change(form.elements.namedItem('endDate'))('2099-12-31')
  await act(async () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(writes.length, 0)
  assert.match(document.querySelector('[id$="start-error"]').textContent, /không được trước hôm nay/)
  assert.equal(document.activeElement, form.elements.namedItem('startDate'))
  await change(form.elements.namedItem('startDate'))(today)
  await act(async () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(writes.filter(write => write.url === '/classes').length, 1)
  await act(async () => pending.splice(0).forEach(request => request.succeed()))
  assert.equal(document.querySelector('.class-modal'), null)
}))
