import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, BookOpen, CalendarDays, ChevronLeft, ChevronRight, Clock3, LoaderCircle, MapPin, RefreshCw, Search, User, Users } from 'lucide-react'
import useResource from '../../hooks/useClassResource'
import { getMemberClasses, getMemberClassSessions } from '../../services/memberClassService'
import { bookingUnavailableReason, cancellationDeadline, classStatusLabel, getRoomForClass, selectableMemberSessions } from '../../utils/memberClasses'
import { formatClassDateTime } from './MemberSessionDetails'
import { timetableDateKey, timetableTime } from '../../utils/memberTimetable'

const PAGE_SIZE = 12
const emptyFilters = { search: '', sportId: '', coachId: '' }
const loadSessions = ({ classId }) => classId ? getMemberClassSessions(classId) : Promise.resolve({ items: [], total: 0 })
const courseDateLabel = value => value ? timetableDateKey(value).split('-').reverse().join('/') || 'Chưa cập nhật' : 'Chưa cập nhật'

function State({ resource, emptyText }) {
  return <div className={`member-classes-state${resource.error ? ' member-classes-error' : ''}`} role={resource.error ? 'alert' : 'status'}>
    {resource.loading ? <LoaderCircle className="member-spin" size={25} /> : resource.error ? <AlertCircle size={25} /> : <CalendarDays size={25} />}
    <p>{resource.loading ? 'Đang tải dữ liệu...' : resource.error || emptyText}</p>
    {resource.error && <button type="button" onClick={resource.reload}>Thử lại</button>}
  </div>
}

function Pager({ total, page, onChange, label }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (pages < 2) return null
  return <nav className="member-classes-pagination" aria-label={`Phân trang ${label}`}><span>{total} kết quả · Trang {page}/{pages}</span><div><button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={15} />Trước</button><button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)}>Sau<ChevronRight size={15} /></button></div></nav>
}

function SelectAllCheckbox({ checked, mixed, disabled, onChange }) {
  const ref = useRef(null)
  useEffect(() => { ref.current.indeterminate = mixed }, [mixed])
  return <label className="member-session-select-all"><input ref={ref} type="checkbox" checked={checked} disabled={disabled} onChange={onChange} />Chọn tất cả buổi có thể đăng ký</label>
}

