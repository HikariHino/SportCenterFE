import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

let server, ClassSessionGroups
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, server: { middlewareMode: true, hmr: { port: 0 } }, appType: 'custom', logLevel: 'error' })
  ClassSessionGroups = (await server.ssrLoadModule('/src/pages/CenterManager/ClassSessionGroups.jsx')).default
})
after(async () => { await server?.close() })

const session = { id: 1, status: 'Scheduled', startsAt: '2026-10-21T11:00:00Z' }
const render = items => renderToStaticMarkup(createElement(ClassSessionGroups, { items }, item => createElement('article', { key: item.id }, `Session-${item.id}`)))
const part = (html, name) => html.split(`class="class-session-group ${name}"`)[1]?.split('</section>')[0]?.split('</details>')[0] || ''

test('scheduled, both cancellation spellings, completed and unknown statuses stay in separate groups', () => {
  const items = [session, { ...session, id: 2, status: 'Cancelled' }, { ...session, id: 3, status: null, Status: ' CANCELED ' }, { ...session, id: 4, status: 'Completed' }, { ...session, id: 5, status: 'Draft' }]
  const html = render(items)
  assert.match(part(html, 'scheduled'), /1 buổi/)
  assert.match(part(html, 'scheduled'), /Session-1/)
  assert.doesNotMatch(part(html, 'scheduled'), /Session-[2345]/)
  assert.match(part(html, 'cancelled'), /2 buổi/)
  assert.match(part(html, 'cancelled'), /Session-2/)
  assert.match(part(html, 'cancelled'), /Session-3/)
  assert.match(part(html, 'completed'), /Session-4/)
  assert.match(part(html, 'other'), /Session-5/)
  assert.equal(items[0], session)
})

test('only-cancelled and empty classes show distinct empty states for the scheduled list', () => {
  const cancelled = render([{ ...session, status: 'Cancelled' }])
  assert.match(part(cancelled, 'scheduled'), /Không có buổi học/)
  assert.doesNotMatch(part(cancelled, 'scheduled'), /Session-1/)
  assert.match(part(cancelled, 'cancelled'), /Session-1/)
  assert.match(part(render([]), 'cancelled'), /Lớp chưa có buổi học nào bị hủy/)
})

test('a replacement stays scheduled while cancelled history is sorted newest first without mutating input', () => {
  const items = [{ ...session, id: 2, status: 'Cancelled' }, { ...session, id: 3, status: 'Cancelled', startsAt: '2026-11-01T11:00:00Z' }, session]
  const before = JSON.stringify(items)
  const html = render(items)
  assert.ok(part(html, 'cancelled').indexOf('Session-3') < part(html, 'cancelled').indexOf('Session-2'))
  assert.match(part(html, 'scheduled'), /Session-1/)
  assert.equal(JSON.stringify(items), before)
})
