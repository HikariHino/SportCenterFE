import ThemeToggle from '../../components/ThemeToggle'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowDownToLine, ArrowUpRight, Ban, BookOpen, CalendarDays, Check,
  ChevronRight, Clock3, CreditCard, DoorOpen, Headset,
  LayoutDashboard, LogOut, MapPin, Menu, Package, Phone, RefreshCw,
  Search, ShieldCheck, TrendingUp, Trophy, Users, X,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import StaffManagement from './StaffManagement'
import ClassManagement from './ClassManagement'
import RoomManagement from './RoomManagement'
import PackageManagement from './PackageManagement'
import CancellationPolicyManagement from './CancellationPolicyManagement'
import ReportManagement from './ReportManagement'
import FrontDeskOperations from './FrontDeskOperations'
import SessionCompletionSync from './SessionCompletionSync'
import {
  getDashboardOverview,
  getRevenueByYear,
  getPaymentsReport,
  exportInvoicePdf,
  triggerBlobDownload,
} from '../../services/reportService'
import { getRooms } from '../../services/roomService'
import { getStaffUsers } from '../../services/userService'
import { getTodayCheckIns } from '../../services/gymCheckInService'
import '../../style/CenterManager/CenterManager.css'
import '../../style/CenterManager/ManagerOverview.css'

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

const navigation = managerNavSections.flatMap(section => section.items)

const money = value =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value) || 0)

function getInitials(name) {
  if (!name) return 'QL'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function getRoleBadge(role) {
  switch (role) {
    case 'Coach':
      return { label: 'Huấn luyện viên', tone: 'blue' }
    case 'Receptionist':
      return { label: 'Lễ tân (FrontDesk)', tone: 'purple' }
    case 'Manager':
      return { label: 'Quản lý trung tâm', tone: 'amber' }
    default:
      return { label: role || 'Nhân viên', tone: 'neutral' }
  }
}

function renderPaymentStatusBadge(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'completed' || s === 'success') {
    return <span className="manager-badge green"><i />Đã thanh toán</span>
  }
  if (s === 'pending') {
    return <span className="manager-badge amber"><i />Chờ thanh toán</span>
  }
  if (s === 'cancelled' || s === 'failed') {
    return <span className="manager-badge red"><i />Đã hủy</span>
  }
  if (s === 'reviewing') {
    return <span className="manager-badge blue"><i />Đang duyệt</span>
  }
  return <span className="manager-badge neutral"><i />{status || 'Khác'}</span>
}

