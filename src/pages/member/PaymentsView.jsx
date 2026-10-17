import { useEffect, useState } from 'react'
import {
  AlertCircle, ArrowDownToLine, Banknote, CheckCircle2, Clock3,
  CreditCard, ExternalLink, Eye, Filter, LoaderCircle, QrCode,
  ReceiptText, RefreshCw, Search, ShieldCheck, X, XCircle,
} from 'lucide-react'
import {
  getMyPayments,
  createPayment,
  syncPayment,
  cancelPayment,
} from '../../services/paymentService'
import { exportInvoicePdf, triggerBlobDownload } from '../../services/reportService'
import '../../style/member/PaymentsView.css'

/* ── helpers ─────────────────────────────────────────────────────────── */
function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')} đ`
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function statusLabel(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'completed') return 'Đã thanh toán'
  if (s === 'pending') return 'Chờ thanh toán'
  if (s === 'cancelled') return 'Đã hủy'
  if (s === 'expired') return 'Hết hạn'
  if (s === 'failed') return 'Thất bại'
  return status || '—'
}

function statusClass(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'completed') return ''
  if (s === 'pending') return 'member-status--pending'
  if (s === 'cancelled' || s === 'failed') return 'member-status--danger'
  if (s === 'expired') return 'member-status--muted'
  return 'member-status--muted'
}

/* ═══════════════════════════════════════════════════════════════════════
   PaymentsView – Thanh toán trực tuyến & Hóa đơn (role Member)
   ═══════════════════════════════════════════════════════════════════════ */
