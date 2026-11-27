import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let window, server, createRoot, Support, Provider, useCache, cache, tickets, writes, saved, failReload, ackOnly, heldOpenRead, holdOpen
const descriptors = new Map()
const clone = value => JSON.parse(JSON.stringify(value))
before(async () => {
  window = new Window({ url: 'http://localhost:3000/receptionist' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, localStorage: window.localStorage, sessionStorage: window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, esbuild: { jsx: 'automatic' },
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  Support = (await server.ssrLoadModule('/src/pages/Receptionist/SupportTicketsView.jsx')).SupportTicketsView
  const context = await server.ssrLoadModule('/src/contexts/ReceptionistWorkspaceContext.jsx')
  Provider = context.ReceptionistWorkspaceProvider; useCache = context.useReceptionistCache
  const api = (await server.ssrLoadModule('/src/services/api.js')).default
  api.defaults.adapter = async config => {
    const response = data => ({ data: { success: true, data: clone(data) }, status: 200, headers: {}, config })
    if (config.method === 'get') {
      if (saved && failReload) throw new Error('Không tải lại được danh sách')
      const result = config.params?.status ? tickets.filter(ticket => ticket.status === config.params.status) : tickets
      if (holdOpen && config.params?.status === 'Open') {
        holdOpen = false
        const snapshot = clone(result)
        return new Promise(resolve => { heldOpenRead = () => resolve(response(snapshot)) })
      }
      return response(result)
    }
    assert.equal(config.url, '/SupportTickets/7/resolve')
    writes.push(config)
    Object.assign(tickets[0], JSON.parse(config.data)); saved = true
    return response(ackOnly ? {} : tickets[0])
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

function View() {
  cache = useCache()
  // Match the portal's shared post-action invalidation, not just a standalone view.
  return h(Support, { query: '', showNotice: () => cache.invalidate(['support:*']) })
}
async function screen(run) {
  tickets = [{ id: 7, title: 'Phiếu cần hỗ trợ', description: 'Đổi lịch tập', memberName: 'Hội viên A', status: 'Open', priority: 'Normal' }]
  writes = []; saved = failReload = ackOnly = holdOpen = false; heldOpenRead = null
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  try {
    await act(async () => root.render(h(Provider, { sessionKey: 'support-filter-test' }, h(View))))
    await run(container)
  } finally {
    await act(async () => root.unmount())
    if (heldOpenRead) await act(async () => heldOpenRead())
    container.remove()
  }
}
async function click(container, selector, text) {
  const button = [...container.querySelectorAll(selector)].find(item => !text || item.textContent.trim() === text)
  assert.ok(button, selector + ' ' + (text || ''))
  await act(async () => button.click())
}
const filter = (container, text) => click(container, '.reception-support-toolbar button', text)
async function resolve(container, status = 'Closed') {
  await click(container, '.reception-support-action')
  const form = container.querySelector('.reception-support-dialog form')
  await act(async () => {
    form.querySelector('select').value = status
    form.querySelector('select').dispatchEvent(new window.Event('change', { bubbles: true }))
    const note = form.querySelector('textarea')
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(note, 'Đã xử lý xong')
    note.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  await act(async () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(tickets[0].status, status)
  assert.equal(writes.length, 1)
}

test('closing a ticket removes it from visited Open caches even when post-save reload fails', () => screen(async container => {
  await filter(container, 'Đang mở'); await filter(container, 'Đã đóng'); await filter(container, 'Tất cả')
  failReload = true
  await resolve(container)
  assert.match(container.querySelector('.reception-support-list').textContent, /Đã đóng/)
  assert.equal(Boolean(container.querySelector('.reception-support-action')), false)
  await filter(container, 'Đang mở')
  assert.equal(Boolean(container.querySelector('.reception-support-action')), false)
  assert.equal(cache.snapshot('support:Open').data.length, 0)
  await filter(container, 'Đã đóng')
  assert.match(container.querySelector('.reception-support-list').textContent, /Phiếu cần hỗ trợ.*Đã xử lý xong/s)
  assert.equal(Boolean(container.querySelector('.reception-support-action')), false)
}))

test('acknowledgement-only responses still update every visited filter from the confirmed form', () => screen(async container => {
  await filter(container, 'Đang mở'); await filter(container, 'Đã giải quyết'); await filter(container, 'Tất cả')
  ackOnly = true; failReload = true
  await resolve(container, 'Resolved')
  assert.equal(cache.snapshot('support:Open').data.length, 0)
  assert.equal(cache.snapshot('support:Resolved').data[0].status, 'Resolved')
  assert.equal(cache.snapshot('support:all').data[0].resolutionNote, 'Đã xử lý xong')
  await filter(container, 'Đã giải quyết')
  assert.match(container.querySelector('.reception-support-list').textContent, /Đã giải quyết/)
  assert.ok(container.querySelector('.reception-support-action'), 'resolved tickets remain editable')
}))

test('an older in-flight Open response cannot resurrect a ticket after it has been closed', () => screen(async container => {
  await filter(container, 'Đang mở')
  holdOpen = true
  await click(container, '.reception-card-head button', 'Làm mới')
  assert.ok(heldOpenRead)
  await filter(container, 'Tất cả')
  await resolve(container)
  await act(async () => { heldOpenRead(); heldOpenRead = null })
  await filter(container, 'Đang mở')
  assert.equal(Boolean(container.querySelector('.reception-support-action')), false)
  assert.equal(cache.snapshot('support:Open').data.length, 0)
}))
