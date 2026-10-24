import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  Clock3,
  DoorOpen,
  Dumbbell,
  RefreshCw,
  SearchX,
  UserCheck,
  Users,
} from 'lucide-react'
import { getCoachSessionRoster, getMyCoachSessions } from '../../services/coachService'
import { initials, timeFormatter, ViewLoader } from './CoachViewShared'

const metricSlots = [
  { icon: CalendarDays, label: 'Buổi dạy hôm nay', tone: 'blue', target: 'Lịch huấn luyện' },
  { icon: Users, label: 'Học viên hôm nay', tone: 'green', target: 'Học viên' },
  { icon: Clock3, label: 'Giờ huấn luyện', tone: 'purple', target: 'Lịch huấn luyện' },
  { icon: CheckCircle2, label: 'Buổi đã hoàn thành', tone: 'amber', target: 'Lịch huấn luyện' },
]

const weekDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
})

const longDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
})

const percentage = (value, total) => total ? Math.min(100, Math.round(value / total * 100)) : 0
const sameDay = (left, right) => left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate()

function EmptyState({ title = 'Chưa có dữ liệu', text, actionLabel, onAction }) {
  return <div className="coach-empty coach-overview-empty">
    <SearchX size={28} />
    <strong>{title}</strong>
    <p>{text}</p>
    {actionLabel && <button type="button" onClick={onAction}>{actionLabel}<ChevronRight size={14} /></button>}
  </div>
}

function SessionRow({ session }) {
  return <article className={`coach-session ${session.tone}`}>
    <div className="coach-session-time"><strong>{session.time}</strong><small>{session.duration}</small></div><i />
    <div className="coach-session-info"><strong>{session.className}</strong><span>{session.enrollment}/{session.capacity || '--'} học viên</span><small><Dumbbell size={13} /> {session.coachName || 'Lịch huấn luyện của tôi'}</small></div>
    <span className={`coach-status ${session.tone}`}>{session.statusLabel}</span>
  </article>
}

function WeekSessionRow({ session }) {
  const start = new Date(session.startsAt)
  return <article className="coach-week-session">
    <time dateTime={session.startsAt}><strong>{start.getDate()}</strong><small>Tháng {start.getMonth() + 1}</small></time>
    <div><strong>{session.className}</strong><span>{weekDateFormatter.format(start)} · {session.time} · {session.duration}</span></div>
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
    capacity: Number(session.capacity || 0),
    statusLabel,
    tone,
  }
}

