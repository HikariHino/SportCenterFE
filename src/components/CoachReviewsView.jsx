import { useEffect, useId, useState } from 'react'
import { RefreshCw, Star } from 'lucide-react'
import { getCoaches } from '../services/classCatalogService'
import { getCoachReviews } from '../services/coachReviewService'
import { getMyReviewCoach } from '../services/coachReviewIdentityService'
import { NumberedList } from './NumberedPagination'
import '../style/CoachReviews.css'

const formatDate = value => Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }) : 'Chưa cập nhật ngày gửi'

function ReviewDetails({ coach, active }) {
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState({ loading: true })
  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    setState({ loading: true })
    getCoachReviews(coach.id, { page, pageSize: 10, signal: controller.signal }).then(data => {
      if (controller.signal.aborted) return
      const lastPage = Math.max(1, Math.ceil(data.total / 10))
      if (page > lastPage) setPage(lastPage)
      else setState({ loading: false, data })
    }).catch(error => {
      if (!controller.signal.aborted) setState({ loading: false, error: error.response?.data?.message || error.message || 'Không thể tải đánh giá coach.' })
    })
    return () => controller.abort()
  }, [coach.id, page, revision, active])

  const data = state.data
  return <section className="coach-reviews-details" aria-label={`Đánh giá của ${coach.fullName}`} aria-busy={state.loading}>
    <header><h2>{coach.fullName || `Huấn luyện viên #${coach.id}`}</h2><button type="button" disabled={state.loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} />Làm mới đánh giá</button></header>
    {state.loading ? <p role="status">Đang tải đánh giá coach...</p>
      : state.error ? <div role="alert"><p>{state.error}</p><button type="button" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div>
        : <>
          <div className="coach-reviews-summary"><Star size={28} fill="currentColor" /><strong>{data.reviewCount ? `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(data.averageRating)}/5 sao` : 'Chưa có đánh giá'}</strong><span>{data.reviewCount} lượt đánh giá từ hội viên</span></div>
          {!data.items.length ? <p role="status">Chưa có nhận xét của hội viên cho huấn luyện viên này.</p>
            : <div className="coach-reviews-list"><NumberedList prefix="coach-reviews" items={data.items} page={page} total={data.total} onPageChange={setPage} label="Đánh giá coach" showOrdinal={false}>
              {review => <article key={review.id} className="coach-reviews-item">
                <div><strong>{review.memberName || `Hội viên #${review.memberId}`}</strong><span className="coach-reviews-stars"><Star size={16} fill="currentColor" />{review.rating}/5 sao</span></div>
                <small>{formatDate(review.updatedAt || review.createdAt)}</small>
                <p>{typeof review.comment === 'string' && review.comment.trim() ? review.comment : 'Hội viên không để lại nhận xét.'}</p>
              </article>}
            </NumberedList></div>}
        </>}
  </section>
}

export default function CoachReviewsView({ own = false, active = true }) {
  const selectId = useId()
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState({ loading: true, coaches: [] })
  const [selectedId, setSelectedId] = useState('')
  useEffect(() => {
    if (!active) return
    let cancelled = false
    setState({ loading: true, coaches: [] })
    const load = own ? getMyReviewCoach().then(coach => [coach]) : getCoaches()
    load.then(coaches => {
      if (cancelled) return
      setState({ loading: false, coaches })
      setSelectedId(current => coaches.some(coach => String(coach.id) === current) ? current : String(coaches[0]?.id || ''))
    }).catch(error => {
      if (!cancelled) setState({ loading: false, coaches: [], error: error.response?.data?.message || error.message || 'Không thể tải danh sách huấn luyện viên.' })
    })
    return () => { cancelled = true }
  }, [own, active, revision])
  const coach = state.coaches.find(item => String(item.id) === selectedId)
  return <div className="coach-reviews-view">
    {state.loading ? <p role="status">Đang tải huấn luyện viên...</p>
      : state.error ? <div role="alert"><p>{state.error}</p><button type="button" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div>
        : !state.coaches.length ? <p role="status">Chưa có huấn luyện viên.</p>
          : <>
            {!own && <div className="coach-reviews-picker"><label htmlFor={selectId}>Chọn huấn luyện viên</label><select id={selectId} value={selectedId} onChange={event => setSelectedId(event.target.value)}>{state.coaches.map(coach => <option key={coach.id} value={coach.id}>{coach.fullName} · #{coach.id}</option>)}</select></div>}
            {coach && <ReviewDetails key={`${own}:${coach.id}`} coach={coach} active={active} />}
          </>}
  </div>
}
