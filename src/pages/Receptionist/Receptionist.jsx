import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BadgeCheck, Bell, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, DoorOpen,
  LayoutDashboard, LifeBuoy, LogOut, ReceiptText, ScanLine, Search, ShieldCheck, Trophy, UserRound, Users, X,
} from 'lucide-react'
import ThemeToggle from '../../components/ThemeToggle'
import { useAuth } from '../../contexts/AuthContext'
import { getNotifications, markNotificationRead } from '../../services/notificationService'
import { formatDateTime, requestErrorMessage } from './ReceptionistViewShared'
import '../../style/Receptionist/Receptionist.css'

const CheckInView = lazy(() => import('./CheckInView').then(module => ({ default: module.CheckInView })))
const MembersView = lazy(() => import('./MembersView').then(module => ({ default: module.MembersView })))
const Overview = lazy(() => import('./OverviewView').then(module => ({ default: module.Overview })))
const PaymentsView = lazy(() => import('./PaymentsView').then(module => ({ default: module.PaymentsView })))
const ReceptionistProfileView = lazy(() => import('./ProfileView').then(module => ({ default: module.ReceptionistProfileView })))
const RoomsView = lazy(() => import('./RoomsView').then(module => ({ default: module.RoomsView })))
const SessionsView = lazy(() => import('./SessionsView').then(module => ({ default: module.SessionsView })))
const SupportTicketsView = lazy(() => import('./SupportTicketsView').then(module => ({ default: module.SupportTicketsView })))

const navigation = [
  [LayoutDashboard, 'Tổng quan'],
  [CalendarDays, 'Buổi học'],
  [ScanLine, 'Check-in'],
  [Users, 'Hội viên'],
  [ReceiptText, 'Thanh toán'],
  [LifeBuoy, 'Hỗ trợ'],
  [DoorOpen, 'Phòng tập'],
  [UserRound, 'Hồ sơ'],
]

const pageMeta = {
  'Buổi học': ['VẬN HÀNH BUỔI HỌC', 'Quản lý buổi học', 'Đăng ký học viên, kiểm tra danh sách và cập nhật trạng thái buổi học.'],
  'Check-in': ['TIẾP NHẬN KHÁCH', 'Check-in tại quầy', 'Xác minh mã đặt sân hoặc tài khoản hội viên trước khi sử dụng dịch vụ.'],
  'Hội viên': ['HỖ TRỢ HỘI VIÊN', 'Tra cứu hội viên', 'Kiểm tra trạng thái tài khoản, gói dịch vụ và thông tin liên hệ.'],
  'Thanh toán': ['GIAO DỊCH TẠI QUẦY', 'Thanh toán', 'Theo dõi giao dịch và hóa đơn phát sinh tại quầy lễ tân.'],
  'Hỗ trợ': ['CHĂM SÓC HỘI VIÊN', 'Phiếu hỗ trợ', 'Theo dõi yêu cầu, phản hồi và tình trạng xử lý của hội viên.'],
  'Phòng tập': ['CƠ SỞ VẬT CHẤT', 'Phòng tập', 'Tra cứu phòng tập, khu chức năng và sức chứa phục vụ hội viên.'],
  'Hồ sơ': ['TÀI KHOẢN NHÂN VIÊN', 'Hồ sơ Receptionist', 'Xem thông tin tài khoản đang đăng nhập tại quầy lễ tân.'],
}

