import { useEffect, useState } from 'react'
import { LifeBuoy, MessageSquareText, RefreshCw } from 'lucide-react'
import { getAllSupportTickets, getTicketErrorMessage } from '../../services/supportTicketService'
import { EmptyState, formatDateTime } from './ReceptionistViewShared'

const statusLabel = status => ({ Open: 'Đang mở', InProgress: 'Đang xử lý', Resolved: 'Đã giải quyết', Closed: 'Đã đóng' })[status] || status
const priorityLabel = priority => ({ Low: 'Thấp', Normal: 'Bình thường', High: 'Cao', Urgent: 'Khẩn cấp' })[priority] || priority

export function SupportTicketsView({ query }) {
  const [tickets, setTickets] = useState([])
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)

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

  return <section className="reception-card reception-support-card">
    <div className="reception-card-head"><div><span>SUPPORT TICKETS API</span><h2>Phiếu hỗ trợ hội viên</h2></div><button type="button" onClick={() => setRequestKey(key => key + 1)} disabled={loading}><RefreshCw size={14} />{loading ? 'Đang tải...' : 'Làm mới'}</button></div>
    <div className="reception-support-toolbar"><div>{[['all', 'Tất cả'], ['Open', 'Đang mở'], ['InProgress', 'Đang xử lý'], ['Resolved', 'Đã giải quyết'], ['Closed', 'Đã đóng']].map(([value, label]) => <button type="button" key={value} className={status === value ? 'active' : ''} onClick={() => setStatus(value)}>{label}</button>)}</div><strong>{loading ? 'Đang đồng bộ' : `${filtered.length} phiếu`}</strong></div>
    {loading ? <EmptyState icon={LifeBuoy} title="Đang tải phiếu hỗ trợ" text="Dữ liệu đang được đồng bộ từ SupportTickets API." /> : error ? <div className="reception-inline-error"><EmptyState icon={LifeBuoy} title="Không thể tải phiếu hỗ trợ" text={error} /><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : filtered.length ? <div className="reception-support-list">{filtered.map(ticket => <article key={ticket.id}><span className={`priority ${String(ticket.priority || '').toLowerCase()}`}><MessageSquareText size={18} /></span><div><header><span>#{ticket.id} · {ticket.memberName}</span><b className={String(ticket.status || '').toLowerCase()}>{statusLabel(ticket.status)}</b></header><h3>{ticket.title}</h3><p>{ticket.description}</p><footer><span>Ưu tiên: <strong>{priorityLabel(ticket.priority)}</strong></span><span>Tạo lúc {formatDateTime(ticket.createdAt)}</span>{ticket.handledByUserName && <span>Xử lý bởi {ticket.handledByUserName}</span>}</footer>{ticket.resolutionNote && <blockquote>{ticket.resolutionNote}</blockquote>}</div></article>)}</div> : <EmptyState icon={LifeBuoy} title="Chưa có phiếu hỗ trợ" text={query ? 'Không có phiếu phù hợp với nội dung tìm kiếm.' : 'Không có phiếu hỗ trợ theo trạng thái đã chọn.'} />}
  </section>
}
