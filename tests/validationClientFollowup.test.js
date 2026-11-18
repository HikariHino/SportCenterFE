import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let window, server, createRoot, AuthProvider, Router
const descriptors = new Map(), views = {}, writes = []
let holdWrite = false, pending, savedProfile
const fullName = 'A'.repeat(61), phoneNumber = '+84912345678'
before(async () => {
  window = new Window({ url: 'http://localhost:3000/member' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator, HTMLElement: window.HTMLElement,
    localStorage: window.localStorage, sessionStorage: window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module-sync', 'module', 'import'] } },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  const api = (await server.ssrLoadModule('/src/services/api.js')).default
  api.defaults.adapter = async config => {
    const profile = savedProfile || { userId: 1, fullName, phoneNumber, email: 'test@example.com' }
    const response = data => ({ data: { success: true, data }, status: 200, headers: {}, config })
    if (config.method !== 'get') {
      writes.push({ url: config.url, body: JSON.parse(config.data || '{}') })
      if (holdWrite) return new Promise((resolve, reject) => { pending = { succeed: () => resolve(response({ id: 2, ...JSON.parse(config.data) })), fail: () => reject(new Error('Lỗi thử nghiệm')) } })
      const result = { ...profile, ...JSON.parse(config.data || '{}') }
      if (config.url === '/profile') savedProfile = result
      return response(result)
    }
    return response(config.url === '/profile' ? profile : config.url === '/members/me' ? { memberId: 1, fullName } : config.url.toLowerCase() === '/rooms' ? [{ id: 1, name: 'Phòng cũ', capacity: 30, roomType: 'General', isActive: true }] : [])
  }
  AuthProvider = (await server.ssrLoadModule('/src/contexts/AuthContext.jsx')).AuthProvider
  Router = (await server.ssrLoadModule('react-router-dom')).MemoryRouter
  views.member = (await server.ssrLoadModule('/src/pages/member/MemberViews.jsx')).ProfileView
  views.coach = (await server.ssrLoadModule('/src/pages/Coach/ProfileView.jsx')).CoachProfileView
  views.receptionist = (await server.ssrLoadModule('/src/pages/Receptionist/ProfileView.jsx')).ReceptionistProfileView
  views.room = (await server.ssrLoadModule('/src/pages/CenterManager/RoomManagement.jsx')).default
  views.package = (await server.ssrLoadModule('/src/pages/CenterManager/PackageManagement.jsx')).default
  createRoot = (await import('react-dom/client')).createRoot
})
after(async () => {
  await server?.close(); await window?.happyDOM.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})
async function screen(view, run) {
  writes.length = 0; holdWrite = false; pending = null; savedProfile = null
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  try {
    await act(async () => root.render(h(Router, null, h(AuthProvider, null, h(views[view], { user: { id: 1, fullName }, showNotice() {} })))))
    await run()
  } finally {
    if (pending) await act(async () => pending.succeed())
    await act(async () => root.unmount()); container.remove()
  }
}
const click = text => act(async () => { const button = [...document.querySelectorAll('button')].find(node => node.textContent.includes(text)); assert.ok(button, text); button.focus(); button.click() })
const escape = () => act(async () => document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
const change = (input, value) => act(async () => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new window.Event('input', { bubbles: true })) })

for (const [role, selector] of [['member', '.member-profile-form'], ['coach', '.coach-account-profile-form'], ['receptionist', '.reception-profile-form']]) {
  test(`${role} profile can save a registered 61-character name and +84 phone without changing them`, () => screen(role, async () => {
    await click('Chỉnh sửa')
    const form = document.querySelector(selector), name = form.querySelector('input:not([type]), input[name="fullName"]'), phone = form.querySelector('input[type="tel"]')
    assert.equal(name.maxLength, 100)
    assert.equal(phone.value, phoneNumber)
    assert.equal(phone.inputMode, 'tel')
    assert.equal(phone.checkValidity(), true)
    await act(async () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.equal(writes.length, 1)
    assert.equal(writes[0].body.fullName, fullName)
    assert.equal(writes[0].body.phoneNumber, phoneNumber)
  }))
}

for (const [role, selector, actionsSelector] of [
  ['member', '.member-profile-form', '.member-profile-editor-actions'],
  ['receptionist', '.reception-profile-form', '.reception-profile-actions'],
]) {
  test(`${role} shows a read-only profile first and saves through the actions below the independent email editor`, () => screen(role, async () => {
    assert.equal(document.querySelector(selector), null)
    assert.equal(document.querySelector('.account-email-change'), null)
    assert.match(document.body.textContent, /test@example.com/)
    await click('Chỉnh sửa')
    const form = document.querySelector(selector), email = document.querySelector('.account-email-change'), actions = document.querySelector(actionsSelector)
    assert.equal(form.querySelector('input[type=email]'), null)
    assert.equal(actions.previousElementSibling, email)
    assert.equal(actions.closest('form'), null)
    assert.equal(actions.querySelector('button[type=submit]').form, form)
    if (role === 'member') {
      for (const name of ['gender', 'dateOfBirth', 'fitnessGoal', 'address', 'emergencyContact']) assert.ok(form.elements.namedItem(name), name)
      assert.equal(document.querySelector('.member-password-form').contains(form), false)
    }
    await change(form.querySelector('input[name=fullName]'), 'Nguyễn Văn Bình')
    const summary = document.querySelector(role === 'member' ? '.member-profile-identity-card' : '.reception-profile-summary')
    assert.match(summary.textContent, new RegExp(fullName), 'identity card retains the saved name while editing')
    await change(email.querySelector('input[type=email]'), 'invalid-email')
    form.querySelector('input[name=fullName]').removeAttribute('pattern')
    await click('Lưu hồ sơ')
    assert.equal(writes.length, 1)
    assert.equal(writes[0].url, '/profile')
    assert.equal(writes[0].body.fullName, 'Nguyễn Văn Bình')
    assert.equal(Object.hasOwn(writes[0].body, 'newEmail'), false)
    assert.equal(document.querySelector(actionsSelector), null)
    assert.equal(document.querySelector(selector), null)
    assert.match(summary.textContent, /Nguyễn Văn Bình/)
  }))

  test(`${role} cancellation resets the profile and email editor without sending requests`, () => screen(role, async () => {
    await click('Chỉnh sửa')
    await change(document.querySelector(`${selector} input[name=fullName]`), 'Tên Đã Sửa')
    await change(document.querySelector('.account-email-change input[type=email]'), 'new@fpt.edu.vn')
    await click('Hủy thay đổi')
    assert.equal(document.querySelector(selector), null)
    assert.equal(document.querySelector('.account-email-change'), null)
    assert.equal(writes.length, 0)
    await click('Chỉnh sửa')
    assert.equal(document.querySelector(`${selector} input[name=fullName]`).value, fullName)
    assert.equal(document.querySelector('.account-email-change input[type=email]').value, '')
  }))
}

test('Member profile, password and email forms keep their validation and requests independent', () => screen('member', async () => {
  await click('Chỉnh sửa')
  const profile = document.querySelector('.member-profile-form'), passwords = document.querySelector('.member-password-form')
  await change(profile.querySelector('input[name=fullName]'), 'Tên Đang Soạn')
  await change(passwords.querySelector('input[name=currentPassword]'), 'CurrentPassword!')
  await change(passwords.querySelector('input[name=newPassword]'), 'NewPassword!')
  await change(passwords.querySelector('input[name=confirmPassword]'), 'NewPassword!')
  await click('Cập nhật mật khẩu')
  assert.deepEqual(writes, [{ url: '/profile', body: { currentPassword: 'CurrentPassword!', password: 'NewPassword!' } }])
  assert.equal(profile.querySelector('input[name=fullName]').value, 'Tên Đang Soạn')
  await change(document.querySelector('.account-email-change input[type=email]'), 'new@fpt.edu.vn')
  await click('Gửi mã xác nhận')
  assert.equal(writes.length, 2)
  assert.equal(writes[1].url, '/profile/change-email/request-otp')
  assert.equal(profile.querySelector('input[name=fullName]').value, 'Tên Đang Soạn')
  await click('Hủy thay đổi')
  await click('Chỉnh sửa')
  assert.equal(document.querySelector('.member-profile-form input[name=fullName]').value, fullName)
  for (const input of document.querySelectorAll('.member-password-form input')) assert.equal(input.value, '')
}))

for (const role of ['member', 'coach', 'receptionist']) {
  test(`${role} hides the email form until editing and clears its draft when editing is cancelled`, () => screen(role, async () => {
    assert.equal(document.querySelector('.account-email-change'), null)
    await click('Chỉnh sửa')
    let emailForm = document.querySelector('.account-email-change')
    assert.ok(emailForm)
    assert.match(emailForm.textContent, /test@example.com/)
    await change(emailForm.querySelector('input[type=email]'), 'new@fpt.edu.vn')
    await click('Hủy')
    assert.equal(document.querySelector('.account-email-change'), null)
    await click('Chỉnh sửa')
    emailForm = document.querySelector('.account-email-change')
    assert.equal(emailForm.querySelector('input[type=email]').value, '')
    assert.equal(writes.length, 0, 'opening or closing email editing does not send an OTP')
  }))
}

for (const [role, selector] of [['member', '.member-profile-form'], ['coach', '.coach-account-profile-form'], ['receptionist', '.reception-profile-form']]) {
  test(`${role} retains the email editor on a failed profile save and closes it after a successful save`, () => screen(role, async () => {
    await click('Chỉnh sửa')
    holdWrite = true
    await act(async () => document.querySelector(selector).dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    await act(async () => { pending.fail(); pending = null })
    assert.ok(document.querySelector('.account-email-change'))
    holdWrite = false
    await act(async () => document.querySelector(selector).dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.equal(document.querySelector('.account-email-change'), null)
    assert.equal(writes.filter(write => write.url.includes('change-email')).length, 0)
  }))
}

test('Coach profile actions follow the email editor and still submit only the profile form', () => screen('coach', async () => {
  await click('Chỉnh sửa')
  const form = document.querySelector('.coach-account-profile-form')
  const emailEditor = document.querySelector('.account-email-change')
  const actions = document.querySelector('.coach-account-profile-actions')
  assert.equal(form.querySelector('input[type=email]'), null)
  assert.deepEqual([...form.querySelectorAll('input')].map(input => input.name), ['fullName', 'phoneNumber', 'currentPassword', 'password'])
  assert.equal(actions.previousElementSibling, emailEditor)
  assert.equal(actions.closest('form'), null)
  assert.equal(actions.querySelector('button[type=submit]').form, form)
  assert.equal(emailEditor.querySelector('form').contains(form), false)
  // The independent email editor's required/invalid draft must not block saving the profile.
  await change(emailEditor.querySelector('input[type=email]'), 'invalid-email')
  // Happy DOM does not apply the browser's Unicode flag to HTML patterns;
  // the submit handler and service still validate this name independently.
  form.querySelector('input[name=fullName]').removeAttribute('pattern')
  assert.equal(form.checkValidity(), true, [...form.elements].filter(field => !field.checkValidity()).map(field => field.name).join(', '))
  await click('Lưu hồ sơ')
  assert.equal(writes.length, 1)
  assert.equal(writes[0].url, '/profile')
  assert.equal(writes[0].body.fullName, fullName)
  assert.equal(Object.hasOwn(writes[0].body, 'newEmail'), false)
  assert.equal(document.querySelector('.coach-account-profile-actions'), null)
}))

test('Coach email submission does not submit the profile when actions are placed below it', () => screen('coach', async () => {
  await click('Chỉnh sửa')
  await change(document.querySelector('.account-email-change input[type=email]'), 'new@fpt.edu.vn')
  await click('Gửi mã xác nhận')
  assert.deepEqual(writes, [{ url: '/profile/change-email/request-otp', body: { newEmail: 'new@fpt.edu.vn' } }])
  assert.ok(document.querySelector('.account-email-change input[autocomplete=one-time-code]'))
  assert.ok(document.querySelector('.coach-account-profile-actions'))
}))

test('Coach cancel action below the email form discards both profile and email drafts without submitting', () => screen('coach', async () => {
  await click('Chỉnh sửa')
  await change(document.querySelector('.coach-account-profile-form input[name=fullName]'), 'Tên Đã Sửa')
  await change(document.querySelector('.account-email-change input[type=email]'), 'new@fpt.edu.vn')
  await click('Hủy thay đổi')
  assert.equal(document.querySelector('.coach-account-profile-actions'), null)
  assert.equal(document.querySelector('.account-email-change'), null)
  assert.equal(writes.length, 0)
  await click('Chỉnh sửa')
  assert.equal(document.querySelector('.coach-account-profile-form input[name=fullName]').value, fullName)
  assert.equal(document.querySelector('.account-email-change input[type=email]').value, '')
}))

test('Coach edit/cancel morphs from the current card height while ordinary field edits do not restart the effect', () => screen('coach', async () => {
  const panel = document.querySelector('.coach-account-profile-details')
  const summary = document.querySelector('.coach-account-profile-summary')
  const frames = [], complete = []
  const overflow = panel.style.overflow
  const originalAnimate = window.HTMLElement.prototype.animate
  panel.getBoundingClientRect = () => ({ height: panel.style.overflow === 'hidden' ? 560 : panel.querySelector('.coach-account-profile-form') ? 720 : 300 })
  window.HTMLElement.prototype.animate = function (keyframes) {
    assert.notEqual(this, summary, 'the identity card does not participate in the edit morph')
    if (this === panel) frames.push(keyframes)
    let resolve, reject
    const finished = new Promise((yes, no) => { resolve = yes; reject = no })
    complete.push(resolve)
    return { finished, cancel: () => reject(new Error('Cancelled')) }
  }
  try {
    await click('Chỉnh sửa')
    assert.deepEqual(frames[0], [{ height: '300px' }, { height: '720px' }])
    await change(document.querySelector('.coach-account-profile-form input[name=fullName]'), 'Tên Đã Sửa')
    assert.equal(frames.length, 1)
    await click('Hủy thay đổi')
    assert.deepEqual(frames[1], [{ height: '560px' }, { height: '300px' }])
    assert.equal(document.querySelector('.coach-account-profile-details'), panel)
    assert.equal(document.querySelector('.coach-account-profile-summary'), summary)
    await act(async () => { complete.forEach(finish => finish()); await new Promise(resolve => setImmediate(resolve)) })
    assert.equal(panel.style.overflow, overflow)
    assert.equal(writes.length, 0)
  } finally {
    window.HTMLElement.prototype.animate = originalAnimate
  }
}))

test('room dialog labels identify every field, Tab stays inside, and Escape closes and restores focus', () => screen('room', async () => {
  await click('Thêm phòng tập')
  const dialog = document.querySelector('.room-modal'), opener = [...document.querySelectorAll('button')].find(node => node.textContent.includes('Thêm phòng tập'))
  assert.equal(dialog.getAttribute('role'), 'dialog')
  for (const field of dialog.querySelectorAll('input,select')) assert.ok(field.labels.length, field.outerHTML)
  const controls = [...dialog.querySelectorAll('button,input,select')]
  controls.at(-1).focus()
  await act(async () => controls.at(-1).dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })))
  assert.equal(document.activeElement, controls[0])
  await escape()
  assert.equal(document.querySelector('.room-modal'), null)
  assert.equal(document.activeElement, opener)
  assert.notEqual(document.body.style.overflow, 'hidden')
}))

test('edit and availability room dialogs associate labels and close with Escape', () => screen('room', async () => {
  for (const selector of ['[aria-label^="Chỉnh sửa "]', '[aria-label^="Kiểm tra lịch trống "]']) {
    await act(async () => document.querySelector(selector).click())
    for (const field of document.querySelectorAll('.room-modal input,.room-modal select')) assert.ok(field.labels.length, field.outerHTML)
    await escape(); assert.equal(document.querySelector('.room-modal'), null)
  }
}))

test('Escape cannot dismiss a room write in flight but works after an API failure', () => screen('room', async () => {
  await click('Thêm phòng tập')
  await change(document.querySelector('.room-modal input'), 'Phòng mới')
  holdWrite = true
  await act(async () => document.querySelector('.room-modal form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  await escape(); assert.ok(document.querySelector('.room-modal'))
  assert.equal(document.querySelector('.room-modal-close').disabled, true)
  await act(async () => { pending.fail(); pending = null })
  await escape(); assert.equal(document.querySelector('.room-modal'), null)
}))

test('package form preserves an unsafe typed price until validation blocks it before the API', () => screen('package', async () => {
  await click('Tạo gói thẻ mới')
  await change(document.querySelector('.pkg-modal input'), 'Gói mới')
  const price = document.querySelector('.pkg-modal input[type="number"][step="0.01"]')
  await change(price, '9007199254740993')
  assert.equal(price.value, '9007199254740993')
  await act(async () => document.querySelector('.pkg-modal form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(writes.length, 0)
  assert.match(document.querySelector('.pkg-modal [role="alert"]').textContent, /chính xác/)
}))
