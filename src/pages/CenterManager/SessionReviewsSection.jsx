import { useEffect, useId, useState } from 'react'
import { ChevronDown, Star } from 'lucide-react'
import { getClassErrorMessage, getSessionReviews } from '../../services/sportClassService'
import { ManagerList } from './ManagerPagination'
import '../../style/CenterManager/SessionReviewsSection.css'

const formatDate = value => Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }) : 'Chưa cập nhật ngày gửi'

export default function SessionReviewsSection({ sessionId, students = [] }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [revision, setRevision] = useState(0)
  const [page, setPage] = useState(1)
  const [state, setState] = useState({ loading: false, items: [], total: 0, error: '' })

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setState({ loading: true, items: [], total: 0, error: '' })
    getSessionReviews(sessionId, { page, pageSize: 10, signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return
      const lastPage = Math.max(1, Math.ceil(result.total / 10))
      if (page > lastPage) setPage(lastPage)
      else setState({ ...result, loading: false, error: '' })
    }).catch(error => {
      if (!controller.signal.aborted) setState({ loading: false, items: [], total: 0,
        error: getClassErrorMessage(error, 'Không thể tải đánh giá buổi học.') })
    })
    return () => controller.abort()
  }, [open, sessionId, page, revision])

  const items = state.items

  return <section className="session-reviews-section">
    <button type="button" className="session-reviews-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <Star size={18} /><span>{open ? 'Ẩn đánh giá buổi học' : 'Xem đánh giá buổi học'}</span><ChevronDown size={17} />
    </button>
    {open && <div id={id} className="session-reviews-content" aria-busy={state.loading}>
      {state.loading ? <p role="status">Đang tải đánh giá buổi học...</p>
        : state.error ? <div role="alert"><p>{state.error}</p><button type="button" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div>
          : !items.length ? <p role="status">Buổi học này chưa có đánh giá.</p>
            : <>
              <p className="session-reviews-count">{state.total} đánh giá từ học viên cho buổi học #{sessionId}.</p>
              <ManagerList items={items} page={page} total={state.total} onPageChange={setPage} disabled={state.loading} resetKey={String(sessionId)} label="Đánh giá buổi học" className="session-reviews-list">
                {review => {
                  const student = students.find(item => review.registrationId != null
                    ? String(item.registrationId) === String(review.registrationId)
                    : review.memberId != null && String(item.memberId) === String(review.memberId))
                  const memberId = student?.memberId ?? review.memberId
                  return <article key={review.id} className="session-review-item">
                    <div className="session-review-heading"><strong>{student?.fullName || review.memberName || (memberId != null ? `Hội viên #${memberId}` : `Lượt đăng ký #${review.registrationId}`)}</strong><span className="session-review-rating"><Star size={16} fill="currentColor" />{review.rating}/5 sao</span></div>
                    <small>{formatDate(review.updatedAt || review.createdAt)} · {memberId != null ? `Hội viên #${memberId}` : `Lượt đăng ký #${review.registrationId}`}</small>
                    <p className="session-review-comment">{review.comment?.trim() || 'Học viên không để lại nhận xét.'}</p>
                  </article>
                }}
              </ManagerList>
            </>}
    </div>}
  </section>
}
