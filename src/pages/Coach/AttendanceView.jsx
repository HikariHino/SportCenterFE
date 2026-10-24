import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, UserCheck, Users } from 'lucide-react'
import WeeklyTimetable from '../../components/WeeklyTimetable'
import { getCoachSessionAttendances, getCoachSessionRoster, getMyCoachSessions, markCoachAttendance } from '../../services/coachService'
import { shiftTimetableDate, timetableWeekStart } from '../../utils/memberTimetable'
import { attendanceOptions, EmptyState, formatSessionOption, getStudentsError, initials, mapRosterStudent } from './CoachViewShared'

const isCancelledSession = session => ['cancelled', 'canceled'].includes(String(session?.status || '').trim().toLowerCase())

const getAttendanceAvailability = session => {
  if (!session) return { open: false, message: 'Chưa chọn buổi huấn luyện' }
  if (isCancelledSession(session)) return { open: false, message: 'Buổi học đã bị hủy' }
  return { open: true, message: 'Có thể ghi nhận hoặc cập nhật trạng thái điểm danh' }
}

const getSessionStatusLabel = (session, now = Date.now()) => {
  const status = String(session?.status || '').trim().toLowerCase()
  if (isCancelledSession(session)) return 'Đã hủy'
  if (status === 'completed') return 'Đã hoàn thành'
  const startsAt = new Date(session?.startsAt).getTime()
  const endsAt = new Date(session?.endsAt).getTime()
  if (Number.isFinite(startsAt) && Number.isFinite(endsAt) && startsAt <= now && endsAt > now) return 'Đang diễn ra'
  if (Number.isFinite(endsAt) && endsAt <= now) return 'Đã kết thúc'
  return 'Sắp diễn ra'
}

