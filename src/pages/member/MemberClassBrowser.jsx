import { useEffect, useState } from 'react'
import { AlertCircle, ArrowLeft, BookOpen, CalendarDays, ChevronLeft, ChevronRight, LoaderCircle, MapPin, RefreshCw, Search, User, Users } from 'lucide-react'
import useResource from '../../hooks/useClassResource'
import { getMemberClasses, getMemberClassSessions } from '../../services/memberClassService'
import { bookingUnavailableReason, classStatusLabel, getRoomForClass } from '../../utils/memberClasses'
import SessionDetails, { formatClassDateTime } from './MemberSessionDetails'
import { timetableDateKey } from '../../utils/memberTimetable'

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

export default function MemberClassBrowser({ sports, coaches, rooms, registered, busy, bookingState, onBook, onBookClass, refreshKey, now }) {
  const [draft, setDraft] = useState(emptyFilters)
  const [filters, setFilters] = useState(emptyFilters)
  const [page, setPage] = useState(1)
  const [course, setCourse] = useState(null)
  const [sessionPage, setSessionPage] = useState(1)
  const classes = useResource(getMemberClasses, { search: filters.search.trim() || undefined, sportId: filters.sportId || undefined, coachId: filters.coachId || undefined, page, pageSize: PAGE_SIZE }, refreshKey)
  const sessions = useResource(loadSessions, { classId: course?.id }, refreshKey)
  useEffect(() => { if (classes.data) setPage(previous => Math.min(previous, Math.max(1, Math.ceil(classes.data.total / PAGE_SIZE)))) }, [classes.data])
  useEffect(() => { if (sessions.data) setSessionPage(previous => Math.min(previous, Math.max(1, Math.ceil(sessions.data.total / PAGE_SIZE)))) }, [sessions.data])
  const enrich = item => ({ ...item, classId: course.id, className: item.className || course.className, sportName: item.sportName || course.sportName, coachName: item.coachName || ((item.coachId == null || String(item.coachId) === String(course.coachId)) ? course.coachName : undefined), roomName: item.roomName || getRoomForClass(item, rooms)?.name || getRoomForClass(course, rooms)?.name })
  const allSessions = (course ? sessions.data?.items || [] : []).map(enrich).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
  const available = allSessions.filter(item => !bookingUnavailableReason(item, registered.has(String(item.id)), now))
  const blocked = busy || bookingState.loading || Boolean(bookingState.error)

  if (course) return <section className="member-course-sessions" aria-label={`Các buổi học của ${course.className}`}>
    <header className="member-course-heading"><div><button type="button" className="member-course-back" onClick={() => setCourse(null)}><ArrowLeft size={16} />Danh sách lớp học</button><h3>{course.className}</h3><p className="member-classes-muted">{course.sportName || 'Lớp học'} · {course.coachName || 'Chưa phân công HLV'}</p></div><button type="button" disabled={sessions.loading || busy} onClick={sessions.reload}><RefreshCw size={16} />Làm mới buổi học</button></header>
    {bookingState.loading && <p className="member-classes-muted" role="status">Đang kiểm tra gói tập và lịch đã đăng ký...</p>}
    {bookingState.error && <div className="member-classes-error" role="alert"><p>{bookingState.error}</p><button type="button" onClick={bookingState.reload}>Thử lại</button></div>}
    {!sessions.loading && !sessions.error && <div className="member-course-book-all"><div><strong>{allSessions.length} buổi học · {available.length} buổi có thể đăng ký</strong><p>Đăng ký tất cả áp dụng cho các buổi còn mở của lớp, kể cả ở trang tiếp theo. Buổi đã đăng ký, đã bắt đầu, đã hủy hoặc hết chỗ sẽ được bỏ qua.</p></div><button type="button" className="primary" disabled={blocked || !available.length} onClick={() => onBookClass({ ...course, sessions: available })}><CalendarDays size={16} />Đăng ký tất cả ({available.length} buổi)</button></div>}
    {sessions.loading || sessions.error || !allSessions.length ? <State resource={sessions} emptyText="Lớp chưa có buổi học. Vui lòng quay lại sau." /> : <>
      <div className="member-classes-grid">{allSessions.slice((sessionPage - 1) * PAGE_SIZE, sessionPage * PAGE_SIZE).map(session => {
        const unavailable = bookingUnavailableReason(session, registered.has(String(session.id)), now)
        return <article className="member-classes-card" key={session.id} data-member-session-id={session.id}>
          <div className="member-classes-card-top"><span className="member-classes-badge">{classStatusLabel(session.status)}</span><small>Buổi #{session.id}</small></div>
          <h4>{formatClassDateTime(session.startsAt)}</h4><SessionDetails item={session} />
          <div className="member-classes-capacity"><Users size={16} /><span>Sĩ số: {session.currentEnrollment ?? session.enrolledCount ?? session.registeredCount ?? '—'} / {session.capacity ?? '—'}</span></div>
          <button type="button" className="primary member-session-book" disabled={blocked || Boolean(unavailable)} onClick={() => onBook(session)}>{unavailable || 'Đăng ký buổi này'}</button>
        </article>
      })}</div><Pager total={allSessions.length} page={sessionPage} onChange={setSessionPage} label="buổi học của lớp" />
    </>}
  </section>

  return <section className="member-course-browser" aria-label="Tìm lớp học">
    <form className="member-classes-filters" onSubmit={event => { event.preventDefault(); setFilters({ ...draft }); setPage(1); classes.reload() }}>
      <label>Tìm lớp học<input name="classSearch" value={draft.search} maxLength={200} placeholder="Nhập tên lớp học..." onChange={event => setDraft({ ...draft, search: event.target.value })} /></label>
      <label>Bộ môn<select name="classSportId" value={draft.sportId} disabled={sports.loading || Boolean(sports.error)} onChange={event => setDraft({ ...draft, sportId: event.target.value })}><option value="">Tất cả bộ môn</option>{(sports.data || []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Huấn luyện viên<select name="classCoachId" value={draft.coachId} disabled={coaches.loading || Boolean(coaches.error)} onChange={event => setDraft({ ...draft, coachId: event.target.value })}><option value="">Tất cả HLV</option>{(coaches.data || []).map(item => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></label>
      <div className="member-classes-filter-actions"><button type="submit" className="primary"><Search size={16} />Tìm kiếm</button><button type="button" onClick={() => { setDraft(emptyFilters); setFilters(emptyFilters); setPage(1) }}>Xóa bộ lọc</button></div>
      {sports.error && <p className="member-classes-error" role="alert">{sports.error} <button type="button" onClick={sports.reload}>Thử lại bộ môn</button></p>}
      {coaches.error && <p className="member-classes-error" role="alert">{coaches.error} <button type="button" onClick={coaches.reload}>Thử lại HLV</button></p>}
    </form>
    {classes.loading || classes.error || !classes.data?.items.length ? <State resource={classes} emptyText="Không tìm thấy lớp học phù hợp. Hãy thử thay đổi bộ lọc." /> : <>
      <div className="member-classes-grid">{classes.data.items.map(item => <button type="button" className="member-course-card" key={item.id} data-member-class-id={item.id} onClick={() => { setCourse(item); setSessionPage(1) }}>
        <span className="member-classes-badge">{item.sportName || 'Lớp học'}</span><strong>{item.className}</strong>
        <span><User size={16} />{item.coachName || 'Chưa phân công HLV'}</span><span><MapPin size={16} />{getRoomForClass(item, rooms)?.name || 'Chưa cập nhật phòng'}</span>
        <span><CalendarDays size={16} />{courseDateLabel(item.startDate)} – {courseDateLabel(item.endDate)}</span>
        <span className="member-course-view-sessions"><BookOpen size={16} />Xem các buổi học<ChevronRight size={16} /></span>
      </button>)}</div><Pager total={classes.data.total} page={page} onChange={setPage} label="lớp học" />
    </>}
  </section>
}
