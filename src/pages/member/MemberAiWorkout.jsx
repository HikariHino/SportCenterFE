import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowUpRight, CalendarDays, CheckCircle2, Dumbbell, LoaderCircle, RotateCcw, Sparkles, Square, Target, Trash2 } from 'lucide-react'
import { AI_WORKOUT_GOAL_MAX_LENGTH, AI_WORKOUT_LEVELS, deleteMemberAiWorkoutHistory, getMemberAiWorkoutHistory, getMemberAiWorkoutHistoryDetail, getMemberAiErrorMessage, getMemberWorkoutErrors, getMemberWorkoutRecommendation } from '../../services/memberAiService'
import MemberAiAnswer from './MemberAiAnswer'
import MemberWorkoutPlan from './MemberWorkoutPlan'
import useMemberAiHistory from '../../hooks/useMemberAiHistory'
import { memberAiHistoryDate } from '../../utils/memberAiHistory'
import { AiDeleteConfirmation, AiHistoryControls } from './MemberAiHistoryControls'
import '../../style/member/MemberAiChat.css'
import '../../style/member/MemberAiWorkout.css'

const goals = ['Tăng cơ', 'Giảm mỡ', 'Tăng sức bền', 'Duy trì sức khỏe']
const initialForm = { goal: '', level: 'Beginner', daysPerWeek: 3 }

