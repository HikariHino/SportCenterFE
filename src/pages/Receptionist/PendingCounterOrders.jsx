import { ReceiptText, RefreshCw, WalletCards } from 'lucide-react'
import { EmptyState, formatDateTime } from './ReceptionistViewShared'

export default function PendingCounterOrders({ orders, loading, error, disabled, onRefresh, onCollect }) {
  return <section className="reception-card reception-table-card reception-pending-orders-card">
    <div className="reception-table-tools"><div><strong>Đơn chờ thanh toán tại quầy</strong><small>{orders.length} đơn {loading && '· Đang cập nhật...'}</small></div><button type="button" disabled={loading} onClick={onRefresh}><RefreshCw size={14} />Làm mới đơn chờ</button></div>
    <p className="reception-pending-orders-note">Các đơn chưa có giao dịch đang xử lý vẫn hiển thị tại đây. Phương thức thu tại quầy được chọn khi lễ tân nhận tiền.</p>
    {error && <div className="reception-inline-error" role="alert"><p>{error}</p><button type="button" disabled={loading} onClick={onRefresh}>Thử tải lại đơn chờ</button></div>}
    <div className="reception-table-scroll reception-pending-orders-scroll" role="region" aria-label="Đơn chờ thanh toán tại quầy, có thể cuộn" tabIndex={0} aria-busy={loading}>
      <div className="reception-table-heading"><span>Mã đơn đăng ký</span><span>Hội viên</span><span>Gói tập</span><span>Số tiền</span><span>Thao tác</span></div>
      {orders.length ? orders.map(order => <div className="reception-table-row reception-pending-order-row" key={order.id}>
        <span><strong>{'#SUB-' + order.id}</strong><small>{formatDateTime(order.createdAt)}</small></span>
        <span><strong>{order.memberName || '#' + order.memberId}</strong><small>{order.memberPhone || order.memberEmail || '#' + order.memberId}</small></span>
        <span>{order.packageName}<small>{order.durationInDays} ngày</small></span>
        <span>{Number(order.agreedPrice || 0).toLocaleString('vi-VN')} đ<small>Chờ thanh toán tại quầy</small></span>
        <span>{order.blockedReason ? <small className="reception-pending-order-blocked">{order.blockedReason}</small> : <button type="button" className="reception-primary-button" disabled={disabled || loading} onClick={() => onCollect(order)} aria-label={'Thu tiền đơn đăng ký ' + order.id}><WalletCards size={14} />Thu tiền</button>}</span>
      </div>) : <EmptyState icon={ReceiptText} title={loading ? 'Đang tải đơn chờ' : error ? 'Chưa tải đủ đơn chờ' : 'Không có đơn chờ phù hợp'} text={loading ? 'Đang kiểm tra đơn đăng ký của hội viên.' : 'Đơn mới sẽ xuất hiện sau khi cập nhật. Kiểm tra bộ lọc nếu bạn chưa thấy đơn.'} />}
    </div>
  </section>
}
