import ThemeToggle from '../../components/ThemeToggle'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Award, BadgeCheck, Bell, CalendarCheck, CalendarDays, CheckCircle2, Clock3, Coins, CreditCard, Diamond, Dumbbell, ExternalLink, Flame, History, Info, LayoutDashboard, LoaderCircle, LogOut, MapPin, PauseCircle, Percent, PlusCircle, QrCode, ReceiptText, RefreshCw, ShieldCheck, Sparkles, Timer, Trophy, Wallet, Waves, X } from 'lucide-react'
import '../../style/member/Member.css'
import { useAuth } from '../../contexts/AuthContext'
import { getAuthErrorMessage, getUserDisplayName, getUserInitials } from '../../utils/auth'
import { getMembershipPackages } from '../../services/membershipPackageService'
import { createMemberSubscription, getMySubscriptions } from '../../services/memberSubscriptionService'
import { cancelPayment, createPayment, getMyPayments, syncPayment } from '../../services/paymentService'

const activities = [
  { date: '24/10/2024', time: '17:15 - 18:45', court: 'Pickleball Arena 02', location: 'Cơ sở 1 - Khu liên hợp ngoài trời', sport: 'Pickleball', method: 'Quét mã QR hội viên tại quầy', minutes: 90, calories: 600, detail: 'Trận đấu đôi phong trào', icon: QrCode },
  { date: '22/10/2024', time: '18:00 - 19:00', court: 'Tennis Pro Court 01', location: 'Mặt sân cứng US Open tiêu chuẩn', sport: 'Tennis', method: 'Xác thực bởi HLV Nguyễn Hải Đăng', minutes: 60, calories: 450, detail: 'Tập giao bóng và quả trái hai tay', icon: BadgeCheck },
  { date: '20/10/2024', time: '06:30 - 07:45', court: 'Hồ Bơi 4 Mùa & Ice Bath Sauna', location: 'Khu vực phục hồi thể thao chuyên sâu', sport: 'Bể bơi', method: 'Vân tay cửa tự động VIP', minutes: 75, calories: 500, detail: 'Bơi tự do & liệu pháp xông lạnh', icon: ShieldCheck },
  { date: '18/10/2024', time: '19:30 - 21:00', court: 'Cầu Lông Yonex Court 04', location: 'Thảm thi đấu quốc tế BWF', sport: 'Cầu lông', method: 'Quét mã QR lễ tân', minutes: 90, calories: 600, detail: 'Đánh giao lưu CLB Olympus Cầu Giấy', icon: QrCode },
]

const navigation = [
  ['tong-quan', LayoutDashboard, 'Tổng quan tài khoản'], ['goi-tap', CreditCard, 'Gói tập & Hội viên'],
  ['lich-dat', CalendarDays, 'Lịch đặt sân của tôi'], ['checkin-history', History, 'Lịch sử check-in'],
  ['hoa-don', ReceiptText, 'Hóa đơn'], ['rewards', Sparkles, 'Olympus Rewards'],
]

const packageIcons = [RefreshCw, Sparkles, Diamond, Dumbbell]

const paymentStatusLabels = {
  Completed: ['Đã thanh toán', 'success'], Pending: ['Chờ thanh toán', 'pending'],
  Cancelled: ['Đã hủy', 'muted'], Expired: ['Hết hạn', 'muted'], Failed: ['Thất bại', 'danger'],
  NeedsReview: ['Cần đối soát', 'warning'],
}

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')} đ`
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function getPackageCategory(item) {
  const text = `${item.packageName || ''} ${item.description || ''}`.toLocaleLowerCase('vi')
  if (/pt|huấn luyện|coach/.test(text)) return 'pt'
  if (/vip|club|doanh nghiệp/.test(text)) return 'club'
  return 'period'
}

