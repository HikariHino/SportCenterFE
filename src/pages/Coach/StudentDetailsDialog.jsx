import { useEffect, useId, useRef } from 'react'
import { BookOpen, CalendarDays, Clock3, Plus, UserCheck, X } from 'lucide-react'
import { formatSessionOption, initials } from './CoachViewShared'
import '../../style/Coach/StudentDetailsDialog.css'

export default function StudentDetailsDialog({ student, session, sportName, availability, checkingIn, error, onClose, onCheckIn, onCreatePlan, onViewPlans }) {
  const dialogRef = useRef(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  return <dialog ref={dialogRef} className="coach-student-details-dialog" aria-labelledby={titleId} aria-busy={checkingIn}
    onCancel={event => { event.preventDefault(); if (!checkingIn) onClose() }}
    onClick={event => { if (event.target === event.currentTarget && !checkingIn) onClose() }}>
    <div className="coach-student-details-content">
      <header><div><small>HỌC VIÊN TRONG BUỔI</small><h2 id={titleId}>Thông tin học viên</h2></div><button type="button" onClick={onClose} disabled={checkingIn} aria-label="Đóng thông tin học viên" autoFocus><X size={20} /></button></header>
      <div className="coach-profile-cover"><span className="coach-student-avatar blue">{initials(student.name)}</span></div>
      <div className="coach-profile-main">
        <h3>{student.name}</h3><p>{session?.className || 'Buổi huấn luyện'}{sportName ? ` · ${sportName}` : ''}</p>
        <span className={`coach-profile-state ${student.attendanceTone}`}><i />{student.attendanceStatus}</span>
        <div className="coach-profile-numbers"><div><strong>#{student.memberId}</strong><small>Mã hội viên</small></div><div><strong>#{student.registrationId}</strong><small>Mã đăng ký</small></div><div><strong>{student.registrationStatus}</strong><small>Trạng thái</small></div></div>
        <div className="coach-profile-info"><span><Clock3 size={16} /><span><small>Thời gian check-in</small><strong>{student.checkInTime}</strong></span></span><span><CalendarDays size={16} /><span><small>Buổi huấn luyện</small><strong>{session ? formatSessionOption(session) : 'Chưa xác định'}</strong></span></span></div>
        <p className={`coach-student-details-availability${availability.open ? ' is-open' : ''}`}><Clock3 size={14} />{availability.message}</p>
        {error && <p className="coach-profile-action-error" role="alert">{error}</p>}
        <div className="coach-profile-actions">
          <button type="button" disabled={!availability.open || student.attendanceTone !== 'pending' || checkingIn} title={!availability.open ? availability.message : undefined} onClick={() => onCheckIn(student)}><UserCheck size={15} />{checkingIn ? 'Đang check-in...' : student.attendanceTone === 'pending' ? 'Check-in học viên' : 'Đã check-in'}</button>
          <button type="button" onClick={() => onCreatePlan(student)} disabled={checkingIn}><Plus size={15} />Tạo giáo án</button>
          <button type="button" onClick={() => onViewPlans(student)} disabled={checkingIn}><BookOpen size={15} />Xem giáo án</button>
        </div>
      </div>
    </div>
  </dialog>
}
