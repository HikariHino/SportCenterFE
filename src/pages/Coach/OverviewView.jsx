import { useEffect, useState } from 'react'
import { ArrowUpRight, CalendarDays, ChevronRight, Clock3, MapPin, RefreshCw, SearchX, TrendingUp, Users } from 'lucide-react'
import { getCoachSessionRoster, getMyCoachSessions } from '../../services/coachService'
import { initials, timeFormatter } from './CoachViewShared'

const metricSlots = [
  { icon: CalendarDays, label: 'Buổi dạy hôm nay', tone: 'blue' },
  { icon: Users, label: 'Học viên hôm nay', tone: 'green' },
  { icon: Clock3, label: 'Giờ huấn luyện', tone: 'purple' },
  { icon: TrendingUp, label: 'Buổi đã hoàn thành', tone: 'amber' },
]

function EmptyState({ title = 'Chưa có dữ liệu', text }) {
  return <div className="coach-empty"><SearchX size={28} /><strong>{title}</strong><p>{text}</p></div>
}

function SessionRow({ session }) {
  return <article className={`coach-session ${session.tone}`}>
    <div className="coach-session-time"><strong>{session.time}</strong><small>{session.duration}</small></div><i />
    <div className="coach-session-info"><strong>{session.className}</strong><span>{session.enrollment} học viên đăng ký</span><small><MapPin size={13} /> {session.coachName || 'Lịch của tôi'}</small></div>
    <span className={`coach-status ${session.tone}`}>{session.statusLabel}</span>
  </article>
}

const sessionPresentation = session => {
  const startsAt = new Date(session.startsAt)
  const endsAt = new Date(session.endsAt)
  const rawStatus = String(session.status || '').toLowerCase()
  const durationMinutes = Math.max(0, Math.round((endsAt - startsAt) / 60_000))
  let statusLabel = 'Sắp tới'
  let tone = 'next'
  if (rawStatus === 'completed') {
    statusLabel = 'Đã hoàn thành'
    tone = 'done'
  } else if (rawStatus === 'cancelled' || rawStatus === 'canceled') {
    statusLabel = 'Đã hủy'
    tone = 'cancelled'
  } else if (startsAt <= new Date() && endsAt > new Date()) {
    statusLabel = 'Đang diễn ra'
    tone = 'live'
  }
  return {
    ...session,
    time: timeFormatter.format(startsAt),
    duration: `${durationMinutes} phút`,
    enrollment: Number(session.currentEnrollment || 0),
    statusLabel,
    tone,
  }
}