function decoratePackage(item, index) {
  const category = getPackageCategory(item)
  const duration = Number(item.durationInDays || 0)
  const durationText = duration >= 30 && duration % 30 === 0 ? `${duration / 30} tháng` : `${duration} ngày`
  return {
    ...item,
    name: item.packageName,
    category,
    tag: category === 'pt' ? 'Huấn luyện' : category === 'club' ? 'VIP / CLB' : 'Hội viên',
    icon: packageIcons[index % packageIcons.length],
    tone: category === 'club' ? 'gold' : category === 'pt' ? 'green' : undefined,
    featured: index === 0,
    price: Number(item.price || 0).toLocaleString('vi-VN'),
    unit: 'đ/gói',
    description: item.description || 'Gói hội viên đang được mở đăng ký tại trung tâm.',
    note: `Thời hạn sử dụng ${durationText}`,
    benefits: [`Hiệu lực trong ${durationText}`, 'Thanh toán trực tuyến an toàn qua PayOS', 'Kích hoạt tự động sau khi thanh toán thành công'],
  }
}

function Status({ children, tone = 'success' }) {
  return <span className={`member-status member-status--${tone}`}><span />{children}</span>
}

function SectionHeading({ icon: Icon, eyebrow, title, description, children }) {
  return <div className="member-section-heading"><div><p className="member-eyebrow"><Icon size={17} />{eyebrow}</p><h2>{title}</h2><p className="member-muted">{description}</p></div>{children}</div>
}

function Filters({ label, options, value, onChange }) {
  return <div className="member-filters" role="group" aria-label={label}>{options.map(([id, text]) => <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}>{text}</button>)}</div>
}

function MemberDialog({ content, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog.open) dialog.showModal()
  }, [])
  return <dialog ref={ref} className="member-dialog" aria-labelledby="member-dialog-title" onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) ref.current.close() }}>
    <div className="member-dialog-heading"><h2 id="member-dialog-title">{content.title}</h2><button type="button" className="member-icon-button" aria-label="Đóng" onClick={() => ref.current.close()}><X size={22} /></button></div>
    {content.qr && <div className="member-qr-preview"><QrCode size={150} /><span>Mã minh họa · Không dùng để check-in</span></div>}
    <p>{content.description}</p>
    {content.benefits && <ul>{content.benefits.map((benefit) => <li key={benefit}><CheckCircle2 size={17} />{benefit}</li>)}</ul>}
    <button type="button" className="member-button member-button--primary" onClick={() => ref.current.close()}>Đã hiểu</button>
  </dialog>
}

