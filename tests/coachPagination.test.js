import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { listPage } from '../src/utils/listPagination.js'

let server, List, Pager
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, esbuild: { jsx: 'automatic' },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  const module = await server.ssrLoadModule('/src/pages/Coach/CoachPagination.jsx')
  List = module.CoachList
  Pager = module.CoachPagination
})
after(async () => { await server?.close() })

test('Coach controls use their own styles and show ten records per page with continuous STT', () => {
  const html = renderToStaticMarkup(h(List, { items: Array.from({ length: 23 }, (_, index) => ({ id: index + 1 })), label: 'Giáo án' }, item => h('article', null, 'Giáo án #' + item.id)))
  assert.equal((html.match(/data-stt=/g) || []).length, 10)
  assert.match(html, /class="coach-pagination"/)
  assert.match(html, /coach-numbered-item/)
  assert.doesNotMatch(html, /reception-pagination/)
  assert.match(html, /1–10 \/ 23/)
})

test('editing an exercise on page two uses its absolute form index and preserves off-page rows', () => {
  const exercises = Array.from({ length: 23 }, (_, index) => ({ id: index + 100, sets: '3' }))
  const range = listPage(exercises.length, 2)
  const changes = []
  const html = renderToStaticMarkup(h(List, { items: exercises.slice(range.offset, range.to), total: exercises.length, page: 2, onPageChange() {}, label: 'Bài tập đang soạn' }, (exercise, ordinal) => {
    const index = ordinal - 1
    changes.push(value => { exercises[index] = { ...exercises[index], sets: value } })
    return h('article', { 'data-exercise-id': exercise.id }, h('input', { value: exercise.sets, readOnly: true }))
  }))
  assert.match(html, /data-stt="11"/)
  assert.match(html, /data-stt="20"/)
  assert.match(html, /data-exercise-id="110"/)
  changes[0]('5')
  changes[9]('8')
  assert.equal(exercises[0].sets, '3')
  assert.equal(exercises[10].sets, '5')
  assert.equal(exercises[19].sets, '8')
  assert.equal(exercises[20].sets, '3')
})

test('fixed table layout places the pager outside the scrolling rows and clamps deleted last pages', () => {
  const html = renderToStaticMarkup(h(List, { items: [{ id: 11 }], total: 11, page: 99, onPageChange() {}, table: true, label: 'Học viên',
    renderLayout: (rows, pager) => h('div', { className: 'coach-paged-table' }, h('div', { className: 'coach-table-scroll' }, rows), pager),
  }, item => h('article', { className: 'coach-attendance-row' }, h('span', null, 'Học viên #' + item.id))))
  assert.match(html, /data-stt="11"/)
  assert.match(html, /<\/article><\/div><nav class="coach-pagination"/)
  assert.match(html, /11–11 \/ 11/)
  assert.match(html, /disabled="" aria-label="Trang sau: Học viên"/)
  assert.equal(renderToStaticMarkup(h(Pager, { total: 0, onChange() {} })), '')
})
