import { CoachPagination } from './CoachPagination'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ThemeToggle from '../../components/ThemeToggle'
import {
  Bell, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, DoorOpen,
  LayoutDashboard, LogOut, Menu, Search, ShieldCheck, Star, Trophy, UserRound, Users, X,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import usePortalNavigation from '../../hooks/usePortalNavigation'
import usePageMotion from '../../hooks/usePageMotion'
import useSlidingPill from '../../hooks/useSlidingPill'
import { CoachWorkspaceProvider, CoachViewActivity, useCoachCache } from '../../contexts/CoachWorkspaceContext'
import { prefetchWorkspaceResources } from '../../utils/workspaceResourceCache'
import { coachReadTasks } from '../../services/coachWorkspaceReads'
import { getNotifications, markNotificationRead } from '../../services/notificationService'
import { ViewLoader } from './CoachViewShared'
import '../../style/Coach/Coach.css'
import '../../style/Coach/CoachMotion.css'
import '../../style/PortalSidebar.css'

const viewLoaders = {
  'Đánh giá coach': () => import('../../components/CoachReviewsView'),
  'Tổng quan': () => import('./OverviewView'), 'Lịch huấn luyện': () => import('./AttendanceView'),
  'Phòng tập': () => import('./RoomsView'), 'Học viên': () => import('./StudentsView'), 'Hồ sơ': () => import('./ProfileView'),
}
const AttendanceView = lazy(() => viewLoaders['Lịch huấn luyện']().then(module => ({ default: module.AttendanceView })))
const CoachProfileView = lazy(() => viewLoaders['Hồ sơ']().then(module => ({ default: module.CoachProfileView })))
const CoachRoomsView = lazy(() => viewLoaders['Phòng tập']().then(module => ({ default: module.CoachRoomsView })))
const OverviewView = lazy(() => viewLoaders['Tổng quan']().then(module => ({ default: module.OverviewView })))
const StudentsView = lazy(() => viewLoaders['Học viên']().then(module => ({ default: module.StudentsView })))
const CoachReviewsView = lazy(viewLoaders['Đánh giá coach'])
const preloadView = view => viewLoaders[view]?.().catch(() => {})

const navigation = [
  [LayoutDashboard, 'Tổng quan'],
  [CalendarDays, 'Lịch huấn luyện'],
  [DoorOpen, 'Phòng tập'],
  [Users, 'Học viên'],
  [Star, 'Đánh giá coach'],
  [UserRound, 'Hồ sơ'],
]
const coachViews = navigation.map(([, label]) => label)

const pageMeta = {
  'Đánh giá coach': { eyebrow: 'PHẢN HỒI TỪ HỘI VIÊN', title: 'Đánh giá của tôi', description: 'Xem điểm đánh giá và nhận xét hội viên dành cho bạn.' },
  'Lịch huấn luyện': { eyebrow: 'LỊCH & CHUYÊN CẦN', title: 'Lịch huấn luyện', description: 'Chọn buổi trên thời khóa biểu để xem học viên và cập nhật điểm danh.' },
  'Phòng tập': { eyebrow: 'CƠ SỞ VẬT CHẤT', title: 'Phòng tập', description: 'Xem danh sách phòng và tình trạng phục vụ huấn luyện.' },
  'Học viên': { eyebrow: 'HỌC VIÊN THEO BUỔI', title: 'Danh sách học viên', description: 'Chọn một buổi huấn luyện để xem đăng ký và trạng thái điểm danh.' },
  'Hồ sơ': { eyebrow: 'TÀI KHOẢN HUẤN LUYỆN VIÊN', title: 'Hồ sơ cá nhân', description: 'Kiểm tra thông tin tài khoản Coach đang đăng nhập.' },
}

const notificationDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const selectedSessionStorageKey = 'coach:selected-session'

const readSelectedSession = () => {
  try {
    const value = window.sessionStorage.getItem(selectedSessionStorageKey)
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

export default function Coach() {
  const { user } = useAuth()
  const sessionKey = user?.userId || user?.id || user?.email || 'coach-demo'
  return <CoachWorkspaceProvider key={sessionKey} sessionKey={sessionKey}><CoachWorkspace /></CoachWorkspaceProvider>
}

function CoachWorkspace() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [activeNav, setActiveNav] = usePortalNavigation(coachViews, 'Tổng quan')
  const contentMotion = usePageMotion(activeNav)
  const cache = useCoachCache()
  const [visitedViews, setVisitedViews] = useState([activeNav])
  useEffect(() => { setVisitedViews(current => current.includes(activeNav) ? current : [...current, activeNav]) }, [activeNav])
  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      prefetchWorkspaceResources(cache, coachReadTasks(cache), { isCancelled: () => cancelled })
      const preloadRemaining = async () => { for (const view of coachViews) { if (cancelled) return; await preloadView(view) } }
      preloadRemaining()
    }, 1200)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [cache])
  const [selectedCoachSession, setSelectedCoachSession] = useState(readSelectedSession)
  const [notice, setNotice] = useState('')
  const [queries, setQueries] = useState({})
  const query = queries[activeNav] || ''
  const setQuery = value => setQueries(current => ({ ...current, [activeNav]: value }))
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const menuButton = useRef(null)
  const sidebarPill = useSlidingPill(activeNav, sidebarOpen)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notificationPage, setNotificationPage] = useState({ items: [], total: 0, page: 1, pageSize: 10 })
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState('')
  const [notificationActionError, setNotificationActionError] = useState('')
  const [markingNotificationId, setMarkingNotificationId] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const notificationRef = useRef(null)
  const coachName = user?.name || user?.fullName || 'Huấn luyện viên'
  const coachInitials = coachName.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase() || 'HLV'
  const today = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())

  useEffect(() => {
    let active = true
    getNotifications({ unreadOnly: true, page: 1, pageSize: 1 })
      .then(result => { if (active) setUnreadCount(result.total) })
      .catch(() => { if (active) setUnreadCount(0) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (selectedCoachSession?.id) window.sessionStorage.setItem(selectedSessionStorageKey, JSON.stringify(selectedCoachSession))
    else window.sessionStorage.removeItem(selectedSessionStorageKey)
  }, [selectedCoachSession])

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
        getNotifications({ page, pageSize: 10 }),
        getNotifications({ unreadOnly: true, page: 1, pageSize: 1 }),
      ])
      const lastPage = Math.max(1, Math.ceil(result.total / 10))
      if (page > lastPage) { await loadNotifications(lastPage); return }
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

  const selectCoachSession = useCallback(session => {
    if (!session?.id) {
      setSelectedCoachSession(null)
      return
    }
    setSelectedCoachSession({
      id: String(session.id),
      classId: session.classId ? String(session.classId) : null,
      sportId: session.sportId ? String(session.sportId) : null,
      sportName: session.sportName || null,
      startsAt: session.startsAt || null,
      endsAt: session.endsAt || null,
      className: session.className || session.studentName || 'Buổi huấn luyện',
    })
  }, [])

  const selectNavigation = (label, session) => {
    if (session) selectCoachSession(session)
    setActiveNav(label)
    setSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  const handleLogout = async () => {
    window.sessionStorage.removeItem(selectedSessionStorageKey)
    await logout()
    navigate('/login', { replace: true })
  }

  const renderView = view => {
    const active = activeNav === view
    if (view === 'Đánh giá coach') return <CoachReviewsView own active={active} />
    if (view === 'Lịch huấn luyện') return <AttendanceView active={active} query={queries[view] || ''} showNotice={showNotice} selectedSession={selectedCoachSession} selectedSessionId={selectedCoachSession?.id || ''} onSelectSession={selectCoachSession} />
    if (view === 'Phòng tập') return <CoachRoomsView active={active} />
    if (view === 'Học viên') return <StudentsView active={active} query={queries[view] || ''} showNotice={showNotice} selectedSessionId={selectedCoachSession?.id || ''} onSelectSession={selectCoachSession} />
    if (view === 'Hồ sơ') return <CoachProfileView active={active} showNotice={showNotice} />
    return <OverviewView active={active} onNavigate={selectNavigation} showNotice={showNotice} />
  }

  const ActiveNavIcon = navigation.find(([, label]) => label === activeNav)?.[0] || LayoutDashboard
  const meta = activeNav === 'Tổng quan'
    ? { eyebrow: 'BẢNG ĐIỀU KHIỂN COACH', title: `Chào bạn, ${coachName}!`, description: `${today} · Lịch huấn luyện và học viên được đồng bộ từ hệ thống.` }
    : pageMeta[activeNav]
  return <main className="coach-dashboard">
    <aside id="coach-sidebar" className={`coach-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
      <div className="coach-sidebar-heading">
        <Link to="/" className="coach-brand" aria-label="Về trang chủ SportPulse">
          <span><Trophy size={24} /></span><div><strong>SportPulse<span>.</span></strong><small>COACH PORTAL</small></div>
        </Link>
        {sidebarOpen && <button type="button" className="coach-sidebar-close" aria-label="Đóng menu Coach" title="Đóng menu" onClick={() => { setSidebarOpen(false); menuButton.current?.focus({ preventScroll: true }) }}><X size={22} aria-hidden="true" /></button>}
      </div>
      <div className="coach-portal-tag"><ShieldCheck size={14} />Cổng thông tin huấn luyện viên</div>

      <nav className="coach-nav" aria-label="Điều hướng Coach">
        <div className="coach-nav-group coach-sliding-nav" ref={sidebarPill.container}>
          <span className="coach-nav-pill" ref={sidebarPill.pill} aria-hidden="true" />
          <p className="coach-nav-title">QUẢN LÝ HUẤN LUYỆN</p>
          {navigation.map(([Icon, label]) => <button key={label} type="button" className={activeNav === label ? 'active' : ''} aria-pressed={activeNav === label} onPointerEnter={() => preloadView(label)} onFocus={() => preloadView(label)} onClick={() => selectNavigation(label)}>
            <Icon size={18} /><span>{label}</span>{activeNav === label && <ChevronRight size={14} />}
          </button>)}
        </div>
      </nav>

      <div className="coach-sidebar-bottom"><div className="coach-sidebar-user"><span className="coach-avatar">{coachInitials}</span><div><strong>{coachName}</strong><small>Huấn luyện viên</small></div><button type="button" onClick={handleLogout} aria-label="Đăng xuất"><LogOut size={18} /></button></div></div>
    </aside>

    <section className="coach-workspace">
      <header className="coach-topbar">
        <div className="coach-topbar-left"><button ref={menuButton} className="coach-menu-btn" type="button" aria-label={sidebarOpen ? 'Đóng menu' : 'Mở menu'} aria-expanded={sidebarOpen} aria-controls="coach-sidebar" onClick={() => setSidebarOpen(value => !value)}>{sidebarOpen ? <X size={21} /> : <Menu size={21} />}</button><div className="coach-breadcrumb"><span>Huấn luyện viên</span><ChevronRight size={13} /><strong>{activeNav}</strong></div></div>
        <div className="coach-topbar-actions"><ThemeToggle /><div className="coach-notification-wrap" ref={notificationRef}><button className="coach-notification" type="button" aria-label={`Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ''}`} aria-expanded={notificationOpen} onClick={toggleNotifications}><Bell size={20} />{unreadCount > 0 && <i />}</button>{notificationOpen && <section className="coach-notification-panel" aria-label="Thông báo Coach"><header><div><span>THÔNG BÁO</span><strong>{unreadCount ? `${unreadCount} chưa đọc` : 'Đã xem tất cả'}</strong></div><button type="button" aria-label="Đóng thông báo" onClick={() => setNotificationOpen(false)}><X size={17} /></button></header>{notificationActionError && <div className="coach-notification-action-error" role="alert">{notificationActionError}</div>}{notificationsLoading ? <div className="coach-notification-state">Đang tải thông báo...</div> : notificationsError ? <div className="coach-notification-state error"><strong>Không thể tải thông báo</strong><span>{notificationsError}</span><button type="button" onClick={() => loadNotifications(notificationPage.page)}>Thử lại</button></div> : notificationPage.items.length ? <><div className="coach-notification-list">{notificationPage.items.slice(0, 10).map(item => <article className={item.isRead ? '' : 'unread'} key={item.id}><span><Bell size={15} /></span><div><strong>{item.title}</strong><p>{item.content}</p><small>{notificationDateFormatter.format(new Date(item.sentAt))}</small>{!item.isRead && <button type="button" className="coach-notification-read" disabled={Boolean(markingNotificationId)} onClick={() => handleMarkNotificationRead(item)}><CheckCircle2 size={13} />{markingNotificationId === item.id ? 'Đang cập nhật...' : 'Đánh dấu đã đọc'}</button>}</div>{!item.isRead && <i />}</article>)}</div><CoachPagination label="Thông báo Coach" total={notificationPage.total} page={notificationPage.page} onChange={loadNotifications} disabled={notificationsLoading} /></> : <div className="coach-notification-state"><Bell size={24} /><strong>Chưa có thông báo</strong><span>Thông báo dành cho Coach sẽ xuất hiện tại đây.</span></div>}</section>}</div><button className="coach-topbar-profile" type="button" aria-label="Mở hồ sơ Coach" aria-pressed={activeNav === 'Hồ sơ'} onClick={() => { setNotificationOpen(false); selectNavigation('Hồ sơ') }}><span className="coach-avatar">{coachInitials}</span><span><strong>{coachName}</strong><small>Huấn luyện viên</small></span></button></div>
      </header>

      <div className="coach-main" ref={contentMotion}>
        <section className="coach-page-heading"><div><p><ActiveNavIcon size={16} />{meta.eyebrow}</p><h1>{meta.title}</h1><span>{meta.description}</span></div>{['Học viên', 'Lịch huấn luyện'].includes(activeNav) && <label className="coach-content-search"><Search size={16} /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm học viên..." aria-label="Tìm học viên" /></label>}</section>

        {notice && <div className="coach-toast" role="status"><CheckCircle2 size={18} />{notice}</div>}
        {coachViews.filter(view => view === activeNav || visitedViews.includes(view)).map(view => <div className="coach-view-content" key={view} hidden={view !== activeNav}><CoachViewActivity active={view === activeNav}><Suspense fallback={<ViewLoader />}>{renderView(view)}</Suspense></CoachViewActivity></div>)}
      </div>
    </section>
  </main>
}
