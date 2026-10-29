import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowUpRight, CheckCircle2, CreditCard, LoaderCircle, RefreshCw, X } from 'lucide-react'
import { createReviewedSubscription, prepareSubscriptionPurchase } from '../services/subscriptionPurchaseService'
import { getPackageErrorMessage } from '../services/membershipPackageService'
import { membershipPackageTypeLabel } from '../utils/memberSubscriptions'
import '../style/SubscriptionPurchaseDialog.css'

const money = value => `${Number(value).toLocaleString('vi-VN')} đ`
const date = value => value ? new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Khi thanh toán thành công'

export default function SubscriptionPurchaseDialog({ pkg, memberId, onClose, onCreated }) {
  const dialogRef = useRef(null)
  const locked = useRef(false)
  const mounted = useRef(false)
  const [purchase, setPurchase] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    mounted.current = true
    dialogRef.current.showModal()
    return () => { mounted.current = false }
  }, [])
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    prepareSubscriptionPurchase(pkg.id, memberId).then(result => { if (active) setPurchase(result) })
      .catch(requestError => { if (active) { setPurchase(null); setError(getPackageErrorMessage(requestError)) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [pkg.id, memberId, revision])

  const submit = async () => {
    if (locked.current || loading || !purchase || purchase.reason) return
    locked.current = true
    setSaving(true)
    setError('')
    try {
      const result = await createReviewedSubscription(purchase)
      if (!mounted.current) return
      if (result.changed) {
        setPurchase(result.purchase)
        setError('Điều kiện hoặc số tiền vừa thay đổi. Vui lòng kiểm tra lại trước khi xác nhận.')
        return
      }
      onCreated(result.subscription, result.purchase)
    } catch (requestError) {
      if (mounted.current) setError(getPackageErrorMessage(requestError, 'Không thể tạo đơn đăng ký gói.'))
    } finally {
      locked.current = false
      if (mounted.current) setSaving(false)
    }
  }
  const preview = purchase?.preview
  const upgrading = preview?.canUpgrade === true
  return <dialog ref={dialogRef} className="subscription-purchase-dialog" aria-labelledby="subscription-purchase-title" onCancel={event => { event.preventDefault(); if (!locked.current) onClose() }}>
    <header><div><p>{membershipPackageTypeLabel(pkg)}{memberId ? ` · Hội viên #${memberId}` : ''}</p><h2 id="subscription-purchase-title">{upgrading ? 'Xác nhận nâng cấp gói' : 'Xác nhận đăng ký gói'}</h2></div><button type="button" aria-label="Đóng xác nhận đăng ký gói" disabled={saving} onClick={onClose}><X size={20} /></button></header>
    <div className="subscription-purchase-body">
      <h3>{preview?.targetPackageName || pkg.packageName}</h3>
      {loading ? <p role="status"><LoaderCircle className="member-spin" size={20} />Đang kiểm tra điều kiện và số tiền từ trung tâm...</p> : preview && <>
        <p className="subscription-purchase-message">{preview.message}</p>
        <dl className="subscription-purchase-breakdown">
          {upgrading && <div><dt>Gói đang dùng</dt><dd>{preview.currentPackageName}</dd></div>}
          <div><dt>Giá gói mới</dt><dd>{money(preview.targetPackagePrice)}</dd></div>
          {upgrading && <div><dt>Giá trị gói cũ được trừ</dt><dd>− {money(preview.discountAmount)}</dd></div>}
          <div className="subscription-purchase-total"><dt>{upgrading ? 'Chênh lệch cần thanh toán' : 'Số tiền cần thanh toán'}</dt><dd>{money(preview.amountToPay)}</dd></div>
          <div><dt>Thời hạn gói mới</dt><dd>{purchase.pkg.durationInDays} ngày</dd></div>
          {upgrading && <><div><dt>Ngày bắt đầu giữ nguyên</dt><dd>{date(preview.newStartDate)}</dd></div><div><dt>Ngày hết hạn dự kiến</dt><dd>{date(preview.newEndDate)}</dd></div></>}
        </dl>
        <p className="subscription-purchase-note"><CheckCircle2 size={18} />{upgrading ? 'Gói cũ vẫn dùng được khi chờ thanh toán. Sau khi thanh toán thành công, gói mới được kích hoạt và gói cũ chuyển sang Đã nâng cấp.' : 'Thẻ Standard và thẻ PT 1-1 được dùng song song. Gói mới chỉ có hiệu lực sau khi thanh toán thành công.'}</p>
        {!upgrading && <p className="subscription-purchase-note">Thời hạn được tính từ thời điểm kích hoạt sau thanh toán.</p>}
        {purchase.reason && <p role="alert" className="subscription-purchase-error"><AlertCircle size={18} />{purchase.reason}</p>}
      </>}
      {error && <p role="alert" className="subscription-purchase-error"><AlertCircle size={18} />{error}</p>}
    </div>
    <footer><button type="button" disabled={saving} onClick={onClose}>Quay lại</button>{error && <button type="button" disabled={loading || saving} onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} />Tải lại</button>}<button type="button" className="primary" disabled={loading || saving || !purchase || Boolean(purchase.reason)} onClick={submit}>{saving ? <LoaderCircle className="member-spin" size={16} /> : upgrading ? <ArrowUpRight size={16} /> : <CreditCard size={16} />}{saving ? 'Đang tạo đơn...' : upgrading ? 'Tạo đơn nâng cấp' : 'Tạo đơn đăng ký'}</button></footer>
  </dialog>
}
