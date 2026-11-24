import { useEffect, useId, useState } from 'react'
import { ChevronDown, Star } from 'lucide-react'
import { getClassErrorMessage } from '../../services/sportClassService'
import { getAllCoachReviews } from '../../services/coachReviewService'
import { ManagerList } from './ManagerPagination'
import '../../style/CenterManager/SessionReviewsSection.css'

const formatDate = value => Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }) : 'Chưa cập nhật ngày gửi'

export default function SessionReviewsSection({ coachId, students = [] }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState({ loading: false, items: [], total: 0, error: '' })

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setState({ loading: true, items: [], total: 0, error: '' })
    getAllCoachReviews(coachId, { signal: controller.signal }).then(items => {
      if (controller.signal.aborted) return
      setState({ items, loading: false, error: '' })
    }).catch(error => {
      if (!controller.signal.aborted) setState({ loading: false, items: [], total: 0,
        error: getClassErrorMessage(error, 'Không thể tải đánh giá của học viên.') })
    })
    return () => controller.abort()
  }, [open, coachId, revision])

  const items = state.items.filter(review => students.some(student => String(student.memberId) === String(review.memberId)))

  return <section className="session-reviews-section">
    <button type="button" className="session-reviews-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <Star size={18} /><span>{open ? 'Ẩn đánh giá của học viên' : 'Xem đánh giá của học viên'}</span><ChevronDown size={17} />
    </button>
    {open && <div id={id} className="session-reviews-content" aria-busy={state.loading}>
      {state.loading ? <p role="status">Đang tải đánh giá của học viên...</p>
        : state.error ? <div role="alert"><p>{state.error}</p><button type="button" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div>
          : !items.length ? <p role="status">Học viên trong buổi này chưa có đánh giá coach.</p>
            : <>
              <p className="session-reviews-count">{items.length} đánh giá coach từ học viên trong buổi này. Mỗi học viên có một đánh giá cho coach.</p>
              <ManagerList items={items} resetKey={String(coachId)} label="Đánh giá của học viên" className="session-reviews-list">
                {review => {
                  const student = students.find(item => String(item.memberId) === String(review.memberId))
                  return <article key={review.id} className="session-review-item">
                    <div className="session-review-heading"><strong>{student?.fullName || review.memberName || `Hội viên #${review.memberId}`}</strong><span className="session-review-rating"><Star size={16} fill="currentColor" />{review.rating}/5 sao</span></div>
                    <small>{formatDate(review.updatedAt || review.createdAt)} · Hội viên #{review.memberId}</small>
                    <p className="session-review-comment">{review.comment?.trim() || 'Học viên không để lại nhận xét.'}</p>
                  </article>
                }}
              </ManagerList>
            </>}
    </div>}
  </section>
}
