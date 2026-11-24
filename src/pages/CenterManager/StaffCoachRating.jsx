import { useEffect, useState } from 'react'
import { ChevronRight, Star } from 'lucide-react'
import { getCoachRatingSummary } from '../../services/classCatalogService'
import { getCoachSessionQuality } from '../../services/coachSessionQualityService'

export default function StaffCoachRating({ coachId, onViewReviews, sessionQuality = false }) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState({ coachId, loading: true })
  useEffect(() => {
    const controller = new AbortController()
    setState({ coachId, loading: true })
    const load = sessionQuality ? getCoachSessionQuality : getCoachRatingSummary
    load(coachId, { signal: controller.signal }).then(summary => {
      if (!controller.signal.aborted) setState({ coachId, loading: false, ...summary })
    }).catch(() => {
      if (!controller.signal.aborted) setState({ coachId, loading: false, error: true })
    })
    return () => controller.abort()
  }, [coachId, sessionQuality, revision])

  const summary = <>
    <small>{sessionQuality ? 'Chất lượng buổi học phụ trách' : 'Đánh giá trung bình từ hội viên'}</small>
    {state.loading || state.coachId !== coachId ? <span role="status">Đang tải đánh giá...</span>
      : state.error ? <div role="alert"><p>{sessionQuality ? 'Chưa tải được chất lượng buổi học.' : 'Chưa tải được điểm đánh giá.'}</p><button type="button" className="staff-btn staff-btn-secondary" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div>
        : state.reviewCount === 0 ? <strong>Chưa có đánh giá</strong>
          : <><strong className="staff-coach-rating-score"><Star size={22} fill="currentColor" />{new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(state.averageRating)}/5 sao</strong><span>{state.reviewCount} lượt đánh giá{sessionQuality ? ' buổi học' : ''}</span></>}
  </>

  return <>
    <div className={`staff-detail-item staff-rating-card ${sessionQuality ? 'staff-session-quality' : 'staff-coach-rating'}`} aria-label={sessionQuality ? 'Chất lượng buổi học phụ trách' : 'Đánh giá huấn luyện viên từ hội viên'}>
      {sessionQuality ? summary : <>
        <button type="button" className="staff-coach-reviews-toggle" aria-haspopup="dialog" onClick={onViewReviews}>
          <small>Đánh giá trung bình từ hội viên</small>
          {state.loading || state.coachId !== coachId ? <span role="status">Đang tải đánh giá...</span>
            : state.error ? <strong>Chưa tải được điểm đánh giá</strong>
              : state.reviewCount === 0 ? <strong>Chưa có đánh giá</strong>
                : <><strong className="staff-coach-rating-score"><Star size={22} fill="currentColor" />{new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(state.averageRating)}/5 sao</strong><span>{state.reviewCount} lượt đánh giá</span></>}
          <span className="staff-coach-reviews-hint">Xem đánh giá coach<ChevronRight size={16} /></span>
        </button>
        {state.error && <button type="button" className="staff-btn staff-btn-secondary" onClick={() => setRevision(value => value + 1)}>Thử lại</button>}
      </>}
    </div>
  </>
}
