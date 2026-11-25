import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'

let window, server, createRoot, Auth, Font, Router, api, state
const roles = {}, descriptors = new Map()
before(async () => {
  window = new Window({ url: 'http://localhost:3000/' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, CustomEvent: window.CustomEvent, localStorage: window.localStorage, sessionStorage: window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ configFile: false, esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module-sync', 'module', 'import'] } },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  Auth = (await server.ssrLoadModule('/src/contexts/AuthContext.jsx')).AuthProvider
  Font = (await server.ssrLoadModule('/src/contexts/FontSizeContext.jsx')).FontSizeProvider
  Router = (await server.ssrLoadModule('react-router-dom')).MemoryRouter
  for (const [role, page, view] of [['Coach', 'Coach', 'CoachProfileView'], ['Receptionist', 'Receptionist', 'ReceptionistProfileView']]) {
    roles[role] = { View: (await server.ssrLoadModule(`/src/pages/${page}/ProfileView.jsx`))[view],
      Provider: (await server.ssrLoadModule(`/src/contexts/${role}WorkspaceContext.jsx`))[`${role}WorkspaceProvider`] }
  }
  roles.Manager = { View: (await server.ssrLoadModule('/src/pages/CenterManager/ProfileView.jsx')).default,
    Provider: (await server.ssrLoadModule('/src/contexts/ManagerWorkspaceContext.jsx')).ManagerWorkspaceProvider }
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  api.defaults.adapter = async config => {
    state.calls.push({ method: config.method, url: config.url, data: config.data && JSON.parse(config.data) })
    assert.equal(config.url, '/profile')
    if (config.method === 'put') {
      const values = JSON.parse(config.data)
      if (state.ignoreBirthday) delete values.dateOfBirth
      state.profile = { ...state.profile, ...values }
    }
    return { config, status: 200, headers: {}, data: { success: true, data: structuredClone(state.profile) } }
  }
  createRoot = (await import('react-dom/client')).createRoot
})
after(async () => {
  await server?.close(); await window?.happyDOM.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

async function screen(role, run, birthday = null) {
  localStorage.clear(); sessionStorage.clear()
  sessionStorage.setItem('token', 'staff-profile-test')
  sessionStorage.setItem('user', JSON.stringify({ id: 3, userId: 3, fullName: 'Nguyễn An', role: role.toLowerCase() }))
  state = { calls: [], notices: [], ignoreBirthday: false, profile: { userId: 3, roleName: role, fullName: 'Nguyễn An',
    email: 'staff@example.com', phoneNumber: '0912345678', status: 'Active', dateOfBirth: birthday } }
  const { View, Provider } = roles[role]
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  try {
    await act(async () => root.render(h(Router, null, h(Font, null, h(Auth, null,
      h(Provider, { sessionKey: role }, h(View, { showNotice: message => state.notices.push(message) })))))))
    await run(container)
  } finally { await act(async () => root.unmount()); container.remove() }
}
const clickText = text => act(async () => {
  const button = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === text)
  assert.ok(button, text); button.click()
})
const changeBirthday = value => act(async () => {
  const input = document.querySelector('input[name=dateOfBirth]')
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
  input.dispatchEvent(new window.Event('input', { bubbles: true }))
})
const submit = () => act(async () => document.querySelector('form[id]').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
const writes = () => state.calls.filter(call => call.method === 'put')

for (const role of ['Coach', 'Receptionist', 'Manager']) {
  test(`${role} shows, edits and verifies a persisted birthday before reporting success`, () => screen(role, async container => {
    assert.match(container.textContent, /Ngày sinh/)
    await clickText('Chỉnh sửa')
    assert.equal(container.querySelector('[name=dateOfBirth]').value, '2000-02-29')
    await changeBirthday('2001-03-01'); await submit()
    assert.equal(writes().length, 1)
    assert.equal(writes()[0].data.dateOfBirth, '2001-03-01T00:00:00.000Z')
    assert.match(container.textContent, /01\/03\/2001/)
    assert.equal(container.querySelector('[name=dateOfBirth]'), null)
    if (role === 'Manager') assert.match(container.querySelector('.manager-profile-notice').textContent, /Đã cập nhật/)
    else assert.equal(state.notices.length, 1)
    assert.equal(state.calls.at(-1).method, 'get')
  }, '2000-02-29T00:00:00Z'))

  test(`${role} cancel discards the birthday draft`, () => screen(role, async container => {
    await clickText('Chỉnh sửa'); await changeBirthday('2001-01-01'); await clickText('Hủy thay đổi')
    await clickText('Chỉnh sửa')
    assert.equal(container.querySelector('[name=dateOfBirth]').value, '2000-02-29')
    assert.equal(writes().length, 0)
  }, '2000-02-29T00:00:00Z'))

  test(`${role} rejects invalid ages before sending the profile update`, () => screen(role, async container => {
    await clickText('Chỉnh sửa')
    for (const birthday of ['2019-01-01', '2099-01-01', '1949-12-31']) {
      await changeBirthday(birthday); await submit()
      assert.equal(writes().length, 0)
      assert.equal(container.querySelector('[name=dateOfBirth]').getAttribute('aria-invalid'), 'true')
      assert.ok(container.querySelector('[role=alert]'))
    }
  }))

  test(`${role} keeps the form open and never claims success if old BE ignores the birthday`, () => screen(role, async container => {
    state.ignoreBirthday = true
    await clickText('Chỉnh sửa'); await changeBirthday('2000-01-01'); await submit()
    assert.match(container.querySelector('[role=alert]').textContent, /Máy chủ chưa lưu được ngày sinh/)
    assert.equal(container.querySelector('[name=dateOfBirth]').value, '2000-01-01')
    assert.equal(state.notices.length, 0)
    assert.equal(state.profile.dateOfBirth, null)
  }))
}

test('Manager shows email verification and password editing only in edit mode and refreshes the saved display name', () => screen('Manager', async container => {
  assert.equal(container.querySelector('[type=email]'), null)
  await clickText('Chỉnh sửa')
  assert.ok(container.querySelector('.account-email-change [type=email]'))
  assert.ok(container.querySelector('[name=currentPassword]'))
  const input = container.querySelector('[name=fullName]')
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'Nguyễn Quản Lý')
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  await submit()
  assert.equal(JSON.parse(sessionStorage.getItem('user')).fullName, 'Nguyễn Quản Lý')
  assert.equal(container.querySelector('[type=email]'), null)
  assert.match(container.textContent, /Nguyễn Quản Lý/)
}))

test('Manager password changes require the current password and do not store password fields in the login profile', () => screen('Manager', async container => {
  await clickText('Chỉnh sửa')
  const change = (name, value) => act(async () => {
    const input = container.querySelector(`[name=${name}]`)
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  await change('password', 'NewPassword!')
  await submit()
  assert.equal(writes().length, 0)
  assert.equal(container.querySelector('[name=currentPassword]').getAttribute('aria-invalid'), 'true')
  await change('currentPassword', 'OldPassword!'); await submit()
  assert.equal(writes().length, 1)
  assert.equal(writes()[0].data.currentPassword, 'OldPassword!')
  assert.equal(writes()[0].data.password, 'NewPassword!')
  const saved = JSON.parse(sessionStorage.getItem('user'))
  assert.equal(saved.password, undefined)
  assert.equal(saved.currentPassword, undefined)
}))
