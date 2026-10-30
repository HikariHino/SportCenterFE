import { useEffect, useState } from 'react'
import { CheckCircle2, LifeBuoy, MessageSquareText, RefreshCw, X } from 'lucide-react'
import { getAllSupportTickets, getTicketErrorMessage, resolveSupportTicket } from '../../services/supportTicketService'
import { canUpdateSupportTicket } from '../../utils/supportTickets'
import { EmptyState, formatDateTime, ViewLoader } from './ReceptionistViewShared'

const statusLabel = status => ({ Open: 'Đang mở', InProgress: 'Đang xử lý', Resolved: 'Đã giải quyết', Closed: 'Đã đóng' })[status] || status
const priorityLabel = priority => ({ Low: 'Thấp', Normal: 'Bình thường', High: 'Cao', Urgent: 'Khẩn cấp' })[priority] || priority

export function SupportTicketsView({ query, showNotice }) {
  const [tickets, setTickets] = useState([])
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [resolutionForm, setResolutionForm] = useState({ status: 'InProgress', resolutionNote: '' })
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    let active = true
    const loadTickets = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getAllSupportTickets(status)
        if (active) setTickets(result)
      } catch (requestError) {
        if (active) {
          setTickets([])
          setError(getTicketErrorMessage(requestError, 'Không thể tải danh sách phiếu hỗ trợ.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadTickets()
    return () => { active = false }
  }, [requestKey, status])

  const normalizedQuery = query.trim().toLocaleLowerCase('vi')
  const filtered = tickets.filter(ticket => !normalizedQuery || `${ticket.id} ${ticket.title} ${ticket.description} ${ticket.memberName} ${ticket.status} ${ticket.priority}`.toLocaleLowerCase('vi').includes(normalizedQuery))

  const openResolution = ticket => {
    if (!canUpdateSupportTicket(ticket)) {
      showNotice?.(`Phiếu hỗ trợ #${ticket.id} đã đóng và không thể cập nhật.`)
      return
    }
    setSelectedTicket(ticket)
    setResolutionForm({ status: ticket.status === 'Open' ? 'InProgress' : ticket.status, resolutionNote: ticket.resolutionNote || '' })
    setActionError('')
  }

  const submitResolution = async event => {
    event.preventDefault()
    if (!selectedTicket || !canUpdateSupportTicket(selectedTicket)) {
      setActionError('Phiếu đã đóng và không thể cập nhật thêm.')
      return
    }
    setSaving(true)
    setActionError('')
    try {
      const ticketId = selectedTicket.id
      await resolveSupportTicket(ticketId, resolutionForm)
      setSelectedTicket(null)
      // The update response may only acknowledge success; reload the saved status and active filter.
      setRequestKey(key => key + 1)
      showNotice?.(`Đã cập nhật phiếu hỗ trợ #${ticketId}.`)
    } catch (requestError) {
      setActionError(getTicketErrorMessage(requestError, 'Không thể cập nhật phiếu hỗ trợ.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <ViewLoader />

  return <section className="reception-card reception-support-card">
    <div className="reception-card-head"><div><span>QUẢN LÝ PHIẾU HỖ TRỢ</span><h2>Phiếu hỗ trợ hội viên</h2></div><button type="button" onClick={() => setRequestKey(key => key + 1)} disabled={loading}><RefreshCw size={14} />{loading ? 'Đang tải...' : 'Làm mới'}</button></div>
    <div className="reception-support-toolbar"><div>{[['all', 'Tất cả'], ['Open', 'Đang mở'], ['InProgress', 'Đang xử lý'], ['Resolved', 'Đã giải quyết'], ['Closed', 'Đã đóng']].map(([value, label]) => <button type="button" key={value} className={status === value ? 'active' : ''} onClick={() => setStatus(value)}>{label}</button>)}</div><strong>{loading ? 'Đang đồng bộ' : `${filtered.length} phiếu`}</strong></div>
    {loading ? <EmptyState icon={LifeBuoy} title="Đang tải phiếu hỗ trợ" text="Dữ liệu hỗ trợ đang được đồng bộ từ hệ thống." /> : error ? <div className="reception-inline-error"><EmptyState icon={LifeBuoy} title="Không thể tải phiếu hỗ trợ" text={error} /><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : filtered.length ? <div className="reception-support-list">{filtered.map(ticket => <article key={ticket.id}><span className={`priority ${String(ticket.priority || '').toLowerCase()}`}><MessageSquareText size={18} /></span><div><header><span>#{ticket.id} · {ticket.memberName}</span><b className={String(ticket.status || '').toLowerCase()}>{statusLabel(ticket.status)}</b></header><h3>{ticket.title}</h3><p>{ticket.description}</p><footer><span>Ưu tiên: <strong>{priorityLabel(ticket.priority)}</strong></span><span>Tạo lúc {formatDateTime(ticket.createdAt)}</span>{ticket.handledByUserName && <span>Xử lý bởi {ticket.handledByUserName}</span>}</footer>{ticket.resolutionNote && <blockquote>{ticket.resolutionNote}</blockquote>}{canUpdateSupportTicket(ticket) && <button className="reception-support-action" type="button" onClick={() => openResolution(ticket)}><CheckCircle2 size={14} />{ticket.status === 'Open' ? 'Nhận xử lý' : 'Cập nhật phiếu'}</button>}</div></article>)}</div> : <EmptyState icon={LifeBuoy} title="Chưa có phiếu hỗ trợ" text={query ? 'Không có phiếu phù hợp với nội dung tìm kiếm.' : 'Không có phiếu hỗ trợ theo trạng thái đã chọn.'} />}
    {selectedTicket && <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setSelectedTicket(null) }}><section className="reception-dialog reception-support-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-support-dialog-title"><header><div><span>PHIẾU #{selectedTicket.id}</span><h2 id="reception-support-dialog-title">Cập nhật trạng thái hỗ trợ</h2><p>{selectedTicket.memberName} · {selectedTicket.title}</p></div><button type="button" aria-label="Đóng" onClick={() => setSelectedTicket(null)} disabled={saving}><X size={18} /></button></header><form onSubmit={submitResolution}><label>Trạng thái<select value={resolutionForm.status} onChange={event => setResolutionForm(current => ({ ...current, status: event.target.value }))}><option value="Open">Đang mở</option><option value="InProgress">Đang xử lý</option><option value="Resolved">Đã giải quyết</option><option value="Closed">Đã đóng</option></select></label><label>Ghi chú phản hồi<textarea rows="5" value={resolutionForm.resolutionNote} onChange={event => setResolutionForm(current => ({ ...current, resolutionNote: event.target.value }))} placeholder="Nội dung xử lý hoặc hướng dẫn dành cho hội viên" /></label>{actionError && <p role="alert">{actionError}</p>}<footer><button type="button" onClick={() => setSelectedTicket(null)} disabled={saving}>Hủy</button><button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu cập nhật'}</button></footer></form></section></div>}
  </section>
}
