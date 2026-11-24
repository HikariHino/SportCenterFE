import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, Star } from 'lucide-react'
import { getAllMyRegistrations, getMemberClassErrorMessage, reviewRegistration } from '../../services/memberClassService'
import { reviewUnavailableReason } from '../../utils/memberClasses'

export default function MemberSessionReviewForm({ item, onClose, onBusyChange, onSaved }) {
  const [state, setState] = useState({ loading: true })
  const [revision, setRevision] = useState(0)
  const [rating, setRating] = useState(0), [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false)
  const locked = useRef(false)
  useEffect(() => {
    let active = true
    setState({ loading: true }); setError('')
    getAllMyRegistrations().then(({ items }) => {
      if (!active) return
      const registration = items.find(row => String(row.id) === String(item.id) && String(row.sessionId) === String(item.sessionId))
      if (!registration) throw new Error('Không tìm thấy đăng ký của buổi học này.')
      setState({ loading: false, registration })
    }).catch(requestError => {
      if (active) { setState({ loading: false, failed: true }); setError(getMemberClassErrorMessage(requestError)) }
    })
    return () => { active = false }
  }, [item.id, item.sessionId, revision])

  const registration = state.registration
  const reviewed = Boolean(registration && (registration.hasReviewed || registration.review || registration.reviewedAt || registration.rating))
  const reason = registration && !reviewed ? reviewUnavailableReason(registration) : ''
  const review = registration?.review

  async function submit(event) {
    event.preventDefault()
    if (locked.current || state.loading || state.failed || reviewed || reason || !rating) return
    locked.current = true; setBusy(true); onBusyChange(true); setError('')
    try {
      const result = await reviewRegistration(item.id, { rating, comment })
      setState(current => ({ ...current, registration: { ...current.registration, hasReviewed: true, review: result } }))
      setSaved(true); onSaved?.()
    } catch (requestError) {
      setError(getMemberClassErrorMessage(requestError))
      // A conflict or a lost response may mean this registration was already reviewed.
      try {
        const { items } = await getAllMyRegistrations()
        const current = items.find(row => String(row.id) === String(item.id) && String(row.sessionId) === String(item.sessionId))
        if (current) setState({ loading: false, registration: current })
      } catch { /* Keep the error and entered text so the member can retry. */ }
    } finally { locked.current = false; setBusy(false); onBusyChange(false) }
  }

  return <form className="member-review-panel" onSubmit={submit}>
    <p>Đánh giá riêng cho buổi học #{item.sessionId}. Mỗi buổi được gửi một lần và không thể chỉnh sửa sau khi gửi.</p>
    {state.loading ? <p role="status">Đang tải đánh giá buổi học...</p> : reviewed ? <div className="member-classes-review">
      <strong><Star size={16} />Đánh giá buổi học của bạn: {review?.rating ?? registration.rating ?? 'Đã gửi'}{(review?.rating ?? registration.rating) ? '/5 sao' : ''}</strong>
      {review?.comment && <p>{review.comment}</p>}
    </div> : !state.failed && <>
      {reason && <p className="member-classes-error" role="alert">{reason}</p>}
      <fieldset className="member-classes-stars" disabled={busy || Boolean(reason)}>
        <legend>Bạn đánh giá buổi học bao nhiêu sao?</legend>
        {[1, 2, 3, 4, 5].map(value => <label key={value} className={value <= rating ? 'selected' : ''}>
          <input type="radio" name="session-rating" required value={value} checked={rating === value} aria-label={`${value} sao`} onChange={() => setRating(value)} />
          <Star size={30} fill={value <= rating ? 'currentColor' : 'none'} /><span>{value}</span>
        </label>)}
      </fieldset>
      <label htmlFor="member-session-comment">Nhận xét buổi học (không bắt buộc)</label>
      <textarea id="member-session-comment" rows={4} maxLength={2000} value={comment} disabled={busy || Boolean(reason)} onChange={event => setComment(event.target.value)} placeholder="Chia sẻ về nội dung, tổ chức buổi học và phòng tập..." />
      <small>{comment.length}/2.000 ký tự</small>
    </>}
    {error && <p className="member-classes-error" role="alert">{error}</p>}
    {state.failed && <button type="button" onClick={() => setRevision(value => value + 1)}>Thử lại</button>}
    {saved && <p className="member-classes-notice" role="status">Đã gửi đánh giá buổi học thành công.</p>}
    <footer><button type="button" disabled={busy} onClick={onClose}>Đóng</button>{!reviewed && <button type="submit" className="primary" disabled={busy || state.loading || state.failed || Boolean(reason) || !rating}>{busy ? <><LoaderCircle size={16} />Đang gửi...</> : 'Gửi đánh giá buổi học'}</button>}</footer>
  </form>
}
