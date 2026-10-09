import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ThemeToggle from '../../components/ThemeToggle'
import {
  ArrowRight, BadgeCheck, Bell, CalendarDays, CheckCircle2, CircleDollarSign,
  Clock3, CreditCard, LayoutDashboard, LogOut, MapPin, QrCode, ReceiptText,
  Plus, ScanLine, Search, ShieldCheck, Trophy, UserCheck, Users, WalletCards, X,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { createMember } from '../../services/memberService'
import '../../style/Receptionist/Receptionist.css'

const navigation = [
  [LayoutDashboard, 'Tổng quan'],
  [CalendarDays, 'Lịch đặt sân'],
  [ScanLine, 'Check-in'],
  [Users, 'Hội viên'],
  [ReceiptText, 'Thanh toán'],
]

const pageMeta = {
  'Lịch đặt sân': ['VẬN HÀNH ĐẶT SÂN', 'Lịch đặt sân', 'Theo dõi lượt đặt sân và trạng thái phục vụ trong ngày.'],
  'Check-in': ['TIẾP NHẬN KHÁCH', 'Check-in tại quầy', 'Xác minh mã đặt sân hoặc tài khoản hội viên trước khi sử dụng dịch vụ.'],
  'Hội viên': ['HỖ TRỢ HỘI VIÊN', 'Tra cứu hội viên', 'Kiểm tra trạng thái tài khoản, gói dịch vụ và thông tin liên hệ.'],
  'Thanh toán': ['GIAO DỊCH TẠI QUẦY', 'Thanh toán', 'Theo dõi giao dịch và hóa đơn phát sinh tại quầy lễ tân.'],
}

const emptyBookings = []
const emptyMembers = []
const emptyPayments = []

const emptyMemberForm = {
  fullName: '',
  email: '',
  password: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  address: '',
  fitnessGoal: '',
}

const requestErrorMessage = (error, fallback) => {
  const validationErrors = error.response?.data?.errors
  return error.response?.data?.message
    || (validationErrors && Object.values(validationErrors).flat()[0])
    || error.message
    || fallback
}

const toDateKey = date => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function EmptyState({ icon: Icon = Search, title, text }) {
  return <div className="reception-empty"><span><Icon size={25} /></span><strong>{title}</strong><p>{text}</p></div>
}

function Overview({ onNavigate }) {
  const metrics = [
    [CalendarDays, 'Lượt đặt hôm nay', '--', 'blue'],
    [UserCheck, 'Khách đã check-in', '--', 'green'],
    [MapPin, 'Sân đang hoạt động', '--', 'purple'],
    [CircleDollarSign, 'Doanh thu tại quầy', '--', 'amber'],
  ]

  return <>
    <section className="reception-metrics" aria-label="Thống kê lễ tân">
      {metrics.map(([Icon, label, value, tone]) => <article key={label}><span className={tone}><Icon size={21} /></span><div><small>{label}</small><strong>{value}</strong><p>Chờ dữ liệu từ API</p></div></article>)}
    </section>

    <div className="reception-overview-grid">
      <section className="reception-card reception-queue">
        <div className="reception-card-head"><div><span>HÀNG ĐỢI</span><h2>Khách chờ check-in</h2></div><button type="button" onClick={() => onNavigate('Check-in')}>Mở check-in <ArrowRight size={15} /></button></div>
        <EmptyState icon={UserCheck} title="Chưa có khách trong hàng đợi" text="Danh sách sẽ cập nhật khi API check-in được kết nối." />
      </section>
      <section className="reception-card reception-court-panel">
        <div className="reception-card-head"><div><span>TÌNH TRẠNG SÂN</span><h2>Vận hành hiện tại</h2></div></div>
        <EmptyState icon={MapPin} title="Chưa có dữ liệu sân" text="Tình trạng sử dụng sân sẽ hiển thị theo thời gian thực." />
      </section>
    </div>

    <section className="reception-card reception-shortcuts">
      <div className="reception-card-head"><div><span>TRUY CẬP NHANH</span><h2>Nghiệp vụ tại quầy</h2></div></div>
      <div className="reception-shortcut-grid">
        <button type="button" onClick={() => onNavigate('Lịch đặt sân')}><span className="blue"><CalendarDays size={21} /></span><div><strong>Tra cứu lịch đặt sân</strong><small>Tìm theo ngày và trạng thái</small></div><ArrowRight size={17} /></button>
        <button type="button" onClick={() => onNavigate('Check-in')}><span className="green"><QrCode size={21} /></span><div><strong>Quét mã check-in</strong><small>Xác minh lượt đặt tại quầy</small></div><ArrowRight size={17} /></button>
        <button type="button" onClick={() => onNavigate('Hội viên')}><span className="purple"><Users size={21} /></span><div><strong>Tra cứu hội viên</strong><small>Kiểm tra tài khoản và gói dịch vụ</small></div><ArrowRight size={17} /></button>
        <button type="button" onClick={() => onNavigate('Thanh toán')}><span className="amber"><CreditCard size={21} /></span><div><strong>Kiểm tra thanh toán</strong><small>Theo dõi giao dịch và hóa đơn</small></div><ArrowRight size={17} /></button>
      </div>
    </section>
  </>
}

function BookingsView({ query }) {
  const [date, setDate] = useState(toDateKey(new Date()))
  const [status, setStatus] = useState('Tất cả')
  const normalizedQuery = query.trim().toLocaleLowerCase('vi')
  const bookings = useMemo(() => emptyBookings.filter(booking => booking.date === date && (status === 'Tất cả' || booking.status === status) && (!normalizedQuery || `${booking.code || ''} ${booking.memberName || ''} ${booking.phone || ''}`.toLocaleLowerCase('vi').includes(normalizedQuery))), [date, normalizedQuery, status])

  return <section className="reception-card reception-table-card">
    <div className="reception-table-tools"><label><CalendarDays size={16} /><input type="date" value={date} onChange={event => setDate(event.target.value)} /></label><div>{['Tất cả', 'Chờ check-in', 'Đang sử dụng', 'Đã hoàn thành', 'Đã hủy'].map(item => <button type="button" className={status === item ? 'active' : ''} onClick={() => setStatus(item)} key={item}>{item}</button>)}</div></div>
    <div className="reception-table-heading"><span>Mã đặt</span><span>Khách hàng</span><span>Khung giờ</span><span>Sân</span><span>Trạng thái</span></div>
    {bookings.length ? <div>{bookings.map(booking => <button type="button" className="reception-table-row" key={booking.id}><span>{booking.code}</span><span>{booking.memberName}</span><span>{booking.startTime} – {booking.endTime}</span><span>{booking.courtName}</span><span>{booking.status}</span></button>)}</div> : <EmptyState icon={CalendarDays} title="Chưa có lượt đặt sân" text="Các lượt đặt sẽ xuất hiện tại đây sau khi kết nối Booking API." />}
  </section>
}

function CheckInView({ showNotice }) {
  const [lookup, setLookup] = useState('')
  const submitLookup = event => {
    event.preventDefault()
    if (!lookup.trim()) return showNotice('Vui lòng nhập mã đặt sân, số điện thoại hoặc mã hội viên.')
    showNotice('Tra cứu check-in đang chờ kết nối API.')
  }

  return <div className="reception-checkin-layout">
    <section className="reception-card reception-checkin-search">
      <div className="reception-scan-visual"><span><ScanLine size={42} /></span><i /><strong>Quét mã QR tại quầy</strong><p>Đưa mã đặt sân vào vùng quét hoặc nhập thông tin bên dưới.</p></div>
      <form onSubmit={submitLookup}><label htmlFor="reception-checkin-code">Mã đặt sân / Số điện thoại / Mã hội viên</label><div><Search size={18} /><input id="reception-checkin-code" value={lookup} onChange={event => setLookup(event.target.value)} placeholder="Nhập thông tin tra cứu" /><button type="submit">Tra cứu</button></div></form>
    </section>
    <section className="reception-card reception-checkin-result"><div className="reception-card-head"><div><span>KẾT QUẢ XÁC MINH</span><h2>Thông tin lượt đặt</h2></div><ShieldCheck size={20} /></div><EmptyState icon={QrCode} title="Chưa có lượt đặt được chọn" text="Thông tin khách, sân và thời gian sẽ hiển thị sau khi tra cứu." /></section>
  </div>
}

function CreateMemberDialog({ onClose, onCreated }) {
  const [form, setForm] = useState(emptyMemberForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const updateField = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }))

  const submit = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const member = await createMember({
        ...form,
        phone: form.phone.trim() || null,
        dateOfBirth: form.dateOfBirth || null,
        gender: form.gender || null,
        address: form.address.trim() || null,
        fitnessGoal: form.fitnessGoal.trim() || null,
      })
      onCreated(member)
      onClose()
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'Không thể đăng ký hội viên tại quầy.'))
    } finally {
      setSaving(false)
    }
  }

  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="reception-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-create-member-title">
      <header><div><span>ĐĂNG KÝ TẠI QUẦY</span><h2 id="reception-create-member-title">Tạo tài khoản hội viên</h2><p>Thông tin đăng nhập sẽ được bàn giao trực tiếp cho hội viên.</p></div><button type="button" aria-label="Đóng biểu mẫu" onClick={onClose} disabled={saving}><X size={19} /></button></header>
      <form onSubmit={submit}>
        <div className="reception-member-form-grid">
          <label>Họ và tên<input name="fullName" value={form.fullName} onChange={updateField} maxLength="100" required /></label>
          <label>Email<input name="email" type="email" value={form.email} onChange={updateField} maxLength="256" required /></label>
          <label>Mật khẩu ban đầu<input name="password" type="password" value={form.password} onChange={updateField} minLength="6" autoComplete="new-password" required /></label>
          <label>Số điện thoại<input name="phone" type="tel" value={form.phone} onChange={updateField} /></label>
          <label>Ngày sinh<input name="dateOfBirth" type="date" value={form.dateOfBirth} max={new Date().toISOString().slice(0, 10)} onChange={updateField} /></label>
          <label>Giới tính<select name="gender" value={form.gender} onChange={updateField}><option value="">Chưa cung cấp</option><option value="Male">Nam</option><option value="Female">Nữ</option><option value="Other">Khác</option></select></label>
          <label className="wide">Địa chỉ<input name="address" value={form.address} onChange={updateField} maxLength="200" /></label>
          <label className="wide">Mục tiêu tập luyện<input name="fitnessGoal" value={form.fitnessGoal} onChange={updateField} maxLength="100" placeholder="Ví dụ: tăng sức bền, giảm cân..." /></label>
        </div>
        {error && <p className="reception-form-error" role="alert">{error}</p>}
        <footer><button type="button" onClick={onClose} disabled={saving}>Hủy</button><button type="submit" disabled={saving}>{saving ? 'Đang đăng ký...' : 'Đăng ký hội viên'}</button></footer>
      </form>
    </section>
  </div>
}

