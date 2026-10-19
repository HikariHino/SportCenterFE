import { useEffect, useState } from 'react'
import { AlertCircle, BookOpen, CalendarDays, Dumbbell, LoaderCircle, RefreshCw, Target, User } from 'lucide-react'
import { getMyTrainingPlans, getTrainingPlanErrorMessage } from '../../services/trainingPlanService'
import '../../style/member/TrainingPlansView.css'

function formatDate(value) {
  if (!value) return 'Chưa cập nhật'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Chưa cập nhật' : date.toLocaleDateString('vi-VN')
}

function goalLabel(goal) {
  return {
    WeightLoss: 'Giảm cân', MuscleGain: 'Tăng cơ', Strength: 'Tăng sức mạnh',
    Endurance: 'Tăng sức bền', Flexibility: 'Cải thiện độ dẻo', GeneralFitness: 'Thể lực tổng quát',
  }[goal] || goal || 'Chưa cập nhật mục tiêu'
}

function statusLabel(status) {
  return {
    active: 'Đang áp dụng', completed: 'Đã hoàn thành', cancelled: 'Đã hủy',
    draft: 'Bản nháp', pending: 'Chờ áp dụng', paused: 'Tạm dừng', expired: 'Đã hết hạn',
  }[String(status || '').toLowerCase()] || status || 'Chưa cập nhật trạng thái'
}

function ExerciseTable({ exercises }) {
  if (!exercises.length) return <div className="training-plans-exercises-empty"><Dumbbell size={24} /><p>Giáo án chưa có bài tập. Huấn luyện viên sẽ bổ sung chi tiết cho bạn.</p></div>
  return <div className="training-plans-table-scroll" role="region" aria-label="Chi tiết bài tập trong giáo án" tabIndex={0}>
    <table>
      <caption className="training-plans-sr-only">Bài tập, số hiệp, số lần lặp, thời lượng và ghi chú của huấn luyện viên</caption>
      <thead><tr><th scope="col">Bài tập</th><th scope="col">Số hiệp (sets)</th><th scope="col">Số lần lặp (reps)</th><th scope="col">Thời lượng</th><th scope="col">Kết quả / Ghi chú HLV</th></tr></thead>
      <tbody>{exercises.map((exercise, index) => <tr key={exercise.id ?? index}>
        <th scope="row"><div className="training-plans-exercise-name"><span>{index + 1}</span><div><strong>{exercise.exerciseName || 'Chưa cập nhật tên bài tập'}</strong>{exercise.instructions && <p>{exercise.instructions}</p>}</div></div></th>
        <td>{exercise.sets == null ? '—' : `${exercise.sets} hiệp`}</td>
        <td>{exercise.reps == null ? '—' : `${exercise.reps} lần`}</td>
        <td>{exercise.durationInMinutes == null ? '—' : `${exercise.durationInMinutes} phút`}</td>
        <td className="training-plans-notes">{exercise.notes || <span className="training-plans-muted">Chưa có ghi chú</span>}</td>
      </tr>)}</tbody>
    </table>
  </div>
}

export function TrainingPlansView({ user }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const reload = () => setRevision(value => value + 1)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setPlans([])
    getMyTrainingPlans().then(data => {
      if (active) setPlans([...data].sort((a, b) => (Date.parse(b.startDate) || 0) - (Date.parse(a.startDate) || 0)))
    }).catch(requestError => {
      if (active) setError(getTrainingPlanErrorMessage(requestError))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [user?.userId, user?.memberId, revision])

  return <div className="member-view-stack training-plans-view">
    <div className="member-section-heading">
      <div><p className="member-eyebrow"><Dumbbell size={16} /> GIÁO ÁN CỦA BẠN</p><h2>Lộ trình tập luyện cá nhân</h2><p className="training-plans-muted">Theo dõi mục tiêu và các bài tập do huấn luyện viên thiết kế riêng cho bạn.</p></div>
      <button className="training-plans-button" type="button" disabled={loading} onClick={reload}><RefreshCw size={16} /> Làm mới giáo án</button>
    </div>

    <section aria-label="Giáo án tập luyện cá nhân" aria-busy={loading}>
      {loading ? <div className="training-plans-state" role="status"><LoaderCircle className="member-spin" size={28} /><strong>Đang tải giáo án tập luyện...</strong></div>
        : error ? <div className="training-plans-state training-plans-error" role="alert"><AlertCircle size={30} /><h3>Không thể tải giáo án</h3><p>{error}</p><button className="training-plans-button" type="button" onClick={reload}><RefreshCw size={16} /> Thử lại</button></div>
          : plans.length === 0 ? <div className="training-plans-state" role="status"><BookOpen size={38} /><h3>Chưa có giáo án tập luyện cá nhân</h3><p>Giáo án sẽ xuất hiện tại đây khi huấn luyện viên thiết kế kế hoạch tập luyện cho bạn.</p></div>
            : <>
              <p className="training-plans-count">{plans.length} giáo án · Sắp xếp theo ngày bắt đầu mới nhất</p>
              <div className="training-plans-list">{plans.map(plan => {
                const exercises = Array.isArray(plan.exercises) ? plan.exercises : []
                return <article className="training-plans-card" key={plan.id} aria-labelledby={`training-plan-${plan.id}`}>
                  <header className="training-plans-card-header">
                    <div><p className="training-plans-muted">Giáo án #{plan.id}</p><h3 id={`training-plan-${plan.id}`}>{plan.planName || 'Giáo án tập luyện'}</h3></div>
                    <span className="training-plans-status">{statusLabel(plan.status)}</span>
                  </header>
                  <div className="training-plans-goal"><Target size={22} /><div><span>Mục tiêu rèn luyện</span><p>{goalLabel(plan.goal)}</p></div></div>
                  <dl className="training-plans-meta">
                    <div><dt><User size={16} /> Huấn luyện viên</dt><dd>{plan.coachName || 'Chưa cập nhật'}</dd></div>
                    <div><dt><CalendarDays size={16} /> Ngày bắt đầu</dt><dd>{formatDate(plan.startDate)}</dd></div>
                    <div><dt><CalendarDays size={16} /> Ngày kết thúc</dt><dd>{formatDate(plan.endDate)}</dd></div>
                  </dl>
                  <details className="training-plans-exercises" open>
                    <summary><span>Chi tiết bài tập</span><span>{exercises.length} bài tập</span></summary>
                    <ExerciseTable exercises={exercises} />
                  </details>
                </article>
              })}</div>
            </>}
    </section>
  </div>
}
