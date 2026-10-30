import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CreditCard, Award, CheckCircle2, AlertCircle, LoaderCircle,
  Coins, Info, Search, Eye, Sparkles, X,
  CalendarDays, ArrowRight, Trash2, Ban, ReceiptText,
  Clock, ShieldAlert, ShieldCheck, RefreshCw, LockKeyhole,
} from 'lucide-react'
import { getMembershipPackages, getMembershipPackageById, getPackageErrorMessage } from '../../services/membershipPackageService'
import {
  getMySubscriptions,
  getSubscriptionById,
} from '../../services/memberSubscriptionService'
import { createPayment } from '../../services/paymentService'
import { canCheckoutPayOSPayment, paymentCheckoutMessage } from '../../utils/memberPayments'
import { cancelSubscriptionOrder } from '../../services/subscriptionCancellationService'
import { currentSubscriptionForPackage, membershipPackageType, membershipPackageTypeLabel, mergeConfirmedSubscriptionCancellations, subscriptionDisplayStatusLabel, subscriptionPackageReason, subscriptionPaymentState, subscriptionRegistrationReason, subscriptionStatus, subscriptionStatusLabel } from '../../utils/memberSubscriptions'
import SubscriptionPurchaseDialog from '../../components/SubscriptionPurchaseDialog'
import '../../style/member/SubscriptionsView.css'
import '../../style/member/SubscriptionsLayout.css'

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')} đ`
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN')
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function CheckoutFeedback({ feedback }) {
  if (!feedback) return null
  return <div className={`member-sub-message ${feedback.error ? 'is-error' : 'is-success'}`} role={feedback.error ? 'alert' : 'status'}><AlertCircle size={18} /><p>{feedback.message}</p></div>
}

