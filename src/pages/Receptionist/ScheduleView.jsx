import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Plus, Star, Trophy, Users, X } from 'lucide-react'
import { getCoaches, getSports } from '../../services/classCatalogService'
import { getReceptionistClasses, getReceptionistClassSessions, getReceptionistClassSessionsByClass, getReceptionistSessionReviews } from '../../services/receptionistCatalogService'
import { completeReceptionistSession, getReceptionistSessionRoster, registerMemberForSession } from '../../services/receptionistClassService'
import { EmptyState, formatDateTime, requestErrorMessage, sessionDateTimeFormatter, ViewLoader } from './ReceptionistViewShared'

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
  return ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((weekday, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return {
      key: toDateKey(date),
      weekday,
      date: String(date.getDate()).padStart(2, '0'),
      month: String(date.getMonth() + 1).padStart(2, '0'),
      today: toDateKey(date) === toDateKey(today),
    }
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

const timeFormatter = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' })

const mapSession = session => {
  const startsAt = new Date(session.startsAt)
  const endsAt = new Date(session.endsAt)
  const now = new Date()
  const rawStatus = String(session.status || '').toLowerCase()
  let status = 'Sắp tới'
  let tone = 'next'
  if (['cancelled', 'canceled'].includes(rawStatus)) {
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
  return {
    ...session,
    rawStatus,
    status,
    tone,
    date: toDateKey(startsAt),
    time: timeFormatter.format(startsAt),
    endTime: timeFormatter.format(endsAt),
    durationMinutes: Math.max(0, Math.round((endsAt - startsAt) / 60000)),
    currentEnrollment: Number(session.currentEnrollment || Math.max(0, Number(session.capacity || 0) - Number(session.availableSeats || 0))),
    capacity: Number(session.capacity || 0),
    canComplete: rawStatus === 'scheduled' && endsAt <= now,
  }
}

function AddMemberDialog({ sportClass, preferredSession, onClose, onRegistered }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [sessionId, setSessionId] = useState(preferredSession?.id ? String(preferredSession.id) : '')
  const [memberId, setMemberId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [registration, setRegistration] = useState(null)

  useEffect(() => {
    let active = true
    getReceptionistClassSessionsByClass(sportClass.id, { page: 1, pageSize: 100 })
      .then(result => {
        if (!active) return
        const available = result.items.filter(item => !['cancelled', 'canceled', 'completed'].includes(String(item.status || '').toLowerCase()))
        setSessions(available)
        setSessionId(current => current || (available[0]?.id ? String(available[0].id) : ''))
      })
      .catch(requestError => { if (active) setLoadError(requestErrorMessage(requestError, 'Không thể tải buổi học của lớp.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [sportClass.id])

  const submit = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await registerMemberForSession(Number(sessionId), Number(memberId))
      setRegistration(result)
      onRegistered?.(result)
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'Không thể thêm hội viên vào lớp.'))
    } finally {
      setSaving(false)
    }
  }

  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="reception-dialog reception-add-member-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-add-member-title">
      <header><div><span>ĐĂNG KÝ HỘI VIÊN</span><h2 id="reception-add-member-title">{sportClass.className}</h2><p>{sportClass.sportName} · {sportClass.coachName || 'Chưa phân công huấn luyện viên'}</p></div><button type="button" aria-label="Đóng popup thêm hội viên" onClick={onClose} disabled={saving}><X size={19} /></button></header>
      {registration ? <div className="reception-add-member-success"><span><CheckCircle2 size={28} /></span><h3>Đã thêm hội viên thành công</h3><p>Hội viên #{registration.memberId} đã được đăng ký vào buổi học #{registration.sessionId}.</p><button type="button" onClick={onClose}>Hoàn tất</button></div> : <form onSubmit={submit}>
        <div className="reception-add-member-class"><span><Trophy size={20} /></span><div><small>LỚP ĐANG CHỌN</small><strong>{sportClass.className}</strong></div><b>#{sportClass.id}</b></div>
        <label className="reception-add-member-field">Buổi học<select value={sessionId} onChange={event => setSessionId(event.target.value)} disabled={loading || !sessions.length} required><option value="">{loading ? 'Đang tải buổi học...' : 'Chọn buổi học'}</option>{sessions.map(session => <option key={session.id} value={session.id}>#{session.id} · {formatDateTime(session.startsAt)} · {session.availableSeats}/{session.capacity} chỗ trống</option>)}</select></label>
        <label className="reception-add-member-field">Mã hội viên<input type="number" min="1" value={memberId} onChange={event => setMemberId(event.target.value)} placeholder="Nhập mã hội viên" required /></label>
        {loadError && <p className="reception-form-error" role="alert">{loadError}</p>}
        {!loading && !loadError && !sessions.length && <p className="reception-form-error">Lớp này chưa có buổi học khả dụng để đăng ký.</p>}
        {error && <p className="reception-form-error" role="alert">{error}</p>}
        <footer><button type="button" onClick={onClose} disabled={saving}>Hủy</button><button type="submit" disabled={saving || !sessionId || !sessions.length}>{saving ? 'Đang thêm...' : 'Thêm hội viên'}</button></footer>
      </form>}
    </section>
  </div>
}

function ReviewsDialog({ session, onClose }) {
  const [reviews, setReviews] = useState({ items: [], total: 0, page: 1, pageSize: 8 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getReceptionistSessionReviews(session.id, { page: 1, pageSize: 8 })
      .then(result => { if (active) setReviews(result) })
      .catch(requestError => { if (active) setError(requestErrorMessage(requestError, 'Không thể tải đánh giá của buổi học.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [session.id])

  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="reception-dialog reception-reviews-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-reviews-title">
      <header><div><span>ĐÁNH GIÁ HỌC VIÊN</span><h2 id="reception-reviews-title">{session.className}</h2><p>Buổi #{session.id} · {reviews.total} đánh giá</p></div><button type="button" aria-label="Đóng đánh giá" onClick={onClose}><X size={19} /></button></header>
      <div className="reception-reviews-body">{loading ? <ViewLoader /> : error ? <EmptyState icon={Star} title="Không thể tải đánh giá" text={error} /> : reviews.items.length ? <div className="reception-review-list">{reviews.items.map(review => <article key={review.id}><div><span>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={13} fill={index < review.rating ? 'currentColor' : 'none'} />)}</span><small>{formatDateTime(review.createdAt)}</small></div><p>{review.comment || 'Học viên không để lại nhận xét.'}</p><strong>Lượt đăng ký #{review.registrationId}</strong></article>)}</div> : <EmptyState icon={Star} title="Chưa có đánh giá" text="Buổi học này chưa nhận được đánh giá." />}</div>
    </section>
  </div>
}

function CompleteDialog({ session, onClose, onCompleted }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submit = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await completeReceptionistSession(session.id)
      onCompleted()
      onClose()
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'Không thể hoàn thành buổi học.'))
    } finally {
      setSaving(false)
    }
  }
  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}><section className="reception-dialog reception-complete-dialog" role="dialog" aria-modal="true"><header><div><span>XÁC NHẬN TRẠNG THÁI</span><h2>Hoàn thành {session.className}</h2><p>Buổi #{session.id} sẽ được cập nhật trên hệ thống.</p></div><button type="button" aria-label="Đóng xác nhận" onClick={onClose}><X size={19} /></button></header><form onSubmit={submit}><div className="reception-complete-copy"><span><CheckCircle2 size={25} /></span><strong>Xác nhận buổi học đã kết thúc?</strong><p>Hệ thống sẽ kiểm tra thời gian và quyền thao tác trước khi cập nhật.</p></div>{error && <p className="reception-form-error" role="alert">{error}</p>}<footer><button type="button" onClick={onClose}>Hủy</button><button type="submit" disabled={saving}>{saving ? 'Đang cập nhật...' : 'Xác nhận hoàn thành'}</button></footer></form></section></div>
}

export function ReceptionistScheduleView({ showNotice, selectedSession, onSelectSession }) {
  const initialDate = selectedSession?.startsAt ? new Date(selectedSession.startsAt) : new Date()
  const [weekOffset, setWeekOffset] = useState(() => getWeekOffsetForDate(initialDate))
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(initialDate))
  const [selectedSportId, setSelectedSportId] = useState('')
  const [selectedCoachId, setSelectedCoachId] = useState('')
  const [selectedClassId, setSelectedClassId] = useState('')
  const [statusFilter, setStatusFilter] = useState('Tất cả')
  const [sports, setSports] = useState([])
  const [coaches, setCoaches] = useState([])
  const [baseLoading, setBaseLoading] = useState(true)
  const [baseError, setBaseError] = useState('')
  const [classes, setClasses] = useState([])
  const [classesLoading, setClassesLoading] = useState(false)
  const [classesError, setClassesError] = useState('')
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsError, setSessionsError] = useState('')
  const [requestKey, setRequestKey] = useState(0)
  const [activeSession, setActiveSession] = useState(selectedSession || null)
  const [roster, setRoster] = useState([])
  const [rosterLoading, setRosterLoading] = useState(false)
  const [rosterError, setRosterError] = useState('')
  const [addMemberClass, setAddMemberClass] = useState(null)
  const [reviewSession, setReviewSession] = useState(null)
  const [completeSession, setCompleteSession] = useState(null)
  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset])

  useEffect(() => {
    let active = true
    Promise.all([getSports(), getCoaches()])
      .then(([sportsResult, coachesResult]) => { if (active) { setSports(sportsResult); setCoaches(coachesResult) } })
      .catch(requestError => { if (active) setBaseError(requestErrorMessage(requestError, 'Không thể tải bộ lọc lịch học.')) })
      .finally(() => { if (active) setBaseLoading(false) })
    return () => { active = false }
  }, [requestKey])

  useEffect(() => {
    if (!selectedSportId || !selectedCoachId) {
      setClasses([])
      setSelectedClassId('')
      return undefined
    }
    let active = true
    setClassesLoading(true)
    setClassesError('')
    getReceptionistClasses({ sportId: Number(selectedSportId), coachId: Number(selectedCoachId), page: 1, pageSize: 100 })
      .then(result => { if (active) setClasses(result.items) })
      .catch(requestError => { if (active) { setClasses([]); setClassesError(requestErrorMessage(requestError, 'Không thể tải lớp học.')) } })
      .finally(() => { if (active) setClassesLoading(false) })
    return () => { active = false }
  }, [selectedCoachId, selectedSportId, requestKey])

  useEffect(() => {
    if (!selectedSportId || !selectedCoachId) {
      setSessions([])
      return undefined
    }
    let active = true
    const firstDay = new Date(`${weekDays[0].key}T00:00:00`)
    const nextWeek = new Date(firstDay)
    nextWeek.setDate(firstDay.getDate() + 7)
    setSessionsLoading(true)
    setSessionsError('')
    getReceptionistClassSessions({ sportId: Number(selectedSportId), coachId: Number(selectedCoachId), from: firstDay.toISOString(), to: nextWeek.toISOString(), page: 1, pageSize: 100 })
      .then(result => { if (active) setSessions(result.items.map(mapSession)) })
      .catch(requestError => { if (active) { setSessions([]); setSessionsError(requestErrorMessage(requestError, 'Không thể tải lịch của huấn luyện viên.')) } })
      .finally(() => { if (active) setSessionsLoading(false) })
    return () => { active = false }
  }, [selectedCoachId, selectedSportId, weekDays, requestKey])

  useEffect(() => {
    if (!selectedSession?.startsAt) return
    setWeekOffset(getWeekOffsetForDate(selectedSession.startsAt))
    setSelectedDate(toDateKey(new Date(selectedSession.startsAt)))
    setActiveSession(selectedSession)
  }, [selectedSession?.id, selectedSession?.startsAt])

  const selectedClass = classes.find(item => String(item.id) === String(selectedClassId))
  const classSessions = selectedClassId
    ? sessions.filter(item => String(item.classId) === String(selectedClassId) || (!item.classId && item.className === selectedClass?.className))
    : sessions
  const daySessions = classSessions.filter(item => item.date === selectedDate && (statusFilter === 'Tất cả' || item.status === statusFilter))
  const allDaySessions = classSessions.filter(item => item.date === selectedDate)
  const selectedDay = weekDays.find(day => day.key === selectedDate) || weekDays[0]
  const totalMinutes = allDaySessions.reduce((total, item) => total + item.durationMinutes, 0)
  const enrollmentCount = allDaySessions.reduce((total, item) => total + item.currentEnrollment, 0)

  const changeWeek = direction => {
    const nextOffset = weekOffset + direction
    const nextWeek = getWeekDays(nextOffset)
    setWeekOffset(nextOffset)
    setSelectedDate(nextWeek[0].key)
    setActiveSession(null)
    setRoster([])
  }

  const loadRoster = async session => {
    setActiveSession(session)
    setRosterLoading(true)
    setRosterError('')
    onSelectSession?.(session)
    try {
      setRoster(await getReceptionistSessionRoster(session.id))
    } catch (requestError) {
      setRoster([])
      setRosterError(requestErrorMessage(requestError, 'Không thể tải danh sách học viên của buổi học.'))
    } finally {
      setRosterLoading(false)
      window.requestAnimationFrame(() => document.getElementById('reception-active-session')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }

  const handleRegistered = result => {
    showNotice?.(`Đã thêm hội viên #${result.memberId} vào buổi học #${result.sessionId}.`)
    if (activeSession?.id === result.sessionId) loadRoster(activeSession)
  }

  if (baseLoading) return <ViewLoader />

  return <div className="reception-schedule-page">
    <section className="reception-card reception-schedule-flow">
      <div className="reception-schedule-flow-title"><span><CalendarDays size={19} /></span><div><small>CHỌN THEO THỨ TỰ</small><strong>Môn thể thao → Huấn luyện viên → Lớp</strong></div></div>
      <label><span>1. Môn thể thao</span><select value={selectedSportId} onChange={event => { setSelectedSportId(event.target.value); setSelectedCoachId(''); setSelectedClassId(''); setActiveSession(null) }}><option value="">Chọn môn thể thao</option>{sports.map(sport => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select></label>
      <label><span>2. Huấn luyện viên</span><select value={selectedCoachId} onChange={event => { setSelectedCoachId(event.target.value); setSelectedClassId(''); setActiveSession(null) }} disabled={!selectedSportId}><option value="">Chọn huấn luyện viên</option>{coaches.map(coach => <option key={coach.id} value={coach.id}>{coach.fullName}{coach.specialization ? ` · ${coach.specialization}` : ''}</option>)}</select></label>
      <label><span>3. Lọc theo lớp</span><select value={selectedClassId} onChange={event => { setSelectedClassId(event.target.value); setActiveSession(null); setRoster([]) }} disabled={!selectedCoachId || classesLoading}><option value="">Tất cả lớp</option>{classes.map(item => <option key={item.id} value={item.id}>{item.className}</option>)}</select></label>
      {baseError && <div className="reception-filter-error"><span>{baseError}</span><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div>}
    </section>

    {!selectedSportId || !selectedCoachId ? <section className="reception-card reception-schedule-onboarding"><EmptyState icon={CalendarDays} title={selectedSportId ? 'Chọn huấn luyện viên' : 'Chọn môn thể thao'} text="Hoàn thành bộ lọc phía trên để hiển thị lịch tuần của huấn luyện viên." /></section> : <>
      <section className="reception-card reception-schedule-classes">
        <div className="reception-card-head"><div><span>LỚP CỦA HUẤN LUYỆN VIÊN</span><h2>Chọn lớp hoặc thêm hội viên</h2></div><strong>{classesLoading ? 'Đang tải...' : `${classes.length} lớp`}</strong></div>
        {classesLoading ? <ViewLoader /> : classesError ? <div className="reception-inline-error"><EmptyState icon={Trophy} title="Không thể tải lớp học" text={classesError} /><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : classes.length ? <div className="reception-schedule-class-list">{classes.map(item => <article key={item.id} className={String(selectedClassId) === String(item.id) ? 'selected' : ''}><button type="button" className="reception-schedule-class-filter" onClick={() => setSelectedClassId(String(item.id))}><span><small>Lớp #{item.id}</small><strong>{item.className}</strong><em>{item.sportName}</em></span><b>{item.maxCapacity} học viên</b></button><button type="button" className="reception-schedule-add-member" onClick={() => setAddMemberClass(item)}><Plus size={14} />Thêm hội viên</button></article>)}</div> : <EmptyState icon={Trophy} title="Chưa có lớp học" text="Huấn luyện viên này chưa phụ trách lớp nào thuộc môn đã chọn." />}
      </section>

      <section className="reception-card reception-week-calendar">
        <button type="button" aria-label="Tuần trước" onClick={() => changeWeek(-1)}><ChevronLeft size={18} /></button>
        <div>{weekDays.map(day => <button type="button" key={day.key} className={selectedDate === day.key ? 'active' : ''} onClick={() => { setSelectedDate(day.key); setActiveSession(null); setRoster([]) }}><span>{day.weekday}</span><strong>{day.date}</strong>{day.today && <i>Hôm nay</i>}{classSessions.some(item => item.date === day.key) && <b aria-label="Có lịch học" />}</button>)}</div>
        <button type="button" aria-label="Tuần sau" onClick={() => changeWeek(1)}><ChevronRight size={18} /></button>
      </section>

      <div className="reception-schedule-layout">
        <section className="reception-card reception-schedule-agenda">
          <div className="reception-schedule-toolbar"><div><strong>Lịch ngày {selectedDay.date}/{selectedDay.month}</strong><span>{sessionsLoading ? 'Đang tải lịch...' : `${allDaySessions.length} buổi học`}</span></div><div>{['Tất cả', 'Đã hoàn thành', 'Đang diễn ra', 'Sắp tới', 'Đã hủy'].map(label => <button type="button" key={label} className={statusFilter === label ? 'active' : ''} onClick={() => setStatusFilter(label)}>{label}</button>)}</div></div>
          {sessionsError ? <div className="reception-inline-error"><EmptyState icon={CalendarDays} title="Không thể tải lịch" text={sessionsError} /><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : sessionsLoading ? <ViewLoader /> : daySessions.length ? <div className="reception-schedule-session-list">{daySessions.map(session => <article key={session.id} className={`${session.tone} ${activeSession?.id === session.id ? 'selected' : ''}`}><button type="button" onClick={() => loadRoster(session)}><time><strong>{session.time}</strong><span>{session.endTime}</span></time><div><span><b className={session.tone}>{session.status}</b><small>{session.coachName}</small></span><h3>{session.className}</h3><p>{session.currentEnrollment}/{session.capacity} học viên đã đăng ký</p><footer><span><Users size={14} />Còn {session.availableSeats} chỗ</span><span><Clock3 size={14} />{session.durationMinutes} phút</span></footer></div></button><button type="button" className="reception-schedule-review" onClick={() => setReviewSession(session)}><Star size={13} />Đánh giá</button></article>)}</div> : <EmptyState icon={CalendarDays} title="Không có buổi học" text="Không có lịch phù hợp với ngày và bộ lọc hiện tại." />}
        </section>
        <aside className="reception-card reception-schedule-summary"><div><CalendarDays size={20} /><span><small>TỔNG QUAN NGÀY</small><strong>{selectedDay.date}/{selectedDay.month}/{selectedDate.slice(0, 4)}</strong></span></div><section><span><strong>{allDaySessions.length}</strong><small>Buổi học</small></span><span><strong>{totalMinutes ? `${(totalMinutes / 60).toFixed(totalMinutes % 60 ? 1 : 0)}h` : '0h'}</strong><small>Thời lượng</small></span><span><strong>{enrollmentCount}</strong><small>Lượt đăng ký</small></span></section></aside>
      </div>

      {activeSession && <section id="reception-active-session" className="reception-card reception-active-session">
        <div className="reception-card-head"><div><span>BUỔI ĐANG CHỌN</span><h2>{activeSession.className} · #{activeSession.id}</h2></div>{activeSession.canComplete && <div className="reception-active-session-actions"><button type="button" onClick={() => setCompleteSession(activeSession)}><CheckCircle2 size={14} />Hoàn thành buổi</button></div>}</div>
        <div className="reception-active-session-meta"><span><CalendarDays size={15} />{formatDateTime(activeSession.startsAt)}</span><span><Users size={15} />{activeSession.currentEnrollment}/{activeSession.capacity} học viên</span><span><Clock3 size={15} />{activeSession.durationMinutes} phút</span></div>
        {rosterLoading ? <ViewLoader /> : rosterError ? <div className="reception-inline-error"><EmptyState icon={Users} title="Không thể tải học viên" text={rosterError} /><button type="button" onClick={() => loadRoster(activeSession)}>Thử lại</button></div> : roster.length ? <div className="reception-roster-table"><div className="reception-roster-heading"><span>Mã đăng ký</span><span>Học viên</span><span>Mã hội viên</span><span>Đăng ký</span><span>Điểm danh</span></div>{roster.map(student => <div className="reception-roster-row" key={student.registrationId}><span>#{student.registrationId}</span><strong>{student.fullName}</strong><span>#{student.memberId}</span><span>{student.registrationStatus}</span><span><b>{student.attendanceStatus || 'Chưa điểm danh'}</b><small>{student.checkInTime ? sessionDateTimeFormatter.format(new Date(student.checkInTime)) : 'Chưa có giờ check-in'}</small></span></div>)}</div> : <EmptyState icon={Users} title="Chưa có học viên" text="Buổi học này chưa có hội viên đăng ký." />}
      </section>}
    </>}

    {addMemberClass && <AddMemberDialog sportClass={addMemberClass} preferredSession={activeSession?.classId === addMemberClass.id ? activeSession : null} onClose={() => setAddMemberClass(null)} onRegistered={handleRegistered} />}
    {reviewSession && <ReviewsDialog session={reviewSession} onClose={() => setReviewSession(null)} />}
    {completeSession && <CompleteDialog session={completeSession} onClose={() => setCompleteSession(null)} onCompleted={() => { setSessions(current => current.map(item => item.id === completeSession.id ? { ...item, status: 'Đã hoàn thành', tone: 'done', canComplete: false } : item)); showNotice?.(`Đã hoàn thành buổi ${completeSession.className}.`) }} />}
  </div>
}
