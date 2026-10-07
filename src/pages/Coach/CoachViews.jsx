import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  Clock3, MapPin, SearchX, TrendingUp, UserCheck, UserRound, Users,
} from 'lucide-react'
import { getCoachSessionRoster, getMyCoachSessions } from '../../services/coachService'

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

const toDateKey = date => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getWeekDays = offset => {
  const today = new Date()
  const monday = new Date(today)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + offset * 7)
  const labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
  return labels.map((weekday, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return { key: toDateKey(date), weekday, date: String(date.getDate()).padStart(2, '0'), month: String(date.getMonth() + 1).padStart(2, '0'), today: toDateKey(date) === toDateKey(today) }
  })
}

const timeFormatter = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const mapSession = session => {
  const startsAt = new Date(session.startsAt)
  const endsAt = new Date(session.endsAt)
  const now = new Date()
  const rawStatus = String(session.status || '').toLowerCase()
  let status = 'Sắp tới'
  let tone = 'next'

  if (rawStatus === 'cancelled' || rawStatus === 'canceled') {
    status = 'Đã hủy'
    tone = 'cancelled'
  } else if (rawStatus === 'completed') {
    status = 'Đã hoàn thành'
    tone = 'done'
  } else if (startsAt <= now && endsAt > now) {
    status = 'Đang diễn ra'
    tone = 'live'
  } else if (endsAt <= now) {
    status = 'Đã kết thúc'
    tone = 'done'
  }

  const durationMinutes = Math.max(0, Math.round((endsAt - startsAt) / 60000))
  const currentEnrollment = Number(session.currentEnrollment || 0)
  const capacity = Number(session.capacity || 0)

  return {
    id: session.id,
    date: toDateKey(startsAt),
    time: timeFormatter.format(startsAt),
    endTime: timeFormatter.format(endsAt),
    durationMinutes,
    studentName: session.className || 'Buổi huấn luyện',
    program: `${currentEnrollment}/${capacity} học viên đã đăng ký`,
    type: session.coachName || 'Huấn luyện viên',
    status,
    tone,
    currentEnrollment,
    capacity,
    availableSeats: Number(session.availableSeats || 0),
  }
}

const getScheduleError = error => error.response?.data?.message || error.message || 'Không thể kết nối tới Coach API.'

