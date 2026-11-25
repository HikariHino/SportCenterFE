import { MemberList } from './MemberPagination'
import { useMemberCache, useMemberResource, useMemberViewActive } from '../../contexts/MemberWorkspaceContext'
import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowRight, BookOpen, CalendarDays, CheckCircle2, ChevronDown, Dumbbell, LoaderCircle, MessageSquare, RefreshCw, Target, User, X } from 'lucide-react'
import { completeMyTrainingPlan, getMemberTrainingPlans, getTrainingPlanErrorMessage, requestMyTrainingPlanChange } from '../../services/trainingPlanService'
import { getMyMemberProfile } from '../../services/memberService'
import '../../style/member/TrainingPlansView.css'

function formatDate(value) {
  if (!value) return 'Chưa cập nhật'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Chưa cập nhật' : date.toLocaleDateString('vi-VN')
}

function PlanActionDialog({ action, onClose, onSaved }) {
  const dialog = useRef(null), lock = useRef(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const complete = action.type === 'complete'
  useEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [])
  const submit = async event => {
    event.preventDefault()
    if (lock.current) return
    if (!complete && (!reason.trim() || reason.trim().length > 1000)) { setError('Vui lòng nhập yêu cầu từ 1 đến 1.000 ký tự.'); return }
    lock.current = true; setBusy(true); setError('')
    try {
      const updated = complete ? await completeMyTrainingPlan(action.plan.id) : await requestMyTrainingPlanChange(action.plan.id, reason)
      onSaved(updated, action.type)
      onClose()
    } catch (requestError) { setError(getTrainingPlanErrorMessage(requestError)) }
    finally { lock.current = false; setBusy(false) }
  }
  return <dialog ref={dialog} className="training-plan-action-dialog" aria-labelledby="training-plan-action-title" onCancel={event => { event.preventDefault(); if (!lock.current) onClose() }}>
    <form onSubmit={submit}>
      <header><h3 id="training-plan-action-title">{complete ? 'Xác nhận đã tập giáo án' : 'Yêu cầu đổi giáo án'}</h3><button type="button" disabled={busy} aria-label="Đóng yêu cầu giáo án" onClick={onClose}><X size={18} /></button></header>
      <strong>{action.plan.planName}</strong>
      {complete ? <p>Xác nhận bạn đã tập xong giáo án này. Giáo án sẽ chuyển vào lịch sử hoàn thành và huấn luyện viên được thông báo.</p> : <>
        <p>Gửi nội dung cần điều chỉnh cho huấn luyện viên. Giáo án hiện tại được giữ lại trong lúc chờ xử lý.</p>
        <label htmlFor="training-plan-change-reason">Nội dung yêu cầu<textarea id="training-plan-change-reason" value={reason} onChange={event => setReason(event.target.value)} rows={4} maxLength={1000} required disabled={busy} autoFocus placeholder="Ví dụ: Tôi đã tập giáo án tương tự và muốn đổi bài hoặc điều chỉnh cường độ." /></label>
        <small>{reason.length}/1.000 ký tự</small>
      </>}
      {error && <p className="training-plan-action-error" role="alert">{error}</p>}
      <footer><button type="button" disabled={busy} onClick={onClose}>Hủy</button><button type="submit" disabled={busy || (!complete && !reason.trim())}>{busy ? 'Đang xử lý...' : complete ? 'Xác nhận đã tập' : 'Gửi yêu cầu'}</button></footer>
    </form>
  </dialog>
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
  return <div className="training-plans-table-scroll">
    <MemberList items={exercises} label="Bài tập trong giáo án" table compact layout="embedded" hideSinglePagePagination heading={<tr><th scope="col">STT</th><th scope="col">Bài tập</th><th scope="col">Số hiệp</th><th scope="col">Số lần</th><th scope="col">Thời lượng</th><th scope="col">Ghi chú / Kết quả</th></tr>}>{(exercise, index) => <tr key={exercise.id ?? index}>
        <th scope="row"><div className="training-plans-exercise-name"><div><strong>{exercise.exerciseName || 'Chưa cập nhật tên bài tập'}</strong>{exercise.instructions && <p>{exercise.instructions}</p>}</div></div></th>
        <td>{exercise.sets == null ? '—' : `${exercise.sets} hiệp`}</td>
        <td>{exercise.reps == null ? '—' : `${exercise.reps} lần`}</td>
        <td>{exercise.durationInMinutes == null ? '—' : `${exercise.durationInMinutes} phút`}</td>
        <td className="training-plans-notes">{exercise.notes || <span className="training-plans-muted">Chưa có ghi chú</span>}</td>
      </tr>}</MemberList>
  </div>
}