function MembersView({ query, showNotice }) {
  const [status, setStatus] = useState('Tất cả')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const normalizedQuery = query.trim().toLocaleLowerCase('vi')
  const members = useMemo(() => emptyMembers.filter(member => (status === 'Tất cả' || member.status === status) && (!normalizedQuery || `${member.name || ''} ${member.phone || ''} ${member.memberCode || ''}`.toLocaleLowerCase('vi').includes(normalizedQuery))), [normalizedQuery, status])

  return <>
    <section className="reception-member-metrics"><article><span><Users size={20} /></span><div><small>Tổng hội viên</small><strong>0</strong><p>Chờ dữ liệu API</p></div></article><article><span><BadgeCheck size={20} /></span><div><small>Đang hoạt động</small><strong>0</strong><p>Chờ dữ liệu API</p></div></article><article><span><Clock3 size={20} /></span><div><small>Sắp hết hạn</small><strong>0</strong><p>Chờ dữ liệu API</p></div></article></section>
    <section className="reception-card reception-table-card reception-members-card"><div className="reception-table-tools"><div><strong>Danh sách hội viên</strong><small>{members.length} kết quả</small></div><div>{['Tất cả', 'Đang hoạt động', 'Sắp hết hạn', 'Đã hết hạn'].map(item => <button type="button" className={status === item ? 'active' : ''} onClick={() => setStatus(item)} key={item}>{item}</button>)}<button className="reception-primary-button" type="button" onClick={() => setShowCreateDialog(true)}><Plus size={14} />Đăng ký hội viên</button></div></div><div className="reception-table-heading"><span>Mã hội viên</span><span>Họ và tên</span><span>Gói dịch vụ</span><span>Ngày hết hạn</span><span>Trạng thái</span></div>{members.length ? <div>{members.map(member => <button type="button" className="reception-table-row" key={member.id}><span>{member.memberCode}</span><span>{member.name}</span><span>{member.planName}</span><span>{member.expiryDate}</span><span>{member.status}</span></button>)}</div> : <EmptyState icon={Users} title="Chưa có dữ liệu hội viên" text="Danh sách sẽ được đồng bộ từ Member API." />}</section>
    {showCreateDialog && <CreateMemberDialog onClose={() => setShowCreateDialog(false)} onCreated={member => showNotice(`Đã đăng ký ${member.fullName} với mã hội viên #${member.memberId}.`)} />}
  </>
}

