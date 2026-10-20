import { useEffect, useId, useRef, useState } from 'react'
import { AlertCircle, RefreshCw, Users, X } from 'lucide-react'
import { getClassErrorMessage, getSessionRoster } from '../../services/sportClassService'
import { classStatusLabel } from '../../utils/memberClasses'

const formatDateTime = value => Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }) : 'Chưa cập nhật'

export default function SessionRosterDialog({ session, onClose }) {
  const id = useId()
  const dialogRef = useRef(null)
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState({ loading: true, items: [], error: '' })

  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    return () => dialog.close()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setState({ loading: true, items: [], error: '' })
    getSessionRoster(session.id, { signal: controller.signal }).then(items => {
      if (!controller.signal.aborted) setState({ loading: false, items, error: '' })
    }).catch(error => {
      if (!controller.signal.aborted) setState({ loading: false, items: [], error: getClassErrorMessage(error, 'Không thể tải danh sách học viên.') })
    })
    return () => controller.abort()
  }, [session.id, revision])

  return <dialog ref={dialogRef} className="room-session-roster-dialog" aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose() }} onClick={event => {
    if (event.target !== event.currentTarget) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
  }}>
    <header>
      <div><h3 id={`${id}-title`}><Users size={20} />Danh sách học viên đăng ký</h3><p>{session.className} · Buổi học #{session.id}</p><p>{formatDateTime(session.startsAt)} – {formatDateTime(session.endsAt)}</p></div>
      <button type="button" aria-label="Đóng danh sách lớp" onClick={onClose}><X size={20} /></button>
    </header>
    <div className="room-session-roster-toolbar"><span aria-live="polite">{state.loading ? 'Đang tải danh sách...' : state.error ? 'Chưa tải được danh sách' : `${state.items.length} học viên đăng ký`}</span><button type="button" disabled={state.loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} />Làm mới</button></div>
    <div aria-busy={state.loading}>
      {state.loading ? <div className="room-session-roster-state" role="status">Đang tải danh sách học viên...</div>
        : state.error ? <div className="room-session-roster-state" role="alert"><AlertCircle size={24} /><p>{state.error}</p><button type="button" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div>
          : !state.items.length ? <div className="room-session-roster-state" role="status"><Users size={28} /><p>Buổi học này chưa có học viên đăng ký.</p></div>
            : <div className="room-session-roster-scroll" role="region" aria-label="Danh sách học viên, có thể cuộn ngang" tabIndex={0}>
              <table><caption className="member-timetable-sr-only">Học viên đã đăng ký buổi học #{session.id}</caption><thead><tr><th scope="col">STT</th><th scope="col">Họ và tên</th><th scope="col">Mã học viên</th><th scope="col">Đăng ký</th><th scope="col">Điểm danh</th></tr></thead>
                <tbody>{state.items.map((student, index) => <tr key={student.registrationId}>
                  <td>{index + 1}</td><th scope="row">{student.fullName || 'Chưa cập nhật'}</th><td>#{student.memberId}</td><td>{classStatusLabel(student.registrationStatus)}</td><td>{student.attendanceStatus ? classStatusLabel(student.attendanceStatus) : 'Chưa điểm danh'}{student.checkInTime && <small>{formatDateTime(student.checkInTime)}</small>}</td>
                </tr>)}</tbody>
              </table>
            </div>}
    </div>
    <div className="room-session-roster-actions"><button type="button" onClick={onClose}>Đóng</button></div>
  </dialog>
}
