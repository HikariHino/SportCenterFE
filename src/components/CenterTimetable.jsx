import { useEffect, useId, useRef, useState } from 'react'
import { CalendarDays, RefreshCw, X } from 'lucide-react'
import WeeklyTimetable from './WeeklyTimetable'
import { NumberedPagination } from './NumberedPagination'
import { listPage } from '../utils/listPagination'
import { timetableWeekStart } from '../utils/memberTimetable'
import { getRoomTimetableWeek, roomSessionStatusLabel } from '../utils/roomTimetable'
import { getCenterTimetable } from '../services/centerTimetableService'
import { getClassErrorMessage, getSessionRoster } from '../services/sportClassService'
import { useManagerResource, useManagerViewActive } from '../contexts/ManagerWorkspaceContext'
import { useReceptionistResource, useReceptionistViewActive } from '../contexts/ReceptionistWorkspaceContext'
import '../style/CenterTimetable.css'

export function ManagerCenterTimetable() {
  const active = useManagerViewActive()
  const resource = useManagerResource('class-sessions:center', getCenterTimetable, { initialData: [], enabled: active })
  return <CenterTimetable resource={resource} active={active} />
}

export function ReceptionistCenterTimetable() {
  const active = useReceptionistViewActive()
  const resource = useReceptionistResource('class-sessions:center', getCenterTimetable, { initialData: [], enabled: active })
  return <CenterTimetable resource={{ ...resource, reload: () => { resource.refresh().catch(() => {}) } }} active={active} />
}

const dateTime = value => new Date(value).toLocaleString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short',
})

export function CenterSessionDetails({ session, onClose }) {
  const id = useId()
  const dialog = useRef(null)
  const [revision, setRevision] = useState(0)
  const [page, setPage] = useState(1)
  const [state, setState] = useState({ loading: true, items: [], error: '' })
  useEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setState({ loading: true, items: [], error: '' })
    getSessionRoster(session.id, { signal: controller.signal }).then(items => {
      if (!controller.signal.aborted) setState({ loading: false, items: items.filter(item =>
        !['cancelled', 'canceled'].includes(String(item.registrationStatus || '').trim().toLowerCase())), error: '' })
    }).catch(error => {
      if (!controller.signal.aborted) setState({ loading: false, items: [], error: getClassErrorMessage(error, 'Không thể tải danh sách học viên.') })
    })
    return () => controller.abort()
  }, [session.id, revision])
  const range = listPage(state.items.length, page)
  return <dialog ref={dialog} className="center-session-dialog" aria-labelledby={`${id}-title`}
    onCancel={event => { event.preventDefault(); onClose() }}>
    <header><div><span>BUỔI HỌC #{session.id}</span><h2 id={`${id}-title`}>{session.className || 'Chi tiết buổi học'}</h2></div><button type="button" aria-label="Đóng chi tiết buổi học" onClick={onClose}><X size={20} /></button></header>
    <dl className="center-session-info">
      <div><dt>Phòng tập</dt><dd>{session.roomName || (session.roomId ? `Phòng #${session.roomId}` : 'Chưa cập nhật phòng')}</dd></div>
      <div><dt>Huấn luyện viên</dt><dd>{session.coachName || (session.coachId ? `Huấn luyện viên #${session.coachId}` : 'Chưa phân công')}</dd></div>
      <div><dt>Bắt đầu · giờ Việt Nam</dt><dd>{dateTime(session.startsAt)}</dd></div>
      <div><dt>Kết thúc · giờ Việt Nam</dt><dd>{dateTime(session.endsAt)}</dd></div>
      <div><dt>Trạng thái</dt><dd>{roomSessionStatusLabel(session)}</dd></div>
      <div><dt>Sức chứa</dt><dd>{session.capacity ?? 'Chưa cập nhật'}</dd></div>
    </dl>
    <section className="center-session-roster" aria-busy={state.loading} aria-labelledby={`${id}-roster`}>
      <header><h3 id={`${id}-roster`}>Danh sách học viên{!state.loading && !state.error && ` (${state.items.length})`}</h3><button type="button" disabled={state.loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} />Làm mới</button></header>
      {state.loading ? <p role="status">Đang tải danh sách học viên...</p> : state.error ? <p role="alert">{state.error}</p>
        : !state.items.length ? <p role="status">Buổi học chưa có học viên đăng ký.</p> : <>
          <div className="center-session-roster-scroll" tabIndex={0} role="region" aria-label="Danh sách học viên, có thể cuộn ngang">
            <table><thead><tr><th scope="col">STT</th><th scope="col">Học viên</th><th scope="col">Mã học viên</th><th scope="col">Đăng ký</th><th scope="col">Điểm danh</th></tr></thead>
              <tbody>{state.items.slice(range.offset, range.to).map((student, index) => <tr key={student.registrationId ?? student.memberId}>
                <td>{range.offset + index + 1}</td><th scope="row">{student.fullName || student.memberName || 'Chưa cập nhật'}</th><td>{student.memberCode || `#${student.memberId}`}</td>
                <td>{student.registrationStatus ? roomSessionStatusLabel({ status: student.registrationStatus }) : 'Đã đăng ký'}</td><td>{student.attendanceStatus ? roomSessionStatusLabel({ status: student.attendanceStatus }) : 'Chưa điểm danh'}</td>
              </tr>)}</tbody></table>
          </div>
          <NumberedPagination total={state.items.length} page={range.page} onChange={setPage} label="Học viên buổi học" prefix="center" />
        </>}
    </section>
    <footer><button type="button" onClick={onClose}>Đóng</button></footer>
  </dialog>
}

export default function CenterTimetable({ resource, active = true }) {
  const [week, setWeek] = useState(timetableWeekStart)
  const [selectedId, setSelectedId] = useState(null)
  const items = resource.data || []
  const selected = active && items.find(item => String(item.id) === String(selectedId))
  useEffect(() => { if (!active) setSelectedId(null) }, [active])
  const populatedWeek = getRoomTimetableWeek(items, week)
  return <section className="center-timetable-view" aria-label="Thời khóa biểu trung tâm">
    <header className="center-timetable-heading"><div><h2><CalendarDays size={24} />Thời khóa biểu trung tâm</h2><p>Các buổi đã lên lịch và đã hoàn thành · Không bao gồm buổi đã hủy.</p></div>
      <div><button type="button" onClick={() => setWeek(timetableWeekStart())}>Tuần hiện tại</button><button type="button" disabled={resource.loading || resource.refreshing} onClick={resource.reload}><RefreshCw size={17} />Làm mới lịch</button></div>
    </header>
    {resource.error && <p className="center-timetable-error" role="alert">{getClassErrorMessage(resource.error, 'Không thể tải thời khóa biểu.')} <button type="button" onClick={resource.reload}>Thử lại</button></p>}
    {resource.loading ? <p role="status">Đang tải thời khóa biểu trung tâm...</p> : <>
      <WeeklyTimetable items={items} weekStart={week} onWeekChange={setWeek} onSelect={setSelectedId} totalCount={items.length} getStatusLabel={roomSessionStatusLabel} />
      {!resource.error && populatedWeek !== week && <p className="center-timetable-other-week">Có buổi học ở tuần khác. <button type="button" onClick={() => setWeek(populatedWeek)}>Xem tuần có lịch</button></p>}
    </>}
    {selected && <CenterSessionDetails key={selected.id} session={selected} onClose={() => setSelectedId(null)} />}
  </section>
}
