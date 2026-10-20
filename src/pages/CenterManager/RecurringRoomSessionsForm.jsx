import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AlertCircle, CalendarPlus, X } from 'lucide-react'
import { getCoaches } from '../../services/classCatalogService'
import { getCancellationPolicies } from '../../services/cancellationPolicyService'
import { createRecurringRoomSessions, getRoomTimetableClasses } from '../../services/roomTimetableService'
import { getClassErrorMessage } from '../../services/sportClassService'
import { buildRecurringSessions, formatRecurringWeekdays, getClassDateRange, parseRecurringWeekdays } from '../../utils/recurringSessions'
import { getSessionRoom, roomSessionForTimetable } from '../../utils/roomTimetable'
import { buildDatedSession } from '../../utils/sessionScheduling'
import { timetableDateKey } from '../../utils/memberTimetable'

const dateLabel = value => value ? value.split('-').reverse().join('/') : 'Chưa cập nhật'
const weekdayLabel = day => day === 6 ? 'Chủ nhật' : `Thứ ${day + 2}`
const buildPlan = (form, sportClass) => form.mode === 'date'
  ? { items: [buildDatedSession(form, { sportClass })] }
  : buildRecurringSessions(form, { sportClass })
const classBoundaryLabel = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '')
  ? dateLabel(value)
  : new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' })

