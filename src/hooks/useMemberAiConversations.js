import { useEffect, useState } from 'react'
import { appendMemberChatTurn, conversationViewKey, importMemberChatHistory, initializeMemberConversations, newMemberConversation, readMemberConversations, updateMemberChatTurn, writeMemberConversations } from '../utils/memberAiConversations'

export default function useMemberAiConversations(account, loginId, serverRows) {
  const [initial] = useState(() => {
    try {
      const saved = account ? readMemberConversations(localStorage, account) : []
      let view = null
      try { view = account ? JSON.parse(sessionStorage.getItem(conversationViewKey(account)) || 'null') : null } catch { /* A stale tab selection must not hide valid saved conversations. */ }
      return { workspace: initializeMemberConversations(saved, view, loginId), error: '' }
    } catch {
      return { workspace: initializeMemberConversations([], null, loginId), error: 'Chưa đọc được danh sách cuộc trò chuyện trên trình duyệt. Bạn vẫn có thể tải lịch sử từ máy chủ.' }
    }
  })
  const [workspace, setWorkspace] = useState(initial.workspace)
  const [storageError, setStorageError] = useState(initial.error)
  useEffect(() => {
    if (!account || initial.error) return
    try {
      writeMemberConversations(localStorage, account, workspace.conversations)
      sessionStorage.setItem(conversationViewKey(account), JSON.stringify({ loginId, activeId: workspace.activeId }))
      setStorageError('')
    } catch {
      setStorageError('Chưa lưu được các cuộc trò chuyện trên trình duyệt. Các lượt đã gửi thành công vẫn được lưu trên máy chủ.')
    }
  }, [account, loginId, workspace, initial.error])
  useEffect(() => {
    if (serverRows?.length) setWorkspace(previous => importMemberChatHistory(previous, serverRows))
  }, [serverRows])
  return {
    workspace, storageError,
    select: id => setWorkspace(previous => previous.conversations.some(item => item.id === id) ? { ...previous, activeId: id } : previous),
    start: () => setWorkspace(previous => newMemberConversation(previous)),
    append: (id, turn) => setWorkspace(previous => appendMemberChatTurn(previous, id, turn)),
    update: (id, turnId, patch) => setWorkspace(previous => updateMemberChatTurn(previous, id, turnId, patch)),
    clear: () => setWorkspace(initializeMemberConversations([], null, loginId)),
  }
}
