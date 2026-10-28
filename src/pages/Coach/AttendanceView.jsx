import { useEffect, useState } from 'react'
import { CheckCircle2, Clock3, UserCheck, Users } from 'lucide-react'
import { getCoachSessionAttendances, getCoachSessionRoster, getMyCoachSessions, markCoachAttendance } from '../../services/coachService'
import { attendanceOptions, EmptyState, formatSessionOption, getStudentsError, initials, mapRosterStudent, ViewLoader } from './CoachViewShared'

const getAttendanceAvailability = session => {
  if (!session) return { open: false, message: 'Chưa chọn buổi huấn luyện' }
  if (String(session.status || '').toLowerCase() === 'cancelled') return { open: false, message: 'Buổi học đã bị hủy' }
  return { open: true, message: 'Có thể ghi nhận hoặc cập nhật trạng thái điểm danh' }
}

export function AttendanceView({ query, showNotice, selectedSessionId, onSelectSession }) {
  const [sessions, setSessions] = useState([])
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
        if (!selectedSessionId || !result.items.some(session => String(session.id) === String(selectedSessionId))) {
          const upcoming = result.items.find(session => new Date(session.endsAt) >= new Date())
          const fallback = upcoming ?? result.items[0]
          if (fallback) onSelectSession?.(fallback)
        }
      } catch (requestError) {
        if (active) {
          setSessions([])
          setError(getStudentsError(requestError))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadSessions()
    return () => { active = false }
  }, [onSelectSession, requestKey])

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

  if (loading && !sessions.length) return <ViewLoader />
  if (!sessions.length) return <section className="coach-card coach-roster-state"><EmptyState title={error ? 'Không thể tải dữ liệu điểm danh' : 'Chưa có buổi để điểm danh'} text={error || 'Huấn luyện viên chưa được phân công buổi học nào.'} />{error && <button className="coach-retry-button" type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button>}</section>

  return <div className="coach-section-view">
    <section className="coach-card coach-session-picker">
      <div className="coach-session-picker-main"><span><UserCheck size={21} /></span><div><small>BUỔI ĐIỂM DANH</small><strong>{selectedSession?.className || 'Buổi huấn luyện'}</strong><p>{selectedSession ? formatSessionOption(selectedSession) : 'Chọn một buổi để điểm danh'}</p></div></div>
      <label><span>Chọn buổi huấn luyện</span><select value={selectedSessionId} onChange={event => { const session = sessions.find(item => String(item.id) === event.target.value); if (session) onSelectSession?.(session); setStatus('Tất cả') }}>{sessions.map(session => <option key={session.id} value={session.id}>{formatSessionOption(session)}</option>)}</select></label>
    </section>

    <section className="coach-student-kpis coach-attendance-kpis">
      <article><span className="blue"><Users size={21} /></span><div><small>Đăng ký trong buổi</small><strong>{students.length}</strong><p>Danh sách roster</p></div></article>
      <article><span className="green"><CheckCircle2 size={21} /></span><div><small>Đã điểm danh</small><strong>{presentCount}</strong><p>Đồng bộ dữ liệu điểm danh</p></div></article>
      <article><span className="purple"><Clock3 size={21} /></span><div><small>Chưa điểm danh</small><strong>{pendingCount}</strong><p>{attendanceAvailability.message}</p></div></article>
    </section>

    <section className="coach-card coach-attendance-list">
      <div className="coach-view-toolbar"><div><strong>Điểm danh học viên</strong><span>{loading ? 'Đang đồng bộ...' : `${filtered.length} học viên`}</span></div><div className="coach-filter-pills">{['Tất cả', 'Đã điểm danh', 'Chưa điểm danh', 'Vắng mặt', 'Có phép'].map(label => <button type="button" key={label} className={status === label ? 'active' : ''} onClick={() => setStatus(label)}>{label}</button>)}</div></div>
      <div className={`coach-checkin-window ${attendanceAvailability.open ? 'open' : ''}`}><Clock3 size={16} /><span><strong>{attendanceAvailability.open ? 'Có thể cập nhật điểm danh' : 'Không thể điểm danh'}</strong><small>{attendanceAvailability.message}. Trạng thái được lưu trực tiếp trên hệ thống.</small></span></div>
      {actionError && <div className="coach-attendance-error" role="alert">{actionError}</div>}
      {loading ? <EmptyState title="Đang tải danh sách điểm danh" text="Dữ liệu đang được đồng bộ từ hệ thống." /> : error ? <div className="coach-inline-error"><EmptyState title="Không thể tải điểm danh" text={error} /><button className="coach-retry-button" type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : filtered.length ? <div className="coach-attendance-table"><div className="coach-attendance-heading"><span>Học viên</span><span>Đăng ký</span><span>Trạng thái</span><span>Thao tác</span></div>{filtered.map(student => {
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
