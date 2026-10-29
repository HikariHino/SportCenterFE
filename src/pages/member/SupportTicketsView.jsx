import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Headset, LoaderCircle, MessageSquare, Plus, RefreshCw, Send, X } from 'lucide-react'
import { createSupportTicket, getMySupportTickets, getTicketErrorMessage } from '../../services/supportTicketService'
import '../../style/member/SupportTicketsView.css'

const PAGE_SIZE = 8
const statuses = { open: 'Chờ tiếp nhận', inprogress: 'Đang xử lý', resolved: 'Đã giải quyết', closed: 'Đã đóng' }
const priorities = { Low: 'Thấp', Normal: 'Bình thường', High: 'Cao', Urgent: 'Khẩn cấp' }
const statusKey = value => String(value || '').toLowerCase()

function formatDate(value) {
  if (!value) return 'Chưa cập nhật'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Chưa cập nhật' : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function CreateTicketDialog({ onClose, onCreated }) {
  const dialogRef = useRef(null)
  const openerRef = useRef(null)
  const locked = useRef(false)
  const mounted = useRef(true)
  const [form, setForm] = useState({ title: '', description: '', priority: 'Normal' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    mounted.current = true
    const dialog = dialogRef.current
    if (!openerRef.current) openerRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    dialog.querySelector('#member-support-title')?.focus({ preventScroll: true })
    return () => {
      mounted.current = false
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (openerRef.current?.isConnected) openerRef.current.focus({ preventScroll: true })
    }
  }, [])

  const submit = async event => {
    event.preventDefault()
    if (locked.current) return
    if (!form.title.trim() || !form.description.trim()) {
      setError('Vui lòng nhập tiêu đề và nội dung yêu cầu hỗ trợ.')
      return
    }
    locked.current = true
    setSaving(true)
    setError('')
    try {
      await createSupportTicket(form)
      if (mounted.current) onCreated()
    } catch (requestError) {
      if (mounted.current) setError(getTicketErrorMessage(requestError, 'Không thể gửi phiếu hỗ trợ. Vui lòng thử lại.'))
    } finally {
      locked.current = false
      if (mounted.current) setSaving(false)
    }
  }

  return <dialog className="member-support-dialog" ref={dialogRef} aria-labelledby="member-support-create-title" aria-describedby="member-support-create-description" onCancel={event => { event.preventDefault(); if (!locked.current) onClose() }}>
    <form onSubmit={submit} aria-busy={saving}>
      <header className="member-support-dialog-header">
        <span className="member-support-dialog-icon"><Headset size={22} /></span>
        <div><h2 id="member-support-create-title">Gửi yêu cầu hỗ trợ</h2><p id="member-support-create-description" className="member-support-muted">Chia sẻ thắc mắc hoặc sự cố để trung tâm hỗ trợ bạn.</p></div>
        <button type="button" className="member-support-dialog-close" aria-label="Đóng biểu mẫu" disabled={saving} onClick={onClose}><X size={20} /></button>
      </header>
      <div className="member-support-dialog-body">
        <div className="member-support-dialog-fields">
          <div className="member-support-field">
            <label htmlFor="member-support-title">Tiêu đề yêu cầu <span aria-hidden="true">*</span></label>
            <input id="member-support-title" type="text" required maxLength={200} disabled={saving} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Ví dụ: Cần kiểm tra gói tập" aria-describedby="member-support-title-count" />
            <small id="member-support-title-count">{form.title.length}/200 ký tự</small>
          </div>
          <div className="member-support-field">
            <label htmlFor="member-support-priority">Mức độ ưu tiên</label>
            <select id="member-support-priority" disabled={saving} value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value })}>
              {Object.entries(priorities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>
        <div className="member-support-field">
          <label htmlFor="member-support-description">Nội dung chi tiết <span aria-hidden="true">*</span></label>
          <textarea id="member-support-description" required rows={5} disabled={saving} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Mô tả vấn đề, thời gian xảy ra và thông tin liên quan..." />
        </div>
        {error && <p className="member-support-error" role="alert">{error}</p>}
      </div>
      <footer><button type="button" disabled={saving} onClick={onClose}>Đóng</button><button className="primary" type="submit" disabled={saving}>{saving ? <><LoaderCircle className="member-spin" size={16} /> Đang gửi...</> : <><Send size={16} /> Gửi yêu cầu</>}</button></footer>
    </form>
  </dialog>
}

function TicketCard({ ticket }) {
  const status = statusKey(ticket.status)
  const priority = Object.entries(priorities).find(([key]) => key.toLowerCase() === statusKey(ticket.priority))?.[1] || ticket.priority || 'Chưa cập nhật'
  const tone = Object.hasOwn(statuses, status) ? status : 'unknown'
  return <article className="member-support-card" aria-labelledby={`member-support-ticket-${ticket.id}`}>
    <header><span className="member-support-muted">Phiếu #{ticket.id}</span><span className={`member-support-status ${tone}`}>{statuses[status] || ticket.status || 'Chưa cập nhật trạng thái'}</span></header>
    <div className="member-support-ticket-layout">
    <div className="member-support-ticket-content">
    <h3 id={`member-support-ticket-${ticket.id}`}>{ticket.title || 'Yêu cầu hỗ trợ'}</h3>
    <p className="member-support-description">{ticket.description || 'Chưa có nội dung'}</p>
    <dl className="member-support-meta">
      <div><dt>Mức độ ưu tiên</dt><dd>{priority}</dd></div>
      <div><dt>Ngày gửi</dt><dd>{formatDate(ticket.createdAt)}</dd></div>
      <div><dt>Người xử lý</dt><dd>{ticket.handledByUserName || 'Chưa cập nhật'}</dd></div>
      {ticket.resolvedAt && <div><dt>Ngày giải quyết</dt><dd>{formatDate(ticket.resolvedAt)}</dd></div>}
    </dl>
    </div>
    <section className="member-support-response" aria-label="Phản hồi từ trung tâm">
      <h4><MessageSquare size={17} /> Phản hồi từ trung tâm</h4>
      {ticket.resolutionNote ? <p>{ticket.resolutionNote}</p> : <p className="member-support-muted">Chưa có phản hồi từ trung tâm.</p>}
    </section>
    </div>
  </article>
}

export function SupportTicketsView() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState('')
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const reload = () => setRevision(value => value + 1)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    getMySupportTickets().then(data => {
      if (active) setTickets([...data].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)))
    }).catch(requestError => {
      if (active) setError(getTicketErrorMessage(requestError, 'Không thể tải danh sách phiếu hỗ trợ.'))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [revision])

  const query = search.trim().toLocaleLowerCase('vi')
  const filtered = tickets.filter(ticket => (status === 'all' || statusKey(ticket.status) === status)
    && (!query || `${ticket.id} ${ticket.title || ''} ${ticket.description || ''} ${ticket.resolutionNote || ''}`.toLocaleLowerCase('vi').includes(query)))
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const created = () => {
    setCreating(false)
    setNotice('Đã gửi yêu cầu hỗ trợ thành công. Bạn có thể theo dõi trạng thái và phản hồi tại đây.')
    setSearch('')
    setStatus('all')
    setPage(1)
    reload()
  }

  return <div className="member-view-stack member-support-view">
    <div className="member-section-heading">
      <div><p className="member-eyebrow"><Headset size={16} /> HỖ TRỢ HỘI VIÊN</p><h2>Hỗ trợ khách hàng</h2><p className="member-support-muted">Gửi thắc mắc, phản ánh sự cố và theo dõi kết quả xử lý từ trung tâm.</p></div>
      <button className="primary" type="button" onClick={() => { setNotice(''); setCreating(true) }}><Plus size={16} /> Gửi yêu cầu mới</button>
    </div>
    {notice && <p className="member-support-notice" role="status"><CheckCircle2 size={18} />{notice}</p>}
    <div className="member-support-toolbar">
      <label>Tìm phiếu hỗ trợ<input type="search" placeholder="Mã phiếu, tiêu đề hoặc nội dung..." value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></label>
      <label>Trạng thái<select value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="all">Tất cả trạng thái</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button type="button" disabled={loading} onClick={reload}><RefreshCw size={16} /> Làm mới</button>
    </div>
    <section aria-label="Phiếu hỗ trợ của tôi" aria-busy={loading}>
      {loading ? <div className="member-support-state" role="status"><LoaderCircle className="member-spin" size={28} /><p>Đang tải phiếu hỗ trợ...</p></div>
        : error ? <div className="member-support-state member-support-error" role="alert"><AlertCircle size={28} /><h3>Không thể tải phiếu hỗ trợ</h3><p>{error}</p><button type="button" onClick={reload}>Thử lại</button></div>
          : !filtered.length ? <div className="member-support-state" role="status"><MessageSquare size={34} /><h3>{tickets.length ? 'Không tìm thấy phiếu phù hợp' : 'Bạn chưa có phiếu hỗ trợ'}</h3><p>{tickets.length ? 'Thử thay đổi từ khóa hoặc trạng thái để xem các phiếu khác.' : 'Gửi yêu cầu mới khi bạn cần trợ giúp hoặc muốn phản ánh sự cố.'}</p></div>
            : <>
              <div className="member-support-list-heading"><p className="member-support-count">{filtered.length} phiếu hỗ trợ</p><span>Mới nhất trước</span></div>
              <div className="member-support-list">{visible.map(ticket => <TicketCard key={ticket.id} ticket={ticket} />)}</div>
              {totalPages > 1 && <nav className="member-support-pagination" aria-label="Phân trang phiếu hỗ trợ"><span>Trang {currentPage}/{totalPages}</span><div><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={15} /> Trang trước</button><button type="button" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Trang sau <ChevronRight size={15} /></button></div></nav>}
            </>}
    </section>
    {creating && <CreateTicketDialog onClose={() => setCreating(false)} onCreated={created} />}
  </div>
}
