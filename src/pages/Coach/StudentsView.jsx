import { useEffect, useState } from 'react'
import { BookOpen, CalendarDays, CheckCircle2, Clock3, PencilLine, Plus, Trash2, UserCheck, UserRound, Users, X } from 'lucide-react'
import { checkInCoachRegistration, getCoachSessionRoster, getMyCoachSessions } from '../../services/coachService'
import { createTrainingPlan, getExerciseCatalog, getMemberTrainingPlans, updateTrainingPlanExerciseResult } from '../../services/trainingPlanService'
import { EmptyState, formatSessionOption, getStudentsError, initials, mapRosterStudent, ViewLoader } from './CoachViewShared'

const toDateInput = date => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const trainingGoals = [
  ['WeightLoss', 'Giảm cân'],
  ['MuscleGain', 'Tăng cơ'],
  ['Endurance', 'Tăng sức bền'],
  ['Flexibility', 'Cải thiện độ dẻo'],
  ['GeneralFitness', 'Thể lực tổng quát'],
]

const planDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const trainingGoalLabel = goal => trainingGoals.find(([value]) => value === goal)?.[1] || goal || 'Chưa xác định'

const newPlanExercise = () => ({ exerciseId: '', sets: '', reps: '', durationInMinutes: '', notes: '' })

