import ThemeToggle from '../../components/ThemeToggle'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowUpRight, BarChart3, Bell, CalendarDays, CheckCircle2, ChevronRight,
  ClipboardList, Clock3, Dumbbell, LayoutDashboard, LogOut, MapPin,
  MessageSquare, Plus, Search, Star, Trophy, Users, Video,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import '../../style/Coach/Coach.css'

const navigation = [
  [LayoutDashboard, 'Tổng quan'],
  [CalendarDays, 'Lịch huấn luyện'],
  [Users, 'Học viên'],
  [ClipboardList, 'Giáo án'],
  [BarChart3, 'Hiệu suất'],
]

const sessions = [
  { time: '07:30', duration: '60 phút', student: 'Trần Minh Đức', program: 'Pickleball căn bản', court: 'Sân P03', status: 'Đã hoàn thành', tone: 'done' },
  { time: '09:00', duration: '90 phút', student: 'Nhóm Olympus Junior', program: 'Kỹ thuật phản xạ', court: 'Sân P01', status: 'Đang diễn ra', tone: 'live' },
  { time: '14:30', duration: '60 phút', student: 'Nguyễn Thu Trang', program: 'Chiến thuật thi đấu', court: 'Sân P05', status: 'Sắp tới', tone: 'next' },
  { time: '17:00', duration: '90 phút', student: 'CLB Smash Pro', program: 'Đấu tập nâng cao', court: 'Sân P02', status: 'Sắp tới', tone: 'next' },
]

const students = [
  { name: 'Nguyễn Thu Trang', initials: 'NT', program: 'Pickleball Performance', progress: 82, sessions: '10/12 buổi', color: 'blue' },
  { name: 'Trần Minh Đức', initials: 'TM', program: 'Nền tảng kỹ thuật', progress: 67, sessions: '8/12 buổi', color: 'green' },
  { name: 'Lê Hoàng Anh', initials: 'LH', program: 'Thi đấu nâng cao', progress: 54, sessions: '7/13 buổi', color: 'orange' },
]

const metrics = [
  { icon: CalendarDays, label: 'Buổi dạy hôm nay', value: '04', note: '1 buổi đang diễn ra', tone: 'blue' },
  { icon: Users, label: 'Học viên đang theo', value: '24', note: '+3 trong tháng này', tone: 'green' },
  { icon: Clock3, label: 'Giờ huấn luyện', value: '48h', note: 'Tháng 09/2026', tone: 'purple' },
  { icon: Star, label: 'Đánh giá trung bình', value: '4.9', note: 'Từ 128 lượt đánh giá', tone: 'amber' },
]

