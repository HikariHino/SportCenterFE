import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowUpRight, Bot, CalendarDays, CreditCard, Dumbbell, LoaderCircle, RotateCcw, Send, Sparkles, Square, Trash2, User } from 'lucide-react'
import { AI_QUESTION_MAX_LENGTH, askMemberAi, getMemberAiErrorMessage } from '../../services/memberAiService'
import '../../style/member/MemberAiChat.css'
import MemberAiAnswer from './MemberAiAnswer'

const suggestions = [
  { icon: CreditCard, title: 'Gói tập còn hạn không?', question: 'Gói tập của tôi còn hiệu lực không và hết hạn khi nào?' },
  { icon: CalendarDays, title: 'Lịch học sắp tới', question: 'Cho tôi biết lịch học đã đăng ký sắp tới và huấn luyện viên của từng buổi.' },
  { icon: Dumbbell, title: 'Cách khởi động', question: 'Tôi mới bắt đầu tập gym. Tôi nên khởi động như thế nào trước buổi tập?' },
]

export default function MemberAiChat({ active, onNavigate }) {
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const requestRef = useRef(null)
  const nextId = useRef(0)
  const conversationRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => () => {
    const request = requestRef.current
    requestRef.current = null
    request?.controller.abort()
  }, [])

  useEffect(() => {
    const conversation = conversationRef.current
    if (!active || !conversation) return
    const answer = conversation.querySelector('.member-ai-turn:last-child .member-ai-answer')
    const response = answer?.closest('.member-ai-message')
    const top = response
      ? conversation.scrollTop + response.getBoundingClientRect().top - conversation.getBoundingClientRect().top - 12
      : messages.length ? conversation.scrollHeight : 0
    conversation.scrollTo({ top })
  }, [active, messages, sending])

  const send = async (question, retryId) => {
    const text = question.trim()
    if (!text || text.length > AI_QUESTION_MAX_LENGTH || requestRef.current) return
    const id = retryId ?? ++nextId.current
    const request = { controller: new AbortController() }
    requestRef.current = request
    setSending(true)
    if (retryId != null) setMessages(previous => previous.map(item => item.id === id ? { ...item, status: 'pending', error: '' } : item))
    else {
      setMessages(previous => [...previous, { id, question: text, status: 'pending' }])
      setDraft('')
    }
    try {
      const answer = await askMemberAi(text, { signal: request.controller.signal })
      if (requestRef.current !== request) return
      setMessages(previous => previous.map(item => item.id === id ? { ...item, status: 'success', answer } : item))
    } catch (error) {
      if (requestRef.current !== request) return
      const message = request.controller.signal.aborted ? 'Đã dừng chờ câu trả lời. Bạn có thể gửi lại câu hỏi.' : getMemberAiErrorMessage(error)
      setMessages(previous => previous.map(item => item.id === id ? { ...item, status: 'error', error: message } : item))
    } finally {
      if (requestRef.current === request) {
        requestRef.current = null
        setSending(false)
        inputRef.current?.focus({ preventScroll: true })
      }
    }
  }

  const submit = event => { event.preventDefault(); send(draft) }

  return (
    <div className="member-ai">
      <div className="member-ai-heading">
        <div>
          <h2>Trợ lý AI</h2>
          <p className="member-muted">Hỏi về tập luyện, gói tập và lịch học của bạn.</p>
        </div>
        <span className="member-ai-heading-tag"><Sparkles size={13} /> Dành cho hội viên</span>
      </div>

        <section className="member-ai-chat" aria-label="Trao đổi với trợ lý AI">
          <header className="member-ai-chat-header">
            <span className="member-ai-avatar"><Bot size={19} /></span>
            <div><h3>SportPulse AI</h3><p>Hỗ trợ tra cứu & tư vấn</p></div>
            <button type="button" className="member-ai-clear" disabled={sending || !messages.length} onClick={() => { setMessages([]); inputRef.current?.focus() }}>
              <Trash2 size={15} /><span>Xóa nội dung</span>
            </button>
          </header>

          <div ref={conversationRef} className="member-ai-conversation" role="log" aria-label="Nội dung trao đổi" aria-live="polite" aria-relevant="additions text">
            {!messages.length && (
              <div className="member-ai-welcome">
                <span className="member-ai-welcome-icon"><Sparkles size={24} /></span>
                <h3>Bạn cần hỗ trợ gì hôm nay?</h3>
                <p>Chọn gợi ý hoặc nhập câu hỏi bên dưới.</p>
                <div className="member-ai-suggestions">
                  {suggestions.map(({ icon: Icon, title, question }) => (
                    <button type="button" key={title} title={question} onClick={() => send(question)} disabled={sending}>
                      <Icon size={16} /><span>{title}</span><ArrowUpRight size={14} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map(item => (
              <div className="member-ai-turn" key={item.id}>
                <article className="member-ai-message member-ai-message--user" aria-label="Câu hỏi của bạn">
                  <span className="member-ai-avatar"><User size={18} /></span>
                  <div><strong>Bạn</strong><p>{item.question}</p></div>
                </article>
                <article className="member-ai-message member-ai-message--assistant" aria-label="Phản hồi của trợ lý AI">
                  <span className="member-ai-avatar"><Bot size={18} /></span>
                  <div>
                    <strong>SportPulse AI</strong>
                    {item.status === 'pending' && <p className="member-ai-pending" role="status"><LoaderCircle size={16} className="member-spin" /> Đang tìm câu trả lời...</p>}
                    {item.status === 'success' && <MemberAiAnswer answer={item.answer} />}
                    {item.status === 'error' && <div className="member-ai-error" role="alert"><p><AlertCircle size={16} /> {item.error}</p><button type="button" className="member-button" disabled={sending} onClick={() => send(item.question, item.id)}><RotateCcw size={14} /> Thử lại</button></div>}
                  </div>
                </article>
              </div>
            ))}
          </div>

          <form className="member-ai-composer" onSubmit={submit} aria-busy={sending}>
            <label htmlFor="member-ai-question">Câu hỏi của bạn</label>
            <div className="member-ai-input-wrap">
              <textarea id="member-ai-question" ref={inputRef} value={draft} maxLength={AI_QUESTION_MAX_LENGTH} rows={2} disabled={sending}
                placeholder="Nhập câu hỏi của bạn..."
                aria-describedby="member-ai-context-hint member-ai-input-hint member-ai-counter"
                onChange={event => setDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); send(draft) }
                }} />
              {sending ? <button type="button" className="member-button member-ai-send" aria-label="Dừng chờ" title="Dừng chờ" onClick={() => requestRef.current?.controller.abort()}><Square size={16} /></button>
                : <button type="submit" className="member-button member-button--primary member-ai-send" aria-label="Gửi câu hỏi" title="Gửi câu hỏi" disabled={!draft.trim()}><Send size={17} /></button>}
            </div>
            <div className="member-ai-composer-hint"><span id="member-ai-input-hint">Enter để gửi · Shift + Enter để xuống dòng</span><span id="member-ai-counter">{draft.length}/{AI_QUESTION_MAX_LENGTH}</span></div>
            <p id="member-ai-context-hint" className="member-ai-context-hint">Mỗi câu hỏi được trả lời độc lập. Hãy cung cấp đủ thông tin cần thiết.</p>
          </form>
        </section>

        <nav className="member-ai-shortcuts" aria-label="Truy cập nhanh">
          <button type="button" onClick={() => onNavigate('subscriptions')}><CreditCard size={14} /> Gói tập <ArrowUpRight size={12} /></button>
          <button type="button" onClick={() => onNavigate('classes')}><CalendarDays size={14} /> Lịch học <ArrowUpRight size={12} /></button>
          <button type="button" onClick={() => onNavigate('support')}><AlertCircle size={14} /> Hỗ trợ <ArrowUpRight size={12} /></button>
        </nav>
    </div>
  )
}
