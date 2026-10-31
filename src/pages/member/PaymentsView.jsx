import { useEffect, useId, useRef, useState } from 'react'
import {
  AlertCircle, ArrowDownToLine, ArrowRight, Banknote, CheckCircle2, Clock3,
  CreditCard, ExternalLink, Eye, LoaderCircle, QrCode, ReceiptText, RefreshCw, Search, X, XCircle,
} from 'lucide-react'
import QRCode from 'qrcode'
import { getMyPayments, syncPayment } from '../../services/paymentService'
import { cancelPaymentAndSubscription } from '../../services/subscriptionCancellationService'
import { exportInvoicePdf, triggerBlobDownload } from '../../services/reportService'
import { canCancelPayOSPayment, canCheckoutPayOSPayment, canSyncPayOSPayment, filterMemberPayments, paymentReceivedAmount, paymentStatus, paymentStatusLabel, paymentSummary } from '../../utils/memberPayments'
import '../../style/member/PaymentsView.css'

const currency = value => `${Number(value ?? 0).toLocaleString('vi-VN')} đ`
const dateTime = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : 'Chưa cập nhật'
const errorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback

function PaymentStatus({ payment }) {
  return <span className="mpay-status" data-status={paymentStatus(payment)}><span />{paymentStatusLabel(payment)}</span>
}

function Message({ children, error = false }) {
  return <div className={`mpay-message${error ? ' is-error' : ''}`} role={error ? 'alert' : 'status'}><AlertCircle size={18} /><p>{children}</p></div>
}

function PaymentDialog({ title, children, footer, onClose, busy }) {
  const ref = useRef(null)
  const id = useId()
  useEffect(() => {
    const dialog = ref.current
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return <dialog ref={ref} className="mpay-dialog" aria-labelledby={id} aria-busy={busy}
    onCancel={event => { event.preventDefault(); if (!busy) onClose() }}
    onClick={event => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <div className="mpay-dialog-content"><header><div><ReceiptText size={20} /><h2 id={id}>{title}</h2></div><button type="button" className="mpay-close" disabled={busy} aria-label="Đóng cửa sổ" onClick={onClose}><X size={20} /></button></header><div className="mpay-dialog-body">{children}</div><footer>{footer}</footer></div>
  </dialog>
}

function PaymentQr({ payment, onCheckout, disabled }) {
  const payload = payment.qrCode || payment.checkoutUrl
  const [image, setImage] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setError('')
    QRCode.toDataURL(payload, { width: 240, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } })
      .then(url => { if (active) setImage({ payload, url }) })
      .catch(() => { if (active) setError('Chưa thể hiển thị mã QR. Bạn vẫn có thể mở liên kết PayOS để thanh toán.') })
    return () => { active = false }
  }, [payload])
  return <section className="mpay-qr" aria-label="Thông tin thanh toán PayOS">
    <div className="mpay-qr-heading"><QrCode size={20} /><div><h3>{payment.qrCode ? 'Quét mã QR để thanh toán' : 'Mở trang thanh toán PayOS'}</h3><p>{payment.qrCode ? 'Dùng ứng dụng ngân hàng để quét mã QR do PayOS cung cấp.' : 'Quét mã bằng camera điện thoại hoặc mở liên kết để đến trang thanh toán.'}</p></div></div>
    <div className="mpay-qr-content">{error ? <p className="mpay-muted" role="status">{error}</p> : image?.payload === payload ? <img src={image.url} width="176" height="176" alt={payment.qrCode ? 'Mã QR thanh toán PayOS' : 'Mã QR mở trang PayOS'} /> : <LoaderCircle size={28} className="member-spin" aria-label="Đang tạo mã QR" />}
      <div><span>Số tiền cần thanh toán</span><strong>{currency(payment.amount)}</strong>{payment.expiresAt && <small>Hết hạn: {dateTime(payment.expiresAt)}</small>}{payment.checkoutUrl && <button type="button" className="mpay-button is-primary" disabled={disabled} onClick={() => onCheckout(payment)}><ExternalLink size={16} />Mở PayOS</button>}</div>
    </div>
  </section>
}

