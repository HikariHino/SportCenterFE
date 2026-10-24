import { useEffect, useState } from 'react'
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, RefreshCw, UserCheck, Users } from 'lucide-react'
import { getCoachSessionAttendances, getCoachSessionRoster, markCoachAttendance } from '../../services/coachService'
import { attendanceOptions, EmptyState, getStudentsError, initials, mapRosterStudent, sessionDateFormatter, timeFormatter } from './CoachViewShared'

const isCancelledSession = session => ['cancelled', 'canceled'].includes(String(session?.rawStatus || session?.status || '').trim().toLowerCase())

export default function ScheduleSessionDetail({ session, onBack, showNotice }) {
  const [students, setStudents] = useState([])
  const [selections, setSelections] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [requestKey, setRequestKey] = useState(0)
  const cancelled = isCancelledSession(session)

  useEffect(() => {
    let active = true
    const loadStudents = async () => {
      setLoading(true)
      setError('')
      setActionError('')
      try {
        const [roster, attendances] = await Promise.all([
          getCoachSessionRoster(session.id),
          getCoachSessionAttendances(session.id),
        ])
        if (!active) return
        const attendanceByMember = new Map(attendances.map(item => [Number(item.memberId), item]))
        const mapped = roster.map(item => {
          const attendance = attendanceByMember.get(Number(item.memberId))
          return mapRosterStudent({
            ...item,
            attendanceStatus: attendance?.status ?? item.attendanceStatus,
            checkInTime: attendance?.checkInTime ?? item.checkInTime,
          })
        })
        setStudents(mapped)
        setSelections(Object.fromEntries(mapped.map(item => [item.id, item.attendanceValue])))
      } catch (requestError) {
        if (active) {
          setStudents([])
          setError(getStudentsError(requestError))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadStudents()
    return () => { active = false }
  }, [requestKey, session.id])

  const handleUpdate = async student => {
    if (cancelled || savingId !== null) return
    setSavingId(student.registrationId)
    setActionError('')
    try {
      const attendance = await markCoachAttendance({
        memberId: student.memberId,
        sessionId: Number(session.id),
        status: selections[student.id] || 'Present',
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
      setSelections(current => ({ ...current, [student.id]: updated.attendanceValue }))
      showNotice?.(`Đã cập nhật điểm danh ${student.name} cho buổi #${session.id}.`)
    } catch (requestError) {
      setActionError(getStudentsError(requestError))
    } finally {
      setSavingId(null)
    }
  }

  const presentCount = students.filter(item => ['present', 'late'].includes(item.attendanceTone)).length
  const pendingCount = students.filter(item => item.attendanceTone === 'pending').length
  const start = new Date(session.startsAt)
  const end = new Date(session.endsAt)

  return <div className="coach-section-view coach-schedule-detail">
    <section className="coach-card coach-schedule-detail-hero">
      <button type="button" className="coach-schedule-detail-back" onClick={onBack}><ArrowLeft size={17} />Quay lại lịch</button>
      <div className="coach-schedule-detail-heading">
        <div><span>CHI TIẾT BUỔI HUẤN LUYỆN</span><h2>{session.studentName || 'Buổi huấn luyện'}</h2><p>Buổi #{session.id} · {sessionDateFormatter.format(start)}</p></div>
        <b className={session.tone || 'next'}>{session.status || 'Chưa xác định'}</b>
      </div>
      <div className="coach-schedule-detail-meta">
        <span><Clock3 size={18} /><span><small>Ca huấn luyện</small><strong>{timeFormatter.format(start)} – {timeFormatter.format(end)}</strong></span></span>
        <span><CalendarDays size={18} /><span><small>Ngày học</small><strong>{sessionDateFormatter.format(start)}</strong></span></span>
        <span><Users size={18} /><span><small>Đăng ký</small><strong>{students.length}/{session.capacity || '—'} học viên</strong></span></span>
      </div>
    </section>

    <section className="coach-student-kpis coach-attendance-kpis">
      <article><span className="blue"><Users size={21} /></span><div><small>Danh sách học viên</small><strong>{students.length}</strong><p>Đăng ký trong buổi</p></div></article>
      <article><span className="green"><CheckCircle2 size={21} /></span><div><small>Đã điểm danh</small><strong>{presentCount}</strong><p>Đã cập nhật trong ngày</p></div></article>
      <article><span className="purple"><Clock3 size={21} /></span><div><small>Chưa điểm danh</small><strong>{pendingCount}</strong><p>{cancelled ? 'Buổi học đã bị hủy' : 'Chọn trạng thái rồi cập nhật'}</p></div></article>
    </section>

    <section className="coach-card coach-attendance-list coach-schedule-attendance-list">
      <div className="coach-view-toolbar"><div><strong>Danh sách điểm danh</strong><span>{loading ? 'Đang tải học viên...' : `${students.length} học viên trong buổi`}</span></div><button type="button" className="coach-schedule-detail-refresh" disabled={loading || savingId !== null} onClick={() => setRequestKey(key => key + 1)}><RefreshCw size={15} />Làm mới</button></div>
      <div className={`coach-checkin-window ${cancelled ? '' : 'open'}`}><UserCheck size={16} /><span><strong>{cancelled ? 'Không thể điểm danh' : 'Điểm danh theo buổi học đã chọn'}</strong><small>{cancelled ? 'Buổi học đã bị hủy.' : `Mọi thay đổi được ghi nhận cho buổi #${session.id} vào ${sessionDateFormatter.format(start)}.`}</small></span></div>
      {actionError && <div className="coach-attendance-error" role="alert">{actionError}</div>}
      {loading ? <EmptyState title="Đang tải danh sách học viên" text="Hệ thống đang lấy đăng ký và trạng thái điểm danh của buổi học." /> : error ? <div className="coach-inline-error"><EmptyState title="Không thể tải danh sách học viên" text={error} /><button type="button" className="coach-retry-button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : students.length ? <div className="coach-attendance-table">
        <div className="coach-attendance-heading"><span>Học viên</span><span>Đăng ký</span><span>Trạng thái</span><span>Điểm danh</span></div>
        {students.map(student => {
          const saving = savingId === student.registrationId
          return <article className="coach-attendance-row" key={student.id}>
            <span className="coach-roster-person"><i className="coach-student-avatar blue">{initials(student.name)}</i><span><strong>{student.name}</strong><small>Member #{student.memberId}</small></span></span>
            <span><strong>{student.registrationStatus}</strong><small>Đăng ký #{student.registrationId}</small></span>
            <span><strong className={`coach-attendance ${student.attendanceTone}`}>{student.attendanceStatus}</strong><small>{student.checkInTime}</small></span>
            <span className="coach-attendance-actions"><select aria-label={`Trạng thái điểm danh của ${student.name}`} value={selections[student.id] || 'Present'} disabled={cancelled || savingId !== null} onChange={event => setSelections(current => ({ ...current, [student.id]: event.target.value }))}>{attendanceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button type="button" className="coach-checkin-button" disabled={cancelled || savingId !== null} onClick={() => handleUpdate(student)}>{saving ? 'Đang lưu...' : student.attendanceTone === 'pending' ? 'Điểm danh' : 'Cập nhật'}</button></span>
          </article>
        })}
      </div> : <EmptyState title="Chưa có học viên" text="Buổi huấn luyện này chưa có hội viên đăng ký." />}
    </section>
  </div>
}
