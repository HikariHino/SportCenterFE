import { useEffect, useId, useRef, useState } from 'react'
import { ArrowUpRight, Check, RefreshCw, WalletCards, X } from 'lucide-react'
import { getMembers } from '../../services/memberService'
import { getMembershipPackages } from '../../services/membershipPackageService'
import { getReceptionistPaymentError } from '../../services/receptionistPaymentService'
import { checkoutReceptionistPackageOrder, createReceptionistCheckoutOrder, loadReceptionistPackageOptions, prepareReceptionistPackageCheckout, recoverReceptionistCheckoutOrder } from '../../services/receptionistPackageCheckout'
import { membershipPackageTypeLabel } from '../../utils/memberSubscriptions'
import CatalogImage from '../../components/CatalogImage'
import '../../style/Receptionist/PackageCheckoutDialog.css'

const money = value => `${Number(value || 0).toLocaleString('vi-VN')} đ`

export default function PackageCheckoutDialog({ onClose, onCreated, onOrderCreated }) {
  const titleId = useId()
  const [members, setMembers] = useState([])
  const [query, setQuery] = useState('')
  const [memberId, setMemberId] = useState('')
  const [catalog, setCatalog] = useState(null)
  const [checkedPackages, setCheckedPackages] = useState(null)
  const [packageId, setPackageId] = useState('')
  const [purchase, setPurchase] = useState(null)
  const [order, setOrder] = useState(null)
  const [method, setMethod] = useState('PayOS')
  const [received, setReceived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [requiresRefresh, setRequiresRefresh] = useState(false)
  const lock = useRef(false)
  const attempted = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  useEffect(() => {
    let active = true
    getMembers().then(items => { if (active) setMembers(items) })
      .catch(error => { if (active) setError(getReceptionistPaymentError(error, 'Không thể tải danh sách hội viên.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    getMembershipPackages().then(items => {
      if (active) setCatalog(items)
    }).catch(error => { if (active) { setCatalog([]); setError(getReceptionistPaymentError(error, 'Không thể tải danh mục gói tập.')) } })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    setPackageId(''); setPurchase(null); setOrder(null); setReceived(false); setRequiresRefresh(false)
    setCheckedPackages(null)
    attempted.current = false
    if (!memberId) {
      setPackagesLoading(false)
      return () => { active = false }
    }
    setPackagesLoading(true)
    loadReceptionistPackageOptions(memberId).then(items => { if (active) { setCatalog(items); setCheckedPackages({ memberId, items }) } })
      .catch(error => { if (active) setError(getReceptionistPaymentError(error)) })
      .finally(() => { if (active) setPackagesLoading(false) })
    return () => { active = false }
  }, [memberId])

  useEffect(() => {
    let active = true
    setPurchase(null); setReceived(false)
    if (!packageId || checkedPackages?.memberId !== memberId) { setPreviewLoading(false); return () => { active = false } }
    setPreviewLoading(true)
    prepareReceptionistPackageCheckout(packageId, memberId).then(result => { if (active) setPurchase(result) })
      .catch(error => { if (active) setError(getReceptionistPaymentError(error)) })
      .finally(() => { if (active) setPreviewLoading(false) })
    return () => { active = false }
  }, [packageId, memberId, checkedPackages?.memberId])

  const busy = loading || packagesLoading || previewLoading || saving || refreshing
  const frozen = saving || refreshing || Boolean(order) || requiresRefresh
  const packagesChecked = Boolean(memberId) && checkedPackages?.memberId === memberId
  const packages = packagesChecked ? checkedPackages.items : (catalog || [])
  const search = query.trim().toLocaleLowerCase('vi')
  const visibleMembers = members.filter(member => String(member.memberId) === memberId || !search
    || [member.fullName, member.email, member.phone, member.memberId].some(value => String(value || '').toLocaleLowerCase('vi').includes(search)))
  const amount = order?.agreedPrice ?? purchase?.preview?.amountToPay
  const ready = !busy && !requiresRefresh && (order || (packagesChecked && purchase && !purchase.reason)) && (method === 'PayOS' || received)

  async function reload() {
    if (lock.current) return
    lock.current = true; setRefreshing(true); setError('')
    try {
      if (attempted.current) {
        const recovered = await recoverReceptionistCheckoutOrder(memberId, packageId)
        if (!mounted.current) return
        setOrder(recovered)
        if (recovered) onOrderCreated?.(recovered)
        else {
          attempted.current = false
          setPurchase(await prepareReceptionistPackageCheckout(packageId, memberId))
        }
      } else if (memberId) {
        const options = await loadReceptionistPackageOptions(memberId)
        if (!mounted.current) return
        setCatalog(options)
        setCheckedPackages({ memberId, items: options })
        if (packageId) setPurchase(await prepareReceptionistPackageCheckout(packageId, memberId))
      } else {
        const [items, packageList] = await Promise.all([getMembers(), getMembershipPackages()])
        if (mounted.current) { setMembers(items); setCatalog(packageList) }
      }
      if (mounted.current) { setRequiresRefresh(false); setReceived(false) }
    } catch (error) { if (mounted.current) { setError(getReceptionistPaymentError(error)); setRequiresRefresh(true) } }
    finally { lock.current = false; if (mounted.current) setRefreshing(false) }
  }

  async function submit(event) {
    event.preventDefault()
    if (lock.current || !ready) return
    lock.current = true; setSaving(true); setError('')
    try {
      let selected = order
      if (!selected) {
        attempted.current = true
        const result = await createReceptionistCheckoutOrder(purchase)
        if (!mounted.current) return
        if (result.changed) {
          attempted.current = false
          setPurchase(result.purchase)
          setReceived(false)
          setError(result.purchase.reason || 'Điều kiện hoặc số tiền đã thay đổi. Vui lòng xem lại và xác nhận lần nữa.')
          return
        }
        selected = result.subscription
        setOrder(selected)
        onOrderCreated?.(selected)
      }
      const payment = await checkoutReceptionistPackageOrder({ memberId, packageId, subscriptionId: selected.id, amount: selected.agreedPrice, paymentMethod: method, paymentReceived: received })
      if (mounted.current) { onCreated(payment); onClose() }
    } catch (error) {
      if (mounted.current) { setError(getReceptionistPaymentError(error)); setRequiresRefresh(true); setReceived(false) }
    } finally { lock.current = false; if (mounted.current) setSaving(false) }
  }

  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving && !refreshing) onClose() }}>
    <section className="reception-dialog reception-checkout-dialog reception-package-checkout-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy}>
      <header><div><span>THANH TOÁN TẠI QUẦY</span><h2 id={titleId}>Thanh toán gói hội viên</h2><p>Chọn hội viên, gói tập và phương thức thanh toán.</p></div><button type="button" aria-label="Đóng thanh toán" disabled={saving || refreshing} onClick={onClose}><X size={19} /></button></header>
      <form onSubmit={submit}>
        <div className="reception-package-checkout-body">
        <div className="reception-checkout-fields">
          <label>Tìm hội viên<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tên, mã, email hoặc số điện thoại" disabled={frozen} autoFocus /></label>
          <label>Hội viên<select value={memberId} required disabled={frozen || loading} onChange={event => { setMemberId(event.target.value); setError('') }}><option value="">{loading ? 'Đang tải hội viên...' : 'Chọn hội viên'}</option>{visibleMembers.map(member => <option key={member.memberId} value={member.memberId}>#{member.memberId} · {member.fullName} · {member.phone || member.email}</option>)}</select></label>
        </div>
        <fieldset className="reception-checkout-packages"><legend>Chọn gói tập</legend>
          {packages.length > 0 && !packagesChecked && <p role="status">{!memberId ? 'Chọn hội viên để kiểm tra điều kiện gói.' : packagesLoading ? 'Đang kiểm tra gói của hội viên...' : 'Chưa kiểm tra được điều kiện gói. Hãy tải lại trạng thái.'}</p>}
          {!packages.length ? <p>{catalog === null || packagesLoading ? 'Đang tải danh mục gói tập...' : 'Chưa có gói tập để lựa chọn. Hãy tải lại trạng thái.'}</p> : <div className="reception-checkout-package-grid">{packages.map(pkg => <button type="button" key={pkg.id} aria-label={`Chọn gói ${pkg.packageName}`} aria-pressed={packagesChecked && packageId === String(pkg.id)} disabled={frozen || !packagesChecked || Boolean(pkg.disabledReason)} title={packagesChecked ? pkg.disabledReason || undefined : undefined} onClick={() => { setPackageId(String(pkg.id)); setError('') }}>
            <CatalogImage src={pkg.imageUrl} /><span><strong>{pkg.packageName}</strong><small>{membershipPackageTypeLabel(pkg)} · {pkg.durationInDays} ngày</small><b>{money(pkg.price)}</b>{packagesChecked && pkg.disabledReason && <em>{pkg.disabledReason.replaceAll('Bạn', 'Hội viên')}</em>}</span>{packagesChecked && packageId === String(pkg.id) && <Check size={18} />}
          </button>)}</div>}
        </fieldset>
        {previewLoading && <p role="status">Đang lấy số tiền và điều kiện nâng cấp từ trung tâm...</p>}
        {purchase?.preview && <div className="reception-checkout-purchase" aria-label="Thông tin gói và số tiền thanh toán">
          <strong>{purchase.preview.canUpgrade ? <><ArrowUpRight size={18} />Nâng cấp gói tập</> : <><WalletCards size={18} />Đăng ký gói tập</>}</strong>
          {purchase.preview.canUpgrade && <p>Gói đang dùng: {purchase.preview.currentPackageName}</p>}
          <dl><div><dt>Giá gói mới</dt><dd>{money(purchase.preview.targetPackagePrice)}</dd></div>{purchase.preview.canUpgrade && <div><dt>Giá trị được khấu trừ</dt><dd>− {money(purchase.preview.discountAmount)}</dd></div>}<div><dt>Cần thanh toán</dt><dd>{money(amount)}</dd></div></dl>
          <p>Gói mới chỉ được kích hoạt khi thanh toán thành công.{purchase.preview.canUpgrade ? ' Gói đang dùng được giữ trong thời gian chờ thanh toán.' : ''}</p>
          {order && <small>Đã tạo đơn #SUB-{order.id}. Tiếp tục thanh toán cho đơn này.</small>}
        </div>}
        {purchase?.reason && !order && <p className="reception-form-error" role="alert">{purchase.reason}</p>}
        <label className="reception-checkout-method">Phương thức<select value={method} disabled={saving || refreshing} onChange={event => { setMethod(event.target.value); setReceived(false) }}><option value="PayOS">Thanh toán chuyển khoản</option><option value="Cash">Tiền mặt</option></select></label>
        {method === 'PayOS' ? <p className="reception-checkout-note">Nhấn Trả tiền để chuyển đến trang thanh toán. Khi quay lại, hệ thống kiểm tra kết quả và cập nhật giao dịch.</p> : <label className="reception-payment-confirm"><input type="checkbox" required checked={received} disabled={saving || refreshing} onChange={event => setReceived(event.target.checked)} /><span><strong>Tôi đã thực nhận đủ {money(amount)}</strong><small>Chỉ xác nhận sau khi đã nhận đủ tiền của hội viên.</small></span></label>}
        {error && <p className="reception-form-error" role="alert">{error}</p>}
        </div>
        <footer><button type="button" disabled={busy} onClick={reload}><RefreshCw size={15} />Tải lại trạng thái</button><button type="button" disabled={saving || refreshing} onClick={onClose}>Đóng</button><button type="submit" disabled={!ready}>{saving ? 'Đang xử lý...' : method === 'PayOS' ? 'Trả tiền' : 'Xác nhận thu tiền'}</button></footer>
      </form>
    </section>
  </div>
}
