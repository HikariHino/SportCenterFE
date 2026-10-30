import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, BellRing, CalendarDays, Check, ChevronDown, Clock3, Dumbbell, Layers, LoaderCircle, LogOut, Menu, RefreshCw, ScanLine, Search, ShieldCheck, Target, Trophy, Users, X } from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../contexts/AuthContext'
import { getToken, getUserDisplayName, getUserInitials } from '../utils/auth'
import { getLandingAction, getLandingPortal } from '../utils/landingNavigation'
import { membershipPackageType } from '../utils/memberSubscriptions'
import { getLandingCoaches, getLandingPackages, getLandingSessions, getLandingSports } from '../services/landingService'
import '../style/SportDashboard.css'

const navigation = [['experience', 'Trải nghiệm'], ['schedule', 'Lịch lớp học'], ['memberships', 'Gói tập'], ['coaches', 'Huấn luyện viên']]
const emptyResource = { items: [], loading: true, error: false }
const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0)
const dateLabel = (value, options) => {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', ...options }).format(date) : 'Chưa cập nhật'
}
const sessionTime = item => `${dateLabel(item.startsAt, { hour: '2-digit', minute: '2-digit' })} – ${dateLabel(item.endsAt, { hour: '2-digit', minute: '2-digit' })}`
const heroPhoto = 'https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=1100&q=85'

function ActionLink({ action, children, className = '', ...props }) {
  return <Link to={action.to} state={action.state} className={className} {...props}>{children}</Link>
}

function SectionHeading({ eyebrow, title, children, action }) {
  return <div className="lp-section-heading"><div><p className="lp-eyebrow">{eyebrow}</p><h2>{title}</h2>{children && <p className="lp-section-copy">{children}</p>}</div>{action}</div>
}

function ResourceState({ resource, empty, onRetry }) {
  if (resource.loading) return <div className="lp-resource" role="status"><LoaderCircle className="lp-spin" size={24} /><p>Đang tải thông tin mới nhất…</p></div>
  if (resource.error) return <div className="lp-resource" role="status"><p>Chưa kết nối được dữ liệu. Bạn có thể thử lại sau.</p><button className="lp-text-button" type="button" onClick={onRetry}><RefreshCw size={15} />Thử lại</button></div>
  return <div className="lp-resource"><CalendarDays size={25} /><p>{empty}</p></div>
}

