import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ThemeToggle from '../../components/ThemeToggle'
import {
  Bell, CalendarDays, CheckCircle2, Dumbbell,
  ClipboardCheck, LayoutDashboard, LogOut, Search, Trophy, Users,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
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
  'Điểm danh': { eyebrow: 'CHUYÊN CẦN THEO BUỔI', title: 'Điểm danh học viên', description: 'Chọn buổi huấn luyện và ghi nhận học viên có mặt trong thời gian cho phép.' },
}

export default function Coach() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [activeNav, setActiveNav] = useState('Tổng quan')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const coachName = user?.name || user?.fullName || 'Huấn luyện viên'
  const coachInitials = coachName.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase() || 'HLV'
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

  const renderActiveView = () => {
    if (activeNav === 'Lịch huấn luyện') return <ScheduleView showNotice={showNotice} />
    if (activeNav === 'Học viên') return <StudentsView query={query} />
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
        <div className="coach-topbar-actions"><ThemeToggle /><button className="coach-notification" type="button" aria-label="Thông báo" onClick={() => showNotice('Chưa có dữ liệu thông báo từ API.')}><Bell size={20} /></button><span className="coach-topbar-profile"><span className="coach-avatar">{coachInitials}</span><span><strong>{coachName}</strong><small>Huấn luyện viên</small></span></span></div>
      </header>

      <div className="coach-main">
        {activeNav === 'Tổng quan' ? <section className="coach-welcome"><div><p>{today}</p><h1>Chào bạn, {coachName}! <span>👋</span></h1><small>Lịch huấn luyện và học viên theo buổi được đồng bộ từ Coach API.</small></div></section> : <section className="coach-page-heading"><div><p>{meta.eyebrow}</p><h1>{meta.title}</h1><span>{meta.description}</span></div></section>}

        {notice && <div className="coach-toast" role="status"><CheckCircle2 size={18} />{notice}</div>}
        <div className="coach-view-content" key={activeNav}>{renderActiveView()}</div>
      </div>
    </section>
  </main>
}