function PaymentsView({ query }) {
  const [status, setStatus] = useState('Tất cả')
  const normalizedQuery = query.trim().toLocaleLowerCase('vi')
  const payments = useMemo(() => emptyPayments.filter(payment => (status === 'Tất cả' || payment.status === status) && (!normalizedQuery || `${payment.code || ''} ${payment.customerName || ''}`.toLocaleLowerCase('vi').includes(normalizedQuery))), [normalizedQuery, status])

  return <>
    <section className="reception-payment-metrics"><article><span className="green"><WalletCards size={21} /></span><div><small>Đã thu hôm nay</small><strong>--</strong><p>Chờ dữ liệu API</p></div></article><article><span className="amber"><Clock3 size={21} /></span><div><small>Chờ thanh toán</small><strong>--</strong><p>Chờ dữ liệu API</p></div></article><article><span className="blue"><ReceiptText size={21} /></span><div><small>Hóa đơn đã tạo</small><strong>--</strong><p>Chờ dữ liệu API</p></div></article></section>
    <section className="reception-card reception-table-card"><div className="reception-table-tools"><div><strong>Giao dịch tại quầy</strong><small>{payments.length} kết quả</small></div><div>{['Tất cả', 'Thành công', 'Chờ thanh toán', 'Hoàn tiền'].map(item => <button type="button" className={status === item ? 'active' : ''} onClick={() => setStatus(item)} key={item}>{item}</button>)}</div></div><div className="reception-table-heading"><span>Mã giao dịch</span><span>Khách hàng</span><span>Nội dung</span><span>Số tiền</span><span>Trạng thái</span></div>{payments.length ? <div>{payments.map(payment => <button type="button" className="reception-table-row" key={payment.id}><span>{payment.code}</span><span>{payment.customerName}</span><span>{payment.description}</span><span>{payment.amount}</span><span>{payment.status}</span></button>)}</div> : <EmptyState icon={ReceiptText} title="Chưa có giao dịch" text="Giao dịch và hóa đơn sẽ xuất hiện sau khi kết nối Payment API." />}</section>
  </>
}

