import { LoaderCircle, MessageSquare, Plus, RefreshCw } from 'lucide-react'
import { memberAiHistoryDate } from '../../utils/memberAiHistory'
import { visibleMemberConversations } from '../../utils/memberAiConversations'

export default function MemberAiConversationSidebar({ workspace, history, disabled, storageError, onSelect, onNew }) {
  const conversations = visibleMemberConversations(workspace)
  const hasMore = history.data && history.data.page * history.pageSize < history.data.total
  return <aside className="member-ai-conversation-sidebar" aria-label="Lịch sử cuộc trò chuyện AI">
    <button type="button" className="member-ai-new-conversation" disabled={disabled} onClick={onNew}><Plus size={17} />Cuộc trò chuyện mới</button>
    <div className="member-ai-sidebar-heading"><h3>Cuộc trò chuyện</h3><button type="button" aria-label="Tải lại lịch sử từ máy chủ" disabled={disabled || history.loading} onClick={history.latest}><RefreshCw size={15} /></button></div>
    <nav className="member-ai-conversation-list" aria-label="Chọn cuộc trò chuyện">{conversations.map(item => <button type="button" key={item.id} className={item.id === workspace.activeId ? 'is-active' : ''} aria-current={item.id === workspace.activeId ? 'true' : undefined} disabled={disabled} onClick={() => onSelect(item.id)} title={item.title}>
      <MessageSquare size={15} /><span><strong>{item.title}</strong><small>{item.messages.length ? `${item.messages.length} lượt · ${memberAiHistoryDate(item.updatedAt)}` : 'Bắt đầu trao đổi mới'}</small></span>
    </button>)}</nav>
    {history.loading && <p className="member-ai-sidebar-status" role="status"><LoaderCircle size={14} className="member-spin" />Đang tải lịch sử...</p>}
    {history.error && <div className="member-ai-sidebar-error" role="alert"><p>{history.error}</p><button type="button" disabled={disabled || history.loading} onClick={history.reload}>Thử lại</button></div>}
    {hasMore && <button type="button" className="member-ai-load-history" disabled={disabled || history.loading} onClick={() => history.setPage(history.page + 1)}>Tải lịch sử cũ hơn</button>}
    {storageError && <p className="member-ai-sidebar-error" role="status">{storageError}</p>}
    <p className="member-ai-sidebar-note">Danh sách cuộc trò chuyện được lưu riêng cho tài khoản trên trình duyệt này.</p>
  </aside>
}
