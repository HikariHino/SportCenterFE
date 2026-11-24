import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import ThemeToggle from '../../components/ThemeToggle'
import {
  AlertCircle, Bell, CalendarDays, CheckCircle2, ChevronRight, CreditCard,
  Dumbbell, Headset, History, LogOut, Menu, QrCode, ReceiptText, ShieldCheck,
  Sparkles, Trophy, UserCheck, X,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import usePortalNavigation from '../../hooks/usePortalNavigation'
import usePageMotion from '../../hooks/usePageMotion'
import useSlidingPill from '../../hooks/useSlidingPill'
import { MemberViewActivity, MemberWorkspaceProvider, useMemberCache } from '../../contexts/MemberWorkspaceContext'
import { getUserDisplayName, getUserInitials } from '../../utils/auth'
import { getNotifications, markNotificationRead, markAllNotificationsRead, getNotificationErrorMessage } from '../../services/notificationService'
import { isSessionUpdateNotification, sessionNotificationId } from '../../utils/sessionNotifications'
import {
  ProfileView,
  SubscriptionsView,
  PaymentsView,
  GymCheckInView,
  ClassesView,
  TrainingPlansView,
  SupportTicketsView,
  NotificationsView,
} from './MemberViews'
import '../../style/member/Member.css'
import '../../style/member/MemberMotion.css'
import '../../style/PortalSidebar.css'
import '../../style/member/MemberWorkspace.css'
import MemberScheduleReviewGate from './MemberScheduleReviewGate'
import MemberAiChat from './MemberAiChat'
import MemberAiWorkout from './MemberAiWorkout'

export const memberNavSections = [
  {
    title: 'HỒ SƠ & DỊCH VỤ THẺ',
    items: [
      {
        id: 'checkin',
        label: 'Ra/Vào trung tâm',
        subtitle: 'GymCheckInsController',
        icon: QrCode,
      },
      {
        id: 'classes',
        label: 'Lớp học & Đặt lịch buổi học',
        subtitle: 'ClassSessionsController',
        icon: CalendarDays,
      },
      {
        id: 'subscriptions',
        label: 'Gói tập & Thẻ hội viên',
        subtitle: 'MemberSubscriptionsController',
        icon: CreditCard,
      },
      {
        id: 'payments',
        label: 'Thanh toán trực tuyến & Hóa đơn',
        subtitle: 'PaymentsController',
        icon: ReceiptText,
        hideFromSidebar: true,
      },
      {
        id: 'profile',
        label: 'Tài khoản & Hồ sơ cá nhân',
        subtitle: 'AuthController, ProfileController',
        icon: UserCheck,
      },
    ],
  },
  {
    title: 'TẬP LUYỆN & HỖ TRỢ',
    items: [
      {
        id: 'training-plans',
        label: 'Lộ trình tập luyện cá nhân',
        subtitle: 'TrainingPlansController',
        icon: Dumbbell,
      },
      {
        id: 'training-plan-history',
        label: 'Lịch sử giáo án đã hoàn thành',
        icon: History,
      },
      {
        id: 'ai-workout',
        label: 'Gợi ý bài tập AI',
        icon: Dumbbell,
        hidden: true,
      },
      {
        id: 'ai-chat',
        label: 'Trợ lý AI',
        icon: Sparkles,
      },
      {
        id: 'support',
        label: 'Hỗ trợ khách hàng',
        subtitle: 'SupportTicketsController',
        icon: Headset,
      },
      {
        id: 'notifications',
        label: 'Thông báo hệ thống',
        subtitle: 'NotificationsController',
        icon: Bell,
      },
    ],
  },
].map(section => ({ ...section, items: section.items.filter(item => !item.hidden) }))

const allNavItems = memberNavSections.flatMap(section => section.items)
const memberViewIds = allNavItems.map(item => item.id)

export default function Member() {
  const { user } = useAuth()
  const sessionKey = user?.userId || user?.id || user?.email || 'member'
  return <MemberWorkspaceProvider key={sessionKey} sessionKey={sessionKey}><MemberWorkspace /></MemberWorkspaceProvider>
}

function MemberWorkspace() {
  const { user, logout } = useAuth()
  const cache = useMemberCache()
  const navigate = useNavigate()
  const location = useLocation()
  const paymentReturnView = ['payments', 'subscriptions'].includes(location.state?.activeNav) ? location.state.activeNav : undefined
  const [activeNav, setActiveNav] = usePortalNavigation(memberViewIds, 'checkin', paymentReturnView)
  const contentMotion = usePageMotion(activeNav)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const menuButton = useRef(null)
  const sidebarPill = useSlidingPill(activeNav, sidebarOpen)
  const [notice, setNotice] = useState('')
  const [noticeTone, setNoticeTone] = useState('success')

  useEffect(() => {
    if (!location.state?.paymentNotice) { setNotice(''); return }
    setNotice(location.state.paymentNotice)
    setNoticeTone(location.state.paymentStatus === 'success' ? 'success' : ['pending', 'review'].includes(location.state.paymentStatus) ? 'warning' : 'error')
    const timer = window.setTimeout(() => setNotice(''), 6000)
    return () => window.clearTimeout(timer)
  }, [location.key, location.state?.paymentNotice, location.state?.paymentStatus])

  // Quick notification bell dropdown state
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(null)
  const [quickNotifications, setQuickNotifications] = useState([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifError, setNotifError] = useState('')
  const [quickMarkingId, setQuickMarkingId] = useState(null)
  const [quickMarkingAll, setQuickMarkingAll] = useState(false)
  const [quickReadNotice, setQuickReadNotice] = useState('')
  const [quickReadError, setQuickReadError] = useState('')
  const [notificationRevision, setNotificationRevision] = useState(0)
  const [scheduleRequest, setScheduleRequest] = useState(null)
  const [scheduleReviewRequest, setScheduleReviewRequest] = useState(0)
  const notificationRef = useRef(null)
  const quickReadLock = useRef(false)
  const mounted = useRef(true)
  const refreshNotifications = useCallback(() => {
    if (mounted.current) setNotificationRevision(value => value + 1)
  }, [])

  useEffect(() => {
    const refreshVisible = () => { if (document.visibilityState === 'visible') refreshNotifications() }
    const timer = window.setInterval(refreshVisible, 10000)
    window.addEventListener('focus', refreshVisible)
    document.addEventListener('visibilitychange', refreshVisible)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshVisible)
      document.removeEventListener('visibilitychange', refreshVisible)
    }
  }, [refreshNotifications])

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const displayName = getUserDisplayName(user)
  const initials = getUserInitials(user)
  const activeItem = allNavItems.find(item => item.id === activeNav) || allNavItems[0]

  const showNotice = (text) => {
    setNoticeTone('success')
    setNotice(text)
    window.setTimeout(() => setNotice(''), 3000)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  // Read the unread total independently from the recent-notification list.
  useEffect(() => {
    let active = true
    setNotifError('')
    setNotifLoading(notificationOpen)
    Promise.allSettled([
      cache.load('notifications:unread', () => getNotifications({ unreadOnly: true, page: 1, pageSize: 1 }), { force: true }),
      notificationOpen ? getNotifications({ page: 1, pageSize: 5 }) : Promise.resolve(null),
    ]).then(([unread, recent]) => {
        if (!active) return
        if (unread.status === 'fulfilled') setUnreadCount(unread.value.total)
        if (notificationOpen) {
          if (recent.status === 'fulfilled') setQuickNotifications(recent.value.items)
          if (recent.status === 'rejected') setNotifError(getNotificationErrorMessage(recent.reason))
          else if (unread.status === 'rejected') setNotifError('Chưa thể cập nhật số thông báo chưa đọc. Vui lòng thử lại.')
        }
        setNotifLoading(false)
    })
    return () => { active = false }
  }, [cache, notificationOpen, notificationRevision])

  // Handle outside click to close notification popup
  useEffect(() => {
    if (!notificationOpen) return undefined
    const handleOutsideClick = (e) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target)) {
        setNotificationOpen(false)
      }
    }
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setNotificationOpen(false)
        notificationRef.current?.querySelector('button')?.focus()
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [notificationOpen])

  const toggleNotifications = () => setNotificationOpen(value => !value)

  const handleQuickMarkRead = async (id) => {
    if (quickReadLock.current) return
    quickReadLock.current = true
    setQuickMarkingId(id)
    setNotifError('')
    setQuickReadNotice('')
    setQuickReadError('')
    try {
      await markNotificationRead(id)
      if (!mounted.current) return
      setQuickNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
      refreshNotifications()
    } catch (error) {
      if (mounted.current) setNotifError(getNotificationErrorMessage(error))
    } finally {
      quickReadLock.current = false
      if (mounted.current) setQuickMarkingId(null)
    }
  }

  const handleQuickMarkAllRead = async () => {
    if (quickReadLock.current) return
    quickReadLock.current = true
    setQuickMarkingAll(true)
    setQuickReadNotice('')
    setQuickReadError('')
    try {
      const outcome = await markAllNotificationsRead()
      if (!mounted.current) return
      setQuickReadNotice((outcome.total ? `Đã đọc ${outcome.read}/${outcome.total} thông báo.` : outcome.requiresReview ? '' : 'Bạn đã đọc hết thông báo.') + (outcome.requiresReview ? ` Có ${outcome.requiresReview} thông báo thay đổi lịch cần kiểm tra và xác nhận.` : ''))
      if (outcome.failed.length) setQuickReadError(`Còn ${outcome.failed.length} thông báo chưa cập nhật được. Vui lòng thử lại.`)
    } catch (error) {
      if (mounted.current) setQuickReadError(getNotificationErrorMessage(error))
    } finally {
      quickReadLock.current = false
      if (mounted.current) { setQuickMarkingAll(false); refreshNotifications() }
    }
  }

  const selectNav = (id) => {
    setActiveNav(id)
    setSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  const viewUpdatedSchedule = item => {
    refreshNotifications()
    setNotificationOpen(false)
    if (!item.isRead) {
      setScheduleReviewRequest(value => value + 1)
      return
    }
    setScheduleRequest({ sessionId: sessionNotificationId(item), revision: Date.now() })
    selectNav('classes')
  }

  const renderView = view => {
    switch (view) {
      case 'profile':
        return <ProfileView user={user} showNotice={showNotice} />
      case 'subscriptions':
        return <SubscriptionsView showNotice={showNotice} />
      case 'payments':
        return <PaymentsView showNotice={showNotice} />
      case 'checkin':
        return <GymCheckInView showNotice={showNotice} />
      case 'classes':
        return <ClassesView initialTab={new URLSearchParams(location.search).get('browse') === '1' ? 'browse' : 'mine'} showNotice={showNotice} onNavigateTab={selectNav} notificationSessionId={scheduleRequest?.sessionId} notificationRequestKey={scheduleRequest?.revision} />
      case 'training-plans':
        return <TrainingPlansView user={user} showNotice={showNotice} />
      case 'training-plan-history':
        return <TrainingPlansView user={user} completedOnly />
      case 'ai-chat':
        return <MemberAiChat active={activeNav === 'ai-chat'} onNavigate={selectNav} showWorkoutShortcut={memberViewIds.includes('ai-workout')} />
      case 'ai-workout':
        return <MemberAiWorkout active={activeNav === 'ai-workout'} onNavigate={selectNav} />
      case 'support':
        return <SupportTicketsView showNotice={showNotice} />
      case 'notifications':
        return <NotificationsView refreshKey={notificationRevision} onNotificationsChange={refreshNotifications} onViewSchedule={viewUpdatedSchedule} unreadCount={unreadCount} />
      default:
        return <GymCheckInView showNotice={showNotice} />
    }
  }

  return (
    <MemberScheduleReviewGate key={user?.userId ?? user?.id ?? user?.email} refreshKey={notificationRevision} reopenRequest={scheduleReviewRequest} onConfirmed={refreshNotifications}>
    <div className="member-page member-dashboard">
      {/* Sidebar role Member */}
      <aside id="member-sidebar" className={`member-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="member-sidebar-heading">
          <Link to="/" className="member-brand">
            <span><Trophy size={24} /></span>
            <div>
              <strong>SportPulse<span>.</span></strong>
              <small>MEMBER PORTAL</small>
            </div>
          </Link>
        {sidebarOpen && <button type="button" className="member-sidebar-close" aria-label="Đóng menu hội viên" title="Đóng menu" onClick={() => { setSidebarOpen(false); menuButton.current?.focus({ preventScroll: true }) }}><X size={22} aria-hidden="true" /></button>}
        </div>

        <div className="member-portal-tag">
          <ShieldCheck size={14} /> Cổng thông tin hội viên
        </div>

        <nav className="member-sidebar-nav member-sliding-nav" ref={sidebarPill.container} aria-label="Điều hướng hội viên">
          <span className="member-nav-pill" ref={sidebarPill.pill} aria-hidden="true" />
          {memberNavSections.map(group => (
            <div key={group.title} className="member-sidebar-group">
              <p className="member-sidebar-group-title">{group.title}</p>
              {group.items.filter(item => !item.hideFromSidebar).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`member-sidebar-item ${activeNav === id ? 'active' : ''}`}
                  onClick={() => selectNav(id)}
                  aria-current={activeNav === id ? 'page' : undefined}
                  aria-pressed={activeNav === id}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  {activeNav === id && <ChevronRight size={14} />}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="member-sidebar-bottom">
          <div className="member-sidebar-account">
            <span className="member-avatar">{initials}</span>
            <div>
              <strong>{displayName}</strong>
              <small>Hội viên Olympus</small>
            </div>
            <button type="button" aria-label="Đăng xuất" title="Đăng xuất" onClick={handleLogout}>
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <section className="member-workspace">
        <header className="member-topbar">
          <div className="member-topbar-left">
            <button
              ref={menuButton}
              type="button"
              className="member-menu-btn"
              aria-label={sidebarOpen ? 'Đóng menu' : 'Mở menu'}
              aria-expanded={sidebarOpen}
              aria-controls="member-sidebar"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <div className="member-topbar-breadcrumb">
              <span>Hội viên</span>
              <ChevronRight size={13} />
              <strong>{activeItem.label}</strong>
            </div>
          </div>

          <div className="member-topbar-right">
            <ThemeToggle />

            {/* Quick Notification Dropdown */}
            <div className="member-notification-wrap" ref={notificationRef}>
              <button
                type="button"
                className="member-icon-button member-notification"
                aria-label={unreadCount === null ? 'Thông báo' : `Thông báo: ${unreadCount} chưa đọc`}
                aria-expanded={notificationOpen}
                aria-controls="member-notifications-popup"
                onClick={toggleNotifications}
              >
                <Bell size={20} />
                {unreadCount > 0 && <i>{unreadCount > 99 ? '99+' : unreadCount}</i>}
              </button>

              {notificationOpen && (
                <section id="member-notifications-popup" className="member-notifications-popup" aria-label="Thông báo gần đây" aria-busy={notifLoading}>
                  <header>
                    <strong>Thông báo{unreadCount !== null ? ` (${unreadCount} chưa đọc)` : ''}</strong>
                    <button
                      type="button"
                      onClick={() => { setNotificationOpen(false); selectNav('notifications') }}
                    >
                      Xem tất cả
                    </button>
                  </header>
                  <button type="button" className="member-notifications-read-all" disabled={notifLoading || quickMarkingAll || quickMarkingId !== null || unreadCount === 0} onClick={handleQuickMarkAllRead}><CheckCircle2 size={15} />{quickMarkingAll ? 'Đang đọc...' : 'Đọc tất cả'}</button>
                  {quickReadNotice && <p role="status" className="member-notifications-notice">{quickReadNotice}</p>}
                  {quickReadError && <p role="alert" className="member-notifications-error">{quickReadError}</p>}

                  {notifError && <div className="member-notifications-error" role="alert"><p>{notifError}</p><button type="button" disabled={notifLoading} onClick={refreshNotifications}>Thử lại</button></div>}

                  {notifLoading && !quickNotifications.length ? (
                    <div className="member-notifications-popup-state" role="status">Đang tải...</div>
                  ) : quickNotifications.length === 0 ? (
                    !notifError && <div className="member-notifications-popup-state">Chưa có thông báo.</div>
                  ) : (
                    <div className="member-notifications-preview">
                      {quickNotifications.map(item => (
                        <article
                          key={item.id}
                          className={item.isRead ? '' : 'unread'}
                        >
                            <h4>{item.title}</h4>
                            <p>{item.content}</p>
                            {isSessionUpdateNotification(item) && <div className="member-session-update-notice"><p>Kiểm tra lịch mới và HLV. Đăng ký được giữ nguyên; bạn có thể tự hủy theo hạn hủy nếu không tham gia được.</p><button type="button" onClick={() => viewUpdatedSchedule(item)}>Xem lịch đã đặt</button></div>}
                            {!item.isRead && !isSessionUpdateNotification(item) && (
                              <button
                                type="button"
                                disabled={quickMarkingId !== null || quickMarkingAll}
                                onClick={() => handleQuickMarkRead(item.id)}
                              >
                                {quickMarkingId === item.id ? 'Đang cập nhật...' : 'Đánh dấu đã đọc'}
                              </button>
                            )}
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>

            <div className="member-topbar-account">
              <span className="member-avatar">{initials}</span>
              <div className="member-profile-info">
                <span className="member-profile-name">{displayName}</span>
                <small className="member-profile-role">Thành viên Olympus</small>
              </div>
            </div>
          </div>
        </header>

        <main className="member-main-content">
          {notice && (
            <div className="member-toast" data-tone={noticeTone} role="status">
              {noticeTone === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              {notice}
            </div>
          )}

          {memberViewIds.map(view => <div className="member-view-content" key={view} ref={activeNav === view ? contentMotion : undefined} hidden={activeNav !== view}>
            <MemberViewActivity active={activeNav === view}>{renderView(view)}</MemberViewActivity>
          </div>)}
        </main>
      </section>
    </div>
    </MemberScheduleReviewGate>
  )
}
