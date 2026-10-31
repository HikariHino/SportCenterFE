import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowUpRight, Bot, CalendarDays, CreditCard, Dumbbell, LoaderCircle, RotateCcw, Send, Sparkles, Square, Trash2, User } from 'lucide-react'
import { AI_QUESTION_MAX_LENGTH, askMemberAi, clearMemberAiChatHistory, getMemberAiChatHistory, getMemberAiErrorMessage } from '../../services/memberAiService'
import useMemberAiHistory from '../../hooks/useMemberAiHistory'
import useMemberAiConversations from '../../hooks/useMemberAiConversations'
import { useAuth } from '../../contexts/AuthContext'
import { getLoginSessionId } from '../../utils/auth'
import { memberAiHistoryDate } from '../../utils/memberAiHistory'
import { AiDeleteConfirmation } from './MemberAiHistoryControls'
import MemberAiConversationSidebar from './MemberAiConversationSidebar'
import '../../style/member/MemberAiChat.css'
import MemberAiAnswer from './MemberAiAnswer'

const suggestions = [
  { icon: CreditCard, title: 'Gói tập còn hạn không?', question: 'Gói tập của tôi còn hiệu lực không và hết hạn khi nào?' },
  { icon: CalendarDays, title: 'Lịch học sắp tới', question: 'Cho tôi biết lịch học đã đăng ký sắp tới và huấn luyện viên của từng buổi.' },
  { icon: Dumbbell, title: 'Cách khởi động', question: 'Tôi mới bắt đầu tập gym. Tôi nên khởi động như thế nào trước buổi tập?' },
]

