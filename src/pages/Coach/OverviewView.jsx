import { ArrowUpRight, CalendarDays, ChevronRight, Clock3, MapPin, SearchX, TrendingUp, Users } from 'lucide-react'

const metricSlots = [
  { icon: CalendarDays, label: 'Buổi dạy hôm nay', tone: 'blue' },
  { icon: Users, label: 'Học viên đang theo', tone: 'green' },
  { icon: Clock3, label: 'Giờ huấn luyện', tone: 'purple' },
  { icon: TrendingUp, label: 'Tiến độ trung bình', tone: 'amber' },
]

function EmptyState({ title = 'Chưa có dữ liệu', text }) {
  return <div className="coach-empty"><SearchX size={28} /><strong>{title}</strong><p>{text}</p></div>
}

function SessionRow({ session }) {
  const tone = session.tone || 'next'
  return <article className={`coach-session ${tone}`}>
    <div className="coach-session-time"><strong>{session.time || '--:--'}</strong><small>{session.duration || '--'}</small></div><i />
    <div className="coach-session-info"><strong>{session.studentName || session.student || 'Chưa có tên học viên'}</strong><span>{session.program || 'Chưa có chương trình'}</span><small><MapPin size={13} /> {session.court || 'Chưa xếp sân'}</small></div>
    <span className={`coach-status ${tone}`}>{session.status || 'Chưa xác định'}</span>
  </article>
}

export function OverviewView({ onNavigate, metrics = [], sessions = [], students = [] }) {
  return <>
    <section className="coach-metrics" aria-label="Thống kê huấn luyện">
      {metricSlots.map(({ icon: Icon, label, tone }, index) => {
        const metric = metrics[index]
        return <article key={label}>
          <span className={`coach-metric-icon ${tone}`}><Icon size={20} /></span>
          <div><small>{label}</small><strong>{metric?.value ?? '--'}</strong><p>{metric?.note ?? 'Chờ dữ liệu từ API'}</p></div><ArrowUpRight size={17} />
        </article>
      })}
    </section>

    <div className="coach-primary-grid coach-api-grid">
      <section className="coach-card coach-schedule">
        <div className="coach-card-head"><div><span>LỊCH TRÌNH</span><h2>Lịch huấn luyện hôm nay</h2></div><button type="button" onClick={() => onNavigate('Lịch huấn luyện')}>Xem lịch <ChevronRight size={16} /></button></div>
        {sessions.length ? <div className="coach-session-list">{sessions.map(session => <SessionRow key={session.id} session={session} />)}</div> : <EmptyState text="Các buổi huấn luyện sẽ xuất hiện ở đây sau khi API trả dữ liệu." />}
      </section>

      <section className="coach-card coach-students">
        <div className="coach-card-head"><div><span>HỌC VIÊN</span><h2>Tiến độ học viên</h2></div><button type="button" onClick={() => onNavigate('Học viên')}>Xem học viên <ChevronRight size={16} /></button></div>
        {students.length ? <div className="coach-student-list">{students.map(student => <article key={student.id}>
          <span className={`coach-student-avatar ${student.color || 'blue'}`}>{student.initials || 'HV'}</span>
          <div className="coach-student-name"><strong>{student.name}</strong><small>{student.program || 'Chưa có chương trình'}</small></div>
          <div className="coach-student-progress"><span><i style={{ width: `${student.progress || 0}%` }} /></span><small>{student.progress || 0}% hoàn thành</small></div>
          <b>{student.completedSessions || 0}/{student.totalSessions || 0} buổi</b>
        </article>)}</div> : <EmptyState text="Danh sách tiến độ sẽ xuất hiện ở đây sau khi API trả dữ liệu." />}
      </section>
    </div>
  </>
}

