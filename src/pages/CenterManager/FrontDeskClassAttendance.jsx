import { useEffect, useId, useRef, useState } from 'react'
import { AlertCircle, BookOpen, CalendarDays, Check, ChevronRight, Clock3, MapPin, RefreshCw, Search, Trash2, UserRound, Users, X } from 'lucide-react'
import { loadSchedulingPages } from '../../services/sessionSchedulingService'
import { cancelReceptionistRegistration, checkInReceptionistRegistration, getReceptionistSessionRoster } from '../../services/receptionistClassService'
import { getClassErrorMessage } from '../../services/sportClassService'
import { frontDeskCheckInReason, frontDeskSessionStatus, isFrontDeskPresent } from '../../utils/frontDeskAttendance'
import { getRoomForClass } from '../../utils/memberClasses'
import { isCancelledSession, isScheduledSession } from '../../utils/sessionScheduling'
import '../../style/CenterManager/FrontDeskClassBooking.css'
import '../../style/CenterManager/FrontDeskClassAttendance.css'

const date = value => value ? new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa cập nhật'
const time = value => value ? new Date(value).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '—'
const dateTime = value => value ? `${date(value)} ${time(value)}` : '—'
const empty = { items: [], loading: false, error: '' }

function SessionButton({ item, selected, disabled, onSelect, now }) {
  return <button type="button" className={`fdesk-booking-session fdesk-attendance-session${selected ? ' is-selected' : ''}`} aria-pressed={selected} disabled={disabled} onClick={() => onSelect(String(item.id))}>
    <span className="fdesk-booking-session-content"><strong>{date(item.startsAt)}</strong><span><Clock3 size={14} />{time(item.startsAt)} – {time(item.endsAt)}{date(item.startsAt) !== date(item.endsAt) ? ` (${date(item.endsAt)})` : ''}</span><small><Users size={13} />{item.currentEnrollment ?? 0}/{item.capacity ?? '—'} học viên{item.coachName ? ` · ${item.coachName}` : ''}</small>{isCancelledSession(item) && <span className="fdesk-attendance-cancel-reason">Lý do hủy: {item.cancellationReason || 'Chưa cập nhật'}</span>}</span><span className="fdesk-booking-session-tag">{frontDeskSessionStatus(item, now)}</span>
  </button>
}