export default function RecurringRoomSessionsForm({ room, rooms, onClose, onBusyChange, onUpdate }) {
  const id = useId()
  const formRef = useRef(null)
  const actionLock = useRef(false)
  const [revision, setRevision] = useState(0)
  const [catalog, setCatalog] = useState({ classes: [], coaches: [], policies: [], loading: true, error: '' })
  const [form, setForm] = useState(() => ({
    classId: '', coachId: '', cancellationPolicyId: '', capacity: room.capacity || '',
    mode: 'date', date: '', weekdays: '246', startTime: '18:00', endTime: '19:30',
  }))
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  const [conflicts, setConflicts] = useState([])
  const [pending, setPending] = useState(null)
  const [totals, setTotals] = useState({ created: 0, existing: 0 })
  const selectedClass = catalog.classes.find(item => String(item.id) === form.classId)
  const classRange = getClassDateRange(selectedClass)
  const classRoom = selectedClass ? getSessionRoom({}, selectedClass, rooms) : null
  const locked = pending !== null
  const maxCapacity = Math.min(Number(room.capacity), Number(selectedClass?.maxCapacity))
  const capacityError = !selectedClass ? '' : !Number.isInteger(maxCapacity) || maxCapacity < 1
    ? 'Chưa xác nhận được sức chứa của phòng hoặc lớp. Vui lòng tải lại dữ liệu.'
    : !Number.isInteger(Number(form.capacity)) || Number(form.capacity) < 1 || Number(form.capacity) > maxCapacity
      ? `Sức chứa phải từ 1 đến ${maxCapacity} học viên, theo giới hạn của phòng và lớp.` : ''

  useEffect(() => { formRef.current?.scrollIntoView({ block: 'nearest' }) }, [])
  useEffect(() => {
    const controller = new AbortController()
    setCatalog({ classes: [], coaches: [], policies: [], loading: true, error: '' })
    Promise.all([getRoomTimetableClasses({ signal: controller.signal }), getCoaches(), getCancellationPolicies()]).then(([classes, coaches, policies]) => {
      if (controller.signal.aborted) return
      const activePolicies = policies.filter(item => item.isActive !== false)
      setCatalog({ classes: classes.filter(item => item.isActive !== false), coaches, policies: activePolicies, loading: false, error: '' })
      setForm(previous => ({ ...previous, cancellationPolicyId: previous.cancellationPolicyId || String(activePolicies[0]?.id || '') }))
    }).catch(requestError => {
      if (!controller.signal.aborted) setCatalog({ classes: [], coaches: [], policies: [], loading: false, error: getClassErrorMessage(requestError, 'Không thể tải dữ liệu tạo lịch.') })
    })
    return () => controller.abort()
  }, [revision])

  const preview = useMemo(() => {
    if (!selectedClass) return { items: [], error: '' }
    try {
      const assigned = getSessionRoom({}, selectedClass, rooms)
      if (assigned && !roomSessionForTimetable({}, selectedClass, rooms, room)) throw new Error(`Lớp đã được gán vào ${assigned.name || `phòng #${assigned.id}`}. Vui lòng tạo lịch tại phòng đó.`)
      const plan = buildPlan(form, selectedClass)
      return { ...plan, error: plan.items.length ? '' : plan.skippedPast
        ? 'Không còn buổi học nào chưa qua giờ bắt đầu trong thời gian của lớp.'
        : 'Không có buổi học phù hợp trong thời gian của lớp. Hãy chọn lại thứ hoặc giờ học.' }
    }
    catch (validationError) { return { items: [], error: validationError.message } }
  }, [form, selectedClass, room, rooms])
  let chosenDays = []
  try { chosenDays = parseRecurringWeekdays(form.weekdays) } catch { /* The preview shows the validation message. */ }

  const change = (field, value) => {
    if (busy || locked) return
    setForm(previous => ({ ...previous, [field]: value }))
    setError('')
    setConflicts([])
  }
  const selectClass = value => {
    const sportClass = catalog.classes.find(item => String(item.id) === value)
    const coachId = catalog.coaches.some(item => String(item.id) === String(sportClass?.coachId)) ? sportClass.coachId : ''
    const range = getClassDateRange(sportClass)
    const today = timetableDateKey(new Date().toISOString())
    setForm(previous => ({ ...previous, classId: value, coachId: String(coachId),
      date: previous.date && previous.date >= range.start && previous.date <= range.end ? previous.date
        : range.start && range.end ? (today < range.start ? range.start : today > range.end ? range.end : today) : '',
      capacity: Math.min(Number(room.capacity) || Infinity, Number(sportClass?.maxCapacity) || Number(room.capacity) || 1) }))
    setError('')
    setConflicts([])
  }

  const submit = async event => {
    event.preventDefault()
    if (actionLock.current) return
    setError('')
    setConflicts([])
    let items
    try {
      if (!selectedClass || selectedClass.isActive === false) throw new Error('Vui lòng chọn lớp học đang hoạt động.')
      if (room.isActive === false) throw new Error('Phòng đã ngừng hoạt động, không thể mở buổi học.')
      if (!catalog.coaches.some(item => String(item.id) === form.coachId)) throw new Error('Vui lòng chọn huấn luyện viên.')
      if (!catalog.policies.some(item => String(item.id) === form.cancellationPolicyId)) throw new Error('Vui lòng chọn chính sách hủy đang hoạt động.')
      if (!Number.isInteger(Number(form.capacity)) || Number(form.capacity) < 1 || Number(form.capacity) > maxCapacity) throw new Error(`Sức chứa phải từ 1 đến ${maxCapacity} học viên.`)
      items = pending || buildPlan(form, selectedClass).items
      if (!items.length) throw new Error('Không có buổi học phù hợp để tạo trong thời gian của lớp.')
      if (items.some(item => Date.parse(item.startsAt) <= Date.now())) throw new Error('Có buổi đã qua giờ bắt đầu. Hãy đóng biểu mẫu và chọn lại lịch.')
    } catch (validationError) { setError(validationError.message); return }

    actionLock.current = true
    setBusy(true)
    onBusyChange(true)
    try {
      const result = await createRecurringRoomSessions({ room, rooms, sportClass: selectedClass, coachId: form.coachId, cancellationPolicyId: form.cancellationPolicyId, capacity: form.capacity, sessions: items }, setProgress)
      const nextTotals = { created: totals.created + result.created.length, existing: totals.existing + result.existing.length }
      setTotals(nextTotals)
      if (result.remaining.length) {
        setConflicts(result.conflicts)
        setError(result.phase === 'creating' ? `Đã dừng tạo lịch. ${result.remaining.length} buổi còn lại chưa được xác nhận; bạn có thể thử lại mà không tạo trùng các buổi đã lưu.` : 'Chưa tạo lịch vì có khung giờ chưa xác nhận được phòng trống. Hãy kiểm tra các ngày bên dưới.')
        if (result.phase === 'creating' || locked) setPending(result.remaining)
      }
      if (result.created.length || result.existing.length || !result.remaining.length) {
        onUpdate({ ...nextTotals, complete: !result.remaining.length, firstDate: items[0]?.date })
      }
    } catch (requestError) { setError(getClassErrorMessage(requestError, 'Không thể tạo lịch. Vui lòng thử lại.')) }
    finally { actionLock.current = false; setBusy(false); setProgress(null); onBusyChange(false) }
  }

  return <form ref={formRef} className="room-recurring-form" onSubmit={submit} aria-labelledby={`${id}-title`}>
    <header><div><h3 id={`${id}-title`}><CalendarPlus size={19} /> Thêm buổi học</h3><p>Lịch được tạo tại <strong>{room.name}</strong>, trong thời gian của lớp, theo giờ Việt Nam.</p></div><button type="button" aria-label="Đóng biểu mẫu tạo lịch" disabled={busy} onClick={onClose}><X size={18} /></button></header>
    {catalog.loading && <p role="status">Đang tải lớp học, huấn luyện viên và chính sách hủy...</p>}
    {catalog.error && <div className="room-recurring-error" role="alert"><p>{catalog.error}</p><button type="button" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div>}
    {!catalog.loading && !catalog.error && (!catalog.classes.length || !catalog.coaches.length || !catalog.policies.length) && <p className="room-recurring-error" role="status">{!catalog.classes.length ? 'Chưa có lớp học đang hoạt động. ' : ''}{!catalog.coaches.length ? 'Chưa có huấn luyện viên. ' : ''}{!catalog.policies.length ? 'Chưa có chính sách hủy đang hoạt động. ' : ''}Vui lòng bổ sung dữ liệu trước khi tạo lịch.</p>}
    <fieldset disabled={busy || locked || catalog.loading || Boolean(catalog.error)}>
      <div className="room-session-create-mode" role="group" aria-label="Cách tạo buổi học">
        <button type="button" aria-pressed={form.mode === 'date'} onClick={() => change('mode', 'date')}>Theo ngày cụ thể</button>
        <button type="button" aria-pressed={form.mode === 'weekly'} onClick={() => change('mode', 'weekly')}>Lặp theo tuần</button>
      </div>
      <div className="room-recurring-fields">
        <label>Lớp học<select name="classId" required value={form.classId} onChange={event => selectClass(event.target.value)}><option value="">Chọn lớp học</option>{catalog.classes.map(item => <option key={item.id} value={item.id}>{item.className}</option>)}</select></label>
        <label>Huấn luyện viên<select name="coachId" required value={form.coachId} onChange={event => change('coachId', event.target.value)}><option value="">Chọn huấn luyện viên</option>{catalog.coaches.map(item => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></label>
        <label>Sức chứa mỗi buổi<input name="capacity" type="number" required min={1} max={Number.isFinite(maxCapacity) ? maxCapacity : undefined} step={1} value={form.capacity} onChange={event => change('capacity', event.target.value)} />{Number.isFinite(maxCapacity) && <small>Tối đa {maxCapacity} học viên theo sức chứa phòng và lớp.</small>}</label>
        {form.mode === 'date' && <label>Ngày học<input name="date" type="date" required disabled={!selectedClass} min={classRange.start || undefined} max={classRange.end || undefined} value={form.date} aria-describedby={`${id}-class-range`} onChange={event => change('date', event.target.value)} /><small>Chọn ngày trong thời gian diễn ra lớp học.</small></label>}
        <label>Giờ bắt đầu<input name="startTime" type="time" required value={form.startTime} onChange={event => change('startTime', event.target.value)} /></label>
        <label>Giờ kết thúc<input name="endTime" type="time" required value={form.endTime} onChange={event => change('endTime', event.target.value)} /></label>
        <label>Chính sách hủy<select name="cancellationPolicyId" required value={form.cancellationPolicyId} onChange={event => change('cancellationPolicyId', event.target.value)}><option value="">Chọn chính sách hủy</option>{catalog.policies.map(item => <option key={item.id} value={item.id}>{item.name} · Trước {item.minimumHoursBeforeStart} giờ</option>)}</select></label>
      </div>
      {form.mode === 'weekly' && <div className="room-recurring-weekdays">
        <label>Các ngày trong tuần<input name="weekdays" required type="text" value={form.weekdays} maxLength={100} aria-describedby={`${id}-days-help`} placeholder="246 hoặc 357" onChange={event => change('weekdays', event.target.value)} /></label>
        <small id={`${id}-days-help`}>Nhập 246 cho thứ 2, 4, 6; 357 cho thứ 3, 5, 7; hoặc 2, 3, 4, 5, 6, 7, CN.</small>
        <div role="group" aria-label="Chọn các ngày học">{Array.from({ length: 7 }, (_, day) => <button type="button" key={day} aria-pressed={chosenDays.includes(day)} onClick={() => change('weekdays', formatRecurringWeekdays(chosenDays.includes(day) ? chosenDays.filter(value => value !== day) : [...chosenDays, day].sort((a, b) => a - b)))}>{day === 6 ? 'CN' : `Thứ ${day + 2}`}</button>)}</div>
      </div>}
    </fieldset>
    <p id={`${id}-class-range`} className="room-recurring-class-range">{classRange.start && classRange.end
      ? `Thời gian xếp lịch: ${classBoundaryLabel(selectedClass.startDate)} – ${classBoundaryLabel(selectedClass.endDate)} (giờ Việt Nam).`
      : 'Chọn lớp học để xem thời gian được phép xếp lịch.'}</p>
    {capacityError && <p className="room-recurring-error" role="alert">{capacityError}</p>}
    {selectedClass && !classRoom && <p className="room-recurring-class-range">Khi tạo lịch, lớp và các buổi chưa có phòng của lớp sẽ được gán vào {room.name}.</p>}
    {preview.skippedPast > 0 && <p className="room-recurring-skip">Bỏ qua {preview.skippedPast} buổi đã qua giờ bắt đầu.</p>}
    {preview.skippedOutsideRange > 0 && <p className="room-recurring-skip">Bỏ qua {preview.skippedOutsideRange} buổi có giờ học nằm ngoài thời gian bắt đầu hoặc kết thúc của lớp.</p>}
    {preview.error && <p className="room-recurring-error" role="alert"><AlertCircle size={16} />{preview.error}</p>}
    {preview.items.length > 0 && <details className="room-recurring-preview" open>
      <summary><strong>{preview.items.length} buổi học</strong> · {dateLabel(preview.items[0].date)} – {dateLabel(preview.items.at(-1).date)} · {form.startTime}–{form.endTime}</summary>
      <div><table><thead><tr><th>Thứ</th><th>Ngày học</th><th>Khung giờ</th></tr></thead><tbody>{preview.items.map(item => <tr key={item.startsAt}><td>{weekdayLabel(item.weekday)}</td><td>{dateLabel(item.date)}</td><td>{form.startTime} – {form.endTime}</td></tr>)}</tbody></table></div>
    </details>}
    {(totals.created > 0 || totals.existing > 0) && <p className="room-recurring-saved" role="status">Đã tạo {totals.created} buổi; {totals.existing} buổi đã có sẵn được giữ nguyên.{pending && ` Còn ${pending.length} buổi cần xử lý.`}</p>}
    {error && <div className="room-recurring-error" role="alert"><p>{error}</p>{conflicts.length > 0 && <ul>{conflicts.map(item => <li key={item.startsAt}>{dateLabel(item.date)} {form.startTime}–{form.endTime}: {item.message}</li>)}</ul>}</div>}
    {progress && <p role="status">{progress.phase === 'checking' ? 'Đang kiểm tra phòng trống' : 'Đang tạo buổi học'}: {progress.completed}/{progress.total}...</p>}
    <footer><button type="button" disabled={busy} onClick={onClose}>Đóng biểu mẫu</button><button type="submit" className="room-recurring-submit" disabled={busy || catalog.loading || Boolean(catalog.error) || Boolean(preview.error) || Boolean(capacityError) || !preview.items.length}>{busy ? 'Đang xử lý...' : pending ? `Thử lại ${pending.length} buổi còn lại` : `Tạo ${preview.items.length || ''} buổi học`}</button></footer>
  </form>
}