export default function MemberClassBrowser({ sports, coaches, rooms, registered, registrations = [], busy, bookingState, onBookClass, refreshKey, now }) {
  const [draft, setDraft] = useState(emptyFilters)
  const [filters, setFilters] = useState(emptyFilters)
  const [page, setPage] = useState(1)
  const [course, setCourse] = useState(null)
  const [sessionPage, setSessionPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState([])
  const classes = useResource(getMemberClasses, { search: filters.search.trim() || undefined, sportId: filters.sportId || undefined, coachId: filters.coachId || undefined, page, pageSize: PAGE_SIZE }, refreshKey)
  const sessions = useResource(loadSessions, { classId: course?.id }, refreshKey)
  useEffect(() => { if (classes.data) setPage(previous => Math.min(previous, Math.max(1, Math.ceil(classes.data.total / PAGE_SIZE)))) }, [classes.data])
  useEffect(() => { if (sessions.data) setSessionPage(previous => Math.min(previous, Math.max(1, Math.ceil(sessions.data.total / PAGE_SIZE)))) }, [sessions.data])
  const enrich = item => ({ ...item, classId: course.id, className: item.className || course.className, sportName: item.sportName || course.sportName, coachName: item.coachName || ((item.coachId == null || String(item.coachId) === String(course.coachId)) ? course.coachName : undefined), roomName: item.roomName || getRoomForClass(item, rooms)?.name || getRoomForClass(course, rooms)?.name })
  const allSessions = (course ? sessions.data?.items || [] : []).map(enrich).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
  const available = allSessions.filter(item => !bookingUnavailableReason(item, registered.has(String(item.id)), now, registrations))
  const selectedSessions = selectableMemberSessions(selectedIds.map(id => available.find(item => String(item.id) === id)).filter(Boolean), registrations, now)
  const selectedSet = new Set(selectedSessions.map(item => String(item.id)))
  const planned = [...registrations, ...selectedSessions.map(item => ({ ...item, sessionId: item.id, status: 'Registered', sessionStatus: 'Scheduled' }))]
  const availableKey = available.filter(item => !bookingUnavailableReason(item, false, now, planned)).map(item => String(item.id)).join('|')
  const selectAll = selectableMemberSessions([...selectedSessions, ...available.filter(item => !selectedSet.has(String(item.id)))], registrations, now)
  const allSelected = selectAll.length > 0 && selectedSessions.length === selectAll.length
  const blocked = busy || bookingState.loading || Boolean(bookingState.error)
  useEffect(() => {
    if (sessions.loading || sessions.error || bookingState.loading || bookingState.error) return
    const eligibleIds = new Set(availableKey.split('|'))
    setSelectedIds(previous => {
      const next = previous.filter(id => eligibleIds.has(id))
      return next.length === previous.length ? previous : next
    })
  }, [availableKey, sessions.loading, sessions.error, bookingState.loading, bookingState.error])

  const toggleSession = (sessionId, checked) => {
    const id = String(sessionId)
    setSelectedIds(previous => checked ? [...new Set([...previous, id])] : previous.filter(value => value !== id))
  }

  if (course) return <section className="member-course-sessions" aria-label={`Các buổi học của ${course.className}`}>
    <header className="member-course-heading"><div><button type="button" className="member-course-back" onClick={() => setCourse(null)}><ArrowLeft size={16} />Danh sách lớp học</button><h3>{course.className}</h3><p className="member-classes-muted">{course.sportName || 'Lớp học'} · {course.coachName || 'Chưa phân công HLV'}</p></div><button type="button" disabled={sessions.loading || busy} onClick={sessions.reload}><RefreshCw size={16} />Làm mới buổi học</button></header>
    {bookingState.loading && <p className="member-classes-muted" role="status">Đang kiểm tra gói tập và lịch đã đăng ký...</p>}
    {bookingState.error && <div className="member-classes-error" role="alert"><p>{bookingState.error}</p><button type="button" onClick={bookingState.reload}>Thử lại</button></div>}
    {!sessions.loading && !sessions.error && allSessions.length > 0 && <div className="member-session-selection-tools">
      <div><strong>{allSessions.length} buổi học <span>· {available.length} buổi có thể đăng ký</span></strong><p>Tích chọn những buổi bạn muốn tham gia. Lựa chọn được giữ khi chuyển trang.</p></div>
      <SelectAllCheckbox checked={allSelected} mixed={selectedSessions.length > 0 && !allSelected} disabled={blocked || !available.length} onChange={event => setSelectedIds(event.target.checked ? selectAll.map(item => String(item.id)) : [])} />
      <p>Chọn tất cả áp dụng cho các buổi không trùng lịch ở mọi trang.</p>
    </div>}
    {sessions.loading || sessions.error || !allSessions.length ? <State resource={sessions} emptyText="Lớp chưa có buổi học. Vui lòng quay lại sau." /> : <>
      <div className="member-session-list">
        <div className="member-session-list-heading" aria-hidden="true"><span>Buổi học</span><span>Phòng & Huấn luyện viên</span><span>Sĩ số</span><span>Trạng thái</span></div>
        <ul>{allSessions.slice((sessionPage - 1) * PAGE_SIZE, sessionPage * PAGE_SIZE).map(session => {
        const unavailable = bookingUnavailableReason(session, registered.has(String(session.id)), now, planned)
        const selected = !unavailable && selectedSet.has(String(session.id))
        const deadline = cancellationDeadline(session)
        return <li className="member-session-list-row" key={session.id} data-member-session-id={session.id} data-selected={selected} data-unavailable={Boolean(unavailable)}>
          <label className="member-session-choice">
            <input type="checkbox" checked={selected} disabled={blocked || Boolean(unavailable)} aria-label={`Chọn buổi #${session.id}, ${formatClassDateTime(session.startsAt)}`} aria-describedby={`member-session-${course.id}-${session.id}-availability`} onChange={event => toggleSession(session.id, event.target.checked)} />
            <span className="member-session-date"><strong>{courseDateLabel(session.startsAt)}</strong><span><Clock3 size={14} />{timetableTime(session.startsAt)} – {timetableTime(session.endsAt)}{timetableDateKey(session.endsAt) > timetableDateKey(session.startsAt) && ' (+1 ngày)'}</span><small>Buổi #{session.id}</small></span>
            <span className="member-session-location"><span><MapPin size={14} />{session.roomName || 'Chưa cập nhật phòng'}</span><span><User size={14} />{session.coachName || 'Chưa phân công HLV'}</span></span>
            <span className="member-session-enrollment"><Users size={15} />{session.currentEnrollment ?? session.enrolledCount ?? session.registeredCount ?? '—'} / {session.capacity ?? '—'}</span>
            <span className="member-session-availability"><span className="member-classes-badge">{classStatusLabel(session.status)}</span><small id={`member-session-${course.id}-${session.id}-availability`}>{unavailable || 'Có thể đăng ký'}</small></span>
          </label>
          {(deadline || session.cancellationReason) && <p className="member-session-row-note">{session.cancellationReason ? `Lý do hủy: ${session.cancellationReason}` : `Hạn hủy đăng ký: ${formatClassDateTime(deadline)}`}</p>}
        </li>
      })}</ul></div><Pager total={allSessions.length} page={sessionPage} onChange={setSessionPage} label="buổi học của lớp" />
      <div className="member-session-selection-footer">
        <div role="status" aria-live="polite"><strong>Đã chọn {selectedSessions.length} buổi</strong><span>Chỉ đăng ký những buổi bạn đã tích chọn.</span></div>
        <div><button type="button" disabled={blocked || !selectedSessions.length} onClick={() => setSelectedIds([])}>Bỏ chọn</button><button type="button" className="primary" disabled={blocked || !selectedSessions.length} onClick={() => onBookClass({ ...course, sessions: selectedSessions })}><CalendarDays size={16} />Đăng ký {selectedSessions.length ? `${selectedSessions.length} buổi đã chọn` : 'buổi đã chọn'}</button></div>
      </div>
    </>}
  </section>

  return <section className="member-course-browser" aria-label="Tìm lớp học">
    <header className="member-browser-heading"><div><h3>Khám phá lớp học</h3><p>Tìm theo tên lớp, bộ môn hoặc huấn luyện viên để chọn buổi tập phù hợp.</p></div>{!classes.loading && !classes.error && <span>{classes.data?.total || 0} lớp học</span>}</header>
    <form className="member-classes-filters" onSubmit={event => { event.preventDefault(); setFilters({ ...draft }); setPage(1); classes.reload() }}>
      <label>Tìm lớp học<input name="classSearch" value={draft.search} maxLength={200} placeholder="Nhập tên lớp học..." onChange={event => setDraft({ ...draft, search: event.target.value })} /></label>
      <label>Bộ môn<select name="classSportId" value={draft.sportId} disabled={sports.loading || Boolean(sports.error)} onChange={event => setDraft({ ...draft, sportId: event.target.value })}><option value="">Tất cả bộ môn</option>{(sports.data || []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Huấn luyện viên<select name="classCoachId" value={draft.coachId} disabled={coaches.loading || Boolean(coaches.error)} onChange={event => setDraft({ ...draft, coachId: event.target.value })}><option value="">Tất cả HLV</option>{(coaches.data || []).map(item => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></label>
      <div className="member-classes-filter-actions"><button type="submit" className="primary"><Search size={16} />Tìm kiếm</button><button type="button" onClick={() => { setDraft(emptyFilters); setFilters(emptyFilters); setPage(1) }}>Xóa bộ lọc</button></div>
      {sports.error && <p className="member-classes-error" role="alert">{sports.error} <button type="button" onClick={sports.reload}>Thử lại bộ môn</button></p>}
      {coaches.error && <p className="member-classes-error" role="alert">{coaches.error} <button type="button" onClick={coaches.reload}>Thử lại HLV</button></p>}
    </form>
    {classes.loading || classes.error || !classes.data?.items.length ? <State resource={classes} emptyText="Không tìm thấy lớp học phù hợp. Hãy thử thay đổi bộ lọc." /> : <>
      <div className="member-classes-grid">{classes.data.items.map(item => <button type="button" className="member-course-card" key={item.id} data-member-class-id={item.id} onClick={() => { setCourse(item); setSessionPage(1); setSelectedIds([]) }}>
        <span className="member-course-card-top"><span className="member-classes-badge">{item.sportName || 'Lớp học'}</span><small>#{item.id}</small></span><strong>{item.className}</strong>
        <span><User size={16} />{item.coachName || 'Chưa phân công HLV'}</span><span><MapPin size={16} />{getRoomForClass(item, rooms)?.name || 'Chưa cập nhật phòng'}</span>
        <span><CalendarDays size={16} />{courseDateLabel(item.startDate)} – {courseDateLabel(item.endDate)}</span>
        <span className="member-course-view-sessions"><BookOpen size={16} />Xem các buổi học<ChevronRight size={16} /></span>
      </button>)}</div><Pager total={classes.data.total} page={page} onChange={setPage} label="lớp học" />
    </>}
  </section>
}