export function ScheduleView() {
  const [weekOffset, setWeekOffset] = useState(0)
  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset])
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()))
  const [filter, setFilter] = useState('Tất cả')
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)
  const selectedDay = weekDays.find(day => day.key === selectedDate) || weekDays[0]
  const daySessions = sessions.filter(item => item.date === selectedDate && (filter === 'Tất cả' || item.status === filter))
  const allDaySessions = sessions.filter(item => item.date === selectedDate)
  const totalMinutes = allDaySessions.reduce((total, item) => total + Number(item.durationMinutes || 0), 0)
  const enrollmentCount = allDaySessions.reduce((total, item) => total + Number(item.currentEnrollment || 0), 0)

  useEffect(() => {
    let active = true
    const firstDay = new Date(`${weekDays[0].key}T00:00:00`)
    const nextWeek = new Date(firstDay)
    nextWeek.setDate(firstDay.getDate() + 7)

    const loadSchedule = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getMyCoachSessions({
          from: firstDay.toISOString(),
          to: nextWeek.toISOString(),
        })
        if (active) setSessions(result.items.map(mapSession))
      } catch (requestError) {
        if (active) {
          setSessions([])
          setError(getScheduleError(requestError))
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadSchedule()
    return () => { active = false }
  }, [requestKey, weekDays])

  const changeWeek = direction => {
    const nextOffset = weekOffset + direction
    const nextWeek = getWeekDays(nextOffset)
    setWeekOffset(nextOffset)
    setSelectedDate(nextWeek[0].key)
  }

  return <div className="coach-section-view">
    <section className="coach-calendar-strip coach-card">
      <button type="button" aria-label="Tuần trước" onClick={() => changeWeek(-1)}><ChevronLeft size={18} /></button>
      <div>{weekDays.map(day => <button type="button" key={day.key} className={selectedDate === day.key ? 'active' : ''} onClick={() => setSelectedDate(day.key)}><span>{day.weekday}</span><strong>{day.date}</strong>{day.today && <i>Hôm nay</i>}</button>)}</div>
      <button type="button" aria-label="Tuần sau" onClick={() => changeWeek(1)}><ChevronRight size={18} /></button>
    </section>

    <div className="coach-schedule-layout">
      <section className="coach-card coach-agenda">
        <div className="coach-view-toolbar"><div><strong>Lịch ngày {selectedDay.date}/{selectedDay.month}</strong><span>{loading ? 'Đang tải lịch...' : `${allDaySessions.length} buổi huấn luyện`}</span></div><div className="coach-filter-pills">{['Tất cả', 'Đã hoàn thành', 'Đang diễn ra', 'Sắp tới', 'Đã hủy'].map(label => <button type="button" key={label} className={filter === label ? 'active' : ''} onClick={() => setFilter(label)}>{label}</button>)}</div></div>
        {loading ? <EmptyState title="Đang tải lịch huấn luyện" text="Dữ liệu đang được đồng bộ từ Coach API." /> : error ? <EmptyState title="Không thể tải lịch" text={error} /> : daySessions.length ? <div className="coach-agenda-list">{daySessions.map(session => <article key={session.id} className={session.tone || 'next'}>
          <div className="coach-agenda-time"><strong>{session.time || '--:--'}</strong><span>{session.endTime || '--:--'}</span></div><div className="coach-agenda-line"><i /></div>
          <div className="coach-agenda-body"><div><span className={`coach-status ${session.tone || 'next'}`}>{session.status || 'Chưa xác định'}</span><small>{session.type || ''}</small></div><h3>{session.studentName || session.student}</h3><p>{session.program || 'Chưa có chương trình'}</p><footer><span><Users size={14} />Còn {session.availableSeats} chỗ</span><span><Clock3 size={14} />{session.durationMinutes || 0} phút</span></footer></div>
        </article>)}</div> : <EmptyState title="Chưa có lịch huấn luyện" text="Coach API chưa trả về buổi huấn luyện nào trong ngày này." />}
      </section>

      <aside className="coach-day-summary">
        <section className="coach-card"><div className="coach-summary-title"><CalendarDays size={20} /><div><small>TỔNG QUAN NGÀY</small><strong>{selectedDay.date}/{selectedDay.month}/{selectedDate.slice(0, 4)}</strong></div></div><div className="coach-summary-stats"><div><strong>{allDaySessions.length}</strong><span>Buổi tập</span></div><div><strong>{totalMinutes ? `${(totalMinutes / 60).toFixed(totalMinutes % 60 ? 1 : 0)}h` : '0h'}</strong><span>Thời lượng</span></div><div><strong>{enrollmentCount}</strong><span>Lượt đăng ký</span></div></div></section>
        <section className={`coach-card coach-api-note${error ? ' error' : ''}`}><CheckCircle2 size={22} /><strong>{loading ? 'Đang đồng bộ lịch' : error ? 'Mất kết nối Coach API' : 'Đã kết nối Coach API'}</strong><p>{error || 'Lịch được tải trực tiếp từ tài khoản huấn luyện viên đang đăng nhập.'}</p>{error && <button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button>}</section>
      </aside>
    </div>
  </div>
}

const sessionDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const checkInFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const initials = name => String(name || 'Học viên').split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toLocaleUpperCase('vi-VN')

const registrationLabel = status => ({
  registered: 'Đã đăng ký',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}[String(status || '').toLowerCase()] || status || 'Chưa xác định')

const attendanceLabel = status => ({
  present: 'Đã điểm danh',
  late: 'Đi trễ',
  absent: 'Vắng mặt',
}[String(status || '').toLowerCase()] || 'Chưa điểm danh')

const attendanceTone = status => ({
  present: 'present',
  late: 'late',
  absent: 'absent',
}[String(status || '').toLowerCase()] || 'pending')

const mapRosterStudent = student => ({
  id: student.registrationId,
  registrationId: student.registrationId,
  memberId: student.memberId,
  name: student.fullName || 'Học viên chưa cập nhật tên',
  registrationStatus: registrationLabel(student.registrationStatus),
  attendanceStatus: attendanceLabel(student.attendanceStatus),
  attendanceTone: attendanceTone(student.attendanceStatus),
  checkInTime: student.checkInTime ? checkInFormatter.format(new Date(student.checkInTime)) : 'Chưa check-in',
})

