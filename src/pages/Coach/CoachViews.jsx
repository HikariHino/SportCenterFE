import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight, BookOpen, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  Clock3, MapPin, Plus, SearchX, Star, Trash2, TrendingUp, UserCheck, UserRound, Users, X,
} from 'lucide-react'
import {
  completeCoachSession,
  getCoachSessionAttendances,
  getCoachSessionReviews,
  getCoachSessionRoster,
  getMyCoachSessions,
  markCoachAttendance,
} from '../../services/coachService'
import { createTrainingPlan, getMemberTrainingPlans } from '../../services/trainingPlanService'

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

const reviewDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
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
    rawStatus,
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
    canComplete: rawStatus === 'scheduled' && endsAt <= now,
  }
}

const getScheduleError = error => error.response?.data?.message || error.message || 'Không thể kết nối tới Coach API.'

export function ScheduleView({ showNotice }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset])
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()))
  const [filter, setFilter] = useState('Tất cả')
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [completingId, setCompletingId] = useState(null)
  const [reviewSession, setReviewSession] = useState(null)
  const [reviewPage, setReviewPage] = useState({ items: [], total: 0, page: 1, pageSize: 5 })
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsError, setReviewsError] = useState('')
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

  const handleCompleteSession = async session => {
    if (!session.canComplete || completingId) return
    setCompletingId(session.id)
    setActionError('')
    try {
      await completeCoachSession(session.id)
      setSessions(current => current.map(item => item.id === session.id ? {
        ...item,
        rawStatus: 'completed',
        status: 'Đã hoàn thành',
        tone: 'done',
        canComplete: false,
      } : item))
      showNotice?.(`Đã hoàn thành buổi ${session.studentName}.`)
    } catch (requestError) {
      setActionError(getScheduleError(requestError))
    } finally {
      setCompletingId(null)
    }
  }

  const loadSessionReviews = async (session, page = 1) => {
    setReviewSession(session)
    setReviewsLoading(true)
    setReviewsError('')
    try {
      setReviewPage(await getCoachSessionReviews(session.id, { page, pageSize: 5 }))
    } catch (requestError) {
      setReviewPage({ items: [], total: 0, page, pageSize: 5 })
      setReviewsError(getScheduleError(requestError))
    } finally {
      setReviewsLoading(false)
    }
  }

  const reviewPageCount = Math.max(1, Math.ceil(reviewPage.total / reviewPage.pageSize))

  return <div className="coach-section-view">
    <section className="coach-calendar-strip coach-card">
      <button type="button" aria-label="Tuần trước" onClick={() => changeWeek(-1)}><ChevronLeft size={18} /></button>
      <div>{weekDays.map(day => <button type="button" key={day.key} className={selectedDate === day.key ? 'active' : ''} onClick={() => setSelectedDate(day.key)}><span>{day.weekday}</span><strong>{day.date}</strong>{day.today && <i>Hôm nay</i>}</button>)}</div>
      <button type="button" aria-label="Tuần sau" onClick={() => changeWeek(1)}><ChevronRight size={18} /></button>
    </section>

    <div className="coach-schedule-layout">
      <section className="coach-card coach-agenda">
        <div className="coach-view-toolbar"><div><strong>Lịch ngày {selectedDay.date}/{selectedDay.month}</strong><span>{loading ? 'Đang tải lịch...' : `${allDaySessions.length} buổi huấn luyện`}</span></div><div className="coach-filter-pills">{['Tất cả', 'Đã hoàn thành', 'Đang diễn ra', 'Sắp tới', 'Đã hủy'].map(label => <button type="button" key={label} className={filter === label ? 'active' : ''} onClick={() => setFilter(label)}>{label}</button>)}</div></div>
        {actionError && <div className="coach-attendance-error" role="alert">{actionError}</div>}
        {loading ? <EmptyState title="Đang tải lịch huấn luyện" text="Dữ liệu đang được đồng bộ từ Coach API." /> : error ? <EmptyState title="Không thể tải lịch" text={error} /> : daySessions.length ? <div className="coach-agenda-list">{daySessions.map(session => <article key={session.id} className={session.tone || 'next'}>
          <div className="coach-agenda-time"><strong>{session.time || '--:--'}</strong><span>{session.endTime || '--:--'}</span></div><div className="coach-agenda-line"><i /></div>
          <div className="coach-agenda-body"><div><span className={`coach-status ${session.tone || 'next'}`}>{session.status || 'Chưa xác định'}</span><small>{session.type || ''}</small></div><h3>{session.studentName || session.student}</h3><p>{session.program || 'Chưa có chương trình'}</p><footer><span><Users size={14} />Còn {session.availableSeats} chỗ</span><span><Clock3 size={14} />{session.durationMinutes || 0} phút</span><span className="coach-session-actions"><button type="button" className="coach-session-reviews" disabled={reviewsLoading && reviewSession?.id === session.id} onClick={() => loadSessionReviews(session)}><Star size={14} />{reviewsLoading && reviewSession?.id === session.id ? 'Đang tải...' : 'Đánh giá'}</button>{session.canComplete && <button type="button" className="coach-complete-session" disabled={Boolean(completingId)} onClick={() => handleCompleteSession(session)}><CheckCircle2 size={14} />{completingId === session.id ? 'Đang hoàn thành...' : 'Hoàn thành buổi'}</button>}</span></footer></div>
        </article>)}</div> : <EmptyState title="Chưa có lịch huấn luyện" text="Coach API chưa trả về buổi huấn luyện nào trong ngày này." />}
      </section>

      <aside className="coach-day-summary">
        <section className="coach-card"><div className="coach-summary-title"><CalendarDays size={20} /><div><small>TỔNG QUAN NGÀY</small><strong>{selectedDay.date}/{selectedDay.month}/{selectedDate.slice(0, 4)}</strong></div></div><div className="coach-summary-stats"><div><strong>{allDaySessions.length}</strong><span>Buổi tập</span></div><div><strong>{totalMinutes ? `${(totalMinutes / 60).toFixed(totalMinutes % 60 ? 1 : 0)}h` : '0h'}</strong><span>Thời lượng</span></div><div><strong>{enrollmentCount}</strong><span>Lượt đăng ký</span></div></div></section>
        <section className={`coach-card coach-api-note${error ? ' error' : ''}`}><CheckCircle2 size={22} /><strong>{loading ? 'Đang đồng bộ lịch' : error ? 'Mất kết nối Coach API' : 'Đã kết nối Coach API'}</strong><p>{error || 'Lịch được tải trực tiếp từ tài khoản huấn luyện viên đang đăng nhập.'}</p>{error && <button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button>}</section>
        {reviewSession && <section className="coach-card coach-session-review-panel"><div className="coach-review-head"><div><span>ĐÁNH GIÁ HỌC VIÊN</span><strong>{reviewSession.studentName}</strong></div><b><Star size={15} fill="currentColor" />{reviewPage.total}</b></div>{reviewsLoading ? <EmptyState title="Đang tải đánh giá" text="Dữ liệu đang được đồng bộ từ API." /> : reviewsError ? <div className="coach-inline-error"><EmptyState title="Không thể tải đánh giá" text={reviewsError} /><button className="coach-retry-button" type="button" onClick={() => loadSessionReviews(reviewSession, reviewPage.page)}>Thử lại</button></div> : reviewPage.items.length ? <><div className="coach-session-review-list">{reviewPage.items.map(review => <article key={review.id}><div><strong>Đăng ký #{review.registrationId}</strong><span>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={13} className={index < review.rating ? 'filled' : ''} fill={index < review.rating ? 'currentColor' : 'none'} />)}</span></div><p>{review.comment || 'Học viên không để lại nhận xét.'}</p><small>{reviewDateFormatter.format(new Date(review.createdAt))}</small></article>)}</div>{reviewPageCount > 1 && <div className="coach-review-pagination"><button type="button" disabled={reviewPage.page <= 1} onClick={() => loadSessionReviews(reviewSession, reviewPage.page - 1)}><ChevronLeft size={14} />Trước</button><span>{reviewPage.page}/{reviewPageCount}</span><button type="button" disabled={reviewPage.page >= reviewPageCount} onClick={() => loadSessionReviews(reviewSession, reviewPage.page + 1)}>Sau<ChevronRight size={14} /></button></div>}</> : <EmptyState title="Chưa có đánh giá" text="Buổi huấn luyện này chưa nhận được đánh giá từ học viên." />}</section>}
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
  excused: 'Có phép',
}[String(status || '').toLowerCase()] || 'Chưa điểm danh')

const attendanceTone = status => ({
  present: 'present',
  late: 'late',
  absent: 'absent',
  excused: 'excused',
}[String(status || '').toLowerCase()] || 'pending')

const attendanceValue = status => ({
  present: 'Present',
  absent: 'Absent',
  excused: 'Excused',
}[String(status || '').toLowerCase()] || 'Present')

const attendanceOptions = [
  ['Present', 'Có mặt'],
  ['Absent', 'Vắng mặt'],
  ['Excused', 'Có phép'],
]

const mapRosterStudent = student => ({
  id: student.registrationId,
  registrationId: student.registrationId,
  memberId: student.memberId,
  name: student.fullName || 'Học viên chưa cập nhật tên',
  registrationStatus: registrationLabel(student.registrationStatus),
  attendanceStatus: attendanceLabel(student.attendanceStatus),
  attendanceTone: attendanceTone(student.attendanceStatus),
  attendanceValue: attendanceValue(student.attendanceStatus),
  checkInTime: student.checkInTime ? checkInFormatter.format(new Date(student.checkInTime)) : 'Chưa check-in',
})

const formatSessionOption = session => {
  const start = new Date(session.startsAt)
  const end = new Date(session.endsAt)
  return `${session.className} · ${sessionDateFormatter.format(start)} · ${timeFormatter.format(start)}–${timeFormatter.format(end)}`
}

const getStudentsError = error => error.response?.data?.message || error.message || 'Không thể kết nối tới API học viên theo buổi.'

const toDateInput = date => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const trainingGoals = [
  ['WeightLoss', 'Giảm cân'],
  ['MuscleGain', 'Tăng cơ'],
  ['Endurance', 'Tăng sức bền'],
  ['Flexibility', 'Cải thiện độ dẻo'],
  ['GeneralFitness', 'Thể lực tổng quát'],
]

const planDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const trainingGoalLabel = goal => trainingGoals.find(([value]) => value === goal)?.[1] || goal || 'Chưa xác định'

const newPlanExercise = () => ({ exerciseId: '', sets: '', reps: '', durationInMinutes: '', notes: '' })

function TrainingPlanDialog({ student, onClose, onCreated }) {
  const today = new Date()
  const defaultEndDate = new Date(today)
  defaultEndDate.setDate(defaultEndDate.getDate() + 28)
  const [form, setForm] = useState({
    planName: `Giáo án cho ${student.name}`,
    goal: 'GeneralFitness',
    startDate: toDateInput(today),
    endDate: toDateInput(defaultEndDate),
  })
  const [exercises, setExercises] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const updateExercise = (index, field, value) => {
    setExercises(current => current.map((exercise, exerciseIndex) => exerciseIndex === index ? { ...exercise, [field]: value } : exercise))
  }

  const handleSubmit = async event => {
    event.preventDefault()
    setError('')
    if (!form.planName.trim() || !form.goal || !form.startDate || !form.endDate) {
      setError('Vui lòng nhập đầy đủ tên, mục tiêu và thời gian giáo án.')
      return
    }
    if (form.endDate < form.startDate) {
      setError('Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.')
      return
    }
    const invalidExercise = exercises.some(exercise => Number(exercise.exerciseId) < 1 || Number(exercise.sets) < 1 || Number(exercise.reps) < 1)
    if (invalidExercise) {
      setError('Mỗi bài tập cần mã bài tập, số hiệp và số lần lớn hơn 0.')
      return
    }

    setSaving(true)
    try {
      const plan = await createTrainingPlan({
        planName: form.planName.trim(),
        goal: form.goal,
        memberId: student.memberId,
        startDate: `${form.startDate}T00:00:00`,
        endDate: `${form.endDate}T23:59:59`,
        exercises: exercises.map(exercise => ({
          exerciseId: Number(exercise.exerciseId),
          sets: Number(exercise.sets),
          reps: Number(exercise.reps),
          durationInMinutes: exercise.durationInMinutes ? Number(exercise.durationInMinutes) : null,
          notes: exercise.notes.trim() || null,
        })),
      })
      onCreated(plan)
      onClose()
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Không thể tạo giáo án.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="coach-plan-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="coach-plan-dialog" role="dialog" aria-modal="true" aria-labelledby="coach-plan-title">
      <header><div><span>TẠO GIÁO ÁN</span><h2 id="coach-plan-title">{student.name}</h2><p>Member #{student.memberId}</p></div><button type="button" aria-label="Đóng tạo giáo án" disabled={saving} onClick={onClose}><X size={19} /></button></header>
      <form onSubmit={handleSubmit}>
        <div className="coach-plan-form-grid"><label><span>Tên giáo án</span><input value={form.planName} maxLength={150} onChange={event => setForm(current => ({ ...current, planName: event.target.value }))} /></label><label><span>Mục tiêu</span><select value={form.goal} onChange={event => setForm(current => ({ ...current, goal: event.target.value }))}>{trainingGoals.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Ngày bắt đầu</span><input type="date" value={form.startDate} onChange={event => setForm(current => ({ ...current, startDate: event.target.value }))} /></label><label><span>Ngày kết thúc</span><input type="date" min={form.startDate} value={form.endDate} onChange={event => setForm(current => ({ ...current, endDate: event.target.value }))} /></label></div>
        <div className="coach-plan-exercises"><div className="coach-plan-exercises-head"><div><strong>Bài tập</strong><span>Không bắt buộc · nhập mã bài tập từ hệ thống</span></div><button type="button" onClick={() => setExercises(current => [...current, newPlanExercise()])}><Plus size={15} />Thêm bài tập</button></div>{exercises.length ? exercises.map((exercise, index) => <article key={index}><div className="coach-plan-exercise-title"><strong>Bài tập {index + 1}</strong><button type="button" aria-label={`Xóa bài tập ${index + 1}`} onClick={() => setExercises(current => current.filter((_, exerciseIndex) => exerciseIndex !== index))}><Trash2 size={15} /></button></div><div><label><span>Mã bài tập</span><input type="number" min="1" value={exercise.exerciseId} onChange={event => updateExercise(index, 'exerciseId', event.target.value)} /></label><label><span>Số hiệp</span><input type="number" min="1" value={exercise.sets} onChange={event => updateExercise(index, 'sets', event.target.value)} /></label><label><span>Số lần</span><input type="number" min="1" value={exercise.reps} onChange={event => updateExercise(index, 'reps', event.target.value)} /></label><label><span>Thời lượng (phút)</span><input type="number" min="1" value={exercise.durationInMinutes} onChange={event => updateExercise(index, 'durationInMinutes', event.target.value)} /></label><label className="wide"><span>Ghi chú</span><input value={exercise.notes} maxLength={500} onChange={event => updateExercise(index, 'notes', event.target.value)} /></label></div></article>) : <p className="coach-plan-exercises-empty">Có thể tạo giáo án trước và bổ sung bài tập khi đã có mã bài tập.</p>}</div>
        {error && <div className="coach-plan-form-error" role="alert">{error}</div>}
        <footer><button type="button" disabled={saving} onClick={onClose}>Hủy</button><button type="submit" disabled={saving}>{saving ? 'Đang tạo...' : 'Tạo giáo án'}</button></footer>
      </form>
    </section>
  </div>
}

function TrainingPlanListDialog({ student, onClose }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)

  useEffect(() => {
    let active = true
    const loadPlans = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getMemberTrainingPlans(student.memberId)
        if (active) setPlans(result)
      } catch (requestError) {
        if (active) {
          setPlans([])
          setError(requestError.response?.data?.message || requestError.message || 'Không thể tải giáo án của học viên.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadPlans()
    return () => { active = false }
  }, [requestKey, student.memberId])

  return <div className="coach-plan-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="coach-plan-dialog coach-plan-list-dialog" role="dialog" aria-modal="true" aria-labelledby="coach-plan-list-title">
      <header><div><span>GIÁO ÁN HỌC VIÊN</span><h2 id="coach-plan-list-title">{student.name}</h2><p>Member #{student.memberId} · {plans.length} giáo án</p></div><button type="button" aria-label="Đóng danh sách giáo án" onClick={onClose}><X size={19} /></button></header>
      <div className="coach-plan-list-body">{loading ? <div className="coach-plan-list-state"><BookOpen size={26} /><strong>Đang tải giáo án</strong><span>Dữ liệu đang được đồng bộ từ TrainingPlans API.</span></div> : error ? <div className="coach-plan-list-state error"><BookOpen size={26} /><strong>Không thể tải giáo án</strong><span>{error}</span><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : plans.length ? <div className="coach-member-plan-list">{plans.map(plan => <article className="coach-member-plan" key={plan.id}><header><div><span>{trainingGoalLabel(plan.goal)}</span><h3>{plan.planName}</h3></div><b className={String(plan.status || '').toLowerCase()}>{plan.status || 'Chưa xác định'}</b></header><div className="coach-member-plan-meta"><span><CalendarDays size={14} /><span><small>Bắt đầu</small><strong>{planDateFormatter.format(new Date(plan.startDate))}</strong></span></span><span><CalendarDays size={14} /><span><small>Kết thúc</small><strong>{planDateFormatter.format(new Date(plan.endDate))}</strong></span></span></div>{Array.isArray(plan.exercises) && plan.exercises.length ? <div className="coach-member-plan-exercises">{plan.exercises.map(exercise => <div key={exercise.id}><span><strong>{exercise.exerciseName}</strong><small>{exercise.sets} hiệp × {exercise.reps} lần{exercise.durationInMinutes ? ` · ${exercise.durationInMinutes} phút` : ''}</small></span>{exercise.notes && <p>{exercise.notes}</p>}</div>)}</div> : <p className="coach-member-plan-empty">Giáo án chưa có bài tập.</p>}</article>)}</div> : <div className="coach-plan-list-state"><BookOpen size={26} /><strong>Chưa có giáo án</strong><span>Học viên này chưa được tạo giáo án tập luyện.</span></div>}</div>
    </section>
  </div>
}

export function StudentsView({ query, showNotice }) {
  const [status, setStatus] = useState('Tất cả')
  const [sessions, setSessions] = useState([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [students, setStudents] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [rosterLoading, setRosterLoading] = useState(false)
  const [error, setError] = useState('')
  const [planStudent, setPlanStudent] = useState(null)
  const [plansStudent, setPlansStudent] = useState(null)
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
        {selected ? <><div className="coach-profile-cover"><span className="coach-student-avatar blue">{initials(selected.name)}</span></div><div className="coach-profile-main"><h2>{selected.name}</h2><p>{selectedSession?.className || 'Buổi huấn luyện'}</p><span className={`coach-profile-state ${selected.attendanceTone}`}><i />{selected.attendanceStatus}</span><div className="coach-profile-numbers"><div><strong>#{selected.memberId}</strong><small>Mã hội viên</small></div><div><strong>#{selected.registrationId}</strong><small>Mã đăng ký</small></div><div><strong>{selected.registrationStatus}</strong><small>Trạng thái</small></div></div><div className="coach-profile-info"><span><Clock3 size={16} /><span><small>Thời gian check-in</small><strong>{selected.checkInTime}</strong></span></span><span><CalendarDays size={16} /><span><small>Buổi huấn luyện</small><strong>{selectedSession ? formatSessionOption(selectedSession) : 'Chưa xác định'}</strong></span></span></div><div className="coach-profile-actions"><button type="button" onClick={() => setPlanStudent(selected)}><Plus size={15} />Tạo giáo án</button><button type="button" onClick={() => setPlansStudent(selected)}><BookOpen size={15} />Xem giáo án</button></div></div></> : <EmptyState title="Chưa chọn học viên" text={students.length ? 'Chọn một học viên trong danh sách để xem chi tiết.' : 'Buổi huấn luyện này chưa có hội viên đăng ký.'} />}
      </aside>
    </div>
    {planStudent && <TrainingPlanDialog student={planStudent} onClose={() => setPlanStudent(null)} onCreated={plan => showNotice?.(`Đã tạo giáo án “${plan.planName}” cho ${planStudent.name}.`)} />}
    {plansStudent && <TrainingPlanListDialog student={plansStudent} onClose={() => setPlansStudent(null)} />}
  </div>
}

const getAttendanceAvailability = session => {
  if (!session) return { open: false, message: 'Chưa chọn buổi huấn luyện' }
  if (String(session.status || '').toLowerCase() === 'cancelled') return { open: false, message: 'Buổi học đã bị hủy' }
  return { open: true, message: 'Có thể ghi nhận hoặc cập nhật trạng thái điểm danh' }
}

export function AttendanceView({ query, showNotice }) {
  const [sessions, setSessions] = useState([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [students, setStudents] = useState([])
  const [status, setStatus] = useState('Tất cả')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [markingId, setMarkingId] = useState(null)
  const [attendanceSelections, setAttendanceSelections] = useState({})
  const [requestKey, setRequestKey] = useState(0)

  useEffect(() => {
    let active = true
    const loadSessions = async () => {
      setLoading(true)
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
        if (active) setLoading(false)
      }
    }
    loadSessions()
    return () => { active = false }
  }, [requestKey])

  useEffect(() => {
    let active = true
    if (!selectedSessionId) {
      setStudents([])
      return () => { active = false }
    }

    const loadAttendances = async () => {
      setLoading(true)
      setError('')
      setActionError('')
      try {
        const [roster, attendances] = await Promise.all([
          getCoachSessionRoster(selectedSessionId),
          getCoachSessionAttendances(selectedSessionId),
        ])
        if (!active) return
        const attendanceByMember = new Map(attendances.map(item => [Number(item.memberId), item]))
        const mappedStudents = roster.map(student => {
          const attendance = attendanceByMember.get(Number(student.memberId))
          return mapRosterStudent({
            ...student,
            attendanceStatus: attendance?.status ?? student.attendanceStatus,
            checkInTime: attendance?.checkInTime ?? student.checkInTime,
          })
        })
        setStudents(mappedStudents)
        setAttendanceSelections(Object.fromEntries(mappedStudents.map(student => [student.id, student.attendanceValue])))
      } catch (requestError) {
        if (active) {
          setStudents([])
          setError(getStudentsError(requestError))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadAttendances()
    return () => { active = false }
  }, [requestKey, selectedSessionId])

  const selectedSession = sessions.find(session => String(session.id) === String(selectedSessionId))
  const attendanceAvailability = getAttendanceAvailability(selectedSession)
  const normalizedQuery = query.trim().toLocaleLowerCase('vi')
  const filtered = students.filter(student => {
    const matchesStatus = status === 'Tất cả' || student.attendanceStatus === status
    const matchesQuery = !normalizedQuery || `${student.name} ${student.memberId} ${student.registrationStatus} ${student.attendanceStatus}`.toLocaleLowerCase('vi').includes(normalizedQuery)
    return matchesStatus && matchesQuery
  })
  const presentCount = students.filter(student => ['Đã điểm danh', 'Đi trễ'].includes(student.attendanceStatus)).length
  const pendingCount = students.filter(student => student.attendanceStatus === 'Chưa điểm danh').length

  const handleMarkAttendance = async student => {
    if (!attendanceAvailability.open || markingId) return
    setMarkingId(student.registrationId)
    setActionError('')
    try {
      const attendance = await markCoachAttendance({
        memberId: student.memberId,
        sessionId: Number(selectedSessionId),
        status: attendanceSelections[student.id] || 'Present',
      })
      const updated = mapRosterStudent({
        registrationId: student.registrationId,
        memberId: student.memberId,
        fullName: student.name,
        registrationStatus: student.registrationStatus,
        attendanceStatus: attendance.status,
        checkInTime: attendance.checkInTime,
      })
      setStudents(current => current.map(item => item.id === student.id ? updated : item))
      setAttendanceSelections(current => ({ ...current, [student.id]: updated.attendanceValue }))
      showNotice(`Đã cập nhật ${student.name}: ${updated.attendanceStatus}.`)
    } catch (requestError) {
      setActionError(getStudentsError(requestError))
    } finally {
      setMarkingId(null)
    }
  }

  if (loading && !sessions.length) return <section className="coach-card coach-roster-state"><EmptyState title="Đang tải dữ liệu điểm danh" text="Coach API đang đồng bộ các buổi huấn luyện." /></section>
  if (!sessions.length) return <section className="coach-card coach-roster-state"><EmptyState title={error ? 'Không thể tải dữ liệu điểm danh' : 'Chưa có buổi để điểm danh'} text={error || 'Huấn luyện viên chưa được phân công buổi học nào.'} />{error && <button className="coach-retry-button" type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button>}</section>

  return <div className="coach-section-view">
    <section className="coach-card coach-session-picker">
      <div className="coach-session-picker-main"><span><UserCheck size={21} /></span><div><small>BUỔI ĐIỂM DANH</small><strong>{selectedSession?.className || 'Buổi huấn luyện'}</strong><p>{selectedSession ? formatSessionOption(selectedSession) : 'Chọn một buổi để điểm danh'}</p></div></div>
      <label><span>Chọn buổi huấn luyện</span><select value={selectedSessionId} onChange={event => { setSelectedSessionId(event.target.value); setStatus('Tất cả') }}>{sessions.map(session => <option key={session.id} value={session.id}>{formatSessionOption(session)}</option>)}</select></label>
    </section>

    <section className="coach-student-kpis coach-attendance-kpis">
      <article><span className="blue"><Users size={21} /></span><div><small>Đăng ký trong buổi</small><strong>{students.length}</strong><p>Danh sách roster</p></div></article>
      <article><span className="green"><CheckCircle2 size={21} /></span><div><small>Đã điểm danh</small><strong>{presentCount}</strong><p>Đồng bộ Attendance API</p></div></article>
      <article><span className="purple"><Clock3 size={21} /></span><div><small>Chưa điểm danh</small><strong>{pendingCount}</strong><p>{attendanceAvailability.message}</p></div></article>
    </section>

    <section className="coach-card coach-attendance-list">
      <div className="coach-view-toolbar"><div><strong>Điểm danh học viên</strong><span>{loading ? 'Đang đồng bộ...' : `${filtered.length} học viên`}</span></div><div className="coach-filter-pills">{['Tất cả', 'Đã điểm danh', 'Chưa điểm danh', 'Vắng mặt', 'Có phép'].map(label => <button type="button" key={label} className={status === label ? 'active' : ''} onClick={() => setStatus(label)}>{label}</button>)}</div></div>
      <div className={`coach-checkin-window ${attendanceAvailability.open ? 'open' : ''}`}><Clock3 size={16} /><span><strong>{attendanceAvailability.open ? 'Có thể cập nhật điểm danh' : 'Không thể điểm danh'}</strong><small>{attendanceAvailability.message}. Trạng thái được lưu trực tiếp qua Attendance API.</small></span></div>
      {actionError && <div className="coach-attendance-error" role="alert">{actionError}</div>}
      {loading ? <EmptyState title="Đang tải danh sách điểm danh" text="Dữ liệu đang được đồng bộ từ Coach API." /> : error ? <div className="coach-inline-error"><EmptyState title="Không thể tải điểm danh" text={error} /><button className="coach-retry-button" type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : filtered.length ? <div className="coach-attendance-table"><div className="coach-attendance-heading"><span>Học viên</span><span>Đăng ký</span><span>Trạng thái</span><span>Thao tác</span></div>{filtered.map(student => {
        const isMarking = markingId === student.registrationId
        const canMark = attendanceAvailability.open && !markingId
        return <article className="coach-attendance-row" key={student.id}>
          <span className="coach-roster-person"><i className="coach-student-avatar blue">{initials(student.name)}</i><span><strong>{student.name}</strong><small>Member #{student.memberId}</small></span></span>
          <span><strong>{student.registrationStatus}</strong><small>Đăng ký #{student.registrationId}</small></span>
          <span><strong className={`coach-attendance ${student.attendanceTone}`}>{student.attendanceStatus}</strong><small>{student.checkInTime}</small></span>
          <span className="coach-attendance-actions"><select aria-label={`Trạng thái điểm danh của ${student.name}`} value={attendanceSelections[student.id] || 'Present'} disabled={isMarking} onChange={event => setAttendanceSelections(current => ({ ...current, [student.id]: event.target.value }))}>{attendanceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button type="button" className="coach-checkin-button" disabled={!canMark && !isMarking} onClick={() => handleMarkAttendance(student)}>{isMarking ? 'Đang lưu...' : student.attendanceTone === 'pending' ? 'Lưu' : 'Cập nhật'}</button></span>
        </article>
      })}</div> : <EmptyState title="Chưa có học viên" text={query || status !== 'Tất cả' ? 'Không có học viên phù hợp với bộ lọc.' : 'Buổi huấn luyện này chưa có hội viên đăng ký.'} />}
    </section>
  </div>
}