export default function FrontDeskClassAttendance({ reloadKey = 0, disabled = false, onBusyChange, onRegistrationsChanged }) {
  const id = useId()
  const lock = useRef(false)
  const [revision, setRevision] = useState(0)
  const [rosterRevision, setRosterRevision] = useState(0)
  const [catalog, setCatalog] = useState({ ...empty, loading: true })
  const [classId, setClassId] = useState('')
  const [sessions, setSessions] = useState({ ...empty, key: '' })
  const [sessionId, setSessionId] = useState('')
  const [roster, setRoster] = useState({ ...empty, key: '' })
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [cancelStudent, setCancelStudent] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [now, setNow] = useState(Date.now)
  const blocked = disabled || busy
  const selectedClass = catalog.items.find(item => String(item.id) === classId)
  const classSessions = sessions.key === classId ? sessions.items : []
  const scheduledSessions = classSessions.filter(isScheduledSession)
  const cancelledSessions = classSessions.filter(isCancelledSession).sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))
  const selectedSession = classSessions.find(item => String(item.id) === sessionId)
  const students = roster.key === sessionId ? roster.items : []
  const loadingRoster = Boolean(sessionId) && (roster.key !== sessionId || roster.loading)
  const loadingSessions = Boolean(classId) && (sessions.key !== classId || sessions.loading)
  const room = selectedClass && getRoomForClass(selectedClass)
  const filteredClasses = catalog.items.filter(item => `${item.className} ${item.sportName || ''} ${item.coachName || ''}`.toLocaleLowerCase('vi-VN').includes(query.trim().toLocaleLowerCase('vi-VN')))
  const presentCount = students.filter(isFrontDeskPresent).length

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setCatalog({ ...empty, loading: true })
    setClassId('')
    setSessionId('')
    setCancelStudent(null)
    loadSchedulingPages('/classes/manage', controller.signal).then(items => {
      if (!controller.signal.aborted) setCatalog({ items, loading: false, error: '' })
    }).catch(error => {
      if (!controller.signal.aborted) setCatalog({ ...empty, error: getClassErrorMessage(error, 'Không thể tải danh sách lớp học.') })
    })
    return () => controller.abort()
  }, [revision, reloadKey])

  useEffect(() => {
    if (!classId) return
    const controller = new AbortController()
    setSessions({ ...empty, key: classId, loading: true })
    loadSchedulingPages(`/classes/${classId}/sessions`, controller.signal).then(items => {
      if (!controller.signal.aborted) setSessions({ key: classId, items: [...items].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)), loading: false, error: '' })
    }).catch(error => {
      if (!controller.signal.aborted) setSessions({ ...empty, key: classId, error: getClassErrorMessage(error, 'Không thể tải các buổi học.') })
    })
    return () => controller.abort()
  }, [classId, revision, reloadKey])

  useEffect(() => {
    if (!sessionId || !classId) return
    const controller = new AbortController()
    setRoster({ ...empty, key: sessionId, loading: true })
    getReceptionistSessionRoster(sessionId, controller.signal).then(items => {
      if (!controller.signal.aborted) setRoster({ key: sessionId, items, loading: false, error: '' })
    }).catch(error => {
      if (!controller.signal.aborted) setRoster({ ...empty, key: sessionId, error: getClassErrorMessage(error, 'Không thể tải danh sách học viên.') })
    })
    return () => controller.abort()
  }, [classId, sessionId, rosterRevision, reloadKey])

  const chooseClass = value => {
    if (blocked) return
    setClassId(value); setSessionId(''); setFeedback(null); setCancelStudent(null)
  }
  const chooseSession = value => {
    if (blocked) return
    setSessionId(value); setFeedback(null); setCancelStudent(null)
  }
  const mutate = async (student, cancel = false) => {
    if (lock.current || blocked || loadingRoster || !selectedSession || roster.error) return
    if (!cancel && frontDeskCheckInReason(selectedSession, student)) return
    lock.current = true
    setBusy(true); onBusyChange?.(true); setFeedback(null)
    try {
      if (cancel) await cancelReceptionistRegistration(student.registrationId, cancelReason.trim() || 'Hủy tại quầy lễ tân')
      else await checkInReceptionistRegistration(student.registrationId)
      setFeedback({ error: false, message: cancel ? `Đã hủy chỗ của ${student.fullName}.` : `Đã điểm danh có mặt cho ${student.fullName}.` })
      setCancelStudent(null); setCancelReason('')
      if (cancel) onRegistrationsChanged?.()
    } catch (error) {
      setFeedback({ error: true, message: getClassErrorMessage(error, cancel ? 'Không thể hủy đăng ký.' : 'Không thể điểm danh học viên.') })
    } finally {
      // Refresh after either outcome, including a saved write whose response was lost.
      setRosterRevision(value => value + 1)
      lock.current = false; setBusy(false); onBusyChange?.(false)
    }
  }

  return <section className="fdesk-card fdesk-booking fdesk-attendance" aria-labelledby={`${id}-title`} aria-busy={busy}>
    <header className="fdesk-card-header"><div><h3 id={`${id}-title`}><Users size={20} />Danh sách học viên & Điểm danh buổi học</h3><p>Chọn lớp, chọn buổi học để xem danh sách học viên và điểm danh có mặt.</p></div><button type="button" className="fdesk-btn fdesk-btn-secondary" disabled={blocked} onClick={() => { setRevision(value => value + 1); setFeedback(null) }}><RefreshCw size={15} />Làm mới</button></header>
    <div className="fdesk-booking-body">
      <label className="fdesk-input-group" htmlFor={`${id}-search`}><span>Tìm lớp học</span><span className="fdesk-booking-search"><Search size={16} /><input id={`${id}-search`} type="search" placeholder="Tên lớp, bộ môn hoặc huấn luyện viên" value={query} disabled={blocked} onChange={event => setQuery(event.target.value)} /></span></label>
      <div className="fdesk-booking-layout">
        <div className="fdesk-booking-catalog"><div className="fdesk-booking-section-heading"><h4>1. Chọn lớp học</h4><span>{filteredClasses.length} lớp</span></div>
          {catalog.loading ? <p className="fdesk-booking-state" role="status">Đang tải lớp học...</p> : catalog.error ? <div className="fdesk-alert-danger" role="alert">{catalog.error}<button className="fdesk-btn fdesk-btn-secondary" type="button" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div> : !filteredClasses.length ? <p className="fdesk-booking-state">Không có lớp học phù hợp.</p> : <div className="fdesk-booking-class-list">{filteredClasses.map(item => <button type="button" key={item.id} className={`fdesk-booking-class${String(item.id) === classId ? ' is-selected' : ''}`} aria-pressed={String(item.id) === classId} disabled={blocked} onClick={() => chooseClass(String(item.id))}>
            <span className="fdesk-booking-class-top"><span className="fdesk-booking-sport">{item.sportName || 'Lớp thể thao'}{item.isActive === false ? ' · Ngừng hoạt động' : ''}</span><ChevronRight size={18} /></span><strong>{item.className}</strong><span><UserRound size={14} />{item.coachName || 'Chưa phân công HLV'}</span><span><CalendarDays size={14} />{date(item.startDate)} – {date(item.endDate)}</span><span><MapPin size={14} />{getRoomForClass(item)?.name || item.roomName || 'Chưa cập nhật phòng'}</span>
          </button>)}</div>}
        </div>
        <div className="fdesk-booking-sessions"><div className="fdesk-booking-section-heading"><h4>2. Chọn buổi học</h4><span>{scheduledSessions.length} buổi đã lên lịch</span></div>
          {!selectedClass ? <div className="fdesk-booking-placeholder"><BookOpen size={32} /><strong>Chọn lớp để xem các buổi học</strong></div> : <><div className="fdesk-booking-session-heading"><h4>{selectedClass.className}</h4><p><MapPin size={14} />{room?.name || selectedClass.roomName || 'Chưa cập nhật phòng'}</p></div>
            {loadingSessions ? <p className="fdesk-booking-state" role="status">Đang tải các buổi học...</p> : sessions.error ? <div className="fdesk-alert-danger" role="alert">{sessions.error}<button type="button" className="fdesk-btn fdesk-btn-secondary" onClick={() => { setClassId(''); setSessionId('') }}>Chọn lại lớp</button></div> : <>
              {scheduledSessions.length ? <div className="fdesk-booking-session-list fdesk-attendance-scheduled">{scheduledSessions.map(item => <SessionButton key={item.id} item={item} selected={String(item.id) === sessionId} disabled={blocked} onSelect={chooseSession} now={now} />)}</div> : <p className="fdesk-booking-state">Lớp không có buổi học nào ở trạng thái đã lên lịch.</p>}
              <details className="fdesk-attendance-cancelled" key={classId}><summary>Buổi học đã hủy <span>{cancelledSessions.length} buổi</span></summary>
                <p className="fdesk-booking-state">Các buổi đã hủy chỉ xem danh sách học viên, không thể điểm danh.</p>
                {cancelledSessions.length ? <div className="fdesk-booking-session-list">{cancelledSessions.map(item => <SessionButton key={item.id} item={item} selected={String(item.id) === sessionId} disabled={blocked} onSelect={chooseSession} now={now} />)}</div> : <p className="fdesk-booking-state">Lớp chưa có buổi học nào bị hủy.</p>}
              </details>
            </>}
          </>}
        </div>
      </div>
      <div className="fdesk-attendance-roster" aria-live="polite">
        <div className="fdesk-booking-section-heading"><div><h4>3. Danh sách học viên</h4>{selectedSession && <p className="fdesk-attendance-summary">{selectedClass?.className} · {date(selectedSession.startsAt)} · {time(selectedSession.startsAt)} – {time(selectedSession.endsAt)}</p>}</div>{selectedSession && <button type="button" className="fdesk-btn fdesk-btn-secondary" disabled={blocked || loadingRoster} onClick={() => setRosterRevision(value => value + 1)}><RefreshCw size={14} />Làm mới danh sách</button>}</div>
        {feedback && <p className={feedback.error ? 'fdesk-alert-danger' : 'fdesk-booking-result'} role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>}
        {!selectedSession ? <div className="fdesk-booking-placeholder"><CalendarDays size={32} /><strong>Chọn buổi học để xem danh sách và điểm danh</strong></div> : loadingRoster ? <p className="fdesk-booking-state" role="status">Đang tải danh sách học viên...</p> : roster.error ? <div className="fdesk-alert-danger" role="alert"><AlertCircle size={16} />{roster.error}<button type="button" className="fdesk-btn fdesk-btn-secondary" onClick={() => setRosterRevision(value => value + 1)}>Thử lại</button></div> : <>
          <div className="fdesk-attendance-stats"><span>{students.length} học viên đăng ký</span><span>{presentCount} có mặt</span><span>{students.length - presentCount} chưa có mặt</span></div>
          <p className="fdesk-booking-state">Điểm danh mở từ 30 phút trước giờ học đến trước khi buổi học kết thúc. Buổi đã hủy hoặc kết thúc chỉ xem danh sách.</p>
          {!students.length ? <p className="fdesk-booking-state">Buổi học này chưa có học viên nào đăng ký.</p> : <div className="fdesk-table-scroll"><table className="fdesk-table"><thead><tr><th>Học viên</th><th>Đăng ký</th><th>Điểm danh</th><th>Thời gian điểm danh</th><th>Thao tác</th></tr></thead><tbody>{students.map(student => {
            const present = isFrontDeskPresent(student)
            const reason = frontDeskCheckInReason(selectedSession, student, now)
            const canCancel = String(student.registrationStatus).toLowerCase() === 'registered' && String(selectedSession.status).toLowerCase() === 'scheduled' && !present
            return <tr key={student.registrationId}><td><strong>{student.fullName || 'Học viên'}</strong><small className="fdesk-attendance-member-id">#{student.memberId}</small></td><td><span className="fdesk-badge info">{student.registrationStatus === 'Registered' ? 'Đã đăng ký' : student.registrationStatus}</span></td><td><span className={`fdesk-badge ${present ? 'present' : 'absent'}`}>{present ? <><Check size={12} />Có mặt</> : student.attendanceStatus === 'Absent' ? 'Vắng mặt' : 'Chưa điểm danh'}</span></td><td>{dateTime(student.checkInTime)}</td><td><div className="fdesk-action-group"><button type="button" className="fdesk-btn fdesk-btn-success" disabled={blocked || Boolean(reason)} title={reason || 'Điểm danh có mặt'} onClick={() => mutate(student)}><Check size={12} />{present ? 'Đã điểm danh' : 'Điểm danh'}</button>{canCancel && <button type="button" className="fdesk-btn fdesk-btn-danger" disabled={blocked} onClick={() => { setCancelStudent(student); setCancelReason('') }}><Trash2 size={12} />Hủy chỗ</button>}</div>{!present && reason && <small className="fdesk-attendance-reason">{reason}</small>}</td></tr>
          })}</tbody></table></div>}
        </>}
      </div>
    </div>
    {cancelStudent && <div className="fdesk-dialog-overlay" onClick={() => { if (!busy) setCancelStudent(null) }}><div className="fdesk-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-cancel-title`} onClick={event => event.stopPropagation()}><div className="fdesk-dialog-header"><h3 id={`${id}-cancel-title`}>Hủy đăng ký buổi học</h3><button type="button" className="fdesk-dialog-close" aria-label="Đóng" disabled={busy} onClick={() => setCancelStudent(null)}><X size={18} /></button></div><div className="fdesk-dialog-body"><p>Hủy chỗ của <strong>{cancelStudent.fullName}</strong> trong buổi học {dateTime(selectedSession?.startsAt)}?</p><label className="fdesk-input-group" htmlFor={`${id}-cancel-reason`}>Lý do hủy<input id={`${id}-cancel-reason`} className="fdesk-input" value={cancelReason} disabled={busy} onChange={event => setCancelReason(event.target.value)} placeholder="Học viên yêu cầu hủy tại quầy..." /></label>{feedback?.error && <p role="alert" className="fdesk-alert-danger">{feedback.message}</p>}</div><div className="fdesk-dialog-footer"><button type="button" className="fdesk-btn fdesk-btn-secondary" disabled={busy} onClick={() => setCancelStudent(null)}>Giữ lại</button><button type="button" className="fdesk-btn fdesk-btn-danger" disabled={blocked} onClick={() => mutate(cancelStudent, true)}>{busy ? 'Đang hủy...' : 'Xác nhận hủy chỗ'}</button></div></div></div>}
  </section>
}
