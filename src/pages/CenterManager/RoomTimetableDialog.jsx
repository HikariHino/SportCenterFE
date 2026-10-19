import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Calendar, MapPin, RefreshCw, Users, X } from 'lucide-react'
import WeeklyTimetable from '../../components/WeeklyTimetable'
import { getRoomTimetable } from '../../services/roomTimetableService'
import { getRoomErrorMessage } from '../../services/roomService'
import { classStatusLabel } from '../../utils/memberClasses'
import { timetableWeekStart } from '../../utils/memberTimetable'
import '../../style/CenterManager/RoomTimetable.css'

const formatDateTime = value => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }) : 'Chưa cập nhật'

export default function RoomTimetableDialog({ room, rooms, onClose }) {
  const dialogRef = useRef(null)
  const detailRef = useRef(null)
  const [weekStart, setWeekStart] = useState(() => timetableWeekStart())
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState({ items: [], loading: true, error: '' })
  const [selectedId, setSelectedId] = useState(null)
  const selected = state.items.find(item => item.id === selectedId)

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
    setState({ items: [], loading: true, error: '' })
    getRoomTimetable(room, rooms, { signal: controller.signal }).then(items => {
      if (!controller.signal.aborted) setState({ items, loading: false, error: '' })
    }).catch(error => {
      if (!controller.signal.aborted) setState({ items: [], loading: false, error: getRoomErrorMessage(error, 'Không thể tải thời khóa biểu của phòng.') })
    })
    return () => controller.abort()
  }, [room, rooms, revision])

  const changeWeek = value => { setWeekStart(value); setSelectedId(null) }

  return <dialog ref={dialogRef} className="room-timetable-dialog" aria-labelledby="room-timetable-title" onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose() } }}>
    <header className="room-timetable-header">
      <div><span><Calendar size={16} /> LỊCH SỬ DỤNG PHÒNG</span><h2 id="room-timetable-title">{room.name}</h2><p><MapPin size={14} />{room.location || 'Chưa cập nhật vị trí'}<span>·</span><Users size={14} />{room.capacity} học viên{room.isActive === false && <strong>· Phòng đã ngừng hoạt động</strong>}</p></div>
      <div className="room-timetable-header-actions"><button type="button" disabled={state.loading} onClick={() => { setSelectedId(null); setRevision(value => value + 1) }}><RefreshCw size={16} /> Làm mới</button><button type="button" aria-label="Đóng lịch phòng" onClick={onClose}><X size={21} /></button></div>
    </header>
    <div className="room-timetable-body" aria-busy={state.loading}>
      {state.loading ? <div className="room-timetable-state" role="status"><div className="room-spinner" /><p>Đang tải thời khóa biểu của phòng...</p></div> : state.error ? <div className="room-timetable-state" role="alert"><AlertCircle size={28} /><p>{state.error}</p><button type="button" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div> : <>
        <WeeklyTimetable items={state.items} weekStart={weekStart} onWeekChange={changeWeek} onSelect={setSelectedId} title="Thời khóa biểu của phòng" />
        <p className="room-timetable-note">Các ô trống là khung giờ chưa có buổi học trong lịch. Buổi đã hủy được gạch tên và không chiếm lịch phòng.</p>
        {selected && <section ref={detailRef} className="room-timetable-detail" aria-labelledby="room-session-title" aria-live="polite">
          <header><div><small>BUỔI HỌC #{selected.id}</small><h3 id="room-session-title">{selected.className}</h3></div><button type="button" aria-label="Đóng chi tiết buổi học" onClick={() => setSelectedId(null)}><X size={18} /></button></header>
          <dl><div><dt>Bộ môn</dt><dd>{selected.sportName || 'Chưa cập nhật'}</dd></div><div><dt>Huấn luyện viên</dt><dd>{selected.coachName || 'Chưa phân công'}</dd></div><div><dt>Bắt đầu</dt><dd>{formatDateTime(selected.startsAt)}</dd></div><div><dt>Kết thúc</dt><dd>{formatDateTime(selected.endsAt)}</dd></div><div><dt>Sĩ số / Sức chứa</dt><dd>{selected.currentEnrollment ?? selected.enrolledCount ?? selected.registeredCount ?? '—'} / {selected.capacity ?? '—'}</dd></div><div><dt>Trạng thái</dt><dd>{classStatusLabel(selected.status)}</dd></div></dl>
          {selected.cancellationReason && <p>Lý do hủy: {selected.cancellationReason}</p>}
        </section>}
      </>}
    </div>
  </dialog>
}
