import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  Clock3, MapPin, SearchX, Target, TrendingUp, Users,
} from 'lucide-react'
import { getMyCoachSessions } from '../../services/coachService'

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

export function StudentsView({ query, showNotice, students = [] }) {
  const [status, setStatus] = useState('Tất cả')
  const [selectedId, setSelectedId] = useState(null)
  const normalizedQuery = query.trim().toLocaleLowerCase('vi')
  const filtered = students.filter(student => (status === 'Tất cả' || student.status === status) && (!normalizedQuery || `${student.name || ''} ${student.program || ''} ${student.level || ''}`.toLocaleLowerCase('vi').includes(normalizedQuery)))
  const selected = students.find(student => student.id === selectedId)
  const activeCount = students.filter(student => student.status === 'Đang tập').length
  const averageProgress = students.length ? Math.round(students.reduce((sum, student) => sum + Number(student.progress || 0), 0) / students.length) : 0

  return <div className="coach-section-view">
    <section className="coach-student-kpis">
      <article><span className="blue"><Users size={21} /></span><div><small>Tổng học viên</small><strong>{students.length}</strong><p>Chờ đồng bộ từ API</p></div></article>
      <article><span className="green"><CheckCircle2 size={21} /></span><div><small>Đang tập luyện</small><strong>{activeCount}</strong><p>Chờ đồng bộ từ API</p></div></article>
      <article><span className="purple"><TrendingUp size={21} /></span><div><small>Tiến độ trung bình</small><strong>{averageProgress}%</strong><p>Chờ đồng bộ từ API</p></div></article>
    </section>

    <div className="coach-student-layout">
      <section className="coach-card coach-roster">
        <div className="coach-view-toolbar"><div><strong>Danh sách học viên</strong><span>{filtered.length} kết quả</span></div><div className="coach-filter-pills">{['Tất cả', 'Đang tập', 'Sắp hoàn thành', 'Tạm nghỉ'].map(label => <button type="button" key={label} className={status === label ? 'active' : ''} onClick={() => setStatus(label)}>{label}</button>)}</div></div>
        {filtered.length ? <div className="coach-roster-table"><div className="coach-roster-heading"><span>Học viên</span><span>Chương trình</span><span>Tiến độ</span><span>Buổi tiếp theo</span></div>{filtered.map(student => <button type="button" className={selected?.id === student.id ? 'selected' : ''} key={student.id} onClick={() => setSelectedId(student.id)}>
          <span className="coach-roster-person"><i className={`coach-student-avatar ${student.color || 'blue'}`}>{student.initials || 'HV'}</i><span><strong>{student.name}</strong><small>{student.level || 'Chưa cập nhật'}</small></span></span>
          <span><strong>{student.program || 'Chưa cập nhật'}</strong><small>{student.completedSessions || 0}/{student.totalSessions || 0} buổi</small></span>
          <span className="coach-roster-progress"><span><i style={{ width: `${student.progress || 0}%` }} /></span><b>{student.progress || 0}%</b></span>
          <span><strong>{student.nextSession || 'Chưa xếp lịch'}</strong><small className={`student-state ${student.status === 'Tạm nghỉ' ? 'paused' : ''}`}>{student.status || 'Chưa cập nhật'}</small></span>
        </button>)}</div> : <EmptyState title="Chưa có học viên" text="Danh sách học viên sẽ xuất hiện sau khi kết nối API." />}
      </section>

      <aside className="coach-card coach-student-profile">
        {selected ? <><div className="coach-profile-cover"><span className={`coach-student-avatar ${selected.color || 'blue'}`}>{selected.initials || 'HV'}</span></div><div className="coach-profile-main"><h2>{selected.name}</h2><p>{selected.program || 'Chưa cập nhật chương trình'}</p><span className="coach-profile-state"><i />{selected.status || 'Chưa cập nhật'}</span><div className="coach-profile-numbers"><div><strong>{selected.progress || 0}%</strong><small>Tiến độ</small></div><div><strong>{selected.attendance || 0}%</strong><small>Chuyên cần</small></div><div><strong>{selected.completedSessions || 0}/{selected.totalSessions || 0}</strong><small>Buổi học</small></div></div><div className="coach-profile-info"><span><Target size={16} /><span><small>Mục tiêu</small><strong>{selected.goal || 'Chưa cập nhật'}</strong></span></span></div><div className="coach-profile-actions"><button type="button" onClick={() => showNotice('Chức năng nhắn tin đang chờ API.')}><Users size={16} /> Liên hệ</button><button type="button" onClick={() => showNotice('Chức năng xếp lịch đang chờ API.')}><CalendarDays size={16} /> Xếp lịch</button></div></div></> : <EmptyState title="Chưa chọn học viên" text="Chi tiết học viên sẽ hiển thị tại đây khi có dữ liệu API." />}
      </aside>
    </div>
  </div>
}
