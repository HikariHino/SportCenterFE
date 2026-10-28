import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowRight, BellRing, CalendarDays, CheckCircle2, Clock3, Info, LoaderCircle, MapPin, RefreshCw, User, X } from 'lucide-react'
import { confirmSessionReview, getPendingSessionReviews } from '../../services/memberScheduleReviewService'
import { getNotificationErrorMessage } from '../../services/notificationService'
import { cancellationDeadline, classStatusLabel } from '../../utils/memberClasses'
import { formatClassDateTime } from './MemberSessionDetails'
import '../../style/member/MemberScheduleReview.css'

export default function MemberScheduleReviewGate({ children, refreshKey, reopenRequest, onConfirmed }) {
  const [state, setState] = useState({ checked: false, loading: true, pending: [], error: '' })
  const [revision, setRevision] = useState(0)
  const [accepted, setAccepted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dismissedVersions, setDismissedVersions] = useState(() => new Set())
  const [dismissedError, setDismissedError] = useState('')
  const dialogRef = useRef(null)
  const headingRef = useRef(null)
  const request = useRef(0)
  const saveLock = useRef(false)
  const mounted = useRef(false)
  const remaining = state.pending.filter(item => !dismissedVersions.has(item.version))
  const review = remaining[0]
  const visible = Boolean(review) || (!state.checked && Boolean(state.error) && state.error !== dismissedError)
  const session = review?.registration
  const deadline = session ? cancellationDeadline(session) : null

  const dismiss = () => {
    // Closing postpones review for this visit; only confirmation marks it read.
    setDismissedVersions(previous => new Set([...previous, ...state.pending.map(item => item.version)]))
    setDismissedError(state.error)
    setAccepted(false)
  }

  useEffect(() => {
    if (reopenRequest) {
      setDismissedVersions(new Set())
      setDismissedError('')
    }
  }, [reopenRequest])

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; request.current += 1 }
  }, [])

  useEffect(() => {
    if (saveLock.current) return
    const currentRequest = ++request.current
    setState(previous => ({ ...previous, loading: true, error: '' }))
    getPendingSessionReviews().then(pending => {
      if (mounted.current && request.current === currentRequest) setState({ checked: true, loading: false, pending, error: '' })
    }).catch(error => {
      if (mounted.current && request.current === currentRequest) setState(previous => ({ ...previous, loading: false, error: getNotificationErrorMessage(error) }))
    })
  }, [refreshKey, revision])

  useEffect(() => {
    const dialog = dialogRef.current
    if (visible && !dialog.open) dialog.showModal()
    if (!visible && dialog.open) dialog.close()
  }, [visible])

  useEffect(() => {
    setAccepted(false)
    if (review) headingRef.current?.focus()
  }, [review?.version, visible])

  const confirm = async () => {
    if (saveLock.current || !accepted || !review || state.loading) return
    saveLock.current = true
    request.current += 1
    setSaving(true)
    setState(previous => ({ ...previous, error: '' }))
    try {
      const result = await confirmSessionReview(review)
      if (!mounted.current) return
      setAccepted(false)
      setState({ checked: true, loading: false, pending: result.pending, error: result.changed ? 'Lịch học vừa có thay đổi mới. Vui lòng kiểm tra lại trước khi xác nhận.' : '' })
      if (!result.changed) onConfirmed?.()
    } catch (error) {
      if (mounted.current) setState(previous => ({ ...previous, error: getNotificationErrorMessage(error, 'Chưa lưu được xác nhận. Vui lòng thử lại.') }))
    } finally {
      saveLock.current = false
      if (mounted.current) setSaving(false)
    }
  }

  return <>
    {children}
    <dialog ref={dialogRef} className="member-schedule-review" aria-labelledby="member-schedule-review-title" aria-describedby="member-schedule-review-description"
      onCancel={event => { event.preventDefault(); event.stopPropagation(); dismiss() }}
      onClick={event => {
        if (event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dismiss()
      }}>
      <header className="member-schedule-review-header">
        <span className="member-schedule-review-icon"><BellRing size={24} /></span>
        <div className="member-schedule-review-heading">
          <p>THÔNG BÁO TỪ TRUNG TÂM</p>
          <h2 id="member-schedule-review-title" ref={headingRef} tabIndex={-1}>Lịch bù & lịch thay đổi</h2>
          <p id="member-schedule-review-description">Xem lịch mới để sắp xếp buổi tập. Bạn có thể đóng và xem lại trong Thông báo.</p>
        </div>
        <button type="button" className="member-schedule-review-close" aria-label="Đóng thông báo lịch bù" onClick={dismiss}><X size={20} /></button>
      </header>
      <div className="member-schedule-review-body">
        {review && <>
          <div className="member-schedule-review-summary"><span><CalendarDays size={15} />LỊCH HỌC CẬP NHẬT</span><span>{remaining.length} buổi chưa xem</span></div>
          <section className="member-schedule-review-session" aria-label="Chi tiết lịch học mới" key={review.version}>
            <div className="member-schedule-review-session-heading">
              <div><p>{review.sessionId ? `BUỔI HỌC #${review.sessionId}` : 'THÔNG TIN BUỔI HỌC'}</p><h3>{session?.className || 'Buổi học của bạn'}</h3></div>
              {session && <span className="member-schedule-review-badge">{classStatusLabel(session.sessionStatus || session.status)}</span>}
            </div>
            {session ? <>
              <div className="member-schedule-review-times">
                <div><span><Clock3 size={15} />Bắt đầu</span><strong>{formatClassDateTime(session.startsAt)}</strong></div>
                <ArrowRight size={20} aria-hidden="true" />
                <div><span><Clock3 size={15} />Kết thúc</span><strong>{formatClassDateTime(session.endsAt)}</strong></div>
              </div>
              <p className="member-schedule-review-timezone">Giờ Việt Nam (GMT+7)</p>
              <dl className="member-schedule-review-facts">
                <div><dt><User size={17} />Huấn luyện viên</dt><dd>{session.coachName || 'Chưa cập nhật'}</dd></div>
                <div><dt><MapPin size={17} />Phòng tập</dt><dd>{session.roomName || 'Chưa cập nhật'}</dd></div>
              </dl>
              <div className="member-schedule-review-registration"><span>Đăng ký của bạn</span><strong>{classStatusLabel(session.status)}</strong></div>
            </> : <p className="member-schedule-review-missing">Buổi học hiện không có trong lịch đã đăng ký. Bạn có thể xem nội dung từ trung tâm bên dưới.</p>}
            <details className="member-schedule-review-messages" open={session ? undefined : true}>
              <summary>Nội dung thông báo từ trung tâm{review.notifications.length > 1 ? ` (${review.notifications.length})` : ''}</summary>
              {review.notifications.map(item => <p key={item.id}>{item.content}</p>)}
            </details>
          </section>
          <aside className="member-schedule-review-note"><Info size={18} /><div><strong>Chủ động sắp xếp lịch tập</strong><p>Nếu lịch mới không phù hợp, bạn có thể hủy tại mục Lớp học & Đặt lịch buổi học, trong thời hạn cho phép.</p>{deadline && <p>Hạn hủy: <strong>{formatClassDateTime(deadline)}</strong></p>}</div></aside>
          <label className="member-schedule-review-accept"><input type="checkbox" checked={accepted} disabled={saving} onChange={event => setAccepted(event.target.checked)} /><span>Tôi đã xem các thay đổi của buổi học này.</span></label>
        </>}
        {state.loading && <p className="member-schedule-review-status" role="status"><LoaderCircle className="member-spin" size={18} />Đang cập nhật lịch học...</p>}
        {state.error && <p className="member-schedule-review-error" role="alert"><AlertCircle size={18} />{state.error}</p>}
      </div>
      <footer className="member-schedule-review-footer">
        <p>Đóng thông báo sẽ giữ lịch ở trạng thái chưa xác nhận.</p>
        <div>
          <button type="button" onClick={dismiss}>{review ? 'Để sau' : 'Đóng'}</button>
          {state.error && <button type="button" disabled={state.loading || saving} onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} />Thử lại</button>}
          {review && <button type="button" className="primary" disabled={!accepted || state.loading || saving} onClick={confirm}>{saving ? <LoaderCircle className="member-spin" size={16} /> : <CheckCircle2 size={16} />}{saving ? 'Đang lưu...' : 'Xác nhận đã xem'}</button>}
        </div>
      </footer>
    </dialog>
  </>
}
