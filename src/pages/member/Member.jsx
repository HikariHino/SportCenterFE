import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ThemeToggle from '../../components/ThemeToggle'
import {
  Bell, CalendarDays, CheckCircle2, ChevronRight, CreditCard,
  Dumbbell, Headset, LogOut, Menu, QrCode, ReceiptText, ShieldCheck,
  Trophy, UserCheck, X,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { getUserDisplayName, getUserInitials } from '../../utils/auth'
import { getNotifications, markNotificationRead } from '../../services/notificationService'
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
  const [unreadCount, setUnreadCount] = useState(0)
  const [quickNotifications, setQuickNotifications] = useState([])
  const [notifLoading, setNotifLoading] = useState(false)
  const notificationRef = useRef(null)

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

  // Load unread count
  useEffect(() => {
    let active = true
    getNotifications({ unreadOnly: true, page: 1, pageSize: 5 })
      .then(res => {
        if (!active) return
        setUnreadCount(res.total || 0)
        setQuickNotifications(res.items || [])
      })
      .catch(() => {
        if (active) setUnreadCount(0)
      })
    return () => { active = false }
  }, [activeNav])

  // Handle outside click to close notification popup
  useEffect(() => {
    if (!notificationOpen) return undefined
    const handleOutsideClick = (e) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target)) {
        setNotificationOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [notificationOpen])

  const toggleNotifications = async () => {
    const next = !notificationOpen
    setNotificationOpen(next)
    if (next) {
      setNotifLoading(true)
      try {
        const res = await getNotifications({ page: 1, pageSize: 5 })
        setQuickNotifications(res.items || [])
        setUnreadCount(res.total || 0)
      } catch {
        // ignore
      } finally {
        setNotifLoading(false)
      }
    }
  }

  const handleQuickMarkRead = async (id) => {
    try {
      await markNotificationRead(id)
      setQuickNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
      setUnreadCount(c => Math.max(0, c - 1))
    } catch {
      // ignore
    }
  }

  const selectNav = (id) => {
    setActiveNav(id)
    setSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
        return <ClassesView showNotice={showNotice} />
      case 'training-plans':
        return <TrainingPlansView user={user} showNotice={showNotice} />
      case 'support':
        return <SupportTicketsView showNotice={showNotice} />
      case 'notifications':
        return <NotificationsView showNotice={showNotice} />
      default:
        return <ProfileView user={user} showNotice={showNotice} />
    }
  }

  return (
    <div className="member-dashboard">
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
            <div className="member-notification-wrap" ref={notificationRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="member-icon-button member-notification"
                aria-label="Thông báo"
                onClick={toggleNotifications}
              >
                <Bell size={20} />
                {unreadCount > 0 && <i>{unreadCount > 99 ? '99+' : unreadCount}</i>}
              </button>

              {notificationOpen && (
                <div
                  className="member-card"
                  style={{
                    position: 'absolute',
                    top: 48,
                    right: 0,
                    width: 340,
                    maxHeight: 440,
                    overflowY: 'auto',
                    zIndex: 40,
                    padding: 16,
                    boxShadow: '0 16px 40px rgba(0,0,0,0.15)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <strong style={{ fontSize: 13 }}>Thông báo ({unreadCount} chưa đọc)</strong>
                    <button
                      type="button"
                      className="member-button member-button--text"
                      style={{ fontSize: 10, padding: 0 }}
                      onClick={() => { setNotificationOpen(false); selectNav('notifications') }}
                    >
                      Xem tất cả
                    </button>
                  </div>

                  {notifLoading ? (
                    <div style={{ textAlign: 'center', padding: 20, fontSize: 11, color: '#64748b' }}>Đang tải...</div>
                  ) : quickNotifications.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 20, fontSize: 11, color: '#64748b' }}>Không có thông báo mới.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {quickNotifications.map(item => (
                        <div
                          key={item.id}
                          style={{
                            padding: 10,
                            borderRadius: 8,
                            background: item.isRead ? '#f8fafc' : '#eff6ff',
                            border: '1px solid #e2e8f0',
                            fontSize: 11,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: 12 }}>{item.title}</strong>
                            {!item.isRead && (
                              <button
                                type="button"
                                style={{ border: 0, background: 'none', color: '#004ac6', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}
                                onClick={() => handleQuickMarkRead(item.id)}
                              >
                                Đã đọc
                              </button>
                            )}
                          </div>
                          <p style={{ margin: '4px 0 0', color: '#475569', lineHeight: 1.5 }}>{item.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="member-avatar">{initials}</span>
              <div className="member-profile-info" style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="member-profile-name" style={{ fontSize: 12, fontWeight: 700 }}>{displayName}</span>
                <small style={{ fontSize: 9.5, color: '#004ac6', fontWeight: 600 }}>Thành viên Olympus</small>
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