export function OverviewView({ onNavigate }) {
  const [metrics, setMetrics] = useState([])
  const [sessions, setSessions] = useState([])
  const [weekSessions, setWeekSessions] = useState([])
  const [students, setStudents] = useState([])
  const [attendance, setAttendance] = useState({ present: 0, absent: 0, excused: 0, pending: 0 })
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
      to.setDate(to.getDate() + 8)
      try {
        const result = await getMyCoachSessions({ from: from.toISOString(), to: to.toISOString(), pageSize: 100 })
        const upcomingWeek = result.items.map(sessionPresentation).sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt))
        const today = upcomingWeek.filter(session => sameDay(new Date(session.startsAt), from))
        const rosterResults = await Promise.allSettled(today.map(session => getCoachSessionRoster(session.id)))
        const studentMap = new Map()
        const attendanceSummary = { present: 0, absent: 0, excused: 0, pending: 0 }

        rosterResults.forEach((rosterResult, index) => {
          if (rosterResult.status !== 'fulfilled') return
          rosterResult.value.forEach(student => {
            const key = student.memberId
            const attendanceStatus = String(student.attendanceStatus || '').toLowerCase()
            if (attendanceStatus === 'present' || attendanceStatus === 'late') attendanceSummary.present += 1
            else if (attendanceStatus === 'absent') attendanceSummary.absent += 1
            else if (attendanceStatus === 'excused') attendanceSummary.excused += 1
            else attendanceSummary.pending += 1

            const current = studentMap.get(key) || {
              id: key,
              name: student.fullName || `Hội viên #${key}`,
              initials: initials(student.fullName),
              program: today[index]?.className || 'Buổi huấn luyện hôm nay',
              completedSessions: 0,
              totalSessions: 0,
              color: 'blue',
            }
            current.totalSessions += 1
            if (['present', 'late'].includes(attendanceStatus)) current.completedSessions += 1
            studentMap.set(key, current)
          })
        })

        const studentItems = [...studentMap.values()].map(student => ({
          ...student,
          progress: percentage(student.completedSessions, student.totalSessions),
        }))
        const totalMinutes = today.reduce((total, session) => total + Math.max(0, new Date(session.endsAt) - new Date(session.startsAt)) / 60_000, 0)
        const completedCount = today.filter(session => String(session.status).toLowerCase() === 'completed').length

        if (active) {
          setSessions(today)
          setWeekSessions(upcomingWeek)
          setStudents(studentItems)
          setAttendance(attendanceSummary)
          setMetrics([
            { value: today.length, note: today.length ? 'Theo lịch được phân công' : 'Hôm nay chưa có lịch' },
            { value: studentItems.length, note: 'Không tính trùng hội viên' },
            { value: `${(totalMinutes / 60).toFixed(totalMinutes % 60 ? 1 : 0)}h`, note: 'Tổng thời lượng hôm nay' },
            { value: today.length ? `${percentage(completedCount, today.length)}%` : '0%', note: `${completedCount}/${today.length} buổi` },
          ])
        }
      } catch (requestError) {
        if (active) {
          setSessions([])
          setWeekSessions([])
          setStudents([])
          setAttendance({ present: 0, absent: 0, excused: 0, pending: 0 })
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

  const nextSession = useMemo(() => {
    const now = new Date()
    return weekSessions.find(session => session.tone !== 'cancelled' && new Date(session.endsAt) >= now)
  }, [weekSessions])
  const completedSessions = sessions.filter(session => session.tone === 'done').length
  const dayProgress = percentage(completedSessions, sessions.length)
  const attendanceTotal = attendance.present + attendance.absent + attendance.excused + attendance.pending
  const nextSessionIsToday = nextSession && sameDay(new Date(nextSession.startsAt), new Date())
  const primaryAction = attendance.pending > 0 && nextSessionIsToday
    ? { label: 'Điểm danh ngay', target: 'Điểm danh', icon: UserCheck }
    : { label: 'Mở lịch huấn luyện', target: 'Lịch huấn luyện', icon: CalendarRange }
  const PrimaryActionIcon = primaryAction.icon

  if (loading) return <ViewLoader />

  return <>
    {error && <div className="coach-attendance-error" role="alert">{error}<button className="coach-retry-button" type="button" onClick={() => setRequestKey(key => key + 1)}><RefreshCw size={13} />Thử lại</button></div>}

    <section className="coach-focus-panel" aria-label="Công việc ưu tiên">
      <div className="coach-focus-main">
        <span className="coach-focus-icon"><CalendarCheck2 size={22} /></span>
        <div>
          <small>{nextSessionIsToday ? 'BUỔI GẦN NHẤT HÔM NAY' : 'KẾ HOẠCH GẦN NHẤT'}</small>
          <strong>{nextSession ? nextSession.className : 'Chưa có buổi huấn luyện sắp tới'}</strong>
          <p>{nextSession ? `${longDateFormatter.format(new Date(nextSession.startsAt))} · ${nextSession.time} · ${nextSession.enrollment}/${nextSession.capacity || '--'} học viên` : 'Kiểm tra lịch để xem các buổi đã được phân công.'}</p>
        </div>
        <button type="button" onClick={() => onNavigate(primaryAction.target)}><PrimaryActionIcon size={17} />{primaryAction.label}<ChevronRight size={15} /></button>
      </div>
      <div className="coach-focus-shortcuts">
        <button type="button" onClick={() => onNavigate('Điểm danh')}><span className={attendance.pending ? 'attention' : 'done'}><UserCheck size={18} /></span><span><strong>{attendance.pending}</strong><small>Chờ điểm danh</small></span><ChevronRight size={15} /></button>
        <button type="button" onClick={() => onNavigate('Học viên')}><span><Users size={18} /></span><span><strong>{students.length}</strong><small>Học viên hôm nay</small></span><ChevronRight size={15} /></button>
        <button type="button" onClick={() => onNavigate('Phòng tập')}><span><DoorOpen size={18} /></span><span><strong>Kiểm tra</strong><small>Phòng tập</small></span><ChevronRight size={15} /></button>
      </div>
    </section>

    <section className="coach-metrics" aria-label="Thống kê huấn luyện">
      {metricSlots.map(({ icon: Icon, label, tone, target }, index) => {
        const metric = metrics[index]
        return <button type="button" key={label} className="coach-metric-card" onClick={() => onNavigate(target)} aria-label={`${label}: ${metric?.value ?? 0}. Mở ${target}`}><span className={`coach-metric-icon ${tone}`}><Icon size={20} /></span><span><small>{label}</small><strong>{metric?.value ?? 0}</strong><p>{metric?.note ?? 'Không có dữ liệu'}</p></span><ArrowUpRight size={17} /></button>
      })}
    </section>

    <div className="coach-overview-workspace">
      <section className="coach-card coach-schedule">
        <div className="coach-card-head"><div><span>ƯU TIÊN HÔM NAY</span><h2>Lịch huấn luyện hôm nay</h2></div><button type="button" onClick={() => onNavigate('Lịch huấn luyện')}>Xem toàn bộ lịch <ChevronRight size={16} /></button></div>
        {sessions.length ? <div className="coach-session-list">{sessions.map(session => <SessionRow key={session.id} session={session} />)}</div> : <EmptyState title="Hôm nay chưa có lịch" text="Bạn có thể kiểm tra các ngày khác trong lịch huấn luyện." actionLabel="Mở lịch huấn luyện" onAction={() => onNavigate('Lịch huấn luyện')} />}
      </section>
      <section className="coach-card coach-day-progress-card">
        <div className="coach-card-head"><div><span>TIẾN ĐỘ HÔM NAY</span><h2>Tình hình hoạt động</h2></div><UserCheck size={21} /></div>
        <div className="coach-day-progress-body">
          <div className="coach-progress-ring" style={{ '--coach-progress': `${dayProgress * 3.6}deg` }}><div><strong>{dayProgress}%</strong><span>hoàn thành</span></div></div>
          <div className="coach-progress-copy"><strong>{completedSessions}/{sessions.length} buổi đã hoàn thành</strong><p>{sessions.length ? `Có ${sessions.length - completedSessions} buổi cần theo dõi trong hôm nay.` : 'Hôm nay chưa có buổi huấn luyện.'}</p></div>
        </div>
        <div className="coach-attendance-breakdown" aria-label="Tình hình điểm danh">
          <span className="present"><i />Có mặt <strong>{attendance.present}</strong></span>
          <span className="absent"><i />Vắng <strong>{attendance.absent}</strong></span>
          <span className="excused"><i />Có phép <strong>{attendance.excused}</strong></span>
          <span className="pending"><i />Chưa ghi nhận <strong>{attendance.pending}</strong></span>
        </div>
        <footer>{attendanceTotal ? `${attendanceTotal} lượt học viên trong lịch hôm nay` : 'Chưa có dữ liệu điểm danh hôm nay'}</footer>
      </section>
    </div>

    <div className="coach-overview-secondary">
      <section className="coach-card coach-students">
        <div className="coach-card-head"><div><span>HỌC VIÊN</span><h2>Học viên trong lịch hôm nay</h2></div><button type="button" onClick={() => onNavigate('Học viên')}>Xem học viên <ChevronRight size={16} /></button></div>
        {students.length ? <div className="coach-student-list">{students.map(student => <article key={student.id}><span className={`coach-student-avatar ${student.color}`}>{student.initials}</span><div className="coach-student-name"><strong>{student.name}</strong><small>{student.program}</small></div><div className="coach-student-progress"><span><i style={{ width: `${student.progress}%` }} /></span><small>{student.progress}% điểm danh</small></div><b>{student.completedSessions}/{student.totalSessions} buổi</b></article>)}</div> : <EmptyState title="Hôm nay chưa có học viên" text="Danh sách sẽ cập nhật khi lịch hôm nay có hội viên đăng ký." actionLabel="Xem danh sách học viên" onAction={() => onNavigate('Học viên')} />}
      </section>
      <section className="coach-card coach-week-card">
        <div className="coach-card-head"><div><span>7 NGÀY TỚI</span><h2>Lịch huấn luyện sắp tới</h2></div><strong>{weekSessions.length} buổi</strong></div>
        {weekSessions.length ? <div className="coach-week-list">{weekSessions.slice(0, 5).map(session => <WeekSessionRow key={session.id} session={session} />)}</div> : <EmptyState title="Tuần này chưa có lịch" text="Các buổi mới được phân công sẽ xuất hiện tại đây." />}
        {weekSessions.length > 5 && <button className="coach-week-more" type="button" onClick={() => onNavigate('Lịch huấn luyện')}>Xem thêm {weekSessions.length - 5} buổi <ChevronRight size={15} /></button>}
      </section>
    </div>
  </>
}