function TrainingPlanDialog({ student, onClose, onCreated }) {
  const today = new Date()
  const defaultEndDate = new Date(today)
  defaultEndDate.setDate(defaultEndDate.getDate() + 28)
  const [form, setForm] = useState({
    planName: `Giáo án cho ${student.name}`,
    goal: 'GeneralFitness',
    startDate: toDateInput(today),
    endDate: toDateInput(defaultEndDate),
  })
  const [exercises, setExercises] = useState([])
  const [exerciseCatalog, setExerciseCatalog] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [catalogRequestKey, setCatalogRequestKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setCatalogLoading(true)
    setCatalogError('')
    getExerciseCatalog().then(result => {
      if (active) setExerciseCatalog(result)
    }).catch(requestError => {
      if (active) {
        setExerciseCatalog([])
        setCatalogError(requestError.response?.data?.message || requestError.message || 'Không thể tải kho bài tập.')
      }
    }).finally(() => {
      if (active) setCatalogLoading(false)
    })
    return () => { active = false }
  }, [catalogRequestKey])

  const updateExercise = (index, field, value) => {
    setExercises(current => current.map((exercise, exerciseIndex) => exerciseIndex === index ? { ...exercise, [field]: value } : exercise))
  }

  const handleSubmit = async event => {
    event.preventDefault()
    setError('')
    if (!form.planName.trim() || !form.goal || !form.startDate || !form.endDate) {
      setError('Vui lòng nhập đầy đủ tên, mục tiêu và thời gian giáo án.')
      return
    }
    if (form.endDate < form.startDate) {
      setError('Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.')
      return
    }
    const invalidExercise = exercises.some(exercise => Number(exercise.exerciseId) < 1 || Number(exercise.sets) < 1 || Number(exercise.reps) < 1)
    if (invalidExercise) {
      setError('Mỗi bài tập cần chọn tên bài tập, số hiệp và số lần lớn hơn 0.')
      return
    }

    setSaving(true)
    try {
      const plan = await createTrainingPlan({
        planName: form.planName.trim(),
        goal: form.goal,
        memberId: student.memberId,
        startDate: `${form.startDate}T00:00:00`,
        endDate: `${form.endDate}T23:59:59`,
        exercises: exercises.map(exercise => ({
          exerciseId: Number(exercise.exerciseId),
          sets: Number(exercise.sets),
          reps: Number(exercise.reps),
          durationInMinutes: exercise.durationInMinutes ? Number(exercise.durationInMinutes) : null,
          notes: exercise.notes.trim() || null,
        })),
      })
      onCreated(plan)
      onClose()
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Không thể tạo giáo án.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="coach-plan-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="coach-plan-dialog" role="dialog" aria-modal="true" aria-labelledby="coach-plan-title">
      <header><div><span>TẠO GIÁO ÁN</span><h2 id="coach-plan-title">{student.name}</h2><p>Member #{student.memberId}</p></div><button type="button" aria-label="Đóng tạo giáo án" disabled={saving} onClick={onClose}><X size={19} /></button></header>
      <form onSubmit={handleSubmit}>
        <div className="coach-plan-form-grid"><label><span>Tên giáo án</span><input value={form.planName} maxLength={150} onChange={event => setForm(current => ({ ...current, planName: event.target.value }))} /></label><label><span>Mục tiêu</span><select value={form.goal} onChange={event => setForm(current => ({ ...current, goal: event.target.value }))}>{trainingGoals.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Ngày bắt đầu</span><input type="date" value={form.startDate} onChange={event => setForm(current => ({ ...current, startDate: event.target.value }))} /></label><label><span>Ngày kết thúc</span><input type="date" min={form.startDate} value={form.endDate} onChange={event => setForm(current => ({ ...current, endDate: event.target.value }))} /></label></div>
        <div className="coach-plan-exercises">
          <div className="coach-plan-exercises-head"><div><strong>Bài tập</strong><span>Không bắt buộc · chọn bài tập theo tên từ kho hiện có</span></div><button type="button" disabled={catalogLoading || !exerciseCatalog.length} onClick={() => setExercises(current => [...current, newPlanExercise()])}><Plus size={15} />Thêm bài tập</button></div>
          {catalogLoading ? <div className="coach-exercise-catalog-state">Đang tải kho bài tập...</div> : catalogError ? <div className="coach-exercise-catalog-state error"><span>{catalogError}</span><button type="button" onClick={() => setCatalogRequestKey(key => key + 1)}>Thử lại</button></div> : !exerciseCatalog.length ? <div className="coach-exercise-catalog-state">Kho bài tập chưa có dữ liệu.</div> : null}
          {exercises.length ? exercises.map((exercise, index) => <article key={index}><div className="coach-plan-exercise-title"><strong>Bài tập {index + 1}</strong><button type="button" aria-label={`Xóa bài tập ${index + 1}`} onClick={() => setExercises(current => current.filter((_, exerciseIndex) => exerciseIndex !== index))}><Trash2 size={15} /></button></div><div><label className="exercise-picker"><span>Tên bài tập</span><select value={exercise.exerciseId} onChange={event => updateExercise(index, 'exerciseId', event.target.value)} required><option value="">Chọn bài tập</option>{exerciseCatalog.map(option => <option value={option.id} key={option.id}>{option.exerciseName}{option.muscleGroup ? ` · ${option.muscleGroup}` : ''}</option>)}</select></label><label><span>Số hiệp</span><input type="number" min="1" value={exercise.sets} onChange={event => updateExercise(index, 'sets', event.target.value)} required /></label><label><span>Số lần</span><input type="number" min="1" value={exercise.reps} onChange={event => updateExercise(index, 'reps', event.target.value)} required /></label><label><span>Thời lượng (phút)</span><input type="number" min="1" value={exercise.durationInMinutes} onChange={event => updateExercise(index, 'durationInMinutes', event.target.value)} /></label><label className="wide"><span>Ghi chú</span><input value={exercise.notes} maxLength={500} onChange={event => updateExercise(index, 'notes', event.target.value)} /></label></div></article>) : !catalogLoading && !catalogError && exerciseCatalog.length ? <p className="coach-plan-exercises-empty">Nhấn “Thêm bài tập” để chọn bài tập theo tên từ kho.</p> : null}
        </div>
        {error && <div className="coach-plan-form-error" role="alert">{error}</div>}
        <footer><button type="button" disabled={saving} onClick={onClose}>Hủy</button><button type="submit" disabled={saving}>{saving ? 'Đang tạo...' : 'Tạo giáo án'}</button></footer>
      </form>
    </section>
  </div>
}

function TrainingPlanListDialog({ student, onClose }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)
  const [editingExerciseId, setEditingExerciseId] = useState(null)
  const [resultDraft, setResultDraft] = useState('')
  const [savingExerciseId, setSavingExerciseId] = useState(null)
  const [exerciseError, setExerciseError] = useState('')
  const [updatedExerciseId, setUpdatedExerciseId] = useState(null)

  useEffect(() => {
    let active = true
    const loadPlans = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getMemberTrainingPlans(student.memberId)
        if (active) setPlans(result)
      } catch (requestError) {
        if (active) {
          setPlans([])
          setError(requestError.response?.data?.message || requestError.message || 'Không thể tải giáo án của học viên.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadPlans()
    return () => { active = false }
  }, [requestKey, student.memberId])

  const editExerciseResult = exercise => {
    setEditingExerciseId(exercise.id)
    setResultDraft(exercise.notes || '')
    setExerciseError('')
    setUpdatedExerciseId(null)
  }

  const cancelExerciseResult = () => {
    setEditingExerciseId(null)
    setResultDraft('')
    setExerciseError('')
  }

  const saveExerciseResult = async (event, exerciseId) => {
    event.preventDefault()
    const notes = resultDraft.trim()
    if (!notes) {
      setExerciseError('Vui lòng nhập kết quả hoặc ghi chú thực hiện.')
      return
    }

    setSavingExerciseId(exerciseId)
    setExerciseError('')
    try {
      await updateTrainingPlanExerciseResult(exerciseId, notes)
      setPlans(currentPlans => currentPlans.map(plan => ({
        ...plan,
        exercises: Array.isArray(plan.exercises)
          ? plan.exercises.map(exercise => exercise.id === exerciseId ? { ...exercise, notes } : exercise)
          : [],
      })))
      setEditingExerciseId(null)
      setResultDraft('')
      setUpdatedExerciseId(exerciseId)
    } catch (requestError) {
      setExerciseError(requestError.response?.data?.message || requestError.message || 'Không thể cập nhật kết quả bài tập.')
    } finally {
      setSavingExerciseId(null)
    }
  }

  return <div className="coach-plan-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="coach-plan-dialog coach-plan-list-dialog" role="dialog" aria-modal="true" aria-labelledby="coach-plan-list-title">
      <header><div><span>GIÁO ÁN HỌC VIÊN</span><h2 id="coach-plan-list-title">{student.name}</h2><p>Member #{student.memberId} · {plans.length} giáo án</p></div><button type="button" aria-label="Đóng danh sách giáo án" onClick={onClose}><X size={19} /></button></header>
      <div className="coach-plan-list-body">
        {loading ? <div className="coach-plan-list-state"><BookOpen size={26} /><strong>Đang tải giáo án</strong><span>Dữ liệu giáo án đang được đồng bộ từ hệ thống.</span></div> : error ? <div className="coach-plan-list-state error"><BookOpen size={26} /><strong>Không thể tải giáo án</strong><span>{error}</span><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : plans.length ? <div className="coach-member-plan-list">
          {plans.map(plan => <article className="coach-member-plan" key={plan.id}>
            <header><div><span>{trainingGoalLabel(plan.goal)}</span><h3>{plan.planName}</h3></div><b className={String(plan.status || '').toLowerCase()}>{plan.status || 'Chưa xác định'}</b></header>
            <div className="coach-member-plan-meta"><span><CalendarDays size={14} /><span><small>Bắt đầu</small><strong>{planDateFormatter.format(new Date(plan.startDate))}</strong></span></span><span><CalendarDays size={14} /><span><small>Kết thúc</small><strong>{planDateFormatter.format(new Date(plan.endDate))}</strong></span></span></div>
            {Array.isArray(plan.exercises) && plan.exercises.length ? <div className="coach-member-plan-exercises">
              {plan.exercises.map(exercise => <div key={exercise.id}>
                <div className="coach-member-exercise-head"><span><strong>{exercise.exerciseName}</strong><small>{exercise.sets} hiệp × {exercise.reps} lần{exercise.durationInMinutes ? ` · ${exercise.durationInMinutes} phút` : ''}</small></span><button type="button" onClick={() => editExerciseResult(exercise)} disabled={savingExerciseId !== null}><PencilLine size={13} />{exercise.notes ? 'Sửa kết quả' : 'Cập nhật kết quả'}</button></div>
                {editingExerciseId === exercise.id ? <form className="coach-exercise-result-form" onSubmit={event => saveExerciseResult(event, exercise.id)}><label htmlFor={`coach-exercise-result-${exercise.id}`}>Kết quả / ghi chú thực hiện</label><textarea id={`coach-exercise-result-${exercise.id}`} rows="3" value={resultDraft} onChange={event => setResultDraft(event.target.value)} placeholder="Ví dụ: Hoàn thành đủ 3 hiệp, kỹ thuật ổn định..." disabled={savingExerciseId === exercise.id} autoFocus />{exerciseError && <p role="alert">{exerciseError}</p>}<footer><button type="button" onClick={cancelExerciseResult} disabled={savingExerciseId === exercise.id}>Hủy</button><button type="submit" disabled={savingExerciseId === exercise.id}>{savingExerciseId === exercise.id ? 'Đang lưu...' : 'Lưu kết quả'}</button></footer></form> : <p className={exercise.notes ? '' : 'coach-exercise-result-empty'}>{exercise.notes || 'Chưa cập nhật kết quả thực hiện.'}</p>}
                {updatedExerciseId === exercise.id && editingExerciseId !== exercise.id && <span className="coach-exercise-result-saved"><CheckCircle2 size={12} />Đã lưu kết quả</span>}
              </div>)}
            </div> : <p className="coach-member-plan-empty">Giáo án chưa có bài tập.</p>}
          </article>)}
        </div> : <div className="coach-plan-list-state"><BookOpen size={26} /><strong>Chưa có giáo án</strong><span>Học viên này chưa được tạo giáo án tập luyện.</span></div>}
      </div>
    </section>
  </div>
}

export function StudentsView({ query, showNotice }) {
  const [status, setStatus] = useState('Tất cả')
  const [sessions, setSessions] = useState([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [students, setStudents] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [rosterLoading, setRosterLoading] = useState(false)
  const [error, setError] = useState('')
  const [planStudent, setPlanStudent] = useState(null)
  const [plansStudent, setPlansStudent] = useState(null)
  const [checkingInRegistrationId, setCheckingInRegistrationId] = useState(null)
  const [checkInError, setCheckInError] = useState('')
  const [requestKey, setRequestKey] = useState(0)

  useEffect(() => {
    let active = true
    const loadSessions = async () => {
      setSessionsLoading(true)
      setError('')
      try {
        const result = await getMyCoachSessions({ pageSize: 100 })
        if (!active) return
        setSessions(result.items)
        setSelectedSessionId(current => {
          if (current && result.items.some(session => String(session.id) === String(current))) return current
          const upcoming = result.items.find(session => new Date(session.endsAt) >= new Date())
          return String(upcoming?.id ?? result.items[0]?.id ?? '')
        })
      } catch (requestError) {
        if (active) {
          setSessions([])
          setSelectedSessionId('')
          setError(getStudentsError(requestError))
        }
      } finally {
        if (active) setSessionsLoading(false)
      }
    }
    loadSessions()
    return () => { active = false }
  }, [requestKey])

  useEffect(() => {
    let active = true
    if (!selectedSessionId) {
      setStudents([])
      setSelectedId(null)
      setRosterLoading(false)
      return () => { active = false }
    }

    const loadRoster = async () => {
      setRosterLoading(true)
      setError('')
      try {
        const result = await getCoachSessionRoster(selectedSessionId)
        if (!active) return
        const mapped = result.map(mapRosterStudent)
        setStudents(mapped)
        setSelectedId(current => mapped.some(student => student.id === current) ? current : mapped[0]?.id ?? null)
      } catch (requestError) {
        if (active) {
          setStudents([])
          setSelectedId(null)
          setError(getStudentsError(requestError))
        }
      } finally {
        if (active) setRosterLoading(false)
      }
    }
    loadRoster()
    return () => { active = false }
  }, [requestKey, selectedSessionId])

  const normalizedQuery = query.trim().toLocaleLowerCase('vi')
  const filtered = students.filter(student => {
    const matchesStatus = status === 'Tất cả' || student.attendanceStatus === status
    const matchesQuery = !normalizedQuery || `${student.name} ${student.memberId} ${student.registrationStatus} ${student.attendanceStatus}`.toLocaleLowerCase('vi').includes(normalizedQuery)
    return matchesStatus && matchesQuery
  })
  const selected = students.find(student => student.id === selectedId)
  const selectedSession = sessions.find(session => String(session.id) === String(selectedSessionId))
  const checkedInCount = students.filter(student => ['Đã điểm danh', 'Đi trễ'].includes(student.attendanceStatus)).length
  const absentCount = students.filter(student => student.attendanceStatus === 'Vắng mặt').length

  const handleCheckIn = async student => {
    if (!student || checkingInRegistrationId !== null || student.attendanceTone !== 'pending') return
    setCheckingInRegistrationId(student.registrationId)
    setCheckInError('')
    try {
      const attendance = await checkInCoachRegistration(student.registrationId)
      const updatedStudent = mapRosterStudent({
        registrationId: student.registrationId,
        memberId: student.memberId,
        fullName: student.name,
        registrationStatus: student.registrationStatus,
        attendanceStatus: attendance.status,
        checkInTime: attendance.checkInTime,
      })
      setStudents(current => current.map(item => item.id === student.id ? updatedStudent : item))
      showNotice?.(`Đã check-in ${student.name}.`)
    } catch (requestError) {
      setCheckInError(getStudentsError(requestError))
    } finally {
      setCheckingInRegistrationId(null)
    }
  }

  if (sessionsLoading || rosterLoading) return <ViewLoader />
  if (!sessions.length) return <section className="coach-card coach-roster-state"><EmptyState title={error ? 'Không thể tải buổi huấn luyện' : 'Chưa có buổi huấn luyện'} text={error || 'Huấn luyện viên chưa được phân công buổi học nào, nên chưa có danh sách học viên để hiển thị.'} />{error && <button className="coach-retry-button" type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button>}</section>

  return <div className="coach-section-view">
    <section className="coach-card coach-session-picker">
      <div className="coach-session-picker-main"><span><CalendarDays size={21} /></span><div><small>BUỔI ĐANG XEM</small><strong>{selectedSession?.className || 'Buổi huấn luyện'}</strong><p>{selectedSession ? formatSessionOption(selectedSession) : 'Chọn một buổi để xem học viên'}</p></div></div>
      <label><span>Chọn buổi huấn luyện</span><select value={selectedSessionId} onChange={event => { setSelectedSessionId(event.target.value); setStatus('Tất cả') }}>{sessions.map(session => <option key={session.id} value={session.id}>{formatSessionOption(session)}</option>)}</select></label>
    </section>

    <section className="coach-student-kpis">
      <article><span className="blue"><Users size={21} /></span><div><small>Học viên trong buổi</small><strong>{students.length}</strong><p>Dữ liệu trực tiếp từ roster</p></div></article>
      <article><span className="green"><UserCheck size={21} /></span><div><small>Đã điểm danh</small><strong>{checkedInCount}</strong><p>Bao gồm đúng giờ và đi trễ</p></div></article>
      <article><span className="purple"><UserRound size={21} /></span><div><small>Vắng mặt</small><strong>{absentCount}</strong><p>Theo trạng thái chuyên cần</p></div></article>
    </section>

    <div className="coach-student-layout">
      <section className="coach-card coach-roster">
        <div className="coach-view-toolbar"><div><strong>Danh sách học viên theo buổi</strong><span>{rosterLoading ? 'Đang tải roster...' : `${filtered.length} kết quả`}</span></div><div className="coach-filter-pills">{['Tất cả', 'Đã điểm danh', 'Chưa điểm danh', 'Vắng mặt'].map(label => <button type="button" key={label} className={status === label ? 'active' : ''} onClick={() => setStatus(label)}>{label}</button>)}</div></div>
        {rosterLoading ? <EmptyState title="Đang tải học viên" text="Danh sách đăng ký của buổi học đang được đồng bộ." /> : error ? <div className="coach-inline-error"><EmptyState title="Không thể tải học viên" text={error} /><button className="coach-retry-button" type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : filtered.length ? <div className="coach-roster-table"><div className="coach-roster-heading"><span>Học viên</span><span>Đăng ký</span><span>Điểm danh</span><span>Giờ check-in</span></div>{filtered.map(student => <button type="button" className={selected?.id === student.id ? 'selected' : ''} key={student.id} onClick={() => setSelectedId(student.id)}>
          <span className="coach-roster-person"><i className="coach-student-avatar blue">{initials(student.name)}</i><span><strong>{student.name}</strong><small>Member #{student.memberId}</small></span></span>
          <span><strong>{student.registrationStatus}</strong><small>Đăng ký #{student.registrationId}</small></span>
          <span><strong className={`coach-attendance ${student.attendanceTone}`}>{student.attendanceStatus}</strong><small>{student.attendanceTone === 'pending' ? 'Chưa có dữ liệu điểm danh' : 'Đã cập nhật trên hệ thống'}</small></span>
          <span><strong>{student.checkInTime}</strong><small>Thời gian ghi nhận</small></span>
        </button>)}</div> : <EmptyState title="Chưa có học viên" text={query || status !== 'Tất cả' ? 'Không có học viên phù hợp với bộ lọc hiện tại.' : 'Buổi huấn luyện này chưa có hội viên đăng ký.'} />}
      </section>

      <aside className="coach-card coach-student-profile">
        {selected ? <><div className="coach-profile-cover"><span className="coach-student-avatar blue">{initials(selected.name)}</span></div><div className="coach-profile-main"><h2>{selected.name}</h2><p>{selectedSession?.className || 'Buổi huấn luyện'}</p><span className={`coach-profile-state ${selected.attendanceTone}`}><i />{selected.attendanceStatus}</span><div className="coach-profile-numbers"><div><strong>#{selected.memberId}</strong><small>Mã hội viên</small></div><div><strong>#{selected.registrationId}</strong><small>Mã đăng ký</small></div><div><strong>{selected.registrationStatus}</strong><small>Trạng thái</small></div></div><div className="coach-profile-info"><span><Clock3 size={16} /><span><small>Thời gian check-in</small><strong>{selected.checkInTime}</strong></span></span><span><CalendarDays size={16} /><span><small>Buổi huấn luyện</small><strong>{selectedSession ? formatSessionOption(selectedSession) : 'Chưa xác định'}</strong></span></span></div>{checkInError && <p className="coach-profile-action-error" role="alert">{checkInError}</p>}<div className="coach-profile-actions"><button type="button" disabled={selected.attendanceTone !== 'pending' || checkingInRegistrationId !== null} onClick={() => handleCheckIn(selected)}><UserCheck size={15} />{checkingInRegistrationId === selected.registrationId ? 'Đang check-in...' : selected.attendanceTone === 'pending' ? 'Check-in học viên' : 'Đã check-in'}</button><button type="button" onClick={() => setPlanStudent(selected)}><Plus size={15} />Tạo giáo án</button><button type="button" onClick={() => setPlansStudent(selected)}><BookOpen size={15} />Xem giáo án</button></div></div></> : <EmptyState title="Chưa chọn học viên" text={students.length ? 'Chọn một học viên trong danh sách để xem chi tiết.' : 'Buổi huấn luyện này chưa có hội viên đăng ký.'} />}
      </aside>
    </div>
    {planStudent && <TrainingPlanDialog student={planStudent} onClose={() => setPlanStudent(null)} onCreated={plan => showNotice?.(`Đã tạo giáo án “${plan.planName}” cho ${planStudent.name}.`)} />}
    {plansStudent && <TrainingPlanListDialog student={plansStudent} onClose={() => setPlansStudent(null)} />}
  </div>
}

