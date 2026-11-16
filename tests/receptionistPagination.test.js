import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { getAllReceptionistPages, receptionistPage, RECEPTIONIST_PAGE_SIZE } from '../src/utils/receptionistPagination.js'

let server, List, Pagination, PendingOrders
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, esbuild: { jsx: 'automatic' },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  const module = await server.ssrLoadModule('/src/pages/Receptionist/ReceptionistPagination.jsx')
  List = module.ReceptionistList
  Pagination = module.ReceptionistPagination
  PendingOrders = (await server.ssrLoadModule('/src/pages/Receptionist/PendingCounterOrders.jsx')).default
})
after(async () => { await server?.close() })

test('each page contains at most ten records with continuous indices and no missing last page', () => {
  assert.equal(RECEPTIONIST_PAGE_SIZE, 10)
  for (const total of [0, 1, 9, 10, 11, 20, 21, 105]) {
    const rows = Array.from({ length: total }, (_, index) => index + 1)
    const all = []
    for (let page = 1; page <= Math.max(1, Math.ceil(total / 10)); page++) {
      const range = receptionistPage(total, page)
      const visible = rows.slice(range.offset, range.to)
      assert.ok(visible.length <= 10)
      if (visible.length) assert.equal(visible[0], range.from)
      all.push(...visible)
    }
    assert.deepEqual(all, rows)
  }
  assert.equal(receptionistPage(11, 99).page, 2)
  assert.equal(receptionistPage(0, 99).page, 1)
  assert.equal(receptionistPage(20, -1).page, 1)
})

test('client lists render only ten actual rows, show total and give an accessible pager', () => {
  const items = Array.from({ length: 23 }, (_, index) => ({ id: index + 100, name: 'Hội viên ' + (index + 1) }))
  const html = renderToStaticMarkup(h(List, { items, table: true, label: 'Hội viên' }, item => h('button', { className: 'reception-table-row', 'data-member-id': item.id }, h('span', null, item.name))))
  assert.equal((html.match(/data-member-id=/g) || []).length, 10)
  assert.match(html, /data-stt="1"/)
  assert.match(html, /data-stt="10"/)
  assert.doesNotMatch(html, /data-stt="11"/)
  assert.match(html, /1–10 \/ 23/)
  assert.match(html, /aria-label="Phân trang Hội viên"/)
  assert.match(html, /aria-label="Chọn trang: Hội viên"/)
  assert.match(html, /aria-label="STT 10"/)
})

test('server pages render global STT 11 to 20 and keep the correct record identities for actions', () => {
  const items = Array.from({ length: 10 }, (_, index) => ({ id: index + 511 }))
  const selected = []
  const html = renderToStaticMarkup(h(List, { items, total: 23, page: 2, onPageChange() {}, label: 'Lượt đăng ký' }, (item, ordinal) => {
    selected.push([item.id, ordinal])
    return h('article', { 'data-registration': item.id }, 'Đăng ký ' + item.id)
  }))
  assert.deepEqual(selected[0], [511, 11])
  assert.deepEqual(selected.at(-1), [520, 20])
  assert.match(html, /data-stt="11"/)
  assert.match(html, /data-stt="20"/)
  assert.match(html, /11–20 \/ 23/)
  assert.match(html, /value="2" selected=""/)
  assert.doesNotMatch(html, /data-stt="21"/)
})

test('last and empty pages are clamped after data shrinks and buttons disable at the boundaries', () => {
  const html = renderToStaticMarkup(h(List, { items: [{ id: 21 }], total: 21, page: 3, onPageChange() {}, label: 'Đơn chờ' }, item => h('article', null, '#' + item.id)))
  assert.match(html, /data-stt="21"/)
  assert.match(html, /21–21 \/ 21/)
  assert.match(html, /disabled="" aria-label="Trang sau: Đơn chờ"/)
  const first = renderToStaticMarkup(h(Pagination, { total: 5, page: 9, label: 'Phòng', onChange() {} }))
  assert.match(first, /1–5 \/ 5/)
  assert.match(first, /disabled="" aria-label="Trang trước: Phòng"/)
  assert.match(first, /disabled="" aria-label="Trang sau: Phòng"/)
  assert.equal(renderToStaticMarkup(h(Pagination, { total: 0, onChange() {} })), '')
})

test('counter orders paginate while preserving blocked state and the exact collect action IDs', () => {
  const orders = Array.from({ length: 21 }, (_, index) => ({ id: 48 + index, memberId: 9, packageName: 'Gold', agreedPrice: 2000, blockedReason: index === 2 ? 'Cần đối soát' : '' }))
  const html = renderToStaticMarkup(h(PendingOrders, { orders, onCollect() {}, onRefresh() {} }))
  assert.equal((html.match(/reception-pending-order-row/g) || []).length, 10)
  assert.match(html, /Thu tiền đơn đăng ký 48/)
  assert.match(html, /Thu tiền đơn đăng ký 57/)
  assert.doesNotMatch(html, /Thu tiền đơn đăng ký 58/)
  assert.doesNotMatch(html, /Thu tiền đơn đăng ký 50/)
  assert.match(html, /Cần đối soát/)
})

test('the list loader reaches records beyond the first API page, including a smaller server page size', async () => {
  const rows = Array.from({ length: 125 }, (_, index) => ({ id: index + 1 }))
  for (const actualSize of [100, 20]) {
    const calls = []
    const result = await getAllReceptionistPages(async (page, pageSize) => {
      calls.push([page, pageSize])
      return { items: rows.slice((page - 1) * actualSize, page * actualSize), total: rows.length, pageSize: actualSize }
    })
    assert.deepEqual(result, rows)
    assert.equal(calls.length, Math.ceil(125 / actualSize))
    assert.equal(result.at(-1).id, 125)
  }
})

test('incomplete, repeated or malformed API pages fail explicitly instead of hiding remaining records', async () => {
  await assert.rejects(getAllReceptionistPages(async () => ({ items: {}, total: 20 })), /không hợp lệ/)
  await assert.rejects(getAllReceptionistPages(async () => ({ items: [{ id: 1 }], total: 20 })), /lặp trang/)
  await assert.rejects(getAllReceptionistPages(async page => ({ items: page === 1 ? [{ id: 1 }] : [], total: 20 })), /Chưa tải đủ/)
  await assert.rejects(getAllReceptionistPages(async () => { throw new Error('Network failed') }), /Network failed/)
})
