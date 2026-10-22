import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Ban, Calendar, CalendarClock, CalendarPlus, MapPin, RefreshCw, Users, X } from 'lucide-react'
import RoomSessionTimetable from './RoomSessionTimetable'
import { assignClassToRoom, getRoomTimetable } from '../../services/roomTimetableService'
import { getRoomErrorMessage } from '../../services/roomService'
import { applyRoomSessionCancellations, canCancelRoomSession, getRoomTimetableWeek, roomSessionStatusLabel } from '../../utils/roomTimetable'
import { timetableWeekStart } from '../../utils/memberTimetable'
import '../../style/CenterManager/RoomTimetable.css'
import RecurringRoomSessionsForm from './RecurringRoomSessionsForm'
import RescheduleRoomSessionDialog from './RescheduleRoomSessionDialog'
import { canRescheduleSession } from '../../utils/sessionReschedule'
import SessionRosterDialog from './SessionRosterDialog'
import CancelRoomSessionDialog from './CancelRoomSessionDialog'
import { cancelSessionsForClass } from '../../services/classSessionCancellationService'

const formatDateTime = value => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }) : 'Chưa cập nhật'

export default function RoomTimetableDialog({ room, rooms, onClose }) {
  const dialogRef = useRef(null)
  const detailRef = useRef(null)
  const [weekStart, setWeekStart] = useState(null)
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState({ items: [], unassignedClasses: [], loading: true, loaded: false, error: '' })
  const [selectedId, setSelectedId] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState('')
  const [assignmentError, setAssignmentError] = useState('')
  const [reschedule, setReschedule] = useState(null)
  const [rosterSession, setRosterSession] = useState(null)
  const [cancellationSessions, setCancellationSessions] = useState(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [cancellationIds, setCancellationIds] = useState([])
  const [cancellationClassId, setCancellationClassId] = useState('')
  const alignWeekAfterCancellation = useRef(false)
  const assignmentLock = useRef(false)
  const selected = state.items.find(item => item.id === selectedId)
  const cancellable = state.items.filter(item => canCancelRoomSession(item))
  const cancellationClasses = [...new Map(cancellable.map(item => [String(item.classId), { id: String(item.classId), name: item.className }])).values()].sort((left, right) => left.name.localeCompare(right.name, 'vi'))
  const scopedCancellable = cancellable.filter(item => !cancellationClassId || String(item.classId) === cancellationClassId)
  const scopedItems = selectionMode && cancellationClassId ? state.items.filter(item => String(item.classId) === cancellationClassId) : state.items
  const selectedCancellations = scopedCancellable.filter(item => cancellationIds.includes(String(item.id)))
  const weekCancellable = scopedCancellable.filter(item => timetableWeekStart(item.startsAt) === weekStart)
  const selectedOutsideWeek = selectedCancellations.filter(item => timetableWeekStart(item.startsAt) !== weekStart).length

  useEffect(() => { if (selected) detailRef.current?.scrollIntoView({ block: 'nearest' }) }, [selected])

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
    getRoomTimetable(room, rooms, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) {
        const alignWeek = alignWeekAfterCancellation.current
        alignWeekAfterCancellation.current = false
        setWeekStart(current => current == null || alignWeek ? getRoomTimetableWeek(result.items, current ?? undefined) : current)
        setState({ ...result, loading: false, loaded: true, error: '' })
        const eligibleIds = new Set(result.items.filter(item => canCancelRoomSession(item)).map(item => String(item.id)))
        setCancellationIds(previous => previous.filter(id => eligibleIds.has(id)))
      }
    }).catch(error => {
      if (!controller.signal.aborted) setState(previous => ({ ...previous, loading: false, error: getRoomErrorMessage(error, 'Không thể tải thời khóa biểu của phòng.') }))
    })
    return () => controller.abort()
  }, [room, rooms, revision])

  const changeWeek = value => { alignWeekAfterCancellation.current = false; setWeekStart(value); setSelectedId(null) }
  const closeDialog = () => { if (!creating) onClose() }
  const openReschedule = (session, target) => {
    if (creating || state.loading || selectionMode || showCreate || reschedule || rosterSession || cancellationSessions || room.isActive === false || !canRescheduleSession(session)) return
    setReschedule({ session, target })
    setNotice('')
  }
  const sessionRescheduled = session => {
    setReschedule(null)
    setSelectedId(session.id)
    setWeekStart(timetableWeekStart(session.startsAt))
    setNotice(`Đã cập nhật buổi học ${session.className}: ${formatDateTime(session.startsAt)} – ${formatDateTime(session.endsAt)}. Học viên đã đăng ký được giữ chỗ và nhận thông báo kiểm tra lại lịch học.`)
    setRevision(value => value + 1)
  }
  const openCancellation = session => {
    if (creating || state.loading || showCreate || reschedule || rosterSession || cancellationSessions || !canCancelRoomSession(session)) return
    setCancellationSessions([session])
    setNotice('')
  }
  const sessionsCancelled = result => {
    if (result.cancelled.length) {
      const items = applyRoomSessionCancellations(state.items, result.cancelled)
      setState(previous => ({ ...previous, items: applyRoomSessionCancellations(previous.items, result.cancelled) }))
      setWeekStart(current => getRoomTimetableWeek(items, current))
      setSelectedId(null)
      alignWeekAfterCancellation.current = true
      const cancelledCount = (cancellationSessions?.length ?? result.cancelled.length) - result.failed.length
      setNotice(`Đã hủy ${cancelledCount} buổi học và gửi thông báo tới học viên.${result.failed.length ? ` Còn ${result.failed.length} buổi chưa hủy được.` : ''}`)
      setRevision(value => value + 1)
    }
    setCancellationIds(result.failed.map(item => String(item.session.id)))
    if (!result.failed.length) {
      setCancellationSessions(null)
      setSelectionMode(false)
    }
  }
  const toggleCancellation = id => {
    if (creating || state.loading || !scopedCancellable.some(item => String(item.id) === String(id))) return
    setCancellationIds(previous => previous.includes(String(id)) ? previous.filter(value => value !== String(id)) : [...previous, String(id)])
  }
  const selectCancellations = items => {
    setCancellationIds(previous => [...new Set([...previous, ...items.map(item => String(item.id))])])
  }
  const toggleSelectionMode = () => {
    setSelectionMode(value => !value)
    setCancellationIds([])
    setCancellationClassId('')
    setSelectedId(null)
    setNotice('')
  }
  const changeCancellationClass = value => {
    setCancellationClassId(value)
    setCancellationIds([])
    alignWeekAfterCancellation.current = false
    setWeekStart(current => getRoomTimetableWeek(state.items.filter(item => !value || String(item.classId) === value), current))
  }
  const assignRoom = async sportClass => {
    if (assignmentLock.current) return
    assignmentLock.current = true
    setCreating(true)
    setAssignmentError('')
    try {
      await assignClassToRoom({ classId: sportClass.id, room, rooms })
      setNotice(`Đã gán lịch lớp ${sportClass.className} vào ${room.name}.`)
      setRevision(value => value + 1)
    } catch (error) { setAssignmentError(getRoomErrorMessage(error, 'Không thể gán lịch vào phòng.')) }
    finally { assignmentLock.current = false; setCreating(false) }
  }
  const scheduleUpdated = result => {
    setNotice(`Đã tạo ${result.created} buổi học.${result.existing ? ` ${result.existing} buổi đã có sẵn được giữ nguyên.` : ''}${!result.complete ? ' Lịch đã lưu được cập nhật bên dưới.' : ''}`)
    if (result.firstDate) setWeekStart(timetableWeekStart(result.firstDate))
    setSelectedId(null)
    setRevision(value => value + 1)
    if (result.complete) setShowCreate(false)
  }

  return <dialog ref={dialogRef} className="room-timetable-dialog" aria-labelledby="room-timetable-title" onCancel={event => { event.preventDefault(); if (event.target === event.currentTarget && !rosterSession && !reschedule && !cancellationSessions) closeDialog() }} onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog() } }}>
    <header className="room-timetable-header">
      <div><span><Calendar size={16} /> LỊCH SỬ DỤNG PHÒNG</span><h2 id="room-timetable-title">{room.name}</h2><p><MapPin size={14} />{room.location || 'Chưa cập nhật vị trí'}<span>·</span><Users size={14} />{room.capacity} học viên{room.isActive === false && <strong>· Phòng đã ngừng hoạt động</strong>}</p></div>
      <div className="room-timetable-header-actions"><button type="button" className="room-timetable-add" disabled={creating || selectionMode || showCreate || room.isActive === false} onClick={() => { setShowCreate(true); setSelectedId(null); setNotice('') }}><CalendarPlus size={16} /> Thêm buổi học</button><button type="button" className="room-bulk-toggle" aria-pressed={selectionMode} disabled={creating || state.loading || showCreate || (!selectionMode && !cancellable.length)} onClick={toggleSelectionMode}><Ban size={16} />{selectionMode ? 'Thoát chọn' : 'Hủy nhiều buổi'}</button><button type="button" disabled={state.loading || creating} onClick={() => { setSelectedId(null); setRevision(value => value + 1) }}><RefreshCw size={16} /> Làm mới</button><button type="button" aria-label="Đóng lịch phòng" disabled={creating} onClick={closeDialog}><X size={21} /></button></div>
    </header>
    <div className="room-timetable-body" aria-busy={state.loading || creating}>
      {notice && <p className="room-timetable-notice" role="status">{notice}</p>}
      {showCreate && <RecurringRoomSessionsForm room={room} rooms={rooms} onClose={() => setShowCreate(false)} onBusyChange={setCreating} onUpdate={scheduleUpdated} />}
      {state.loading && !state.loaded ? <div className="room-timetable-state" role="status"><div className="room-spinner" /><p>Đang tải thời khóa biểu của phòng...</p></div> : state.error && !state.loaded ? <div className="room-timetable-state" role="alert"><AlertCircle size={28} /><p>{state.error}</p><button type="button" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div> : <>
        {state.loading && <p className="room-timetable-note" role="status">Đang cập nhật lịch…</p>}
        {state.error && <div className="room-timetable-refresh-error" role="alert"><p>{state.error} Lịch đã tải vẫn được giữ bên dưới.</p><button type="button" onClick={() => setRevision(value => value + 1)}>Thử tải lại</button></div>}
        {selectionMode && <section className="room-bulk-toolbar" aria-label="Chọn buổi học để hủy">
          <label className="room-bulk-class-filter">Chọn lớp học<select value={cancellationClassId} disabled={creating || state.loading || !!cancellationSessions} onChange={event => changeCancellationClass(event.target.value)}><option value="">Tất cả lớp trong phòng</option>{cancellationClasses.map(item => <option key={item.id} value={item.id}>{item.name} · #{item.id}</option>)}</select></label>
          <div><strong aria-live="polite">Đã chọn {selectedCancellations.length} buổi{selectedOutsideWeek ? ` · ${selectedOutsideWeek} buổi ở tuần khác` : ''}</strong><p>Bấm vào buổi học để chọn hoặc bỏ chọn. Bạn có thể chuyển tuần để chọn thêm.</p></div>
          <div className="room-bulk-actions"><button type="button" disabled={creating || state.loading || !weekCancellable.length} onClick={() => selectCancellations(weekCancellable)}>Chọn cả tuần ({weekCancellable.length})</button><button type="button" disabled={creating || state.loading || !scopedCancellable.length} onClick={() => selectCancellations(scopedCancellable)}>Chọn tất cả{cancellationClassId ? ' của lớp' : ''} ({scopedCancellable.length})</button><button type="button" disabled={creating || state.loading || !selectedCancellations.length} onClick={() => setCancellationIds([])}>Bỏ chọn</button><button type="button" className="room-bulk-confirm" disabled={creating || state.loading || !selectedCancellations.length} onClick={() => { setCancellationSessions(selectedCancellations); setNotice('') }}><Ban size={15} />Hủy {selectedCancellations.length} buổi đã chọn</button></div>
        </section>}
        {state.unassignedClasses.length > 0 && <section className="room-timetable-unassigned" aria-label="Lịch chưa có phòng">
          <strong>Có buổi học chưa được gán phòng</strong>
          <p>Chọn lớp thuộc {room.name} để đưa các buổi đã tạo vào thời khóa biểu của phòng.</p>
          <ul>{state.unassignedClasses.map(sportClass => <li key={sportClass.id}><span>{sportClass.className} · {sportClass.unassignedCount} buổi chưa có phòng</span><button type="button" disabled={creating || showCreate || room.isActive === false} onClick={() => assignRoom(sportClass)}>Gán lịch vào phòng này</button></li>)}</ul>
          {assignmentError && <p role="alert" className="room-recurring-error">{assignmentError}</p>}
        </section>}
        <RoomSessionTimetable items={scopedItems} weekStart={weekStart} onWeekChange={changeWeek} onSelect={selectionMode ? toggleCancellation : setSelectedId} onSelectCancelled={setSelectedId} onReschedule={openReschedule} canReschedule={canRescheduleSession} selectionMode={selectionMode} selectedSessionIds={cancellationIds} canSelectSession={canCancelRoomSession} interactionDisabled={creating || state.loading || showCreate || Boolean(reschedule) || Boolean(rosterSession) || Boolean(cancellationSessions) || (!selectionMode && room.isActive === false)} title={selectionMode && cancellationClassId ? `Lịch lớp ${cancellationClasses.find(item => item.id === cancellationClassId)?.name || `#${cancellationClassId}`}` : 'Thời khóa biểu của phòng'} description={selectionMode ? 'Chỉ chọn các buổi chưa bắt đầu trong danh sách đang xem để hủy' : 'Kéo buổi học vào ngày hoặc khung giờ khác để đổi lịch · Chọn buổi học để xem chi tiết'} />
        {selected && <section ref={detailRef} className="room-timetable-detail" aria-labelledby="room-session-title" aria-live="polite">
          <header><div><small>BUỔI HỌC #{selected.id}</small><h3 id="room-session-title">{selected.className}</h3></div><button type="button" aria-label="Đóng chi tiết buổi học" onClick={() => setSelectedId(null)}><X size={18} /></button></header>
          <dl><div><dt>Bộ môn</dt><dd>{selected.sportName || 'Chưa cập nhật'}</dd></div><div><dt>Huấn luyện viên</dt><dd>{selected.coachName || 'Chưa phân công'}</dd></div><div><dt>Bắt đầu</dt><dd>{formatDateTime(selected.startsAt)}</dd></div><div><dt>Kết thúc</dt><dd>{formatDateTime(selected.endsAt)}</dd></div><div><dt>Sĩ số / Sức chứa</dt><dd>{selected.currentEnrollment ?? selected.enrolledCount ?? selected.registeredCount ?? '—'} / {selected.capacity ?? '—'}</dd></div><div><dt>Trạng thái</dt><dd>{roomSessionStatusLabel(selected)}</dd></div></dl>
          <div className="room-session-detail-actions"><button type="button" className="room-session-view-roster" disabled={creating || state.loading || showCreate} onClick={() => setRosterSession(selected)}><Users size={16} />Xem danh sách lớp</button>{canRescheduleSession(selected) && room.isActive !== false && <button type="button" className="room-session-reschedule" disabled={creating || state.loading || showCreate} onClick={() => openReschedule(selected)}><CalendarClock size={16} />Đổi lịch / Thay HLV</button>}{canCancelRoomSession(selected) && <button type="button" className="room-session-cancel" disabled={creating || state.loading || showCreate} onClick={() => openCancellation(selected)}><Ban size={16} />Hủy buổi học</button>}</div>
          {canRescheduleSession(selected) && room.isActive !== false && <p className="room-timetable-note">Học viên đã đăng ký sẽ nhận thông báo khi đổi lịch hoặc HLV. Đăng ký được giữ nguyên; học viên tự hủy nếu không thể tham gia, theo hạn hủy của buổi học.</p>}
          {selected.cancellationReason && <p>Lý do hủy: {selected.cancellationReason}</p>}
        </section>}
      </>}
    </div>
    {reschedule && <RescheduleRoomSessionDialog room={room} rooms={rooms} request={reschedule} onClose={() => setReschedule(null)} onBusyChange={setCreating} onSaved={sessionRescheduled} />}
    {rosterSession && <SessionRosterDialog session={rosterSession} onClose={() => setRosterSession(null)} />}
    {cancellationSessions && <CancelRoomSessionDialog sessions={cancellationSessions} room={room} cancelSessions={cancellationClassId ? (request, onProgress) => cancelSessionsForClass({ ...request, classId: cancellationClassId }, onProgress) : undefined} onClose={() => setCancellationSessions(null)} onBusyChange={setCreating} onCancelled={sessionsCancelled} />}
  </dialog>
}