export default function Receptionist() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [activeNav, setActiveNav] = useState('Tổng quan')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notificationPage, setNotificationPage] = useState({ items: [], total: 0, page: 1, pageSize: 6 })
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState('')
  const [notificationActionError, setNotificationActionError] = useState('')
  const [markingNotificationId, setMarkingNotificationId] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const notificationRef = useRef(null)
  const staffName = user?.name || user?.fullName || 'Nhân viên lễ tân'
  const initials = staffName.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase() || 'LT'
  const today = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())
  const notificationPageCount = Math.max(1, Math.ceil(notificationPage.total / notificationPage.pageSize))

  useEffect(() => {
    let active = true
    getNotifications({ unreadOnly: true, page: 1, pageSize: 1 })
      .then(result => { if (active) setUnreadCount(result.total) })
      .catch(() => { if (active) setUnreadCount(0) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!notificationOpen) return undefined
    const closeOnOutsideClick = event => {
      if (!notificationRef.current?.contains(event.target)) setNotificationOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [notificationOpen])

  const loadNotifications = async (page = 1) => {
    setNotificationsLoading(true)
    setNotificationsError('')
    setNotificationActionError('')
    try {
      const [result, unreadResult] = await Promise.all([
        getNotifications({ page, pageSize: 6 }),
        getNotifications({ unreadOnly: true, page: 1, pageSize: 1 }),
      ])
      setNotificationPage(result)
      setUnreadCount(unreadResult.total)
    } catch (error) {
      setNotificationsError(requestErrorMessage(error, 'Không thể tải thông báo.'))
    } finally {
      setNotificationsLoading(false)
    }
  }

  const toggleNotifications = () => {
    const nextOpen = !notificationOpen
    setNotificationOpen(nextOpen)
    if (nextOpen) loadNotifications(1)
  }

  const handleMarkNotificationRead = async notification => {
    if (notification.isRead || markingNotificationId) return
    setMarkingNotificationId(notification.id)
    setNotificationActionError('')
    try {
      await markNotificationRead(notification.id)
      setNotificationPage(current => ({
        ...current,
        items: current.items.map(item => item.id === notification.id ? { ...item, isRead: true } : item),
      }))
      setUnreadCount(current => Math.max(0, current - 1))
    } catch (error) {
      setNotificationActionError(requestErrorMessage(error, 'Không thể đánh dấu thông báo đã đọc.'))
    } finally {
      setMarkingNotificationId(null)
    }
  }

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
    if (activeNav === 'Buổi học') return <SessionsView showNotice={showNotice} />
    if (activeNav === 'Check-in') return <CheckInView showNotice={showNotice} />
    if (activeNav === 'Hội viên') return <MembersView query={query} showNotice={showNotice} />
    if (activeNav === 'Thanh toán') return <PaymentsView query={query} showNotice={showNotice} />
    if (activeNav === 'Hỗ trợ') return <SupportTicketsView query={query} showNotice={showNotice} />
    if (activeNav === 'Phòng tập') return <RoomsView query={query} />
    if (activeNav === 'Hồ sơ') return <ReceptionistProfileView showNotice={showNotice} />
    return <Overview onNavigate={selectNavigation} />
  }

  const meta = pageMeta[activeNav]

  return <main className="reception-dashboard">
    <aside className="reception-sidebar">
      <Link to="/" className="reception-brand"><span><Trophy size={23} /></span><div><strong>SportPulse <em>Olympus</em></strong><small>RECEPTION PORTAL</small></div></Link>
      <nav className="reception-nav" aria-label="Điều hướng lễ tân"><p>VẬN HÀNH QUẦY LỄ TÂN</p>{navigation.map(([Icon, label]) => <button type="button" key={label} className={activeNav === label ? 'active' : ''} aria-pressed={activeNav === label} onClick={() => selectNavigation(label)}><Icon size={19} /><span>{label}</span></button>)}</nav>
      <div className="reception-source"><span><ShieldCheck size={20} /></span><p>Nguồn dữ liệu</p><strong>Reception API</strong><small>Đang đồng bộ trực tiếp</small></div>
      <div className="reception-user"><span className="reception-avatar">{initials}</span><div><strong>{staffName}</strong><small>Nhân viên lễ tân</small></div><button type="button" onClick={handleLogout} aria-label="Đăng xuất"><LogOut size={18} /></button></div>
    </aside>

    <section className="reception-workspace">
      <header className="reception-topbar"><label><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm mã đặt sân, hội viên..." aria-label="Tìm kiếm" /></label><div><ThemeToggle /><div className="reception-notification-wrap" ref={notificationRef}><button className="reception-notification-button" type="button" aria-label="Thông báo" aria-expanded={notificationOpen} onClick={toggleNotifications}><Bell size={20} />{unreadCount > 0 && <i>{unreadCount > 99 ? '99+' : unreadCount}</i>}</button>{notificationOpen && <section className="reception-notification-panel" aria-label="Thông báo Receptionist"><header><div><span>THÔNG BÁO</span><strong>{unreadCount ? `${unreadCount} chưa đọc` : 'Đã xem tất cả'}</strong></div><button type="button" aria-label="Đóng thông báo" onClick={() => setNotificationOpen(false)}><X size={17} /></button></header>{notificationActionError && <div className="reception-notification-action-error" role="alert">{notificationActionError}</div>}{notificationsLoading ? <div className="reception-notification-state">Đang tải thông báo...</div> : notificationsError ? <div className="reception-notification-state error"><strong>Không thể tải thông báo</strong><span>{notificationsError}</span><button type="button" onClick={() => loadNotifications(notificationPage.page)}>Thử lại</button></div> : notificationPage.items.length ? <><div className="reception-notification-list">{notificationPage.items.map(item => <article className={item.isRead ? '' : 'unread'} key={item.id}><span><Bell size={15} /></span><div><strong>{item.title}</strong><p>{item.content}</p><small>{formatDateTime(item.sentAt)}</small>{!item.isRead && <button type="button" className="reception-notification-read" disabled={Boolean(markingNotificationId)} onClick={() => handleMarkNotificationRead(item)}><CheckCircle2 size={13} />{markingNotificationId === item.id ? 'Đang cập nhật...' : 'Đánh dấu đã đọc'}</button>}</div>{!item.isRead && <i />}</article>)}</div>{notificationPageCount > 1 && <footer><button type="button" disabled={notificationPage.page <= 1} onClick={() => loadNotifications(notificationPage.page - 1)}><ChevronLeft size={14} />Trước</button><span>{notificationPage.page}/{notificationPageCount}</span><button type="button" disabled={notificationPage.page >= notificationPageCount} onClick={() => loadNotifications(notificationPage.page + 1)}>Sau<ChevronRight size={14} /></button></footer>}</> : <div className="reception-notification-state"><Bell size={24} /><strong>Chưa có thông báo</strong><span>Thông báo dành cho Receptionist sẽ xuất hiện tại đây.</span></div>}</section>}</div><span className="reception-avatar">{initials}</span><span><strong>{staffName}</strong><small>Nhân viên lễ tân</small></span></div></header>
      <div className="reception-main">
        {activeNav === 'Tổng quan' ? <section className="reception-welcome"><div><p>{today}</p><h1>Chào bạn, {staffName}!</h1><span>Dữ liệu vận hành quầy được đồng bộ trực tiếp từ hệ thống.</span></div><BadgeCheck size={42} /></section> : <section className="reception-page-heading"><p>{meta[0]}</p><h1>{meta[1]}</h1><span>{meta[2]}</span></section>}
        {notice && <div className="reception-toast" role="status"><CheckCircle2 size={18} />{notice}</div>}
        <div className="reception-view" key={activeNav}><Suspense fallback={<section className="reception-card reception-empty"><strong>Đang tải màn hình</strong><p>Vui lòng chờ trong giây lát.</p></section>}>{renderView()}</Suspense></div>
      </div>
    </section>
  </main>
}