function DetailField({ label, children }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>
}

export function PaymentsView({ showNotice }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [action, setAction] = useState(null)
  const [viewingId, setViewingId] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const actionLock = useRef(false)
  const loadRevision = useRef(0)

  const viewing = payments.find(payment => String(payment.id) === String(viewingId))
  const summary = paymentSummary(payments)
  const filtered = filterMemberPayments(payments, search, statusFilter)
  const busy = Boolean(action)
  const announce = text => { if (showNotice) showNotice(text); else setNotice(text) }

  const loadPayments = async () => {
    const revision = ++loadRevision.current
    setLoading(true); setLoadError('')
    try {
      const data = await getMyPayments()
      if (revision === loadRevision.current) { setPayments(data); setHasLoaded(true) }
      return true
    } catch (err) {
      if (revision === loadRevision.current) setLoadError(errorMessage(err, 'Không thể tải lịch sử thanh toán.'))
      return false
    } finally { if (revision === loadRevision.current) setLoading(false) }
  }

  useEffect(() => { loadPayments(); return () => { loadRevision.current++ } }, [])

  const openDetail = payment => { setActionError(''); setNotice(''); setViewingId(payment.id) }
  const checkout = payment => {
    if (busy || loading || !canCheckoutPayOSPayment(payment)) return
    if (!payment.checkoutUrl) { setActionError('Giao dịch chưa có liên kết PayOS. Hãy mở chi tiết và đồng bộ trạng thái hoặc liên hệ lễ tân.'); return }
    window.location.assign(payment.checkoutUrl)
  }
  const updatePayment = result => {
    if (result?.id && result.status) setPayments(previous => previous.map(payment => String(payment.id) === String(result.id) ? { ...payment, ...result } : payment))
  }
  const handleSync = async payment => {
    if (actionLock.current || loading || !canSyncPayOSPayment(payment)) return
    actionLock.current = true; setAction({ id: payment.id, type: 'sync' }); setActionError(''); setNotice('')
    try {
      const updated = await syncPayment(payment.id)
      await loadPayments()
      updatePayment(updated)
      announce('Đã cập nhật trạng thái giao dịch từ PayOS.')
    } catch (err) { setActionError(errorMessage(err, 'Không thể đồng bộ thanh toán. Vui lòng thử lại.')) }
    finally { actionLock.current = false; setAction(null) }
  }
  const confirmCancel = async () => {
    if (!cancelling || !canCancelPayOSPayment(cancelling) || actionLock.current || loading) return
    actionLock.current = true; setAction({ id: cancelling.id, type: 'cancel' }); setActionError('')
    try {
      const result = await cancelPaymentAndSubscription(cancelling)
      updatePayment(result.payment)
      await loadPayments()
      updatePayment(result.payment)
      setCancelling(null)
      announce(result.subscription ? 'Đã hủy thanh toán và đơn đăng ký gói.' : 'Đã hủy giao dịch thanh toán.')
    } catch (err) {
      await loadPayments()
      if (err.cancelledPayment || err.paymentResult) updatePayment(err.cancelledPayment || err.paymentResult)
      if (err.paymentResult) setCancelling(previous => ({ ...previous, ...err.paymentResult }))
      setActionError(errorMessage(err, 'Không thể hủy thanh toán. Vui lòng thử lại.'))
    }
    finally { actionLock.current = false; setAction(null) }
  }
  const exportPdf = async payment => {
    if (actionLock.current || paymentStatus(payment) !== 'completed') return
    actionLock.current = true; setAction({ id: payment.id, type: 'pdf' }); setActionError(''); setNotice('')
    try {
      triggerBlobDownload(await exportInvoicePdf(payment.id), `hoa-don-olympus-${payment.id}.pdf`)
      announce('Đã tải hóa đơn PDF thành công.')
    } catch (err) { setActionError(errorMessage(err, 'Không thể tải hóa đơn PDF. Vui lòng thử lại.')) }
    finally { actionLock.current = false; setAction(null) }
  }

  return <div className="member-payments-view">
    <header className="mpay-page-heading"><div><p className="member-eyebrow"><ReceiptText size={16} />QUẢN LÝ GIAO DỊCH</p><h2>Thanh toán & Hóa đơn</h2><p>Quản lý giao dịch, kiểm tra trạng thái PayOS và tải hóa đơn của bạn.</p></div><button type="button" className="mpay-button" disabled={loading || busy} onClick={loadPayments} aria-label="Làm mới" title="Làm mới giao dịch"><RefreshCw size={16} className={loading ? 'member-spin' : undefined} /><span>Làm mới</span></button></header>
    {loadError && <Message error>{loadError}{hasLoaded ? ' Dữ liệu đang hiển thị là lần tải gần nhất.' : ''}</Message>}
    {actionError && !viewing && !cancelling && <Message error>{actionError}</Message>}
    {notice && <Message>{notice}</Message>}

    <div className="mpay-overview">
      <section className="mpay-total" aria-label="Tổng tiền đã thanh toán"><span className="mpay-overview-icon"><Banknote size={25} /></span><div><p>Tổng đã thanh toán</p><strong>{hasLoaded ? currency(summary.paid) : '—'}</strong><small>{hasLoaded ? `${summary.completed} giao dịch thành công` : 'Đang tải thông tin giao dịch'}</small></div></section>
      <section className="mpay-pending-overview"><span className="mpay-overview-icon"><Clock3 size={24} /></span><div><h3>{hasLoaded ? `${summary.pending} giao dịch chờ thanh toán` : 'Đang kiểm tra giao dịch'}</h3></div><button type="button" disabled={!hasLoaded} onClick={() => { setSearch(''); setStatusFilter(summary.pending ? 'pending' : 'all') }}>Xem giao dịch<ArrowRight size={15} /></button></section>
    </div>
    <div className="mpay-stats" role="group" aria-label="Lọc nhanh giao dịch">
      {[[ReceiptText, 'Tổng giao dịch', summary.total, 'all'], [CheckCircle2, 'Đã thanh toán', summary.completed, 'completed'], [Clock3, 'Chờ thanh toán', summary.pending, 'pending'], [XCircle, 'Giao dịch đã đóng', summary.closed, 'closed']].map(([Icon, label, count, filter]) => <button type="button" key={filter} aria-pressed={statusFilter === filter} disabled={!hasLoaded} onClick={() => { setStatusFilter(filter); setSearch('') }} data-tone={filter}><Icon size={18} /><span>{label}</span><strong>{hasLoaded ? count : '—'}</strong></button>)}
    </div>
    {summary.review > 0 && <Message>{summary.review} giao dịch cần đối soát. Xem chi tiết giao dịch hoặc liên hệ lễ tân để được hỗ trợ.</Message>}

    <section className="mpay-history" aria-labelledby="mpay-history-title" aria-busy={loading}>
      <div className="mpay-section-heading"><div><h3 id="mpay-history-title">Lịch sử thanh toán</h3><p>Hóa đơn PDF có thể tải khi giao dịch đã được xác nhận thanh toán.</p></div>{hasLoaded && <span>{filtered.length} / {payments.length} giao dịch</span>}</div>
      <div className="mpay-toolbar"><label className="mpay-search"><Search size={18} aria-hidden="true" /><input type="search" maxLength={200} value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm mã giao dịch, mã PayOS, mã đăng ký..." aria-label="Tìm giao dịch thanh toán" /></label><label className="mpay-filter"><span>Trạng thái</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">Tất cả giao dịch</option><option value="completed">Đã thanh toán</option><option value="pending">Chờ thanh toán</option><option value="needsreview">Cần đối soát</option><option value="closed">Giao dịch đã đóng</option><option value="cancelled">Đã hủy</option><option value="expired">Hết hạn</option><option value="failed">Thất bại</option><option value="refunded">Đã hoàn tiền</option></select></label></div>
      {loading && !hasLoaded ? <div className="mpay-empty" role="status"><LoaderCircle size={28} className="member-spin" /><p>Đang tải giao dịch và hóa đơn...</p></div> : !hasLoaded && loadError ? <div className="mpay-empty"><AlertCircle size={28} /><h4>Chưa thể tải lịch sử thanh toán</h4><button type="button" className="mpay-button" onClick={loadPayments}>Thử lại</button></div> : filtered.length ? <div className="mpay-records">
        <div className="mpay-record-labels" aria-hidden="true"><span>Giao dịch</span><span>Số tiền</span><span>Thời gian</span><span>Trạng thái</span><span>Thao tác</span></div>
        <ul>{filtered.map(payment => <li className="mpay-record" key={payment.id} data-payment-id={payment.id}>
          <div className="mpay-record-main"><span className="mpay-record-icon"><ReceiptText size={19} /></span><div><h4>#PAY-{payment.id}</h4><p>{payment.packageName || (payment.subscriptionId ? `Đăng ký gói #SUB-${payment.subscriptionId}` : 'Giao dịch thanh toán')}</p></div></div>
          <div className="mpay-record-amount"><span className="mpay-mobile-label">Số tiền</span><strong>{currency(paymentStatus(payment) === 'completed' ? paymentReceivedAmount(payment) : payment.amount)}</strong><small>{payment.paymentMethod || 'PayOS'}</small></div>
          <div className="mpay-record-date"><span className="mpay-mobile-label">Thời gian</span><time>{dateTime(payment.paidAt || payment.createdAt)}</time><small>{payment.paidAt ? 'Ngày thanh toán' : 'Ngày tạo giao dịch'}</small></div>
          <div className="mpay-record-status"><PaymentStatus payment={payment} /></div>
          <div className="mpay-record-actions"><button type="button" className="mpay-button" onClick={() => openDetail(payment)} aria-label={`Xem chi tiết giao dịch PAY-${payment.id}`}><Eye size={15} />Chi tiết</button>{canCheckoutPayOSPayment(payment) && <button type="button" className="mpay-button is-primary" disabled={busy || loading} onClick={() => checkout(payment)}><ExternalLink size={15} />Thanh toán</button>}{paymentStatus(payment) === 'completed' && <button type="button" className="mpay-button is-soft" disabled={busy || loading} onClick={() => exportPdf(payment)}>{action?.id === payment.id && action.type === 'pdf' ? <LoaderCircle className="member-spin" size={15} /> : <ArrowDownToLine size={15} />}Hóa đơn PDF</button>}</div>
        </li>)}</ul>
      </div> : <div className="mpay-empty"><Search size={28} /><h4>{payments.length ? 'Không tìm thấy giao dịch phù hợp' : 'Bạn chưa có giao dịch thanh toán'}</h4><p>{payments.length ? 'Thử thay đổi từ khóa hoặc trạng thái lọc.' : 'Giao dịch sẽ xuất hiện tại đây sau khi bạn tạo yêu cầu thanh toán gói tập.'}</p>{payments.length > 0 && <button type="button" className="mpay-button" onClick={() => { setSearch(''); setStatusFilter('all') }}>Xóa bộ lọc</button>}</div>}
    </section>

    {viewing && <PaymentDialog title={`Chi tiết giao dịch #PAY-${viewing.id}`} busy={busy || loading} onClose={() => setViewingId(null)} footer={<>
      <button type="button" className="mpay-button" disabled={busy || loading} onClick={() => setViewingId(null)}>Đóng</button>
      {canCancelPayOSPayment(viewing) && <button type="button" className="mpay-button is-danger" disabled={busy || loading} onClick={() => { setActionError(''); setViewingId(null); setCancelling(viewing) }}><XCircle size={15} />Hủy giao dịch</button>}{canSyncPayOSPayment(viewing) && <button type="button" className="mpay-button is-soft" disabled={busy || loading} onClick={() => handleSync(viewing)}><RefreshCw size={15} className={action?.type === 'sync' ? 'member-spin' : undefined} />{action?.type === 'sync' ? 'Đang đồng bộ...' : 'Đồng bộ trạng thái'}</button>}
      {paymentStatus(viewing) === 'completed' && <button type="button" className="mpay-button is-primary" disabled={busy || loading} onClick={() => exportPdf(viewing)}><ArrowDownToLine size={15} />{action?.type === 'pdf' ? 'Đang tải...' : 'Tải hóa đơn PDF'}</button>}
    </>}>
      <div className="mpay-detail-summary"><div><span>Số tiền giao dịch</span><strong>{currency(viewing.amount)}</strong></div><PaymentStatus payment={viewing} /></div>
      {actionError && <Message error>{actionError}</Message>}{loadError && <Message error>{loadError}</Message>}
      {paymentStatus(viewing) === 'needsreview' && <Message>{viewing.reviewReason || 'Giao dịch cần được kiểm tra đối soát. Vui lòng liên hệ lễ tân để được hỗ trợ.'}</Message>}
      <dl className="mpay-detail-grid"><DetailField label="Mã giao dịch">#PAY-{viewing.id}</DetailField><DetailField label="Đăng ký gói tập">{viewing.subscriptionId ? `#SUB-${viewing.subscriptionId}` : 'Chưa cập nhật'}</DetailField><DetailField label="Phương thức">{viewing.paymentMethod || 'PayOS'}</DetailField><DetailField label="Mã đơn PayOS">{viewing.payOSOrderCode ?? 'Chưa cập nhật'}</DetailField><DetailField label="Ngày tạo">{dateTime(viewing.createdAt)}</DetailField><DetailField label="Ngày thanh toán">{dateTime(viewing.paidAt)}</DetailField><DetailField label="Số tiền thực nhận">{currency(viewing.amountReceived ?? 0)}</DetailField><DetailField label="Mã tham chiếu">{viewing.transactionReference || 'Chưa cập nhật'}</DetailField></dl>
      {canCheckoutPayOSPayment(viewing) && (viewing.qrCode || viewing.checkoutUrl) && <PaymentQr payment={viewing} onCheckout={checkout} disabled={busy || loading} />}
      {paymentStatus(viewing) === 'pending' && !viewing.checkoutUrl && !viewing.qrCode && <Message>Giao dịch chưa có liên kết thanh toán. Hãy đồng bộ trạng thái hoặc liên hệ lễ tân để được hỗ trợ.</Message>}
    </PaymentDialog>}

    {cancelling && <PaymentDialog title="Hủy yêu cầu thanh toán" busy={busy || loading} onClose={() => { setCancelling(null); setActionError('') }} footer={<><button type="button" className="mpay-button" disabled={busy || loading} onClick={() => { setCancelling(null); setActionError('') }}>Giữ giao dịch</button><button type="button" className="mpay-button is-danger" disabled={busy || loading || !canCancelPayOSPayment(cancelling)} onClick={confirmCancel}>{action?.type === 'cancel' ? <LoaderCircle className="member-spin" size={16} /> : <XCircle size={16} />}Xác nhận hủy</button></>}>
      <p>Bạn muốn hủy yêu cầu thanh toán <strong>#PAY-{cancelling.id}</strong> với số tiền <strong>{currency(cancelling.amount)}</strong>?</p><p className="mpay-muted">Khi giao dịch được xác nhận đã hủy, đơn đăng ký gói tương ứng cũng sẽ được hủy. Chỉ áp dụng cho đơn chưa thanh toán; trạng thái cuối cùng được xác nhận từ hệ thống.</p>{actionError && <Message error>{actionError}</Message>}
    </PaymentDialog>}
  </div>
}

export default PaymentsView
