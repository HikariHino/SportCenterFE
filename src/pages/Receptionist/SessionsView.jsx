import { useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Plus, Star, Trophy, UserCheck, Users, X } from 'lucide-react'
import { getCoaches, getSports } from '../../services/classCatalogService'
import { getReceptionistClassById, getReceptionistClasses, getReceptionistClassSessions, getReceptionistClassSessionsByClass, getReceptionistSessionReviews } from '../../services/receptionistCatalogService'
import { completeReceptionistSession, getReceptionistSessionRoster, registerMemberForSession } from '../../services/receptionistClassService'
import { EmptyState, formatDateTime, formatMemberDate, requestErrorMessage, ViewLoader } from './ReceptionistViewShared'

function CompleteSessionDialog({ sessionId, onClose, onCompleted }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await completeReceptionistSession(sessionId)
      onCompleted()
      onClose()
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'Không thể hoàn thành buổi học.'))
    } finally {
      setSaving(false)
    }
  }

  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="reception-dialog reception-complete-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-complete-session-title">
      <header><div><span>XÁC NHẬN TRẠNG THÁI</span><h2 id="reception-complete-session-title">Hoàn thành buổi học #{sessionId}</h2><p>Thao tác này cập nhật trạng thái chính thức trên hệ thống.</p></div><button type="button" aria-label="Đóng xác nhận" onClick={onClose} disabled={saving}><X size={19} /></button></header>
      <form onSubmit={submit}><div className="reception-complete-copy"><span><CheckCircle2 size={25} /></span><strong>Xác nhận buổi học đã kết thúc?</strong><p>BE sẽ kiểm tra thời gian và quyền thao tác trước khi cập nhật.</p></div>{error && <p className="reception-form-error" role="alert">{error}</p>}<footer><button type="button" onClick={onClose} disabled={saving}>Hủy</button><button type="submit" disabled={saving}>{saving ? 'Đang cập nhật...' : 'Xác nhận hoàn thành'}</button></footer></form>
    </section>
  </div>
}

