import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { ArrowRight, Clock3, Download, ReceiptText, Ban, Plus, RefreshCw, ScanLine, WalletCards, X } from 'lucide-react'
import { getPaymentById, getPayments } from '../../services/paymentService'
import { getReceptionistPendingOrders, getReceptionistPaymentError, receptionistCheckoutUrl, syncReceptionistPayment } from '../../services/receptionistPaymentService'
import CheckoutDialog from './CheckoutDialog'
import PendingCounterOrders from './PendingCounterOrders'
import { cancelOpenPayment } from '../../services/subscriptionCancellationService'
import { canCancelPayOSPayment, canSyncPayOSPayment, paymentCheckoutMessage, paymentStatus, paymentSummary, paymentStatusLabel as gatewayStatusLabel } from '../../utils/memberPayments'
import { filterReceptionistPayments, getReceptionistPendingCounterOrders, receptionistPaymentMethods, receptionistPaymentMethodLabel, receptionistPaymentStatuses } from '../../utils/receptionistPayments'
import { exportInvoicePdf, getReportErrorMessage, triggerBlobDownload } from '../../services/reportService'
import { EmptyState, formatDateTime } from './ReceptionistViewShared'

export function PaymentsView({ query, showNotice }) {
  const [status, setStatus] = useState('all')
  const [method, setMethod] = useState('all')
  const [paymentItems, setPaymentItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)
  const [selectedPaymentId, setSelectedPaymentId] = useState(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [pendingOrders, setPendingOrders] = useState([])
  const [pendingLoading, setPendingLoading] = useState(true)
  const [pendingError, setPendingError] = useState('')
  const [counterOrder, setCounterOrder] = useState(null)

  useEffect(() => {
    let active = true
    const loadPayments = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getPayments()
        if (active) setPaymentItems(result)
      } catch (requestError) {
        if (active) {
          setError(getReceptionistPaymentError(requestError, 'Không thể tải danh sách thanh toán.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadPayments()
    return () => { active = false }
  }, [requestKey])

  useEffect(() => {
    let active = true
    setPendingLoading(true)
    setPendingError('')
    const controller = new AbortController()
    getReceptionistPendingOrders({ signal: controller.signal }).then(result => {
      if (!active) return
      setPendingOrders(result.orders)
      if (result.failedMembers.length) setPendingError('Chưa tải được đơn của ' + result.failedMembers.length + ' hội viên. Hãy thử tải lại để có danh sách đầy đủ.')
    }).catch(requestError => {
      if (active) setPendingError(getReceptionistPaymentError(requestError, 'Không thể tải đơn chờ thanh toán tại quầy.'))
    }).finally(() => { if (active) setPendingLoading(false) })
    return () => { active = false; controller.abort() }
  }, [requestKey])

  useEffect(() => {
    const refresh = () => { if (!loading && !pendingLoading && document.visibilityState === 'visible') setRequestKey(key => key + 1) }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    const timer = window.setInterval(refresh, 30000)
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); window.clearInterval(timer) }
  }, [loading, pendingLoading])

  const counterOrders = useMemo(() => getReceptionistPendingCounterOrders(pendingOrders, paymentItems), [pendingOrders, paymentItems])
  const visibleCounterOrders = useMemo(() => getReceptionistPendingCounterOrders(pendingOrders, paymentItems, { query, status, method }), [pendingOrders, paymentItems, query, status, method])
  const counterFiltersVisible = ['all', 'pending'].includes(status) && method !== 'payos'
  const refresh = () => setRequestKey(key => key + 1)
  const onCreated = payment => { refresh(); setSelectedPaymentId(payment.id); showNotice(paymentCheckoutMessage(payment)) }

  const payments = useMemo(() => filterReceptionistPayments(paymentItems, { query, status, method }), [query, paymentItems, status, method])
  const summary = paymentSummary(paymentItems)

  return <>
    <section className="reception-payment-metrics"><article><span className="green"><WalletCards size={21} /></span><div><small>Tổng đã thu</small><strong>{summary.paid.toLocaleString('vi-VN')} đ</strong><p>{summary.completed} giao dịch thành công</p></div></article><article><span className="amber"><Clock3 size={21} /></span><div><small>Chờ thanh toán</small><strong>{summary.pending + counterOrders.filter(order => !order.blockedReason).length}</strong><p>{summary.review} giao dịch cần đối soát</p></div></article><article><span className="blue"><ReceiptText size={21} /></span><div><small>Tổng giao dịch</small><strong>{summary.total}</strong><p>PayOS và thanh toán tại quầy</p></div></article></section>
    <section className="reception-card reception-table-card reception-payments-card">
      <div className="reception-table-tools"><div><strong>Lịch sử thanh toán</strong><small>{payments.length} giao dịch · {visibleCounterOrders.length} đơn chờ {loading && '· Đang cập nhật...'}</small></div><div><button type="button" disabled={loading || pendingLoading} onClick={() => setRequestKey(key => key + 1)}><RefreshCw size={14} />Làm mới</button><button className="reception-primary-button" type="button" onClick={() => setShowCreateDialog(true)}><Plus size={14} />Tạo thanh toán</button></div></div>
      <div className="reception-payment-filters"><label>Trạng thái<select value={status} onChange={event => setStatus(event.target.value)}>{receptionistPaymentStatuses.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><label>Phương thức<select value={method} onChange={event => setMethod(event.target.value)}>{receptionistPaymentMethods.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label></div>
      {error && <div className="reception-inline-error" role="alert"><p>{error} Dữ liệu bên dưới có thể chưa cập nhật.</p><button type="button" disabled={loading} onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div>}
      {counterFiltersVisible && <PendingCounterOrders orders={visibleCounterOrders} loading={pendingLoading} error={pendingError} disabled={loading || !!error || !!pendingError} onRefresh={refresh} onCollect={setCounterOrder} />}
      <div className="reception-table-scroll" role="region" aria-label="Giao dịch thanh toán, có thể cuộn" tabIndex={0} aria-busy={loading}>
        <div className="reception-table-heading"><span>Mã giao dịch</span><span>Hội viên</span><span>Đăng ký gói</span><span>Số tiền / phương thức</span><span>Trạng thái</span></div>
        {payments.length ? <div>{payments.map(payment => <button type="button" className="reception-table-row" key={payment.id} onClick={() => setSelectedPaymentId(payment.id)} aria-label={`Xem thanh toán ${payment.id}`}><span>#{payment.id}</span><span>{payment.memberName || `#${payment.memberId}`}</span><span>{payment.packageName || (payment.subscriptionId ? `#${payment.subscriptionId}` : 'Không có')}</span><span>{Number(payment.amount || 0).toLocaleString('vi-VN')} đ<small className="reception-payment-method">{receptionistPaymentMethodLabel(payment.paymentMethod)}</small></span><span className={`reception-payment-status ${paymentStatus(payment)}`}>{gatewayStatusLabel(payment)}</span></button>)}</div>
          : <EmptyState icon={ReceiptText} title={loading ? 'Đang tải thanh toán' : 'Chưa có giao dịch'} text={loading ? 'Đang cập nhật dữ liệu thanh toán.' : 'Không có giao dịch phù hợp. Hãy kiểm tra bộ lọc hoặc tạo thanh toán cho đơn đang chờ.'} />}
      </div>
    </section>
    {counterOrder && <CheckoutDialog counterOnly memberId={counterOrder.memberId} subscriptionId={counterOrder.id} initialPaymentMethod={method === 'banktransfer' ? 'BankTransfer' : method === 'creditcard' ? 'CreditCard' : 'Cash'} onClose={() => setCounterOrder(null)} onCreated={onCreated} />}
    {selectedPaymentId !== null && <PaymentDetailDialog paymentId={selectedPaymentId} onClose={() => setSelectedPaymentId(null)} onUpdated={() => setRequestKey(key => key + 1)} showNotice={showNotice} />}
    {showCreateDialog && <CheckoutDialog onClose={() => setShowCreateDialog(false)} onCreated={onCreated} />}
  </>
}

function PaymentDetailDialog({ paymentId, onClose, onUpdated, showNotice }) {
  const [payment, setPayment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [gatewayUncertain, setGatewayUncertain] = useState(false)
  const [now, setNow] = useState(Date.now)
  const actionLock = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const checkoutUrl = gatewayUncertain ? '' : receptionistCheckoutUrl(payment, now)
  useEffect(() => {
    const expires = Date.parse(payment?.expiresAt)
    if (!Number.isFinite(expires) || expires <= now) return
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(1, Math.min(60000, expires - Date.now())))
    return () => window.clearTimeout(timer)
  }, [payment?.expiresAt, now])

  useEffect(() => {
    let active = true
    const loadPayment = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getPaymentById(paymentId)
        if (String(result?.id) !== String(paymentId)) throw new Error('Chi tiết không khớp giao dịch đã chọn.')
        if (active) setPayment(result)
      } catch (requestError) {
        if (active) {
          setPayment(null)
          setError(getReceptionistPaymentError(requestError, 'Không thể tải chi tiết thanh toán.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadPayment()
    return () => { active = false }
  }, [paymentId, requestKey])

  const handleSync = async () => {
    if (actionLock.current || !payment) return
    actionLock.current = true
    setSyncing(true)
    setActionError('')
    try {
      const result = await syncReceptionistPayment(payment)
      if (!mounted.current) return
      setPayment(result.payment)
      onUpdated(result.payment)
      setActionError(result.warning)
      setGatewayUncertain(Boolean(result.warning))
      if (!result.warning) showNotice(`Thanh toán #${paymentId}: ${gatewayStatusLabel(result.payment)}.`)
    } catch (requestError) {
      if (mounted.current) {
        setGatewayUncertain(true)
        setActionError(getReceptionistPaymentError(requestError, 'Không thể đồng bộ trạng thái PayOS.'))
      }
    } finally {
      actionLock.current = false
      if (mounted.current) setSyncing(false)
    }
  }

  const handleExport = async () => {
    if (actionLock.current) return
    actionLock.current = true
    setExporting(true)
    setActionError('')
    try {
      const invoice = await exportInvoicePdf(paymentId)
      if (!mounted.current) return
      triggerBlobDownload(invoice, `hoa-don-${paymentId}.pdf`)
      showNotice(`Đã tải hóa đơn thanh toán #${paymentId}.`)
    } catch (requestError) {
      if (mounted.current) setActionError(getReportErrorMessage(requestError, 'Không thể xuất hóa đơn PDF.'))
    } finally {
      actionLock.current = false
      if (mounted.current) setExporting(false)
    }
  }

  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !syncing && !exporting && !showCancelDialog) onClose() }}>
    <section className="reception-dialog reception-payment-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-payment-detail-title" aria-busy={syncing || exporting}>
      <header><div><span>CHI TIẾT THANH TOÁN</span><h2 id="reception-payment-detail-title">Giao dịch #{paymentId}</h2><p>Kiểm tra trạng thái thực tế và biên nhận trước khi thu tiền tiếp.</p></div><button type="button" aria-label="Đóng chi tiết thanh toán" disabled={syncing || exporting || showCancelDialog} onClick={onClose}><X size={19} /></button></header>
      <div className="reception-payment-detail-body">
        {loading ? <div className="reception-member-detail-state"><ReceiptText size={26} /><strong>Đang tải chi tiết thanh toán</strong></div>
          : error ? <div className="reception-member-detail-state" role="alert"><strong>Không thể tải chi tiết</strong><span>{error}</span><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div>
          : payment && <>
            <div className="reception-payment-detail-title"><span><WalletCards size={23} /></span><div><small>{receptionistPaymentMethodLabel(payment.paymentMethod)}</small><h3>Giao dịch #{payment.id}</h3></div><b className={paymentStatus(payment)}>{gatewayStatusLabel(payment)}</b></div>
            <div className="reception-payment-detail-grid">
              <div><small>Hội viên</small><strong>#{payment.memberId}</strong></div><div><small>Đăng ký gói</small><strong>{payment.subscriptionId ? `#${payment.subscriptionId}` : 'Không có'}</strong></div>
              <div><small>Số tiền</small><strong>{Number(payment.amount || 0).toLocaleString('vi-VN')} đ</strong></div><div><small>Đã nhận</small><strong>{Number(payment.amountReceived || (paymentStatus(payment) === 'completed' ? payment.amount : 0)).toLocaleString('vi-VN')} đ</strong></div>
              <div><small>Ngày tạo</small><strong>{formatDateTime(payment.createdAt)}</strong></div><div><small>Ngày thanh toán</small><strong>{formatDateTime(payment.paidAt)}</strong></div><div><small>Mã tham chiếu</small><strong>{payment.transactionReference || 'Chưa có'}</strong></div>
              {String(payment.paymentMethod).toLowerCase() === 'payos' && <><div><small>Trạng thái PayOS</small><strong>{payment.gatewayStatus || 'Chưa đồng bộ'}</strong></div><div><small>Mã đơn PayOS</small><strong>{payment.payOSOrderCode || 'Chưa có'}</strong></div><div><small>Hết hạn</small><strong>{formatDateTime(payment.expiresAt)}</strong></div><div><small>Lý do kiểm tra</small><strong>{payment.reviewReason || 'Không có'}</strong></div></>}
            </div>
            {checkoutUrl && !syncing && <ReceptionistPaymentQr payment={payment} checkoutUrl={checkoutUrl} />}
            {paymentStatus(payment) === 'needsreview' && <p className="reception-form-error" role="alert">Giao dịch cần đối soát. Không thu thêm tiền cho đến khi xác minh xong.</p>}
            {actionError && <p className="reception-form-error" role="alert">{actionError}</p>}
            <div className="reception-payment-detail-actions">
              {paymentStatus(payment) === 'completed' && <button className="export" type="button" onClick={handleExport} disabled={exporting || syncing}><Download size={14} />{exporting ? 'Đang xuất PDF...' : 'Tải hóa đơn PDF'}</button>}
              {checkoutUrl && !syncing && <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">Mở trang thanh toán <ArrowRight size={14} /></a>}
              {canSyncPayOSPayment(payment) && <button type="button" onClick={handleSync} disabled={syncing || exporting}><ScanLine size={14} />{syncing ? 'Đang đồng bộ...' : 'Đồng bộ PayOS'}</button>}
              {!gatewayUncertain && canCancelPayOSPayment(payment) && <button className="cancel" type="button" onClick={() => setShowCancelDialog(true)} disabled={syncing || exporting}><Ban size={14} />Hủy yêu cầu PayOS</button>}
              <button type="button" onClick={() => setRequestKey(key => key + 1)} disabled={syncing || exporting}><RefreshCw size={14} />Tải lại</button>
            </div>
          </>}
      </div>
      {showCancelDialog && payment && <CancelPaymentDialog payment={payment} onClose={() => setShowCancelDialog(false)} onReconciled={result => { setPayment(result); onUpdated(result) }} onCancelled={result => { setPayment(result); onUpdated(result); showNotice(`Giao dịch #${paymentId}: ${gatewayStatusLabel(result)}.`) }} />}
    </section>
  </div>
}

function ReceptionistPaymentQr({ payment, checkoutUrl }) {
  const payload = payment.qrCode || checkoutUrl
  const [image, setImage] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setError('')
    QRCode.toDataURL(payload, { width: 240, margin: 4, color: { dark: '#000000', light: '#ffffff' } })
      .then(url => { if (active) setImage({ payload, url }) })
      .catch(() => { if (active) setError('Không thể hiển thị QR. Bạn vẫn có thể mở trang thanh toán PayOS.') })
    return () => { active = false }
  }, [payload])
  return <section className="reception-payment-qr" aria-label="QR thanh toán PayOS">
    {image?.payload === payload ? <img src={image.url} width="176" height="176" alt={payment.qrCode ? 'Mã QR thanh toán PayOS' : 'Mã QR mở trang thanh toán PayOS'} /> : <p role="status">{error || 'Đang tạo mã QR...'}</p>}
    <div><strong>{payment.qrCode ? 'Quét bằng ứng dụng ngân hàng' : 'Quét để mở trang PayOS'}</strong><p>Chỉ ghi nhận thành công khi trạng thái đã được hệ thống xác nhận.</p>{payment.expiresAt && <small>Hết hạn: {formatDateTime(payment.expiresAt)}</small>}</div>
  </section>
}
function CancelPaymentDialog({ payment, onClose, onCancelled, onReconciled }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)

  const submit = async event => {
    event.preventDefault()
    if (lock.current || !canCancelPayOSPayment(payment)) return
    const normalizedReason = reason.trim()
    if (!normalizedReason || normalizedReason.length > 200) {
      setError('Lý do hủy phải có từ 1 đến 200 ký tự.')
      return
    }
    lock.current = true
    setSaving(true)
    setError('')
    try {
      const result = await cancelOpenPayment(payment, normalizedReason)
      onCancelled(result)
      onClose()
    } catch (requestError) {
      if (requestError.paymentResult) onReconciled(requestError.paymentResult)
      setError(getReceptionistPaymentError(requestError, 'Không thể hủy yêu cầu thanh toán PayOS.'))
    } finally {
      lock.current = false
      setSaving(false)
    }
  }

  return <div className="reception-dialog-backdrop reception-nested-dialog" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="reception-dialog reception-cancel-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-cancel-payment-title">
      <header><div><span>HỦY YÊU CẦU PAYOS</span><h2 id="reception-cancel-payment-title">Thanh toán #{payment.id}</h2><p>Chỉ giao dịch đang chờ mới có thể hủy.</p></div><button type="button" aria-label="Đóng xác nhận hủy thanh toán" onClick={onClose} disabled={saving}><X size={19} /></button></header>
      <form onSubmit={submit}><label className="reception-cancel-reason">Lý do hủy<textarea value={reason} onChange={event => setReason(event.target.value)} rows="4" maxLength="200" placeholder="Nhập lý do gửi tới PayOS..." disabled={saving} required /></label>{error && <p className="reception-form-error" role="alert">{error}</p>}<footer><button type="button" onClick={onClose} disabled={saving}>Quay lại</button><button className="danger" type="submit" disabled={saving || !canCancelPayOSPayment(payment)}>{saving ? 'Đang hủy...' : 'Xác nhận hủy'}</button></footer></form>
    </section>
  </div>
}