export default function Member() {
  const { user, logout } = useAuth()
  const displayName = getUserDisplayName(user)
  const initials = getUserInitials(user)
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const [packageFilter, setPackageFilter] = useState('all')
  const [sportFilter, setSportFilter] = useState('all')
  const [period, setPeriod] = useState('10/2024')
  const [invoicePeriod, setInvoicePeriod] = useState('all')
  const [activeNav, setActiveNav] = useState('tong-quan')
  const [dialog, setDialog] = useState(null)
  const [membershipPackages, setMembershipPackages] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [payments, setPayments] = useState([])
  const [paymentLoading, setPaymentLoading] = useState(true)
  const [paymentError, setPaymentError] = useState('')
  const [processingPackageId, setProcessingPackageId] = useState(null)
  const [updatingPaymentId, setUpdatingPaymentId] = useState(null)
  const showUnavailable = (title) => setDialog({ title, description: 'Tính năng này chưa được kết nối với hệ thống. Vui lòng liên hệ quầy lễ tân hoặc hotline 1900 6886 để được hỗ trợ.' })
  const packages = membershipPackages.map(decoratePackage)
  const visiblePackages = packages.filter((item) => packageFilter === 'all' || item.category === packageFilter)
  const visibleActivities = activities.filter((item) => (sportFilter === 'all' || item.sport === sportFilter) && (period === 'all' || item.date.slice(3) === period))
  const visiblePayments = payments.filter((item) => invoicePeriod === 'all' || String(item.paidAt || item.createdAt || '').slice(0, 7) === invoicePeriod)
  const paymentMonths = [...new Set(payments.map((item) => String(item.paidAt || item.createdAt || '').slice(0, 7)).filter(Boolean))].sort().reverse()
  const minutes = visibleActivities.reduce((total, item) => total + item.minutes, 0)
  const calories = visibleActivities.reduce((total, item) => total + item.calories, 0)

  const loadPaymentData = async ({ silent = false } = {}) => {
    if (user?.role !== 'member') {
      setPaymentLoading(false)
      return
    }

    if (!silent) setPaymentLoading(true)
    setPaymentError('')
    try {
      const [packageData, subscriptionData, paymentData] = await Promise.all([
        getMembershipPackages(),
        getMySubscriptions(),
        getMyPayments(),
      ])
      setMembershipPackages(packageData)
      setSubscriptions(subscriptionData)
      setPayments(paymentData)
    } catch (error) {
      setPaymentError(getAuthErrorMessage(error, 'Không thể tải dữ liệu thanh toán.'))
    } finally {
      setPaymentLoading(false)
    }
  }

  const updatePayment = (nextPayment) => {
    setPayments((current) => [nextPayment, ...current.filter((item) => item.id !== nextPayment.id)])
  }

  const openCheckout = (payment) => {
    if (!payment?.checkoutUrl) throw new Error('Máy chủ chưa trả về liên kết thanh toán PayOS.')
    const url = new URL(payment.checkoutUrl, window.location.origin)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Liên kết thanh toán không hợp lệ.')
    window.location.assign(url.toString())
  }

  const handleStartPayment = async (membershipPackage) => {
    if (user?.role !== 'member') {
      navigate('/login', { state: { from: '/member' } })
      return
    }

    setProcessingPackageId(membershipPackage.id)
    setPaymentError('')
    try {
      let subscription = subscriptions.find((item) => Number(item.packageId) === Number(membershipPackage.id) && item.status === 'Pending')
      if (!subscription) {
        subscription = await createMemberSubscription(membershipPackage.id)
        setSubscriptions((current) => [subscription, ...current])
      }
      const payment = await createPayment(subscription.id)
      updatePayment(payment)
      openCheckout(payment)
    } catch (error) {
      setPaymentError(getAuthErrorMessage(error, 'Không thể bắt đầu thanh toán.'))
    } finally {
      setProcessingPackageId(null)
    }
  }

  const handleSyncPayment = async (id) => {
    setUpdatingPaymentId(id)
    setPaymentError('')
    try {
      updatePayment(await syncPayment(id))
    } catch (error) {
      setPaymentError(getAuthErrorMessage(error, 'Không thể đồng bộ thanh toán.'))
    } finally {
      setUpdatingPaymentId(null)
    }
  }

  const handleResumePayment = async (payment) => {
    setUpdatingPaymentId(payment.id)
    setPaymentError('')
    try {
      const nextPayment = await createPayment(payment.subscriptionId)
      updatePayment(nextPayment)
      openCheckout(nextPayment)
    } catch (error) {
      setPaymentError(getAuthErrorMessage(error, 'Không thể mở trang thanh toán.'))
    } finally {
      setUpdatingPaymentId(null)
    }
  }

  const handleCancelPayment = async (id) => {
    if (!window.confirm('Bạn muốn hủy yêu cầu thanh toán PayOS này?')) return
    setUpdatingPaymentId(id)
    setPaymentError('')
    try {
      updatePayment(await cancelPayment(id))
    } catch (error) {
      setPaymentError(getAuthErrorMessage(error, 'Không thể hủy thanh toán.'))
    } finally {
      setUpdatingPaymentId(null)
    }
  }

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Cổng thông tin Hội viên | SportPulse Olympus'
    return () => { document.title = previousTitle }
  }, [])

  useEffect(() => {
    loadPaymentData()
  }, [user?.role])

  return <div className="member-page">
    <header className="member-header">
      <div className="member-header-main member-container">
        <Link to="/member" className="member-brand"><span className="member-brand-icon"><Trophy size={26} /></span><span><span className="member-brand-name">SportPulse <span className="member-tag">Hội viên</span></span><small>Trung tâm Thể thao Olympus</small></span></Link>
        <div className="member-location"><MapPin size={17} /><span>Cơ sở 1 - Cầu Giấy, Hà Nội</span><b>● 06:00 - 22:00</b></div>
        <div className="member-header-actions"><ThemeToggle />
          <a href="#rewards" className="member-points"><Coins size={22} /><span><small>Điểm thưởng</small><strong>1.250 <small>pts</small></strong></span></a>
          <button type="button" className="member-icon-button member-notification" aria-label="Thông báo" onClick={() => setDialog({ title: 'Thông báo', description: 'Bạn đang xem giao diện hội viên với dữ liệu mẫu. Thông báo cá nhân sẽ xuất hiện khi hệ thống được kết nối.' })}><Bell size={22} /><i /></button>
          <button type="button" className="member-button member-button--primary member-book-button" onClick={() => showUnavailable('Đặt sân ngay')}><PlusCircle size={17} />Đặt sân ngay</button>
          <a href="#tong-quan" className="member-profile" aria-label={`Xem thông tin của ${displayName}`} title={displayName}><span className="member-avatar" aria-hidden="true">{initials}</span><span className="member-profile-info"><small>Xin chào,</small><strong><span className="member-profile-name">{displayName}</span><BadgeCheck size={15} /></strong></span></a>
          <button type="button" className="member-button member-logout" aria-label="Đăng xuất" title="Đăng xuất" onClick={handleLogout}><LogOut size={17} /><span>Đăng xuất</span></button>
        </div>
      </div>
      <nav className="member-nav member-container" aria-label="Điều hướng hội viên">{navigation.map(([id, Icon, label]) => <a key={id} href={`#${id}`} className={activeNav === id ? 'is-active' : ''} aria-current={activeNav === id ? 'location' : undefined} onClick={() => setActiveNav(id)}><Icon size={17} />{label}</a>)}</nav>
    </header>

    <main className="member-container member-main">
      <p className="member-demo"><Info size={15} />Gói hội viên và giao dịch thanh toán được đồng bộ trực tiếp từ hệ thống.</p>
      {paymentError && <div className="member-api-message member-api-message--error" role="alert"><Info size={17} /><span>{paymentError}</span><button type="button" onClick={() => loadPaymentData()}>Thử lại</button></div>}
      <section id="tong-quan" className="member-overview" aria-label="Tổng quan tài khoản">
        <article className="member-id-card">
          <div className="member-row"><span className="member-tag member-tag--gold">Gold Membership</span><span className="member-id-number">#SP-VN-88924</span><Award size={25} /></div>
          <div className="member-identity"><span className="member-avatar member-avatar--large" aria-hidden="true">{initials}</span><div><h1>{displayName}</h1><p>Tham gia: 15/06/2023</p><div className="member-identity-status"><Status>Đang hoạt động</Status><small>• Cơ sở Cầu Giấy</small></div></div></div>
          <div className="member-quick-pass"><span className="member-qr"><QrCode size={39} /></span><div><strong>Mã QR Check-in Tức thì</strong><small>Quét tại cổng quay / Quầy lễ tân</small></div><button type="button" onClick={() => setDialog({ title: 'Mã QR hội viên', qr: true, description: 'Mã check-in cá nhân sẽ được cấp sau khi kết nối hệ thống hội viên.' })}>Phóng to</button></div>
          <div className="member-wallet"><div><small>Số dư ví SportPay</small><strong>2.450.000 đ</strong></div><button type="button" onClick={() => showUnavailable('Nạp ví SportPay')}><Wallet size={17} />Nạp ví</button></div>
        </article>
        <article className="member-card member-active-pass">
          <div className="member-pass-heading"><div><div className="member-pass-status"><Status>Gói hiện hành: đang hoạt động</Status><small className="member-muted">#OP-8821-GLD</small></div><h2>Gói Hội Viên Gold Pass 6 Tháng</h2><p className="member-muted">Đặc quyền sân Pickleball, Tennis, Cầu Lông & khu phục hồi Sauna.</p></div><div className="member-expiry"><strong>52 <small>ngày còn lại</small></strong><span>Hạn thẻ: <b>15/12/2024</b></span><small>Tại ngày mẫu 24/10/2024</small></div></div>
          <div className="member-benefits">
            <div><span>HLV Cá nhân (PT 1-1)<Dumbbell size={19} /></span><strong>18 <small>/ 25 buổi còn lại</small></strong><div className="member-progress"><i style={{ width: '72%' }} /></div><small>Đã hoàn thành 7 buổi với HLV Đăng</small></div>
            <div className="member-benefit--green"><span>Pickleball & Cầu Lông<Trophy size={19} /></span><strong>100% Free</strong><p>Khung giờ ngoài cao điểm</p><div className="member-progress"><i /></div><small>08:00 - 16:00 các ngày trong tuần</small></div>
            <div className="member-benefit--gold"><span>Ưu đãi đặt sân cao cấp<Percent size={19} /></span><strong>Giảm 25%</strong><p>Sân Tennis & Sân Bóng Đá</p><div className="member-progress"><i /></div><small>Áp dụng tất cả các khung giờ VIP</small></div>
          </div>
          <div className="member-pass-footer"><p><CheckCircle2 size={17} />Tự động gia hạn 15/12/2024 qua Visa (*4492)</p><div className="member-actions"><button type="button" className="member-button" onClick={() => showUnavailable('Tạm đóng băng gói')}><PauseCircle size={16} />Đóng băng gói</button><button type="button" className="member-button member-button--soft" onClick={() => { setPackageFilter('club'); document.getElementById('goi-tap').scrollIntoView({ block: 'start' }); setActiveNav('goi-tap') }}><ArrowUpRight size={16} />Nâng cấp VIP</button><button type="button" className="member-button member-button--primary" onClick={() => showUnavailable('Gia hạn gói tập')}><RefreshCw size={16} />Gia hạn gói tập</button></div></div>
        </article>
      </section>

      <section id="goi-tap" className="member-section">
        <SectionHeading icon={BadgeCheck} eyebrow="Chương trình hội viên thể thao cao cấp" title="Đăng ký & Khám phá Gói tập mới" description="Lựa chọn gói hội viên linh hoạt theo nhu cầu rèn luyện, thi đấu và trải nghiệm của bạn.">
          <Filters label="Lọc gói tập" value={packageFilter} onChange={setPackageFilter} options={[[ 'all', 'Tất cả gói' ], ['period', 'Theo tháng / Năm'], ['pt', 'Huấn luyện viên PT'], ['club', 'CLB / Doanh nghiệp']]} />
        </SectionHeading>
        {paymentLoading ? <div className="member-card member-api-state"><LoaderCircle className="member-spin" size={26} /><strong>Đang tải gói hội viên...</strong></div> : visiblePackages.length ? <div className="member-package-grid">{visiblePackages.map((item) => {
          const pendingSubscription = subscriptions.find((subscription) => Number(subscription.packageId) === Number(item.id) && subscription.status === 'Pending')
          const isProcessing = processingPackageId === item.id
          return <article key={item.id} className={`member-card member-package ${item.featured ? 'member-package--featured' : ''}`}>
            {item.featured && <span className="member-popular">Gói đang mở đăng ký</span>}
            <div className="member-row"><span className={`member-tag ${item.tone ? `member-tag--${item.tone}` : ''}`}>{item.tag}</span><item.icon size={23} /></div>
            <h3>{item.name}</h3><p className="member-package-description">{item.description}</p><div className="member-price"><strong>{item.price} <small>{item.unit}</small></strong><p>{item.note}</p></div>
            <ul>{item.benefits.map((benefit) => <li key={benefit}><CheckCircle2 size={17} /><span>{benefit}</span></li>)}</ul>
            <div className="member-package-actions"><button type="button" disabled={isProcessing} className={`member-button ${item.featured ? 'member-button--primary' : 'member-button--soft'}`} onClick={() => handleStartPayment(item)}>{isProcessing ? <><LoaderCircle className="member-spin" size={16} />Đang tạo thanh toán...</> : <><CreditCard size={16} />{pendingSubscription ? 'Tiếp tục thanh toán' : 'Đăng ký và thanh toán'}</>}</button><button type="button" className="member-button member-button--text" onClick={() => setDialog({ title: item.name, description: `${item.price} ${item.unit} · ${item.note}`, benefits: item.benefits })}>Xem chi tiết quyền lợi</button></div>
          </article>
        })}</div> : <div className="member-card member-api-state"><Info size={26} /><strong>Chưa có gói hội viên đang mở đăng ký.</strong></div>}
      </section>

      <section id="lich-dat" className="member-section">
        <SectionHeading icon={CalendarDays} eyebrow="Sẵn sàng cho buổi tập tiếp theo" title="Lịch đặt sân của tôi" description="Quản lý các lịch đặt và lên kế hoạch vận động của bạn." />
        <div className="member-card member-booking-empty"><CalendarDays size={34} /><div><h3>Chưa có lịch đặt sân</h3><p>Lịch đặt của bạn sẽ hiển thị tại đây khi hệ thống được kết nối.</p></div><button type="button" className="member-button member-button--primary" onClick={() => showUnavailable('Đặt sân ngay')}><PlusCircle size={17} />Đặt sân ngay</button></div>
      </section>

      <section id="checkin-history" className="member-section">
        <SectionHeading icon={ShieldCheck} eyebrow="Nhật ký hoạt động thể chất" title="Lịch sử Check-in & Hoạt động thể thao" description="Theo dõi thời lượng tập luyện, sân thi đấu và lượng calo tiêu hao ước tính.">
          <select aria-label="Khoảng thời gian check-in" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="10/2024">Tháng 10 / 2024</option><option value="09/2024">Tháng 09 / 2024</option><option value="all">Toàn bộ lịch sử</option></select>
        </SectionHeading>
        <Filters label="Lọc bộ môn" options={['all', 'Pickleball', 'Tennis', 'Cầu lông', 'Bể bơi'].map((sport) => [sport, sport === 'all' ? 'Tất cả' : sport])} value={sportFilter} onChange={setSportFilter} />
        <div className="member-metrics">
          <div className="member-card"><span className="member-metric-icon"><CalendarCheck size={25} /></span><div><p>Lượt check-in trong kỳ</p><strong>{visibleActivities.length} <small>buổi tập</small></strong></div></div>
          <div className="member-card"><span className="member-metric-icon member-tag--green"><Timer size={25} /></span><div><p>Tổng thời lượng vận động</p><strong>{(minutes / 60).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} <small>giờ thi đấu</small></strong></div></div>
          <div className="member-card"><span className="member-metric-icon member-tag--gold"><Flame size={25} /></span><div><p>Năng lượng tiêu hao ước tính</p><strong>{calories.toLocaleString('vi-VN')} <small>kcal</small></strong></div></div>
        </div>
        <div className="member-card member-table-card"><div className="member-table-scroll" tabIndex={0} role="region" aria-label="Lịch sử check-in"><table><thead><tr>{['Thời gian & Ngày', 'Sân bãi / Dịch vụ', 'Bộ môn', 'Hình thức Check-in', 'Thời lượng & Chi tiết', 'Trạng thái'].map((heading) => <th scope="col" key={heading}>{heading}</th>)}</tr></thead><tbody>{visibleActivities.map((item) => <tr key={item.date}><td><strong>{item.date}</strong><small className="member-inline"><Clock3 size={14} />{item.time}</small></td><td><strong>{item.court}</strong><small>{item.location}</small></td><td><span className="member-tag"><span className="member-inline">{item.sport === 'Bể bơi' ? <Waves size={15} /> : <Trophy size={15} />}{item.sport}</span></span></td><td><span className="member-inline"><item.icon size={17} />{item.method}</span></td><td><strong>{item.minutes} phút</strong><small>{item.detail}</small></td><td><Status>Hoàn thành</Status></td></tr>)}{!visibleActivities.length && <tr><td colSpan={6} className="member-empty">Không có hoạt động trong bộ lọc đã chọn.</td></tr>}</tbody></table></div><div className="member-table-footer">Hiển thị {visibleActivities.length} lượt check-in trong dữ liệu mẫu</div></div>
      </section>

      <section id="rewards" className="member-rewards member-card">
        <span className="member-rewards-icon"><Award size={36} /></span><div><p className="member-eyebrow">Olympus Rewards</p><h2>Mỗi buổi tập, thêm một đặc quyền</h2><p>Bạn đang có <strong>1.250 điểm</strong>. Khám phá ưu đãi dành riêng cho hội viên Gold.</p></div><button type="button" className="member-button" onClick={() => showUnavailable('Đổi điểm Olympus Rewards')}><Sparkles size={17} />Khám phá ưu đãi</button>
      </section>

      <section id="hoa-don" className="member-section">
        <SectionHeading icon={ReceiptText} eyebrow="Thông tin giao dịch hội viên" title="Lịch sử Hóa đơn & Thanh toán" description="Tra cứu các giao dịch gia hạn, nạp ví và thanh toán dịch vụ.">
          <div className="member-actions"><button type="button" className="member-button" disabled={paymentLoading} onClick={() => loadPaymentData()}><RefreshCw className={paymentLoading ? 'member-spin' : ''} size={17} />Làm mới</button><select aria-label="Lọc tháng giao dịch" value={invoicePeriod} onChange={(event) => setInvoicePeriod(event.target.value)}><option value="all">Tất cả giao dịch</option>{paymentMonths.map((month) => <option key={month} value={month}>Tháng {month.slice(5)} / {month.slice(0, 4)}</option>)}</select></div>
        </SectionHeading>
        <div className="member-card member-table-card"><div className="member-table-scroll" tabIndex={0} role="region" aria-label="Hóa đơn và thanh toán"><table><thead><tr>{['Mã giao dịch', 'Gói hội viên', 'Ngày giao dịch', 'Số tiền', 'Phương thức', 'Trạng thái', 'Thao tác'].map((heading) => <th key={heading} scope="col">{heading}</th>)}</tr></thead><tbody>{paymentLoading ? <tr><td colSpan={7} className="member-empty"><span className="member-inline"><LoaderCircle className="member-spin" size={18} />Đang tải lịch sử thanh toán...</span></td></tr> : visiblePayments.map((item) => {
          const subscription = subscriptions.find((entry) => entry.id === item.subscriptionId)
          const [statusLabel, statusTone] = paymentStatusLabels[item.status] || [item.status || 'Không xác định', 'muted']
          const isUpdating = updatingPaymentId === item.id
          return <tr key={item.id}><td className="member-invoice-id">#{item.transactionReference || `PAY-${item.id}`}</td><td><strong>{subscription?.packageName || 'Gói hội viên'}</strong><small>Đăng ký #{item.subscriptionId || '—'} · Đơn PayOS {item.payOSOrderCode || '—'}</small></td><td>{formatDateTime(item.paidAt || item.createdAt)}</td><td className="member-amount">{formatCurrency(item.amount)}</td><td><span className="member-inline"><QrCode size={17} />{item.paymentMethod || 'PayOS'}</span></td><td><Status tone={statusTone}>{statusLabel}</Status>{item.reviewReason && <small>{item.reviewReason}</small>}</td><td><div className="member-payment-actions">{item.status === 'Pending' && <button type="button" className="member-button member-button--primary" disabled={isUpdating} onClick={() => handleResumePayment(item)}>{isUpdating ? <LoaderCircle className="member-spin" size={15} /> : <ExternalLink size={15} />}Thanh toán</button>}<button type="button" className="member-button" disabled={isUpdating} onClick={() => handleSyncPayment(item.id)}><RefreshCw className={isUpdating ? 'member-spin' : ''} size={15} />Đồng bộ</button>{item.status === 'Pending' && <button type="button" className="member-button member-button--text" disabled={isUpdating} onClick={() => handleCancelPayment(item.id)}>Hủy</button>}</div></td></tr>
        })}{!paymentLoading && !visiblePayments.length && <tr><td colSpan={7} className="member-empty">Chưa có giao dịch thanh toán nào.</td></tr>}</tbody></table></div><div className="member-invoice-note"><ShieldCheck size={19} /><p>Trạng thái được lấy từ Payment API. Giao dịch thành công sẽ tự kích hoạt gói hội viên.</p></div></div>
      </section>
    </main>
    <footer className="member-footer"><div className="member-container"><Link to="/" className="member-brand"><span className="member-brand-icon"><Trophy size={20} /></span><strong>SportPulse Olympus</strong></Link><p>© {new Date().getFullYear()} Olympus Sports Center</p><a href="tel:19006886">Hotline CSKH: <strong>1900 6886</strong></a></div></footer>
    {dialog && <MemberDialog content={dialog} onClose={() => setDialog(null)} />}
  </div>
}
