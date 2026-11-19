import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let window, server, createRoot, MemberSupport, ReceptionSupport, ManagerFrontDesk, ManagerActivity, Image, api
let tickets, writes, failCreate, failUpload, holdUpload, pendingUpload
const descriptors = new Map(), revoked = []
let objectCount = 0, createObjectURL, revokeObjectURL
const url = 'https://assets.example.test/support-tickets/incident.png'
const oldUrl = 'https://assets.example.test/support-tickets/old.png'
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
const image = (name = 'incident.png') => new File([png], name, { type: 'image/png' })
const ticket = (status = 'Open', imageUrl = null) => ({ id: 7, title: 'Máy tập bị hỏng', description: 'Cần kiểm tra thiết bị', status, imageUrl, priority: 'Normal', createdAt: '2026-11-17T10:00:00Z', memberName: 'Hội viên thử nghiệm' })

before(async () => {
  window = new Window({ url: 'http://localhost:3000/member' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator, HTMLElement: window.HTMLElement,
    localStorage: window.localStorage, sessionStorage: window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  createObjectURL = URL.createObjectURL; revokeObjectURL = URL.revokeObjectURL
  URL.createObjectURL = () => `blob:incident-${++objectCount}`
  URL.revokeObjectURL = value => revoked.push(value)
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  api.defaults.adapter = async config => {
    const response = data => ({ data: { success: true, data }, status: 200, headers: {}, config })
    if (config.method === 'get') return response(tickets.map(item => ({ ...item })))
    writes.push(config)
    if (config.url === '/SupportTickets') {
      if (failCreate) throw new Error('Không tạo được phiếu')
      const created = { ...ticket(), id: 8, ...JSON.parse(config.data) }
      tickets.unshift(created)
      return response(created)
    }
    assert.match(config.url, /^\/SupportTickets\/\d+\/image$/)
    if (failUpload) throw new Error('Kho ảnh tạm ngừng')
    const succeed = () => {
      const current = tickets.find(item => config.url === `/SupportTickets/${item.id}/image`)
      current.imageUrl = url
      return response({ ...current })
    }
    if (holdUpload) return new Promise(resolve => { pendingUpload = () => resolve(succeed()) })
    return succeed()
  }
  MemberSupport = (await server.ssrLoadModule('/src/pages/member/SupportTicketsView.jsx')).SupportTicketsView
  ReceptionSupport = (await server.ssrLoadModule('/src/pages/Receptionist/SupportTicketsView.jsx')).SupportTicketsView
  ManagerFrontDesk = (await server.ssrLoadModule('/src/pages/CenterManager/FrontDeskOperations.jsx')).default
  ManagerActivity = (await server.ssrLoadModule('/src/contexts/ManagerWorkspaceContext.jsx')).ManagerViewActivity
  Image = (await server.ssrLoadModule('/src/components/SupportTicketImage.jsx')).default
  createRoot = (await import('react-dom/client')).createRoot
})
after(async () => {
  await server?.close(); await window?.happyDOM.close()
  URL.createObjectURL = createObjectURL; URL.revokeObjectURL = revokeObjectURL
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

async function screen(component, initial, run) {
  tickets = initial; writes = []; revoked.length = 0
  failCreate = failUpload = holdUpload = false; pendingUpload = null
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  try {
    await act(async () => root.render(component))
    await run(element => act(async () => root.render(element)))
  } finally {
    if (pendingUpload) await act(async () => { pendingUpload(); pendingUpload = null })
    await act(async () => root.unmount()); container.remove()
  }
}
const click = text => act(async () => {
  const button = [...document.querySelectorAll('button')].find(node => node.textContent.includes(text))
  assert.ok(button, text); button.focus(); button.click()
})
const change = (input, value) => act(async () => {
  const prototype = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value)
  input.dispatchEvent(new window.Event('input', { bubbles: true }))
})
const submit = (count = 1) => act(async () => {
  for (let i = 0; i < count; i++) document.querySelector('dialog form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
})
async function choose(file, loaded = true) {
  await act(async () => {
    const input = document.querySelector('dialog input[type=file]')
    Object.defineProperty(input, 'files', { configurable: true, value: [file] })
    input.dispatchEvent(new window.Event('change', { bubbles: true }))
    await new Promise(resolve => setImmediate(resolve))
  })
  const preview = document.querySelector('.support-image-preview img')
  if (loaded && preview) await act(async () => preview.dispatchEvent(new window.Event('load')))
}
async function openCreate() {
  await click('Gửi yêu cầu mới')
  await change(document.querySelector('#member-support-title'), 'Máy tập bị hỏng')
  await change(document.querySelector('#member-support-description'), 'Cần kiểm tra thiết bị')
}

test('Member can still create a support ticket without an optional attachment', () => screen(h(MemberSupport), [], async () => {
  await openCreate(); await submit(2)
  assert.deepEqual(writes.map(item => item.url), ['/SupportTickets'])
  assert.equal(document.querySelector('.member-support-dialog'), null)
  assert.match(document.querySelector('.member-support-card').textContent, /Máy tập bị hỏng/)
}))

test('Member creates once, uploads the previewed image to the new ID, and displays the backend image URL', () => screen(h(MemberSupport), [], async () => {
  await openCreate(); await choose(image()); await submit(2)
  assert.deepEqual(writes.map(item => item.url), ['/SupportTickets', '/SupportTickets/8/image'])
  assert.equal(writes[1].data.get('file').name, 'incident.png')
  assert.equal(document.querySelector('.support-image-thumbnail img').src, url)
  assert.equal(document.querySelector('.member-support-dialog'), null)
  assert.ok(revoked.length)
}))

test('invalid, oversized or undecoded Member images block creation until removed', () => screen(h(MemberSupport), [], async () => {
  await openCreate()
  for (const file of [new File(['fake'], 'fake.png'), new File([png], 'picture.gif'), new File([new Uint8Array(2097153)], 'large.jpg')]) {
    await choose(file); await submit()
    assert.ok(document.querySelector('.support-image-error[role=alert]'))
    assert.equal(writes.length, 0)
  }
  await choose(image(), false); await submit()
  assert.equal(writes.length, 0)
  await act(async () => document.querySelector('.support-image-preview img').dispatchEvent(new window.Event('error')))
  await submit(); assert.equal(writes.length, 0)
  await click('Bỏ ảnh đã chọn'); await submit()
  assert.equal(writes.length, 1)
}))

test('a failed ticket creation never uploads an attachment', () => screen(h(MemberSupport), [], async () => {
  await openCreate(); await choose(image()); failCreate = true; await submit()
  assert.deepEqual(writes.map(item => item.url), ['/SupportTickets'])
  assert.match(document.querySelector('dialog [role=alert]').textContent, /Không tạo được phiếu/)
  assert.equal(document.querySelector('#member-support-title').disabled, false)
}))

test('partial upload failure retries the saved ticket without creating duplicate requests', () => screen(h(MemberSupport), [], async () => {
  await openCreate(); await choose(image()); failUpload = true; await submit()
  assert.match(document.querySelector('dialog [role=alert]').textContent, /Phiếu đã gửi thành công/)
  assert.equal(tickets.length, 1)
  assert.equal(document.querySelector('#member-support-title').disabled, true)
  failUpload = false; await submit(2)
  assert.deepEqual(writes.map(item => item.url), ['/SupportTickets', '/SupportTickets/8/image', '/SupportTickets/8/image'])
  assert.equal(document.querySelector('.support-image-thumbnail img').src, url)
}))

test('closing after attachment failure still allows upload from the existing ticket card', () => screen(h(MemberSupport), [], async () => {
  await openCreate(); await choose(image()); failUpload = true; await submit(); await click('Đóng')
  assert.equal(document.querySelector('.member-support-dialog'), null)
  await click('Bổ sung ảnh sự cố'); await choose(image()); failUpload = false; await submit()
  assert.deepEqual(writes.map(item => item.url), ['/SupportTickets', '/SupportTickets/8/image', '/SupportTickets/8/image'])
  assert.equal(document.querySelector('.support-image-thumbnail img').src, url)
}))

test('replacing a Member attachment preserves the old image on error and blocks duplicate upload while pending', () => screen(h(MemberSupport), [ticket('InProgress', oldUrl)], async () => {
  await click('Thay ảnh sự cố'); await choose(image()); failUpload = true; await submit()
  assert.equal(document.querySelector('.member-support-card .support-image-thumbnail img').src, oldUrl)
  failUpload = false; holdUpload = true; await submit(2)
  assert.equal(writes.length, 2)
  const dialog = document.querySelector('.member-support-dialog')
  await act(async () => dialog.dispatchEvent(new window.Event('cancel', { cancelable: true })))
  assert.ok(dialog.open)
  await act(async () => { pendingUpload(); pendingUpload = null })
  assert.equal(document.querySelector('.member-support-dialog'), null)
  assert.equal(document.querySelector('.support-image-thumbnail img').src, url)
}))

for (const status of ['Resolved', 'Closed']) {
  test(`Member can view ${status} ticket evidence but cannot change it`, () => screen(h(MemberSupport), [ticket(status, url)], async () => {
    assert.equal(document.querySelector('.member-support-image-action'), null)
    assert.ok(document.querySelector('.support-image-thumbnail'))
    const opener = document.querySelector('.support-image-thumbnail')
    assert.equal(opener.textContent.trim(), '')
    assert.ok(opener.closest('.support-ticket-image--full'))
    await act(async () => { opener.focus(); opener.click() })
    assert.equal(document.querySelector('.support-image-dialog').open, true)
    assert.equal(document.querySelector('.support-image-dialog img').src, url)
    await act(async () => document.querySelector('.support-image-dialog [aria-label="Đóng ảnh sự cố"]').click())
    assert.equal(document.querySelector('.support-image-dialog'), null)
    assert.equal(document.activeElement, opener)
  }))
}

test('Receptionist can enlarge evidence even on closed tickets and close with Escape without a write', () => screen(h(ReceptionSupport, { query: '', showNotice() {} }), [ticket('Closed', url)], async () => {
  assert.equal(document.querySelector('.reception-support-action'), null)
  const opener = document.querySelector('.support-image-thumbnail')
  await act(async () => { opener.focus(); opener.click() })
  const dialog = document.querySelector('.support-image-dialog')
  assert.equal(dialog.open, true)
  assert.equal(dialog.querySelector('img').src, url)
  assert.match(dialog.querySelector('img').alt, /phiếu #7/)
  await act(async () => dialog.dispatchEvent(new window.Event('cancel', { cancelable: true })))
  assert.equal(document.querySelector('.support-image-dialog'), null)
  assert.equal(document.activeElement, opener)
  assert.notEqual(document.body.style.overflow, 'hidden')
  assert.equal(writes.length, 0)
}))

test('Receptionist also sees evidence in the update dialog', () => screen(h(ReceptionSupport, { query: '', showNotice() {} }), [ticket('Open', url)], async () => {
  await click('Nhận xử lý')
  assert.equal(document.querySelector('.reception-support-dialog .support-image-thumbnail img').src, url)
  assert.equal(document.querySelector('.reception-support-dialog input[type=file]'), null)
}))

test('failed image loads show a retry and unsafe URLs never reach image elements', () => screen(h(Image, { imageUrl: url, ticketId: 7 }), [], async () => {
  await act(async () => document.querySelector('img').dispatchEvent(new window.Event('error')))
  assert.match(document.body.textContent, /Không tải được ảnh/)
  await click('Tải lại ảnh')
  assert.equal(document.querySelector('img').src, url)
}))

test('missing and unsafe image URLs leave ticket content usable without requesting an image', () => screen(h('div', null,
  h(Image, { imageUrl: 'javascript:alert(1)', ticketId: 7 }), h(Image, { imageUrl: null, ticketId: 8 })), [], async () => {
  assert.equal(document.querySelector('img'), null)
  assert.equal(document.querySelector('button'), null)
  assert.match(document.body.textContent, /Không thể mở ảnh/)
}))

test('Manager can view closed-ticket evidence and Escape restores focus without updating the ticket', () => screen(h(ManagerFrontDesk), [ticket('Closed', url)], async () => {
  await click('Hỗ trợ')
  const opener = document.querySelector('.fdesk-table .support-image-thumbnail')
  assert.ok(opener)
  await act(async () => { opener.focus(); opener.click() })
  const dialog = document.querySelector('.support-image-dialog[open]')
  assert.equal(dialog.querySelector('img').src, url)
  await act(async () => dialog.dispatchEvent(new window.Event('cancel', { cancelable: true })))
  assert.equal(document.querySelector('.support-image-dialog'), null)
  assert.equal(document.activeElement, opener)
  assert.equal(writes.length, 0)
}))

test('Manager can enlarge evidence while editing a resolution without submitting or losing the draft', () => screen(h(ManagerFrontDesk), [ticket('Open', url)], async () => {
  await click('Hỗ trợ')
  await click('Xử lý ticket')
  await change(document.querySelector('#resolve-note-input'), 'Đã kiểm tra ảnh, đang xử lý')
  const resolution = document.querySelector('.fdesk-dialog')
  assert.equal(resolution.querySelector('.support-image-thumbnail img').src, url)
  await act(async () => resolution.querySelector('.support-image-thumbnail').click())
  assert.ok(document.querySelector('.support-image-dialog[open]'))
  await act(async () => document.querySelector('[aria-label="Đóng ảnh sự cố"]').click())
  assert.ok(document.querySelector('.fdesk-dialog'))
  assert.equal(document.querySelector('#resolve-note-input').value, 'Đã kiểm tra ảnh, đang xử lý')
  assert.equal(writes.length, 0)
}))

test('Manager image failures can be retried, and tickets without attachments have no image control', () => screen(h(ManagerFrontDesk), [ticket('Open', url), { ...ticket('Closed'), id: 8 }], async () => {
  await click('Hỗ trợ')
  assert.equal(document.querySelectorAll('.fdesk-table .support-image-thumbnail').length, 1)
  const table = document.querySelector('.fdesk-table .support-image-thumbnail').closest('table')
  await act(async () => document.querySelector('.fdesk-table .support-image-thumbnail img').dispatchEvent(new window.Event('error')))
  assert.match(table.textContent, /Không tải được ảnh/)
  await click('Tải lại ảnh')
  assert.equal(document.querySelector('.fdesk-table .support-image-thumbnail img').src, url)
  assert.equal(writes.length, 0)
}))

test('Manager image dialogs close when changing tabs or leaving the FrontDesk view', () => screen(h(ManagerActivity, { active: true }, h(ManagerFrontDesk)), [ticket('Open', url)], async render => {
  await click('Hỗ trợ'); await click('Xem ảnh sự cố')
  await click('Hội viên')
  assert.equal(document.querySelector('.support-image-dialog'), null)
  assert.notEqual(document.body.style.overflow, 'hidden')
  await click('Hỗ trợ'); await click('Xem ảnh sự cố')
  await render(h(ManagerActivity, { active: false }, h(ManagerFrontDesk)))
  assert.equal(document.querySelector('.support-image-dialog'), null)
  assert.notEqual(document.body.style.overflow, 'hidden')
  assert.equal(writes.length, 0)
}))