export function OverviewView({ onNavigate }) {
  const [metrics, setMetrics] = useState([])
  const [sessions, setSessions] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)

  useEffect(() => {
    let active = true
    const loadOverview = async () => {
      setLoading(true)
      setError('')
      const from = new Date()
      from.setHours(0, 0, 0, 0)
      const to = new Date(from)
      to.setDate(to.getDate() + 1)
      try {
        const result = await getMyCoachSessions({ from: from.toISOString(), to: to.toISOString(), pageSize: 50 })
        const todaySessions = result.items.map(sessionPresentation).sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt))
        const rosterResults = await Promise.allSettled(todaySessions.map(session => getCoachSessionRoster(session.id)))
        const studentMap = new Map()
        rosterResults.forEach((rosterResult, index) => {
          if (rosterResult.status !== 'fulfilled') return
          rosterResult.value.forEach(student => {
            const key = student.memberId
            const current = studentMap.get(key) || {
              id: key,
              name: student.fullName || `Hội viên #${key}`,
              initials: initials(student.fullName),
              program: todaySessions[index]?.className || 'Buổi huấn luyện hôm nay',
              completedSessions: 0,
              totalSessions: 0,
              color: 'blue',
            }
            current.totalSessions += 1
            if (['present', 'late'].includes(String(student.attendanceStatus || '').toLowerCase())) current.completedSessions += 1
            studentMap.set(key, current)
          })
        })
        const studentItems = [...studentMap.values()].map(student => ({ ...student, progress: student.totalSessions ? Math.round(student.completedSessions / student.totalSessions * 100) : 0 }))
        const totalMinutes = todaySessions.reduce((total, session) => total + Math.max(0, new Date(session.endsAt) - new Date(session.startsAt)) / 60_000, 0)
        const completedCount = todaySessions.filter(session => String(session.status).toLowerCase() === 'completed').length
        if (active) {
          setSessions(todaySessions)
          setStudents(studentItems)
          setMetrics([
            { value: todaySessions.length, note: todaySessions.length ? 'Theo lịch được phân công' : 'Hôm nay chưa có lịch' },
            { value: studentItems.length, note: 'Không tính trùng hội viên' },
            { value: `${(totalMinutes / 60).toFixed(totalMinutes % 60 ? 1 : 0)}h`, note: 'Tổng thời lượng hôm nay' },
            { value: todaySessions.length ? `${Math.round(completedCount / todaySessions.length * 100)}%` : '0%', note: `${completedCount}/${todaySessions.length} buổi` },
          ])
        }
      } catch (requestError) {
        if (active) {
          setSessions([])
          setStudents([])
          setMetrics([])
          setError(requestError.response?.data?.message || requestError.message || 'Không thể tải tổng quan Coach.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadOverview()
    return () => { active = false }
  }, [requestKey])

  return <>
    {error && <div className="coach-attendance-error" role="alert">{error}<button className="coach-retry-button" type="button" onClick={() => setRequestKey(key => key + 1)}><RefreshCw size={13} />Thử lại</button></div>}
    <section className="coach-metrics" aria-label="Thống kê huấn luyện">
      {metricSlots.map(({ icon: Icon, label, tone }, index) => {
        const metric = metrics[index]
        return <article key={label}><span className={`coach-metric-icon ${tone}`}><Icon size={20} /></span><div><small>{label}</small><strong>{loading ? '--' : metric?.value ?? 0}</strong><p>{loading ? 'Đang đồng bộ...' : metric?.note ?? 'Không có dữ liệu'}</p></div><ArrowUpRight size={17} /></article>
      })}
    </section>
    <div className="coach-primary-grid coach-api-grid">
      <section className="coach-card coach-schedule">
        <div className="coach-card-head"><div><span>LỊCH TRÌNH</span><h2>Lịch huấn luyện hôm nay</h2></div><button type="button" onClick={() => onNavigate('Lịch huấn luyện')}>Xem lịch <ChevronRight size={16} /></button></div>
        {loading ? <EmptyState title="Đang tải lịch huấn luyện" text="Dữ liệu đang được đồng bộ từ Coach API." /> : sessions.length ? <div className="coach-session-list">{sessions.map(session => <SessionRow key={session.id} session={session} />)}</div> : <EmptyState title="Hôm nay chưa có lịch" text="Không có buổi huấn luyện được phân công trong hôm nay." />}
      </section>
      <section className="coach-card coach-students">
        <div className="coach-card-head"><div><span>HỌC VIÊN</span><h2>Học viên trong lịch hôm nay</h2></div><button type="button" onClick={() => onNavigate('Học viên')}>Xem học viên <ChevronRight size={16} /></button></div>
        {loading ? <EmptyState title="Đang tải học viên" text="Danh sách đang được tổng hợp theo từng buổi." /> : students.length ? <div className="coach-student-list">{students.map(student => <article key={student.id}><span className={`coach-student-avatar ${student.color}`}>{student.initials}</span><div className="coach-student-name"><strong>{student.name}</strong><small>{student.program}</small></div><div className="coach-student-progress"><span><i style={{ width: `${student.progress}%` }} /></span><small>{student.progress}% điểm danh</small></div><b>{student.completedSessions}/{student.totalSessions} buổi</b></article>)}</div> : <EmptyState title="Hôm nay chưa có học viên" text="Các buổi hôm nay chưa có hội viên đăng ký." />}
      </section>
    </div>
  </>
}