export default function CenterManager() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [section, setSection] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Live Dashboard States
  const [loadingOverview, setLoadingOverview] = useState(true)
  const [overviewData, setOverviewData] = useState({
    totalActiveMembers: 0,
    totalActiveClasses: 0,
    totalRevenue: 0,
    currentMonthRevenue: 0,
  })
  const [revenueMonthly, setRevenueMonthly] = useState([])
  const [roomsList, setRoomsList] = useState([])
  const [staffList, setStaffList] = useState([])
  const [paymentsList, setPaymentsList] = useState([])
  const [todayCheckIns, setTodayCheckIns] = useState([])

  // Dashboard Filters & Controls
  const [revenueYear] = useState(new Date().getFullYear())
  const [period, setPeriod] = useState('year')
  const [paymentQuery, setPaymentQuery] = useState('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all')
  const [selectedPayment, setSelectedPayment] = useState(null)
  const detailDialog = useRef(null)

  const managerName = user?.fullName || user?.name || 'Quản lý trung tâm'
  const initials = getInitials(managerName)
  const pageTitle = navigation.find(item => item.id === section)?.label || 'Tổng quan'

  // Fetch all live overview data
  const loadOverviewData = async () => {
    setLoadingOverview(true)
    try {
      const [overview, revData, rooms, staff, payments, checkins] = await Promise.all([
        getDashboardOverview().catch(err => {
          console.warn('Dashboard overview error:', err)
          return { totalActiveMembers: 0, totalActiveClasses: 0, totalRevenue: 0, currentMonthRevenue: 0 }
        }),
        getRevenueByYear(revenueYear).catch(err => {
          console.warn('Revenue error:', err)
          return []
        }),
        getRooms().catch(err => {
          console.warn('Rooms error:', err)
          return []
        }),
        getStaffUsers().catch(err => {
          console.warn('Staff error:', err)
          return []
        }),
        getPaymentsReport().catch(err => {
          console.warn('Payments error:', err)
          return []
        }),
        getTodayCheckIns().catch(err => {
          console.warn('Check-ins error:', err)
          return []
        }),
      ])

      setOverviewData(overview || {})
      setRevenueMonthly(Array.isArray(revData) ? revData : [])
      setRoomsList(Array.isArray(rooms) ? rooms : [])
      setStaffList(Array.isArray(staff) ? staff : [])
      setPaymentsList(Array.isArray(payments) ? payments : [])
      setTodayCheckIns(Array.isArray(checkins) ? checkins : [])
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu tổng quan:', err)
    } finally {
      setLoadingOverview(false)
    }
  }

  useEffect(() => {
    if (section === 'overview') {
      loadOverviewData()
    }
  }, [section, revenueYear])

  // Filtered payments list
  const filteredPayments = paymentsList.filter(payment => {
    const matchStatus = paymentStatusFilter === 'all' ||
      String(payment.status || '').toLowerCase() === paymentStatusFilter.toLowerCase()
    const searchStr = `${payment.id} ${payment.transactionReference || ''} ${payment.memberId} ${payment.paymentMethod || ''}`.toLowerCase()
    const matchQuery = !paymentQuery.trim() || searchStr.includes(paymentQuery.trim().toLowerCase())
    return matchStatus && matchQuery
  })

  // Format revenue chart data
  const currentMonthNumber = new Date().getMonth() + 1
  let chartData = revenueMonthly && revenueMonthly.length > 0
    ? revenueMonthly
    : Array.from({ length: 12 }, (_, i) => ({ month: i + 1, year: revenueYear, revenue: 0 }))

  if (period === '6months') {
    chartData = chartData.slice(-6)
  } else if (period === '3months') {
    chartData = chartData.slice(-3)
  }

  const totalRevenueChart = chartData.reduce((sum, item) => sum + (Number(item.revenue) || 0), 0)
  const maxRevenueValue = Math.max(...chartData.map(item => Number(item.revenue) || 0), 1)

  const todayFormatted = (() => {
    const dateStr = new Date().toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
    return dateStr.charAt(0).toUpperCase() + dateStr.slice(1)
  })()

  function selectSection(id) {
    setSection(id)
    setSidebarOpen(false)
  }

  function openPaymentDetail(payment) {
    setSelectedPayment(payment)
    detailDialog.current?.showModal()
  }

  function exportOverview() {
    const rows = [
      ['--- BÁO CÁO TỔNG QUAN VẬN HÀNH TRUNG TÂM ---'],
      ['Thời gian xuất', new Date().toLocaleString('vi-VN')],
      ['Tổng hội viên hoạt động', overviewData?.totalActiveMembers ?? 0],
      ['Tổng lớp học đang mở', overviewData?.totalActiveClasses ?? 0],
      ['Doanh thu tháng này (VND)', overviewData?.currentMonthRevenue ?? 0],
      ['Tổng doanh thu lũy kế (VND)', overviewData?.totalRevenue ?? 0],
      ['Tổng số phòng tập', roomsList.length],
      ['Phòng đang hoạt động', roomsList.filter(r => r.isActive).length],
      ['Tổng nhân sự', staffList.length],
      [],
      ['--- GIAO DỊCH GẦN ĐÂY ---'],
      ['Mã GD', 'Hội viên ID', 'Gói thẻ ID', 'Số tiền (VND)', 'Phương thức', 'Trạng thái', 'Ngày thanh toán / tạo'],
      ...paymentsList.map(p => [
        p.id,
        p.memberId,
        p.subscriptionId || 'N/A',
        p.amountReceived > 0 ? p.amountReceived : p.amount,
        p.paymentMethod || 'PayOS',
        p.status,
        p.paidAt ? new Date(p.paidAt).toLocaleDateString('vi-VN') : (p.createdAt ? new Date(p.createdAt).toLocaleDateString('vi-VN') : 'N/A'),
      ]),
      [],
      ['--- DANH SÁCH PHÒNG TẬP ---'],
      ['Mã phòng', 'Tên phòng', 'Loại phòng', 'Sức chứa', 'Vị trí', 'Trạng thái'],
      ...roomsList.map(r => [
        r.id,
        r.name,
        r.roomType || 'Phòng tập',
        r.capacity,
        r.location || 'N/A',
        r.isActive ? 'Sẵn sàng' : 'Bảo trì',
      ]),
    ]
    const csv = '\uFEFF' + rows.map(row => row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    triggerBlobDownload(blob, `bao-cao-tong-quan-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  function exportStaff() {
    const rows = [
      ['Mã nhân sự', 'Họ và tên', 'Email', 'Số điện thoại', 'Vai trò', 'Trạng thái'],
      ...staffList.map(s => [
        s.userId,
        s.fullName,
        s.email,
        s.phone || 'N/A',
        getRoleBadge(s.role).label,
        s.isActive ? 'Đang hoạt động' : 'Tạm dừng',
      ]),
    ]
    const csv = '\uFEFF' + rows.map(row => row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    triggerBlobDownload(blob, `danh-sach-nhan-su-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  function exportRooms() {
    const rows = [
      ['Mã phòng', 'Tên phòng', 'Loại phòng', 'Sức chứa', 'Vị trí', 'Trạng thái'],
      ...roomsList.map(r => [
        r.id,
        r.name,
        r.roomType || 'Phòng tập',
        r.capacity,
        r.location || 'N/A',
        r.isActive ? 'Sẵn sàng hoạt động' : 'Đang bảo trì',
      ]),
    ]
    const csv = '\uFEFF' + rows.map(row => row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    triggerBlobDownload(blob, `danh-sach-phong-tap-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const exportActions = {
    overview: { label: 'Xuất báo cáo tổng quan', onClick: exportOverview },
    users: { label: 'Xuất danh sách nhân sự', onClick: exportStaff },
    classes: { label: 'Xuất báo cáo tổng quan', onClick: exportOverview },
    rooms: { label: 'Xuất danh sách phòng tập', onClick: exportRooms },
    packages: { label: 'Xuất báo cáo tổng quan', onClick: exportOverview },
    cancellation: { label: 'Xuất báo cáo tổng quan', onClick: exportOverview },
    reports: { label: 'Xuất báo cáo tổng quan', onClick: exportOverview },
    frontdesk: { label: 'Xuất báo cáo tổng quan', onClick: exportOverview },
  }
  const exportAction = exportActions[section] || exportActions.overview

  return (
    <div className="manager-dashboard">
      <aside className={`manager-sidebar ${sidebarOpen ? 'is-open' : ''}`} id="manager-sidebar">
        <Link to="/" className="manager-brand">
          <span><Trophy size={24} /></span>
          <div><strong>SportPulse<span>.</span></strong><small>TRUNG TÂM OLYMPUS</small></div>
        </Link>
        <div className="manager-portal"><ShieldCheck size={15} /> Không gian quản lý</div>
        <nav className="manager-nav" aria-label="Điều hướng quản lý">
          {managerNavSections.map(group => (
            <div key={group.title} className="manager-nav-group">
              <p>{group.title}</p>
              {group.items.map(({ id, label, icon: Icon }) => (
                <button
                  type="button"
                  key={id}
                  className={section === id ? 'active' : ''}
                  aria-current={section === id ? 'page' : undefined}
                  onClick={() => selectSection(id)}
                >
                  <Icon size={19} />
                  <span>{label}</span>
                  {section === id && <ChevronRight size={15} />}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="manager-sidebar-bottom">
          <div className="manager-center">
            <span className="manager-center-icon"><MapPin size={20} /></span>
            <small>TRUNG TÂM CỦA BẠN</small>
            <strong>Olympus · Cầu Giấy</strong>
            <p><i /> Mở cửa 06:00 – 22:00</p>
          </div>
          <Link className="manager-home" to="/">Về trang chủ <ArrowUpRight size={16} /></Link>
          <div className="manager-account">
            <span className="manager-avatar">{initials}</span>
            <div><strong>{managerName}</strong><small>Quản lý trung tâm</small></div>
            <button
              type="button"
              aria-label="Đăng xuất"
              onClick={async () => { await logout(); navigate('/login', { replace: true }) }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <div className="manager-workspace">
        <SessionCompletionSync />
        <header className="manager-topbar">
          <div>
            <button
              type="button"
              className="manager-menu"
              aria-label={sidebarOpen ? 'Đóng menu' : 'Mở menu'}
              aria-expanded={sidebarOpen}
              aria-controls="manager-sidebar"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
            <span className="manager-breadcrumb">
              Không gian quản lý <ChevronRight size={14} /> <strong>{pageTitle}</strong>
            </span>
          </div>
          <div className="manager-topbar-right">
            <ThemeToggle />
            <span className="manager-badge green" style={{ padding: '6px 12px' }}>
              <i style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              Hệ thống trực tuyến
            </span>
            <span className="manager-avatar">{initials}</span>
          </div>
        </header>

        <main className={`manager-main${section === 'overview' ? ' manager-overview' : ''}`} id="manager-content">
          {section !== 'rooms' && <>
          <section className="manager-welcome">
            <div>
              <p className="manager-eyebrow">VẬN HÀNH HIỆU QUẢ, KẾT NỐI ĐAM MÊ</p>
              <h1>{section === 'overview' ? 'Tổng quan trung tâm' : pageTitle}</h1>
              <p>Xin chào, {managerName}. Cùng theo dõi các chỉ số hoạt động thời gian thực tại Olympus.</p>
            </div>
            <button className="manager-button" type="button" onClick={exportAction.onClick}>
              <ArrowDownToLine size={17} /> {exportAction.label}
            </button>
          </section>

          <div className="manager-context">
            <span><CalendarDays size={16} /> {todayFormatted}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                className="manager-text-button"
                style={{ padding: '0 4px', fontSize: 11 }}
                onClick={loadOverviewData}
                disabled={loadingOverview}
                title="Làm mới dữ liệu từ máy chủ"
              >
                <RefreshCw size={13} className={loadingOverview ? 'spin' : ''} />
                <span>{loadingOverview ? 'Đang đồng bộ...' : 'Đồng bộ dữ liệu'}</span>
              </button>
              <small style={{ color: 'var(--manager-success, #10b981)', fontWeight: 550 }}>
                ● Dữ liệu đồng bộ trực tiếp từ máy chủ
              </small>
            </span>
          </div>
          </>}

          {/* 4 Cards Chỉ số Tổng quan trực tuyến */}
          {section === 'overview' && (
            <section className="manager-metrics" aria-label="Chỉ số hoạt động trực tuyến">
              {[
                {
                  icon: CreditCard,
                  label: 'Doanh thu tháng này',
                  value: money(overviewData?.currentMonthRevenue || 0),
                  note: `Lũy kế toàn thời gian: ${money(overviewData?.totalRevenue || 0)}`,
                  tone: 'blue',
                },
                {
                  icon: Users,
                  label: 'Hội viên hoạt động',
                  value: String(overviewData?.totalActiveMembers ?? 0).padStart(2, '0'),
                  note: `${todayCheckIns.length} lượt check-in hôm nay · ${overviewData?.totalActiveClasses ?? 0} lớp đang mở`,
                  tone: 'purple',
                },
                {
                  icon: DoorOpen,
                  label: 'Phòng tập sẵn sàng',
                  value: String(roomsList.filter(r => r.isActive).length).padStart(2, '0'),
                  suffix: `/ ${roomsList.length}`,
                  note: `${roomsList.filter(r => !r.isActive).length} phòng đang tạm ngưng / bảo trì`,
                  tone: 'green',
                },
                {
                  icon: ShieldCheck,
                  label: 'Đội ngũ nhân sự',
                  value: String(staffList.filter(s => s.isActive).length).padStart(2, '0'),
                  suffix: `/ ${staffList.length}`,
                  note: `${staffList.filter(s => s.role === 'Coach').length} HLV · ${staffList.filter(s => s.role === 'Receptionist').length} Lễ tân · ${staffList.filter(s => s.role === 'Manager').length} Quản lý`,
                  tone: 'amber',
                },
              ].map(({ icon: Icon, label, value, suffix, note, tone }) => (
                <article key={label} className={`manager-metric manager-metric-${tone}`}>
                  <div>
                    <span>{label}</span>
                    <span className={`manager-icon ${tone}`}><Icon size={20} /></span>
                  </div>
                  <strong><span className="manager-metric-number">{value}</span>{suffix && <small>{suffix}</small>}</strong>
                  <p>{note}</p>
                </article>
              ))}
            </section>
          )}

          {/* 1. Nhân sự & Phân quyền (UsersController) */}
          {section === 'users' && <StaffManagement />}

          {/* 2. Danh mục & Lớp học (SportClassesController, ClassCatalogController) */}
          {section === 'classes' && <ClassManagement />}

          {/* 3. Phòng tập / Cơ sở vật chất (RoomsController) */}
          {section === 'rooms' && <RoomManagement />}

          {/* 4. Gói thẻ hội viên (MembershipPackagesController) */}
          {section === 'packages' && <PackageManagement />}

          {/* 5. Chính sách hủy lịch (CancellationPoliciesController) */}
          {section === 'cancellation' && <CancellationPolicyManagement />}

          {/* 6. Báo cáo thống kê & Doanh thu (ReportsController) */}
          {section === 'reports' && <ReportManagement />}

          {/* 7. Vận hành dịch vụ khách hàng - FrontDesk */}
          {section === 'frontdesk' && <FrontDeskOperations />}

          {/* Overview: Biểu đồ doanh thu 12 tháng + Cơ sở vật chất */}
          {section === 'overview' && (
            <div className="manager-analytics">
              <section className="manager-card manager-revenue">
                <div className="manager-card-heading">
                  <div>
                    <h2>Doanh thu theo tháng</h2>
                    <p>Tình hình thanh toán trong năm {revenueYear}</p>
                  </div>
                  <select
                    aria-label="Khoảng thời gian doanh thu"
                    value={period}
                    onChange={event => setPeriod(event.target.value)}
                  >
                    <option value="year">Cả năm ({revenueYear})</option>
                    <option value="6months">6 tháng gần nhất</option>
                    <option value="3months">3 tháng gần nhất</option>
                  </select>
                </div>
                <div className="manager-revenue-total">
                  <strong>{money(totalRevenueChart)}</strong>
                  <span>Tổng trong {chartData.length} tháng được chọn</span>
                </div>
                <div
                  className="manager-chart"
                  role="img"
                  aria-label={`Doanh thu theo tháng: ${chartData.map(d => `Tháng ${d.month}: ${money(d.revenue)}`).join('; ')}`}
                >
                  <div className="manager-chart-axis">
                    <span>{(maxRevenueValue / 1000000).toFixed(0)} tr</span>
                    <span>{(maxRevenueValue / 2000000).toFixed(0)} tr</span>
                    <span>0</span>
                  </div>
                  <div className="manager-chart-bars">
                    {chartData.map(item => {
                      const rev = Number(item.revenue) || 0
                      const heightPercent = maxRevenueValue > 0
                        ? Math.min(100, Math.round((rev / maxRevenueValue) * 88) + (rev > 0 ? 12 : 2))
                        : 2
                      const isCurrent = item.month === currentMonthNumber
                      return (
                        <div className="manager-chart-column" key={item.month}>
                          <span className="manager-bar-value">
                            {rev > 0 ? (rev / 1000000).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : '0'}
                          </span>
                          <div
                            className={`manager-bar ${isCurrent ? 'latest' : ''}`}
                            style={{ height: `${heightPercent}%` }}
                            title={`Tháng ${item.month}/${item.year}: ${money(rev)}`}
                          />
                          <small>T{item.month}</small>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="manager-chart-foot">
                  <span><i /> Doanh thu (triệu đồng)</span>
                  <small>Dữ liệu tự động từ hệ thống thanh toán</small>
                </div>
              </section>

              <section className="manager-card manager-courts">
                <div className="manager-card-heading">
                  <div>
                    <h2>Phòng tập & Cơ sở vật chất</h2>
                    <p>{roomsList.length} phòng tập · Sức chứa tổng: {roomsList.reduce((sum, r) => sum + (r.capacity || 0), 0)} người</p>
                  </div>
                  <span className="manager-icon green"><DoorOpen size={21} /></span>
                </div>
                <div className="manager-court-legend">
                  <span><i className="available" />Sẵn sàng ({roomsList.filter(r => r.isActive).length})</span>
                  <span><i className="maintenance" />Tạm dừng / Bảo trì ({roomsList.filter(r => !r.isActive).length})</span>
                </div>
                <div className="manager-court-grid">
                  {roomsList.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '24px 0', color: 'var(--manager-secondary, #94a3b8)', fontSize: 12 }}>
                      Chưa có phòng tập nào trong hệ thống
                    </div>
                  ) : (
                    roomsList.map(room => (
                      <div
                        key={room.id}
                        className={`manager-court ${room.isActive ? 'available' : 'maintenance'}`}
                        title={`${room.name} (${room.roomType || 'Phòng tập'}): ${room.isActive ? 'Sẵn sàng' : 'Bảo trì'}`}
                      >
                        <span className="manager-court-icon"><DoorOpen size={19} /></span>
                        <div className="manager-court-info"><strong>{room.name}</strong><small>{room.roomType || 'Phòng tập'} · {room.capacity} chỗ</small></div>
                        <span className="manager-court-status">{room.isActive ? 'Sẵn sàng' : 'Tạm dừng'}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="manager-court-note">
                  <Clock3 size={16} />
                  <span>
                    {roomsList.filter(r => !r.isActive).length > 0
                      ? `Có ${roomsList.filter(r => !r.isActive).length} phòng (${roomsList.filter(r => !r.isActive).map(r => r.name).join(', ')}) đang tạm ngưng vận hành.`
                      : 'Tất cả các phòng tập đều đang trong trạng thái sẵn sàng đón hội viên.'}
                  </span>
                </div>
              </section>
            </div>
          )}

          {/* Overview: Lịch sử Giao dịch gần đây (PaymentsController) */}
          {section === 'overview' && (
            <section className="manager-card manager-bookings">
              <div className="manager-card-heading">
                <div>
                  <h2>Giao dịch gần đây <span className="manager-count">{paymentsList.length}</span></h2>
                  <p>Lịch sử thanh toán gói tập và dịch vụ qua PayOS & Tiền mặt</p>
                </div>
              </div>
              <div className="manager-table-tools">
                <label className="manager-search">
                  <Search size={17} />
                  <input
                    type="search"
                    aria-label="Tìm kiếm giao dịch"
                    placeholder="Tìm mã GD, mã hội viên hoặc phương thức..."
                    value={paymentQuery}
                    onChange={event => setPaymentQuery(event.target.value)}
                  />
                </label>
                <select
                  value={paymentStatusFilter}
                  aria-label="Lọc trạng thái thanh toán"
                  onChange={event => setPaymentStatusFilter(event.target.value)}
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="completed">Đã thanh toán (Completed)</option>
                  <option value="pending">Chờ thanh toán (Pending)</option>
                  <option value="cancelled">Đã hủy (Cancelled)</option>
                </select>
              </div>
              <div className="manager-table-scroll" role="region" aria-label="Danh sách giao dịch gần đây" tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">MÃ GIAO DỊCH / HỘI VIÊN</th>
                      <th scope="col">PHƯƠNG THỨC</th>
                      <th scope="col">THỜI GIAN</th>
                      <th scope="col">SỐ TIỀN</th>
                      <th scope="col">TRẠNG THÁI</th>
                      <th scope="col"><span className="manager-sr-only">Chi tiết</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map(payment => (
                      <tr key={payment.id}>
                        <td>
                          <div className="manager-customer">
                            <span className="manager-avatar">
                              {payment.memberId ? `HV${payment.memberId}` : 'GD'}
                            </span>
                            <div>
                              <strong>#{payment.id} · {payment.transactionReference || 'GD Quầy'}</strong>
                              <small>Hội viên #{payment.memberId}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 550 }}>{payment.paymentMethod || 'PayOS'}</span>
                        </td>
                        <td>
                          <span className="manager-time">
                            <Clock3 size={14} />
                            {payment.paidAt
                              ? new Date(payment.paidAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(payment.paidAt).toLocaleDateString('vi-VN')
                              : (payment.createdAt ? new Date(payment.createdAt).toLocaleDateString('vi-VN') : '—')}
                          </span>
                        </td>
                        <td className="manager-amount">
                          {money(payment.amountReceived > 0 ? payment.amountReceived : payment.amount)}
                        </td>
                        <td>{renderPaymentStatusBadge(payment.status)}</td>
                        <td>
                          <button
                            className="manager-detail-button"
                            type="button"
                            aria-label={`Xem chi tiết giao dịch ${payment.id}`}
                            onClick={() => openPaymentDetail(payment)}
                          >
                            <ChevronRight size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredPayments.length === 0 && (
                  <div className="manager-empty">
                    <Search size={26} />
                    <strong>Không tìm thấy giao dịch phù hợp</strong>
                    <p>Thử tìm mã giao dịch, mã hội viên khác hoặc đặt lại bộ lọc.</p>
                    <button
                      className="manager-text-button"
                      type="button"
                      onClick={() => { setPaymentQuery(''); setPaymentStatusFilter('all') }}
                    >
                      Xóa bộ lọc
                    </button>
                  </div>
                )}
              </div>
              <div className="manager-table-footer" role="status">
                <span>Hiển thị {filteredPayments.length} / {paymentsList.length} giao dịch</span>
                <span style={{ color: 'var(--manager-success, #10b981)', fontWeight: 550 }}>● Kết nối dữ liệu thời gian thực</span>
              </div>
            </section>
          )}

          {/* Overview: Đội ngũ nhân sự hệ thống (UsersController) */}
          {section === 'overview' && (
            <section className="manager-card manager-staff">
              <div className="manager-card-heading">
                <div>
                  <h2>Đội ngũ nhân sự hệ thống</h2>
                  <p>Huấn luyện viên, Lễ tân và Quản lý đang công tác</p>
                </div>
                <span className="manager-badge green">
                  <Check size={13} /> {staffList.filter(s => s.isActive).length} / {staffList.length} nhân sự hoạt động
                </span>
              </div>
              <div className="manager-staff-grid">
                {staffList.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '24px 0', color: 'var(--manager-secondary, #94a3b8)', fontSize: 12 }}>
                    Chưa có nhân sự nào trong hệ thống
                  </div>
                ) : (
                  staffList.map(person => {
                    const roleBadge = getRoleBadge(person.role)
                    const initials = getInitials(person.fullName)
                    return (
                      <article key={person.userId}>
                        <span className={`manager-avatar ${roleBadge.tone}`}>{initials}</span>
                        <div>
                          <strong>{person.fullName}</strong>
                          <p className="manager-staff-role">{roleBadge.label}</p>
                          <small>
                            <Phone size={12} /> {person.phone || person.email || 'Chưa cập nhật SĐT'}
                          </small>
                        </div>
                      </article>
                    )
                  })
                )}
              </div>
            </section>
          )}

          <footer className="manager-footer">
            <span>© 2026 SportPulse · Olympus</span>
            <span>Hệ thống quản lý trung tâm thể thao thông minh</span>
          </footer>
        </main>
      </div>

      {/* Dialog xem chi tiết giao dịch */}
      <dialog
        className="manager-dialog"
        ref={detailDialog}
        aria-label="Chi tiết giao dịch"
        onClose={() => setSelectedPayment(null)}
      >
        {selectedPayment && (
          <>
            <div className="manager-card-heading">
              <div>
                <p>CHI TIẾT THANH TOÁN</p>
                <h2>#{selectedPayment.id}</h2>
              </div>
              <button
                className="manager-detail-button"
                type="button"
                aria-label="Đóng chi tiết"
                onClick={() => detailDialog.current?.close()}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ marginBottom: 16 }}>
              {renderPaymentStatusBadge(selectedPayment.status)}
            </div>
            <dl>
              {[
                ['Mã tham chiếu', selectedPayment.transactionReference || 'GD Quầy trực tiếp'],
                ['Mã hội viên', `Hội viên #${selectedPayment.memberId}`],
                ['Gói thẻ áp dụng', selectedPayment.subscriptionId ? `Gói thẻ #${selectedPayment.subscriptionId}` : 'Không áp dụng'],
                ['Phương thức', selectedPayment.paymentMethod || 'PayOS'],
                ['Số tiền niêm yết', money(selectedPayment.amount)],
                ['Số tiền thực nhận', money(selectedPayment.amountReceived > 0 ? selectedPayment.amountReceived : selectedPayment.amount)],
                ['Thời gian tạo', selectedPayment.createdAt ? new Date(selectedPayment.createdAt).toLocaleString('vi-VN') : '—'],
                ['Thời gian thanh toán', selectedPayment.paidAt ? new Date(selectedPayment.paidAt).toLocaleString('vi-VN') : 'Chưa ghi nhận'],
                ['Lý do kiểm duyệt / Ghi chú', selectedPayment.reviewReason || 'Không có'],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              {String(selectedPayment.status).toLowerCase() === 'completed' && (
                <button
                  type="button"
                  className="manager-button"
                  style={{ flex: 1 }}
                  onClick={async () => {
                    try {
                      const blob = await exportInvoicePdf(selectedPayment.id)
                      triggerBlobDownload(blob, `hoa-don-${selectedPayment.id}.pdf`)
                    } catch (err) {
                      alert('Không thể xuất PDF hóa đơn: ' + (err.message || 'Lỗi'))
                    }
                  }}
                >
                  <ArrowDownToLine size={16} /> Xuất PDF Hóa đơn
                </button>
              )}
              <button
                className="manager-button"
                style={{
                  flex: 1,
                  background: 'var(--manager-raised, #f1f5f9)',
                  color: 'var(--manager-text, #334155)',
                  borderColor: 'var(--manager-control-border, #cbd5e1)',
                }}
                type="button"
                onClick={() => detailDialog.current?.close()}
              >
                Đóng
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  )
}
