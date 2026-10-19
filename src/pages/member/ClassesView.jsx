import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, CreditCard, LoaderCircle, MapPin, RefreshCw, Search, ShieldAlert, Star, User, Users, X } from 'lucide-react'
import { getSports, getCoaches } from '../../services/classCatalogService'
import { getAvailableSessions, getAllMyRegistrations, bookSession, cancelRegistration, checkInRegistration, reviewRegistration, getMemberClassErrorMessage } from '../../services/memberClassService'
import { getMySubscriptions } from '../../services/memberSubscriptionService'
import { getPublicClasses } from '../../services/sportClassService'
import { getRooms } from '../../services/roomService'
import { bookingUnavailableReason, cancellationDeadline, classStatusLabel, getRoomForClass, registrationActions } from '../../utils/memberClasses'
import { timetableWeekStart } from '../../utils/memberTimetable'
import WeeklyTimetable from '../../components/WeeklyTimetable'
import '../../style/member/ClassesView.css'

const PAGE_SIZE = 12
const initialFilters = { search: '', sportId: '', coachId: '', from: '', to: '', onlyAvailable: false }

function formatDate(value) {
  if (!value) return 'Chưa cập nhật'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Chưa cập nhật' : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function useResource(loader, params = {}) {
  const key = JSON.stringify(params)
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  const reload = useCallback(() => setRevision(value => value + 1), [])
  useEffect(() => {
    let active = true
    setState({ data: null, loading: true, error: '' })
    loader(JSON.parse(key)).then(data => {
      if (active) setState({ data, loading: false, error: '' })
    }).catch(error => {
      if (active) setState({ data: null, loading: false, error: getMemberClassErrorMessage(error) })
    })
    return () => { active = false }
  }, [loader, key, revision])
  return { ...state, reload }
}

function ResourceState({ resource, emptyText }) {
  if (resource.loading) return <div className="member-classes-state" role="status"><LoaderCircle className="member-spin" size={26} /><p>Đang tải dữ liệu...</p></div>
  if (resource.error) return <div className="member-classes-state member-classes-error" role="alert"><AlertCircle size={26} /><p>{resource.error}</p><button type="button" onClick={resource.reload}>Thử lại</button></div>
  return <div className="member-classes-state"><CalendarDays size={30} /><p>{emptyText}</p></div>
}

function Pagination({ resource, page, onChange }) {
  if (!resource.data || resource.loading || resource.error) return null
  const { total, pageSize } = resource.data
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return <nav className="member-classes-pagination" aria-label="Phân trang buổi học">
    <span>{total} kết quả · Trang {page}/{pages}</span>
    <div><button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={15} /> Trước</button><button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)}>Sau <ChevronRight size={15} /></button></div>
  </nav>
}

function SessionDetails({ item }) {
  const deadline = cancellationDeadline(item)
  return <dl className="member-classes-details">
    <div><dt><Clock3 size={15} /> Bắt đầu</dt><dd>{formatDate(item.startsAt)}</dd></div>
    <div><dt><Clock3 size={15} /> Kết thúc</dt><dd>{formatDate(item.endsAt)}</dd></div>
    <div><dt><User size={15} /> Huấn luyện viên</dt><dd>{item.coachName || 'Chưa cập nhật'}</dd></div>
    <div><dt><MapPin size={15} /> Phòng tập</dt><dd>{item.roomName || 'Chưa cập nhật'}</dd></div>
    {deadline && <div><dt>Hạn hủy đăng ký</dt><dd>{formatDate(deadline)}</dd></div>}
  </dl>
}