export function AttendanceView({ query, showNotice, selectedSession: sharedSelectedSession, selectedSessionId, onSelectSession }) {
  const [weekStart, setWeekStart] = useState(() => timetableWeekStart(sharedSelectedSession?.startsAt || Date.now()))
  const [sessions, setSessions] = useState([])
  const [students, setStudents] = useState([])
  const [status, setStatus] = useState('Tất cả')
  const [scheduleLoading, setScheduleLoading] = useState(true)
  const [rosterLoading, setRosterLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState('')
  const [rosterError, setRosterError] = useState('')
  const [actionError, setActionError] = useState('')
  const [markingId, setMarkingId] = useState(null)
  const [attendanceSelections, setAttendanceSelections] = useState({})
  const [scheduleRequestKey, setScheduleRequestKey] = useState(0)
  const [rosterRequestKey, setRosterRequestKey] = useState(0)

  useEffect(() => {
    if (sharedSelectedSession?.startsAt) setWeekStart(timetableWeekStart(sharedSelectedSession.startsAt))
  }, [sharedSelectedSession?.id, sharedSelectedSession?.startsAt])

  useEffect(() => {
    let active = true
    const from = new Date(`${weekStart}T00:00:00+07:00`)
    const to = new Date(`${shiftTimetableDate(weekStart, 7)}T00:00:00+07:00`)

    const loadSessions = async () => {
      setScheduleLoading(true)
      setScheduleError('')
      try {
        const result = await getMyCoachSessions({ from: from.toISOString(), to: to.toISOString(), pageSize: 100 })
        if (active) setSessions(result.items.filter(session => !isCancelledSession(session)))
      } catch (requestError) {
        if (active) {
          setSessions([])
          setScheduleError(getStudentsError(requestError))
        }
      } finally {
        if (active) setScheduleLoading(false)
      }
    }

    loadSessions()
    return () => { active = false }
  }, [scheduleRequestKey, weekStart])

  useEffect(() => {
    let active = true
    if (!selectedSessionId) {
      setStudents([])
      setRosterError('')
      setRosterLoading(false)
      return () => { active = false }
    }

    const loadAttendances = async () => {
      setRosterLoading(true)
      setRosterError('')
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
          setRosterError(getStudentsError(requestError))
        }
      } finally {
        if (active) setRosterLoading(false)
      }
    }
    loadAttendances()
    return () => { active = false }
  }, [rosterRequestKey, selectedSessionId])

  const selectedSession = sessions.find(session => String(session.id) === String(selectedSessionId))
    || (String(sharedSelectedSession?.id) === String(selectedSessionId) ? sharedSelectedSession : null)
  const attendanceAvailability = getAttendanceAvailability(selectedSession)
  const normalizedQuery = query.trim().toLocaleLowerCase('vi')
  const filtered = students.filter(student => {
    const matchesStatus = status === 'Tất cả' || student.attendanceStatus === status
    const matchesQuery = !normalizedQuery || `${student.name} ${student.memberId} ${student.registrationStatus} ${student.attendanceStatus}`.toLocaleLowerCase('vi').includes(normalizedQuery)
    return matchesStatus && matchesQuery
  })
  const presentCount = students.filter(student => ['Đã điểm danh', 'Đi trễ'].includes(student.attendanceStatus)).length
  const pendingCount = students.filter(student => student.attendanceStatus === 'Chưa điểm danh').length
  const selectedIds = useMemo(() => selectedSessionId ? [selectedSessionId] : [], [selectedSessionId])

  const handleSelectTimetableSession = sessionId => {
    const session = sessions.find(item => String(item.id) === String(sessionId))
    if (!session) return
    onSelectSession?.(session)
    setStatus('Tất cả')
    setActionError('')
  }

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

  return <div className="coach-section-view">
    <div className="coach-attendance-timetable">
      {scheduleError && <div className="coach-attendance-schedule-error" role="alert"><span>{scheduleError}</span><button className="coach-retry-button" type="button" onClick={() => setScheduleRequestKey(key => key + 1)}>Thử lại</button></div>}
      <WeeklyTimetable
        items={sessions}
        weekStart={weekStart}
        onWeekChange={setWeekStart}
        onSelect={handleSelectTimetableSession}
        selectedSessionIds={selectedIds}
        getStatusLabel={getSessionStatusLabel}
        interactionDisabled={scheduleLoading}
        title="Thời khóa biểu điểm danh"
        description={scheduleLoading ? 'Đang tải các buổi huấn luyện Coach phụ trách...' : 'Bấm vào một buổi học để xem học viên và điểm danh ngay bên dưới.'}
      />
    </div>

    {!selectedSessionId ? <section className="coach-card coach-roster-state"><EmptyState title="Chọn buổi học trên thời khóa biểu" text="Danh sách học viên và thao tác điểm danh sẽ xuất hiện sau khi bạn chọn một buổi." /></section> : <>
      <section className="coach-card coach-session-picker coach-attendance-selected-session">
        <div className="coach-session-picker-main"><span><UserCheck size={21} /></span><div><small>BUỔI ĐANG ĐIỂM DANH</small><strong>{selectedSession?.className || 'Buổi huấn luyện'}</strong><p>{selectedSession ? formatSessionOption(selectedSession) : `Buổi học #${selectedSessionId}`}</p></div></div>
        <b>Buổi #{selectedSessionId}</b>
      </section>

      <section className="coach-student-kpis coach-attendance-kpis">
        <article><span className="blue"><Users size={21} /></span><div><small>Đăng ký trong buổi</small><strong>{students.length}</strong><p>Danh sách học viên</p></div></article>
        <article><span className="green"><CheckCircle2 size={21} /></span><div><small>Đã điểm danh</small><strong>{presentCount}</strong><p>Đã đồng bộ trạng thái</p></div></article>
        <article><span className="purple"><Clock3 size={21} /></span><div><small>Chưa điểm danh</small><strong>{pendingCount}</strong><p>{attendanceAvailability.message}</p></div></article>
      </section>

      <section className="coach-card coach-attendance-list">
        <div className="coach-view-toolbar"><div><strong>Điểm danh học viên</strong><span>{rosterLoading ? 'Đang đồng bộ...' : `${filtered.length} học viên`}</span></div><div className="coach-filter-pills">{['Tất cả', 'Đã điểm danh', 'Chưa điểm danh', 'Vắng mặt', 'Có phép'].map(label => <button type="button" key={label} className={status === label ? 'active' : ''} onClick={() => setStatus(label)}>{label}</button>)}</div></div>
        <div className={`coach-checkin-window ${attendanceAvailability.open ? 'open' : ''}`}><Clock3 size={16} /><span><strong>{attendanceAvailability.open ? 'Có thể cập nhật điểm danh' : 'Không thể điểm danh'}</strong><small>{attendanceAvailability.message}. Trạng thái được lưu trực tiếp trên hệ thống.</small></span></div>
        {actionError && <div className="coach-attendance-error" role="alert">{actionError}</div>}
        {rosterLoading ? <EmptyState title="Đang tải danh sách điểm danh" text="Dữ liệu đang được đồng bộ từ hệ thống." /> : rosterError ? <div className="coach-inline-error"><EmptyState title="Không thể tải điểm danh" text={rosterError} /><button className="coach-retry-button" type="button" onClick={() => setRosterRequestKey(key => key + 1)}>Thử lại</button></div> : filtered.length ? <div className="coach-attendance-table"><div className="coach-attendance-heading"><span>Học viên</span><span>Đăng ký</span><span>Trạng thái</span><span>Thao tác</span></div>{filtered.map(student => {
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
    </>}
  </div>
}