export function PaymentsView({ showNotice }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Action lock
  const [actionId, setActionId] = useState(null)

  // Detail modal
  const [viewing, setViewing] = useState(null)

  /* ── load ────────────────────────────────────────────────────────── */
  const loadPayments = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getMyPayments()
      setPayments(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Không thể tải lịch sử thanh toán.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPayments()
  }, [])

  /* ── actions ─────────────────────────────────────────────────────── */
  const handlePayOSCheckout = (payment) => {
    if (!payment.checkoutUrl) {
      alert('Đơn thanh toán chưa có liên kết PayOS. Vui lòng bấm Đồng bộ hoặc liên hệ quầy.')
      return
    }
    window.location.assign(payment.checkoutUrl)
  }

  const handleSync = async (id) => {
    setActionId(id)
    try {
      await syncPayment(id)
      showNotice('Đã đồng bộ trạng thái thanh toán từ PayOS!')
      loadPayments()
    } catch (err) {
      alert('Không thể đồng bộ: ' + (err.message || 'Lỗi'))
    } finally {
      setActionId(null)
    }
  }

  const handleCancel = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy yêu cầu thanh toán này?')) return
    setActionId(id)
    try {
      await cancelPayment(id)
      showNotice('Đã hủy yêu cầu thanh toán.')
      loadPayments()
      if (viewing?.id === id) setViewing(null)
    } catch (err) {
      alert('Không thể hủy thanh toán: ' + (err.message || 'Lỗi'))
    } finally {
      setActionId(null)
    }
  }

  const handleExportPdf = async (id) => {
    setActionId(id)
    try {
      const blob = await exportInvoicePdf(id)
      triggerBlobDownload(blob, `hoa-don-olympus-${id}.pdf`)
      showNotice('Đã tải hóa đơn PDF thành công!')
    } catch (err) {
      alert('Không thể xuất file PDF: ' + (err.message || 'Lỗi'))
    } finally {
      setActionId(null)
    }
  }

  /* ── filter logic ───────────────────────────────────────────────── */
  const filteredPayments = payments.filter((p) => {
    const matchStatus =
      statusFilter === 'all' ||
      String(p.status).toLowerCase() === statusFilter.toLowerCase()
    const matchSearch =
      !searchTerm.trim() ||
      String(p.transactionReference || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(p.payOSOrderCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(p.id).includes(searchTerm.trim())
    return matchStatus && matchSearch
  })

  /* ── derived stats ──────────────────────────────────────────────── */
  const totalCount = payments.length
  const completedCount = payments.filter((p) => String(p.status).toLowerCase() === 'completed').length
  const pendingCount = payments.filter((p) => String(p.status).toLowerCase() === 'pending').length
  const cancelledCount = payments.filter(
    (p) => ['cancelled', 'expired', 'failed'].includes(String(p.status).toLowerCase())
  ).length
  const totalRevenue = payments
    .filter((p) => String(p.status).toLowerCase() === 'completed')
    .reduce((sum, p) => sum + Number(p.amountReceived > 0 ? p.amountReceived : p.amount || 0), 0)

  /* ── loading state ──────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="member-card member-api-state">
        <LoaderCircle className="member-spin" size={26} />
        <strong>Đang tải hóa đơn &amp; giao dịch...</strong>
      </div>
    )
  }

  /* ── render ─────────────────────────────────────────────────────── */
  return (
    <div className="member-view-stack">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="member-section-heading">
        <div>
          <p className="member-eyebrow">
            <ReceiptText size={16} /> PAYMENTS CONTROLLER
          </p>
          <h2>Thanh toán trực tuyến &amp; Hóa đơn</h2>
          <p className="member-muted">
            Tạo thanh toán qua cổng PayOS, đồng bộ trạng thái, hủy giao dịch đang chờ và tải hóa đơn PDF.
          </p>
        </div>
        <div className="member-actions">
          <button type="button" className="member-button" onClick={loadPayments}>
            <RefreshCw size={15} /> Làm mới
          </button>
        </div>
      </div>

      {error && (
        <div className="member-api-message member-api-message--error">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {/* ─── Stat cards ─────────────────────────────────────────────── */}
      <div className="pay-stats">
        <div className="pay-stat-card">
          <span className="pay-stat-icon pay-stat-icon--blue">
            <ReceiptText size={24} />
          </span>
          <div>
            <p>Tổng giao dịch</p>
            <strong>{totalCount}</strong>
          </div>
        </div>
        <div className="pay-stat-card">
          <span className="pay-stat-icon pay-stat-icon--green">
            <CheckCircle2 size={24} />
          </span>
          <div>
            <p>Đã thanh toán</p>
            <strong>{completedCount}</strong>
          </div>
        </div>
        <div className="pay-stat-card">
          <span className="pay-stat-icon pay-stat-icon--amber">
            <Clock3 size={24} />
          </span>
          <div>
            <p>Đang chờ</p>
            <strong>{pendingCount}</strong>
          </div>
        </div>
        <div className="pay-stat-card">
          <span className="pay-stat-icon pay-stat-icon--red">
            <XCircle size={24} />
          </span>
          <div>
            <p>Đã hủy / Thất bại</p>
            <strong>{cancelledCount}</strong>
          </div>
        </div>
        <div className="pay-stat-card pay-stat-card--revenue">
          <span className="pay-stat-icon pay-stat-icon--gold">
            <Banknote size={24} />
          </span>
          <div>
            <p>Tổng đã thanh toán</p>
            <strong>{formatCurrency(totalRevenue)}</strong>
          </div>
        </div>
      </div>

      {/* ─── Search & Filter bar ────────────────────────────────────── */}
      <div className="pay-toolbar member-card">
        <div className="pay-search-box">
          <Search size={15} className="pay-search-icon" />
          <input
            type="text"
            placeholder="Tìm theo mã giao dịch, mã PayOS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button type="button" className="pay-search-clear" onClick={() => setSearchTerm('')}>
              <X size={14} />
            </button>
          )}
        </div>
        <div className="member-filters">
          {[
            { key: 'all', label: `Tất cả (${totalCount})` },
            { key: 'Completed', label: `Đã thanh toán (${completedCount})` },
            { key: 'Pending', label: `Chờ thanh toán (${pendingCount})` },
            { key: 'Cancelled', label: `Đã hủy (${cancelledCount})` },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={statusFilter === f.key}
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Payments table ─────────────────────────────────────────── */}
      <div className="member-card member-table-card">
        <div className="member-table-scroll">
          <table>
            <thead>
              <tr>
                <th>MÃ GIAO DỊCH</th>
                <th>GÓI / DỊCH VỤ</th>
                <th>SỐ TIỀN</th>
                <th>PHƯƠNG THỨC</th>
                <th>THỜI GIAN</th>
                <th>TRẠNG THÁI</th>
                <th>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="member-empty">
                    Không có giao dịch thanh toán nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((item) => {
                  const isPending = String(item.status).toLowerCase() === 'pending'
                  const isCompleted = String(item.status).toLowerCase() === 'completed'

                  return (
                    <tr key={item.id}>
                      <td className="member-invoice-id">
                        #{item.transactionReference || item.payOSOrderCode || item.id}
                      </td>
                      <td>
                        <strong>Đăng ký gói #{item.subscriptionId || '—'}</strong>
                        {item.payOSOrderCode && (
                          <small>PayOS: {item.payOSOrderCode}</small>
                        )}
                      </td>
                      <td className="member-amount">
                        {formatCurrency(item.amountReceived > 0 ? item.amountReceived : item.amount)}
                      </td>
                      <td>
                        <span className="member-inline">
                          <CreditCard size={15} /> {item.paymentMethod || 'PayOS'}
                        </span>
                      </td>
                      <td>{formatDateTime(item.paidAt || item.createdAt)}</td>
                      <td>
                        <span className={`member-status ${statusClass(item.status)}`}>
                          <span />
                          {statusLabel(item.status)}
                        </span>
                      </td>
                      <td>
                        <div className="member-payment-actions">
                          {/* Xem chi tiết */}
                          <button
                            type="button"
                            className="member-button member-button--soft"
                            onClick={() => setViewing(item)}
                            title="Xem chi tiết giao dịch"
                          >
                            <Eye size={14} />
                          </button>

                          {isPending && (
                            <>
                              {/* Thanh toán qua PayOS */}
                              <button
                                type="button"
                                className="member-button member-button--primary"
                                disabled={actionId === item.id}
                                onClick={() => handlePayOSCheckout(item)}
                              >
                                <ExternalLink size={14} /> Thanh toán
                              </button>
                              {/* Đồng bộ trạng thái */}
                              <button
                                type="button"
                                className="member-button"
                                disabled={actionId === item.id}
                                onClick={() => handleSync(item.id)}
                              >
                                <RefreshCw
                                  size={14}
                                  className={actionId === item.id ? 'member-spin' : ''}
                                />{' '}
                                Đồng bộ
                              </button>
                              {/* Hủy giao dịch */}
                              <button
                                type="button"
                                className="member-button member-button--text"
                                disabled={actionId === item.id}
                                onClick={() => handleCancel(item.id)}
                              >
                                Hủy
                              </button>
                            </>
                          )}

                          {isCompleted && (
                            <button
                              type="button"
                              className="member-button member-button--soft"
                              disabled={actionId === item.id}
                              onClick={() => handleExportPdf(item.id)}
                            >
                              <ArrowDownToLine size={14} /> Xuất PDF
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer note */}
        <div className="pay-table-footer">
          <ShieldCheck size={14} />
          <span>
            Tất cả giao dịch được bảo vệ qua cổng thanh toán PayOS. Hóa đơn PDF có giá trị pháp lý
            và được sinh tự động bởi hệ thống QuestPDF.
          </span>
        </div>
      </div>

      {/* ─── Detail Modal ───────────────────────────────────────────── */}
      {viewing && (
        <div
          className="member-modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setViewing(null)}
        >
          <div className="member-modal member-modal--lg">
            <div className="member-modal-header">
              <h3>
                <ReceiptText size={20} /> Chi tiết giao dịch
              </h3>
              <button
                type="button"
                className="member-modal-close"
                onClick={() => setViewing(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="member-modal-body">
              {/* Status badge */}
              <div className="pay-detail-status-row">
                <span className={`member-status ${statusClass(viewing.status)}`}>
                  <span />
                  {statusLabel(viewing.status)}
                </span>
                <span className="pay-detail-id">
                  #{viewing.transactionReference || viewing.payOSOrderCode || viewing.id}
                </span>
              </div>

              {/* Info grid */}
              <div className="pay-detail-grid">
                <div className="pay-detail-item">
                  <small>Mã giao dịch nội bộ</small>
                  <strong>PAY-{viewing.id}</strong>
                </div>
                <div className="pay-detail-item">
                  <small>Mã PayOS Order</small>
                  <strong>{viewing.payOSOrderCode || '—'}</strong>
                </div>
                <div className="pay-detail-item">
                  <small>Mã đăng ký gói tập</small>
                  <strong>#SUB-{viewing.subscriptionId || '—'}</strong>
                </div>
                <div className="pay-detail-item">
                  <small>Phương thức thanh toán</small>
                  <strong>{viewing.paymentMethod || 'PayOS (Chuyển khoản)'}</strong>
                </div>
                <div className="pay-detail-item">
                  <small>Số tiền yêu cầu</small>
                  <strong className="pay-detail-amount">{formatCurrency(viewing.amount)}</strong>
                </div>
                <div className="pay-detail-item">
                  <small>Số tiền thực nhận</small>
                  <strong className="pay-detail-amount">
                    {viewing.amountReceived > 0 ? formatCurrency(viewing.amountReceived) : '—'}
                  </strong>
                </div>
                <div className="pay-detail-item">
                  <small>Ngày tạo giao dịch</small>
                  <strong>{formatDateTime(viewing.createdAt)}</strong>
                </div>
                <div className="pay-detail-item">
                  <small>Ngày thanh toán</small>
                  <strong>{formatDateTime(viewing.paidAt)}</strong>
                </div>
                {viewing.transactionReference && (
                  <div className="pay-detail-item pay-detail-item--full">
                    <small>Mã tham chiếu ngân hàng</small>
                    <strong>{viewing.transactionReference}</strong>
                  </div>
                )}
              </div>

              {/* QR / Checkout link for pending */}
              {String(viewing.status).toLowerCase() === 'pending' && viewing.checkoutUrl && (
                <div className="pay-detail-qr-section">
                  <div className="pay-detail-qr-header">
                    <QrCode size={20} />
                    <div>
                      <strong>Thanh toán qua mã QR hoặc liên kết</strong>
                      <p>Quét mã QR bằng ứng dụng ngân hàng hoặc bấm nút bên dưới để chuyển khoản.</p>
                    </div>
                  </div>
                  <div className="pay-detail-qr-body">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(viewing.checkoutUrl)}`}
                      alt="Mã QR thanh toán PayOS"
                      className="pay-detail-qr-img"
                    />
                    <div className="pay-detail-qr-info">
                      <p className="pay-detail-qr-amount">{formatCurrency(viewing.amount)}</p>
                      <button
                        type="button"
                        className="member-button member-button--primary"
                        onClick={() => handlePayOSCheckout(viewing)}
                      >
                        <ExternalLink size={14} /> Mở trang thanh toán PayOS
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer actions */}
            <div className="member-modal-footer">
              {String(viewing.status).toLowerCase() === 'pending' && (
                <>
                  <button
                    type="button"
                    className="member-button"
                    disabled={actionId === viewing.id}
                    onClick={() => handleSync(viewing.id)}
                  >
                    <RefreshCw
                      size={14}
                      className={actionId === viewing.id ? 'member-spin' : ''}
                    />{' '}
                    Đồng bộ trạng thái
                  </button>
                  <button
                    type="button"
                    className="member-button member-button--danger"
                    disabled={actionId === viewing.id}
                    onClick={() => handleCancel(viewing.id)}
                  >
                    <XCircle size={14} /> Hủy giao dịch
                  </button>
                </>
              )}
              {String(viewing.status).toLowerCase() === 'completed' && (
                <button
                  type="button"
                  className="member-button member-button--primary"
                  disabled={actionId === viewing.id}
                  onClick={() => handleExportPdf(viewing.id)}
                >
                  <ArrowDownToLine size={14} /> Tải hóa đơn PDF
                </button>
              )}
              <button
                type="button"
                className="member-button"
                onClick={() => setViewing(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
