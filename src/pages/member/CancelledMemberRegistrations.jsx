import { MemberList } from './MemberPagination'
import { useState } from 'react'
import { CalendarX2 } from 'lucide-react'
import { formatClassDateTime } from './MemberSessionDetails'

import { LIST_PAGE_SIZE as PAGE_SIZE } from '../../utils/listPagination'

export default function CancelledMemberRegistrations({ items, onSelect }) {
  const [requestedPage, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const page = Math.min(requestedPage, pages)
  const visible = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return <details className="member-cancelled-registrations">
    <summary><span><CalendarX2 size={18} aria-hidden="true" />Lịch đã hủy</span><span className="member-cancelled-count">{items.length} buổi</span></summary>
    <div className="member-cancelled-body">
      <p>Các buổi do bạn hoặc trung tâm hủy ở tất cả các tuần. Chọn một buổi để xem chi tiết.</p>
      {items.length ? <>
        <MemberList items={visible} total={items.length} page={page} onPageChange={setPage} label="Lịch đã hủy" as="ul" className="member-cancelled-list">{item => <li key={item.id}>
          <div><small>Đăng ký #{item.id} · Đã hủy</small><h4>{item.className || `Buổi học #${item.sessionId || item.id}`}</h4><p>{formatClassDateTime(item.startsAt)} – {formatClassDateTime(item.endsAt)}</p><p className="member-cancelled-reason">Lý do hủy: {item.cancellationReason?.trim() || 'Chưa cập nhật'}</p></div>
          <button type="button" onClick={() => onSelect(item.id)} aria-label={`Xem chi tiết đăng ký đã hủy #${item.id}`}>Xem chi tiết</button>
        </li>}</MemberList>

      </> : <p role="status">Bạn chưa có lịch học nào bị hủy.</p>}
    </div>
  </details>
}
