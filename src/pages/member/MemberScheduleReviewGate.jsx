import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CalendarDays, CheckCircle2, LoaderCircle, LogOut, RefreshCw } from 'lucide-react'
import { confirmSessionReview, getPendingSessionReviews } from '../../services/memberScheduleReviewService'
import { getNotificationErrorMessage } from '../../services/notificationService'
import { classStatusLabel } from '../../utils/memberClasses'
import MemberSessionDetails from './MemberSessionDetails'
import '../../style/member/ClassesView.css'
import '../../style/member/MemberScheduleReview.css'

export default function MemberScheduleReviewGate({ children, refreshKey, onConfirmed, onLogout }) {
  const [state, setState] = useState({ checked: false, loading: true, pending: [], error: '' })
  const [revision, setRevision] = useState(0)
  const [accepted, setAccepted] = useState(false)
  const [saving, setSaving] = useState(false)
  const dialogRef = useRef(null)
  const headingRef = useRef(null)
  const request = useRef(0)
  const saveLock = useRef(false)
  const mounted = useRef(false)
  const review = state.pending[0]
  const blocked = !state.checked || state.pending.length > 0

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
    if (blocked && !dialog.open) dialog.showModal()
    if (!blocked && dialog.open) dialog.close()
  }, [blocked])

  useEffect(() => {
    setAccepted(false)
    if (review) headingRef.current?.focus()
  }, [review?.version])

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
    <div inert={blocked}>{children}</div>
    <dialog ref={dialogRef} className="member-classes-dialog member-schedule-review" aria-labelledby="member-schedule-review-title" aria-describedby="member-schedule-review-description" onCancel={event => { event.preventDefault(); event.stopPropagation() }}>
      <header><span className="member-schedule-review-icon"><CalendarDays size={24} /></span><div><p>CẬP NHẬT LỊCH HỌC</p><h2 id="member-schedule-review-title" ref={headingRef} tabIndex={-1}>Kiểm tra lịch bù / lịch thay đổi</h2></div></header>
      <p id="member-schedule-review-description">Bạn cần kiểm tra và xác nhận các thay đổi mới trước khi tiếp tục sử dụng. Ngày, giờ trong chi tiết buổi học được hiển thị theo giờ Việt Nam.</p>
      {state.loading ? <p className="member-schedule-review-status" role="status"><LoaderCircle className="member-spin" size={20} />Đang kiểm tra lịch học mới...</p> : review && <section aria-label="Lịch học cần xác nhận" className="member-schedule-review-content">
        <p className="member-schedule-review-count">Còn {state.pending.length} buổi cần kiểm tra</p>
        <h3>{review.registration?.className || (review.sessionId ? `Buổi học #${review.sessionId}` : 'Thông báo thay đổi lịch học')}</h3>
        {review.notifications.map(item => <p className="member-schedule-review-message" key={item.id}>{item.content}</p>)}
        {review.registration ? <><MemberSessionDetails item={review.registration} /><p>Trạng thái đăng ký: <strong>{classStatusLabel(review.registration.status)}</strong> · Buổi học: <strong>{classStatusLabel(review.registration.sessionStatus)}</strong></p></> : <p>Buổi học này hiện không có trong lịch đã đăng ký của bạn. Vui lòng kiểm tra nội dung thay đổi ở trên.</p>}
        <p>Đăng ký được giữ nguyên khi đổi lịch. Nếu không thể tham gia, bạn có thể hủy trong thời hạn cho phép tại mục Lớp học & Đặt lịch buổi học.</p>
        <label className="member-schedule-review-accept"><input type="checkbox" checked={accepted} disabled={saving} onChange={event => setAccepted(event.target.checked)} />Tôi đã kiểm tra lịch học và các thay đổi ở trên.</label>
      </section>}
      {state.error && <p className="member-schedule-review-error" role="alert"><AlertCircle size={18} />{state.error}</p>}
      <footer>
        <button type="button" disabled={saving} onClick={onLogout}><LogOut size={16} />Đăng xuất</button>
        {state.error && <button type="button" disabled={state.loading || saving} onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} />Thử lại</button>}
        {review && <button type="button" className="primary" disabled={!accepted || state.loading || saving} onClick={confirm}>{saving ? <LoaderCircle className="member-spin" size={16} /> : <CheckCircle2 size={16} />}{saving ? 'Đang lưu xác nhận...' : 'Xác nhận đã kiểm tra'}</button>}
      </footer>
    </dialog>
  </>
}