export default function Receptionist() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [activeNav, setActiveNav] = useState('Tổng quan')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const staffName = user?.name || user?.fullName || 'Nhân viên lễ tân'
  const initials = staffName.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase() || 'LT'
  const today = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())

  const showNotice = text => {
    setNotice(text)
    window.setTimeout(() => setNotice(''), 2600)
  }

  const selectNavigation = label => {
    setActiveNav(label)
    setQuery('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const renderView = () => {
    if (activeNav === 'Lịch đặt sân') return <BookingsView query={query} />
    if (activeNav === 'Check-in') return <CheckInView showNotice={showNotice} />
    if (activeNav === 'Hội viên') return <MembersView query={query} showNotice={showNotice} />
    if (activeNav === 'Thanh toán') return <PaymentsView query={query} />
    return <Overview onNavigate={selectNavigation} />
  }

  const meta = pageMeta[activeNav]

  return <main className="reception-dashboard">
    <aside className="reception-sidebar">
      <Link to="/" className="reception-brand"><span><Trophy size={23} /></span><div><strong>SportPulse <em>Olympus</em></strong><small>RECEPTION PORTAL</small></div></Link>
      <nav className="reception-nav" aria-label="Điều hướng lễ tân"><p>VẬN HÀNH QUẦY LỄ TÂN</p>{navigation.map(([Icon, label]) => <button type="button" key={label} className={activeNav === label ? 'active' : ''} aria-pressed={activeNav === label} onClick={() => selectNavigation(label)}><Icon size={19} /><span>{label}</span></button>)}</nav>
      <div className="reception-source"><span><ShieldCheck size={20} /></span><p>Nguồn dữ liệu</p><strong>Reception API</strong><small>Chờ kết nối dữ liệu</small></div>
      <div className="reception-user"><span className="reception-avatar">{initials}</span><div><strong>{staffName}</strong><small>Nhân viên lễ tân</small></div><button type="button" onClick={handleLogout} aria-label="Đăng xuất"><LogOut size={18} /></button></div>
    </aside>

    <section className="reception-workspace">
      <header className="reception-topbar"><label><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm mã đặt sân, hội viên..." aria-label="Tìm kiếm" /></label><div><ThemeToggle /><button type="button" aria-label="Thông báo" onClick={() => showNotice('Chưa có dữ liệu thông báo từ API.')}><Bell size={20} /></button><span className="reception-avatar">{initials}</span><span><strong>{staffName}</strong><small>Nhân viên lễ tân</small></span></div></header>
      <div className="reception-main">
        {activeNav === 'Tổng quan' ? <section className="reception-welcome"><div><p>{today}</p><h1>Chào bạn, {staffName}!</h1><span>Dữ liệu vận hành quầy sẽ hiển thị khi các API được kết nối.</span></div><BadgeCheck size={42} /></section> : <section className="reception-page-heading"><p>{meta[0]}</p><h1>{meta[1]}</h1><span>{meta[2]}</span></section>}
        {notice && <div className="reception-toast" role="status"><CheckCircle2 size={18} />{notice}</div>}
        <div className="reception-view" key={activeNav}>{renderView()}</div>
      </div>
    </section>
  </main>
}
