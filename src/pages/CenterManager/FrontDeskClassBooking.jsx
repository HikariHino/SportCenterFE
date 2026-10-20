import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AlertCircle, BookOpen, CalendarDays, CheckCircle2, ChevronRight, Clock3, MapPin, RefreshCw, Search, UserRound, Users } from 'lucide-react'
import { getFrontDeskBookingClasses, getFrontDeskBookingSessions, getFrontDeskMemberBooking, registerFrontDeskClassSessions } from '../../services/frontDeskBookingService'
import { getClassErrorMessage } from '../../services/sportClassService'
import { frontDeskSessionEligibility, isExistingSessionRegistration, memberBookingReason, selectableFrontDeskSessions } from '../../utils/frontDeskBooking'
import { getRoomForClass } from '../../utils/memberClasses'
import FrontDeskMemberPicker from './FrontDeskMemberPicker'
import '../../style/CenterManager/FrontDeskClassBooking.css'

const formatDate = value => value ? new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Chưa cập nhật'
const formatTime = value => value ? new Date(value).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '—'
const sessionLabel = item => `${formatDate(item.startsAt)} · ${formatTime(item.startsAt)} – ${formatTime(item.endsAt)}`
const emptyMember = { key: '', loading: false, data: null, error: '' }

export default function FrontDeskClassBooking({ members, membersLoading = false, reloadKey = 0, onBusyChange, onRegistered }) {
  const id = useId()
  const actionLock = useRef(false)
  const [revision, setRevision] = useState(0)
  const [catalog, setCatalog] = useState({ items: [], loading: true, error: '' })
  const [memberId, setMemberId] = useState('')
  const [memberState, setMemberState] = useState(emptyMember)
  const [classId, setClassId] = useState('')
  const [sessionsState, setSessionsState] = useState({ key: '', items: [], loading: false, error: '' })
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const selectedClass = catalog.items.find(item => String(item.id) === classId)
  const sessions = sessionsState.key === classId ? sessionsState.items : []
  const context = memberState.key === memberId ? memberState.data : null
  const registrations = context?.registrations || []
  const memberLoading = Boolean(memberId) && (memberState.key !== memberId || memberState.loading)
  const sessionsLoading = Boolean(classId) && (sessionsState.key !== classId || sessionsState.loading)
  const memberReason = context ? memberBookingReason(context) : ''
  const canChoose = Boolean(context && !memberReason && !memberLoading && !sessionsLoading && !busy)
  const selectedSet = new Set(selectedIds)
  const room = selectedClass ? getRoomForClass(selectedClass) : null
  const choices = useMemo(() => selectableFrontDeskSessions(sessions, registrations), [sessions, registrations])
  const rows = sessions.map(session => {
    const otherSelected = sessions.filter(item => item.id !== session.id && selectedSet.has(String(item.id)))
      .map(item => ({ ...item, sessionId: item.id, status: 'Registered', sessionStatus: 'Scheduled' }))
    return { session, ...frontDeskSessionEligibility(session, [...registrations, ...otherSelected]) }
  })
  const selectedInvalid = rows.some(row => selectedSet.has(String(row.session.id)) && row.reason)
  const visibleRows = context && !memberReason && !memberLoading ? rows.filter(row => row.code === 'available') : []
  const allChecked = choices.length > 0 && choices.every(item => selectedSet.has(String(item.id)))
  const filteredClasses = catalog.items.filter(item => `${item.className} ${item.sportName || ''} ${item.coachName || ''}`.toLocaleLowerCase('vi-VN').includes(query.trim().toLocaleLowerCase('vi-VN')))

  useEffect(() => {
    const controller = new AbortController()
    setCatalog(previous => ({ ...previous, loading: true, error: '' }))
    getFrontDeskBookingClasses(controller.signal).then(items => {
      if (!controller.signal.aborted) setCatalog({ items: items.filter(item => item.isActive !== false), loading: false, error: '' })
    }).catch(requestError => {
      if (!controller.signal.aborted) setCatalog({ items: [], loading: false, error: getClassErrorMessage(requestError, 'Không thể tải lớp học.') })
    })
    return () => controller.abort()
  }, [revision, reloadKey])

  useEffect(() => {
    if (!memberId) { setMemberState(emptyMember); return }
    const controller = new AbortController()
    setMemberState({ key: memberId, loading: true, data: null, error: '' })
    getFrontDeskMemberBooking(memberId, controller.signal).then(data => {
      if (!controller.signal.aborted) setMemberState({ key: memberId, loading: false, data, error: '' })
    }).catch(requestError => {
      if (!controller.signal.aborted) setMemberState({ key: memberId, loading: false, data: null, error: getClassErrorMessage(requestError, 'Không thể kiểm tra lịch của học viên.') })
    })
    return () => controller.abort()
  }, [memberId, revision, reloadKey])

  useEffect(() => {
    if (!classId) return
    const controller = new AbortController()
    setSessionsState({ key: classId, items: [], loading: true, error: '' })
    getFrontDeskBookingSessions(classId, controller.signal).then(items => {
      if (!controller.signal.aborted) setSessionsState({ key: classId, items: [...items].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)), loading: false, error: '' })
    }).catch(requestError => {
      if (!controller.signal.aborted) setSessionsState({ key: classId, items: [], loading: false, error: getClassErrorMessage(requestError, 'Không thể tải các buổi học.') })
    })
    return () => controller.abort()
  }, [classId, revision, reloadKey])

  useEffect(() => {
    if (!context || sessionsState.key !== classId || sessionsState.loading) return
    setSelectedIds(previous => previous.filter(value => sessionsState.items.some(item => String(item.id) === value
      && !frontDeskSessionEligibility(item, context.registrations).reason)))
  }, [context, sessionsState, classId])

  const clearFeedback = () => { setError(''); setResult(null) }
  const chooseClass = value => { if (busy) return; setClassId(value); setSelectedIds([]); clearFeedback() }
  const chooseMember = value => { if (busy) return; setMemberId(value); setSelectedIds([]); clearFeedback() }
  const toggleSession = row => {
    if (!canChoose || row.reason) return
    const value = String(row.session.id)
    setSelectedIds(previous => previous.includes(value) ? previous.filter(item => item !== value) : [...previous, value])
    clearFeedback()
  }
  const submit = async event => {
    event.preventDefault()
    if (actionLock.current || !canChoose || !selectedClass || !selectedIds.length || selectedInvalid) return
    actionLock.current = true
    setBusy(true)
    onBusyChange?.(true)
    setError('')
    setResult(null)
    try {
      const response = await registerFrontDeskClassSessions({ memberId, classId, sessionIds: selectedIds }, setProgress)
      setResult(response)
      setSelectedIds(response.remaining)
      setRevision(value => value + 1)
      if (response.registered.length || response.existing.length) await onRegistered?.(response)
    } catch (requestError) {
      setError(getClassErrorMessage(requestError, 'Không thể đăng ký buổi học.'))
      setRevision(value => value + 1)
    } finally {
      actionLock.current = false
      setBusy(false)
      setProgress(null)
      onBusyChange?.(false)
    }
  }

  return <section className="fdesk-card fdesk-booking" aria-labelledby={`${id}-title`} aria-busy={busy}>
    <header className="fdesk-card-header"><div><h3 id={`${id}-title`}><BookOpen size={20} /> Đăng ký lớp học tại quầy</h3><p>Chọn học viên và lớp học, sau đó chọn các buổi muốn đăng ký. Lịch học hiển thị theo giờ Việt Nam.</p></div><button type="button" className="fdesk-btn fdesk-btn-secondary" disabled={busy} onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} /> Làm mới lịch</button></header>
    <div className="fdesk-booking-body">
      <div className="fdesk-booking-controls">
        <FrontDeskMemberPicker id={`${id}-member`} members={members} loading={membersLoading} disabled={busy} value={memberId} onChange={chooseMember} />
        <label className="fdesk-input-group" htmlFor={`${id}-search`}><span>Tìm lớp học</span><span className="fdesk-booking-search"><Search size={16} /><input id={`${id}-search`} type="search" placeholder="Tên lớp, bộ môn hoặc huấn luyện viên" value={query} disabled={busy} onChange={event => setQuery(event.target.value)} /></span></label>
      </div>
      {memberLoading && <p className="fdesk-booking-state" role="status">Đang kiểm tra gói tập và lịch đã đăng ký của học viên...</p>}
      {memberState.key === memberId && memberState.error && <div className="fdesk-alert-danger" role="alert"><AlertCircle size={16} />{memberState.error}<button type="button" className="fdesk-btn fdesk-btn-secondary" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div>}
      {memberReason && <p className="fdesk-booking-warning" role="alert"><AlertCircle size={16} />{memberReason}</p>}
      {!membersLoading && !members.length && <p className="fdesk-booking-state" role="status">Chưa có học viên để đăng ký. Vui lòng thêm học viên hoặc làm mới danh sách.</p>}
      <div className="fdesk-booking-layout">
        <div className="fdesk-booking-catalog"><div className="fdesk-booking-section-heading"><h4>Chọn lớp học</h4><span>{filteredClasses.length} lớp</span></div>
          {catalog.loading ? <p className="fdesk-booking-state" role="status">Đang tải lớp học...</p> : catalog.error ? <div className="fdesk-alert-danger" role="alert"><p>{catalog.error}</p><button type="button" className="fdesk-btn fdesk-btn-secondary" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div> : !filteredClasses.length ? <p className="fdesk-booking-state">Không có lớp học phù hợp.</p> : <div className="fdesk-booking-class-list">{filteredClasses.map(item => {
            const booked = new Set(registrations.filter(reg => String(reg.classId) === String(item.id) && reg.sessionId != null && isExistingSessionRegistration(reg, reg.sessionId)).map(reg => String(reg.sessionId))).size
            const classRoom = getRoomForClass(item)
            return <button type="button" key={item.id} className={`fdesk-booking-class${classId === String(item.id) ? ' is-selected' : ''}`} aria-pressed={classId === String(item.id)} disabled={busy} onClick={() => chooseClass(String(item.id))}>
              <span className="fdesk-booking-class-top"><span className="fdesk-booking-sport">{item.sportName || 'Lớp thể thao'}</span><ChevronRight size={18} /></span>
              <strong>{item.className}</strong><span><UserRound size={14} />{item.coachName || 'Chưa phân công HLV'}</span>
              <span><CalendarDays size={14} />{formatDate(item.startDate)} – {formatDate(item.endDate)}</span>
              <span><MapPin size={14} />{classRoom?.name || item.roomName || 'Chưa cập nhật phòng'}</span>
              <span className="fdesk-booking-class-bottom"><span><Users size={14} />Tối đa {item.maxCapacity ?? '—'} học viên</span><b>{Number(item.price) > 0 ? `${Number(item.price).toLocaleString('vi-VN')} ₫` : 'Miễn phí'}</b></span>
              {booked > 0 && <span className="fdesk-booking-registered"><CheckCircle2 size={14} />Học viên đã đăng ký {booked} buổi</span>}
            </button>
          })}</div>}
        </div>
        <div className="fdesk-booking-sessions">
          {!selectedClass ? <div className="fdesk-booking-placeholder"><CalendarDays size={34} /><strong>Chọn lớp để xem các buổi học</strong><p>Bạn có thể chọn từng buổi hoặc tất cả các buổi còn nhận đăng ký.</p></div> : <form onSubmit={submit}>
            <div className="fdesk-booking-session-heading"><span className="fdesk-booking-sport">CÁC BUỔI HỌC</span><h4>{selectedClass.className}</h4><p><MapPin size={14} />{room?.name || selectedClass.roomName || 'Chưa cập nhật phòng'}<span>·</span>{visibleRows.length} buổi có thể đăng ký</p></div>
            {!memberId && <p className="fdesk-booking-warning">Chọn học viên để kiểm tra lịch trùng và đăng ký.</p>}
            {sessionsLoading ? <p className="fdesk-booking-state" role="status">Đang tải các buổi học của lớp...</p> : sessionsState.error ? <div className="fdesk-alert-danger" role="alert"><p>{sessionsState.error}</p><button type="button" className="fdesk-btn fdesk-btn-secondary" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div> : !sessions.length ? <p className="fdesk-booking-state">Lớp chưa có buổi học được lên lịch.</p> : visibleRows.length > 0 ? <>
              <div className="fdesk-booking-select-all"><label><input type="checkbox" checked={allChecked} disabled={!canChoose || !choices.length} onChange={event => { setSelectedIds(event.target.checked ? choices.map(item => String(item.id)) : []); clearFeedback() }} />Chọn tất cả buổi có thể đăng ký</label><span>{selectedIds.length} đã chọn</span></div>
              <div className="fdesk-booking-session-list">{visibleRows.map(row => <label key={row.session.id} className={`fdesk-booking-session is-${row.code}${selectedSet.has(String(row.session.id)) ? ' is-selected' : ''}`}>
                <input type="checkbox" checked={selectedSet.has(String(row.session.id))} disabled={!canChoose || Boolean(row.reason)} onChange={() => toggleSession(row)} aria-describedby={row.reason ? `${id}-reason-${row.session.id}` : undefined} />
                <span className="fdesk-booking-session-content"><strong>{formatDate(row.session.startsAt)}</strong><span><Clock3 size={14} />{formatTime(row.session.startsAt)} – {formatTime(row.session.endsAt)}{formatDate(row.session.startsAt) !== formatDate(row.session.endsAt) ? ` (${formatDate(row.session.endsAt)})` : ''}</span><small><Users size={13} />{row.session.currentEnrollment ?? '—'}/{row.session.capacity ?? '—'} học viên{row.session.coachName ? ` · ${row.session.coachName}` : ''}</small>{row.reason && <span id={`${id}-reason-${row.session.id}`} className="fdesk-booking-session-reason">{row.code === 'registered' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}{row.reason}</span>}</span>
                <span className="fdesk-booking-session-tag">{row.code === 'registered' ? 'Đã đăng ký' : row.code === 'conflict' ? 'Trùng lịch' : row.reason ? 'Không thể chọn' : selectedSet.has(String(row.session.id)) ? 'Đã chọn' : 'Còn chỗ'}</span>
              </label>)}</div>
            </> : context && !memberLoading && !memberReason ? <p className="fdesk-booking-state">Học viên không còn buổi học phù hợp để đăng ký trong lớp này.</p> : null}
            <footer className="fdesk-booking-footer"><p>Chỉ hiển thị các buổi còn chỗ, chưa diễn ra và không trùng lịch của học viên.</p><button type="submit" className="fdesk-btn fdesk-btn-primary" disabled={!canChoose || catalog.loading || Boolean(catalog.error) || !selectedIds.length || selectedInvalid}>{busy ? `Đang đăng ký${progress ? ` ${progress.completed}/${progress.total}` : ''}...` : `Đăng ký ${selectedIds.length || ''} buổi học`}</button></footer>
          </form>}
        </div>
      </div>
      {result && <div className={`fdesk-booking-result ${result.error ? 'has-error' : ''}`} role={result.error ? 'alert' : 'status'}>
        {(result.registered.length > 0 || result.existing.length > 0) && <p><CheckCircle2 size={16} />Đã đăng ký {result.registered.length} buổi học.{result.existing.length > 0 && ` ${result.existing.length} buổi đã đăng ký trước đó được giữ nguyên.`}</p>}
        {result.error && <><p>{result.error}</p><ul>{result.blocked.map(item => <li key={item.id}>{sessions.find(session => String(session.id) === item.id) ? sessionLabel(sessions.find(session => String(session.id) === item.id)) : 'Buổi học đã chọn'}: {item.reason}</li>)}</ul><p>Các buổi đã đăng ký thành công vẫn được giữ chỗ. Có thể chọn lại các buổi còn phù hợp để đăng ký tiếp.</p></>}
      </div>}
      {error && <p className="fdesk-alert-danger" role="alert"><AlertCircle size={16} />{error}</p>}
    </div>
  </section>
}