function RegistrationDetailsDialog({ item, busy, now, onClose, onAction }) {
  const dialogRef = useRef(null)
  const allowed = registrationActions(item, now)
  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return <dialog ref={dialogRef} className="member-classes-dialog" aria-labelledby="member-registration-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="member-registration-dialog-content">
      <header><h2 id="member-registration-title">Chi tiết buổi học</h2><button type="button" aria-label="Đóng" onClick={onClose}><X size={20} /></button></header>
      <h3>{item.className || `Buổi học #${item.sessionId}`}</h3>
      <span className="member-classes-badge">{classStatusLabel(item.status)}</span>
      <SessionDetails item={item} />
      <p className="member-classes-muted">{allowed.checkedIn ? 'Đã điểm danh' : item.attendanceStatus ? classStatusLabel(item.attendanceStatus) : 'Chưa điểm danh'}{item.checkInTime && ` · ${formatDate(item.checkInTime)}`}</p>
      {allowed.reviewed && <div className="member-classes-review"><strong><Star size={16} /> {item.review?.rating ?? item.rating ?? 'Đã gửi'}{(item.review?.rating ?? item.rating) ? '/5 sao' : ' đánh giá'}</strong>{item.review?.comment && <p>{item.review.comment}</p>}</div>}
      <div className="member-classes-card-actions">
        {allowed.checkIn && <button type="button" className="primary" disabled={busy} onClick={() => onAction('checkIn', item)}><Check size={15} /> Điểm danh</button>}
        {allowed.cancel && <button type="button" disabled={busy} onClick={() => onAction('cancel', item)}>Hủy đăng ký</button>}
        {allowed.review && <button type="button" className="primary" disabled={busy} onClick={() => onAction('review', item)}><Star size={15} /> Đánh giá buổi học</button>}
      </div>
    </div>
  </dialog>
}

function ActionDialog({ action, busy, error, onClose, onSubmit, hasActiveSubscription, onNavigateTab }) {
  const dialogRef = useRef(null)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [reason, setReason] = useState('')
  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    return () => dialog.close()
  }, [])
  const titles = { book: 'Xác nhận đặt lịch', cancel: 'Hủy đăng ký buổi học', checkIn: 'Điểm danh buổi học', review: 'Đánh giá buổi học' }
  const isBookBlocked = action.type === 'book' && hasActiveSubscription === false
  return <dialog className="member-classes-dialog" ref={dialogRef} aria-labelledby="member-class-dialog-title" onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <form onSubmit={event => { event.preventDefault(); onSubmit({ rating, comment, reason }) }}>
      <header><h2 id="member-class-dialog-title">{titles[action.type]}</h2><button type="button" aria-label="Đóng" disabled={busy} onClick={onClose}><X size={20} /></button></header>
      <h3>{action.item.className || `Buổi học #${action.item.sessionId || action.item.id}`}</h3>
      <SessionDetails item={action.item} />
      {action.type === 'book' && <>
        {hasActiveSubscription === false ? (
          <div className="member-classes-dialog-alert" role="alert">
            <ShieldAlert size={20} />
            <div>
              <strong>Không thể đặt lịch khi chưa đăng ký gói thành viên.</strong>
              <p>Bạn cần có gói hội viên đang còn hiệu lực để đặt lịch giữ chỗ buổi học này.</p>
              {onNavigateTab && (
                <button
                  type="button"
                  className="member-classes-link-btn"
                  onClick={() => {
                    onClose()
                    onNavigateTab('subscriptions')
                  }}
                >
                  <CreditCard size={14} /> Đi tới Đăng ký gói tập
                </button>
              )}
            </div>
          </div>
        ) : (
          <p>Đăng ký giữ chỗ tham gia buổi học bằng gói tập của bạn. Gói tập cần còn hiệu lực và đáp ứng điều kiện của buổi học.</p>
        )}
      </>}
      {action.type === 'checkIn' && <p>Xác nhận bạn đã có mặt tại phòng tập để tham gia buổi học.</p>}
      {action.type === 'cancel' && <>
        <p>Yêu cầu hủy chỉ được chấp nhận trong thời hạn theo chính sách của buổi học.</p>
        <label htmlFor="member-class-cancel-reason">Lý do hủy (không bắt buộc)</label>
        <textarea id="member-class-cancel-reason" rows={3} maxLength={500} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} />
      </>}
      {action.type === 'review' && <>
        <fieldset className="member-classes-stars" disabled={busy}>
          <legend>Chất lượng buổi học</legend>
          {[1, 2, 3, 4, 5].map(value => <label key={value} className={value <= rating ? 'selected' : ''}>
            <input type="radio" name="class-rating" value={value} checked={rating === value} onChange={() => setRating(value)} required aria-label={`${value} sao`} />
            <Star size={30} fill={value <= rating ? 'currentColor' : 'none'} aria-hidden="true" />
            <span>{value}</span>
          </label>)}
        </fieldset>
        <label htmlFor="member-class-comment">Nhận xét (không bắt buộc)</label>
        <textarea id="member-class-comment" rows={4} maxLength={2000} value={comment} disabled={busy} onChange={event => setComment(event.target.value)} placeholder="Chia sẻ trải nghiệm về nội dung buổi học, HLV và phòng tập..." />
        <small>{comment.length}/2.000 ký tự</small>
      </>}
      {error && <p className="member-classes-error" role="alert">{error}</p>}
      <footer><button type="button" disabled={busy} onClick={onClose}>Đóng</button><button type="submit" className="primary" disabled={busy || isBookBlocked || (action.type === 'review' && !rating)}>{busy ? <><LoaderCircle className="member-spin" size={16} /> Đang xử lý...</> : action.type === 'review' ? 'Gửi đánh giá' : 'Xác nhận'}</button></footer>
    </form>
  </dialog>
}

export function ClassesView({ showNotice, onNavigateTab }) {
  const [tab, setTab] = useState('browse')
  const [draft, setDraft] = useState(initialFilters)
  const [filters, setFilters] = useState(initialFilters)
  const [filterError, setFilterError] = useState('')
  const [sessionPage, setSessionPage] = useState(1)
  const [minePage, setMinePage] = useState(1)
  const [mineLayout, setMineLayout] = useState('timetable')
  const [weekStart, setWeekStart] = useState(() => timetableWeekStart())
  const [selectedRegistrationId, setSelectedRegistrationId] = useState(null)
  const [action, setAction] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [patches, setPatches] = useState({})
  const [booked, setBooked] = useState({})
  const [noSubAlertModal, setNoSubAlertModal] = useState(false)
  const [selectedSessionForAlert, setSelectedSessionForAlert] = useState(null)
  const actionLock = useRef(false)
  const mounted = useRef(true)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    mounted.current = true
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => { mounted.current = false; window.clearInterval(timer) }
  }, [])

  const sports = useResource(getSports)
  const coaches = useResource(getCoaches)
  const rooms = useResource(getRooms)
  const publicClasses = useResource(getPublicClasses, { pageSize: 100 })
  const allSessions = useResource(getAvailableSessions, { pageSize: 100 })
  const sessions = useResource(getAvailableSessions, {
    search: filters.search.trim() || undefined,
    sportId: filters.sportId ? Number(filters.sportId) : undefined,
    coachId: filters.coachId ? Number(filters.coachId) : undefined,
    from: filters.from ? new Date(`${filters.from}T00:00:00`).toISOString() : undefined,
    to: filters.to ? new Date(`${filters.to}T23:59:59.999`).toISOString() : undefined,
    onlyAvailable: filters.onlyAvailable, page: sessionPage, pageSize: PAGE_SIZE,
  })
  const mine = useResource(getAllMyRegistrations)
  const subscriptions = useResource(getMySubscriptions)

  const roomsList = useMemo(() => (Array.isArray(rooms.data) ? rooms.data : []), [rooms.data])
  const coachesList = useMemo(() => (Array.isArray(coaches.data) ? coaches.data : []), [coaches.data])

  const classesMap = useMemo(() => {
    const map = {}
    for (const c of publicClasses.data?.items || []) {
      if (c?.id) map[c.id] = c
    }
    return map
  }, [publicClasses.data])

  const sessionsMap = useMemo(() => {
    const map = {}
    for (const s of allSessions.data?.items || []) {
      if (s?.id) map[s.id] = s
    }
    for (const s of sessions.data?.items || []) {
      if (s?.id) map[s.id] = { ...(map[s.id] || {}), ...s }
    }
    return map
  }, [allSessions.data, sessions.data])

  const enrichItem = useCallback((rawItem) => {
    if (!rawItem) return rawItem

    const sessionId = rawItem.sessionId || rawItem.id
    const session = sessionId ? sessionsMap[sessionId] : null
    const classId = rawItem.classId || session?.classId
    const cls = classId ? classesMap[classId] : null

    // 1. Huấn luyện viên
    let coachName = rawItem.coachName || session?.coachName || cls?.coachName
    if (!coachName) {
      const coachId = rawItem.coachId || session?.coachId || cls?.coachId
      if (coachId) {
        const found = coachesList.find(c => Number(c.id) === Number(coachId))
        if (found?.fullName) coachName = found.fullName
      }
    }
    if (!coachName) {
      const nameString = `${rawItem.className || ''} ${cls?.className || ''}`.toLowerCase()
      const matchCoach = coachesList.find(c => {
        const parts = (c.fullName || '').trim().split(/\s+/)
        const lastName = parts[parts.length - 1]
        return lastName && lastName.length >= 2 && nameString.includes(lastName.toLowerCase())
      })
      if (matchCoach?.fullName) coachName = matchCoach.fullName
    }

    // 2. Phòng tập
    let roomName = rawItem.roomName || session?.roomName
    if (!roomName) {
      const roomId = rawItem.roomId || session?.roomId || cls?.roomId
      if (roomId) {
        const found = roomsList.find(r => Number(r.id) === Number(roomId))
        if (found?.name) roomName = found.name
      }
    }
    if (!roomName && cls?.schedule) {
      const roomMatch = cls.schedule.match(/\[Phòng:\s*([^\]]+)\]/i) || cls.schedule.match(/\[([^\]]+)\]/)
      if (roomMatch) {
        roomName = roomMatch[1].trim()
      } else {
        const foundInSchedule = roomsList.find(r => r.name && cls.schedule.toLowerCase().includes(r.name.toLowerCase()))
        if (foundInSchedule?.name) roomName = foundInSchedule.name
      }
    }
    if (!roomName && (rawItem.schedule || session?.schedule)) {
      const sched = rawItem.schedule || session?.schedule
      const roomMatch = sched.match(/\[Phòng:\s*([^\]]+)\]/i) || sched.match(/\[([^\]]+)\]/)
      if (roomMatch) roomName = roomMatch[1].trim()
    }
    if (!roomName && cls) {
      const detected = getRoomForClass(cls, roomsList)
      if (detected?.name) roomName = detected.name
    }

    return {
      ...rawItem,
      className: rawItem.className || session?.className || cls?.className,
      startsAt: rawItem.startsAt || session?.startsAt,
      endsAt: rawItem.endsAt || session?.endsAt,
      coachName: coachName || rawItem.coachName,
      roomName: roomName || rawItem.roomName,
      sportName: rawItem.sportName || cls?.sportName || session?.sportName,
    }
  }, [classesMap, sessionsMap, roomsList, coachesList])

  const hasActiveSubscription = useMemo(() => {
    if (!subscriptions.data) return null
    const nowDate = new Date()
    return subscriptions.data.some(sub => {
      const status = String(sub.status || '').toLowerCase()
      if (status !== 'active') return false
      if (sub.endDate) {
        const end = new Date(sub.endDate)
        if (!Number.isNaN(end.getTime()) && end < nowDate) return false
      }
      return true
    })
  }, [subscriptions.data])

  const registrations = (mine.data?.items || []).map(item => enrichItem({ ...item, ...patches[item.id] }))
  const listedRegistrations = registrations.slice((minePage - 1) * PAGE_SIZE, minePage * PAGE_SIZE)
  const selectedRegistration = registrations.find(item => item.id === selectedRegistrationId)
  const registeredSessions = new Set(registrations.filter(item => !['cancelled', 'canceled'].includes(String(item.status).toLowerCase())).map(item => String(item.sessionId)))
  const current = tab === 'browse' ? sessions : mine

  // If a mutation removes the final item from a page, return to the last available page.
  useEffect(() => {
    if (sessions.data) setSessionPage(page => Math.min(page, Math.max(1, Math.ceil(sessions.data.total / sessions.data.pageSize))))
  }, [sessions.data])
  useEffect(() => {
    if (mine.data) setMinePage(page => Math.min(page, Math.max(1, Math.ceil(mine.data.total / PAGE_SIZE))))
  }, [mine.data])

  const openAction = (type, rawItem) => {
    const item = enrichItem(rawItem)
    setSelectedRegistrationId(null)
    setActionError('')
    setNotice('')
    if (type === 'book' && hasActiveSubscription === false) {
      setSelectedSessionForAlert(item)
      setNoSubAlertModal(true)
      if (showNotice) {
        showNotice('Không thể đặt lịch khi chưa đăng ký gói thành viên.')
      }
      return
    }
    setAction({ type, item })
  }

  const submitAction = async values => {
    if (actionLock.current || !action) return
    actionLock.current = true
    setBusy(true)
    setActionError('')
    const { type, item } = action
    try {
      if (type === 'book') {
        if (hasActiveSubscription === false) {
          throw new Error('Không thể đặt lịch khi chưa đăng ký gói thành viên.')
        }
        const reason = bookingUnavailableReason(item, booked[item.id] || registeredSessions.has(String(item.id)))
        if (reason) throw new Error(reason)
        await bookSession(item.id)
      } else {
        if (!registrationActions(item)[type]) throw new Error('Thao tác không còn khả dụng. Vui lòng đóng cửa sổ và làm mới lịch đã đặt.')
        if (type === 'cancel') await cancelRegistration(item.id, values.reason)
        if (type === 'checkIn') await checkInRegistration(item.id)
        if (type === 'review') await reviewRegistration(item.id, values)
      }
      if (!mounted.current) return
      if (type === 'book') {
        setBooked(previous => ({ ...previous, [item.id]: true }))
        setMinePage(1)
        setWeekStart(timetableWeekStart(item.startsAt))
        setTab('mine')
      } else {
        const patch = type === 'cancel' ? { status: 'Cancelled' } : type === 'checkIn' ? { checkInTime: new Date().toISOString() } : { hasReviewed: true, review: { rating: values.rating, comment: values.comment.trim() } }
        setPatches(previous => ({ ...previous, [item.id]: { ...previous[item.id], ...patch } }))
        if (type === 'cancel') setBooked(previous => ({ ...previous, [item.sessionId]: false }))
      }
      setNotice({ book: 'Đặt lịch buổi học thành công.', cancel: 'Đã hủy đăng ký buổi học.', checkIn: 'Điểm danh thành công.', review: 'Đã gửi đánh giá. Cảm ơn bạn đã chia sẻ!' }[type])
      setAction(null)
      sessions.reload()
      mine.reload()
      subscriptions.reload()
      publicClasses.reload()
      allSessions.reload()
      rooms.reload()
    } catch (error) {
      if (mounted.current) setActionError(getMemberClassErrorMessage(error))
    } finally {
      actionLock.current = false
      if (mounted.current) setBusy(false)
    }
  }

  const search = event => {
    event.preventDefault()
    if (draft.from && draft.to && draft.from > draft.to) {
      setFilterError('Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.')
      return
    }
    setFilterError('')
    setFilters({ ...draft })
    setSessionPage(1)
    sessions.reload()
  }

  return <div className="member-view-stack member-classes-view">
    <div className="member-section-heading">
      <div><p className="member-eyebrow"><CalendarDays size={16} /> LỊCH TẬP CỦA BẠN</p><h2>Lớp học & Đặt lịch buổi học</h2><p className="member-classes-muted">Tìm buổi học phù hợp, giữ chỗ trong gói tập và quản lý lịch đã đặt.</p></div>
      <button type="button" disabled={current.loading} onClick={() => {
        current.reload()
        subscriptions.reload()
        publicClasses.reload()
        allSessions.reload()
        rooms.reload()
      }}><RefreshCw size={16} /> Làm mới</button>
    </div>
    {notice && <p className="member-classes-notice" role="status"><Check size={18} />{notice}</p>}
    <div className="member-classes-tabs" role="group" aria-label="Chọn danh sách buổi học">
      <button type="button" aria-pressed={tab === 'browse'} onClick={() => setTab('browse')}><Search size={16} /> Tìm buổi học</button>
      <button type="button" aria-pressed={tab === 'mine'} onClick={() => setTab('mine')}><CalendarDays size={16} /> Lịch đã đặt</button>
    </div>

    {tab === 'browse' && hasActiveSubscription === false && (
      <div className="member-classes-no-sub-banner" role="alert">
        <div className="member-classes-no-sub-banner-content">
          <ShieldAlert size={24} className="member-classes-no-sub-icon" />
          <div>
            <strong>Không thể đặt lịch khi chưa đăng ký gói thành viên.</strong>
            <p>Bạn hiện chưa có gói hội viên đang kích hoạt. Vui lòng đăng ký gói tập để tham gia đặt lịch các buổi học.</p>
          </div>
        </div>
        {onNavigateTab && (
          <button
            type="button"
            className="primary member-classes-no-sub-btn"
            onClick={() => onNavigateTab('subscriptions')}
          >
            <CreditCard size={15} /> Đăng ký gói tập ngay
          </button>
        )}
      </div>
    )}

    {tab === 'browse' && <form className="member-classes-filters" onSubmit={search}>
      <label className="member-classes-search">Tìm lớp học<input value={draft.search} maxLength={200} placeholder="Nhập tên lớp học..." onChange={event => setDraft({ ...draft, search: event.target.value })} /></label>
      <label>Bộ môn<select value={draft.sportId} disabled={sports.loading || Boolean(sports.error)} onChange={event => setDraft({ ...draft, sportId: event.target.value })}><option value="">{sports.loading ? 'Đang tải bộ môn...' : 'Tất cả bộ môn'}</option>{(sports.data || []).map(sport => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select></label>
      <label>Huấn luyện viên<select value={draft.coachId} disabled={coaches.loading || Boolean(coaches.error)} onChange={event => setDraft({ ...draft, coachId: event.target.value })}><option value="">{coaches.loading ? 'Đang tải HLV...' : 'Tất cả HLV'}</option>{(coaches.data || []).map(coach => <option key={coach.id} value={coach.id}>{coach.fullName}</option>)}</select></label>
      <label>Từ ngày<input type="date" value={draft.from} onChange={event => setDraft({ ...draft, from: event.target.value })} /></label>
      <label>Đến ngày<input type="date" min={draft.from || undefined} value={draft.to} onChange={event => setDraft({ ...draft, to: event.target.value })} /></label>
      <label className="member-classes-checkbox"><input type="checkbox" checked={draft.onlyAvailable} onChange={event => setDraft({ ...draft, onlyAvailable: event.target.checked })} /> Chỉ buổi còn chỗ</label>
      <div className="member-classes-filter-actions"><button className="primary" type="submit"><Search size={16} /> Tìm kiếm</button><button type="button" onClick={() => { setDraft(initialFilters); setFilters(initialFilters); setSessionPage(1); setFilterError('') }}>Xóa bộ lọc</button></div>
      {filterError && <p className="member-classes-error" role="alert">{filterError}</p>}
      {sports.error && <p className="member-classes-error" role="alert">Không tải được bộ môn: {sports.error} <button type="button" onClick={sports.reload}>Thử lại</button></p>}
      {coaches.error && <p className="member-classes-error" role="alert">Không tải được HLV: {coaches.error} <button type="button" onClick={coaches.reload}>Thử lại</button></p>}
    </form>}

    {tab === 'mine' && <div className="member-classes-layout-toggle" role="group" aria-label="Cách hiển thị lịch đã đặt">
      <button type="button" aria-pressed={mineLayout === 'timetable'} onClick={() => setMineLayout('timetable')}><CalendarDays size={16} /> Thời khóa biểu</button>
      <button type="button" aria-pressed={mineLayout === 'list'} onClick={() => setMineLayout('list')}>Danh sách</button>
    </div>}

    <section aria-label={tab === 'browse' ? 'Các buổi học' : 'Các lượt đăng ký'} aria-busy={current.loading}>
      {tab === 'mine' && mineLayout === 'timetable' && !mine.loading && !mine.error ? <WeeklyTimetable items={registrations} weekStart={weekStart} onWeekChange={setWeekStart} onSelect={setSelectedRegistrationId} now={now} /> : current.loading || current.error || !current.data?.items.length ? <ResourceState resource={current} emptyText={tab === 'browse' ? 'Không tìm thấy buổi học phù hợp. Hãy thử thay đổi bộ lọc.' : 'Bạn chưa đăng ký buổi học nào.'} /> : <div className="member-classes-grid">
        {tab === 'browse' ? sessions.data.items.map(rawSession => {
          const session = enrichItem(rawSession)
          const unavailable = bookingUnavailableReason(session, booked[session.id] || registeredSessions.has(String(session.id)), now)
          return <article className="member-classes-card" key={session.id}>
            <div className="member-classes-card-top"><span className="member-classes-badge">{session.sportName || 'Buổi học'}</span><small>Buổi #{session.id}</small></div>
            <h3>{session.className || `Buổi học #${session.id}`}</h3>
            <SessionDetails item={session} />
            <div className="member-classes-capacity"><Users size={16} /><span>Sĩ số: {session.enrolledCount ?? session.registeredCount ?? '—'} / {session.capacity ?? '—'}</span><span>{classStatusLabel(session.status)}</span></div>
            <button
              type="button"
              className="primary"
              disabled={busy || Boolean(unavailable)}
              onClick={() => openAction('book', session)}
              title={hasActiveSubscription === false ? 'Không thể đặt lịch khi chưa đăng ký gói thành viên.' : undefined}
            >
              {unavailable || 'Đặt lịch buổi học'}
            </button>
          </article>
        }) : listedRegistrations.map(registration => {
          const allowed = registrationActions(registration, now)
          return <article className="member-classes-card" key={registration.id}>
            <div className="member-classes-card-top"><span className="member-classes-badge">{classStatusLabel(registration.status)}</span><small>Đăng ký #{registration.id}</small></div>
            <h3>{registration.className || `Buổi học #${registration.sessionId}`}</h3>
            <SessionDetails item={registration} />
            <p className="member-classes-muted">{allowed.checkedIn ? 'Đã điểm danh' : registration.attendanceStatus ? classStatusLabel(registration.attendanceStatus) : 'Chưa điểm danh'}{registration.checkInTime && ` · ${formatDate(registration.checkInTime)}`}</p>
            {allowed.reviewed && <div className="member-classes-review"><strong><Star size={16} /> {registration.review?.rating ?? registration.rating ?? 'Đã gửi'}{(registration.review?.rating ?? registration.rating) ? '/5 sao' : ' đánh giá'}</strong>{registration.review?.comment && <p>{registration.review.comment}</p>}</div>}
            <div className="member-classes-card-actions">
              {allowed.checkIn && <button type="button" className="primary" disabled={busy} onClick={() => openAction('checkIn', registration)}><Check size={15} /> Điểm danh</button>}
              {allowed.cancel && <button type="button" disabled={busy} onClick={() => openAction('cancel', registration)}>Hủy đăng ký</button>}
              {allowed.review && <button type="button" className="primary" disabled={busy} onClick={() => openAction('review', registration)}><Star size={15} /> Đánh giá buổi học</button>}
            </div>
          </article>
        })}
      </div>}
      {(tab === 'browse' || mineLayout === 'list') && <Pagination resource={tab === 'browse' ? sessions : { ...mine, data: mine.data && { ...mine.data, pageSize: PAGE_SIZE } }} page={tab === 'browse' ? sessionPage : minePage} onChange={tab === 'browse' ? setSessionPage : setMinePage} />}
    </section>

    {selectedRegistration && <RegistrationDetailsDialog item={selectedRegistration} busy={busy} now={now} onClose={() => setSelectedRegistrationId(null)} onAction={openAction} />}

    {action && (
      <ActionDialog
        action={action}
        busy={busy}
        error={actionError}
        hasActiveSubscription={hasActiveSubscription}
        onNavigateTab={onNavigateTab}
        onClose={() => { if (!busy) setAction(null) }}
        onSubmit={submitAction}
      />
    )}

    {noSubAlertModal && (
      <dialog
        className="member-classes-dialog member-classes-no-sub-dialog"
        open
        aria-labelledby="member-no-sub-title"
        onCancel={() => setNoSubAlertModal(false)}
      >
        <div className="member-no-sub-content">
          <div className="member-no-sub-icon">
            <ShieldAlert size={36} />
          </div>
          <h2 id="member-no-sub-title">Chưa đăng ký gói thành viên</h2>
          <p className="member-no-sub-alert-text">
            Không thể đặt lịch khi chưa đăng ký gói thành viên.
          </p>
          <p className="member-no-sub-desc">
            {selectedSessionForAlert?.className
              ? `Để đặt lịch giữ chỗ cho buổi học "${selectedSessionForAlert.className}", bạn cần sở hữu gói hội viên đang có hiệu lực tại Olympus Sports Center.`
              : 'Để tham gia các buổi học, bạn cần sở hữu gói hội viên đang có hiệu lực tại Olympus Sports Center.'}
          </p>
          <div className="member-no-sub-actions">
            {onNavigateTab && (
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setNoSubAlertModal(false)
                  onNavigateTab('subscriptions')
                }}
              >
                <CreditCard size={16} /> Đăng ký gói tập ngay
              </button>
            )}
            <button
              type="button"
              onClick={() => setNoSubAlertModal(false)}
            >
              Đóng
            </button>
          </div>
        </div>
      </dialog>
    )}
  </div>
}
