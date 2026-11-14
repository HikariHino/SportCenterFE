import { useEffect, useId, useRef, useState } from 'react'
import { RefreshCw, WalletCards, X } from 'lucide-react'
import { getMembers } from '../../services/memberService'
import { getReceptionistMemberSubscriptions, getReceptionistSubscriptionById } from '../../services/memberSubscriptionService'
import { checkoutReceptionistSubscription, getReceptionistPaymentError } from '../../services/receptionistPaymentService'
import { formatDateTime } from './ReceptionistViewShared'

const currency = amount => `${Number(amount).toLocaleString('vi-VN')} đ`

export default function CheckoutDialog({ onClose, onCreated, memberId: fixedMemberId, subscriptionId: initialSubscriptionId, counterOnly = false, initialPaymentMethod = 'Cash' }) {
  const titleId = useId()
  const [members, setMembers] = useState([])
  const [query, setQuery] = useState('')
  const [memberId, setMemberId] = useState(fixedMemberId ? String(fixedMemberId) : '')
  const [subscriptions, setSubscriptions] = useState([])
  const [subscriptionId, setSubscriptionId] = useState(initialSubscriptionId ? String(initialSubscriptionId) : '')
  const [detail, setDetail] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState(counterOnly ? (['Cash', 'BankTransfer', 'CreditCard'].includes(initialPaymentMethod) ? initialPaymentMethod : 'Cash') : 'PayOS')
  const [received, setReceived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [requiresRefresh, setRequiresRefresh] = useState(false)
  const [requestKey, setRequestKey] = useState(0)
  const lock = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    getMembers().then(items => { if (active) setMembers(items) })
      .catch(error => { if (active) setError(getReceptionistPaymentError(error, 'Không thể tải danh sách hội viên.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [requestKey])

  useEffect(() => {
    let active = true
    setSubscriptions([])
    setDetail(null)
    if (!memberId) { setOrdersLoading(false); return () => { active = false } }
    setOrdersLoading(true)
    getReceptionistMemberSubscriptions(memberId).then(items => {
      if (active) setSubscriptions(items.filter(item => String(item.memberId) === memberId && String(item.status).toLowerCase() === 'pending'))
    }).catch(error => { if (active) setError(getReceptionistPaymentError(error, 'Không thể tải đơn của hội viên.')) })
      .finally(() => { if (active) setOrdersLoading(false) })
    return () => { active = false }
  }, [memberId, requestKey])

  useEffect(() => {
    let active = true
    setDetail(null)
    setReceived(false)
    if (!subscriptionId) { setDetailLoading(false); return () => { active = false } }
    setDetailLoading(true)
    getReceptionistSubscriptionById(subscriptionId).then(result => {
      if (String(result?.id) !== subscriptionId || String(result.memberId) !== memberId) throw new Error('Đơn không khớp hội viên đã chọn.')
      if (String(result.status).toLowerCase() !== 'pending') throw new Error('Đơn không còn chờ thanh toán. Hãy tải lại danh sách.')
      if (!Number.isFinite(Number(result.agreedPrice)) || Number(result.agreedPrice) <= 0 || !Array.isArray(result.payments)) throw new Error('Chi tiết số tiền hoặc biên nhận chưa đầy đủ. Hãy tải lại đơn.')
      if (active) { setDetail(result); setRequiresRefresh(false) }
    }).catch(error => { if (active) setError(getReceptionistPaymentError(error, 'Không thể tải chi tiết đơn.')) })
      .finally(() => { if (active) setDetailLoading(false) })
    return () => { active = false }
  }, [subscriptionId, memberId, requestKey])

  const selectedOrder = String(detail?.id) === subscriptionId && String(detail?.memberId) === memberId ? detail : null
  const busy = saving || loading || ordersLoading || detailLoading
  const search = query.trim().toLocaleLowerCase('vi')
  const visibleMembers = members.filter(member => String(member.memberId) === memberId || !search
    || [member.fullName, member.email, member.phone, member.memberId].some(value => String(value || '').toLocaleLowerCase('vi').includes(search)))

  async function submit(event) {
    event.preventDefault()
    if (lock.current || busy || requiresRefresh || !selectedOrder) return
    lock.current = true
    setSaving(true)
    setError('')
    try {
      const payment = await checkoutReceptionistSubscription({ memberId, subscriptionId, amount: selectedOrder.agreedPrice, paymentMethod, paymentReceived: received })
      if (mounted.current) { onCreated(payment); onClose() }
    } catch (error) {
      if (mounted.current) { setError(getReceptionistPaymentError(error)); setRequiresRefresh(true); setReceived(false) }
    } finally {
      lock.current = false
      if (mounted.current) setSaving(false)
    }
  }

  return <div className={`reception-dialog-backdrop${fixedMemberId ? ' reception-nested-dialog' : ''}`} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="reception-dialog reception-checkout-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy}>
      <header><div><span>THANH TOÁN TẠI QUẦY</span><h2 id={titleId}>Thanh toán gói hội viên</h2><p>Chọn hội viên, đơn đang chờ và cách thanh toán.</p></div><button type="button" aria-label="Đóng thanh toán" disabled={saving} onClick={onClose}><X size={19} /></button></header>
      <form onSubmit={submit}>
        <div className="reception-checkout-fields">
          <label>Tìm hội viên<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tên, mã, email hoặc số điện thoại" disabled={saving} autoFocus /></label>
          <label>Hội viên<select value={memberId} required disabled={saving || loading || !!fixedMemberId} onChange={event => { setMemberId(event.target.value); setSubscriptionId(''); setError(''); setRequiresRefresh(false) }}><option value="">{loading ? 'Đang tải hội viên...' : 'Chọn hội viên'}</option>{visibleMembers.map(member => <option key={member.memberId} value={member.memberId}>#{member.memberId} · {member.fullName} · {member.phone || member.email}</option>)}</select></label>
          <label>Đơn đăng ký đang chờ<select value={subscriptionId} required disabled={saving || ordersLoading || !memberId || !!initialSubscriptionId} onChange={event => { setSubscriptionId(event.target.value); setError(''); setReceived(false); setRequiresRefresh(false) }}><option value="">{ordersLoading ? 'Đang tải đơn...' : 'Chọn đơn đăng ký'}</option>{subscriptions.map(item => <option key={item.id} value={item.id}>#{item.id} · {item.packageName} · {currency(item.agreedPrice)}</option>)}</select></label>
          {memberId && !ordersLoading && !subscriptions.length && <p role="status">Hội viên chưa có đơn đang chờ. Hãy tạo đăng ký gói ở tab Hội viên trước.</p>}
          {detailLoading && <p role="status">Đang kiểm tra đơn và biên nhận...</p>}
          {selectedOrder && <div className="reception-checkout-summary"><WalletCards size={24} /><div><strong>{selectedOrder.packageName}</strong><small>Đơn #{selectedOrder.id} · {selectedOrder.durationInDays} ngày · {formatDateTime(selectedOrder.createdAt)}</small></div><b>{currency(selectedOrder.agreedPrice)}</b></div>}
          <label>Phương thức<select value={paymentMethod} disabled={saving} onChange={event => { setPaymentMethod(event.target.value); setReceived(false) }}>{!counterOnly && <option value="PayOS">PayOS · QR / liên kết thanh toán</option>}<option value="Cash">Tiền mặt</option><option value="BankTransfer">Chuyển khoản tại quầy</option><option value="CreditCard">Thẻ tín dụng tại quầy</option></select></label>
        </div>
        {paymentMethod === 'PayOS' ? <p className="reception-checkout-note">Gói chỉ được kích hoạt sau khi hệ thống xác nhận thanh toán thành công. Nếu đã có yêu cầu PayOS đang chờ, liên kết đó sẽ được dùng lại.</p>
          : <label className="reception-payment-confirm"><input type="checkbox" checked={received} required disabled={saving} onChange={event => setReceived(event.target.checked)} /><span><strong>Tôi đã thực nhận đủ tiền theo giá của đơn</strong><small>Chỉ ghi nhận khoản tiền đã thu; thao tác này không tự trừ tiền ngân hàng hoặc thẻ.</small></span></label>}
        {error && <p className="reception-form-error" role="alert">{error}</p>}
        <footer><button type="button" disabled={saving} onClick={() => { setError(''); setRequestKey(key => key + 1) }}><RefreshCw size={14} />Tải lại trạng thái</button><button type="button" disabled={saving} onClick={onClose}>Đóng</button><button type="submit" disabled={busy || !selectedOrder || requiresRefresh || (paymentMethod !== 'PayOS' && !received)}>{saving ? 'Đang xử lý...' : paymentMethod === 'PayOS' ? 'Tạo / mở PayOS' : 'Xác nhận thu tiền'}</button></footer>
      </form>
    </section>
  </div>
}