export default function SportDashboard() {
  const { user, logout } = useAuth()
  const currentUser = user && getToken() ? user : null
  const member = currentUser?.role === 'member'
  const portal = getLandingPortal(currentUser)
  const [menuOpen, setMenuOpen] = useState(false)
  const headerRef = useRef(null)
  const menuButton = useRef(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const logoutLock = useRef(false)
  const [activeSection, setActiveSection] = useState('')
  const [catalogRevision, setCatalogRevision] = useState(0)
  const [catalog, setCatalog] = useState({ packages: emptyResource, sports: emptyResource, coaches: emptyResource })
  const [sessions, setSessions] = useState({ ...emptyResource, total: 0 })
  const [sessionRevision, setSessionRevision] = useState(0)
  const [sportId, setSportId] = useState('')
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [packageType, setPackageType] = useState('all')

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setCatalog({ packages: emptyResource, sports: emptyResource, coaches: emptyResource })
    const loaders = { packages: getLandingPackages, sports: getLandingSports, coaches: getLandingCoaches }
    Promise.allSettled(Object.entries(loaders).map(async ([key, loader]) => {
      try {
        const items = await loader(controller.signal)
        if (active) setCatalog(previous => ({ ...previous, [key]: { items, loading: false, error: false } }))
      } catch {
        if (active) setCatalog(previous => ({ ...previous, [key]: { items: [], loading: false, error: true } }))
      }
    }))
    return () => { active = false; controller.abort() }
  }, [catalogRevision])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setSessions({ ...emptyResource, total: 0 })
    getLandingSessions({ sportId, search: submittedSearch, signal: controller.signal })
      .then(result => { if (active) setSessions({ items: result.items, total: result.total, loading: false, error: false }) })
      .catch(() => { if (active) setSessions({ items: [], total: 0, loading: false, error: true }) })
    return () => { active = false; controller.abort() }
  }, [sportId, submittedSearch, sessionRevision])

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) setActiveSection(entry.target.id)
    }, { rootMargin: '-15% 0px -65% 0px' })
    navigation.forEach(([id]) => { const element = document.getElementById(id); if (element) observer.observe(element) })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const close = event => { if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus() } }
    const outside = event => { if (!headerRef.current?.contains(event.target)) setMenuOpen(false) }
    document.addEventListener('keydown', close)
    document.addEventListener('pointerdown', outside)
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', outside) }
  }, [menuOpen])

  async function handleLogout() {
    if (logoutLock.current) return
    logoutLock.current = true
    setLoggingOut(true)
    try { await logout(); setMenuOpen(false) }
    finally { logoutLock.current = false; setLoggingOut(false) }
  }

  const retryCatalog = () => setCatalogRevision(value => value + 1)
  const classAction = getLandingAction(currentUser, 'classes')
  const packageAction = getLandingAction(currentUser, 'subscriptions')
  const packages = catalog.packages.items.filter(pkg => packageType === 'all' || membershipPackageType(pkg) === packageType)
  const nextSession = sessions.items[0]

  return <main className="sport-page" id="top">
    <a className="lp-skip" href="#landing-content">Bỏ qua điều hướng</a>
    <div className="lp-announcement"><span><span className="lp-live-dot" />OLYMPUS · KHÔNG GIAN TẬP LUYỆN CỦA BẠN</span><a href="#how-it-works">Bắt đầu hành trình <ArrowUpRight size={13} /></a></div>
    <header className="lp-header" ref={headerRef}>
      <div className="lp-container lp-header-row">
        <a className="lp-brand" href="#top" aria-label="SportPulse Olympus - Trang chủ"><span className="lp-brand-icon"><Trophy size={25} /></span><span><strong>SportPulse<span> Olympus</span></strong><small>SPORTCENTER · TRAIN YOUR WAY</small></span></a>
        <nav id="landing-navigation" aria-label="Điều hướng trang chủ" className={`lp-navigation${menuOpen ? ' is-open' : ''}`}>{navigation.map(([id, label]) => <a href={`#${id}`} key={id} className={activeSection === id ? 'is-active' : ''} aria-current={activeSection === id ? 'location' : undefined} onClick={() => setMenuOpen(false)}>{label}</a>)}</nav>
        <div className="lp-account-actions">
          <ThemeToggle compact />
          {currentUser ? <><ActionLink action={portal} className="lp-account" title={getUserDisplayName(currentUser)} aria-label={`${portal.label}: ${getUserDisplayName(currentUser)}`}><span className="lp-avatar">{getUserInitials(currentUser)}</span><span><small>{portal.label}</small><strong>{getUserDisplayName(currentUser)}</strong></span></ActionLink><button className="lp-logout" type="button" aria-label="Đăng xuất" disabled={loggingOut} onClick={handleLogout}>{loggingOut ? <LoaderCircle size={17} className="lp-spin" /> : <LogOut size={17} />}<span>{loggingOut ? 'Đang thoát…' : 'Đăng xuất'}</span></button></> : <><Link className="lp-login" to="/login">Đăng nhập</Link><Link className="lp-button lp-button-primary lp-register" to="/register">Đăng ký <ArrowUpRight size={15} /></Link></>}
          <button ref={menuButton} className="lp-menu-toggle" type="button" aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'} aria-expanded={menuOpen} aria-controls="landing-navigation" onClick={() => setMenuOpen(value => !value)}>{menuOpen ? <X size={23} /> : <Menu size={23} />}</button>
        </div>
      </div>
    </header>

    <section className="lp-hero" id="landing-content"><div className="lp-container lp-hero-grid">
      <div className="lp-hero-copy"><p className="lp-eyebrow"><span />MỖI BUỔI TẬP, MỘT BƯỚC TIẾN</p><h1>Chủ động lịch tập.<br /><span>Bứt phá</span> mỗi ngày.</h1><p className="lp-hero-description">Từ tập luyện tự do đến đồng hành cùng PT 1-1. Chọn gói phù hợp, đăng ký buổi học và theo dõi hành trình của bạn cùng Olympus.</p><div className="lp-hero-actions"><a className="lp-button lp-button-primary" href="#memberships">Khám phá gói tập <ArrowUpRight size={18} /></a><a className="lp-button lp-button-secondary" href="#schedule"><CalendarDays size={18} />Xem lịch lớp học</a></div><div className="lp-hero-assurances"><span><Check size={15} />Standard & PT 1-1</span><span><Check size={15} />Đăng ký buổi học trực tuyến</span><span><Check size={15} />Thanh toán PayOS</span></div><div className="lp-hero-note"><span className="lp-note-icon"><ShieldCheck size={20} /></span><p><strong>Kế hoạch của bạn, trong một tài khoản.</strong><span>Lịch tập, gói hội viên và thanh toán luôn ở cùng một nơi.</span></p></div></div>
      <div className="lp-hero-visual"><div className="lp-hero-photo"><img src={heroPhoto} alt="Hoạt động tập luyện thể thao" fetchPriority="high" /><div className="lp-photo-shade" /><span className="lp-photo-caption"><span />MOVE WITH PURPOSE.</span><div className="lp-visual-type"><Dumbbell size={17} /><span>STANDARD <i>+</i> PT 1-1</span></div></div><div className="lp-next-session"><span className="lp-next-icon"><CalendarDays size={21} /></span><div><small>BUỔI HỌC SẮP TỚI</small><strong>{nextSession?.className || (sessions.loading ? 'Đang cập nhật lịch học…' : 'Chọn nhịp tập của riêng bạn')}</strong><span>{nextSession ? `${dateLabel(nextSession.startsAt, { day: '2-digit', month: '2-digit' })} · ${sessionTime(nextSession)}` : 'Khám phá lịch lớp học bên dưới'}</span></div><a href="#schedule" aria-label="Xem lịch lớp học"><ArrowUpRight size={21} /></a></div><span className="lp-visual-label">A LITTLE STRONGER. EVERY DAY.</span></div>
    </div></section>

    <section className="lp-journey-strip" aria-label="Hành trình hội viên"><div className="lp-container"><div><span>01</span><p><strong>Chọn cách bạn tập</strong><small>Gói Standard hoặc PT 1-1</small></p></div><div><span>02</span><p><strong>Sắp xếp lịch phù hợp</strong><small>Đăng ký từng buổi học</small></p></div><div><span>03</span><p><strong>Theo dõi mọi thay đổi</strong><small>Lịch bù, thông báo & thanh toán</small></p></div></div></section>

    <section className="lp-section lp-experience" id="experience"><div className="lp-container"><SectionHeading eyebrow="TẬP TRUNG VÀO ĐIỀU QUAN TRỌNG" title={<>Tập luyện liền mạch.<br />Quản lý thật nhẹ nhàng.</>}>Một không gian kết nối những việc bạn cần trước, trong và sau mỗi buổi tập.</SectionHeading><div className="lp-feature-grid">{[
      [CalendarDays, 'Lớp học theo lịch của bạn', 'Khám phá các buổi học, xem thời gian và đăng ký khi còn chỗ.', 'classes'],
      [ScanLine, 'Ra vào phòng gym', 'Sử dụng mã QR hội viên và theo dõi lịch sử ra vào của mình.', 'checkin'],
      [Target, 'Lộ trình tập luyện cá nhân', 'Theo dõi kế hoạch tập luyện được huấn luyện viên xây dựng cho bạn.', 'training-plans'],
      [BellRing, 'Luôn theo kịp lịch tập', 'Xem thông báo thay đổi buổi học và cập nhật lịch bù mới.', 'notifications'],
    ].map(([Icon, title, text, view], index) => <ActionLink key={view} action={getLandingAction(currentUser, view)} className="lp-feature-card"><div><span className="lp-feature-icon"><Icon size={24} /></span><small>0{index + 1}</small></div><h3>{title}</h3><p>{text}</p><span className="lp-feature-link">{currentUser && !member ? 'Mở không gian làm việc' : 'Khám phá ngay'}<ArrowUpRight size={17} /></span></ActionLink>)}</div></div></section>

    <section className="lp-section lp-schedule" id="schedule"><div className="lp-container"><SectionHeading eyebrow="DÀNH THỜI GIAN CHO CHÍNH MÌNH" title="Tìm buổi tập tiếp theo.">Lịch các buổi học còn chỗ được cập nhật từ trung tâm. Đăng nhập để kiểm tra điều kiện và đăng ký.</SectionHeading><div className="lp-schedule-toolbar"><div className="lp-sport-filters" aria-label="Lọc theo bộ môn"><button type="button" className={!sportId ? 'is-active' : ''} aria-pressed={!sportId} onClick={() => setSportId('')}>Tất cả bộ môn</button>{catalog.sports.items.map(sport => <button key={sport.id} type="button" className={sportId === String(sport.id) ? 'is-active' : ''} aria-pressed={sportId === String(sport.id)} onClick={() => setSportId(String(sport.id))}>{sport.name}</button>)}</div><form className="lp-class-search" onSubmit={event => { event.preventDefault(); setSubmittedSearch(search.trim()); setSessionRevision(value => value + 1) }}><Search size={17} /><input type="search" aria-label="Tìm lớp học" placeholder="Tìm lớp học…" maxLength={200} value={search} onChange={event => setSearch(event.target.value)} /><button type="submit" aria-label="Tìm kiếm lớp học"><ArrowRight size={18} /></button></form></div>{catalog.sports.error && <p className="lp-inline-note">Chưa tải được bộ môn. Bạn vẫn có thể xem tất cả lịch học. <button type="button" onClick={retryCatalog}>Tải lại bộ môn</button></p>}
      {sessions.loading || sessions.error || !sessions.items.length ? <ResourceState resource={sessions} empty="Chưa có buổi học còn chỗ phù hợp. Bạn có thể đổi bộ môn hoặc tìm lại sau." onRetry={() => setSessionRevision(value => value + 1)} /> : <><div className="lp-session-grid">{sessions.items.map(item => <article className="lp-session-card" key={item.id}><div className="lp-session-top"><span className="lp-session-date"><strong>{dateLabel(item.startsAt, { day: '2-digit' })}</strong><small>{dateLabel(item.startsAt, { month: 'short' })}</small></span><span className="lp-seat-badge"><span />Còn {item.availableSeats} chỗ</span></div><h3>{item.className}</h3><p><Users size={15} />{item.coachName || 'Trung tâm đang cập nhật HLV'}</p><div className="lp-session-bottom"><span><Clock3 size={15} />{sessionTime(item)}</span><span>{dateLabel(item.startsAt, { weekday: 'long' })}</span></div>{item.roomName && <small className="lp-room-name">{item.roomName}</small>}</article>)}</div><div className="lp-section-bottom"><p>Đang hiển thị {sessions.items.length} / {sessions.total} buổi học phù hợp.</p><ActionLink action={classAction} className="lp-text-link">{currentUser && !member ? 'Mở cổng làm việc' : 'Vào lịch đăng ký'}<ArrowRight size={17} /></ActionLink></div></>}
    </div></section>

    <section className="lp-section lp-memberships" id="memberships"><div className="lp-container"><SectionHeading eyebrow="MỘT LỰA CHỌN, NHIỀU ĐỘNG LỰC" title="Gói tập dành cho bạn.">Tập luyện tự do với Standard, hoặc chọn PT 1-1 để được hướng dẫn cá nhân. Bạn có thể sử dụng hai loại gói song song.</SectionHeading><div className="lp-package-toolbar"><div className="lp-package-filters" aria-label="Lọc loại gói tập">{[['all', 'Tất cả gói'], ['Standard', 'Standard'], ['PT', 'PT 1-1']].map(([type, label]) => <button type="button" key={type} className={packageType === type ? 'is-active' : ''} aria-pressed={packageType === type} onClick={() => setPackageType(type)}>{label}</button>)}</div><span><ShieldCheck size={15} />Giá & thời hạn từ trung tâm</span></div>
      {catalog.packages.loading || catalog.packages.error || !packages.length ? <ResourceState resource={catalog.packages} empty="Trung tâm chưa mở bán gói thuộc loại này. Vui lòng xem loại gói khác hoặc quay lại sau." onRetry={retryCatalog} /> : <div className="lp-package-grid">{packages.map(pkg => { const pt = membershipPackageType(pkg) === 'PT'; return <article className={`lp-package-card${pt ? ' is-pt' : ''}`} key={pkg.id}><div className="lp-package-label"><span>{pt ? <Users size={17} /> : <Dumbbell size={17} />}{pt ? 'PT 1-1' : 'STANDARD'}</span><span>{pkg.durationInDays} ngày</span></div><h3>{pkg.packageName}</h3><p className="lp-package-description">{pkg.description || (pt ? 'Đồng hành cùng huấn luyện viên cá nhân trong hành trình tập luyện.' : 'Duy trì thói quen tập luyện theo kế hoạch của bạn.')}</p><div className="lp-package-price">{money(pkg.price)}<small>/ {pkg.durationInDays} ngày</small></div><ul><li><Check size={15} />{pt ? 'Gói huấn luyện viên cá nhân' : 'Gói hội viên tập chung'}</li><li><Check size={15} />Theo dõi hiệu lực trong tài khoản</li><li><Check size={15} />Kích hoạt sau khi thanh toán được xác nhận</li></ul><ActionLink action={getLandingAction(currentUser, 'subscriptions', pkg.id)} className={`lp-button ${pt ? 'lp-button-primary' : 'lp-button-secondary'}`}>{currentUser && !member ? 'Mở cổng làm việc' : 'Xem & đăng ký'}<ArrowUpRight size={17} /></ActionLink></article> })}</div>}
      <div className="lp-upgrade-note"><span><Layers size={23} /></span><div><strong>Muốn đổi sang gói Standard cao hơn?</strong><p>Đăng nhập để xem điều kiện nâng cấp và số tiền chênh lệch trước khi xác nhận.</p></div><ActionLink action={packageAction} className="lp-text-link">Xem gói của bạn<ArrowRight size={17} /></ActionLink></div>
    </div></section>

    <section className="lp-section lp-coaches" id="coaches"><div className="lp-container"><SectionHeading eyebrow="THÊM HƯỚNG DẪN, THÊM TỰ TIN" title="Cùng bạn qua từng buổi tập." action={<ActionLink action={classAction} className="lp-text-link">Xem lịch các lớp<ArrowUpRight size={17} /></ActionLink>}>Tìm hiểu đội ngũ huấn luyện viên của trung tâm và các buổi học đang mở.</SectionHeading>{catalog.coaches.loading || catalog.coaches.error || !catalog.coaches.items.length ? <ResourceState resource={catalog.coaches} empty="Thông tin huấn luyện viên đang được trung tâm cập nhật." onRetry={retryCatalog} /> : <div className="lp-coach-grid">{catalog.coaches.items.slice(0, 6).map((coach, index) => <article className="lp-coach-card" key={coach.id}><div className={`lp-coach-monogram lp-coach-tone-${index % 3}`}><span>{getUserInitials({ fullName: coach.fullName })}</span><Dumbbell size={100} strokeWidth={.8} aria-hidden="true" /><small>OLYMPUS COACH</small></div><div className="lp-coach-info"><p>{coach.specialization || 'Huấn luyện viên'}</p><h3>{coach.fullName}</h3>{Number(coach.yearsOfExperience) > 0 && <span>{coach.yearsOfExperience} năm kinh nghiệm</span>}{coach.bio && <small>{coach.bio}</small>}</div></article>)}</div>}</div></section>

    <section className="lp-section lp-how" id="how-it-works"><div className="lp-container lp-how-grid"><div><p className="lp-eyebrow">BẮT ĐẦU THẬT ĐƠN GIẢN</p><h2>Sẵn sàng cho<br />buổi tập đầu tiên?</h2><p>Thiết lập tài khoản một lần. Chủ động theo dõi lịch tập và dịch vụ trong cổng hội viên.</p><ActionLink action={portal} className="lp-button lp-button-primary">{portal.label}<ArrowUpRight size={18} /></ActionLink></div><ol className="lp-steps"><li><span>01</span><div><h3>Tạo tài khoản hội viên</h3><p>Đăng ký, xác thực email và cập nhật hồ sơ cá nhân.</p></div></li><li><span>02</span><div><h3>Chọn gói tập phù hợp</h3><p>Xem giá, thời hạn và thanh toán qua PayOS hoặc tại quầy. Gói có hiệu lực khi hệ thống xác nhận thanh toán.</p></div></li><li><span>03</span><div><h3>Đăng ký buổi học & bắt đầu tập</h3><p>Chọn buổi còn chỗ, kiểm tra lịch của mình và theo dõi thông báo từ trung tâm.</p></div></li></ol></div></section>

    <section className="lp-section lp-faq" id="faq"><div className="lp-container lp-faq-grid"><div><p className="lp-eyebrow">GIẢI ĐÁP TRƯỚC KHI BẮT ĐẦU</p><h2>Bạn cần biết thêm?</h2><p>Thông tin để bạn dễ dàng lựa chọn và sắp xếp việc tập luyện.</p><ActionLink action={getLandingAction(currentUser, 'support')} className="lp-text-link">Gửi yêu cầu hỗ trợ<ArrowUpRight size={17} /></ActionLink></div><div>{[
      ['Tôi có thể dùng thẻ Standard và PT 1-1 cùng lúc không?', 'Có. Bạn chỉ có thể đăng ký PT 1-1 khi gói Standard đã kích hoạt và còn hiệu lực. Bạn có thể xem hiệu lực của từng gói trong cổng hội viên.'],
      ['Tôi cần làm gì để đăng ký một buổi học?', 'Đăng nhập tài khoản hội viên và có gói tập còn hiệu lực. Trong mục Lớp học, chọn buổi phù hợp; hệ thống kiểm tra điều kiện, số chỗ và lịch đã đăng ký trước khi xác nhận.'],
      ['Thanh toán xong thì gói tập có hiệu lực khi nào?', 'Gói được kích hoạt sau khi hệ thống xác nhận giao dịch thanh toán thành công. Bạn có thể xem trạng thái và đồng bộ lại giao dịch trong mục Thanh toán trực tuyến & Hóa đơn.'],
      ['Tôi xem lịch bù hoặc thay đổi buổi học ở đâu?', 'Thông báo về lịch học và lịch bù xuất hiện trong cổng hội viên. Bạn có thể mở mục Thông báo hệ thống để xem lại các cập nhật liên quan đến mình.'],
    ].map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={18} /></summary><p>{answer}</p></details>)}</div></div></section>

    <footer className="lp-footer"><div className="lp-container"><div className="lp-footer-callout"><div><p className="lp-eyebrow">BƯỚC TIẾP THEO LÀ CỦA BẠN</p><h2>Hẹn gặp ở buổi tập tiếp theo.</h2></div><ActionLink action={portal} className="lp-button lp-button-light">{currentUser ? portal.label : 'Tạo tài khoản hội viên'}<ArrowUpRight size={18} /></ActionLink></div><div className="lp-footer-grid"><div><a className="lp-brand" href="#top"><span className="lp-brand-icon"><Trophy size={24} /></span><span><strong>SportPulse<span> Olympus</span></strong><small>SPORTCENTER · TRAIN YOUR WAY</small></span></a><p>Kết nối tập luyện, lớp học và dịch vụ hội viên trong một không gian.</p></div><div><h3>Khám phá Olympus</h3><a href="#experience">Trải nghiệm tập luyện</a><a href="#schedule">Lịch lớp học</a><a href="#memberships">Gói Standard & PT 1-1</a><a href="#coaches">Huấn luyện viên</a></div><div><h3>Dành cho hội viên</h3><ActionLink action={classAction}>Lịch tập & đăng ký buổi</ActionLink><ActionLink action={getLandingAction(currentUser, 'payments')}>Thanh toán & hóa đơn</ActionLink><ActionLink action={getLandingAction(currentUser, 'support')}>Hỗ trợ khách hàng</ActionLink><a href="#faq">Câu hỏi thường gặp</a></div></div><div className="lp-footer-bottom"><span>© {new Date().getFullYear()} SportPulse Olympus · SportCenter</span><span><ShieldCheck size={14} />Tập luyện theo cách của bạn.</span></div></div></footer>
  </main>
}
