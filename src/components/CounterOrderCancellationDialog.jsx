import { useEffect, useId, useRef, useState } from 'react'
import { AlertCircle, Ban, LoaderCircle, X } from 'lucide-react'
import { cancelSubscriptionOrder } from '../services/subscriptionCancellationService'
import { getPackageErrorMessage } from '../services/membershipPackageService'
import { counterOrderCancellationReason } from '../utils/counterOrders'
import '../style/SubscriptionPurchaseDialog.css'

export default function CounterOrderCancellationDialog({ subscription, currentPayment, onClose, onCancelled, onBusyChange }) {
  const dialogRef = useRef(null)
  const locked = useRef(false)
  const mounted = useRef(false)
  const titleId = useId()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const blockedReason = counterOrderCancellationReason(subscription, currentPayment)
  useEffect(() => {
    mounted.current = true
    const dialog = dialogRef.current
    dialog.showModal()
    return () => { mounted.current = false; dialog.close() }
  }, [])

  const submit = async event => {
    event.preventDefault()
    if (locked.current || blockedReason) return
    locked.current = true
    setSaving(true)
    setError('')
    onBusyChange?.(true)
    try {
      const cancelled = await cancelSubscriptionOrder(subscription.id)
      if (!mounted.current) return
      onCancelled(cancelled)
      onClose()
    } catch (requestError) {
      if (mounted.current) setError(getPackageErrorMessage(requestError, 'Chưa hủy được đơn thanh toán. Vui lòng thử lại.'))
    } finally {
      locked.current = false
      onBusyChange?.(false)
      if (mounted.current) setSaving(false)
    }
  }

  return <dialog ref={dialogRef} className="subscription-purchase-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!locked.current) onClose() }}>
    <form onSubmit={submit}>
      <header><div><p>ĐƠN CHỜ THANH TOÁN #{subscription.id}</p><h2 id={titleId}>Hủy đơn thanh toán tại quầy?</h2></div><button type="button" aria-label="Đóng xác nhận hủy đơn" onClick={onClose} disabled={saving}><X size={20} /></button></header>
      <div className="subscription-purchase-body">
        <h3>{subscription.packageName}</h3>
        <dl className="subscription-purchase-breakdown"><div><dt>Số tiền của đơn</dt><dd>{Number(subscription.agreedPrice || 0).toLocaleString('vi-VN')} đ</dd></div><div><dt>Hội viên</dt><dd>#{subscription.memberId}</dd></div></dl>
        <p>Chỉ xác nhận hủy khi chưa thu tiền cho đơn này. Đơn đã hủy sẽ không còn chờ thanh toán hoặc kích hoạt gói.</p>
        <p className="subscription-purchase-note">Nếu có liên kết PayOS đang chờ, hệ thống sẽ đóng liên kết trước khi hủy đơn. Gói đang sử dụng của hội viên vẫn được giữ nguyên.</p>
        {(blockedReason || error) && <p className="subscription-purchase-error" role="alert"><AlertCircle size={18} />{blockedReason || error}</p>}
      </div>
      <footer><button type="button" autoFocus onClick={onClose} disabled={saving}>Quay lại</button><button type="submit" className="danger" disabled={saving || Boolean(blockedReason)}>{saving ? <LoaderCircle size={16} className="member-spin" /> : <Ban size={16} />}{saving ? 'Đang hủy đơn...' : 'Xác nhận hủy đơn'}</button></footer>
    </form>
  </dialog>
}
