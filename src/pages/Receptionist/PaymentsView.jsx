import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Clock3, ReceiptText, Ban, Plus, ScanLine, WalletCards, X } from 'lucide-react'
import { cancelPayment as cancelPayOSPayment, createPayment, getPaymentById, getPayments, syncPayment } from '../../services/paymentService'
import { EmptyState, formatDateTime, paymentStatusLabel, requestErrorMessage } from './ReceptionistViewShared'

export function PaymentsView({ query, showNotice }) {
  const [status, setStatus] = useState('Tất cả')
  const [paymentItems, setPaymentItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)
  const [selectedPaymentId, setSelectedPaymentId] = useState(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const normalizedQuery = query.trim().toLocaleLowerCase('vi')

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
          setPaymentItems([])
          setError(requestErrorMessage(requestError, 'Không thể tải danh sách thanh toán.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadPayments()
    return () => { active = false }
  }, [requestKey])

  const payments = useMemo(() => paymentItems.filter(payment => {
    const matchesStatus = status === 'Tất cả' || paymentStatusLabel(payment.status) === status
    const matchesQuery = !normalizedQuery || `${payment.id} ${payment.memberId} ${payment.subscriptionId || ''} ${payment.transactionReference || ''} ${payment.payOSOrderCode || ''}`.toLocaleLowerCase('vi').includes(normalizedQuery)
    return matchesStatus && matchesQuery
  }), [normalizedQuery, paymentItems, status])
  const completedPayments = paymentItems.filter(payment => payment.status === 'Completed')
  const completedTotal = completedPayments.reduce((sum, payment) => sum + Number(payment.amountReceived || payment.amount || 0), 0)
  const pendingCount = paymentItems.filter(payment => payment.status === 'Pending').length

  return <>
    <section className="reception-payment-metrics"><article><span className="green"><WalletCards size={21} /></span><div><small>Tổng đã thu</small><strong>{loading ? '--' : `${completedTotal.toLocaleString('vi-VN')} đ`}</strong><p>{completedPayments.length} giao dịch thành công</p></div></article><article><span className="amber"><Clock3 size={21} /></span><div><small>Chờ thanh toán</small><strong>{loading ? '--' : pendingCount}</strong><p>Yêu cầu PayOS đang mở</p></div></article><article><span className="blue"><ReceiptText size={21} /></span><div><small>Tổng giao dịch</small><strong>{loading ? '--' : paymentItems.length}</strong><p>Dữ liệu từ Payment API</p></div></article></section>
    <section className="reception-card reception-table-card reception-payments-card"><div className="reception-table-tools"><div><strong>Giao dịch PayOS</strong><small>{payments.length} kết quả</small></div><div>{['Tất cả', 'Thành công', 'Chờ thanh toán', 'Cần kiểm tra', 'Đã hủy'].map(item => <button type="button" className={status === item ? 'active' : ''} onClick={() => setStatus(item)} key={item}>{item}</button>)}<button className="reception-primary-button" type="button" onClick={() => setShowCreateDialog(true)}><Plus size={14} />Tạo thanh toán</button></div></div><div className="reception-table-heading"><span>Mã giao dịch</span><span>Hội viên</span><span>Đăng ký gói</span><span>Số tiền</span><span>Trạng thái</span></div>{loading ? <EmptyState icon={ReceiptText} title="Đang tải thanh toán" text="Dữ liệu đang được đồng bộ từ Payment API." /> : error ? <div className="reception-inline-error"><EmptyState icon={ReceiptText} title="Không thể tải thanh toán" text={error} /><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : payments.length ? <div>{payments.map(payment => <button type="button" className="reception-table-row" key={payment.id} onClick={() => setSelectedPaymentId(payment.id)} aria-label={`Xem thanh toán ${payment.id}`}><span>#{payment.id}</span><span>#{payment.memberId}</span><span>{payment.subscriptionId ? `#${payment.subscriptionId}` : 'Không có'}</span><span>{Number(payment.amount || 0).toLocaleString('vi-VN')} đ</span><span className={`reception-payment-status ${String(payment.status || '').toLowerCase()}`}>{paymentStatusLabel(payment.status)}</span></button>)}</div> : <EmptyState icon={ReceiptText} title="Chưa có giao dịch" text={query || status !== 'Tất cả' ? 'Không có giao dịch phù hợp bộ lọc.' : 'Payment API chưa có dữ liệu giao dịch.'} />}</section>
    {selectedPaymentId !== null && <PaymentDetailDialog paymentId={selectedPaymentId} onClose={() => setSelectedPaymentId(null)} onUpdated={() => setRequestKey(key => key + 1)} showNotice={showNotice} />}
    {showCreateDialog && <CreatePaymentDialog onClose={() => setShowCreateDialog(false)} onCreated={payment => { setRequestKey(key => key + 1); setSelectedPaymentId(payment.id); showNotice(`Đã tạo yêu cầu thanh toán #${payment.id}.`) }} />}
  </>
}

function CreatePaymentDialog({ onClose, onCreated }) {
  const [subscriptionId, setSubscriptionId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async event => {
    event.preventDefault()
    const normalizedId = Number(subscriptionId)
    if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
      setError('Mã đăng ký gói phải là số nguyên lớn hơn 0.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payment = await createPayment(normalizedId)
      onCreated(payment)
      onClose()
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'Không thể tạo yêu cầu thanh toán PayOS.'))
    } finally {
      setSaving(false)
    }
  }

  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="reception-dialog reception-create-payment-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-create-payment-title">
      <header><div><span>TẠO YÊU CẦU PAYOS</span><h2 id="reception-create-payment-title">Tạo thanh toán đăng ký gói</h2><p>Backend sẽ tạo mới hoặc trả lại link đang chờ của đăng ký này.</p></div><button type="button" aria-label="Đóng biểu mẫu tạo thanh toán" onClick={onClose} disabled={saving}><X size={19} /></button></header>
      <form onSubmit={submit}><label className="reception-payment-id-field">Mã đăng ký gói<input type="number" min="1" step="1" value={subscriptionId} onChange={event => setSubscriptionId(event.target.value)} placeholder="Ví dụ: 12" disabled={saving} autoFocus required /></label><div className="reception-payment-create-note"><WalletCards size={20} /><span><strong>Thanh toán qua PayOS</strong><small>Chỉ đăng ký gói đang chờ thanh toán mới có thể tạo yêu cầu.</small></span></div>{error && <p className="reception-form-error" role="alert">{error}</p>}<footer><button type="button" onClick={onClose} disabled={saving}>Hủy</button><button type="submit" disabled={saving}>{saving ? 'Đang tạo...' : 'Tạo yêu cầu thanh toán'}</button></footer></form>
    </section>
  </div>
}

function PaymentDetailDialog({ paymentId, onClose, onUpdated, showNotice }) {
  const [payment, setPayment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [actionError, setActionError] = useState('')
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  useEffect(() => {
    let active = true
    const loadPayment = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getPaymentById(paymentId)
        if (active) setPayment(result)
      } catch (requestError) {
        if (active) {
          setPayment(null)
          setError(requestErrorMessage(requestError, 'Không thể tải chi tiết thanh toán.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadPayment()
    return () => { active = false }
  }, [paymentId, requestKey])

  const handleSync = async () => {
    setSyncing(true)
    setActionError('')
    try {
      const result = await syncPayment(paymentId)
      setPayment(result)
      onUpdated(result)
      showNotice(`Đã đồng bộ thanh toán #${paymentId} từ PayOS.`)
    } catch (requestError) {
      setActionError(requestErrorMessage(requestError, 'Không thể đồng bộ trạng thái PayOS.'))
    } finally {
      setSyncing(false)
    }
  }

  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="reception-dialog reception-payment-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-payment-detail-title">
      <header><div><span>CHI TIẾT PAYOS</span><h2 id="reception-payment-detail-title">Thanh toán #{paymentId}</h2><p>Dữ liệu được tải trực tiếp từ Payment API.</p></div><button type="button" aria-label="Đóng chi tiết thanh toán" onClick={onClose}><X size={19} /></button></header>
      <div className="reception-payment-detail-body">{loading ? <div className="reception-member-detail-state"><ReceiptText size={26} /><strong>Đang tải chi tiết thanh toán</strong></div> : error ? <div className="reception-member-detail-state"><ReceiptText size={26} /><strong>Không thể tải chi tiết</strong><span>{error}</span><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : payment && <><div className="reception-payment-detail-title"><span><WalletCards size={23} /></span><div><small>Mã giao dịch</small><h3>#{payment.id}</h3></div><b className={String(payment.status || '').toLowerCase()}>{paymentStatusLabel(payment.status)}</b></div><div className="reception-payment-detail-grid"><div><small>Hội viên</small><strong>#{payment.memberId}</strong></div><div><small>Đăng ký gói</small><strong>{payment.subscriptionId ? `#${payment.subscriptionId}` : 'Không có'}</strong></div><div><small>Số tiền</small><strong>{Number(payment.amount || 0).toLocaleString('vi-VN')} đ</strong></div><div><small>Đã nhận</small><strong>{Number(payment.amountReceived || 0).toLocaleString('vi-VN')} đ</strong></div><div><small>Phương thức</small><strong>{payment.paymentMethod || 'Chưa có'}</strong></div><div><small>Trạng thái PayOS</small><strong>{payment.gatewayStatus || 'Chưa đồng bộ'}</strong></div><div><small>Mã đơn PayOS</small><strong>{payment.payOSOrderCode || 'Chưa có'}</strong></div><div><small>Mã tham chiếu</small><strong>{payment.transactionReference || 'Chưa có'}</strong></div><div><small>Ngày tạo</small><strong>{formatDateTime(payment.createdAt)}</strong></div><div><small>Ngày thanh toán</small><strong>{formatDateTime(payment.paidAt)}</strong></div><div><small>Hết hạn</small><strong>{formatDateTime(payment.expiresAt)}</strong></div><div><small>Lý do kiểm tra</small><strong>{payment.reviewReason || 'Không có'}</strong></div></div>{actionError && <p className="reception-form-error" role="alert">{actionError}</p>}<div className="reception-payment-detail-actions">{payment.checkoutUrl && <a href={payment.checkoutUrl} target="_blank" rel="noreferrer">Mở trang thanh toán <ArrowRight size={14} /></a>}<button type="button" onClick={handleSync} disabled={syncing}><ScanLine size={14} />{syncing ? 'Đang đồng bộ...' : 'Đồng bộ PayOS'}</button>{payment.status === 'Pending' && <button className="cancel" type="button" onClick={() => setShowCancelDialog(true)} disabled={syncing}><Ban size={14} />Hủy thanh toán</button>}</div></>}
      </div>
      {showCancelDialog && payment && <CancelPaymentDialog payment={payment} onClose={() => setShowCancelDialog(false)} onCancelled={result => { setPayment(result); onUpdated(result); showNotice(`Đã hủy thanh toán #${paymentId}.`) }} />}
    </section>
  </div>
}

function CancelPaymentDialog({ payment, onClose, onCancelled }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async event => {
    event.preventDefault()
    const normalizedReason = reason.trim()
    if (!normalizedReason) {
      setError('Vui lòng nhập lý do hủy thanh toán.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const result = await cancelPayOSPayment(payment.id, normalizedReason)
      onCancelled(result)
      onClose()
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'Không thể hủy yêu cầu thanh toán PayOS.'))
    } finally {
      setSaving(false)
    }
  }

  return <div className="reception-dialog-backdrop reception-nested-dialog" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="reception-dialog reception-cancel-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-cancel-payment-title">
      <header><div><span>HỦY YÊU CẦU PAYOS</span><h2 id="reception-cancel-payment-title">Thanh toán #{payment.id}</h2><p>Chỉ giao dịch đang chờ mới có thể hủy.</p></div><button type="button" aria-label="Đóng xác nhận hủy thanh toán" onClick={onClose} disabled={saving}><X size={19} /></button></header>
      <form onSubmit={submit}><label className="reception-cancel-reason">Lý do hủy<textarea value={reason} onChange={event => setReason(event.target.value)} rows="4" maxLength="200" placeholder="Nhập lý do gửi tới PayOS..." disabled={saving} required /></label>{error && <p className="reception-form-error" role="alert">{error}</p>}<footer><button type="button" onClick={onClose} disabled={saving}>Quay lại</button><button className="danger" type="submit" disabled={saving}>{saving ? 'Đang hủy...' : 'Xác nhận hủy'}</button></footer></form>
    </section>
  </div>
}

