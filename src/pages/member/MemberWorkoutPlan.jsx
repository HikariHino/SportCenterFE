import { MemberList } from './MemberPagination'
import { AI_WORKOUT_LEVELS } from '../../services/memberAiService'

export default function MemberWorkoutPlan({ plan }) {
  const value = number => number == null ? '—' : number
  return <div className="member-ai-workout-plan">
    <p className="member-ai-plan-goal"><strong>{plan.goal}</strong> · {AI_WORKOUT_LEVELS.find(item => item.value === plan.level)?.label || plan.level} · {plan.daysPerWeek} ngày / tuần</p>
    {plan.sessions.map((session, index) => <section className="member-ai-plan-session" key={index}>
      <h4>Buổi {session.day}: {session.title}</h4>{session.durationMinutes && <p>{session.durationMinutes} phút</p>}
      {session.exercises.length ? <div className="member-ai-answer-table" role="region" aria-label={`Bài tập buổi ${session.day}`} tabIndex={0}><MemberList items={session.exercises} label={`Bài tập buổi ${session.day}`} table compact heading={<tr><th scope="col">STT</th><th>Bài tập</th><th>Hiệp</th><th>Số lần</th><th>Nghỉ (giây)</th><th>Ghi chú</th></tr>}>{(exercise, exerciseIndex) => <tr key={exerciseIndex}><td>{exercise.exerciseName}</td><td>{value(exercise.sets)}</td><td>{value(exercise.reps)}</td><td>{value(exercise.restSeconds)}</td><td>{exercise.note || '—'}</td></tr>}</MemberList></div> : <p>Chưa có bài tập trong buổi này.</p>}
    </section>)}
    {plan.warnings.length > 0 && <aside className="member-ai-plan-warnings" aria-label="Lưu ý của AI"><h4>Lưu ý</h4><ul>{plan.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></aside>}
  </div>
}