const formatSessionOption = session => {
  const start = new Date(session.startsAt)
  const end = new Date(session.endsAt)
  return `${session.className} · ${sessionDateFormatter.format(start)} · ${timeFormatter.format(start)}–${timeFormatter.format(end)}`
}

const getStudentsError = error => error.response?.data?.message || error.message || 'Không thể kết nối tới API học viên theo buổi.'

export function StudentsView({ query }) {
  const [status, setStatus] = useState('Tất cả')
  const [sessions, setSessions] = useState([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [students, setStudents] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [rosterLoading, setRosterLoading] = useState(false)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)

  useEffect(() => {
    let active = true
    const loadSessions = async () => {
      setSessionsLoading(true)
      setError('')
      try {
        const result = await getMyCoachSessions({ pageSize: 100 })
        if (!active) return
        setSessions(result.items)
        setSelectedSessionId(current => {
          if (current && result.items.some(session => String(session.id) === String(current))) return current
          const upcoming = result.items.find(session => new Date(session.endsAt) >= new Date())
          return String(upcoming?.id ?? result.items[0]?.id ?? '')
        })
      } catch (requestError) {
        if (active) {
          setSessions([])
          setSelectedSessionId('')
          setError(getStudentsError(requestError))
        }
      } finally {
        if (active) setSessionsLoading(false)
      }
    }
    loadSessions()
    return () => { active = false }
  }, [requestKey])

  useEffect(() => {
    let active = true
    if (!selectedSessionId) {
      setStudents([])
      setSelectedId(null)
      setRosterLoading(false)
      return () => { active = false }
    }

    const loadRoster = async () => {
      setRosterLoading(true)
      setError('')
      try {
        const result = await getCoachSessionRoster(selectedSessionId)
        if (!active) return
        const mapped = result.map(mapRosterStudent)
        setStudents(mapped)
        setSelectedId(current => mapped.some(student => student.id === current) ? current : mapped[0]?.id ?? null)
      } catch (requestError) {
        if (active) {
          setStudents([])
          setSelectedId(null)
          setError(getStudentsError(requestError))
        }
      } finally {
        if (active) setRosterLoading(false)
      }
    }
    loadRoster()
    return () => { active = false }
  }, [requestKey, selectedSessionId])

  const normalizedQuery = query.trim().toLocaleLowerCase('vi')
  const filtered = students.filter(student => {
    const matchesStatus = status === 'Tất cả' || student.attendanceStatus === status
    const matchesQuery = !normalizedQuery || `${student.name} ${student.memberId} ${student.registrationStatus} ${student.attendanceStatus}`.toLocaleLowerCase('vi').includes(normalizedQuery)
    return matchesStatus && matchesQuery
  })
  const selected = students.find(student => student.id === selectedId)
  const selectedSession = sessions.find(session => String(session.id) === String(selectedSessionId))
  const checkedInCount = students.filter(student => ['Đã điểm danh', 'Đi trễ'].includes(student.attendanceStatus)).length
  const absentCount = students.filter(student => student.attendanceStatus === 'Vắng mặt').length

  if (sessionsLoading) return <section className="coach-card coach-roster-state"><EmptyState title="Đang tải các buổi huấn luyện" text="Coach API đang đồng bộ danh sách buổi học." /></section>
  if (!sessions.length) return <section className="coach-card coach-roster-state"><EmptyState title={error ? 'Không thể tải buổi huấn luyện' : 'Chưa có buổi huấn luyện'} text={error || 'Huấn luyện viên chưa được phân công buổi học nào, nên chưa có danh sách học viên để hiển thị.'} />{error && <button className="coach-retry-button" type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button>}</section>

  return <div className="coach-section-view">
    <section className="coach-card coach-session-picker">
      <div className="coach-session-picker-main"><span><CalendarDays size={21} /></span><div><small>BUỔI ĐANG XEM</small><strong>{selectedSession?.className || 'Buổi huấn luyện'}</strong><p>{selectedSession ? formatSessionOption(selectedSession) : 'Chọn một buổi để xem học viên'}</p></div></div>
      <label><span>Chọn buổi huấn luyện</span><select value={selectedSessionId} onChange={event => { setSelectedSessionId(event.target.value); setStatus('Tất cả') }}>{sessions.map(session => <option key={session.id} value={session.id}>{formatSessionOption(session)}</option>)}</select></label>
    </section>

    <section className="coach-student-kpis">
      <article><span className="blue"><Users size={21} /></span><div><small>Học viên trong buổi</small><strong>{students.length}</strong><p>Dữ liệu trực tiếp từ roster</p></div></article>
      <article><span className="green"><UserCheck size={21} /></span><div><small>Đã điểm danh</small><strong>{checkedInCount}</strong><p>Bao gồm đúng giờ và đi trễ</p></div></article>
      <article><span className="purple"><UserRound size={21} /></span><div><small>Vắng mặt</small><strong>{absentCount}</strong><p>Theo trạng thái chuyên cần</p></div></article>
    </section>

    <div className="coach-student-layout">
      <section className="coach-card coach-roster">
        <div className="coach-view-toolbar"><div><strong>Danh sách học viên theo buổi</strong><span>{rosterLoading ? 'Đang tải roster...' : `${filtered.length} kết quả`}</span></div><div className="coach-filter-pills">{['Tất cả', 'Đã điểm danh', 'Chưa điểm danh', 'Vắng mặt'].map(label => <button type="button" key={label} className={status === label ? 'active' : ''} onClick={() => setStatus(label)}>{label}</button>)}</div></div>
        {rosterLoading ? <EmptyState title="Đang tải học viên" text="Danh sách đăng ký của buổi học đang được đồng bộ." /> : error ? <div className="coach-inline-error"><EmptyState title="Không thể tải học viên" text={error} /><button className="coach-retry-button" type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : filtered.length ? <div className="coach-roster-table"><div className="coach-roster-heading"><span>Học viên</span><span>Đăng ký</span><span>Điểm danh</span><span>Giờ check-in</span></div>{filtered.map(student => <button type="button" className={selected?.id === student.id ? 'selected' : ''} key={student.id} onClick={() => setSelectedId(student.id)}>
          <span className="coach-roster-person"><i className="coach-student-avatar blue">{initials(student.name)}</i><span><strong>{student.name}</strong><small>Member #{student.memberId}</small></span></span>
          <span><strong>{student.registrationStatus}</strong><small>Đăng ký #{student.registrationId}</small></span>
          <span><strong className={`coach-attendance ${student.attendanceTone}`}>{student.attendanceStatus}</strong><small>{student.attendanceTone === 'pending' ? 'Chưa có dữ liệu điểm danh' : 'Đã cập nhật từ API'}</small></span>
          <span><strong>{student.checkInTime}</strong><small>Thời gian ghi nhận</small></span>
        </button>)}</div> : <EmptyState title="Chưa có học viên" text={query || status !== 'Tất cả' ? 'Không có học viên phù hợp với bộ lọc hiện tại.' : 'Buổi huấn luyện này chưa có hội viên đăng ký.'} />}
      </section>

      <aside className="coach-card coach-student-profile">
        {selected ? <><div className="coach-profile-cover"><span className="coach-student-avatar blue">{initials(selected.name)}</span></div><div className="coach-profile-main"><h2>{selected.name}</h2><p>{selectedSession?.className || 'Buổi huấn luyện'}</p><span className={`coach-profile-state ${selected.attendanceTone}`}><i />{selected.attendanceStatus}</span><div className="coach-profile-numbers"><div><strong>#{selected.memberId}</strong><small>Mã hội viên</small></div><div><strong>#{selected.registrationId}</strong><small>Mã đăng ký</small></div><div><strong>{selected.registrationStatus}</strong><small>Trạng thái</small></div></div><div className="coach-profile-info"><span><Clock3 size={16} /><span><small>Thời gian check-in</small><strong>{selected.checkInTime}</strong></span></span><span><CalendarDays size={16} /><span><small>Buổi huấn luyện</small><strong>{selectedSession ? formatSessionOption(selectedSession) : 'Chưa xác định'}</strong></span></span></div></div></> : <EmptyState title="Chưa chọn học viên" text={students.length ? 'Chọn một học viên trong danh sách để xem chi tiết.' : 'Buổi huấn luyện này chưa có hội viên đăng ký.'} />}
      </aside>
    </div>
  </div>
}
