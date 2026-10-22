import { useEffect, useId, useRef, useState } from 'react'
import { Ban, X } from 'lucide-react'
import { cancelClassSession, getClassErrorMessage } from '../../services/sportClassService'
import { canCancelRoomSession } from '../../utils/roomTimetable'

const formatDateTime = value => new Date(value).toLocaleString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short',
})

export default function CancelRoomSessionDialog({ session, room, onClose, onBusyChange, onCancelled }) {
  const id = useId()
  const dialogRef = useRef(null)
  const actionLock = useRef(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    return () => dialog.close()
  }, [])

  const close = () => { if (!actionLock.current) onClose() }
  const submit = async event => {
    event.preventDefault()
    if (actionLock.current) return
    if (!reason.trim() || reason.trim().length > 500) {
      setError('Vui lòng nhập lý do hủy từ 1 đến 500 ký tự.')
      return
    }
    if (!canCancelRoomSession(session)) {
      setError('Chỉ có thể hủy buổi học chưa bắt đầu và chưa bị hủy hoặc hoàn thành.')
      return
    }
    actionLock.current = true
    setBusy(true)
    setError('')
    onBusyChange(true)
    try {
      await cancelClassSession(session.id, reason)
      onCancelled(session)
    } catch (requestError) {
      setError(getClassErrorMessage(requestError, 'Không thể hủy buổi học. Vui lòng thử lại.'))
    } finally {
      actionLock.current = false
      setBusy(false)
      onBusyChange(false)
    }
  }

  return <dialog ref={dialogRef} className="room-reschedule-dialog room-cancel-dialog" aria-labelledby={`${id}-title`} onCancel={event => {
    event.preventDefault()
    event.stopPropagation()
    close()
  }} onClick={event => {
    if (event.target !== event.currentTarget) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close()
  }}>
    <form onSubmit={submit} aria-busy={busy}>
      <header><div><h3 id={`${id}-title`}><Ban size={20} />Hủy buổi học</h3><p>{session.className} · {room.name} · Buổi #{session.id}</p></div><button type="button" aria-label="Đóng hủy buổi học" disabled={busy} onClick={close}><X size={19} /></button></header>
      <p className="room-reschedule-original">Thời gian: <strong>{formatDateTime(session.startsAt)} – {formatDateTime(session.endsAt)}</strong></p>
      <p className="room-reschedule-help">Buổi học này sẽ được hủy và học viên đã đăng ký sẽ nhận thông báo. Các buổi khác trong lớp được giữ nguyên.</p>
      <label htmlFor={`${id}-reason`}>Lý do hủy <span aria-hidden="true">*</span><textarea id={`${id}-reason`} name="cancellationReason" rows={4} required maxLength={500} autoFocus disabled={busy} value={reason} onChange={event => { setReason(event.target.value); setError('') }} placeholder="Nhập lý do hủy buổi học" aria-describedby={error ? `${id}-error` : undefined} /></label>
      {error && <p id={`${id}-error`} className="room-recurring-error" role="alert">{error}</p>}
      <footer><button type="button" disabled={busy} onClick={close}>Không hủy</button><button className="room-session-cancel" type="submit" disabled={busy || !reason.trim()}>{busy ? 'Đang hủy...' : 'Xác nhận hủy buổi học'}</button></footer>
    </form>
  </dialog>
}