export default function MemberAiWorkout({ active, onNavigate }) {
  const [form, setForm] = useState(initialForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [retryRequest, setRetryRequest] = useState(null)
  const [reading, setReading] = useState(null)
  const [historyError, setHistoryError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const deleteLock = useRef(false)
  const mounted = useRef(false)
  const history = useMemberAiHistory(getMemberAiWorkoutHistory, active)
  const requestRef = useRef(null)
  const formRef = useRef(null)
  const resultRef = useRef(null)
  const activeRef = useRef(active)
  activeRef.current = active

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      const request = requestRef.current
      requestRef.current = null
      request?.controller.abort()
    }
  }, [])

  useEffect(() => {
    if (result && activeRef.current) {
      const heading = resultRef.current
      const config = formRef.current?.closest('.member-workout-config')
      heading?.focus({ preventScroll: true })
      if (config && heading && heading.getBoundingClientRect().top >= config.getBoundingClientRect().bottom) heading.scrollIntoView({ block: 'start' })
    }
  }, [result])

  const updateForm = (field, value) => {
    setForm(previous => ({ ...previous, [field]: value }))
    setFieldErrors(previous => ({ ...previous, [field]: undefined }))
  }

  const generate = async values => {
    if (requestRef.current || deleteLock.current || deleteTarget) return
    const errors = getMemberWorkoutErrors(values)
    setFieldErrors(errors)
    if (Object.keys(errors).length) {
      formRef.current?.elements.namedItem(Object.keys(errors)[0])?.focus()
      return
    }
    const snapshot = { goal: values.goal.trim(), level: values.level, daysPerWeek: Number(values.daysPerWeek) }
    const request = { controller: new AbortController() }
    requestRef.current = request
    setSending(true)
    setError('')
    setNotice('')
    setRetryRequest(null)
    try {
      const recommendation = await getMemberWorkoutRecommendation(snapshot, { signal: request.controller.signal })
      if (requestRef.current !== request) return
      setResult({ ...(typeof recommendation === 'string' ? { answer: recommendation } : { plan: recommendation }), request: snapshot })
      history.latest()
    } catch (failure) {
      if (requestRef.current !== request) return
      if (request.controller.signal.aborted) setNotice('Đã dừng tạo gợi ý. Bạn có thể điều chỉnh thông tin rồi thử lại.')
      else {
        setError(getMemberAiErrorMessage(failure))
        setRetryRequest(snapshot)
      }
    } finally {
      if (requestRef.current === request) {
        requestRef.current = null
        setSending(false)
      }
    }
  }

  const viewHistory = async item => {
    if (requestRef.current || deleteLock.current) return
    const request = { controller: new AbortController() }
    requestRef.current = request
    setReading(item.id)
    setHistoryError('')
    try {
      const detail = await getMemberAiWorkoutHistoryDetail(item.id, { signal: request.controller.signal })
      if (requestRef.current !== request) return
      const snapshot = { goal: detail.plan.goal, level: detail.plan.level, daysPerWeek: detail.plan.daysPerWeek }
      setForm(snapshot)
      setFieldErrors({})
      setError('')
      setNotice('')
      setResult({ plan: detail.plan, request: snapshot, historyId: detail.id, createdAt: detail.createdAt })
    } catch (failure) {
      if (requestRef.current === request) setHistoryError(getMemberAiErrorMessage(failure))
    } finally {
      if (requestRef.current === request) { requestRef.current = null; setReading(null) }
    }
  }

  const deleteHistory = async () => {
    if (!deleteTarget || deleteLock.current || requestRef.current) return
    const id = deleteTarget.id
    deleteLock.current = true
    history.cancel()
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteMemberAiWorkoutHistory(id)
      if (!mounted.current) return
      history.remove(id)
      setResult(previous => String(previous?.historyId) === String(id) ? null : previous)
      setDeleteTarget(null)
      setNotice('Đã xóa bản gợi ý khỏi lịch sử.')
    } catch (failure) {
      if (mounted.current) setDeleteError(getMemberAiErrorMessage(failure))
    } finally {
      deleteLock.current = false
      if (mounted.current) setDeleting(false)
    }
  }

  const resultChanged = result && (form.goal.trim() !== result.request.goal || form.level !== result.request.level || Number(form.daysPerWeek) !== result.request.daysPerWeek)
  const errorFor = field => fieldErrors[field] && <p id={`member-workout-${field}-error`} className="member-workout-field-error" role="alert">{fieldErrors[field]}</p>

  return (
    <div className="member-ai member-workout">
      <div className="member-ai-heading">
        <div><h2>Gợi ý bài tập AI</h2><p className="member-muted">Lên lịch tập mẫu theo mục tiêu và khả năng của bạn.</p></div>
        <span className="member-ai-heading-tag"><Sparkles size={13} /> Dành cho hội viên</span>
      </div>

      <div className="member-workout-layout">
        <section className="member-workout-config" aria-labelledby="member-workout-form-title">
          <header className="member-workout-panel-heading"><span className="member-ai-avatar"><Target size={18} /></span><div><h3 id="member-workout-form-title">Thiết lập buổi tập</h3><p>Chọn thông tin phù hợp với bạn</p></div></header>
          <form ref={formRef} noValidate onSubmit={event => { event.preventDefault(); generate(form) }} aria-busy={sending}>
            <fieldset disabled={sending || reading !== null || deleting}>
              <div className="member-workout-goal-field">
              <label htmlFor="member-workout-goal">Mục tiêu tập luyện <span>*</span></label>
              <textarea id="member-workout-goal" name="goal" rows={2} maxLength={AI_WORKOUT_GOAL_MAX_LENGTH} required value={form.goal} onChange={event => updateForm('goal', event.target.value)} placeholder="Ví dụ: Tăng cơ, cải thiện thể lực..." aria-invalid={Boolean(fieldErrors.goal)} aria-describedby={`member-workout-goal-hint${fieldErrors.goal ? ' member-workout-goal-error' : ''}`} />
              <div id="member-workout-goal-hint" className="member-workout-field-hint"><span>Tối đa 200 ký tự</span><span>{form.goal.length}/{AI_WORKOUT_GOAL_MAX_LENGTH}</span></div>
              {errorFor('goal')}
              <div className="member-workout-goals" aria-label="Mục tiêu gợi ý">{goals.map(goal => <button type="button" key={goal} aria-pressed={form.goal === goal} onClick={() => updateForm('goal', goal)}>{goal}</button>)}</div>
              </div>

              <div className="member-workout-select-field">
              <label htmlFor="member-workout-level">Trình độ hiện tại</label>
              <select id="member-workout-level" name="level" value={form.level} onChange={event => updateForm('level', event.target.value)} aria-invalid={Boolean(fieldErrors.level)} aria-describedby={fieldErrors.level ? 'member-workout-level-error' : undefined}>
                {AI_WORKOUT_LEVELS.map(level => <option key={level.value} value={level.value}>{level.label}</option>)}
              </select>
              {errorFor('level')}
              </div>

              <div className="member-workout-select-field">
              <label htmlFor="member-workout-days">Số ngày tập mỗi tuần</label>
              <select id="member-workout-days" name="daysPerWeek" value={form.daysPerWeek} onChange={event => updateForm('daysPerWeek', Number(event.target.value))} aria-invalid={Boolean(fieldErrors.daysPerWeek)} aria-describedby={fieldErrors.daysPerWeek ? 'member-workout-daysPerWeek-error' : undefined}>
                {Array.from({ length: 7 }, (_, index) => index + 1).map(days => <option key={days} value={days}>{days} ngày / tuần</option>)}
              </select>
              {errorFor('daysPerWeek')}
              </div>
              <button type="submit" className="member-button member-button--primary member-workout-submit">{sending ? <><LoaderCircle size={16} className="member-spin" /> Đang tạo gợi ý...</> : <><Sparkles size={16} /> Tạo gợi ý bài tập</>}</button>
            </fieldset>
            {sending && <button type="button" className="member-workout-stop" onClick={() => requestRef.current?.controller.abort()}><Square size={13} /> Dừng chờ</button>}
          </form>
          <p className="member-workout-note">AI tham khảo mục tiêu, giáo án và điểm danh của bạn để gợi ý lịch tập. Hãy trao đổi với HLV trước khi áp dụng.</p>
        </section>

        <section className="member-workout-result" aria-labelledby="member-workout-result-title" aria-busy={sending || reading !== null}>
          <header className="member-workout-panel-heading"><span className="member-ai-avatar"><Dumbbell size={18} /></span><div><h3 id="member-workout-result-title" tabIndex={-1} ref={resultRef}>Lịch tập gợi ý</h3><p>Tham khảo để xây dựng thói quen phù hợp</p></div></header>
          {error && <div className="member-workout-message member-workout-message--error" role="alert"><AlertCircle size={17} /><div><p>{error}</p><button type="button" className="member-button" disabled={sending || reading !== null || deleting} onClick={() => generate(retryRequest)}><RotateCcw size={14} /> Thử lại yêu cầu vừa rồi</button></div></div>}
          {notice && <p className="member-workout-message" role="status">{notice}</p>}
          <div className="member-workout-result-content">
            {reading !== null ? <div className="member-workout-empty" role="status"><LoaderCircle size={30} className="member-spin" /><p>Đang tải bản gợi ý đã lưu...</p></div>
              : sending ? <div className="member-workout-empty" role="status"><LoaderCircle size={30} className="member-spin" /><h3>Đang xây dựng gợi ý cho bạn</h3><p>AI đang xem mục tiêu, trình độ và số ngày tập đã chọn.</p></div>
              : result ? <>
                <div className="member-workout-summary" aria-label="Thông tin đã dùng để tạo gợi ý"><span><Target size={13} /> {result.request.goal}</span><span>{AI_WORKOUT_LEVELS.find(item => item.value === result.request.level)?.label}</span><span><CalendarDays size={13} /> {result.request.daysPerWeek} ngày / tuần</span></div>
                {resultChanged && <p className="member-workout-changed"><AlertCircle size={14} /> Thông tin đã thay đổi. Tạo gợi ý mới để cập nhật kết quả bên dưới.</p>}
                {result.createdAt && <p className="member-ai-history-status">Bản gợi ý #{result.historyId} · {memberAiHistoryDate(result.createdAt)}</p>}
                {result.plan ? <MemberWorkoutPlan plan={result.plan} /> : <MemberAiAnswer answer={result.answer} />}
                <p className="member-workout-result-note"><CheckCircle2 size={15} /> Đây là gợi ý tham khảo. Giáo án chính thức được quản lý trong Lộ trình tập luyện.</p>
              </> : <div className="member-workout-empty"><span className="member-workout-empty-icon"><Dumbbell size={30} /></span><h3>Bắt đầu từ mục tiêu của bạn</h3><p>Thiết lập thông tin rồi tạo gợi ý để xem lịch tập mẫu, bài tập, số hiệp và thời gian nghỉ.</p><div className="member-workout-empty-tags"><span>Mục tiêu cá nhân</span><span>Lịch tập trong tuần</span><span>Hiệp & số lần</span></div></div>}
          </div>
          <footer className="member-workout-footer"><button type="button" onClick={() => onNavigate('training-plans')}>Xem lộ trình tập luyện <ArrowUpRight size={14} /></button><button type="button" onClick={() => onNavigate('ai-chat')}>Hỏi trợ lý AI <ArrowUpRight size={14} /></button></footer>
        </section>
      </div>
      <section className="member-ai-history-panel" aria-labelledby="member-workout-history-title" aria-busy={history.loading}>
        <header><div><h3 id="member-workout-history-title">Lịch sử gợi ý bài tập</h3><p>Các bản đã lưu trong tài khoản, mới nhất trước.</p></div></header>
        <AiHistoryControls history={history} disabled={sending || reading !== null || deleting} label="lịch sử gợi ý bài tập" />
        {history.loading && <p className="member-ai-history-status" role="status"><LoaderCircle size={15} className="member-spin" />Đang tải lịch sử gợi ý...</p>}
        {(history.error || historyError) && <p className="member-ai-history-error" role="alert">{history.error || historyError}</p>}
        {!history.loading && !history.error && history.data?.total === 0 && <p className="member-ai-history-status">Bạn chưa có bản gợi ý bài tập nào được lưu.</p>}
        <ul className="member-ai-history-list">{history.data?.items.map(item => <li key={item.id}>
          <div><strong>{item.goal || 'Gợi ý bài tập'}</strong><p>{AI_WORKOUT_LEVELS.find(level => level.value === item.level)?.label} · {item.daysPerWeek} ngày / tuần</p><time>{memberAiHistoryDate(item.createdAt)}</time></div>
          <div className="member-ai-history-actions"><button type="button" disabled={sending || reading !== null || deleting || history.loading} onClick={() => viewHistory(item)}>{String(reading) === String(item.id) ? 'Đang tải...' : 'Xem lại'}</button><button type="button" className="danger" disabled={sending || reading !== null || deleting || history.loading} onClick={() => { setDeleteError(''); setDeleteTarget(item) }} aria-label={`Xóa bản gợi ý #${item.id}`}><Trash2 size={14} />Xóa</button></div>
        </li>)}</ul>
      </section>
      {deleteTarget && <AiDeleteConfirmation title="Xóa bản gợi ý bài tập?" busy={deleting} error={deleteError} onClose={() => setDeleteTarget(null)} onConfirm={deleteHistory}><p>Bản gợi ý “{deleteTarget.goal}” tạo lúc {memberAiHistoryDate(deleteTarget.createdAt)} sẽ bị xóa khỏi lịch sử. Giáo án chính thức của bạn vẫn được giữ nguyên.</p></AiDeleteConfirmation>}
    </div>
  )
}
