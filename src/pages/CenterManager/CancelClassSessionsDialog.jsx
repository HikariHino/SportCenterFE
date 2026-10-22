import { useEffect, useId, useRef, useState } from 'react'
import { Ban, RefreshCw, X } from 'lucide-react'
import { getAllClassSessions, getClassErrorMessage } from '../../services/sportClassService'
import { cancelSessionsForClass } from '../../services/classSessionCancellationService'
import { applyRoomSessionCancellations, canCancelRoomSession } from '../../utils/roomTimetable'
import { timetableDateKey } from '../../utils/memberTimetable'
import CancelRoomSessionDialog from './CancelRoomSessionDialog'
import '../../style/CenterManager/RoomTimetable.css'
import '../../style/CenterManager/CancelClassSessions.css'

const formatDateTime = value => new Date(value).toLocaleString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short',
})

export default function CancelClassSessionsDialog({ sportClass, onClose, onUpdated }) {
  const id = useId()
  const dialogRef = useRef(null)
  const [state, setState] = useState({ items: [], loading: true, error: '' })
  const [revision, setRevision] = useState(0)
  const [selectedIds, setSelectedIds] = useState([])
  const [range, setRange] = useState({ from: '', to: '' })
  const [confirmation, setConfirmation] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const eligible = state.items.filter(item => canCancelRoomSession(item))
  const invalidRange = Boolean(range.from && range.to && range.from > range.to)
  const visible = invalidRange ? [] : eligible.filter(item => {
    const date = timetableDateKey(item.startsAt)
    return (!range.from || date >= range.from) && (!range.to || date <= range.to)
  }).sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
  const selected = visible.filter(item => selectedIds.includes(String(item.id)))

  useEffect(() => {
    const dialog = dialogRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => { dialog.close(); document.body.style.overflow = previousOverflow }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setState(previous => ({ ...previous, loading: true, error: '' }))
    getAllClassSessions(sportClass.id, { signal: controller.signal }).then(items => {
      if (!controller.signal.aborted) {
        if (items.some(item => String(item.classId) !== String(sportClass.id))) throw new Error('Dữ liệu buổi học không khớp với lớp đã chọn.')
        setState({ items, loading: false, error: '' })
        const allowed = new Set(items.filter(item => canCancelRoomSession(item)).map(item => String(item.id)))
        setSelectedIds(previous => previous.filter(value => allowed.has(value)))
      }
    }).catch(error => {
      if (!controller.signal.aborted) setState(previous => ({ ...previous, loading: false, error: getClassErrorMessage(error, 'Không thể tải buổi học của lớp.') }))
    })
    return () => controller.abort()
  }, [sportClass.id, revision])

  const close = () => { if (!busy && !confirmation) onClose() }
  const changeRange = (field, value) => {
    setRange(previous => ({ ...previous, [field]: value }))
    setSelectedIds([])
  }
  const toggle = sessionId => setSelectedIds(previous => previous.includes(String(sessionId))
    ? previous.filter(value => value !== String(sessionId)) : [...previous, String(sessionId)])
  const cancelled = result => {
    if (result.cancelled.length) {
      setState(previous => ({ ...previous, items: applyRoomSessionCancellations(previous.items, result.cancelled) }))
      setNotice(`Đã hủy ${confirmation.length - result.failed.length} buổi của lớp ${sportClass.className}.${result.failed.length ? ` Còn ${result.failed.length} buổi chưa hủy được.` : ''}`)
      onUpdated(result)
    }
    setSelectedIds(result.failed.map(item => String(item.session.id)))
    if (!result.failed.length) setConfirmation(null)
  }

  return <dialog ref={dialogRef} className="class-cancel-sessions-dialog" aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); event.stopPropagation(); close() }}>
    <header><div><h2 id={`${id}-title`}><Ban size={21} />Hủy buổi theo lớp</h2><p><strong>{sportClass.className}</strong> · Mã lớp #{sportClass.id}</p></div><button type="button" aria-label="Đóng hủy buổi theo lớp" disabled={busy || !!confirmation} onClick={close}><X size={20} /></button></header>
    <div className="class-cancel-body">
      <p className="class-cancel-help">Chỉ các buổi chưa bắt đầu của lớp này được chọn. Các buổi đã hoàn thành, đã hủy và các lớp khác được giữ nguyên.</p>
      {notice && <p className="room-timetable-notice" role="status">{notice}</p>}
      <div className="class-cancel-filters"><label>Từ ngày<input type="date" value={range.from} disabled={busy || !!confirmation} onChange={event => changeRange('from', event.target.value)} /></label><label>Đến ngày<input type="date" value={range.to} min={range.from || undefined} disabled={busy || !!confirmation} onChange={event => changeRange('to', event.target.value)} /></label><button type="button" disabled={busy || !!confirmation || (!range.from && !range.to)} onClick={() => { setRange({ from: '', to: '' }); setSelectedIds([]) }}>Xóa lọc ngày</button></div>
      {invalidRange && <p className="room-recurring-error" role="alert">Ngày kết thúc phải từ ngày bắt đầu trở đi.</p>}
      <div className="class-cancel-selection"><strong aria-live="polite">Đã chọn {selected.length}/{visible.length} buổi</strong><div><button type="button" disabled={state.loading || !!state.error || busy || !visible.length} onClick={() => setSelectedIds(visible.map(item => String(item.id)))}>Chọn tất cả</button><button type="button" disabled={busy || !selected.length} onClick={() => setSelectedIds([])}>Bỏ chọn</button><button type="button" aria-label="Tải lại buổi học của lớp" disabled={state.loading || busy} onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} />Làm mới</button></div></div>
      {state.error && <p className="room-recurring-error" role="alert">{state.error}</p>}
      {state.loading ? <p role="status">Đang tải buổi học của lớp…</p> : !visible.length ? <p className="class-cancel-empty">{eligible.length ? 'Không có buổi học phù hợp với khoảng ngày đã chọn.' : 'Lớp này không còn buổi học chưa bắt đầu để hủy.'}</p> : <ul className="class-cancel-list" aria-label="Buổi học thuộc lớp đã chọn">{visible.map(item => <li key={item.id}><label><input type="checkbox" checked={selectedIds.includes(String(item.id))} disabled={busy || !!state.error} onChange={() => toggle(item.id)} /><span><strong>Buổi #{item.id} · {item.coachName || sportClass.coachName || 'Chưa phân công HLV'}</strong><span>{formatDateTime(item.startsAt)} – {formatDateTime(item.endsAt)}</span><small>{item.currentEnrollment ?? 0} học viên đã đăng ký{item.roomName ? ` · ${item.roomName}` : ''}</small></span></label></li>)}</ul>}
    </div>
    <footer><button type="button" disabled={busy || !!confirmation} onClick={close}>Đóng</button><button type="button" className="class-cancel-confirm" disabled={state.loading || !!state.error || busy || !selected.length} onClick={() => setConfirmation(selected.map(item => ({ ...item, className: sportClass.className })))}><Ban size={16} />Hủy {selected.length} buổi đã chọn</button></footer>
    {confirmation && <CancelRoomSessionDialog sessions={confirmation} contextLabel={`Lớp ${sportClass.className}`} cancelSessions={(request, onProgress) => cancelSessionsForClass({ ...request, classId: sportClass.id }, onProgress)} onClose={() => setConfirmation(null)} onBusyChange={setBusy} onCancelled={cancelled} />}
  </dialog>
}
