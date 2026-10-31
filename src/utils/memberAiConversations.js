const newId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
const stamp = () => new Date().toISOString()
export const conversationStorageKey = account => `sportcenter.ai.conversations.v1:${account}`
export const conversationViewKey = account => `sportcenter.ai.conversation-view.v1:${account}`

export function createMemberConversation(loginId, now = stamp(), id = newId()) {
  return { id, loginId, title: 'Cuộc trò chuyện mới', createdAt: now, updatedAt: now, messages: [] }
}

export function initializeMemberConversations(conversations, view, loginId, now = stamp(), id = newId()) {
  if (view?.loginId === loginId && conversations.some(item => item.id === view.activeId)) {
    return { conversations, activeId: view.activeId, loginId }
  }
  const draft = createMemberConversation(loginId, now, id)
  return { conversations: [...conversations, draft], activeId: draft.id, loginId }
}

export function newMemberConversation(workspace, now = stamp(), id = newId()) {
  const draft = workspace.conversations.find(item => item.loginId === workspace.loginId && !item.messages.length)
  if (draft) return { ...workspace, activeId: draft.id }
  const conversation = createMemberConversation(workspace.loginId, now, id)
  return { ...workspace, activeId: conversation.id, conversations: [...workspace.conversations, conversation] }
}

export function appendMemberChatTurn(workspace, conversationId, turn) {
  return { ...workspace, conversations: workspace.conversations.map(item => item.id !== conversationId ? item : {
    ...item, title: item.messages.length ? item.title : turn.question.replace(/\s+/g, ' ').trim().slice(0, 70),
    updatedAt: turn.createdAt, messages: [...item.messages, turn],
  }) }
}

export function updateMemberChatTurn(workspace, conversationId, turnId, patch, now = stamp()) {
  return { ...workspace, conversations: workspace.conversations.map(item => item.id !== conversationId ? item : {
    ...item, updatedAt: now, messages: item.messages.map(turn => turn.id === turnId ? { ...turn, ...patch } : turn),
  }) }
}

export function importMemberChatHistory(workspace, rows) {
  if (!rows.length) return workspace
  const conversations = workspace.conversations.map(item => ({ ...item, messages: item.messages.map(turn => ({ ...turn })) }))
  const known = new Map()
  for (const item of conversations) for (const turn of item.messages) if (turn.serverId != null) known.set(String(turn.serverId), turn)
  for (const row of [...rows].reverse()) {
    if (known.has(String(row.id))) continue
    // Match a locally completed turn only to a server reply created after it.
    // An older identical question/answer is a separate turn and must survive.
    const candidate = conversations.flatMap(item => item.messages).find(turn => turn.serverId == null && turn.status === 'success'
      && turn.question.trim() === row.question.trim() && turn.answer?.trim() === row.answer.trim()
      && Number.isFinite(Date.parse(turn.createdAt)) && Date.parse(row.createdAt) >= Date.parse(turn.createdAt) - 5000)
    if (candidate) {
      candidate.serverId = row.id
      candidate.createdAt = row.createdAt
      known.set(String(row.id), candidate)
      continue
    }
    let imported = conversations.find(item => item.id === 'server-history')
    if (!imported) {
      imported = { id: 'server-history', title: 'Lịch sử từ máy chủ', legacy: true, createdAt: row.createdAt, updatedAt: row.createdAt, messages: [] }
      conversations.push(imported)
    }
    const turn = { id: `saved-${row.id}`, serverId: row.id, question: row.question, answer: row.answer, createdAt: row.createdAt, status: 'success' }
    imported.messages.push(turn)
    imported.messages.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || String(a.serverId).localeCompare(String(b.serverId), undefined, { numeric: true }))
    if (Date.parse(row.createdAt) > Date.parse(imported.updatedAt)) imported.updatedAt = row.createdAt
    known.set(String(row.id), turn)
  }
  return { ...workspace, conversations }
}

export function readMemberConversations(storage, account) {
  const raw = storage.getItem(conversationStorageKey(account))
  if (!raw) return []
  const data = JSON.parse(raw)
  if (data?.version !== 1 || !Array.isArray(data.conversations) || data.conversations.some(item => typeof item.id !== 'string'
    || typeof item.title !== 'string' || !Array.isArray(item.messages) || item.messages.some(turn => typeof turn.id !== 'string'
      || typeof turn.question !== 'string' || !['pending', 'success', 'error'].includes(turn.status)
      || (turn.status === 'success' && typeof turn.answer !== 'string')))) throw new Error('Invalid saved conversations')
  return data.conversations.map(item => ({ ...item, messages: item.messages.map(turn => turn.status === 'pending'
    ? { ...turn, status: 'error', error: 'Yêu cầu trước đã bị gián đoạn. Kiểm tra lịch sử trên máy chủ trước khi gửi lại.' } : turn) }))
}

export function writeMemberConversations(storage, account, conversations) {
  storage.setItem(conversationStorageKey(account), JSON.stringify({ version: 1, conversations }))
}

export function visibleMemberConversations(workspace) {
  return workspace.conversations.filter(item => item.messages.length || item.id === workspace.activeId)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}
