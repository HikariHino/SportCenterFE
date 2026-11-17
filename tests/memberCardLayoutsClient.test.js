import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let window, server, createRoot, Plans, Sidebar, Support, plans
const descriptors = new Map()
const exercises = count => Array.from({ length: count }, (_, index) => ({ id: index + 1, exerciseName: `Bài tập ${index + 1}`, sets: 3, reps: 12, durationInMinutes: 5 }))
const plan = (id, count = 2) => ({ id, planName: `Giáo án ${id}`, goal: 'GeneralFitness', coachName: 'Coach', status: 'Active', startDate: '2026-11-01', endDate: '2026-12-01', exercises: exercises(count) })
const conversations = count => Array.from({ length: count }, (_, index) => ({ id: `chat-${index + 1}`, title: `Cuộc trò chuyện ${index + 1}`, updatedAt: `2026-11-${String(index + 1).padStart(2, '0')}T10:00:00Z`, messages: [{ id: index, question: 'Câu hỏi', answer: 'Trả lời' }] }))

before(async () => {
  window = new Window({ url: 'http://localhost:3000/member' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator, HTMLElement: window.HTMLElement,
    localStorage: window.localStorage, sessionStorage: window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  const api = (await server.ssrLoadModule('/src/services/api.js')).default
  api.defaults.adapter = async config => {
    assert.equal(config.method, 'get')
    const data = config.url === '/members/me' ? { memberId: 9 } : config.url === '/TrainingPlans/members/9' ? plans
      : [{ id: 4, title: 'Cảm ơn', description: 'Hỗ trợ', status: 'Open', priority: 'Normal' }]
    return { data: { success: true, data }, status: 200, headers: {}, config }
  }
  Plans = (await server.ssrLoadModule('/src/pages/member/TrainingPlansView.jsx')).TrainingPlansView
  Sidebar = (await server.ssrLoadModule('/src/pages/member/MemberAiConversationSidebar.jsx')).default
  Support = (await server.ssrLoadModule('/src/pages/member/SupportTicketsView.jsx')).SupportTicketsView
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
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  const render = element => act(async () => root.render(element))
  try { await render(element); await run(render) }
  finally { await act(async () => root.unmount()); container.remove() }
}
const pager = label => document.querySelector(`[aria-label="Phân trang ${label}"]`)
const next = label => act(async () => pager(label).querySelector('[aria-label^="Trang sau:"]').click())
const history = { page: 1, pageSize: 10, data: { page: 1, total: 30 }, latest() {}, reload() {}, setPage() {} }

test('one plan with two exercises has no redundant card ordinal or nested page controls but retains exercise numbers', async () => {
  plans = [plan(6)]
  await screen(h(Plans), async () => {
    assert.equal(document.querySelectorAll('.training-plans-card').length, 1)
    assert.equal(document.querySelector('.training-plans-card').classList.contains('member-numbered-item'), false)
    assert.equal(pager('Giáo án tập luyện'), null)
    assert.equal(pager('Bài tập trong giáo án'), null)
    assert.equal(document.querySelectorAll('.training-plans-card .member-list-scroll').length, 1)
    assert.deepEqual([...document.querySelectorAll('.training-plans-card td.member-stt')].map(node => node.textContent), ['1', '2'])
    assert.match(document.querySelector('.training-plans-card').textContent, /Giáo án #6/)
    assert.equal(document.querySelector('.training-plans-list').closest('.member-paged-list').classList.contains('member-paged-list--flow'), true)
  })
})

test('more than ten exercises keep a single pager and every exercise reachable within one plan', async () => {
  plans = [plan(6, 23)]
  await screen(h(Plans), async () => {
    const seen = []
    for (let index = 0; index < 3; index++) {
      const rows = [...document.querySelectorAll('tbody > tr')]
      assert.equal(rows.length, index === 2 ? 3 : 10)
      seen.push(...rows.map(node => Number(node.dataset.stt)))
      if (index < 2) await next('Bài tập trong giáo án')
    }
    assert.deepEqual(seen, Array.from({ length: 23 }, (_, index) => index + 1))
    assert.equal(document.querySelectorAll('.member-pagination').length, 1)
    assert.equal(pager('Giáo án tập luyện'), null)
  })
})

test('more than ten plans keep all plan pages without redundant exercise pagers', async () => {
  plans = Array.from({ length: 23 }, (_, index) => plan(index + 1))
  await screen(h(Plans), async () => {
    const seen = []
    for (let index = 0; index < 3; index++) {
      const cards = [...document.querySelectorAll('.training-plans-card')]
      assert.equal(cards.length, index === 2 ? 3 : 10)
      seen.push(...cards.map(card => Number(card.dataset.stt)))
      assert.equal(document.querySelectorAll('.member-pagination').length, 1)
      if (index < 2) await next('Giáo án tập luyện')
    }
    assert.deepEqual(seen, Array.from({ length: 23 }, (_, index) => index + 1))
    assert.equal(document.querySelectorAll('.training-plans-card.member-numbered-item').length, 0)
  })
})

test('short AI history omits card ordinals and single-page controls while selection and older-history loading work', async () => {
  const items = conversations(3), selected = [], pages = []
  await screen(h(Sidebar, { workspace: { conversations: items, activeId: 'chat-1' }, history: { ...history, setPage: page => pages.push(page) }, onSelect: id => selected.push(id), onNew() {} }), async () => {
    const list = document.querySelector('.member-ai-conversation-list')
    assert.equal(list.querySelectorAll('button').length, 3)
    assert.equal(list.querySelector('.member-numbered-item'), null)
    assert.equal(pager('Cuộc trò chuyện AI'), null)
    assert.equal(list.closest('.member-list-scroll').querySelectorAll('.member-list-scroll').length, 0)
    await act(async () => list.querySelector('[title="Cuộc trò chuyện 2"]').click())
    assert.deepEqual(selected, ['chat-2'])
    await act(async () => document.querySelector('.member-ai-load-history').click())
    assert.deepEqual(pages, [2])
    assert.equal(list.querySelector('[aria-current="true"]').title, 'Cuộc trò chuyện 1')
  })
})

test('long AI history retains ten items per page and selected state across page navigation', async () => {
  const items = conversations(23)
  await screen(h(Sidebar, { workspace: { conversations: items, activeId: 'chat-1' }, history, onSelect() {}, onNew() {} }), async () => {
    const seen = []
    for (let index = 0; index < 3; index++) {
      const buttons = [...document.querySelectorAll('.member-ai-conversation-list > button')]
      assert.equal(buttons.length, index === 2 ? 3 : 10)
      seen.push(...buttons.map(button => button.title))
      if (index < 2) await next('Cuộc trò chuyện AI')
    }
    assert.equal(new Set(seen).size, 23)
    assert.equal(document.querySelector('[aria-current="true"]').title, 'Cuộc trò chuyện 1')
    assert.equal(document.querySelectorAll('.member-numbered-item').length, 0)
    assert.doesNotMatch(pager('Cuộc trò chuyện AI').textContent, /Trước|Sau|Trang/)
  })
})

test('Member support cards omit extra ordinal labels but retain ticket ID and image action', () => screen(h(Support), async () => {
  const card = document.querySelector('.member-support-card')
  assert.equal(card.classList.contains('member-numbered-item'), false)
  assert.match(card.textContent, /Phiếu #4/)
  assert.match(card.textContent, /Bổ sung ảnh sự cố/)
  assert.ok(pager('Phiếu hỗ trợ'))
}))
