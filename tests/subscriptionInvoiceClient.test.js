import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let window, server, api, Button, Subscriptions, Provider, MemoryRouter, createRoot
let payments, calls, downloads, failedPdf
const descriptors = new Map()
const subscription = { id: 63, packageId: 2, packageType: 'Standard', packageName: 'Flex Pass', agreedPrice: 2000, status: 'Active', startDate: '2026-01-01', endDate: '2099-01-01' }
before(async () => {
  window = new Window({ url: 'http://localhost/member?view=subscriptions' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, localStorage: window.localStorage, sessionStorage: window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  window.URL.createObjectURL = () => 'blob:test-invoice'
  window.URL.revokeObjectURL = () => {}
  window.HTMLAnchorElement.prototype.click = function () { downloads.push(this.download) }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module-sync', 'module', 'import'] } },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  api.defaults.adapter = async config => {
    calls.push(config.url)
    assert.equal(config.method, 'get', 'exporting never writes transactions')
    if (config.url.endsWith('/export-pdf')) {
      if (failedPdf) throw new Error('Không tải được hóa đơn')
      return { data: new Blob(['%PDF-test'], { type: 'application/pdf' }), status: 200, headers: {}, config }
    }
    const data = config.url === '/payments' ? payments
      : config.url === '/membership-packages' ? [{ id: 2, packageName: 'Flex Pass', packageType: 'Standard', price: 2000, durationInDays: 30, isActive: true }]
        : config.url === '/member-subscriptions/63' ? { ...subscription, payments }
          : config.url === '/member-subscriptions/mine' ? [subscription] : []
    return { data: { success: true, data }, status: 200, headers: {}, config }
  }
  Button = (await server.ssrLoadModule('/src/pages/member/SubscriptionInvoiceButton.jsx')).default
  Subscriptions = (await server.ssrLoadModule('/src/pages/member/SubscriptionsView.jsx')).SubscriptionsView
  Provider = (await server.ssrLoadModule('/src/contexts/MemberWorkspaceContext.jsx')).MemberWorkspaceProvider
  MemoryRouter = (await server.ssrLoadModule('react-router-dom')).MemoryRouter
  createRoot = (await import('react-dom/client')).createRoot
})
after(async () => {
  await server?.close(); await window?.happyDOM.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})
async function screen(element, run) {
  payments = [{ id: 108, subscriptionId: 63, status: 'Completed', amount: 2000, paymentMethod: 'Cash' }]
  calls = []; downloads = []; failedPdf = false
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  try { await act(async () => root.render(element)); await run(container) }
  finally { await act(async () => root.unmount()); container.remove() }
}
const click = element => act(async () => { assert.ok(element); element.click() })
test('resolves payment ID instead of subscription ID and ignores unpaid or unrelated receipts', () => screen(h(Button, { subscription }), async container => {
  assert.equal(calls.length, 0, 'no extra polling on mount')
  payments.push({ id: 63, subscriptionId: 99, status: 'Completed' }, { id: 109, subscriptionId: 63, status: 'Pending' })
  await act(async () => { container.querySelector('button').click(); container.querySelector('button').click() })
  assert.deepEqual(calls, ['/payments', '/payments/108/export-pdf'])
  assert.deepEqual(downloads, ['hoa-don-olympus-108.pdf'])
}))
test('pending unpaid orders do not offer export', () => screen(h(Button, { subscription: { ...subscription, status: 'Pending' } }), async container => {
  assert.equal(container.querySelector('button'), null)
  assert.deepEqual(calls, [])
}))
test('missing confirmed payment explains the problem without exporting', () => screen(h(Button, { subscription }), async container => {
  payments = [{ id: 109, subscriptionId: 63, status: 'Pending' }]
  await click(container.querySelector('button'))
  assert.match(container.querySelector('[role="alert"]').textContent, /Chưa tìm thấy/)
  assert.deepEqual(downloads, [])
}))
test('PDF failures allow retry without creating a new payment', () => screen(h(Button, { subscription }), async container => {
  failedPdf = true
  await click(container.querySelector('button'))
  assert.match(container.querySelector('[role="alert"]').textContent, /Không tải được/)
  failedPdf = false
  await click(container.querySelector('button'))
  assert.equal(container.querySelector('[role="alert"]'), null)
  assert.equal(downloads.length, 1)
}))
test('multiple completed receipts offer a choice of invoices', () => screen(h(Button, { subscription }), async container => {
  payments.push({ id: 110, subscriptionId: 63, status: 'Completed', amount: 1000, paymentMethod: 'PayOS' })
  await click(container.querySelector('button'))
  assert.equal(container.querySelectorAll('dialog[open] li').length, 2)
  assert.deepEqual(downloads, [])
  await click(container.querySelectorAll('dialog li button')[1])
  assert.deepEqual(downloads, ['hoa-don-olympus-110.pdf'])
}))
test('invoice export is available from the order card and its details', () => screen(h(MemoryRouter, null, h(Provider, { sessionKey: 'invoice-test' }, h(Subscriptions))), async container => {
  await click([...container.querySelectorAll('.member-sub-tabs button')].find(button => button.textContent.includes('Gói của tôi')))
  const card = container.querySelector('.member-sub-list > li')
  assert.ok(card)
  await click(card.querySelector('[aria-label="Xuất hóa đơn PDF cho đơn SUB-63"]'))
  assert.deepEqual(downloads, ['hoa-don-olympus-108.pdf'])
  await click([...card.querySelectorAll('button')].find(button => button.textContent === 'Chi tiết'))
  assert.ok(container.querySelector('.member-modal-footer [aria-label="Xuất hóa đơn PDF cho đơn SUB-63"]'))
}))
