import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { memberAiHistoryDate, memberChatTurns } from '../src/utils/memberAiHistory.js'

let server, Plan, Controls, Confirmation
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, server: { middlewareMode: true, hmr: { port: 0 } }, appType: 'custom', logLevel: 'error' })
  Plan = (await server.ssrLoadModule('/src/pages/member/MemberWorkoutPlan.jsx')).default
  const components = await server.ssrLoadModule('/src/pages/member/MemberAiHistoryControls.jsx')
  Controls = components.AiHistoryControls
  Confirmation = components.AiDeleteConfirmation
})
after(async () => { await server?.close() })

test('saved newest-first turns become chronological without dropping repeated server questions or local failures', () => {
  const saved = [{ id: 3, question: 'Hỏi lại', answer: 'Đáp' }, { id: 2, question: 'Hỏi lại', answer: 'Đáp' }, { id: 1, question: 'Cũ', answer: 'Trước' }]
  const local = [{ id: 1, question: 'Hỏi lại', answer: 'Đáp', status: 'success' }, { id: 2, question: 'Mới', status: 'pending' }, { id: 3, question: 'Lỗi', status: 'error' }]
  const turns = memberChatTurns(saved, local)
  assert.deepEqual(turns.map(item => item.id), ['saved-1', 'saved-2', 'saved-3', 2, 3])
  assert.deepEqual(saved.map(item => item.id), [3, 2, 1])
  assert.equal(local.length, 3)
})

test('a reply missing from a delayed history read stays visible until BE returns it', () => {
  const local = [{ id: 1, question: 'Mới', answer: 'Đang lưu', status: 'success' }]
  assert.equal(memberChatTurns([], local).length, 1)
  assert.equal(memberChatTurns([{ id: 9, question: 'Mới', answer: 'Đang lưu' }], local).length, 1)
})

test('structured plans preserve exercise values, saved goals and warnings in a readable table', () => {
  const html = renderToStaticMarkup(createElement(Plan, { plan: { goal: 'Tăng sức bền', level: 'Intermediate', daysPerWeek: 1,
    sessions: [{ day: 1, title: 'Toàn thân', durationMinutes: 45, exercises: [{ exerciseName: 'Squat', sets: 3, reps: 12, restSeconds: 60, note: 'Lưng thẳng' }] }], warnings: ['Trao đổi với HLV'] } }))
  for (const text of ['Tăng sức bền', 'Trung cấp', '45 phút', 'Squat', 'Lưng thẳng', 'Trao đổi với HLV']) assert.ok(html.includes(text))
  assert.match(html, /<td>3<\/td><td>12<\/td><td>60<\/td>/)
  assert.match(html, /aria-label="Bài tập buổi 1"/)
  assert.equal(html.includes('[object Object]'), false)
})

test('history pagination identifies older pages and destructive actions require a separate confirmation', () => {
  const history = { data: { total: 31 }, page: 2, pageSize: 20, loading: false, reload() {}, setPage() {} }
  const html = renderToStaticMarkup(createElement(Controls, { history, label: 'lịch sử chat', disabled: false }))
  assert.match(html, /Trang 2\/2/)
  assert.match(html, /disabled="">Cũ hơn/)
  const dialog = renderToStaticMarkup(createElement(Confirmation, { title: 'Xóa lịch sử?', busy: false, error: '', onClose() {}, onConfirm() {} }, 'Không thể hoàn tác.'))
  assert.match(dialog, /Không thể hoàn tác/)
  assert.match(dialog, /type="submit" class="danger"/)
  assert.equal(dialog.includes('role="alert"'), false)
})

test('history dates use Vietnam time', () => {
  assert.match(memberAiHistoryDate('2026-10-30T18:30:00Z'), /01:30/)
  assert.equal(memberAiHistoryDate('invalid'), 'Chưa cập nhật ngày')
})
