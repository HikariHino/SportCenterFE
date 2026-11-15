import { useCoachResource } from '../../contexts/CoachWorkspaceContext'
import { coachAttendancesKey, coachRosterKey, coachSessionsKey, coachWeekRange } from '../../services/coachWorkspaceReads'
import RefreshStatus from './RefreshStatus'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, ChevronLeft, Clock3, UserCheck, Users } from 'lucide-react'
import WeeklyTimetable from '../../components/WeeklyTimetable'
import { getCoachSessionAttendances, getCoachSessionRoster, getMyCoachSessions, markCoachAttendance } from '../../services/coachService'
import { timetableWeekStart } from '../../utils/memberTimetable'
import { attendanceOptions, EmptyState, formatSessionOption, getStudentsError, initials, mapRosterStudent } from './CoachViewShared'
import { notifyCoachDataChanged } from '../../hooks/useCoachViewRefresh'
import useCoachAttendanceWindow from '../../hooks/useCoachAttendanceWindow'
import { getCoachAttendanceAvailability } from '../../utils/coachAttendance'

const isCancelledSession = session => ['cancelled', 'canceled'].includes(String(session?.status || '').trim().toLowerCase())

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

export function AttendanceView({ active = true, query, showNotice, selectedSession: sharedSelectedSession, selectedSessionId, onSelectSession }) {
  const [weekStart, setWeekStart] = useState(() => timetableWeekStart(sharedSelectedSession?.startsAt || Date.now()))
  const [status, setStatus] = useState('Tất cả')
  const [actionError, setActionError] = useState('')
  const [markingId, setMarkingId] = useState(null)
  const [attendanceSelections, setAttendanceSelections] = useState({})
  const [scheduleRequestKey, setScheduleRequestKey] = useState(0)
  const [rosterRequestKey, setRosterRequestKey] = useState(0)
  const [attendancePageOpen, setAttendancePageOpen] = useState(false)

  useEffect(() => {
    if (sharedSelectedSession?.startsAt) setWeekStart(timetableWeekStart(sharedSelectedSession.startsAt))
  }, [sharedSelectedSession?.id, sharedSelectedSession?.startsAt])

  const range = coachWeekRange(weekStart)
  const scheduleQuery = useCoachResource(coachSessionsKey(range), () => getMyCoachSessions(range), { initialData: { items: [] }, refreshKey: scheduleRequestKey })
  const sessions = useMemo(() => scheduleQuery.data.items.filter(session => !isCancelledSession(session)), [scheduleQuery.data])
  const scheduleLoading = scheduleQuery.loading
  const scheduleError = scheduleQuery.error ? getStudentsError(scheduleQuery.error) : ''
  const rosterEnabled = attendancePageOpen && !!selectedSessionId && markingId === null
  const rosterQuery = useCoachResource(coachRosterKey(selectedSessionId), () => getCoachSessionRoster(selectedSessionId), { initialData: [], enabled: rosterEnabled, refreshKey: rosterRequestKey })
  const attendancesQuery = useCoachResource(coachAttendancesKey(selectedSessionId), () => getCoachSessionAttendances(selectedSessionId), { initialData: [], enabled: rosterEnabled, refreshKey: rosterRequestKey })
  const students = useMemo(() => {
    if (!attendancePageOpen || !selectedSessionId) return []
    const attendanceByMember = new Map(attendancesQuery.data.map(item => [Number(item.memberId), item]))
    return rosterQuery.data.map(student => {
      const attendance = attendanceByMember.get(Number(student.memberId))
      return mapRosterStudent({ ...student, attendanceStatus: attendance?.status ?? student.attendanceStatus, checkInTime: attendance?.checkInTime ?? student.checkInTime })
    })
  }, [attendancePageOpen, selectedSessionId, attendancesQuery.data, rosterQuery.data])
  const rosterLoading = rosterQuery.loading || attendancesQuery.loading
  const rosterError = rosterQuery.error || attendancesQuery.error ? getStudentsError(rosterQuery.error || attendancesQuery.error) : ''
  const refreshing = scheduleQuery.refreshing || rosterQuery.refreshing || attendancesQuery.refreshing
  const selectionSession = useRef(null)
  useEffect(() => {
    const sameSession = selectionSession.current === selectedSessionId
    setAttendanceSelections(current => Object.fromEntries(students.map(student => [student.id, sameSession ? current[student.id] || student.attendanceValue : student.attendanceValue])))
    selectionSession.current = selectedSessionId
  }, [selectedSessionId, students])

  const selectedSession = sessions.find(session => String(session.id) === String(selectedSessionId))
    || (String(sharedSelectedSession?.id) === String(selectedSessionId) ? sharedSelectedSession : null)
  const attendanceAvailability = useCoachAttendanceWindow(selectedSession, active && attendancePageOpen)
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
    setAttendancePageOpen(true)
  }

  const handleMarkAttendance = async student => {
    if (markingId !== null) return
    const availability = getCoachAttendanceAvailability(selectedSession)
    if (!availability.open) { setActionError(availability.message); return }
    setMarkingId(student.registrationId)
    setActionError('')
    try {
      const attendance = await markCoachAttendance({
        memberId: student.memberId,
        sessionId: Number(selectedSessionId),
        status: attendanceSelections[student.id] || 'Present',
      })
      rosterQuery.setData(current => current.map(item => Number(item.registrationId) === Number(student.registrationId)
        ? { ...item, attendanceStatus: attendance.status, checkInTime: attendance.checkInTime } : item))
      attendancesQuery.setData(current => [...current.filter(item => Number(item.memberId) !== Number(student.memberId)), { ...attendance, memberId: student.memberId }])
      const updated = mapRosterStudent({ ...student, fullName: student.name, attendanceStatus: attendance.status, checkInTime: attendance.checkInTime })
      setAttendanceSelections(current => ({ ...current, [student.id]: updated.attendanceValue }))
      notifyCoachDataChanged('attendance')
      showNotice(`Đã cập nhật ${student.name}: ${updated.attendanceStatus}.`)
    } catch (requestError) {
      setActionError(getStudentsError(requestError))
    } finally {
      setMarkingId(null)
    }
  }

  if (!attendancePageOpen || !selectedSessionId) return <div className="coach-section-view">
    <RefreshStatus refreshing={refreshing} />
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
        title="Thời khóa biểu huấn luyện"
        description={scheduleLoading ? 'Đang tải các buổi huấn luyện Coach phụ trách...' : 'Bấm vào một buổi học để mở trang điểm danh.'}
      />
    </div>
  </div>

  return <div className="coach-section-view coach-attendance-page">
      <RefreshStatus refreshing={refreshing} error={rosterError} onRetry={() => setRosterRequestKey(key => key + 1)} />
      <button type="button" className="coach-schedule-detail-back" onClick={() => setAttendancePageOpen(false)}><ChevronLeft size={16} />Quay lại thời khóa biểu</button>
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
        {rosterLoading ? <EmptyState title="Đang tải danh sách điểm danh" text="Dữ liệu đang được đồng bộ từ hệ thống." /> : rosterError && !rosterQuery.hasData ? <div className="coach-inline-error"><EmptyState title="Không thể tải điểm danh" text={rosterError} /><button className="coach-retry-button" type="button" onClick={() => setRosterRequestKey(key => key + 1)}>Thử lại</button></div> : filtered.length ? <div className="coach-attendance-table"><div className="coach-attendance-heading"><span>Học viên</span><span>Đăng ký</span><span>Trạng thái</span><span>Thao tác</span></div>{filtered.map(student => {
          const isMarking = markingId === student.registrationId
          const canMark = attendanceAvailability.open && !markingId
          return <article className="coach-attendance-row" key={student.id}>
            <span className="coach-roster-person"><i className="coach-student-avatar blue">{initials(student.name)}</i><span><strong>{student.name}</strong><small>Member #{student.memberId}</small></span></span>
            <span><strong>{student.registrationStatus}</strong><small>Đăng ký #{student.registrationId}</small></span>
            <span><strong className={`coach-attendance ${student.attendanceTone}`}>{student.attendanceStatus}</strong><small>{student.checkInTime}</small></span>
            <span className="coach-attendance-actions"><select aria-label={`Trạng thái điểm danh của ${student.name}`} value={attendanceSelections[student.id] || 'Present'} disabled={!canMark} onChange={event => setAttendanceSelections(current => ({ ...current, [student.id]: event.target.value }))}>{attendanceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button type="button" className="coach-checkin-button" disabled={!canMark} onClick={() => handleMarkAttendance(student)}>{isMarking ? 'Đang lưu...' : student.attendanceTone === 'pending' ? 'Lưu' : 'Cập nhật'}</button></span>
          </article>
        })}</div> : <EmptyState title="Chưa có học viên" text={query || status !== 'Tất cả' ? 'Không có học viên phù hợp với bộ lọc.' : 'Buổi huấn luyện này chưa có hội viên đăng ký.'} />}
      </section>
  </div>
}
