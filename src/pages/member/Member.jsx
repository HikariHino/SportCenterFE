import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ThemeToggle from '../../components/ThemeToggle'
import {
  Bell, CalendarDays, CheckCircle2, ChevronRight, CreditCard,
  Dumbbell, Headset, LogOut, Menu, QrCode, ReceiptText, ShieldCheck,
  Trophy, UserCheck, X,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
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

export const memberNavSections = [
  {
    title: 'HỒ SƠ & DỊCH VỤ THẺ',
    items: [
      {
        id: 'profile',
        label: 'Tài khoản & Hồ sơ cá nhân',
        subtitle: 'AuthController, ProfileController',
        icon: UserCheck,
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
      },
      {
        id: 'checkin',
        label: 'Ra/vào phòng gym',
        subtitle: 'GymCheckInsController',
        icon: QrCode,
      },
    ],
  },
  {
    title: 'TẬP LUYỆN & HỖ TRỢ',
    items: [
      {
        id: 'classes',
        label: 'Lớp học & Đặt lịch buổi học',
        subtitle: 'ClassSessionsController',
        icon: CalendarDays,
      },
      {
        id: 'training-plans',
        label: 'Lộ trình tập luyện cá nhân',
        subtitle: 'TrainingPlansController',
        icon: Dumbbell,
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
]

const allNavItems = memberNavSections.flatMap(section => section.items)

export default function Member() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [activeNav, setActiveNav] = useState('profile')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notice, setNotice] = useState('')

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
  const notificationRef = useRef(null)
  const quickReadLock = useRef(false)
  const mounted = useRef(true)
  const refreshNotifications = useCallback(() => {
    if (mounted.current) setNotificationRevision(value => value + 1)
  }, [])

  useEffect(() => {
    const refreshVisible = () => { if (document.visibilityState === 'visible') refreshNotifications() }
    const timer = window.setInterval(refreshVisible, 30000)
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
      getNotifications({ unreadOnly: true, page: 1, pageSize: 1 }),
      notificationOpen ? getNotifications({ page: 1, pageSize: 5 }) : Promise.resolve(null),
    ]).then(([unread, recent]) => {
        if (!active) return
        setUnreadCount(unread.status === 'fulfilled' ? unread.value.total : null)
        if (notificationOpen) {
          setQuickNotifications(recent.status === 'fulfilled' ? recent.value.items : [])
          if (recent.status === 'rejected') setNotifError(getNotificationErrorMessage(recent.reason))
          else if (unread.status === 'rejected') setNotifError('Chưa thể cập nhật số thông báo chưa đọc. Vui lòng thử lại.')
        }
        setNotifLoading(false)
    })
    return () => { active = false }
  }, [activeNav, notificationOpen, notificationRevision])

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
      setQuickReadNotice(outcome.total ? `Đã đọc ${outcome.read}/${outcome.total} thông báo.` : 'Bạn đã đọc hết thông báo.')
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
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const viewUpdatedSchedule = item => {
    setScheduleRequest({ sessionId: sessionNotificationId(item), revision: Date.now() })
    setNotificationOpen(false)
    selectNav('classes')
  }

  const renderActiveView = () => {
    switch (activeNav) {
      case 'profile':
        return <ProfileView user={user} showNotice={showNotice} />
      case 'subscriptions':
        return <SubscriptionsView showNotice={showNotice} />
      case 'payments':
        return <PaymentsView showNotice={showNotice} />
      case 'checkin':
        return <GymCheckInView showNotice={showNotice} />
      case 'classes':
        return <ClassesView key={scheduleRequest?.revision || 'classes'} showNotice={showNotice} onNavigateTab={selectNav} notificationSessionId={scheduleRequest?.sessionId} />
      case 'training-plans':
        return <TrainingPlansView user={user} showNotice={showNotice} />
      case 'support':
        return <SupportTicketsView showNotice={showNotice} />
      case 'notifications':
        return <NotificationsView refreshKey={notificationRevision} onNotificationsChange={refreshNotifications} onViewSchedule={viewUpdatedSchedule} unreadCount={unreadCount} />
      default:
        return <ProfileView user={user} showNotice={showNotice} />
    }
  }

  return (
    <div className="member-page member-dashboard">
      {/* Sidebar role Member */}
      <aside className={`member-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <Link to="/" className="member-brand">
          <span><Trophy size={24} /></span>
          <div>
            <strong>SportPulse<span>.</span></strong>
            <small>MEMBER PORTAL</small>
          </div>
        </Link>

        <div className="member-portal-tag">
          <ShieldCheck size={14} /> Cổng thông tin hội viên
        </div>

        <nav className="member-sidebar-nav" aria-label="Điều hướng hội viên">
          {memberNavSections.map(group => (
            <div key={group.title} className="member-sidebar-group">
              <p className="member-sidebar-group-title">{group.title}</p>
              {group.items.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`member-sidebar-item ${activeNav === id ? 'active' : ''}`}
                  onClick={() => selectNav(id)}
                  aria-current={activeNav === id ? 'page' : undefined}
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
              type="button"
              className="member-menu-btn"
              aria-label={sidebarOpen ? 'Đóng menu' : 'Mở menu'}
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

                  {notifLoading ? (
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
                            {!item.isRead && (
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
            <div className="member-toast" role="status">
              <CheckCircle2 size={18} />
              {notice}
            </div>
          )}

          {renderActiveView()}
        </main>
      </section>
    </div>
  )
}
