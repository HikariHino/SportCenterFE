import { useEffect, useId, useRef, useState } from 'react'
import { CalendarClock, X } from 'lucide-react'
import { rescheduleRoomSession } from '../../services/roomTimetableService'
import { getClassErrorMessage } from '../../services/sportClassService'
import { timetableDateKey } from '../../utils/memberTimetable'
import { buildSessionReschedule, sessionRescheduleDraft } from '../../utils/sessionReschedule'
import { getCoaches } from '../../services/classCatalogService'

const dateLabel = value => value.split('-').reverse().join('/')
const dateTimeLabel = value => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' })

export default function RescheduleRoomSessionDialog({ room, rooms, request, onClose, onBusyChange, onSaved }) {
  const id = useId()
  const dialogRef = useRef(null)
  const actionLock = useRef(false)
  const { session, target } = request
  const sameDayDrop = target?.date === timetableDateKey(session.startsAt)
  const [draft, setDraft] = useState(() => sessionRescheduleDraft(session, target))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [coaches, setCoaches] = useState([])
  const [coachesLoading, setCoachesLoading] = useState(true)
  const [coachesError, setCoachesError] = useState('')
  const [coachesRevision, setCoachesRevision] = useState(0)
  let preview
  let validation = ''
  try { preview = buildSessionReschedule(session, draft) } catch (validationError) { validation = validationError.message }
  const changed = preview && (Date.parse(preview.startsAt) !== Date.parse(session.startsAt) || Date.parse(preview.endsAt) !== Date.parse(session.endsAt)
    || preview.coachId !== Number(session.coachId))

  useEffect(() => {
    let active = true
    setCoachesLoading(true)
    setCoachesError('')
    getCoaches().then(items => {
      if (active) setCoaches(items.filter(item => item.isActive !== false))
    }).catch(requestError => {
      if (active) setCoachesError(getClassErrorMessage(requestError, 'Không thể tải danh sách HLV.'))
    }).finally(() => { if (active) setCoachesLoading(false) })
    return () => { active = false }
  }, [coachesRevision])

  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    return () => dialog.close()
  }, [])

  const change = (field, value) => { setDraft(previous => ({ ...previous, [field]: value })); setError('') }
  const close = () => { if (!actionLock.current) onClose() }
  const submit = async event => {
    event.preventDefault()
    if (actionLock.current || !changed || validation || coachesLoading || coachesError) return
    actionLock.current = true
    setBusy(true)
    setError('')
    onBusyChange(true)
    try {
      const updated = await rescheduleRoomSession({ room, rooms, session, draft })
      onSaved(updated)
    } catch (requestError) { setError(getClassErrorMessage(requestError, 'Không thể đổi lịch. Vui lòng thử lại.')) }
    finally { actionLock.current = false; setBusy(false); onBusyChange(false) }
  }

  return <dialog ref={dialogRef} className="room-reschedule-dialog" aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); event.stopPropagation(); close() }} onClick={event => {
    if (event.target !== event.currentTarget) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close()
  }}>
    <form onSubmit={submit} aria-busy={busy}>
      <header><div><h3 id={`${id}-title`}><CalendarClock size={20} />{sameDayDrop ? 'Đổi giờ / Thay HLV' : 'Đổi lịch / Thay HLV'}</h3><p>{session.className} · {room.name}</p></div><button type="button" aria-label="Đóng đổi lịch" disabled={busy} onClick={close}><X size={19} /></button></header>
      <p className="room-reschedule-original">Lịch hiện tại: <strong>{dateTimeLabel(session.startsAt)} – {dateTimeLabel(session.endsAt)}</strong></p>
      <fieldset disabled={busy}>
        <label>Huấn luyện viên phụ trách<select name="rescheduleCoachId" required disabled={coachesLoading || Boolean(coachesError)} value={draft.coachId ?? ''} onChange={event => change('coachId', event.target.value)}>
          {!coaches.some(coach => String(coach.id) === String(session.coachId)) && <option value={session.coachId}>{session.coachName || `HLV #${session.coachId}`} (hiện tại)</option>}
          {coaches.map(coach => <option key={coach.id} value={coach.id}>{coach.fullName}</option>)}
        </select></label>
        {coachesLoading && <p role="status">Đang tải danh sách HLV...</p>}
        {coachesError && <div className="room-recurring-error" role="alert">{coachesError}<button type="button" onClick={() => setCoachesRevision(value => value + 1)}>Thử lại</button></div>}
        {sameDayDrop ? <p className="room-reschedule-date">Ngày học: <strong>{dateLabel(draft.date)}</strong></p> : <label>Ngày học mới<input name="rescheduleDate" type="date" required autoFocus min={timetableDateKey()} value={draft.date} onChange={event => change('date', event.target.value)} /></label>}
        <div className="room-reschedule-times">
          <label>Giờ bắt đầu<input name="rescheduleStartTime" type="time" required autoFocus={sameDayDrop} value={draft.startTime} onChange={event => change('startTime', event.target.value)} /></label>
          <label>Giờ kết thúc<input name="rescheduleEndTime" type="time" required value={draft.endTime} onChange={event => change('endTime', event.target.value)} /></label>
        </div>
        <label className="room-reschedule-overnight"><input name="rescheduleNextDay" type="checkbox" checked={draft.endsNextDay} onChange={event => change('endsNextDay', event.target.checked)} />Kết thúc vào ngày hôm sau</label>
      </fieldset>
      {preview && <p className="room-reschedule-preview">Lịch mới: <strong>{dateTimeLabel(preview.startsAt)} – {dateTimeLabel(preview.endsAt)}</strong></p>}
      <p className="room-reschedule-help">Chỉ thay đổi buổi học này, theo giờ Việt Nam. Khi đổi lịch hoặc HLV, học viên đã đăng ký sẽ nhận thông báo kiểm tra lại lịch. Đăng ký được giữ nguyên; học viên tự hủy nếu không thể tham gia, theo hạn hủy của buổi học.</p>
      {(error || validation) && <p className="room-recurring-error" role="alert">{error || validation}</p>}
      <footer><button type="button" disabled={busy} onClick={close}>Đóng</button><button className="room-reschedule-save" type="submit" disabled={busy || !changed || Boolean(validation) || coachesLoading || Boolean(coachesError)}>{busy ? 'Đang kiểm tra và lưu...' : 'Lưu thay đổi'}</button></footer>
    </form>
  </dialog>
}