export default function MemberAiChat({ active, onNavigate }) {
  const user = useAuth()?.user
  const account = user ? String(user.userId ?? user.id ?? user.email ?? '') : null
  const loginId = user ? getLoginSessionId() : ''
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState('')
  const clearLock = useRef(false)
  const mounted = useRef(false)
  const history = useMemberAiHistory(getMemberAiChatHistory, active, 20)
  const chat = useMemberAiConversations(account, loginId, history.data?.items)
  const conversation = chat.workspace.conversations.find(item => item.id === chat.workspace.activeId)
  const turns = conversation?.messages || []
  const requestRef = useRef(null)
  const nextId = useRef(0)
  const conversationRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      const request = requestRef.current
      requestRef.current = null
      request?.controller.abort()
    }
  }, [])

  useEffect(() => {
    const conversation = conversationRef.current
    if (!active || !conversation) return
    const turn = conversation.querySelector('.member-ai-turn:last-child')
    const top = turn
      ? conversation.scrollTop + turn.getBoundingClientRect().top - conversation.getBoundingClientRect().top - 12
      : 0
    conversation.scrollTo({ top })
  }, [active, turns, sending])

  useEffect(() => {
    const input = inputRef.current
    if (!active || !input) return
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`
  }, [active, draft])

  const send = async (question, retryId) => {
    const text = question.trim()
    if (!text || text.length > AI_QUESTION_MAX_LENGTH || requestRef.current || clearing || confirmClear || !conversation) return
    const id = retryId ?? `turn-${Date.now()}-${++nextId.current}`
    const conversationId = conversation.id
    const request = { controller: new AbortController(), conversationId }
    requestRef.current = request
    setSending(true)
    if (retryId != null) chat.update(conversationId, id, { status: 'pending', error: '' })
    else {
      chat.append(conversationId, { id, question: text, status: 'pending', createdAt: new Date().toISOString() })
      setDraft('')
    }
    try {
      const answer = await askMemberAi(text, { signal: request.controller.signal })
      if (requestRef.current !== request) return
      chat.update(conversationId, id, { status: 'success', answer })
      history.latest()
    } catch (error) {
      if (requestRef.current !== request) return
      const message = request.controller.signal.aborted ? 'Đã dừng chờ câu trả lời. Bạn có thể gửi lại câu hỏi.' : getMemberAiErrorMessage(error)
      chat.update(conversationId, id, { status: 'error', error: message })
    } finally {
      if (requestRef.current === request) {
        requestRef.current = null
        setSending(false)
        inputRef.current?.focus({ preventScroll: true })
      }
    }
  }

  const submit = event => { event.preventDefault(); send(draft) }
  const clearHistory = async () => {
    if (clearLock.current || requestRef.current) return
    clearLock.current = true
    history.cancel()
    setClearing(true)
    setClearError('')
    try {
      await clearMemberAiChatHistory()
      if (!mounted.current) return
      chat.clear()
      history.clear()
      setConfirmClear(false)
      inputRef.current?.focus()
    } catch (error) {
      if (mounted.current) setClearError(getMemberAiErrorMessage(error))
    } finally {
      clearLock.current = false
      if (mounted.current) setClearing(false)
    }
  }

  return (
    <div className="member-ai member-ai-assistant">
      <div className="member-ai-heading">
        <div>
          <h2>Trợ lý AI</h2>
          <p className="member-muted">Hỏi về tập luyện, gói tập và lịch học của bạn.</p>
        </div>
        <span className="member-ai-heading-tag"><Sparkles size={13} /> Dành cho hội viên</span>
      </div>

      <div className="member-ai-chat-layout">
        <MemberAiConversationSidebar workspace={chat.workspace} history={history} disabled={sending || clearing} storageError={chat.storageError}
          onNew={() => { chat.start(); setDraft(''); inputRef.current?.focus() }} onSelect={id => { chat.select(id); setDraft('') }} />
        <section className="member-ai-chat" aria-label="Trao đổi với trợ lý AI">
          <header className="member-ai-chat-header">
            <span className="member-ai-avatar"><Bot size={19} /></span>
            <div><h3 title={conversation?.title}>{conversation?.title || 'Cuộc trò chuyện mới'}</h3><p>SportPulse AI · Hỗ trợ tra cứu & tư vấn</p></div>
            <button type="button" className="member-ai-clear" aria-label="Xóa tất cả cuộc trò chuyện" title="Xóa tất cả cuộc trò chuyện" disabled={sending || clearing || history.loading || (!chat.workspace.conversations.some(item => item.messages.length) && !history.data?.total)} onClick={() => { setClearError(''); setConfirmClear(true) }}>
              <Trash2 size={15} /><span>Xóa tất cả</span>
            </button>
          </header>

          <div ref={conversationRef} className="member-ai-conversation" role="log" aria-label="Nội dung trao đổi" aria-live="polite" aria-relevant="additions text">
            {!turns.length && (
              <div className="member-ai-welcome">
                <span className="member-ai-welcome-icon"><Sparkles size={24} /></span>
                <h3>Bạn cần hỗ trợ gì hôm nay?</h3>
                <p>Chọn gợi ý hoặc nhập câu hỏi bên dưới.</p>
                <div className="member-ai-suggestions">
                  {suggestions.map(({ icon: Icon, title, question }) => (
                    <button type="button" key={title} title={question} onClick={() => send(question)} disabled={sending || clearing}>
                      <Icon size={16} /><span>{title}</span><ArrowUpRight size={14} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {turns.map(item => (
              <div className="member-ai-turn" key={item.id}>
                <article className="member-ai-message member-ai-message--user" aria-label="Câu hỏi của bạn">
                  <span className="member-ai-avatar"><User size={18} /></span>
                  <div><strong>Bạn{item.createdAt && <time className="member-ai-turn-time"> · {memberAiHistoryDate(item.createdAt)}</time>}</strong><p>{item.question}</p></div>
                </article>
                <article className="member-ai-message member-ai-message--assistant" aria-label="Phản hồi của trợ lý AI">
                  <span className="member-ai-avatar"><Bot size={18} /></span>
                  <div>
                    <strong>SportPulse AI</strong>
                    {item.status === 'pending' && <p className="member-ai-pending" role="status"><LoaderCircle size={16} className="member-spin" /> Đang tìm câu trả lời...</p>}
                    {item.status === 'success' && <MemberAiAnswer answer={item.answer} />}
                    {item.status === 'error' && <div className="member-ai-error" role="alert"><p><AlertCircle size={16} /> {item.error}</p><button type="button" className="member-button" disabled={sending || clearing} onClick={() => send(item.question, item.id)}><RotateCcw size={14} /> Thử lại</button></div>}
                  </div>
                </article>
              </div>
            ))}
          </div>

          <form className="member-ai-composer" onSubmit={submit} aria-busy={sending}>
            <label htmlFor="member-ai-question">Câu hỏi của bạn</label>
            <div className="member-ai-input-wrap">
              <textarea id="member-ai-question" ref={inputRef} value={draft} maxLength={AI_QUESTION_MAX_LENGTH} rows={1} disabled={sending || clearing}
                placeholder="Hỏi SportPulse AI..."
                aria-describedby="member-ai-context-hint member-ai-input-hint member-ai-counter"
                onChange={event => setDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); send(draft) }
                }} />
              {sending ? <button type="button" className="member-button member-ai-send" aria-label="Dừng chờ" title="Dừng chờ" onClick={() => requestRef.current?.controller.abort()}><Square size={16} /></button>
                : <button type="submit" className="member-button member-button--primary member-ai-send" aria-label="Gửi câu hỏi" title="Gửi câu hỏi" disabled={!draft.trim() || clearing}><Send size={17} /></button>}
            </div>
            <div className="member-ai-composer-meta">
              <p id="member-ai-context-hint" className="member-ai-context-hint">Trợ lý có thể tham khảo các lượt trao đổi gần đây.</p>
              <div className="member-ai-composer-hint"><span id="member-ai-input-hint">Enter để gửi · Shift + Enter để xuống dòng</span><span id="member-ai-counter">{draft.length}/{AI_QUESTION_MAX_LENGTH}</span></div>
            </div>
          </form>
        </section>

        <aside className="member-ai-side">
          <nav className="member-ai-shortcuts" aria-label="Truy cập nhanh">
          <h3>Tiện ích hội viên</h3>
          <button type="button" onClick={() => onNavigate('ai-workout')}><Dumbbell size={16} /> Gợi ý bài tập AI <ArrowUpRight size={14} /></button>
          <button type="button" onClick={() => onNavigate('subscriptions')}><CreditCard size={14} /> Gói tập <ArrowUpRight size={12} /></button>
          <button type="button" onClick={() => onNavigate('classes')}><CalendarDays size={14} /> Lịch học <ArrowUpRight size={12} /></button>
          <button type="button" onClick={() => onNavigate('support')}><AlertCircle size={14} /> Hỗ trợ <ArrowUpRight size={12} /></button>
          </nav>
        </aside>
      </div>
      {confirmClear && <AiDeleteConfirmation title="Xóa tất cả cuộc trò chuyện?" busy={clearing} error={clearError} onClose={() => setConfirmClear(false)} onConfirm={clearHistory}><p>Tất cả cuộc trò chuyện và các lượt hỏi đáp đã lưu trên máy chủ của tài khoản này sẽ bị xóa. Thao tác này không thể hoàn tác.</p></AiDeleteConfirmation>}
    </div>
  )
}
