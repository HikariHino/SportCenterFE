import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Star, Users } from 'lucide-react'
import { completeCoachSession, getCoachSessionReviews, getMyCoachSessions } from '../../services/coachService'
import { EmptyState, timeFormatter, ViewLoader } from './CoachViewShared'

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

const getWeekOffsetForDate = value => {
  const target = new Date(value)
  if (Number.isNaN(target.getTime())) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  const currentMonday = new Date(today)
  const targetMonday = new Date(target)
  currentMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  targetMonday.setDate(target.getDate() - ((target.getDay() + 6) % 7))
  return Math.round((targetMonday - currentMonday) / (7 * 24 * 60 * 60 * 1000))
}


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
    startsAt: session.startsAt,
    endsAt: session.endsAt,
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

const getScheduleError = error => error.response?.data?.message || error.message || 'Không thể tải lịch huấn luyện.'

export function ScheduleView({ showNotice, selectedSession, onSelectSession }) {
  const [weekOffset, setWeekOffset] = useState(() => selectedSession?.startsAt ? getWeekOffsetForDate(selectedSession.startsAt) : 0)
  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset])
  const [selectedDate, setSelectedDate] = useState(() => selectedSession?.startsAt ? toDateKey(new Date(selectedSession.startsAt)) : toDateKey(new Date()))
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
  const selectedDay = weekDays.find(day => day.key === selectedDate) || weekDays[0]
  const daySessions = sessions.filter(item => item.date === selectedDate && (filter === 'Tất cả' || item.status === filter))
  const allDaySessions = sessions.filter(item => item.date === selectedDate)
  const totalMinutes = allDaySessions.reduce((total, item) => total + Number(item.durationMinutes || 0), 0)
  const enrollmentCount = allDaySessions.reduce((total, item) => total + Number(item.currentEnrollment || 0), 0)

  useEffect(() => {
    if (!selectedSession?.startsAt) return
    setWeekOffset(getWeekOffsetForDate(selectedSession.startsAt))
    setSelectedDate(toDateKey(new Date(selectedSession.startsAt)))
    setFilter('Tất cả')
  }, [selectedSession?.id, selectedSession?.startsAt])

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
  }, [weekDays])

  const changeWeek = direction => {
    const nextOffset = weekOffset + direction
    const nextWeek = getWeekDays(nextOffset)
    setWeekOffset(nextOffset)
    setSelectedDate(nextWeek[0].key)
  }

  const selectSession = session => {
    onSelectSession?.({
      id: session.id,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      className: session.studentName,
    })
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

  if (loading) return <ViewLoader />

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
        {loading ? <EmptyState title="Đang tải lịch huấn luyện" text="Dữ liệu đang được đồng bộ từ hệ thống." /> : error ? <EmptyState title="Không thể tải lịch" text={error} /> : daySessions.length ? <div className="coach-agenda-list">{daySessions.map(session => <article key={session.id} className={`${session.tone || 'next'} ${String(selectedSession?.id) === String(session.id) ? 'selected' : ''}`} role="button" tabIndex={0} aria-pressed={String(selectedSession?.id) === String(session.id)} onClick={() => selectSession(session)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectSession(session) } }}>
          <div className="coach-agenda-time"><strong>{session.time || '--:--'}</strong><span>{session.endTime || '--:--'}</span></div><div className="coach-agenda-line"><i /></div>
          <div className="coach-agenda-body"><div><span className={`coach-status ${session.tone || 'next'}`}>{session.status || 'Chưa xác định'}</span><small>{session.type || ''}</small></div><h3>{session.studentName || session.student}</h3><p>{session.program || 'Chưa có chương trình'}</p><footer><span><Users size={14} />Còn {session.availableSeats} chỗ</span><span><Clock3 size={14} />{session.durationMinutes || 0} phút</span><span className="coach-session-actions"><button type="button" className="coach-session-reviews" disabled={reviewsLoading && reviewSession?.id === session.id} onClick={event => { event.stopPropagation(); loadSessionReviews(session) }}><Star size={14} />{reviewsLoading && reviewSession?.id === session.id ? 'Đang tải...' : 'Đánh giá'}</button>{session.canComplete && <button type="button" className="coach-complete-session" disabled={Boolean(completingId)} onClick={event => { event.stopPropagation(); handleCompleteSession(session) }}><CheckCircle2 size={14} />{completingId === session.id ? 'Đang hoàn thành...' : 'Hoàn thành buổi'}</button>}</span></footer></div>
        </article>)}</div> : <EmptyState title="Chưa có lịch huấn luyện" text="Chưa có buổi huấn luyện nào trong ngày này." />}
      </section>

      <aside className="coach-day-summary">
        <section className="coach-card"><div className="coach-summary-title"><CalendarDays size={20} /><div><small>TỔNG QUAN NGÀY</small><strong>{selectedDay.date}/{selectedDay.month}/{selectedDate.slice(0, 4)}</strong></div></div><div className="coach-summary-stats"><div><strong>{allDaySessions.length}</strong><span>Buổi tập</span></div><div><strong>{totalMinutes ? `${(totalMinutes / 60).toFixed(totalMinutes % 60 ? 1 : 0)}h` : '0h'}</strong><span>Thời lượng</span></div><div><strong>{enrollmentCount}</strong><span>Lượt đăng ký</span></div></div></section>
        {reviewSession && <section className="coach-card coach-session-review-panel"><div className="coach-review-head"><div><span>ĐÁNH GIÁ HỌC VIÊN</span><strong>{reviewSession.studentName}</strong></div><b><Star size={15} fill="currentColor" />{reviewPage.total}</b></div>{reviewsLoading ? <EmptyState title="Đang tải đánh giá" text="Dữ liệu đang được đồng bộ từ hệ thống." /> : reviewsError ? <div className="coach-inline-error"><EmptyState title="Không thể tải đánh giá" text={reviewsError} /><button className="coach-retry-button" type="button" onClick={() => loadSessionReviews(reviewSession, reviewPage.page)}>Thử lại</button></div> : reviewPage.items.length ? <><div className="coach-session-review-list">{reviewPage.items.map(review => <article key={review.id}><div><strong>Đăng ký #{review.registrationId}</strong><span>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={13} className={index < review.rating ? 'filled' : ''} fill={index < review.rating ? 'currentColor' : 'none'} />)}</span></div><p>{review.comment || 'Học viên không để lại nhận xét.'}</p><small>{reviewDateFormatter.format(new Date(review.createdAt))}</small></article>)}</div>{reviewPageCount > 1 && <div className="coach-review-pagination"><button type="button" disabled={reviewPage.page <= 1} onClick={() => loadSessionReviews(reviewSession, reviewPage.page - 1)}><ChevronLeft size={14} />Trước</button><span>{reviewPage.page}/{reviewPageCount}</span><button type="button" disabled={reviewPage.page >= reviewPageCount} onClick={() => loadSessionReviews(reviewSession, reviewPage.page + 1)}>Sau<ChevronRight size={14} /></button></div>}</> : <EmptyState title="Chưa có đánh giá" text="Buổi huấn luyện này chưa nhận được đánh giá từ học viên." />}</section>}
      </aside>
    </div>
  </div>
}