export function TrainingPlansView({ user, completedOnly = false }) {
  const cache = useMemberCache()
  const active = useMemberViewActive()
  const [action, setAction] = useState(null)
  const [notice, setNotice] = useState('')
  useEffect(() => { if (!active) setAction(null) }, [active])
  const plansRead = useMemberResource('training-plans', async () => {
    const member = await cache.load('member-profile', getMyMemberProfile)
    return getMemberTrainingPlans(member?.memberId)
  }, { initialData: [] })
  const plans = plansRead.data
    .filter(plan => (String(plan.status || '').trim().toLowerCase() === 'completed') === completedOnly)
    .sort((a, b) => (Date.parse(b.startDate) || 0) - (Date.parse(a.startDate) || 0) || Number(b.id) - Number(a.id))
  const { loading, reload } = plansRead
  const error = !plansRead.hasData && plansRead.error ? getTrainingPlanErrorMessage(plansRead.error) : ''

  return <div className="member-view-stack training-plans-view">
    <div className="member-section-heading">
      <div><h2>{completedOnly ? 'Lịch sử giáo án đã hoàn thành' : 'Lộ trình tập luyện cá nhân'}</h2><p className="training-plans-muted">{completedOnly ? 'Xem lại bài tập và nhận xét trong các giáo án đã được đánh dấu hoàn thành.' : 'Mục tiêu và bài tập do huấn luyện viên thiết kế cho bạn.'}</p></div>
      <button className="training-plans-button" type="button" disabled={loading} onClick={reload}><RefreshCw size={16} /> Làm mới giáo án</button>
    </div>
    {notice && <p className="training-plan-action-notice" role="status">{notice}</p>}

    <section aria-label={completedOnly ? 'Lịch sử giáo án đã hoàn thành' : 'Giáo án tập luyện cá nhân'} aria-busy={loading}>
      {loading ? <div className="training-plans-state" role="status"><LoaderCircle className="member-spin" size={28} /><strong>Đang tải giáo án tập luyện...</strong></div>
        : error ? <div className="training-plans-state training-plans-error" role="alert"><AlertCircle size={30} /><h3>Không thể tải giáo án</h3><p>{error}</p><button className="training-plans-button" type="button" onClick={reload}><RefreshCw size={16} /> Thử lại</button></div>
          : plans.length === 0 ? <div className="training-plans-state" role="status"><BookOpen size={38} /><h3>{completedOnly ? 'Chưa có giáo án đã hoàn thành' : 'Chưa có giáo án tập luyện cá nhân'}</h3><p>{completedOnly ? 'Giáo án sẽ xuất hiện tại đây sau khi được đánh dấu hoàn thành.' : 'Giáo án sẽ xuất hiện tại đây khi huấn luyện viên thiết kế kế hoạch tập luyện cho bạn.'}</p></div>
            : <>
              <div className="training-plans-list-heading"><p className="training-plans-count">{plans.length} giáo án</p><span>Ngày bắt đầu mới nhất trước</span></div>
              <MemberList items={plans} label={completedOnly ? 'Giáo án đã hoàn thành' : 'Giáo án tập luyện'} resetKey={String(completedOnly)} className="training-plans-list" showOrdinal={false} layout="flow" hideSinglePagePagination>{plan => {
                const exercises = Array.isArray(plan.exercises) ? plan.exercises : []
                return <article className="training-plans-card" key={plan.id} aria-labelledby={`training-plan-${plan.id}`}>
                  <header className="training-plans-card-header">
                    <div><p className="training-plans-muted">Giáo án #{plan.id}</p><h3 id={`training-plan-${plan.id}`}>{plan.planName || 'Giáo án tập luyện'}</h3></div>
                    <span className="training-plans-status" data-status={String(plan.status || '').toLowerCase()}>{statusLabel(plan.status)}</span>
                  </header>
                  {plan.hasCompletedBefore && <aside className="training-plan-repeat-notice" role="note"><AlertCircle size={18} /><div><strong>Bạn đã từng hoàn thành giáo án tương tự</strong><p>{plan.repeatNotice || `Giáo án này tương tự giáo án bạn đã tập${plan.previousCompletedPlanId ? ` (#${plan.previousCompletedPlanId})` : ''}. Bạn có thể gửi yêu cầu đổi giáo án cho huấn luyện viên.`}</p></div></aside>}
                  <dl className="training-plans-meta">
                    <div><dt><Target size={14} /> Mục tiêu rèn luyện</dt><dd>{goalLabel(plan.goal)}</dd></div>
                    <div><dt><User size={14} /> Huấn luyện viên</dt><dd>{plan.coachName || 'Chưa cập nhật'}</dd></div>
                    <div className="training-plans-period"><dt><CalendarDays size={14} /> Thời gian áp dụng</dt><dd><span>{formatDate(plan.startDate)}</span><ArrowRight size={12} aria-label="đến" /><span>{formatDate(plan.endDate)}</span></dd></div>
                  </dl>
                  <details className="training-plans-exercises" open>
                    <summary><span><ChevronDown size={14} /> Chi tiết bài tập</span><span>{exercises.length} bài tập</span></summary>
                    <ExerciseTable exercises={exercises} />
                  </details>
                  {!completedOnly && String(plan.status).trim().toLowerCase() === 'active' && <footer className="training-plan-card-actions">
                    <button type="button" disabled={Boolean(action) || !Number.isFinite(Date.parse(plan.startDate)) || Date.parse(plan.startDate) > Date.now()} onClick={() => { setNotice(''); setAction({ type: 'complete', plan }) }}><CheckCircle2 size={16} />Đã tập</button>
                    <button type="button" disabled={Boolean(action)} onClick={() => { setNotice(''); setAction({ type: 'change', plan }) }}><MessageSquare size={16} />Yêu cầu đổi giáo án</button>
                  </footer>}
                </article>
              }}</MemberList>
            </>}
    </section>
    {active && action && <PlanActionDialog action={action} onClose={() => setAction(null)} onSaved={(updated, type) => {
      if (updated) plansRead.setData(current => current.map(plan => String(plan.id) === String(updated.id) ? { ...plan, ...updated } : plan))
      setNotice(type === 'complete' ? 'Đã đánh dấu hoàn thành. Giáo án được chuyển vào lịch sử.' : 'Đã gửi yêu cầu điều chỉnh giáo án cho huấn luyện viên.')
    }} />}
  </div>
}
