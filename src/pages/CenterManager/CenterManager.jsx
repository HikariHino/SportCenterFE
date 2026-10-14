import ThemeToggle from '../../components/ThemeToggle'
﻿import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowDownToLine, ArrowUpRight, Ban, BookOpen, CalendarDays, Check,
  ChevronRight, ClipboardList, Clock3, CreditCard, DoorOpen, Headset,
  LayoutDashboard, LogOut, MapPin, Menu, Package, Search, ShieldCheck,
  TrendingUp, Trophy, Users, Volleyball, X,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import StaffManagement from './StaffManagement'
import ClassManagement from './ClassManagement'
import RoomManagement from './RoomManagement'
import PackageManagement from './PackageManagement'
import '../../style/CenterManager/CenterManager.css'

const managerNavSections = [
  {
    title: 'QUẢN LÝ TRUNG TÂM',
    items: [
      { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
      { id: 'users', label: 'Nhân sự & Phân quyền', icon: Users },
      { id: 'classes', label: 'Danh mục & Lớp học', icon: BookOpen },
      { id: 'rooms', label: 'Phòng tập / Cơ sở vật chất', icon: DoorOpen },
      { id: 'packages', label: 'Gói thẻ hội viên', icon: Package },
      { id: 'cancellation', label: 'Chính sách hủy lịch', icon: Ban },
      { id: 'reports', label: 'Báo cáo & Doanh thu', icon: TrendingUp },
    ],
  },
  {
    title: 'VẬN HÀNH DỊCH VỤ',
    items: [
      { id: 'frontdesk', label: 'Quầy lễ tân (FrontDesk)', icon: Headset },
    ],
  },
]

// Flat list for lookup
const navigation = managerNavSections.flatMap(section => section.items)
const bookings = [
  { id: 'BK-1028', name: 'Nguyễn Minh Anh', initials: 'MA', court: 'Pickleball P01', time: '17:00 – 18:30', amount: 300000, status: 'confirmed' },
  { id: 'BK-1027', name: 'Trần Hoàng Nam', initials: 'HN', court: 'Cầu lông B02', time: '16:00 – 17:00', amount: 120000, status: 'pending' },
  { id: 'BK-1026', name: 'CLB Smash Together', initials: 'ST', court: 'Pickleball P03', time: '14:00 – 16:00', amount: 400000, status: 'playing' },
  { id: 'BK-1025', name: 'Lê Thu Hà', initials: 'TH', court: 'Tennis T01', time: '14:00 – 15:30', amount: 450000, status: 'playing' },
  { id: 'BK-1024', name: 'Phạm Quang Huy', initials: 'QH', court: 'Cầu lông B01', time: '09:00 – 10:00', amount: 120000, status: 'completed' },
  { id: 'BK-1023', name: 'Đỗ Ngọc Linh', initials: 'NL', court: 'Pickleball P02', time: '08:00 – 09:00', amount: 200000, status: 'cancelled' },
]
const statuses = {
  confirmed: { label: 'Đã xác nhận', tone: 'blue' }, pending: { label: 'Chờ xác nhận', tone: 'amber' },
  playing: { label: 'Đang diễn ra', tone: 'green' }, completed: { label: 'Hoàn thành', tone: 'neutral' }, cancelled: { label: 'Đã hủy', tone: 'red' },
}
const courts = [
  { name: 'P01', sport: 'Pickleball', status: 'available' }, { name: 'P02', sport: 'Pickleball', status: 'available' },
  { name: 'P03', sport: 'Pickleball', status: 'busy' }, { name: 'P04', sport: 'Pickleball', status: 'busy' },
  { name: 'B01', sport: 'Cầu lông', status: 'available' }, { name: 'B02', sport: 'Cầu lông', status: 'available' },
  { name: 'B03', sport: 'Cầu lông', status: 'busy' }, { name: 'B04', sport: 'Cầu lông', status: 'maintenance' },
  { name: 'T01', sport: 'Tennis', status: 'busy' }, { name: 'T02', sport: 'Tennis', status: 'busy' },
  { name: 'F01', sport: 'Bóng đá', status: 'busy' }, { name: 'F02', sport: 'Bóng đá', status: 'available' },
]
const courtStatuses = { available: 'Sẵn sàng', busy: 'Đang sử dụng', maintenance: 'Bảo trì' }
const revenue = [
  { day: '24/09', amount: 4200000 }, { day: '25/09', amount: 5800000 }, { day: '26/09', amount: 7100000 },
  { day: '27/09', amount: 8400000 }, { day: '28/09', amount: 4900000 }, { day: '29/09', amount: 5600000 }, { day: '30/09', amount: 6800000 },
]
const staff = [
  { name: 'Nguyễn Hoàng Nam', initials: 'HN', role: 'Huấn luyện viên', shift: '08:00 – 17:00', tone: 'blue' },
  { name: 'Trần Thảo Vy', initials: 'TV', role: 'Lễ tân', shift: '14:00 – 22:00', tone: 'purple' },
  { name: 'Lê Đức Minh', initials: 'DM', role: 'Kỹ thuật viên', shift: '08:00 – 17:00', tone: 'amber' },
]
const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
const normalize = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')

function Status({ status }) {
  return <span className={`manager-badge ${statuses[status].tone}`}><i />{statuses[status].label}</span>
}

export default function CenterManager() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [section, setSection] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [period, setPeriod] = useState('week')
  const [selectedBooking, setSelectedBooking] = useState(null)
  const detailDialog = useRef(null)
  const managerName = user?.fullName || user?.name || 'Quản lý trung tâm'
  const initials = managerName.split(/\s+/).slice(-2).map(part => part[0]).join('').toUpperCase()
  const filteredBookings = bookings.filter(booking => (status === 'all' || booking.status === status) && normalize(`${booking.name} ${booking.id} ${booking.court}`).includes(normalize(query.trim())))
  const chartData = period === 'week' ? revenue : revenue.slice(-3)
  const totalRevenue = chartData.reduce((sum, day) => sum + day.amount, 0)
  const busyCourts = courts.filter(court => court.status === 'busy').length
  const show = id => section === 'overview' || section === id
  const pageTitle = navigation.find(item => item.id === section)?.label || 'Tổng quan'
  const exportActions = {
    overview: { label: 'Xuất báo cáo tổng quan', onClick: exportOverview },
    bookings: { label: 'Xuất lịch đặt sân', onClick: exportBookings },
    courts: { label: 'Xuất danh sách sân', onClick: exportCourts },
    users: { label: 'Xuất danh sách nhân sự', onClick: exportStaff },
    classes: { label: 'Xuất danh mục lớp học', onClick: exportOverview },
    rooms: { label: 'Xuất danh sách phòng tập', onClick: exportOverview },
    packages: { label: 'Xuất gói thẻ hội viên', onClick: exportOverview },
    cancellation: { label: 'Xuất chính sách hủy', onClick: exportOverview },
    reports: { label: 'Xuất báo cáo doanh thu', onClick: exportRevenue },
    frontdesk: { label: 'Xuất dữ liệu lễ tân', onClick: exportOverview },
  }
  const exportAction = exportActions[section] || exportActions.overview

  function selectSection(id) {
    setSection(id)
    setSidebarOpen(false)
  }

  function exportBookings() {
    const rows = [
      ['Mã đặt sân', 'Khách hàng', 'Sân', 'Ngày', 'Khung giờ', 'Số tiền (VND)', 'Trạng thái'],
      ...filteredBookings.map(booking => [booking.id, booking.name, booking.court, '30/09/2026', booking.time, booking.amount, statuses[booking.status].label]),
    ]
    const csv = '\uFEFF' + rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'lich-dat-san-minh-hoa-30-09-2026.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // Keep the current CSV export until each section gets its own export logic.
  function exportOverview() {
    exportBookings()
  }

  function exportCourts() {
    exportBookings()
  }

  function exportStaff() {
    exportBookings()
  }

  function exportRevenue() {
    exportBookings()
  }

  function openBooking(booking) {
    setSelectedBooking(booking)
    detailDialog.current.showModal()
  }

  return (
    <div className="manager-dashboard">
      <aside className={`manager-sidebar ${sidebarOpen ? 'is-open' : ''}`} id="manager-sidebar">
        <Link to="/" className="manager-brand"><span><Trophy size={24} /></span><div><strong>SportPulse<span>.</span></strong><small>TRUNG TÂM OLYMPUS</small></div></Link>
        <div className="manager-portal"><ShieldCheck size={15} /> Không gian quản lý</div>
        <nav className="manager-nav" aria-label="Điều hướng quản lý">
          {managerNavSections.map(group => <div key={group.title} className="manager-nav-group">
            <p>{group.title}</p>
            {group.items.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={section === id ? 'active' : ''} aria-current={section === id ? 'page' : undefined} onClick={() => selectSection(id)}><Icon size={19} /><span>{label}</span>{section === id && <ChevronRight size={15} />}</button>)}
          </div>)}
        </nav>
        <div className="manager-sidebar-bottom">
          <div className="manager-center"><span className="manager-center-icon"><MapPin size={20} /></span><small>TRUNG TÂM CỦA BẠN</small><strong>Olympus · Cầu Giấy</strong><p><i /> Mở cửa 06:00 – 22:00</p></div>
          <Link className="manager-home" to="/">Về trang chủ <ArrowUpRight size={16} /></Link>
          <div className="manager-account"><span className="manager-avatar">{initials}</span><div><strong>{managerName}</strong><small>Quản lý trung tâm</small></div><button type="button" aria-label="Đăng xuất" onClick={async () => { await logout(); navigate('/login', { replace: true }) }}><LogOut size={18} /></button></div>
        </div>
      </aside>
      <div className="manager-workspace">
        <header className="manager-topbar">
          <div><button type="button" className="manager-menu" aria-label={sidebarOpen ? 'Đóng menu' : 'Mở menu'} aria-expanded={sidebarOpen} aria-controls="manager-sidebar" onClick={() => setSidebarOpen(!sidebarOpen)}>{sidebarOpen ? <X size={21} /> : <Menu size={21} />}</button><span className="manager-breadcrumb">Không gian quản lý <ChevronRight size={14} /> <strong>{pageTitle}</strong></span></div>
          <div className="manager-topbar-right"><ThemeToggle /><span className="manager-demo"><i /> Dữ liệu minh họa</span><span className="manager-avatar">{initials}</span></div>
        </header>
        <main className="manager-main" id="manager-content">
          <section className="manager-welcome">
            <div><p className="manager-eyebrow">VẬN HÀNH HIỆU QUẢ, KẾT NỐI ĐAM MÊ</p><h1>{section === 'overview' ? 'Tổng quan trung tâm' : pageTitle}</h1><p>Xin chào, {managerName}. Cùng theo dõi hoạt động tại Olympus.</p></div>
            <button className="manager-button" type="button" onClick={exportAction.onClick}><ArrowDownToLine size={17} /> {exportAction.label}</button>
          </section>
          <div className="manager-context"><span><CalendarDays size={16} /> Thứ Tư, 30 tháng 09, 2026</span><small>Bản xem trước · Chưa kết nối dữ liệu vận hành</small></div>
          {section === 'overview' && <section className="manager-metrics" aria-label="Chỉ số hoạt động minh họa">
            {[
              { icon: CreditCard, label: 'Doanh thu trong ngày', value: '6.800.000', suffix: '₫', note: 'Tổng doanh thu ngày 30/09', tone: 'blue' },
              { icon: CalendarDays, label: 'Lượt đặt sân', value: String(bookings.length).padStart(2, '0'), note: `${bookings.filter(item => item.status === 'pending').length} lịch đang chờ xác nhận`, tone: 'purple' },
              { icon: Volleyball, label: 'Sân đang sử dụng', value: String(busyCourts).padStart(2, '0'), suffix: `/ ${courts.length}`, note: `${courts.filter(court => court.status === 'available').length} sân sẵn sàng đón khách`, tone: 'green' },
              { icon: Users, label: 'Nhân sự trong ca', value: String(staff.length).padStart(2, '0'), note: 'Huấn luyện · Lễ tân · Kỹ thuật', tone: 'amber' },
            ].map(({ icon: Icon, label, value, suffix, note, tone }) => <article key={label} className="manager-metric"><div><span>{label}</span><span className={`manager-icon ${tone}`}><Icon size={20} /></span></div><strong>{value} <small>{suffix}</small></strong><p>{note}</p></article>)}
          </section>}

          {/* 1. Nhân sự & Phân quyền (UsersController) */}
          {section === 'users' && <StaffManagement />}

          {/* 2. Danh mục & Lớp học (SportClassesController, ClassCatalogController) */}
          {section === 'classes' && <ClassManagement />}

          {/* 3. Phòng tập / Cơ sở vật chất (RoomsController) */}
          {section === 'rooms' && <RoomManagement />}

          {/* 4. Gói thẻ hội viên (MembershipPackagesController) */}
          {section === 'packages' && <PackageManagement />}

          {/* 5. Chính sách hủy lịch (CancellationPoliciesController) */}
          {section === 'cancellation' && <section className="manager-card manager-section-placeholder">
            <div className="manager-card-heading"><div><h2>Quản lý chính sách hủy lịch</h2><p>Thiết lập chính sách hủy đặt lịch, phí phạt và điều kiện hoàn tiền.</p></div><span className="manager-icon red"><Ban size={21} /></span></div>
            <div className="manager-placeholder-body">
              <div className="manager-placeholder-features">
                <article><span className="red"><Ban size={20} /></span><div><strong>Danh sách chính sách</strong><small>Chính sách hủy theo loại dịch vụ</small></div></article>
                <article><span className="amber"><Clock3 size={20} /></span><div><strong>Thời hạn hủy</strong><small>Số giờ trước buổi học được phép hủy</small></div></article>
                <article><span className="blue"><CreditCard size={20} /></span><div><strong>Phí hủy & Hoàn tiền</strong><small>Tỷ lệ phí phạt và chính sách hoàn</small></div></article>
              </div>
              <div className="manager-placeholder-note"><ShieldCheck size={18} /><span>Chờ kết nối <strong>CancellationPoliciesController API</strong>.</span></div>
            </div>
          </section>}

          {/* 6. Báo cáo thống kê & Doanh thu (ReportsController) */}
          {section === 'reports' && <>
            <section className="manager-card manager-revenue">
              <div className="manager-card-heading"><div><h2>Doanh thu trung tâm</h2><p>Theo dõi dòng tiền từ hoạt động thể thao</p></div><select aria-label="Khoảng thời gian doanh thu" value={period} onChange={event => setPeriod(event.target.value)}><option value="week">7 ngày gần nhất</option><option value="three">3 ngày gần nhất</option></select></div>
              <div className="manager-revenue-total"><strong>{money(totalRevenue)}</strong><span>Tổng trong {chartData.length} ngày</span></div>
              <div className="manager-chart" role="img" aria-label={`Doanh thu minh họa: ${chartData.map(day => `${day.day}: ${money(day.amount)}`).join('; ')}`}>
                <div className="manager-chart-axis"><span>10 tr</span><span>5 tr</span><span>0</span></div>
                <div className="manager-chart-bars">{chartData.map((day, index) => <div className="manager-chart-column" key={day.day}><span className="manager-bar-value">{(day.amount / 1000000).toLocaleString('vi-VN')}</span><div className={`manager-bar ${index === chartData.length - 1 ? 'latest' : ''}`} style={{ height: `${day.amount / 100000}%` }} /><small>{day.day}</small></div>)}</div>
              </div>
              <div className="manager-chart-foot"><span><i /> Doanh thu (triệu đồng)</span><small>Đơn vị: VND</small></div>
            </section>
            <section className="manager-card manager-section-placeholder" style={{ marginTop: 22 }}>
              <div className="manager-card-heading"><div><h2>Thống kê nâng cao</h2><p>Báo cáo chi tiết theo dịch vụ, hội viên và nhân sự.</p></div><span className="manager-icon blue"><TrendingUp size={21} /></span></div>
              <div className="manager-placeholder-body">
                <div className="manager-placeholder-note"><ShieldCheck size={18} /><span>Chờ kết nối <strong>ReportsController API</strong> để hiển thị báo cáo thống kê đầy đủ.</span></div>
              </div>
            </section>
          </>}

          {/* 7. Vận hành dịch vụ khách hàng - FrontDesk */}
          {section === 'frontdesk' && <section className="manager-card manager-section-placeholder">
            <div className="manager-card-heading"><div><h2>Vận hành dịch vụ khách hàng</h2><p>Thừa hưởng quyền FrontDesk/Receptionist — quản lý check-in, đặt sân và hỗ trợ hội viên.</p></div><span className="manager-icon purple"><Headset size={21} /></span></div>
            <div className="manager-placeholder-body">
              <div className="manager-placeholder-features">
                <article><span className="green"><Check size={20} /></span><div><strong>Check-in hội viên</strong><small>Xác minh tài khoản và đặt chỗ</small></div></article>
                <article><span className="blue"><CalendarDays size={20} /></span><div><strong>Quản lý buổi học</strong><small>Đăng ký, điểm danh và hoàn thành buổi</small></div></article>
                <article><span className="amber"><CreditCard size={20} /></span><div><strong>Thanh toán tại quầy</strong><small>Đăng ký gói thẻ và xử lý hóa đơn</small></div></article>
                <article><span className="purple"><Users size={20} /></span><div><strong>Tra cứu hội viên</strong><small>Xem thông tin, gói đăng ký và lịch sử</small></div></article>
              </div>
              <div className="manager-placeholder-note"><Headset size={18} /><span>Trang này kế thừa toàn bộ quyền <strong>Receptionist/FrontDesk</strong>. Truy cập <strong>/receptionist</strong> để sử dụng giao diện lễ tân đầy đủ.</span></div>
            </div>
          </section>}

          {/* Overview: show revenue + courts + bookings + staff */}
          {section === 'overview' && <div className="manager-analytics">
            <section className="manager-card manager-revenue">
              <div className="manager-card-heading"><div><h2>Doanh thu trung tâm</h2><p>Theo dõi dòng tiền từ hoạt động thể thao</p></div><select aria-label="Khoảng thời gian doanh thu" value={period} onChange={event => setPeriod(event.target.value)}><option value="week">7 ngày gần nhất</option><option value="three">3 ngày gần nhất</option></select></div>
              <div className="manager-revenue-total"><strong>{money(totalRevenue)}</strong><span>Tổng trong {chartData.length} ngày</span></div>
              <div className="manager-chart" role="img" aria-label={`Doanh thu minh họa: ${chartData.map(day => `${day.day}: ${money(day.amount)}`).join('; ')}`}>
                <div className="manager-chart-axis"><span>10 tr</span><span>5 tr</span><span>0</span></div>
                <div className="manager-chart-bars">{chartData.map((day, index) => <div className="manager-chart-column" key={day.day}><span className="manager-bar-value">{(day.amount / 1000000).toLocaleString('vi-VN')}</span><div className={`manager-bar ${index === chartData.length - 1 ? 'latest' : ''}`} style={{ height: `${day.amount / 100000}%` }} /><small>{day.day}</small></div>)}</div>
              </div>
              <div className="manager-chart-foot"><span><i /> Doanh thu (triệu đồng)</span><small>Đơn vị: VND</small></div>
            </section>
            <section className="manager-card manager-courts">
              <div className="manager-card-heading"><div><h2>Tình trạng sân</h2><p>{courts.length} sân · 4 bộ môn</p></div><span className="manager-icon green"><Volleyball size={21} /></span></div>
              <div className="manager-court-legend">{Object.entries(courtStatuses).map(([key, label]) => <span key={key}><i className={key} />{label}</span>)}</div>
              <div className="manager-court-grid">{courts.map(court => <div key={court.name} className={`manager-court ${court.status}`} title={`${court.sport} ${court.name}: ${courtStatuses[court.status]}`}><Volleyball size={19} /><strong>{court.name}</strong><small>{court.sport}</small><span className="manager-sr-only">{courtStatuses[court.status]}</span></div>)}</div>
              <div className="manager-court-note"><Clock3 size={16} /><span>Sân B04 đang bảo trì mặt sân.</span></div>
            </section>
          </div>}
          {section === 'overview' && <section className="manager-card manager-bookings">
            <div className="manager-card-heading"><div><h2>Lịch đặt sân <span className="manager-count">{bookings.length}</span></h2><p>Danh sách lịch đặt ngày 30/09/2026</p></div></div>
            <div className="manager-table-tools"><label className="manager-search"><Search size={17} /><input type="search" aria-label="Tìm lịch đặt sân" placeholder="Tìm khách hàng, mã đặt hoặc tên sân..." value={query} onChange={event => setQuery(event.target.value)} /></label><select value={status} aria-label="Lọc trạng thái lịch đặt" onChange={event => setStatus(event.target.value)}><option value="all">Tất cả trạng thái</option>{Object.entries(statuses).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></div>
            <div className="manager-table-scroll"><table><thead><tr><th scope="col">KHÁCH HÀNG</th><th scope="col">SÂN ĐẶT</th><th scope="col">KHUNG GIỜ</th><th scope="col">THÀNH TIỀN</th><th scope="col">TRẠNG THÁI</th><th scope="col"><span className="manager-sr-only">Chi tiết</span></th></tr></thead><tbody>{filteredBookings.map(booking => <tr key={booking.id}><td><div className="manager-customer"><span className="manager-avatar">{booking.initials}</span><div><strong>{booking.name}</strong><small>#{booking.id}</small></div></div></td><td>{booking.court}</td><td><span className="manager-time"><Clock3 size={14} />{booking.time}</span></td><td className="manager-amount">{money(booking.amount)}</td><td><Status status={booking.status} /></td><td><button className="manager-detail-button" type="button" aria-label={`Xem chi tiết ${booking.id}`} onClick={() => openBooking(booking)}><ChevronRight size={18} /></button></td></tr>)}</tbody></table>{filteredBookings.length === 0 && <div className="manager-empty"><Search size={26} /><strong>Không tìm thấy lịch đặt phù hợp</strong><p>Thử tên khách hàng, tên sân hoặc trạng thái khác.</p><button className="manager-text-button" type="button" onClick={() => { setQuery(''); setStatus('all') }}>Xóa bộ lọc</button></div>}</div>
            <div className="manager-table-footer" role="status">Hiển thị {filteredBookings.length} / {bookings.length} lịch đặt <span>Dữ liệu minh họa</span></div>
          </section>}
          {section === 'overview' && <section className="manager-card manager-staff"><div className="manager-card-heading"><div><h2>Đội ngũ trong ca</h2><p>Nhân sự phụ trách hoạt động tại trung tâm</p></div><span className="manager-badge green"><Check size={13} /> {staff.length} nhân sự</span></div><div className="manager-staff-grid">{staff.map(person => <article key={person.name}><span className={`manager-avatar ${person.tone}`}>{person.initials}</span><div><strong>{person.name}</strong><p>{person.role}</p><small><Clock3 size={13} />{person.shift}</small></div></article>)}</div></section>}
          <footer className="manager-footer"><span>© 2026 SportPulse · Olympus</span><span>Không gian quản lý trung tâm thể thao</span></footer>
        </main>
      </div>
      <dialog className="manager-dialog" ref={detailDialog} aria-label="Chi tiết lịch đặt" onClose={() => setSelectedBooking(null)}>
        {selectedBooking && <><div className="manager-card-heading"><div><p>THÔNG TIN LỊCH ĐẶT</p><h2>#{selectedBooking.id}</h2></div><button className="manager-detail-button" type="button" aria-label="Đóng chi tiết" onClick={() => detailDialog.current.close()}><X size={20} /></button></div><Status status={selectedBooking.status} /><dl>{[['Khách hàng', selectedBooking.name], ['Sân', selectedBooking.court], ['Ngày', '30/09/2026'], ['Khung giờ', selectedBooking.time], ['Thành tiền', money(selectedBooking.amount)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="manager-dialog-note">Lịch đặt minh họa, chưa kết nối với hệ thống đặt sân.</p><button className="manager-button" type="button" onClick={() => detailDialog.current.close()}>Đóng chi tiết</button></>}
      </dialog>
    </div>
  )
}
