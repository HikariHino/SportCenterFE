import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { appendMemberChatTurn, importMemberChatHistory, initializeMemberConversations, newMemberConversation, readMemberConversations, updateMemberChatTurn, visibleMemberConversations, writeMemberConversations } from '../src/utils/memberAiConversations.js'

const now = '2026-10-31T03:00:00Z'
const later = '2026-10-31T04:00:00Z'
const turn = { id: 'local-1', question: 'Tôi nên khởi động thế nào?', answer: 'Đi bộ nhẹ 5 phút.', status: 'success', createdAt: now }
const savedTurn = { id: 50, question: turn.question, answer: turn.answer, createdAt: '2026-10-31T03:00:10Z' }
const memoryStorage = () => {
  const data = new Map()
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) }
}

test('a new login opens a blank conversation without selecting or erasing the previous conversation', () => {
  let first = initializeMemberConversations([], null, 'login-1', now, 'chat-1')
  first = appendMemberChatTurn(first, 'chat-1', turn)
  const storage = memoryStorage()
  writeMemberConversations(storage, 'member-12', first.conversations)
  let second = initializeMemberConversations(readMemberConversations(storage, 'member-12'), { loginId: 'login-1', activeId: 'chat-1' }, 'login-2', later, 'chat-2')
  assert.equal(second.activeId, 'chat-2')
  assert.deepEqual(second.conversations.find(item => item.id === 'chat-2').messages, [])
  assert.deepEqual(second.conversations.find(item => item.id === 'chat-1').messages, [turn])
  second = importMemberChatHistory(second, [savedTurn])
  assert.equal(second.activeId, 'chat-2')
  assert.equal(second.conversations.find(item => item.id === 'chat-2').messages.length, 0)
  assert.equal(second.conversations.find(item => item.id === 'chat-1').messages[0].serverId, 50)
})

test('a page reload restores the selected conversation in the same login; New chat preserves earlier replies', () => {
  let workspace = initializeMemberConversations([], null, 'login-1', now, 'chat-1')
  workspace = appendMemberChatTurn(workspace, 'chat-1', turn)
  const restored = initializeMemberConversations(workspace.conversations, { loginId: 'login-1', activeId: 'chat-1' }, 'login-1', later, 'unused')
  assert.equal(restored.activeId, 'chat-1')
  assert.equal(restored.conversations.length, 1)
  const next = newMemberConversation(restored, later, 'chat-2')
  assert.equal(next.activeId, 'chat-2')
  assert.equal(next.conversations[0].messages[0].answer, turn.answer)
  assert.equal(next.conversations[0].title, turn.question)
  assert.equal(newMemberConversation(next, later, 'chat-3').activeId, 'chat-2')
})

test('late replies update their original conversation even after another conversation is selected', () => {
  let workspace = initializeMemberConversations([], null, 'login-1', now, 'chat-1')
  workspace = appendMemberChatTurn(workspace, 'chat-1', { ...turn, status: 'pending', answer: undefined })
  workspace = newMemberConversation(workspace, later, 'chat-2')
  const updated = updateMemberChatTurn(workspace, 'chat-1', turn.id, { status: 'success', answer: turn.answer }, later)
  assert.equal(updated.activeId, 'chat-2')
  assert.equal(updated.conversations[0].messages[0].answer, turn.answer)
  assert.equal(updated.conversations[1].messages.length, 0)
  assert.equal(workspace.conversations[0].messages[0].status, 'pending')
})

test('different accounts have separate persisted conversations and clearing one account leaves the other intact', () => {
  const storage = memoryStorage()
  const first = appendMemberChatTurn(initializeMemberConversations([], null, 'login-a', now, 'chat-a'), 'chat-a', turn)
  const second = appendMemberChatTurn(initializeMemberConversations([], null, 'login-b', now, 'chat-b'), 'chat-b', { ...turn, question: 'Tài khoản khác' })
  writeMemberConversations(storage, 'member-12', first.conversations)
  writeMemberConversations(storage, 'member-15', second.conversations)
  assert.equal(readMemberConversations(storage, 'member-12')[0].messages[0].question, turn.question)
  assert.equal(readMemberConversations(storage, 'member-15')[0].messages[0].question, 'Tài khoản khác')
  writeMemberConversations(storage, 'member-12', [])
  assert.deepEqual(readMemberConversations(storage, 'member-12'), [])
  assert.equal(readMemberConversations(storage, 'member-15').length, 1)
})

test('server history imports every page once, retains older repeated questions and never replaces the active draft', () => {
  const draft = initializeMemberConversations([], null, 'login-new', later, 'draft')
  const rows = [savedTurn, { ...savedTurn, id: 49, createdAt: '2026-10-30T03:00:00Z' }]
  const once = importMemberChatHistory(draft, rows)
  const twice = importMemberChatHistory(once, rows)
  assert.equal(twice.activeId, 'draft')
  assert.deepEqual(twice.conversations.find(item => item.legacy).messages.map(item => item.serverId), [49, 50])
  assert.equal(twice.conversations.find(item => item.id === 'draft').messages.length, 0)
  assert.equal(draft.conversations.length, 1)
  let current = appendMemberChatTurn(draft, 'draft', { ...turn, createdAt: later })
  current = importMemberChatHistory(current, rows)
  assert.equal(current.conversations.find(item => item.id === 'draft').messages[0].serverId, undefined)
  assert.equal(current.conversations.find(item => item.legacy).messages.length, 2)
})

test('interrupted requests retain their question after a reload without pretending to still be running', () => {
  const storage = memoryStorage()
  const workspace = appendMemberChatTurn(initializeMemberConversations([], null, 'login-1', now, 'chat'), 'chat', { ...turn, status: 'pending', answer: undefined })
  writeMemberConversations(storage, 'member-12', workspace.conversations)
  const read = readMemberConversations(storage, 'member-12')[0].messages[0]
  assert.equal(read.question, turn.question)
  assert.equal(read.status, 'error')
  assert.match(read.error, /gián đoạn/)
})

let server, Sidebar
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, server: { middlewareMode: true, hmr: { port: 0 } }, appType: 'custom', logLevel: 'error' })
  Sidebar = (await server.ssrLoadModule('/src/pages/member/MemberAiConversationSidebar.jsx')).default
})
after(async () => { await server?.close() })

test('the sidebar displays old conversation titles, the active new draft and access to older server history', () => {
  let workspace = appendMemberChatTurn(initializeMemberConversations([], null, 'login-1', now, 'chat-1'), 'chat-1', turn)
  workspace = initializeMemberConversations(workspace.conversations, null, 'login-2', later, 'chat-2')
  assert.deepEqual(visibleMemberConversations(workspace).map(item => item.id), ['chat-2', 'chat-1'])
  const html = renderToStaticMarkup(createElement(Sidebar, { workspace, history: { page: 1, pageSize: 20, data: { page: 1, total: 30 }, loading: false }, onSelect() {}, onNew() {} }))
  assert.match(html, /<aside[^>]*aria-label="Lịch sử cuộc trò chuyện AI"/)
  assert.ok(html.includes(turn.question))
  assert.match(html, /Cuộc trò chuyện mới/)
  assert.match(html, /aria-current="true"/)
  assert.match(html, /Tải lịch sử cũ hơn/)
})
