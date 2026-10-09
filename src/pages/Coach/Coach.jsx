import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ThemeToggle from '../../components/ThemeToggle'
import {
  Bell, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Dumbbell,
  ClipboardCheck, LayoutDashboard, LogOut, Search, Trophy, Users, X,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { getNotifications, markNotificationRead } from '../../services/notificationService'
import { AttendanceView, OverviewView, ScheduleView, StudentsView } from './CoachViews'
import '../../style/Coach/Coach.css'

const navigation = [
  [LayoutDashboard, 'Tổng quan'],
  [CalendarDays, 'Lịch huấn luyện'],
  [Users, 'Học viên'],
  [ClipboardCheck, 'Điểm danh'],
]

const pageMeta = {
  'Lịch huấn luyện': { eyebrow: 'QUẢN LÝ THỜI GIAN', title: 'Lịch huấn luyện', description: 'Theo dõi và sắp xếp toàn bộ buổi huấn luyện trong tuần.' },
  'Học viên': { eyebrow: 'HỌC VIÊN THEO BUỔI', title: 'Danh sách học viên', description: 'Chọn một buổi huấn luyện để xem đăng ký và trạng thái điểm danh.' },
  'Điểm danh': { eyebrow: 'CHUYÊN CẦN THEO BUỔI', title: 'Điểm danh học viên', description: 'Chọn buổi huấn luyện và cập nhật trạng thái chuyên cần của từng học viên.' },
}

const notificationDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export default function Coach() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [activeNav, setActiveNav] = useState('Tổng quan')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notificationPage, setNotificationPage] = useState({ items: [], total: 0, page: 1, pageSize: 6 })
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState('')
  const [notificationActionError, setNotificationActionError] = useState('')
  const [markingNotificationId, setMarkingNotificationId] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const notificationRef = useRef(null)
  const coachName = user?.name || user?.fullName || 'Huấn luyện viên'
  const coachInitials = coachName.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase() || 'HLV'
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
      setNotificationsError(error.response?.data?.message || error.message || 'Không thể tải thông báo.')
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
      setNotificationActionError(error.response?.data?.message || error.message || 'Không thể đánh dấu thông báo đã đọc.')
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

  const renderActiveView = () => {
    if (activeNav === 'Lịch huấn luyện') return <ScheduleView showNotice={showNotice} />
    if (activeNav === 'Học viên') return <StudentsView query={query} showNotice={showNotice} />
    if (activeNav === 'Điểm danh') return <AttendanceView query={query} showNotice={showNotice} />
    return <OverviewView onNavigate={selectNavigation} showNotice={showNotice} />
  }

  const meta = pageMeta[activeNav]
  return <main className="coach-dashboard">
    <aside className="coach-sidebar">
      <Link to="/" className="coach-brand" aria-label="Về trang chủ SportPulse">
        <span><Trophy size={23} /></span><div><strong>SportPulse <em>Olympus</em></strong><small>COACH PORTAL</small></div>
      </Link>

      <nav className="coach-nav" aria-label="Điều hướng Coach">
        <p>QUẢN LÝ HUẤN LUYỆN</p>
        {navigation.map(([Icon, label]) => <button key={label} type="button" className={activeNav === label ? 'active' : ''} aria-pressed={activeNav === label} onClick={() => selectNavigation(label)}>
          <Icon size={19} /><span>{label}</span>
        </button>)}
      </nav>

      <div className="coach-sidebar-card"><span><Dumbbell size={20} /></span><p>Nguồn dữ liệu</p><strong>Coach API</strong><small>Lịch, học viên và điểm danh</small></div>
      <div className="coach-sidebar-user"><span className="coach-avatar">{coachInitials}</span><div><strong>{coachName}</strong><small>Huấn luyện viên</small></div><button type="button" onClick={handleLogout} aria-label="Đăng xuất"><LogOut size={18} /></button></div>
    </aside>

    <section className="coach-workspace">
      <header className="coach-topbar">
        <label className="coach-search"><Search size={18} /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm học viên..." aria-label="Tìm kiếm" /></label>
        <div className="coach-topbar-actions"><ThemeToggle /><div className="coach-notification-wrap" ref={notificationRef}><button className="coach-notification" type="button" aria-label="Thông báo" aria-expanded={notificationOpen} onClick={toggleNotifications}><Bell size={20} />{unreadCount > 0 && <i><span>{unreadCount > 99 ? '99+' : unreadCount}</span></i>}</button>{notificationOpen && <section className="coach-notification-panel" aria-label="Thông báo Coach"><header><div><span>THÔNG BÁO</span><strong>{unreadCount ? `${unreadCount} chưa đọc` : 'Đã xem tất cả'}</strong></div><button type="button" aria-label="Đóng thông báo" onClick={() => setNotificationOpen(false)}><X size={17} /></button></header>{notificationActionError && <div className="coach-notification-action-error" role="alert">{notificationActionError}</div>}{notificationsLoading ? <div className="coach-notification-state">Đang tải thông báo...</div> : notificationsError ? <div className="coach-notification-state error"><strong>Không thể tải thông báo</strong><span>{notificationsError}</span><button type="button" onClick={() => loadNotifications(notificationPage.page)}>Thử lại</button></div> : notificationPage.items.length ? <><div className="coach-notification-list">{notificationPage.items.map(item => <article className={item.isRead ? '' : 'unread'} key={item.id}><span><Bell size={15} /></span><div><strong>{item.title}</strong><p>{item.content}</p><small>{notificationDateFormatter.format(new Date(item.sentAt))}</small>{!item.isRead && <button type="button" className="coach-notification-read" disabled={Boolean(markingNotificationId)} onClick={() => handleMarkNotificationRead(item)}><CheckCircle2 size={13} />{markingNotificationId === item.id ? 'Đang cập nhật...' : 'Đánh dấu đã đọc'}</button>}</div>{!item.isRead && <i />}</article>)}</div>{notificationPageCount > 1 && <footer><button type="button" disabled={notificationPage.page <= 1} onClick={() => loadNotifications(notificationPage.page - 1)}><ChevronLeft size={14} />Trước</button><span>{notificationPage.page}/{notificationPageCount}</span><button type="button" disabled={notificationPage.page >= notificationPageCount} onClick={() => loadNotifications(notificationPage.page + 1)}>Sau<ChevronRight size={14} /></button></footer>}</> : <div className="coach-notification-state"><Bell size={24} /><strong>Chưa có thông báo</strong><span>Thông báo dành cho Coach sẽ xuất hiện tại đây.</span></div>}</section>}</div><span className="coach-topbar-profile"><span className="coach-avatar">{coachInitials}</span><span><strong>{coachName}</strong><small>Huấn luyện viên</small></span></span></div>
      </header>

      <div className="coach-main">
        {activeNav === 'Tổng quan' ? <section className="coach-welcome"><div><p>{today}</p><h1>Chào bạn, {coachName}! <span>👋</span></h1><small>Lịch huấn luyện và học viên theo buổi được đồng bộ từ Coach API.</small></div></section> : <section className="coach-page-heading"><div><p>{meta.eyebrow}</p><h1>{meta.title}</h1><span>{meta.description}</span></div></section>}

        {notice && <div className="coach-toast" role="status"><CheckCircle2 size={18} />{notice}</div>}
        <div className="coach-view-content" key={activeNav}>{renderActiveView()}</div>
      </div>
    </section>
  </main>
}
