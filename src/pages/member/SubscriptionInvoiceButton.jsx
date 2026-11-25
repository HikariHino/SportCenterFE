import { formatBankingText, paymentMethodLabel } from '../../utils/paymentPresentation'
import { useEffect, useId, useRef, useState } from 'react'
import { ArrowDownToLine, LoaderCircle, X } from 'lucide-react'
import { getMyPayments } from '../../services/paymentService'
import { exportInvoicePdf, triggerBlobDownload } from '../../services/reportService'
import { paymentStatus } from '../../utils/memberPayments'
import { subscriptionStatus } from '../../utils/memberSubscriptions'
import { useMemberViewActive } from '../../contexts/MemberWorkspaceContext'

export default function SubscriptionInvoiceButton({ subscription, disabled = false }) {
  const viewActive = useMemberViewActive()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [choices, setChoices] = useState([])
  const lock = useRef(false)
  const mounted = useRef(false)
  const dialog = useRef(null)
  const titleId = useId()
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!choices.length || !viewActive) return
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [choices, viewActive])

  const eligible = ['active', 'expired', 'upgraded'].includes(subscriptionStatus(subscription))
    || (Array.isArray(subscription.payments) && subscription.payments.some(payment => paymentStatus(payment) === 'completed'))

  async function download(payment) {
    const blob = await exportInvoicePdf(payment.id)
    if (mounted.current) triggerBlobDownload(blob, `hoa-don-olympus-${payment.id}.pdf`)
  }

  async function exportInvoice(payment) {
    if (lock.current || disabled) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      if (payment) await download(payment)
      else {
        // Subscription IDs and payment IDs differ. Always resolve a confirmed
        // receipt from the current member's payments before exporting its PDF.
        const payments = await getMyPayments()
        if (!mounted.current) return
        const completed = payments.filter(item => String(item.subscriptionId) === String(subscription.id)
          && paymentStatus(item) === 'completed')
        if (!completed.length) throw new Error('Chưa tìm thấy giao dịch đã thanh toán cho đơn này. Vui lòng làm mới hoặc liên hệ lễ tân.')
        if (completed.some(item => !Number.isSafeInteger(Number(item.id)) || Number(item.id) <= 0)) throw new Error('Thông tin hóa đơn không hợp lệ. Vui lòng làm mới và thử lại.')
        if (completed.length === 1) await download(completed[0])
        else setChoices(completed)
      }
    } catch (failure) {
      if (mounted.current) setError(formatBankingText(failure.response?.data?.message || failure.message || 'Không thể tải hóa đơn PDF. Vui lòng thử lại.'))
    } finally {
      lock.current = false
      if (mounted.current) setBusy(false)
    }
  }

  if (!eligible) return null
  return <div className="member-sub-invoice">
    <button type="button" className="member-button" disabled={disabled || busy}
      aria-label={`Xuất hóa đơn PDF cho đơn SUB-${subscription.id}`} onClick={() => exportInvoice()}>
      {busy ? <LoaderCircle size={15} className="member-spin" /> : <ArrowDownToLine size={15} />}
      {busy ? 'Đang tải PDF...' : 'Xuất PDF'}
    </button>
    {error && !choices.length && <p className="member-sub-invoice-error" role="alert">{error}</p>}
    {viewActive && choices.length > 0 && <dialog ref={dialog} className="member-sub-invoice-dialog" aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); event.stopPropagation(); if (!busy) setChoices([]) }}
      onClick={event => event.stopPropagation()}>
      <header><h3 id={titleId}>Hóa đơn của đơn #SUB-{subscription.id}</h3><button type="button" className="member-button" aria-label="Đóng danh sách hóa đơn" disabled={busy} onClick={() => setChoices([])}><X size={18} /></button></header>
      <p>Chọn giao dịch đã thanh toán để tải hóa đơn.</p>
      {error && <p className="member-sub-invoice-error" role="alert">{error}</p>}
      <ul>{choices.map(item => <li key={item.id}><span><strong>#PAY-{item.id}</strong> · {Number(item.amount).toLocaleString('vi-VN')} đ · {paymentMethodLabel(item.paymentMethod, 'Thanh toán')}</span><button type="button" className="member-button" disabled={busy} onClick={() => exportInvoice(item)}><ArrowDownToLine size={15} />Tải PDF</button></li>)}</ul>
    </dialog>}
  </div>
}
