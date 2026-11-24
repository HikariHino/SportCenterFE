import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, Star, X } from 'lucide-react'
import { loadMemberCoachReview, saveMemberCoachReview } from '../../services/coachReviewService'
import { getMemberClassErrorMessage } from '../../services/memberClassService'
import SessionDetails from './MemberSessionDetails'
import MemberSessionReviewForm from './MemberSessionReviewForm'

export default function MemberCoachReviewDialog({ item, onClose, onSessionReviewed }) {
  const dialogRef = useRef(null), locked = useRef(false)
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState({ loading: true })
  const [rating, setRating] = useState(0), [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false)
  const [mode, setMode] = useState('coach'), [sessionBusy, setSessionBusy] = useState(false)
  const [sessionOpened, setSessionOpened] = useState(false)
  const closeLocked = useRef(false)
  const changeSessionBusy = value => { closeLocked.current = value; setSessionBusy(value) }
  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    return () => dialog.close()
  }, [])
  useEffect(() => {
    let active = true
    setState({ loading: true }); setError('')
    loadMemberCoachReview(item.id).then(context => {
      if (!active) return
      setState({ ...context, loading: false })
      setRating(context.review?.rating || 0); setComment(context.review?.comment || '')
    }).catch(requestError => {
      if (active) { setState({ loading: false, failed: true }); setError(getMemberClassErrorMessage(requestError)) }
    })
    return () => { active = false }
  }, [item.id, revision])

  async function submit(event) {
    event.preventDefault()
    if (locked.current || state.loading || state.failed || !rating || saved) return
    locked.current = true; setBusy(true); setError('')
    try {
      const review = await saveMemberCoachReview(item.id, state.coachId, { rating, comment })
      setState(current => ({ ...current, review })); setSaved(true)
    } catch (requestError) { setError(getMemberClassErrorMessage(requestError)) }
    finally { locked.current = false; setBusy(false) }
  }

  return <dialog ref={dialogRef} className="member-classes-dialog" aria-labelledby="member-coach-review-title" onCancel={event => { event.preventDefault(); if (!locked.current && !closeLocked.current) onClose() }}>
    <div className="member-registration-dialog-content">
      <header><h2 id="member-coach-review-title">{mode === 'coach' ? 'Đánh giá coach' : 'Đánh giá buổi học'}</h2><button type="button" aria-label="Đóng đánh giá coach" disabled={busy || sessionBusy} onClick={onClose}><X size={20} /></button></header>
      <h3>{item.className || `Buổi học #${item.sessionId}`}</h3>
      <SessionDetails item={{ ...item, coachName: state.coachName || item.coachName }} />
      <div className="member-review-tabs" role="group" aria-label="Chọn loại đánh giá">
        <button type="button" aria-pressed={mode === 'coach'} disabled={busy || sessionBusy} onClick={() => setMode('coach')}>Đánh giá coach</button>
        <button type="button" aria-pressed={mode === 'session'} disabled={busy || sessionBusy} onClick={() => { setSessionOpened(true); setMode('session') }}>Đánh giá buổi học</button>
      </div>
      <form className="member-review-panel" hidden={mode !== 'coach'} onSubmit={submit}>
      <p>Mỗi hội viên có một đánh giá cho mỗi coach. Bạn có thể cập nhật đánh giá sau khi tham gia các buổi học tiếp theo.</p>
      {state.loading ? <p role="status">Đang tải đánh giá coach...</p> : !state.failed && <>
        {state.review && <div className="member-classes-review"><strong><Star size={16} />Đánh giá của bạn: {state.review.rating}/5 sao</strong>{state.review.comment && <p>{state.review.comment}</p>}</div>}
        <fieldset className="member-classes-stars" disabled={busy}>
          <legend>Bạn đánh giá huấn luyện viên bao nhiêu sao?</legend>
          {[1, 2, 3, 4, 5].map(value => <label key={value} className={value <= rating ? 'selected' : ''}>
            <input type="radio" name="coach-rating" required checked={rating === value} value={value} aria-label={`${value} sao`} onChange={() => { setRating(value); setSaved(false) }} />
            <Star size={30} fill={value <= rating ? 'currentColor' : 'none'} /><span>{value}</span>
          </label>)}
        </fieldset>
        <label htmlFor="member-coach-comment">Nhận xét (không bắt buộc)</label>
        <textarea id="member-coach-comment" rows={4} maxLength={2000} value={comment} disabled={busy} onChange={event => { setComment(event.target.value); setSaved(false) }} />
        <small>{comment.length}/2.000 ký tự</small>
      </>}
      {error && <p className="member-classes-error" role="alert">{error}</p>}
      {state.failed && <button type="button" onClick={() => setRevision(value => value + 1)}>Thử lại</button>}
      {saved && <p className="member-classes-notice" role="status">Đã lưu đánh giá coach thành công.</p>}
      <footer><button type="button" disabled={busy} onClick={onClose}>Đóng</button><button type="submit" className="primary" disabled={busy || state.loading || state.failed || !rating || saved}>{busy ? <><LoaderCircle size={16} />Đang lưu...</> : state.review ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}</button></footer>
    </form>
    {sessionOpened && <div className="member-review-panel member-session-review-pane" hidden={mode !== 'session'}><MemberSessionReviewForm item={item} onClose={onClose} onBusyChange={changeSessionBusy} onSaved={onSessionReviewed} /></div>}
    </div>
  </dialog>
}