export default function Coach() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [activeNav, setActiveNav] = useState('Tổng quan')
  const [notice, setNotice] = useState('')
  const coachName = user?.name || 'Nguyễn Hoàng Nam'
  const today = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())

  const showNotice = (text) => {
    setNotice(text)
    window.setTimeout(() => setNotice(''), 2600)
  }

  const selectNavigation = (label) => {
    setActiveNav(label)
    if (label !== 'Tổng quan') showNotice(`${label} đang được hoàn thiện trong bản tiếp theo.`)
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className="coach-dashboard">
      <aside className="coach-sidebar">
        <Link to="/" className="coach-brand" aria-label="Về trang chủ SportPulse">
          <span><Trophy size={23} /></span>
          <div><strong>SportPulse <em>Olympus</em></strong><small>COACH PORTAL</small></div>
        </Link>

        <nav className="coach-nav" aria-label="Điều hướng Coach">
          <p>QUẢN LÝ HUẤN LUYỆN</p>
          {navigation.map(([Icon, label]) => (
            <button key={label} type="button" className={activeNav === label ? 'active' : ''} aria-pressed={activeNav === label} onClick={() => selectNavigation(label)}>
              <Icon size={19} /><span>{label}</span>{label === 'Lịch huấn luyện' && <b>4</b>}
            </button>
          ))}
        </nav>

        <div className="coach-sidebar-card">
          <span><Dumbbell size={20} /></span>
          <p>Trung tâm Olympus</p>
          <strong>Cơ sở Cầu Giấy</strong>
          <small>Đang hoạt động • 06:00–22:00</small>
        </div>

        <div className="coach-sidebar-user">
          <span className="coach-avatar">HN<i /></span>
          <div><strong>{coachName}</strong><small>HLV Pickleball Pro</small></div>
          <button type="button" onClick={handleLogout} aria-label="Đăng xuất"><LogOut size={18} /></button>
        </div>
      </aside>

      <section className="coach-workspace">
        <header className="coach-topbar">
          <label className="coach-search"><Search size={18} /><input type="search" placeholder="Tìm học viên, giáo án..." aria-label="Tìm kiếm" /></label>
          <div className="coach-topbar-actions"><ThemeToggle />
            <button className="coach-notification" type="button" aria-label="Thông báo" onClick={() => showNotice('Bạn có 3 thông báo mới.')}><Bell size={20} /><i /></button>
            <span className="coach-topbar-profile"><span className="coach-avatar">HN<i /></span><span><strong>{coachName}</strong><small>Huấn luyện viên</small></span></span>
          </div>
        </header>

        <div className="coach-main">
          <section className="coach-welcome">
            <div>
              <p>{today}</p>
              <h1>Chào buổi sáng, Coach Nam! <span>👋</span></h1>
              <small>Bạn có <strong>4 buổi huấn luyện</strong> hôm nay. Buổi tiếp theo bắt đầu lúc 14:30.</small>
            </div>
            <button type="button" onClick={() => showNotice('Biểu mẫu tạo lịch dạy đang được chuẩn bị.')}><Plus size={19} /> Tạo lịch dạy mới</button>
          </section>

          {notice && <div className="coach-toast" role="status"><CheckCircle2 size={18} />{notice}</div>}

          <section className="coach-metrics" aria-label="Thống kê huấn luyện">
            {metrics.map(({ icon: Icon, label, value, note, tone }) => (
              <article key={label}>
                <span className={`coach-metric-icon ${tone}`}><Icon size={20} /></span>
                <div><small>{label}</small><strong>{value}</strong><p>{note}</p></div>
                <ArrowUpRight size={17} />
              </article>
            ))}
          </section>

          <div className="coach-primary-grid">
            <section className="coach-card coach-schedule">
              <div className="coach-card-head">
                <div><span>LỊCH TRÌNH</span><h2>Lịch huấn luyện hôm nay</h2></div>
                <button type="button" onClick={() => selectNavigation('Lịch huấn luyện')}>Xem toàn bộ <ChevronRight size={16} /></button>
              </div>
              <div className="coach-session-list">
                {sessions.map((session) => (
                  <article className={`coach-session ${session.tone}`} key={`${session.time}-${session.student}`}>
                    <div className="coach-session-time"><strong>{session.time}</strong><small>{session.duration}</small></div>
                    <i />
                    <div className="coach-session-info"><strong>{session.student}</strong><span>{session.program}</span><small><MapPin size={13} /> {session.court}</small></div>
                    <span className={`coach-status ${session.tone}`}>{session.status}</span>
                    <button type="button" aria-label={`Xem buổi học của ${session.student}`} onClick={() => showNotice(`Đã mở thông tin buổi học của ${session.student}.`)}><ChevronRight size={18} /></button>
                  </article>
                ))}
              </div>
            </section>

            <section className="coach-card coach-performance">
              <div className="coach-card-head">
                <div><span>HIỆU SUẤT TUẦN</span><h2>Giờ huấn luyện</h2></div>
                <b>+12.5%</b>
              </div>
              <div className="coach-chart" aria-label="Biểu đồ giờ huấn luyện theo ngày">
                {[['T2', 55], ['T3', 78], ['T4', 46], ['T5', 92], ['T6', 68], ['T7', 84], ['CN', 35]].map(([day, height]) => (
                  <div key={day}><span style={{ height: `${height}%` }}><i>{Math.round(height / 10)}h</i></span><small>{day}</small></div>
                ))}
              </div>
              <div className="coach-chart-summary"><div><small>Tổng tuần</small><strong>32.5 giờ</strong></div><div><small>Mục tiêu</small><strong>35 giờ</strong></div></div>
              <div className="coach-goal"><span style={{ width: '93%' }} /><small>Đã đạt 93% mục tiêu tuần</small></div>
            </section>
          </div>

          <div className="coach-secondary-grid">
            <section className="coach-card coach-students">
              <div className="coach-card-head">
                <div><span>HỌC VIÊN</span><h2>Tiến độ gần đây</h2></div>
                <button type="button" onClick={() => selectNavigation('Học viên')}>Quản lý học viên <ChevronRight size={16} /></button>
              </div>
              <div className="coach-student-list">
                {students.map((student) => (
                  <article key={student.name}>
                    <span className={`coach-student-avatar ${student.color}`}>{student.initials}</span>
                    <div className="coach-student-name"><strong>{student.name}</strong><small>{student.program}</small></div>
                    <div className="coach-student-progress"><span><i style={{ width: `${student.progress}%` }} /></span><small>{student.progress}% hoàn thành</small></div>
                    <b>{student.sessions}</b>
                    <button type="button" aria-label={`Xem học viên ${student.name}`} onClick={() => showNotice(`Đã chọn hồ sơ ${student.name}.`)}><ChevronRight size={17} /></button>
                  </article>
                ))}
              </div>
            </section>

            <aside className="coach-quick-column">
              <section className="coach-card coach-quick-actions">
                <div className="coach-card-head"><div><span>TRUY CẬP NHANH</span><h2>Thao tác thường dùng</h2></div></div>
                <div>
                  <button type="button" onClick={() => showNotice('Đang mở phòng học trực tuyến.')}><span className="video"><Video size={20} /></span><span><strong>Phòng học trực tuyến</strong><small>Bắt đầu video call</small></span><ChevronRight size={17} /></button>
                  <button type="button" onClick={() => showNotice('Đang mở kho giáo án.')}><span className="plan"><ClipboardList size={20} /></span><span><strong>Kho giáo án</strong><small>12 giáo án đã lưu</small></span><ChevronRight size={17} /></button>
                  <button type="button" onClick={() => showNotice('Đang mở tin nhắn học viên.')}><span className="chat"><MessageSquare size={20} /></span><span><strong>Tin nhắn học viên</strong><small>3 tin nhắn chưa đọc</small></span><ChevronRight size={17} /></button>
                </div>
              </section>
              <section className="coach-rating-card">
                <span><Star size={21} fill="currentColor" /></span>
                <div><small>ĐÁNH GIÁ THÁNG NÀY</small><strong>4.9/5.0</strong><p>“Coach tận tâm, giáo án dễ hiểu và tiến bộ rõ rệt.”</p><b>— Nguyễn Thu Trang</b></div>
              </section>
            </aside>
          </div>
        </div>
      </section>
    </main>
  )
}