function SessionReviewsDialog({ session, onClose }) {
  const [reviews, setReviews] = useState({ items: [], total: 0, page: 1, pageSize: 8 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [requestKey, setRequestKey] = useState(0)

  useEffect(() => {
    let active = true
    const loadReviews = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getReceptionistSessionReviews(session.id, { page, pageSize: 8 })
        if (active) setReviews(result)
      } catch (requestError) {
        if (active) setError(requestErrorMessage(requestError, 'Không thể tải đánh giá của buổi học.'))
      } finally {
        if (active) setLoading(false)
      }
    }
    loadReviews()
    return () => { active = false }
  }, [page, requestKey, session.id])

  const pageCount = Math.max(1, Math.ceil(reviews.total / reviews.pageSize))

  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="reception-dialog reception-reviews-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-session-reviews-title">
      <header><div><span>ĐÁNH GIÁ HỌC VIÊN</span><h2 id="reception-session-reviews-title">{session.className} · Buổi #{session.id}</h2><p>{reviews.total} đánh giá từ học viên.</p></div><button type="button" aria-label="Đóng đánh giá" onClick={onClose}><X size={19} /></button></header>
      <div className="reception-reviews-body">{loading ? <EmptyState icon={Star} title="Đang tải đánh giá" text="Dữ liệu đánh giá đang được đồng bộ từ hệ thống." /> : error ? <div className="reception-inline-error"><EmptyState icon={Star} title="Không thể tải đánh giá" text={error} /><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : reviews.items.length ? <div className="reception-review-list">{reviews.items.map(review => <article key={review.id}><div><span>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={13} fill={index < review.rating ? 'currentColor' : 'none'} />)}</span><small>{formatDateTime(review.createdAt)}</small></div><p>{review.comment || 'Học viên không để lại nhận xét.'}</p><strong>Lượt đăng ký #{review.registrationId}</strong></article>)}</div> : <EmptyState icon={Star} title="Chưa có đánh giá" text="Buổi học này chưa nhận được đánh giá từ học viên." />}</div>
      {reviews.total > reviews.pageSize && <footer className="reception-review-pagination"><button type="button" disabled={loading || page <= 1} onClick={() => setPage(current => current - 1)}><ChevronLeft size={14} /> Trước</button><span>Trang {page}/{pageCount}</span><button type="button" disabled={loading || page >= pageCount} onClick={() => setPage(current => current + 1)}>Sau <ChevronRight size={14} /></button></footer>}
    </section>
  </div>
}

function ClassDetailDialog({ classId, onClose, onSelectSession }) {
  const [sportClass, setSportClass] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [sessionsError, setSessionsError] = useState('')
  const [sessionsRequestKey, setSessionsRequestKey] = useState(0)

  useEffect(() => {
    let active = true
    const loadClass = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getReceptionistClassById(classId)
        if (active) setSportClass(result)
      } catch (requestError) {
        if (active) setError(requestErrorMessage(requestError, 'Không thể tải chi tiết lớp học.'))
      } finally {
        if (active) setLoading(false)
      }
    }
    loadClass()
    return () => { active = false }
  }, [classId, requestKey])

  useEffect(() => {
    let active = true
    const loadSessions = async () => {
      setSessionsLoading(true)
      setSessionsError('')
      try {
        const result = await getReceptionistClassSessionsByClass(classId, { page: 1, pageSize: 20 })
        if (active) setSessions(result.items)
      } catch (requestError) {
        if (active) {
          setSessions([])
          setSessionsError(requestErrorMessage(requestError, 'Không thể tải các buổi học của lớp.'))
        }
      } finally {
        if (active) setSessionsLoading(false)
      }
    }
    loadSessions()
    return () => { active = false }
  }, [classId, sessionsRequestKey])

  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="reception-dialog reception-class-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-class-detail-title">
      <header><div><span>CHI TIẾT LỚP HỌC</span><h2 id="reception-class-detail-title">Lớp #{classId}</h2><p>Dữ liệu được tải trực tiếp từ hệ thống lớp học.</p></div><button type="button" aria-label="Đóng chi tiết lớp" onClick={onClose}><X size={19} /></button></header>
      <div className="reception-class-detail-body">{loading ? <EmptyState icon={Trophy} title="Đang tải chi tiết" text="Thông tin lớp học đang được đồng bộ từ hệ thống." /> : error ? <div className="reception-inline-error"><EmptyState icon={Trophy} title="Không thể tải chi tiết" text={error} /><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : sportClass && <><div className="reception-class-detail-title"><span><Trophy size={22} /></span><div><small>{sportClass.sportName}</small><h3>{sportClass.className}</h3></div><b className={sportClass.isActive ? 'active' : 'inactive'}>{sportClass.isActive ? 'Đang mở' : 'Tạm ngừng'}</b></div><div className="reception-class-detail-grid"><div><small>Huấn luyện viên</small><strong>{sportClass.coachName || 'Chưa phân công'}</strong></div><div><small>Mã HLV</small><strong>{sportClass.coachId ? `#${sportClass.coachId}` : 'Chưa có'}</strong></div><div><small>Quyền lợi</small><strong>Trong gói hội viên</strong></div><div><small>Sức chứa tối đa</small><strong>{sportClass.maxCapacity} học viên</strong></div><div><small>Ngày bắt đầu</small><strong>{formatMemberDate(sportClass.startDate)}</strong></div><div><small>Ngày kết thúc</small><strong>{formatMemberDate(sportClass.endDate)}</strong></div><div className="wide"><small>Lịch học</small><strong>{sportClass.schedule || 'Chưa cập nhật lịch học'}</strong></div></div><div className="reception-class-session-section"><div><span>BUỔI HỌC THUỘC LỚP</span><strong>{sessionsLoading ? 'Đang tải...' : `${sessions.length} buổi`}</strong></div>{sessionsLoading ? <EmptyState icon={CalendarDays} title="Đang tải buổi học" text="Dữ liệu đang được đồng bộ từ hệ thống." /> : sessionsError ? <div className="reception-inline-error"><EmptyState icon={CalendarDays} title="Không thể tải buổi học" text={sessionsError} /><button type="button" onClick={() => setSessionsRequestKey(key => key + 1)}>Thử lại</button></div> : sessions.length ? <div className="reception-class-session-list">{sessions.map(session => <button type="button" key={session.id} onClick={() => { onSelectSession(session); onClose() }}><span><small>Buổi #{session.id}</small><strong>{formatDateTime(session.startsAt)}</strong></span><span><small>{session.coachName}</small><strong>{session.availableSeats}/{session.capacity} chỗ trống</strong></span><ArrowRight size={14} /></button>)}</div> : <EmptyState icon={CalendarDays} title="Chưa có buổi học" text="Lớp này chưa có buổi học công khai." />}</div></>}</div>
    </section>
  </div>
}


export function SessionsView({ showNotice, selectedSession, onSelectSession }) {
  const selectedSessionId = selectedSession?.id ? String(selectedSession.id) : ''
  const [sessionId, setSessionId] = useState(selectedSessionId)
  const [memberId, setMemberId] = useState('')
  const [registration, setRegistration] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [rosterSessionId, setRosterSessionId] = useState(selectedSessionId)
  const [roster, setRoster] = useState([])
  const [rosterLoading, setRosterLoading] = useState(false)
  const [rosterError, setRosterError] = useState('')
  const [rosterLoaded, setRosterLoaded] = useState(false)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [completedSessionId, setCompletedSessionId] = useState(null)
  const [catalog, setCatalog] = useState({ items: [], total: 0, page: 1, pageSize: 20 })
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [catalogRequestKey, setCatalogRequestKey] = useState(0)
  const [reviewSession, setReviewSession] = useState(null)
  const [classes, setClasses] = useState({ items: [], total: 0, page: 1, pageSize: 20 })
  const [classesLoading, setClassesLoading] = useState(true)
  const [classesError, setClassesError] = useState('')
  const [classesRequestKey, setClassesRequestKey] = useState(0)
  const [selectedClassId, setSelectedClassId] = useState(null)
  const [sports, setSports] = useState([])
  const [sportsLoading, setSportsLoading] = useState(true)
  const [sportsError, setSportsError] = useState('')
  const [sportsRequestKey, setSportsRequestKey] = useState(0)
  const [selectedSportId, setSelectedSportId] = useState('')
  const [coaches, setCoaches] = useState([])
  const [coachesLoading, setCoachesLoading] = useState(true)
  const [coachesError, setCoachesError] = useState('')
  const [coachesRequestKey, setCoachesRequestKey] = useState(0)
  const [selectedCoachId, setSelectedCoachId] = useState('')

  useEffect(() => {
    if (!selectedSessionId) return
    setSessionId(selectedSessionId)
    setRosterSessionId(selectedSessionId)
  }, [selectedSessionId])

  useEffect(() => {
    let active = true
    const loadSports = async () => {
      setSportsLoading(true)
      setSportsError('')
      try {
        const result = await getSports()
        if (active) setSports(result)
      } catch (requestError) {
        if (active) {
          setSports([])
          setSportsError(requestErrorMessage(requestError, 'Không thể tải danh mục môn thể thao.'))
        }
      } finally {
        if (active) setSportsLoading(false)
      }
    }
    loadSports()
    return () => { active = false }
  }, [sportsRequestKey])

  useEffect(() => {
    let active = true
    const loadCoaches = async () => {
      setCoachesLoading(true)
      setCoachesError('')
      try {
        const result = await getCoaches()
        if (active) setCoaches(result)
      } catch (requestError) {
        if (active) {
          setCoaches([])
          setCoachesError(requestErrorMessage(requestError, 'Không thể tải danh sách huấn luyện viên.'))
        }
      } finally {
        if (active) setCoachesLoading(false)
      }
    }
    loadCoaches()
    return () => { active = false }
  }, [coachesRequestKey])

  useEffect(() => {
    let active = true
    const loadCatalog = async () => {
      setCatalogLoading(true)
      setCatalogError('')
      try {
        const result = await getReceptionistClassSessions({ sportId: selectedSportId ? Number(selectedSportId) : undefined, coachId: selectedCoachId ? Number(selectedCoachId) : undefined, page: 1, pageSize: 20 })
        if (active) setCatalog(result)
      } catch (requestError) {
        if (active) {
          setCatalog({ items: [], total: 0, page: 1, pageSize: 20 })
          setCatalogError(requestErrorMessage(requestError, 'Không thể tải danh mục buổi học.'))
        }
      } finally {
        if (active) setCatalogLoading(false)
      }
    }
    loadCatalog()
    return () => { active = false }
  }, [catalogRequestKey, selectedCoachId, selectedSportId])

  useEffect(() => {
    let active = true
    const loadClasses = async () => {
      setClassesLoading(true)
      setClassesError('')
      try {
        const result = await getReceptionistClasses({ sportId: selectedSportId ? Number(selectedSportId) : undefined, coachId: selectedCoachId ? Number(selectedCoachId) : undefined, page: 1, pageSize: 20 })
        if (active) setClasses(result)
      } catch (requestError) {
        if (active) {
          setClasses({ items: [], total: 0, page: 1, pageSize: 20 })
          setClassesError(requestErrorMessage(requestError, 'Không thể tải danh mục lớp học.'))
        }
      } finally {
        if (active) setClassesLoading(false)
      }
    }
    loadClasses()
    return () => { active = false }
  }, [classesRequestKey, selectedCoachId, selectedSportId])

  const selectCatalogSession = session => {
    setSessionId(String(session.id))
    setRosterSessionId(String(session.id))
    onSelectSession?.(session)
    window.requestAnimationFrame(() => document.getElementById('reception-session-registration')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  const submitRegistration = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await registerMemberForSession(Number(sessionId), Number(memberId))
      setRegistration(result)
      setRosterSessionId(String(result.sessionId))
      showNotice(`Đã đăng ký hội viên #${result.memberId} vào buổi học #${result.sessionId}.`)
    } catch (requestError) {
      setRegistration(null)
      setError(requestErrorMessage(requestError, 'Không thể đăng ký buổi học cho hội viên.'))
    } finally {
      setSaving(false)
    }
  }

  const loadRoster = async event => {
    event?.preventDefault()
    setRosterLoading(true)
    setRosterError('')
    setRosterLoaded(true)
    setCompletedSessionId(null)
    try {
      const result = await getReceptionistSessionRoster(Number(rosterSessionId))
      setRoster(result)
    } catch (requestError) {
      setRoster([])
      setRosterError(requestErrorMessage(requestError, 'Không thể tải danh sách học viên của buổi học.'))
    } finally {
      setRosterLoading(false)
    }
  }

  if (sportsLoading || coachesLoading || catalogLoading || classesLoading) return <ViewLoader />

  const activeSession = catalog.items.find(item => item.id === Number(sessionId)) || (selectedSession?.id === Number(sessionId) ? selectedSession : null)

  return <div className="reception-session-page">
    <section className="reception-card reception-session-steps" aria-label="Các bước xử lý buổi học"><div><span>1</span><p><strong>Chọn buổi học</strong><small>Lọc và chọn trong danh sách</small></p></div><div><span>2</span><p><strong>Đăng ký hội viên</strong><small>Nhập mã hội viên cần thêm</small></p></div><div><span>3</span><p><strong>Kiểm tra danh sách</strong><small>Xem học viên và hoàn thành buổi</small></p></div></section>
    <section className="reception-card reception-catalog-filters"><div><span><Trophy size={18} /></span><div><small>LỌC NHANH</small><strong>Tìm lớp và buổi học</strong></div></div><label><span>Môn thể thao</span><select value={selectedSportId} onChange={event => setSelectedSportId(event.target.value)} disabled={sportsLoading}><option value="">Tất cả môn thể thao</option>{sports.map(sport => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select></label><label><span>Huấn luyện viên</span><select value={selectedCoachId} onChange={event => setSelectedCoachId(event.target.value)} disabled={coachesLoading}><option value="">Tất cả huấn luyện viên</option>{coaches.map(coach => <option key={coach.id} value={coach.id}>{coach.fullName}{coach.specialization ? ` · ${coach.specialization}` : ''}</option>)}</select></label>{sportsError && <div className="reception-filter-error"><span>{sportsError}</span><button type="button" onClick={() => setSportsRequestKey(key => key + 1)}>Thử lại</button></div>}{coachesError && <div className="reception-filter-error"><span>{coachesError}</span><button type="button" onClick={() => setCoachesRequestKey(key => key + 1)}>Thử lại</button></div>}</section>
    <div className="reception-session-browser">
      <section className="reception-card reception-class-catalog"><div className="reception-card-head"><div><span>1 · CHỌN LỚP</span><h2>Lớp học</h2></div><strong>{classesLoading ? 'Đang tải...' : `${classes.total} lớp`}</strong></div>{classesLoading ? <EmptyState icon={Trophy} title="Đang tải lớp học" text="Dữ liệu lớp học đang được đồng bộ từ hệ thống." /> : classesError ? <div className="reception-inline-error"><EmptyState icon={Trophy} title="Không thể tải lớp học" text={classesError} /><button type="button" onClick={() => setClassesRequestKey(key => key + 1)}>Thử lại</button></div> : classes.items.length ? <div className="reception-class-catalog-list">{classes.items.map(item => <article key={item.id}><div><small>Lớp #{item.id}</small><h3>{item.className}</h3><p>{item.sportName} · {item.coachName || 'Chưa phân công HLV'}</p></div><div><span><small>Quyền lợi</small><strong>Trong gói hội viên</strong></span><span><small>Sức chứa</small><strong>{item.maxCapacity} học viên</strong></span><b className={item.isActive ? 'active' : 'inactive'}>{item.isActive ? 'Đang mở' : 'Tạm ngừng'}</b></div><button type="button" className="reception-class-detail-trigger" onClick={() => setSelectedClassId(item.id)}>Xem chi tiết <ArrowRight size={12} /></button></article>)}</div> : <EmptyState icon={Trophy} title="Chưa có lớp học" text="Chưa có dữ liệu lớp học công khai." />}</section>
      <section className="reception-card reception-session-catalog"><div className="reception-card-head"><div><span>2 · CHỌN BUỔI</span><h2>Buổi học</h2></div><strong>{catalogLoading ? 'Đang tải...' : `${catalog.total} buổi`}</strong></div>{catalogLoading ? <EmptyState icon={CalendarDays} title="Đang tải buổi học" text="Dữ liệu buổi học đang được đồng bộ từ hệ thống." /> : catalogError ? <div className="reception-inline-error"><EmptyState icon={CalendarDays} title="Không thể tải buổi học" text={catalogError} /><button type="button" onClick={() => setCatalogRequestKey(key => key + 1)}>Thử lại</button></div> : catalog.items.length ? <div className="reception-session-catalog-list">{catalog.items.map(item => <article key={item.id} className={Number(sessionId) === item.id ? 'selected' : ''}><button type="button" className="reception-session-select" onClick={() => selectCatalogSession(item)}><span><small>Buổi #{item.id}</small><strong>{item.className}</strong><em>{item.coachName}</em></span><span><small>{formatDateTime(item.startsAt)}</small><strong>{item.availableSeats}/{item.capacity} chỗ trống</strong><b className={String(item.status || '').toLowerCase()}>{item.status}</b></span></button><button type="button" className="reception-session-reviews" onClick={() => setReviewSession(item)}><Star size={12} /> Đánh giá</button></article>)}</div> : <EmptyState icon={CalendarDays} title="Chưa có buổi học" text="Chưa có dữ liệu buổi học công khai." />}</section>
    </div>
    <div className="reception-session-layout"><section id="reception-session-registration" className="reception-card reception-session-register">
      <div className="reception-card-head"><div><span>ĐĂNG KÝ BUỔI HỌC</span><h2>Thêm hội viên vào buổi học</h2></div><CalendarDays size={20} /></div>
      <form onSubmit={submitRegistration}>
        {activeSession && <div className="reception-selected-session"><span><CheckCircle2 size={18} /></span><p><small>BUỔI ĐANG CHỌN</small><strong>{activeSession.className || `Buổi học #${activeSession.id}`}</strong></p><b>#{activeSession.id}</b></div>}
        <label>Mã buổi học<input type="number" min="1" value={sessionId} onChange={event => setSessionId(event.target.value)} placeholder="Ví dụ: 12" required /></label>
        <label>Mã hội viên<input type="number" min="1" value={memberId} onChange={event => setMemberId(event.target.value)} placeholder="Ví dụ: 25" required /></label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={saving}><Plus size={15} />{saving ? 'Đang đăng ký...' : 'Đăng ký buổi học'}</button>
      </form>
    </section><section className="reception-card reception-registration-result">
      <div className="reception-card-head"><div><span>KẾT QUẢ ĐĂNG KÝ</span><h2>Thông tin lượt đăng ký</h2></div><UserCheck size={20} /></div>
      {registration ? <div className="reception-registration-summary"><span><CheckCircle2 size={25} /></span><h3>{registration.className}</h3><p>Hội viên #{registration.memberId} đã được thêm vào buổi học.</p><div><small>Mã đăng ký<strong>#{registration.id}</strong></small><small>Mã buổi học<strong>#{registration.sessionId}</strong></small><small>Trạng thái<strong>{registration.status}</strong></small><small>Thời gian<strong>{registration.startsAt ? sessionDateTimeFormatter.format(new Date(registration.startsAt)) : 'Chưa xác định'}</strong></small></div></div> : <EmptyState icon={CalendarDays} title="Chưa có lượt đăng ký mới" text="Nhập mã buổi học và mã hội viên để thực hiện đăng ký tại quầy." />}
    </section></div>
    <section className="reception-card reception-session-roster">
      <div className="reception-card-head"><div><span>DANH SÁCH THEO BUỔI</span><h2>Học viên đã đăng ký</h2></div><div className="reception-roster-head-actions"><strong>{rosterLoaded && !rosterLoading ? `${roster.length} học viên` : 'Chưa tải'}</strong><button type="button" className={completedSessionId === Number(rosterSessionId) ? 'completed' : ''} disabled={!rosterLoaded || rosterLoading || !rosterSessionId || completedSessionId === Number(rosterSessionId)} onClick={() => setShowCompleteDialog(true)}><CheckCircle2 size={14} />{completedSessionId === Number(rosterSessionId) ? 'Đã hoàn thành' : 'Hoàn thành buổi học'}</button></div></div>
      <form className="reception-roster-lookup" onSubmit={loadRoster}><label htmlFor="reception-roster-session">Mã buổi học</label><div><CalendarDays size={16} /><input id="reception-roster-session" type="number" min="1" value={rosterSessionId} onChange={event => setRosterSessionId(event.target.value)} placeholder="Nhập mã buổi học" required /><button type="submit" disabled={rosterLoading}>{rosterLoading ? 'Đang tải...' : 'Xem danh sách'}</button></div></form>
      {rosterLoading ? <EmptyState icon={Users} title="Đang tải danh sách" text="Dữ liệu học viên đang được đồng bộ từ hệ thống." /> : rosterError ? <div className="reception-inline-error"><EmptyState icon={Users} title="Không thể tải danh sách" text={rosterError} /><button type="button" onClick={loadRoster}>Thử lại</button></div> : rosterLoaded ? roster.length ? <div className="reception-roster-table"><div className="reception-roster-heading"><span>Mã đăng ký</span><span>Học viên</span><span>Mã hội viên</span><span>Đăng ký</span><span>Điểm danh</span></div>{roster.map(student => <div className="reception-roster-row" key={student.registrationId}><span>#{student.registrationId}</span><strong>{student.fullName}</strong><span>#{student.memberId}</span><span>{student.registrationStatus}</span><span><b>{student.attendanceStatus || 'Chưa điểm danh'}</b><small>{student.checkInTime ? sessionDateTimeFormatter.format(new Date(student.checkInTime)) : 'Chưa có giờ check-in'}</small></span></div>)}</div> : <EmptyState icon={Users} title="Chưa có học viên" text="Buổi học này chưa có lượt đăng ký." /> : <EmptyState icon={Users} title="Chọn một buổi học" text="Nhập mã buổi học để xem danh sách học viên đã đăng ký." />}
    </section>
    {showCompleteDialog && <CompleteSessionDialog sessionId={Number(rosterSessionId)} onClose={() => setShowCompleteDialog(false)} onCompleted={() => { setCompletedSessionId(Number(rosterSessionId)); showNotice(`Đã hoàn thành buổi học #${rosterSessionId}.`) }} />}
    {reviewSession && <SessionReviewsDialog session={reviewSession} onClose={() => setReviewSession(null)} />}
    {selectedClassId !== null && <ClassDetailDialog classId={selectedClassId} onClose={() => setSelectedClassId(null)} onSelectSession={selectCatalogSession} />}
  </div>
}

