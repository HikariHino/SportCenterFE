import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h, useState } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let window, server, root, List, container
const descriptors = new Map()
const items = Array.from({ length: 23 }, (_, index) => ({ id: index + 1, name: 'Bản ghi ' + (index + 1) }))
before(async () => {
  window = new Window({ url: 'http://localhost/member' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator, HTMLElement: window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  List = (await server.ssrLoadModule('/src/pages/member/MemberPagination.jsx')).MemberList
  container = document.createElement('div'); document.body.append(container)
  root = (await import('react-dom/client')).createRoot(container)
})
after(async () => {
  await act(async () => root?.unmount())
  await server?.close(); await window?.happyDOM.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})
const render = (props = {}) => act(async () => root.render(h(List, { items, label: 'Danh sách', ...props }, item => h('article', { 'data-id': item.id }, item.name))))
const next = () => act(async () => container.querySelector('[aria-label="Trang sau: Danh sách"]').click())
const ordinals = () => [...container.querySelectorAll('[data-stt]')].map(row => Number(row.dataset.stt))

test('all records remain reachable in groups of ten with continuous STT and a footer outside the scroll area', async () => {
  await render({ resetKey: 'all-records' })
  const seen = [...ordinals()]
  assert.deepEqual(seen, [1,2,3,4,5,6,7,8,9,10])
  const scroll = container.querySelector('.member-list-scroll'), footer = container.querySelector('.member-pagination')
  assert.equal(scroll.parentElement, footer.parentElement)
  assert.equal(scroll.contains(footer), false)
  scroll.scrollTop = 300
  await next(); assert.equal(scroll.scrollTop, 0)
  assert.deepEqual(ordinals(), [11,12,13,14,15,16,17,18,19,20]); seen.push(...ordinals())
  await next(); assert.deepEqual(ordinals(), [21,22,23]); seen.push(...ordinals())
  assert.deepEqual(seen, items.map(item => item.id))
  assert.equal(container.querySelector('[aria-label="Trang sau: Danh sách"]').disabled, true)
})

test('filters reset the page and background deletions clamp it without jumping back when data grows', async () => {
  await render({ resetKey: 'filters' }); await next()
  await render({ resetKey: 'filtered', items: items.slice(0, 12) })
  assert.equal(ordinals()[0], 1)
  await render({ resetKey: 'filters' }); assert.equal(ordinals()[0], 1)
  await next(); await next(); assert.equal(ordinals()[0], 21)
  await render({ resetKey: 'filters', items: items.slice(0, 7) }); assert.equal(ordinals().length, 7)
  await render({ resetKey: 'filters' }); assert.equal(ordinals()[0], 1)
})

test('native table rows receive a valid STT cell and keep their record identity on page two', async () => {
  await act(async () => root.render(h(List, { items, label: 'Danh sách', resetKey: 'table', table: true, heading: h('tr', null, h('th', null, 'STT'), h('th', null, 'Tên')) }, item => h('tr', { 'data-id': item.id }, h('td', null, item.name)))))
  assert.equal(container.querySelectorAll('tbody > tr').length, 10)
  assert.equal(container.querySelector('tbody > tr > :first-child').tagName, 'TD')
  await next()
  assert.equal(container.querySelector('tbody > tr').dataset.id, '11')
  assert.equal(container.querySelector('tbody > tr > .member-stt').textContent, '11')
})

test('controlled checkboxes retain off-page selections', async () => {
  function Choices() {
    const [selected, setSelected] = useState(new Set())
    return h(List, { items, label: 'Danh sách' }, item => h('label', null, h('input', { type: 'checkbox', checked: selected.has(item.id), 'data-id': item.id,
      onChange: event => setSelected(previous => { const next = new Set(previous); if (event.target.checked) next.add(item.id); else next.delete(item.id); return next }) }), item.name))
  }
  await act(async () => root.render(h(Choices)))
  await act(async () => container.querySelector('input[data-id="10"]').click())
  await next(); await act(async () => container.querySelector('input[data-id="11"]').click())
  await act(async () => container.querySelector('[aria-label="Trang trước: Danh sách"]').click())
  assert.equal(container.querySelector('input[data-id="10"]').checked, true)
  await next(); assert.equal(container.querySelector('input[data-id="11"]').checked, true)
})
