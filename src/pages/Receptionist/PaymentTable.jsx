import { useLayoutEffect, useRef } from 'react'
import { Eye, ReceiptText, WalletCards } from 'lucide-react'
import { ReceptionistList } from './ReceptionistPagination'
import { EmptyState, formatDateTime } from './ReceptionistViewShared'
import { paymentStatusLabel } from '../../utils/memberPayments'
import { receptionistPaymentMethodLabel } from '../../utils/receptionistPayments'
import '../../style/Receptionist/PaymentTable.css'

function TableLayout({ rows, pagination, resetKey, loading }) {
  const scroll = useRef(null)
  const firstOrdinal = rows[0]?.props['data-stt']
  useLayoutEffect(() => { if (scroll.current) scroll.current.scrollTop = 0 }, [firstOrdinal, resetKey])
  return <div className="reception-paged-table">
    <div ref={scroll} className="reception-table-scroll reception-payment-table-scroll" role="region" aria-label="Thanh toán, có thể cuộn" tabIndex={0} aria-busy={loading}>
      <div className="reception-table-heading reception-numbered-heading"><span>STT</span><span>Mã giao dịch / đơn</span><span>Hội viên</span><span>Đăng ký gói</span><span>Số tiền / phương thức</span><span>Trạng thái / thao tác</span></div>
      {rows.length ? rows : <EmptyState icon={ReceiptText} title={loading ? 'Đang tải thanh toán' : 'Chưa có kết quả'} text={loading ? 'Đang cập nhật đơn đăng ký và giao dịch thanh toán.' : 'Không có đơn hoặc giao dịch phù hợp. Hãy kiểm tra bộ lọc.'} />}
    </div>
    {pagination}
  </div>
}

export default function PaymentTable({ rows, loading = false, collectingDisabled = false, onCollect, onView, resetKey = '' }) {
  return <ReceptionistList items={rows} label="Thanh toán" resetKey={resetKey} table renderLayout={(visible, pagination) =>
    <TableLayout rows={visible} pagination={pagination} resetKey={resetKey} loading={loading} />
  }>{row => {
    const order = row.kind === 'order' ? row.order : null
    const record = order || row.payment
    return <div key={row.key} className="reception-table-row reception-payment-record" data-order-id={order?.id} data-payment-id={row.payment?.id}>
      <span><strong>{order ? `#SUB-${order.id}` : `#${record.id}`}</strong><small>{formatDateTime(record.createdAt)}</small></span>
      <span><strong>{record.memberName || `#${record.memberId}`}</strong>{(record.memberPhone || record.memberEmail) && <small>{record.memberPhone || record.memberEmail}</small>}</span>
      <span>{record.packageName || (record.subscriptionId ? `#SUB-${record.subscriptionId}` : 'Không có')}
        {order ? <small>{order.durationInDays} ngày</small> : record.packageName && record.subscriptionId && <small>Đơn #SUB-{record.subscriptionId}</small>}</span>
      <span>{Number((order ? order.agreedPrice : record.amount) || 0).toLocaleString('vi-VN')} đ<small>{order ? 'Chọn phương thức khi thu tiền' : receptionistPaymentMethodLabel(record.paymentMethod)}</small></span>
      <span className="reception-payment-record-state"><b className={`reception-payment-status ${row.status}`}>{order ? 'Chờ thanh toán tại quầy' : row.status === 'cancelled' ? 'Giao dịch đã hủy' : paymentStatusLabel(record)}</b>
        {order ? (order.blockedReason ? <small className="reception-payment-record-blocked">{order.blockedReason}</small>
          : <button type="button" className="reception-primary-button" disabled={collectingDisabled || loading} onClick={() => onCollect(order)} aria-label={`Thu tiền đơn đăng ký ${order.id}`}><WalletCards size={14} />Thu tiền</button>)
          : <button type="button" onClick={() => onView(record.id)} aria-label={`Xem thanh toán ${record.id}`}><Eye size={14} />Chi tiết</button>}
        {row.retryOrder && !row.retryOrder.blockedReason && <button type="button" disabled={collectingDisabled || loading} onClick={() => onCollect(row.retryOrder)} aria-label={`Thanh toán lại đơn đăng ký ${row.retryOrder.id}`}><WalletCards size={14} />Thanh toán lại</button>}
      </span>
    </div>
  }}</ReceptionistList>
}