export function SubscriptionsView({ showNotice }) {
  const [searchParams] = useSearchParams()
  const requestedPackage = searchParams.get('packageId')
  const openedLandingPackage = useRef(null)
  const [packages, setPackages] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subscribingId, setSubscribingId] = useState(null)
  const registrationLock = useRef(false)
  const confirmedCancellations = useRef(new Map())
  const [registrationError, setRegistrationError] = useState('')
  const [tab, setTab] = useState(() => searchParams.get('catalog') === '1' ? 'catalog' : 'mine')
  const [now, setNow] = useState(Date.now)

  // Bộ lọc & tìm kiếm danh mục gói tập mở bán
  const [packageSearch, setPackageSearch] = useState('')
  const [packageFilter, setPackageFilter] = useState('all')
  const [packageTypeFilter, setPackageTypeFilter] = useState('all')
  const [purchasePackage, setPurchasePackage] = useState(null)

  // Bộ lọc & tìm kiếm danh sách gói cá nhân
  const [subSearch, setSubSearch] = useState('')
  const [subFilter, setSubFilter] = useState('all')

  // Modals
  const [viewingPackage, setViewingPackage] = useState(null)
  const [packageDetailLoading, setPackageDetailLoading] = useState(false)
  const [registrationSuccessSub, setRegistrationSuccessSub] = useState(null)
  const [payingSubId, setPayingSubId] = useState(null)
  const [checkoutFeedback, setCheckoutFeedback] = useState(null)

  // Modal xem chi tiết đăng ký cá nhân (GET /api/member-subscriptions/{id})
  const [viewingSub, setViewingSub] = useState(null)
  const [subDetailLoading, setSubDetailLoading] = useState(false)

  // Modal xác nhận hủy gói tập Pending (POST /api/member-subscriptions/{id}/cancel)
  const [cancellingSub, setCancellingSub] = useState(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState('')

  const applySubscriptionData = items => setSubscriptions(mergeConfirmedSubscriptionCancellations(items, confirmedCancellations.current))

  const loadData = async () => {
    setLoading(true)
    setError('')
    setRegistrationError('')
    try {
      const [pkgs, subs] = await Promise.all([
        getMembershipPackages(),
        getMySubscriptions(),
      ])
      setPackages(Array.isArray(pkgs) ? pkgs : [])
      applySubscriptionData(Array.isArray(subs) ? subs : [])
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách gói tập.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  // Mở modal xem chi tiết gói tập mở bán (GET /api/membership-packages/{id})
  const handleOpenPackageDetail = async (pkg) => {
    setPackageDetailLoading(true)
    setViewingPackage(pkg)
    try {
      const detail = await getMembershipPackageById(pkg.id)
      if (detail) {
        setViewingPackage(detail)
      }
    } catch (err) {
      console.warn('Lỗi khi tải chi tiết gói:', err)
    } finally {
      setPackageDetailLoading(false)
    }
  }

  useEffect(() => {
    if (loading || error || !/^[1-9]\d*$/.test(requestedPackage || '') || openedLandingPackage.current === requestedPackage) return
    openedLandingPackage.current = requestedPackage
    const selected = packages.find(pkg => String(pkg.id) === requestedPackage && pkg.isActive !== false)
    setTab('catalog')
    if (selected) handleOpenPackageDetail(selected)
    else setRegistrationError('Gói bạn chọn hiện không còn mở bán. Vui lòng chọn gói khác trong danh mục.')
  }, [loading, error, requestedPackage, packages])

  const handleRegister = (pkg) => {
    if (registrationLock.current || loading) return
    const reason = packageReason(pkg)
    if (reason) { setRegistrationError(reason); return }
    setRegistrationError('')
    setViewingPackage(null)
    setPurchasePackage(pkg)
  }

  const handlePurchaseCreated = async (sub, purchase) => {
    setPurchasePackage(null)
    registrationLock.current = true
    setSubscribingId(sub.packageId)
    setRegistrationError('')
    try {
      const created = { ...purchase.pkg, ...sub, status: sub.status || 'Pending', upgradePreview: purchase.preview.canUpgrade ? purchase.preview : null }
      setRegistrationSuccessSub(created)
      setSubscriptions(previous => [created, ...previous.filter(item => String(item.id) !== String(created.id))])
      setTab('mine')
      if (showNotice) {
        showNotice(`Đã tạo đơn ${purchase.preview.canUpgrade ? 'nâng cấp' : 'đăng ký'} gói "${created.packageName}". Số tiền cần thanh toán: ${formatCurrency(created.agreedPrice)}.`)
      }
      try {
        const updated = await getMySubscriptions()
        applySubscriptionData(updated.some(item => String(item.id) === String(created.id)) ? updated : [created, ...updated])
      }
      catch { setError('Đơn đã được tạo nhưng chưa thể tải lại danh sách. Vui lòng làm mới để đồng bộ.') }
    } catch (err) {
      setRegistrationError(err.message || 'Không thể tạo đơn đăng ký. Vui lòng thử lại.')
    } finally {
      registrationLock.current = false
      setSubscribingId(null)
    }
  }

  // Mở modal xem chi tiết đơn đăng ký cá nhân (GET /api/member-subscriptions/{id})
  const handleOpenSubDetail = async (sub) => {
    setCheckoutFeedback(null)
    setSubDetailLoading(true)
    setViewingSub(sub)
    try {
      const detail = await getSubscriptionById(sub.id)
      if (detail) {
        setViewingSub(mergeConfirmedSubscriptionCancellations([detail], confirmedCancellations.current)[0])
      }
    } catch (err) {
      console.warn('Lỗi khi tải chi tiết đơn đăng ký:', err)
    } finally {
      setSubDetailLoading(false)
    }
  }

  // Khởi tạo modal xác nhận hủy gói
  const handlePromptCancelSub = (sub) => {
    setViewingSub(null)
    setCancelError('')
    setCancellingSub(sub)
  }

  const handleCloseCancellation = () => {
    if (registrationLock.current) return
    setCancellingSub(null)
    setCancelError('')
  }

  // Thực thi hủy gói Pending (POST /api/member-subscriptions/{id}/cancel)
  const handleConfirmCancelSub = async () => {
    if (!cancellingSub || registrationLock.current) return
    registrationLock.current = true
    setCancelLoading(true)
    setCancelError('')
    try {
      const cancelled = await cancelSubscriptionOrder(cancellingSub.id)
      confirmedCancellations.current.set(String(cancelled.id), cancelled)
      setSubscriptions(previous => previous.map(item => String(item.id) === String(cancelled.id) ? { ...item, ...cancelled } : item))
      if (showNotice) {
        showNotice(`Đã hủy đơn đăng ký gói #${cancellingSub.id} thành công!`)
      }
      // Đóng modal chi tiết nếu đang xem đúng đơn đó
      if (viewingSub?.id === cancellingSub.id) {
        setViewingSub(null)
      }
      setCancellingSub(null)
      // Tải lại danh sách đăng ký
      try { applySubscriptionData(await getMySubscriptions()) }
      catch { setError('Đơn đã được hủy thành công nhưng chưa tải lại được danh sách. Vui lòng làm mới để đồng bộ.') }
    } catch (err) {
      setCancelError(getPackageErrorMessage(err, 'Không thể hủy đơn đăng ký.'))
      try { applySubscriptionData(await getMySubscriptions()) } catch { /* Preserve the last confirmed state. */ }
    } finally {
      registrationLock.current = false
      setCancelLoading(false)
    }
  }

  // Chuyển hướng thanh toán PayOS trực tuyến
  const handlePayOSCheckout = async (subId) => {
    if (registrationLock.current) return
    registrationLock.current = true
    setPayingSubId(subId)
    setCheckoutFeedback(null)
    try {
      const pay = await createPayment(subId)
      if (canCheckoutPayOSPayment(pay)) {
        window.location.assign(pay.checkoutUrl)
      } else {
        await loadData()
        setCheckoutFeedback({ message: paymentCheckoutMessage(pay), error: pay.status !== 'Completed' })
        if (pay.status === 'Completed') setRegistrationSuccessSub(null)
        if (String(viewingSub?.id) === String(subId)) {
          try { setViewingSub(await getSubscriptionById(subId)) } catch { /* Keep the payment result visible if refreshing details fails. */ }
        }
      }
    } catch (err) {
      setCheckoutFeedback({ message: getPackageErrorMessage(err, 'Không thể khởi tạo thanh toán PayOS.'), error: true })
    } finally {
      setPayingSubId(null)
      registrationLock.current = false
    }
  }

  // Lọc danh sách gói tập mở bán
  const filteredPackages = packages.filter(pkg => {
    const term = packageSearch.trim().toLowerCase()
    const matchesSearch = !term || pkg.packageName?.toLowerCase().includes(term) || pkg.description?.toLowerCase().includes(term)

    if (!matchesSearch) return false

    if (packageTypeFilter !== 'all' && membershipPackageType(pkg) !== packageTypeFilter) return false

    const days = Number(pkg.durationInDays || 0)
    const nameLower = (pkg.packageName || '').toLowerCase()
    const isVip = nameLower.includes('vip') || nameLower.includes('diamond') || nameLower.includes('platinum')

    if (packageFilter === '1m') return days <= 35
    if (packageFilter === '3m') return days > 35 && days <= 100
    if (packageFilter === '6m') return days > 100 && days <= 200
    if (packageFilter === '1y') return days > 200
    if (packageFilter === 'vip') return isVip

    return true
  })

  // Lọc danh sách gói cá nhân
  const filteredSubscriptions = subscriptions.filter(sub => {
    const term = subSearch.trim().toLowerCase().replace(/^#?sub-/, '')
    const matchesSearch = !term || String(sub.id).includes(term) || sub.packageName?.toLowerCase().includes(term)

    if (!matchesSearch) return false

    const status = subscriptionStatus(sub, now)
    if (subFilter === 'active') return status === 'active'
    if (subFilter === 'pending') return status === 'pending'
    if (subFilter === 'expired') return status === 'expired'
    if (subFilter === 'cancelled') return status === 'cancelled'
    if (subFilter === 'upgraded') return status === 'upgraded'
    if (subFilter === 'paymentcancelled') return status === 'pending' && subscriptionPaymentState(sub) === 'cancelled'

    return true
  })

  const activeSubscriptions = subscriptions.filter(s => subscriptionStatus(s, now) === 'active')
  const totalSubsCount = subscriptions.length
  const activeSubsCount = subscriptions.filter(s => subscriptionStatus(s, now) === 'active').length
  const pendingSubsCount = subscriptions.filter(s => subscriptionStatus(s, now) === 'pending').length
  const closedSubsCount = subscriptions.filter(s => ['expired', 'cancelled', 'upgraded'].includes(subscriptionStatus(s, now))).length
  const registrationReason = error ? 'Chưa thể kiểm tra gói đã đăng ký. Vui lòng làm mới trước khi đăng ký gói mới.' : subscriptionRegistrationReason(subscriptions, now)
  const registrationDisabled = loading || Boolean(registrationReason) || subscribingId !== null || cancelLoading
  const packageReason = pkg => registrationReason || subscriptionPackageReason(pkg, subscriptions, packages, now)
  const isUpgradePackage = pkg => membershipPackageType(pkg) === 'Standard' && Boolean(currentSubscriptionForPackage(pkg, subscriptions, packages, now))
  const packageTypeLabel = sub => membershipPackageTypeLabel({ ...sub, ...packages.find(pkg => String(pkg.id) === String(sub.packageId)) })

  if (loading) {
    return (
      <div className="member-card member-api-state">
        <LoaderCircle className="member-spin" size={26} />
        <strong>Đang tải gói thẻ hội viên & danh mục mở bán...</strong>
      </div>
    )
  }

  return (
    <div className="member-subscriptions-view">
      <header className="member-sub-page-heading">
        <div><p className="member-eyebrow"><CreditCard size={16} />THẺ HỘI VIÊN</p><h2>Gói tập & Thẻ hội viên</h2><p>Theo dõi gói đang sử dụng, quản lý đơn đăng ký và tìm gói tập phù hợp.</p></div>
        <button type="button" className="member-button" disabled={subscribingId !== null || cancelLoading} onClick={loadData}><RefreshCw size={16} />Làm mới</button>
      </header>
      {error && <div className="member-sub-message is-error" role="alert"><AlertCircle size={18} /><p>{error}</p></div>}
      {registrationError && !viewingPackage && <div className="member-sub-message is-error" role="alert"><AlertCircle size={18} /><p>{registrationError}</p></div>}
      {!viewingSub && !registrationSuccessSub && <CheckoutFeedback feedback={checkoutFeedback} />}

      {activeSubscriptions.length > 0 ? <section className="member-sub-active-packages" aria-label="Các thẻ đang sử dụng">{activeSubscriptions.map(activeSub => <article key={activeSub.id} className="member-sub-current" aria-labelledby={`member-current-package-${activeSub.id}`}>
        <div className="member-sub-current-main">
          <div className="member-sub-current-heading"><span className="member-sub-card-icon"><ShieldCheck size={24} /></span><div><div className="member-sub-current-meta"><span className="member-sub-status" data-status="active"><span />Đang hiệu lực</span><span>{packageTypeLabel(activeSub)}</span><span>#SUB-{activeSub.id}</span></div><h3 id={`member-current-package-${activeSub.id}`}>{activeSub.packageName}</h3><p>PT 1-1 chỉ đăng ký song song khi Standard đã kích hoạt và còn hiệu lực.</p></div></div>
          <dl className="member-sub-current-facts"><div><dt>Ngày bắt đầu</dt><dd>{formatDate(activeSub.startDate)}</dd></div><div><dt>Thời hạn</dt><dd>{activeSub.durationInDays ?? '—'} ngày</dd></div><div><dt>Số tiền đã thanh toán</dt><dd>{formatCurrency(activeSub.agreedPrice ?? activeSub.price)}</dd></div></dl>
        </div>
        <div className="member-sub-current-aside"><span>Ngày hết hạn</span><strong>{formatDate(activeSub.endDate)}</strong><button type="button" className="member-button" onClick={() => handleOpenSubDetail(activeSub)}><Eye size={15} />Xem chi tiết</button>{packageTypeLabel(activeSub) === 'Standard' && <button type="button" className="member-btn-checkout" onClick={() => { setPackageTypeFilter('Standard'); setTab('catalog') }}><Sparkles size={15} />Nâng cấp gói</button>}</div>
      </article>)}</section> : <div className="member-sub-welcome"><span className="member-sub-card-icon"><CreditCard size={25} /></span><div><h3>{pendingSubsCount ? 'Bạn có đơn đang chờ thanh toán' : 'Sẵn sàng cho hành trình tập luyện'}</h3><p>{pendingSubsCount ? 'Thanh toán đơn đã đăng ký để kích hoạt gói và bắt đầu sử dụng.' : 'Khám phá danh mục và chọn gói tập phù hợp với lịch trình của bạn.'}</p></div><button type="button" className="member-button" onClick={() => setTab(pendingSubsCount ? 'mine' : 'catalog')}>{pendingSubsCount ? 'Xem đơn của tôi' : 'Khám phá gói tập'}<ArrowRight size={16} /></button></div>}

      <div className="member-sub-stats" aria-label="Tổng quan gói tập">
        {[['Tổng đơn đăng ký', totalSubsCount, 'all'], ['Đang hiệu lực', activeSubsCount, 'active'], ['Chờ thanh toán', pendingSubsCount, 'pending'], ['Đã kết thúc / Nâng cấp', closedSubsCount, 'closed']].map(([label, count, tone]) => <div key={tone} data-tone={tone}><span>{label}</span><strong>{count}</strong></div>)}
      </div>
      <div className="member-sub-tabs" role="group" aria-label="Nội dung gói tập">
        <button type="button" aria-pressed={tab === 'mine'} onClick={() => setTab('mine')}><CreditCard size={17} />Gói của tôi<span>{subscriptions.length}</span></button>
        <button type="button" aria-pressed={tab === 'catalog'} onClick={() => setTab('catalog')}><Sparkles size={17} />Khám phá gói tập<span>{packages.length}</span></button>
      </div>

      {tab === 'mine' && <section className="member-sub-panel" aria-labelledby="member-my-subscriptions">
        <div className="member-sub-section-heading"><div><h3 id="member-my-subscriptions">Đơn đăng ký của tôi</h3><p>Tra cứu trạng thái, thanh toán hoặc hủy đơn chưa thanh toán.</p></div><span>{filteredSubscriptions.length} đơn</span></div>
        <div className="member-sub-toolbar">
          <label className="member-sub-search"><Search size={17} aria-hidden="true" /><input type="search" maxLength={200} value={subSearch} onChange={event => setSubSearch(event.target.value)} placeholder="Tìm tên gói hoặc mã #SUB..." aria-label="Tìm đơn đăng ký" /></label>
          <label className="member-sub-select"><span>Trạng thái</span><select value={subFilter} onChange={event => setSubFilter(event.target.value)}><option value="all">Tất cả trạng thái</option><option value="active">Đang hiệu lực</option><option value="pending">Chờ thanh toán</option><option value="expired">Đã hết hạn</option><option value="cancelled">Đã hủy đơn</option><option value="paymentcancelled">Đã hủy thanh toán</option><option value="upgraded">Đã nâng cấp</option></select></label>
        </div>
        {filteredSubscriptions.length ? <ul className="member-sub-list">{filteredSubscriptions.map(item => <li key={item.id}>
          <div className="member-sub-list-heading"><div><span className="member-sub-code">#SUB-{item.id}</span><h4>{item.packageName}</h4></div><span className="member-sub-status" data-status={subscriptionStatus(item, now)} data-payment-status={subscriptionPaymentState(item)}><span />{subscriptionDisplayStatusLabel(item, now)}</span></div>
          <dl className="member-sub-list-facts"><div><dt>Số tiền của đơn</dt><dd>{formatCurrency(item.agreedPrice ?? item.price)}</dd></div><div><dt>Thời hạn</dt><dd>{item.durationInDays ?? '—'} ngày · {packageTypeLabel(item)}</dd></div><div><dt>Hiệu lực</dt><dd>{formatDate(item.startDate)} – {formatDate(item.endDate)}</dd></div></dl>
          <div className="member-sub-actions">
            <button type="button" className="member-button" onClick={() => handleOpenSubDetail(item)}><Eye size={15} />Chi tiết</button>
            {subscriptionStatus(item, now) === 'pending' && <><button type="button" className="member-btn-checkout" disabled={payingSubId !== null || cancelLoading || ['completed', 'needsreview'].includes(subscriptionPaymentState(item))} onClick={() => handlePayOSCheckout(item.id)}>{payingSubId === item.id ? <LoaderCircle size={15} className="member-spin" /> : <CreditCard size={15} />}{['cancelled', 'expired', 'failed'].includes(subscriptionPaymentState(item)) ? 'Thanh toán lại' : 'Thanh toán'}</button><button type="button" className="member-button member-button--danger" disabled={cancelLoading || payingSubId !== null || ['completed', 'needsreview'].includes(subscriptionPaymentState(item))} onClick={() => handlePromptCancelSub(item)}><Trash2 size={15} />{subscriptionPaymentState(item) === 'cancelled' ? 'Hoàn tất hủy đơn' : 'Hủy đơn'}</button></>}
          </div>
          {subscriptionStatus(item, now) === 'pending' && subscriptionPaymentState(item) === 'cancelled' && <p className="member-sub-payment-note">Giao dịch PayOS đã hủy nhưng đơn gói chưa được hủy. Chọn “Hoàn tất hủy đơn” để đóng đơn, hoặc “Thanh toán lại” nếu bạn vẫn muốn đăng ký.</p>}
        </li>)}</ul> : <div className="member-sub-empty"><Search size={27} /><h4>{subscriptions.length ? 'Không tìm thấy đơn phù hợp' : 'Bạn chưa có đơn đăng ký'}</h4><p>{subscriptions.length ? 'Thử thay đổi từ khóa hoặc trạng thái lọc.' : 'Chọn một gói trong danh mục để bắt đầu đăng ký.'}</p>{!subscriptions.length && <button type="button" className="member-button" onClick={() => setTab('catalog')}>Khám phá gói tập<ArrowRight size={16} /></button>}</div>}
      </section>}

      {tab === 'catalog' && <section className="member-sub-catalog" aria-labelledby="member-package-catalog">
        <div className="member-sub-section-heading"><div><h3 id="member-package-catalog">Chọn gói tập phù hợp</h3><p>Xem thông tin và thời hạn trước khi tạo đơn đăng ký.</p></div><span>{filteredPackages.length} gói</span></div>
        <div className="member-sub-message" role="note"><Info size={18} /><p>Standard đang còn hạn chỉ được nâng cấp lên gói có giá cao hơn và thời hạn không ngắn hơn. Không thể mua thêm gói hiện tại hoặc hạ gói. PT chỉ đăng ký song song khi Standard đã kích hoạt và còn hiệu lực.</p></div>
        {registrationReason && <div id="member-sub-registration-lock" className="member-sub-message" role="status"><LockKeyhole size={18} /><p>{registrationReason}</p></div>}
        <div className="member-sub-toolbar">
          <label className="member-sub-search"><Search size={17} aria-hidden="true" /><input type="search" maxLength={200} value={packageSearch} onChange={event => setPackageSearch(event.target.value)} placeholder="Tìm tên gói hoặc từ khóa..." aria-label="Tìm gói tập" /></label>
          <label className="member-sub-select"><span>Loại thẻ</span><select aria-label="Loại thẻ" value={packageTypeFilter} onChange={event => setPackageTypeFilter(event.target.value)}><option value="all">Tất cả loại thẻ</option><option value="Standard">Standard</option><option value="PT">PT 1-1</option></select></label>
          <label className="member-sub-select"><span>Thời hạn</span><select value={packageFilter} onChange={event => setPackageFilter(event.target.value)}><option value="all">Tất cả gói tập</option><option value="1m">Khoảng 1 tháng</option><option value="3m">Khoảng 3 tháng</option><option value="6m">Khoảng 6 tháng</option><option value="1y">Trên 6 tháng</option><option value="vip">VIP / Cao cấp</option></select></label>
        </div>
        {filteredPackages.length ? <div className="member-sub-package-grid">{filteredPackages.map(pkg => {
          const reason = packageReason(pkg)
          return <article key={pkg.id} className="member-sub-package" data-package-id={pkg.id}>
            <div className="member-sub-package-top"><span><CalendarDays size={15} />{pkg.durationInDays} ngày</span><small>{membershipPackageTypeLabel(pkg)}</small>{pkg.isActive === false && <small>Tạm ngừng</small>}</div>
            <h4>{pkg.packageName}</h4><p className="member-sub-package-description">{pkg.description || 'Liên hệ lễ tân để biết thêm thông tin về gói tập.'}</p><strong className="member-sub-package-price">{formatCurrency(pkg.price)}</strong><small className="member-sub-package-note">Giá cho toàn bộ thời hạn gói</small>
            {reason && <p className="member-sub-package-eligibility">{reason}</p>}
            <div className="member-sub-package-actions"><button type="button" className="member-button" onClick={() => handleOpenPackageDetail(pkg)}><Eye size={15} />Chi tiết</button><button type="button" className="member-btn-checkout" data-register-package={pkg.id} disabled={registrationDisabled || Boolean(reason)} aria-describedby={registrationReason ? 'member-sub-registration-lock' : undefined} title={reason || 'Xem trước số tiền đăng ký gói'} onClick={() => handleRegister(pkg)}>{subscribingId === pkg.id ? <><LoaderCircle className="member-spin" size={16} />Đang tạo đơn...</> : reason ? <><LockKeyhole size={15} />Chưa thể đăng ký</> : isUpgradePackage(pkg) ? <><Sparkles size={16} />Nâng cấp gói</> : <><CreditCard size={16} />Đăng ký gói</>}</button></div>
          </article>
        })}</div> : <div className="member-sub-empty"><Search size={28} /><h4>Không tìm thấy gói tập phù hợp</h4><p>Thử thay đổi từ khóa hoặc thời hạn lọc.</p></div>}
      </section>}

      {purchasePackage && <SubscriptionPurchaseDialog pkg={purchasePackage} onClose={() => setPurchasePackage(null)} onCreated={handlePurchaseCreated} />}

      {viewingPackage && (
        <div className="member-modal-overlay" onClick={() => setViewingPackage(null)}>
          <div className="member-modal" onClick={e => e.stopPropagation()}>
            <div className="member-modal-header">
              <h3>
                <Award size={18} style={{ color: 'var(--member-blue)' }} />
                Chi tiết gói tập: {viewingPackage.packageName}
              </h3>
              <button
                type="button"
                className="member-modal-close" aria-label="Đóng cửa sổ"
                onClick={() => setViewingPackage(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="member-modal-body">
              {packageDetailLoading ? (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <LoaderCircle className="member-spin" size={24} style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 12, color: 'var(--theme-muted, #536179)' }}>Đang tải thông tin chi tiết gói...</p>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: 12,
                      background: 'var(--theme-bg, #f5f7fb)',
                      padding: 16,
                      borderRadius: 10,
                      border: '1px solid var(--theme-border, #d8e0ed)',
                    }}
                  >
                    <div>
                      <small style={{ color: 'var(--theme-muted, #536179)', fontSize: 11, display: 'block' }}>Giá gói</small>
                      <strong style={{ fontSize: 18, color: 'var(--member-blue)' }}>
                        {formatCurrency(viewingPackage.price)}
                      </strong>
                    </div>
                    <div>
                      <small style={{ color: 'var(--theme-muted, #536179)', fontSize: 11, display: 'block' }}>Thời hạn sử dụng</small>
                      <strong style={{ fontSize: 16, color: 'var(--theme-text, #17243c)' }}>
                        {viewingPackage.durationInDays} ngày
                      </strong>
                    </div>
                    <div>
                      <small style={{ color: 'var(--theme-muted, #536179)', fontSize: 11, display: 'block' }}>Trạng thái mở bán</small>
                      <span className="member-status" style={{ marginTop: 4 }}>
                        <span />
                        {viewingPackage.isActive !== false ? 'Đang mở bán' : 'Tạm dừng'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 6px', color: 'var(--theme-text, #17243c)' }}>Mô tả gói tập</h4>
                    <p style={{ fontSize: 12, color: 'var(--theme-muted, #536179)', lineHeight: 1.6, background: 'var(--theme-surface, #fff)', border: '1px solid var(--theme-border, #d8e0ed)', borderRadius: 8, padding: 12 }}>
                      {viewingPackage.description || 'Chưa có mô tả chi tiết. Vui lòng liên hệ lễ tân để biết thêm thông tin về gói tập này.'}
                    </p>
                  </div>

                  <div style={{ background: 'var(--theme-raised, #edf2fa)', border: '1px solid var(--theme-border, #d8e0ed)', borderRadius: 8, padding: 12, display: 'flex', gap: 10 }}>
                    <Info size={18} style={{ color: 'var(--theme-accent, #1557d5)', flexShrink: 0, marginTop: 2 }} />
                    <small style={{ color: 'var(--theme-accent, #1557d5)', fontSize: 11, lineHeight: 1.5 }}>
                      Chọn tiếp tục để xem điều kiện, số tiền cần thanh toán và thời hạn được trung tâm xác nhận. Standard chỉ được nâng cấp lên gói cao hơn; PT chỉ đăng ký khi Standard đã kích hoạt và còn hiệu lực.
                    </small>
                  </div>
                </>
              )}
            </div>

            {packageReason(viewingPackage) && <div id="member-sub-modal-lock" className="member-sub-message" role="status"><LockKeyhole size={18} /><p>{packageReason(viewingPackage)}</p></div>}
            {registrationError && <div className="member-sub-message is-error" role="alert"><AlertCircle size={18} /><p>{registrationError}</p></div>}
            <div className="member-modal-footer">
              <button
                type="button"
                className="member-button"
                onClick={() => setViewingPackage(null)}
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={registrationDisabled || packageDetailLoading || Boolean(packageReason(viewingPackage))}
                data-register-package={viewingPackage.id}
                aria-describedby={packageReason(viewingPackage) ? 'member-sub-modal-lock' : undefined}
                className="member-btn-checkout member-btn-checkout--lg"
                onClick={() => handleRegister(viewingPackage)}
              >
                {subscribingId === viewingPackage.id ? (
                  <><LoaderCircle className="member-spin" size={15} /> Đang tạo đơn...</>
                ) : (
                  packageReason(viewingPackage) ? <><LockKeyhole size={15} /> Chưa thể đăng ký</> : <><CreditCard size={15} /> Xem số tiền & tiếp tục</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: THÔNG BÁO TỰ ĐĂNG KÝ GÓI THÀNH CÔNG (Trạng thái Pending)
          ========================================================================= */}
      {registrationSuccessSub && (
        <div className="member-modal-overlay" onClick={() => setRegistrationSuccessSub(null)}>
          <div className="member-modal" onClick={e => e.stopPropagation()}>
            <div className="member-modal-header" style={{ background: 'var(--theme-green-bg, #e1f6ee)', borderBottom: '1px solid var(--theme-border, #d8e0ed)' }}>
              <h3 style={{ color: 'var(--theme-green, #096445)' }}>
                <CheckCircle2 size={20} style={{ color: 'var(--theme-green, #096445)' }} />
                {registrationSuccessSub.upgradePreview ? 'Đã tạo đơn nâng cấp!' : 'Đăng ký gói thành công!'}
              </h3>
              <button
                type="button"
                className="member-modal-close" aria-label="Đóng cửa sổ"
                onClick={() => setRegistrationSuccessSub(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="member-modal-body">
              <CheckoutFeedback feedback={checkoutFeedback} />
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: 'var(--theme-green-bg, #e1f6ee)',
                    color: 'var(--theme-green, #096445)',
                    display: 'grid',
                    placeItems: 'center',
                    margin: '0 auto 12px',
                  }}
                >
                  <Award size={28} />
                </div>
                <h4 style={{ fontSize: 16, margin: 0, color: 'var(--theme-text, #17243c)' }}>
                  Đơn đăng ký gói của bạn đã được ghi nhận
                </h4>
                <p style={{ fontSize: 12, color: 'var(--theme-muted, #536179)', marginTop: 4 }}>
                  Gói tập đang ở trạng thái <strong>Chờ thanh toán (Pending)</strong>.{registrationSuccessSub.upgradePreview && ' Gói cũ vẫn có hiệu lực cho đến khi thanh toán nâng cấp thành công.'}
                </p>
              </div>

              <div
                style={{
                  background: 'var(--theme-bg, #f5f7fb)',
                  border: '1px solid var(--theme-border, #d8e0ed)',
                  borderRadius: 10,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--theme-muted, #536179)' }}>Mã đơn đăng ký:</span>
                  <strong>#SUB-{registrationSuccessSub.id}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--theme-muted, #536179)' }}>Tên gói tập:</span>
                  <strong>{registrationSuccessSub.packageName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--theme-muted, #536179)' }}>Thời hạn:</span>
                  <span>{registrationSuccessSub.durationInDays} ngày</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--theme-muted, #536179)' }}>Số tiền cần thanh toán:</span>
                  <strong style={{ color: 'var(--member-blue)', fontSize: 15 }}>
                    {formatCurrency(registrationSuccessSub.agreedPrice ?? registrationSuccessSub.price)}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <span style={{ color: 'var(--theme-muted, #536179)' }}>Trạng thái:</span>
                  <span className="member-status member-status--pending">
                    <span /> Chờ thanh toán (Pending)
                  </span>
                </div>
              </div>

              <div style={{ background: 'var(--theme-gold-bg, #fff7e5)', border: '1px solid var(--theme-border, #d8e0ed)', borderRadius: 8, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--theme-gold, #805200)', lineHeight: 1.5 }}>
                  💡 <strong>Bước tiếp theo:</strong> Bạn có thể bấm <strong>"Thanh toán PayOS ngay"</strong> để quét mã QR ngân hàng và kích hoạt gói tức thì, hoặc chọn <strong>"Để sau"</strong> để thanh toán tiền mặt tại quầy lễ tân hoặc thanh toán sau tại mục Thanh toán trực tuyến.
                </p>
              </div>
            </div>

            <div className="member-modal-footer">
              <button
                type="button"
                className="member-button"
                onClick={() => setRegistrationSuccessSub(null)}
              >
                Để sau / Thanh toán tại quầy
              </button>
              <button
                type="button"
                disabled={payingSubId === registrationSuccessSub.id}
                className="member-btn-checkout member-btn-checkout--lg"
                onClick={() => handlePayOSCheckout(registrationSuccessSub.id)}
              >
                {payingSubId === registrationSuccessSub.id ? (
                  <><LoaderCircle className="member-spin" size={15} /> Đang mở cổng...</>
                ) : (
                  <><CreditCard size={15} /> Thanh toán PayOS ngay <ArrowRight size={14} /></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: XEM CHI TIẾT ĐĂNG KÝ GÓI CÁ NHÂN (GET /api/member-subscriptions/{id})
          ========================================================================= */}
      {viewingSub && (
        <div className="member-modal-overlay" onClick={() => setViewingSub(null)}>
          <div className="member-modal member-modal--lg" onClick={e => e.stopPropagation()}>
            <div className="member-modal-header">
              <h3>
                <ReceiptText size={18} style={{ color: 'var(--member-blue)' }} />
                Chi tiết đơn đăng ký #SUB-{viewingSub.id}
              </h3>
              <button
                type="button"
                className="member-modal-close" aria-label="Đóng cửa sổ"
                onClick={() => setViewingSub(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="member-modal-body">
              <CheckoutFeedback feedback={checkoutFeedback} />
              {subDetailLoading ? (
                <div style={{ padding: 32, textAlign: 'center' }}>
                  <LoaderCircle className="member-spin" size={26} style={{ margin: '0 auto 10px' }} />
                  <p style={{ fontSize: 12, color: 'var(--theme-muted, #536179)' }}>Đang tải chi tiết đơn đăng ký gói...</p>
                </div>
              ) : (
                <>
                  {/* Banner trạng thái */}
                  {subscriptionStatus(viewingSub, now) === 'upgraded' && <div className="member-sub-message" role="status"><Sparkles size={20} /><p>Gói này đã được thay thế sau khi nâng cấp thành công. Thời hạn và quyền sử dụng hiện tại nằm ở gói Standard mới.</p></div>}
                  {subscriptionStatus(viewingSub, now) === 'pending' && (
                    <div style={{ background: 'var(--theme-gold-bg, #fff7e5)', border: '1px solid var(--theme-border, #d8e0ed)', borderRadius: 10, padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <Clock size={20} style={{ color: 'var(--theme-gold, #805200)', flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <strong style={{ color: 'var(--theme-gold, #805200)', fontSize: 13 }}>{subscriptionDisplayStatusLabel(viewingSub, now)}</strong>
                        <p style={{ color: 'var(--theme-gold, #805200)', fontSize: 11, margin: '2px 0 0' }}>
                          {subscriptionPaymentState(viewingSub) === 'cancelled' ? 'Giao dịch PayOS đã hủy. Chọn Hủy đơn đăng ký này để hoàn tất hủy đơn gói, hoặc thanh toán lại nếu bạn vẫn muốn đăng ký.' : 'Gói tập chưa được kích hoạt. Trạng thái đơn và thanh toán được cập nhật theo xác nhận của hệ thống.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {subscriptionStatus(viewingSub, now) === 'active' && (
                    <div style={{ background: 'var(--theme-green-bg, #e1f6ee)', border: '1px solid var(--theme-border, #d8e0ed)', borderRadius: 10, padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
                      <CheckCircle2 size={20} style={{ color: 'var(--theme-green, #096445)', flexShrink: 0 }} />
                      <div>
                        <strong style={{ color: 'var(--theme-green, #096445)', fontSize: 13 }}>Gói tập đang có hiệu lực sử dụng</strong>
                        <p style={{ color: 'var(--theme-green, #096445)', fontSize: 11, margin: '2px 0 0' }}>
                          Bạn đang sử dụng gói tập này. Kiểm tra ngày hết hạn và thông tin đăng ký bên dưới.
                        </p>
                      </div>
                    </div>
                  )}

                  {subscriptionStatus(viewingSub, now) === 'cancelled' && (
                    <div style={{ background: 'var(--theme-red-bg, #fef2f2)', border: '1px solid var(--theme-border, #d8e0ed)', borderRadius: 10, padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
                      <Ban size={20} style={{ color: 'var(--theme-red, #b42318)', flexShrink: 0 }} />
                      <div>
                        <strong style={{ color: 'var(--theme-red, #b42318)', fontSize: 13 }}>Đơn đăng ký đã bị hủy</strong>
                        <p style={{ color: 'var(--theme-red, #b42318)', fontSize: 11, margin: '2px 0 0' }}>
                          Đơn đăng ký này đã được hủy bỏ và không còn hiệu lực thanh toán hay kích hoạt.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Thông tin đăng ký chi tiết */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: 14,
                      background: 'var(--theme-bg, #f5f7fb)',
                      padding: 16,
                      borderRadius: 10,
                      border: '1px solid var(--theme-border, #d8e0ed)',
                    }}
                  >
                    <div>
                      <small style={{ color: 'var(--theme-muted, #536179)', fontSize: 11 }}>Mã đơn đăng ký</small>
                      <strong style={{ display: 'block', fontSize: 14, color: 'var(--theme-text, #17243c)', marginTop: 2 }}>
                        #SUB-{viewingSub.id}
                      </strong>
                    </div>
                    <div>
                      <small style={{ color: 'var(--theme-muted, #536179)', fontSize: 11 }}>Tên gói tập</small>
                      <strong style={{ display: 'block', fontSize: 14, color: 'var(--member-blue)', marginTop: 2 }}>
                        {viewingSub.packageName}
                      </strong>
                    </div>
                    <div>
                      <small style={{ color: 'var(--theme-muted, #536179)', fontSize: 11 }}>Số tiền thanh toán của đơn</small>
                      <strong style={{ display: 'block', fontSize: 15, color: 'var(--theme-green, #096445)', marginTop: 2 }}>
                        {formatCurrency(viewingSub.agreedPrice ?? viewingSub.price)}
                      </strong>
                    </div>
                    <div>
                      <small style={{ color: 'var(--theme-muted, #536179)', fontSize: 11 }}>Thời hạn sử dụng</small>
                      <strong style={{ display: 'block', fontSize: 14, color: 'var(--theme-text, #17243c)', marginTop: 2 }}>
                        {viewingSub.durationInDays} ngày
                      </strong>
                    </div>
                    <div>
                      <small style={{ color: 'var(--theme-muted, #536179)', fontSize: 11 }}>Thời gian đăng ký</small>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--theme-text, #17243c)', marginTop: 2 }}>
                        {formatDateTime(viewingSub.createdAt)}
                      </span>
                    </div>
                    <div>
                      <small style={{ color: 'var(--theme-muted, #536179)', fontSize: 11 }}>Ngày bắt đầu hiệu lực</small>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--theme-text, #17243c)', marginTop: 2 }}>
                        {formatDate(viewingSub.startDate)}
                      </span>
                    </div>
                    <div>
                      <small style={{ color: 'var(--theme-muted, #536179)', fontSize: 11 }}>Ngày kết thúc thẻ</small>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--theme-text, #17243c)', marginTop: 2 }}>
                        {formatDate(viewingSub.endDate)}
                      </span>
                    </div>
                    <div>
                      <small style={{ color: 'var(--theme-muted, #536179)', fontSize: 11 }}>Trạng thái hiện tại</small>
                      <div style={{ marginTop: 4 }}>
                        <span
                          className={`member-status ${
                            subscriptionStatus(viewingSub, now) === 'active'
                              ? ''
                              : subscriptionStatus(viewingSub, now) === 'pending'
                              ? 'member-status--pending'
                              : subscriptionStatus(viewingSub, now) === 'cancelled'
                              ? 'member-status--danger'
                              : 'member-status--muted'
                          }`}
                        >
                          <span />
                          {subscriptionStatusLabel(viewingSub, now)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Lịch sử giao dịch thanh toán (Payments) */}
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 10px', color: 'var(--theme-text, #17243c)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Coins size={16} style={{ color: 'var(--theme-accent, #1557d5)' }} /> Lịch sử thanh toán đính kèm
                    </h4>

                    {Array.isArray(viewingSub.payments) && viewingSub.payments.length > 0 ? (
                      <div className="member-table-scroll" style={{ border: '1px solid var(--theme-border, #d8e0ed)', borderRadius: 8 }}>
                        <table>
                          <thead>
                            <tr style={{ background: 'var(--theme-bg, #f5f7fb)' }}>
                              <th>MÃ GIAO DỊCH</th>
                              <th>SỐ TIỀN</th>
                              <th>PHƯƠNG THỨC</th>
                              <th>TRẠNG THÁI</th>
                              <th>THỜI GIAN</th>
                              <th>MÃ ĐỐI SOÁT</th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewingSub.payments.map((p, idx) => (
                              <tr key={p.id || idx}>
                                <td><strong>#PAY-{p.id}</strong></td>
                                <td className="member-amount">{formatCurrency(p.amount)}</td>
                                <td>
                                  <span className="member-tag" style={{ textTransform: 'uppercase' }}>
                                    {p.paymentMethod || 'PayOS'}
                                  </span>
                                </td>
                                <td>
                                  <span className="member-status">
                                    <span /> {p.status || 'Thành công'}
                                  </span>
                                </td>
                                <td>{formatDateTime(p.paymentDate)}</td>
                                <td>
                                  <code style={{ fontSize: 10, background: 'var(--theme-raised, #edf2fa)', padding: '2px 6px', borderRadius: 4 }}>
                                    {p.transactionReference || 'N/A'}
                                  </code>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ background: 'var(--theme-bg, #f5f7fb)', border: '1px solid var(--theme-border, #d8e0ed)', borderRadius: 8, padding: 18, textAlign: 'center', color: 'var(--theme-muted, #536179)' }}>
                        <Coins size={24} style={{ margin: '0 auto 6px', opacity: 0.4 }} />
                        <p style={{ margin: 0, fontSize: 12 }}>Chưa có bản ghi thanh toán nào cho đơn đăng ký này.</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="member-modal-footer">
              {subscriptionStatus(viewingSub, now) === 'pending' && (
                <>
                  <button
                    type="button"
                    className="member-button member-button--danger"
                    disabled={cancelLoading || ['completed', 'needsreview'].includes(subscriptionPaymentState(viewingSub))}
                    onClick={() => handlePromptCancelSub(viewingSub)}
                  >
                    <Trash2 size={14} /> Hủy đơn đăng ký này
                  </button>
                  <button
                    type="button"
                    disabled={payingSubId === viewingSub.id || ['completed', 'needsreview'].includes(subscriptionPaymentState(viewingSub))}
                    className="member-btn-checkout"
                    onClick={() => handlePayOSCheckout(viewingSub.id)}
                  >
                    {payingSubId === viewingSub.id ? (
                      <><LoaderCircle className="member-spin" size={14} /> Đang mở cổng...</>
                    ) : (
                      <><CreditCard size={14} /> Thanh toán PayOS ngay</>
                    )}
                  </button>
                </>
              )}
              <button
                type="button"
                className="member-button"
                onClick={() => setViewingSub(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: XÁC NHẬN HỦY GÓI TẬP CHƯA THANH TOÁN (POST /api/member-subscriptions/{id}/cancel)
          ========================================================================= */}
      {cancellingSub && (
        <div className="member-modal-overlay" onClick={handleCloseCancellation}>
          <div className="member-modal" role="dialog" aria-modal="true" aria-labelledby="cancel-subscription-title" aria-busy={cancelLoading} onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="member-modal-header" style={{ background: 'var(--theme-red-bg, #fef2f2)', borderBottom: '1px solid var(--theme-border, #d8e0ed)' }}>
              <h3 id="cancel-subscription-title" style={{ color: 'var(--theme-red, #b42318)' }}>
                <ShieldAlert size={19} style={{ color: 'var(--theme-red, #b42318)' }} />
                Xác nhận hủy đơn đăng ký gói
              </h3>
              <button
                type="button"
                className="member-modal-close" aria-label="Đóng cửa sổ"
                disabled={cancelLoading}
                onClick={handleCloseCancellation}
              >
                <X size={18} />
              </button>
            </div>

            <div className="member-modal-body">
              <p style={{ fontSize: 13, color: 'var(--theme-text, #17243c)', margin: 0, lineHeight: 1.6 }}>
                Bạn có chắc chắn muốn hủy đơn đăng ký gói <strong>{cancellingSub.packageName}</strong> (Mã đơn: <strong>#SUB-{cancellingSub.id}</strong>) không?
              </p>

              {cancelError && <div className="member-sub-message is-error" role="alert"><AlertCircle size={18} /><p>{cancelError}</p></div>}

              <div style={{ background: 'var(--theme-red-bg, #fef2f2)', border: '1px solid var(--theme-border, #d8e0ed)', borderRadius: 8, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--theme-red, #b42318)', lineHeight: 1.5 }}>
                  ⚠️ <strong>Lưu ý:</strong> Thao tác này chỉ áp dụng đối với đơn đang ở trạng thái <strong>Chờ thanh toán (Pending)</strong>. Sau khi hủy, đơn đăng ký này sẽ bị đóng vĩnh viễn và không thể khôi phục.
                </p>
              </div>
            </div>

            <div className="member-modal-footer">
              <button
                type="button"
                disabled={cancelLoading}
                className="member-button"
                onClick={handleCloseCancellation}
              >
                Quay lại
              </button>
              <button
                type="button"
                disabled={cancelLoading}
                className="member-button member-button--danger"
                onClick={handleConfirmCancelSub}
              >
                {cancelLoading ? (
                  <><LoaderCircle className="member-spin" size={14} /> Đang xử lý hủy...</>
                ) : (
                  <><Trash2 size={14} /> Xác nhận hủy đơn</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SubscriptionsView
