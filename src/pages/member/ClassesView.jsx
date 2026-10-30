import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CalendarDays, Check, ChevronLeft, ChevronRight, CreditCard, List, LoaderCircle, RefreshCw, Search, ShieldAlert, Star, X } from 'lucide-react'
import { getSports, getCoaches } from '../../services/classCatalogService'
import { getAllAvailableSessions, getAllMemberClasses, getAllMyRegistrations, bookClassSessions, cancelRegistration, checkInRegistration, reviewRegistration, getMemberClassErrorMessage } from '../../services/memberClassService'
import { getMySubscriptions } from '../../services/memberSubscriptionService'
import { getRooms } from '../../services/roomService'
import { bookingUnavailableReason, checkInUnavailableReason, classStatusLabel, getRoomForClass, hasActiveMembership, isCancelledRegistration, partitionMemberRegistrations, registeredSessionIds, registrationActions, reviewUnavailableReason } from '../../utils/memberClasses'
import { timetableWeekStart } from '../../utils/memberTimetable'
import MemberWeeklySchedule from './MemberWeeklySchedule'
import CancelledMemberRegistrations from './CancelledMemberRegistrations'
import '../../style/member/ClassesView.css'
import useResource from '../../hooks/useClassResource'
import SessionDetails, { formatClassDateTime as formatDate } from './MemberSessionDetails'
import MemberClassBrowser from './MemberClassBrowser'
import AttendanceStatus from '../../components/AttendanceStatus'

const PAGE_SIZE = 12

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
      <span className="member-classes-badge">{isCancelledRegistration(item) ? 'Đã hủy' : classStatusLabel(item.status)}</span>
      <SessionDetails item={item} />
      {isCancelledRegistration(item) && <p className="member-classes-error">Lý do hủy: {item.cancellationReason?.trim() || 'Chưa cập nhật'}</p>}
      <AttendanceStatus item={item} />
      {item.checkInTime && <p className="member-classes-muted">Giờ điểm danh: {formatDate(item.checkInTime)}</p>}
      {allowed.reviewed && <div className="member-classes-review"><strong><Star size={16} /> {item.review?.rating ?? item.rating ?? 'Đã gửi'}{(item.review?.rating ?? item.rating) ? '/5 sao' : ' đánh giá'}</strong>{item.review?.comment && <p>{item.review.comment}</p>}</div>}
      <div className="member-classes-card-actions">
        {(allowed.checkIn || allowed.checkInReason) && <button type="button" className="primary" disabled={busy || !allowed.checkIn} onClick={() => onAction('checkIn', item)}><Check size={15} /> Điểm danh</button>}
        {allowed.cancel && <button type="button" disabled={busy} onClick={() => onAction('cancel', item)}>Hủy đăng ký</button>}
        {allowed.review && <button type="button" className="primary" disabled={busy} onClick={() => onAction('review', item)}><Star size={15} /> Đánh giá buổi học</button>}
      </div>
      {allowed.checkInReason && <p className="member-classes-checkin-notice" role="status"><AlertCircle size={17} />{allowed.checkInReason}</p>}
      {allowed.reviewReason && <p className="member-classes-checkin-notice" role="status"><AlertCircle size={17} />{allowed.reviewReason}</p>}
    </div>
  </dialog>
}

function ActionDialog({ action, busy, error, onClose, onSubmit, hasActiveSubscription, onNavigateTab, bulkResult, bulkProgress, now, registrations }) {
  const dialogRef = useRef(null)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [reason, setReason] = useState('')
  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    return () => dialog.close()
  }, [])
  const titles = { book: 'Xác nhận đặt lịch', bookClass: 'Đăng ký các buổi đã chọn', cancel: 'Hủy đăng ký buổi học', checkIn: 'Điểm danh buổi học', review: 'Đánh giá buổi học' }
  const isBooking = action.type === 'book' || action.type === 'bookClass'
  const pendingSessions = action.type === 'bookClass'
    ? action.item.sessions.filter(item => !bulkResult?.remaining.length || bulkResult.remaining.includes(String(item.id)))
    : action.type === 'book' ? [action.item] : []
  const registered = registeredSessionIds(registrations)
  const bookingReason = pendingSessions.map(item => bookingUnavailableReason(item, registered.has(String(item.id)), now, registrations)).find(Boolean) || ''
  const isBookBlocked = isBooking && (hasActiveSubscription !== true || Boolean(bookingReason))
  const checkInReason = action.type === 'checkIn' ? checkInUnavailableReason(action.item, now) : ''
  const reviewReason = action.type === 'review' ? reviewUnavailableReason(action.item, now) : ''
  return <dialog className="member-classes-dialog" ref={dialogRef} aria-labelledby="member-class-dialog-title" onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <form onSubmit={event => { event.preventDefault(); onSubmit({ rating, comment, reason }) }}>
      <header><h2 id="member-class-dialog-title">{titles[action.type]}</h2><button type="button" aria-label="Đóng" disabled={busy} onClick={onClose}><X size={20} /></button></header>
      <h3>{action.item.className || `Buổi học #${action.item.sessionId || action.item.id}`}</h3>
      {action.type === 'bookClass' ? <>
        <p>Xác nhận đăng ký {bulkResult?.remaining.length || action.item.sessions.length} buổi bạn đã chọn bên dưới. Mỗi buổi được kiểm tra lại trước khi đăng ký.</p>
        <ul className="member-class-booking-preview">{action.item.sessions.filter(item => !bulkResult?.remaining.length || bulkResult.remaining.includes(String(item.id))).map(item => <li key={item.id}><strong>Buổi #{item.id}</strong><span>{formatDate(item.startsAt)} – {formatDate(item.endsAt)}</span></li>)}</ul>
        {bulkResult && <p className="member-classes-notice" role="status">Đã đăng ký {bulkResult.registered.length} buổi; {bulkResult.existing.length} buổi đã có sẵn; bỏ qua {bulkResult.skipped.length} buổi.</p>}
        {bulkResult?.skipped.length > 0 && <ul>{bulkResult.skipped.map(item => <li key={item.id}>Buổi #{item.id}: {item.reason}</li>)}</ul>}
        {bulkProgress && <p role="status">Đang xử lý {bulkProgress.completed}/{bulkProgress.total} buổi...</p>}
      </> : <SessionDetails item={action.item} />}
      {isBooking && <>
        {bookingReason && <p className="member-classes-checkin-notice" role="alert"><AlertCircle size={17} />{bookingReason}</p>}
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
        ) : action.type === 'book' && (
          <p>Đăng ký giữ chỗ tham gia buổi học bằng gói tập của bạn. Gói tập cần còn hiệu lực và đáp ứng điều kiện của buổi học.</p>
        )}
      </>}
      {action.type === 'checkIn' && <><p>Chỉ điểm danh từ 30 phút trước giờ học đến trước khi buổi học kết thúc. Xác nhận bạn đã có mặt tại phòng tập để tham gia.</p>{checkInReason && <p className="member-classes-checkin-notice" role="alert"><AlertCircle size={17} />{checkInReason}</p>}</>}
      {action.type === 'cancel' && <>
        <p>Bạn đang hủy duy nhất buổi học #{action.item.sessionId}, đăng ký #{action.item.id}, vào {formatDate(action.item.startsAt)}.</p>
        <p>Yêu cầu hủy chỉ được chấp nhận trong thời hạn theo chính sách của buổi học.</p>
        <label htmlFor="member-class-cancel-reason">Lý do hủy (không bắt buộc)</label>
        <textarea id="member-class-cancel-reason" rows={3} maxLength={500} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} />
      </>}
      {action.type === 'review' && <>
        {reviewReason && <p className="member-classes-checkin-notice" role="alert"><AlertCircle size={17} />{reviewReason}</p>}
        <fieldset className="member-classes-stars" disabled={busy || Boolean(reviewReason)}>
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
      {error && error !== reviewReason && <p className="member-classes-error" role="alert">{error}</p>}
      <footer><button type="button" disabled={busy} onClick={onClose}>Đóng</button><button type="submit" className="primary" disabled={busy || isBookBlocked || Boolean(checkInReason) || Boolean(reviewReason) || (action.type === 'review' && !rating)}>{busy ? <><LoaderCircle className="member-spin" size={16} /> Đang xử lý...</> : action.type === 'review' ? 'Gửi đánh giá' : action.type === 'bookClass' && bulkResult?.remaining.length ? `Thử lại ${bulkResult.remaining.length} buổi còn lại` : 'Xác nhận'}</button></footer>
    </form>
  </dialog>
}

export function ClassesView({ showNotice, onNavigateTab, initialTab = 'mine', notificationSessionId }) {
  const [tab, setTab] = useState(initialTab)
  const [browseRevision, setBrowseRevision] = useState(0)
  const [bulkResult, setBulkResult] = useState(null)
  const [bulkProgress, setBulkProgress] = useState(null)
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
  const actionLock = useRef(false)
  const openedNotificationSession = useRef(null)
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
  const publicClasses = useResource(getAllMemberClasses)
  const allSessions = useResource(getAllAvailableSessions)
  const mine = useResource(getAllMyRegistrations, {}, 0, { refreshInterval: 30000 })
  const subscriptions = useResource(getMySubscriptions)

  useEffect(() => {
    if (!mine.data) return
    // Once a fresh response includes attendance, server results take precedence
    // over the immediate check-in patch (the coach may have corrected it).
    setPatches(previous => {
      let next = previous
      for (const item of mine.data.items) {
        const patch = previous[item.id]
        if (!patch || !Object.hasOwn(item, 'attendanceStatus')
          || (!Object.hasOwn(patch, 'attendanceStatus') && !Object.hasOwn(patch, 'checkInTime'))) continue
        if (next === previous) next = { ...previous }
        const remaining = { ...patch }
        delete remaining.attendanceStatus
        delete remaining.checkInTime
        if (Object.keys(remaining).length) next[item.id] = remaining
        else delete next[item.id]
      }
      return next
    })
  }, [mine.data])

  useEffect(() => {
    if (!notificationSessionId || openedNotificationSession.current === String(notificationSessionId)) return
    const registration = mine.data?.items.find(item => String(item.sessionId) === String(notificationSessionId)
      && !['cancelled', 'canceled'].includes(String(item.status).toLowerCase()))
    if (!registration) return
    openedNotificationSession.current = String(notificationSessionId)
    setSelectedRegistrationId(registration.id)
    if (Number.isFinite(Date.parse(registration.startsAt))) setWeekStart(timetableWeekStart(registration.startsAt))
  }, [notificationSessionId, mine.data])

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
    return map
  }, [allSessions.data])

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

  const hasActiveSubscription = useMemo(() => subscriptions.data ? hasActiveMembership(subscriptions.data, now) : null, [subscriptions.data, now])

  const registrations = (mine.data?.items || []).map(item => enrichItem({ ...item, ...patches[item.id] }))
  const { active: activeRegistrations, cancelled: cancelledRegistrations } = partitionMemberRegistrations(registrations)
  const listedRegistrations = activeRegistrations.slice((minePage - 1) * PAGE_SIZE, minePage * PAGE_SIZE)
  const selectedRegistration = registrations.find(item => item.id === selectedRegistrationId)
  const registeredSessions = registeredSessionIds(registrations)
  for (const [sessionId, active] of Object.entries(booked)) { if (active) registeredSessions.add(sessionId) }
  const current = tab === 'browse' ? publicClasses : mine

  // If a mutation removes the final item from a page, return to the last available page.
  useEffect(() => {
    if (mine.data) setMinePage(page => Math.min(page, Math.max(1, Math.ceil(activeRegistrations.length / PAGE_SIZE))))
  }, [mine.data, activeRegistrations.length])

  const openAction = (type, rawItem) => {
    if (actionLock.current) return
    const item = type === 'bookClass' ? rawItem : enrichItem(rawItem)
    setSelectedRegistrationId(null)
    setActionError('')
    setNotice('')
    setBulkResult(null)
    setBulkProgress(null)
    setAction({ type, item })
  }

  const refreshBookingData = () => {
    setBrowseRevision(value => value + 1)
    mine.reload()
    subscriptions.reload()
    publicClasses.reload()
    allSessions.reload()
    rooms.reload()
  }

  const submitAction = async values => {
    if (actionLock.current || !action) return
    actionLock.current = true
    setBusy(true)
    setActionError('')
    const { type, item } = action
    let attendanceResult, cancellationResult
    try {
      if (type === 'bookClass') {
        if (hasActiveSubscription !== true) throw new Error('Bạn cần có gói hội viên đang còn hiệu lực để đăng ký buổi học.')
        const result = await bookClassSessions({ classId: item.id, sessionIds: bulkResult?.remaining.length ? bulkResult.remaining : item.sessions.map(session => session.id) }, progress => { if (mounted.current) setBulkProgress(progress) })
        if (!mounted.current) return
        const merged = {
          ...result,
          registered: [...new Set([...(bulkResult?.registered || []), ...result.registered])],
          existing: [...new Set([...(bulkResult?.existing || []), ...result.existing])],
          skipped: [...new Map([...(bulkResult?.skipped || []), ...result.skipped].map(session => [session.id, session])).values()],
        }
        setBulkResult(merged)
        setBooked(previous => ({ ...previous, ...Object.fromEntries([...result.registered, ...result.existing].map(id => [id, true])) }))
        setNotice(`Đã đăng ký ${merged.registered.length} buổi của lớp ${item.className}; ${merged.existing.length} buổi đã có sẵn; bỏ qua ${merged.skipped.length} buổi.${result.remaining.length ? ` Còn ${result.remaining.length} buổi cần xử lý.` : ''}`)
        if (result.remaining.length) setActionError(result.error)
        else setAction(null)
        const first = item.sessions.find(session => [...merged.registered, ...merged.existing].includes(String(session.id)))
        if (first) setWeekStart(timetableWeekStart(first.startsAt))
        refreshBookingData()
        return
      }
      if (type === 'book') {
        if (hasActiveSubscription !== true) {
          throw new Error('Không thể đặt lịch khi chưa đăng ký gói thành viên.')
        }
        const reason = bookingUnavailableReason(item, booked[item.id] || registeredSessions.has(String(item.id)), Date.now(), registrations)
        if (reason) throw new Error(reason)
        const result = await bookClassSessions({ classId: item.classId, sessionIds: [item.id] })
        if (result.remaining.length || result.skipped.length) throw new Error(result.error || result.skipped[0].reason)
      } else {
        if (!registrationActions(item)[type]) throw new Error(type === 'review' ? reviewUnavailableReason(item) : 'Thao tác không còn khả dụng. Vui lòng đóng cửa sổ và làm mới lịch đã đặt.')
        if (type === 'cancel') cancellationResult = await cancelRegistration(item.id, values.reason, item.sessionId)
        if (type === 'checkIn') {
          const reason = checkInUnavailableReason(item, Date.now())
          if (reason) throw new Error(reason)
          attendanceResult = await checkInRegistration(item.id)
        }
        if (type === 'review') await reviewRegistration(item.id, values)
      }
      if (!mounted.current) return
      if (type === 'book') {
        setBooked(previous => ({ ...previous, [item.id]: true }))
        setMinePage(1)
        setWeekStart(timetableWeekStart(item.startsAt))
      } else {
        const patch = type === 'cancel' ? { status: 'Cancelled', cancellationReason: cancellationResult.cancellationReason || values.reason.trim() || 'Hội viên tự hủy lịch' } : type === 'checkIn' ? { attendanceStatus: attendanceResult?.status || 'CheckedIn', checkInTime: attendanceResult?.checkInTime || null } : { hasReviewed: true, review: { rating: values.rating, comment: values.comment.trim() } }
        setPatches(previous => ({ ...previous, [item.id]: { ...previous[item.id], ...patch } }))
        if (type === 'cancel') setBooked(previous => ({ ...previous, [item.sessionId]: false }))
      }
      setNotice({ book: 'Đặt lịch buổi học thành công.', cancel: 'Đã hủy đăng ký buổi học.', checkIn: 'Điểm danh thành công.', review: 'Đã gửi đánh giá. Cảm ơn bạn đã chia sẻ!' }[type])
      setAction(null)
      refreshBookingData()
    } catch (error) {
      if (mounted.current) setActionError(getMemberClassErrorMessage(error))
      if (type === 'review' || type === 'cancel') mine.reload()
    } finally {
      actionLock.current = false
      if (mounted.current) { setBusy(false); setBulkProgress(null) }
    }
  }

  return <div className="member-classes-view">
    <header className="member-classes-page-heading">
      <div><p className="member-eyebrow"><CalendarDays size={16} /> LỊCH TẬP CỦA BẠN</p><h2>Lớp học & Đặt lịch</h2><p className="member-classes-muted">Theo dõi lịch học, quản lý các buổi đã đặt và tìm lớp phù hợp với bạn.</p></div>
      <button type="button" disabled={current.loading || busy} onClick={refreshBookingData}><RefreshCw size={16} /> Làm mới</button>
    </header>
    {notice && <p className="member-classes-notice" role="status"><Check size={18} />{notice}</p>}
    {!action && bulkResult?.skipped.length > 0 && <details className="member-class-booking-skipped"><summary>Các buổi được bỏ qua ({bulkResult.skipped.length})</summary><ul>{bulkResult.skipped.map(item => <li key={item.id}>Buổi #{item.id}: {item.reason}</li>)}</ul></details>}
    <div className="member-classes-navigation">
      <div className="member-classes-tabs" role="group" aria-label="Chọn danh sách buổi học">
        <button type="button" aria-pressed={tab === 'mine'} onClick={() => setTab('mine')}><CalendarDays size={17} /> Thời khóa biểu</button>
        <button type="button" aria-pressed={tab === 'browse'} onClick={() => setTab('browse')}><Search size={16} /> Tìm lớp học</button>
      </div>
      {tab === 'mine' && <div className="member-classes-layout-toggle" role="group" aria-label="Cách hiển thị lịch đã đặt">
        <button type="button" aria-pressed={mineLayout === 'timetable'} onClick={() => setMineLayout('timetable')}><CalendarDays size={15} /> Theo tuần</button>
        <button type="button" aria-pressed={mineLayout === 'list'} onClick={() => setMineLayout('list')}><List size={15} /> Danh sách</button>
      </div>}
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

    {tab === 'browse' && <MemberClassBrowser sports={sports} coaches={coaches} rooms={roomsList} registered={registeredSessions} registrations={registrations} busy={busy} now={now} refreshKey={browseRevision}
      bookingState={{ loading: mine.loading || subscriptions.loading, error: mine.error || subscriptions.error, reload: () => { mine.reload(); subscriptions.reload() } }}
      onBookClass={course => openAction('bookClass', course)} />}

    {tab === 'mine' && <section className="member-my-registrations" aria-label="Các lượt đăng ký" aria-busy={mine.loading}>
      {mineLayout === 'list' && <header className="member-schedule-list-heading"><h3>Lịch đã đặt</h3><p>Xem thông tin, điểm danh và quản lý từng buổi học bạn đã đăng ký.</p></header>}
      {mine.backgroundError && <p className="member-classes-checkin-notice" role="status">Chưa thể đồng bộ điểm danh mới: {mine.backgroundError} Dữ liệu đang hiển thị là lần tải gần nhất.</p>}
      {mineLayout === 'timetable' && !mine.loading && !mine.error ? <MemberWeeklySchedule items={activeRegistrations} weekStart={weekStart} onWeekChange={setWeekStart} onSelect={setSelectedRegistrationId} now={now} onBrowse={() => setTab('browse')} /> : mine.loading || mine.error || !activeRegistrations.length ? <ResourceState resource={mine} emptyText={'Bạn chưa có buổi học nào trong lịch đã đặt.'} /> : <div className="member-classes-grid">
        {listedRegistrations.map(registration => {
          const allowed = registrationActions(registration, now)
          return <article className="member-classes-card" key={registration.id}>
            <div className="member-classes-card-top"><span className="member-classes-badge">{classStatusLabel(registration.status)}</span><small>Đăng ký #{registration.id}</small></div>
            <h3>{registration.className || `Buổi học #${registration.sessionId}`}</h3>
            <SessionDetails item={registration} />
            <AttendanceStatus item={registration} />
            {registration.checkInTime && <p className="member-classes-muted">Giờ điểm danh: {formatDate(registration.checkInTime)}</p>}
            {allowed.reviewed && <div className="member-classes-review"><strong><Star size={16} /> {registration.review?.rating ?? registration.rating ?? 'Đã gửi'}{(registration.review?.rating ?? registration.rating) ? '/5 sao' : ' đánh giá'}</strong>{registration.review?.comment && <p>{registration.review.comment}</p>}</div>}
            <div className="member-classes-card-actions">
              {(allowed.checkIn || allowed.checkInReason) && <button type="button" className="primary" disabled={busy || !allowed.checkIn} onClick={() => openAction('checkIn', registration)}><Check size={15} /> Điểm danh</button>}
              {allowed.cancel && <button type="button" disabled={busy} onClick={() => openAction('cancel', registration)}>Hủy đăng ký</button>}
              {allowed.review && <button type="button" className="primary" disabled={busy} onClick={() => openAction('review', registration)}><Star size={15} /> Đánh giá buổi học</button>}
            </div>
            {allowed.checkInReason && <p className="member-classes-checkin-notice" role="status"><AlertCircle size={17} />{allowed.checkInReason}</p>}
            {allowed.reviewReason && <p className="member-classes-checkin-notice" role="status"><AlertCircle size={17} />{allowed.reviewReason}</p>}
          </article>
        })}
      </div>}
      {mineLayout === 'list' && <Pagination resource={{ ...mine, data: mine.data && { total: activeRegistrations.length, pageSize: PAGE_SIZE } }} page={minePage} onChange={setMinePage} />}
      {!mine.loading && !mine.error && <CancelledMemberRegistrations items={cancelledRegistrations} onSelect={setSelectedRegistrationId} />}
    </section>}

    {selectedRegistration && <RegistrationDetailsDialog item={selectedRegistration} busy={busy} now={now} onClose={() => setSelectedRegistrationId(null)} onAction={openAction} />}

    {action && (
      <ActionDialog
        action={action.type === 'review' ? { ...action, item: registrations.find(item => String(item.id) === String(action.item.id)) || action.item } : action}
        busy={busy}
        now={now}
        error={actionError}
        bulkResult={bulkResult}
        bulkProgress={bulkProgress}
        hasActiveSubscription={hasActiveSubscription}
        registrations={registrations}
        onNavigateTab={onNavigateTab}
        onClose={() => { if (!busy) setAction(null) }}
        onSubmit={submitAction}
      />
    )}

  </div>
}
