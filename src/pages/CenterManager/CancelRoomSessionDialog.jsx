import { useEffect, useId, useRef, useState } from 'react'
import { Ban, X } from 'lucide-react'
import { getClassErrorMessage } from '../../services/sportClassService'
import { cancelRoomSessions } from '../../services/roomTimetableService'

const formatDateTime = value => new Date(value).toLocaleString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short',
})

export default function CancelRoomSessionDialog({ session, sessions, room, contextLabel = room?.name, cancelSessions = cancelRoomSessions, onClose, onBusyChange, onCancelled }) {
  const id = useId()
  const dialogRef = useRef(null)
  const actionLock = useRef(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const requested = sessions ?? [session]
  const [pending, setPending] = useState(requested)
  const [succeeded, setSucceeded] = useState([])
  const [failures, setFailures] = useState([])
  const [progress, setProgress] = useState({ completed: 0, total: requested.length })
  const succeededIds = new Set(succeeded.map(item => String(item.id)))
  const failureMessages = new Map(failures.map(item => [String(item.session.id), item.message]))

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
    actionLock.current = true
    setBusy(true)
    setError('')
    setProgress({ completed: 0, total: pending.length })
    onBusyChange(true)
    try {
      const result = await cancelSessions({ sessions: pending, reason }, setProgress)
      setSucceeded(previous => [...previous, ...result.cancelled])
      setFailures(result.failed)
      setPending(result.failed.map(item => item.session))
      onCancelled(result)
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
      <header><div><h3 id={`${id}-title`}><Ban size={20} />{requested.length === 1 ? 'Hủy buổi học' : `Hủy ${requested.length} buổi học`}</h3><p>{contextLabel} · {requested.length} buổi đã chọn</p></div><button type="button" aria-label="Đóng hủy buổi học" disabled={busy} onClick={close}><X size={19} /></button></header>
      <ul className="room-cancel-preview" aria-label="Các buổi học sẽ hủy">{requested.map(item => <li key={item.id}>
        <strong>{item.className} · #{item.id}</strong><span>{formatDateTime(item.startsAt)} – {formatDateTime(item.endsAt)}</span>
        {succeededIds.has(String(item.id)) && <small className="room-cancel-success">Đã hủy thành công</small>}
        {failureMessages.has(String(item.id)) && <small className="room-recurring-error">{failureMessages.get(String(item.id))}</small>}
      </li>)}</ul>
      <p className="room-reschedule-help">Lý do bên dưới được áp dụng cho các buổi đã chọn. Học viên đã đăng ký sẽ nhận thông báo hủy. Các buổi không được chọn giữ nguyên.</p>
      <label htmlFor={`${id}-reason`}><span>Lý do hủy <b aria-hidden="true">*</b></span><textarea id={`${id}-reason`} name="cancellationReason" rows={4} required maxLength={500} autoFocus disabled={busy} value={reason} onChange={event => { setReason(event.target.value); setError('') }} placeholder="Nhập lý do hủy buổi học" aria-describedby={error ? `${id}-error` : undefined} /></label>
      {error && <p id={`${id}-error`} className="room-recurring-error" role="alert">{error}</p>}
      {busy && <p role="status">Đang xử lý {progress.completed}/{progress.total} buổi học…</p>}
      {!!failures.length && !busy && <p role="alert" className="room-recurring-error">Đã hủy {succeeded.length}/{requested.length} buổi. {pending.length} buổi chưa hủy được; bạn có thể thử lại riêng các buổi này.</p>}
      <footer><button type="button" disabled={busy} onClick={close}>{succeeded.length ? 'Đóng' : 'Không hủy'}</button><button className="room-session-cancel" type="submit" disabled={busy || !reason.trim() || !pending.length}>{busy ? `Đang hủy ${progress.completed}/${progress.total}…` : failures.length ? `Thử lại ${pending.length} buổi` : requested.length === 1 ? 'Xác nhận hủy buổi học' : `Xác nhận hủy ${pending.length} buổi`}</button></footer>
    </form>
  </dialog>
}
