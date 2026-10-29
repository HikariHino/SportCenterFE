const allowedLevels = new Set(['Beginner', 'Intermediate', 'Advanced'])

export function buildWorkoutRecommendationPayload({ memberId, goal, level, daysPerWeek }) {
  const normalizedMemberId = Number(memberId)
  const normalizedGoal = String(goal || '').trim()
  const normalizedDays = Number(daysPerWeek)

  if (!Number.isSafeInteger(normalizedMemberId) || normalizedMemberId < 1) {
    throw new Error('Không xác định được học viên để tạo gợi ý AI.')
  }
  if (!normalizedGoal || normalizedGoal.length > 200) {
    throw new Error('Mục tiêu tập luyện phải có từ 1 đến 200 ký tự.')
  }
  if (!allowedLevels.has(level)) {
    throw new Error('Trình độ tập luyện không hợp lệ.')
  }
  if (!Number.isSafeInteger(normalizedDays) || normalizedDays < 1 || normalizedDays > 7) {
    throw new Error('Số ngày tập mỗi tuần phải từ 1 đến 7.')
  }

  return {
    memberId: normalizedMemberId,
    goal: normalizedGoal,
    level,
    daysPerWeek: normalizedDays,
  }
}

const positiveIntegerOrNull = value => {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

export function extractWorkoutRecommendation(body) {
  if (body?.success === false) {
    throw new Error(body.message || 'AI chưa thể tạo gợi ý tập luyện.')
  }

  const payload = body?.data ?? body
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.sessions)) {
    throw new Error('Máy chủ không trả về kế hoạch tập luyện đúng định dạng.')
  }

  const sessions = payload.sessions.map((session, sessionIndex) => ({
    day: positiveIntegerOrNull(session?.day) || sessionIndex + 1,
    title: String(session?.title || `Buổi tập ${sessionIndex + 1}`).trim(),
    durationMinutes: positiveIntegerOrNull(session?.durationMinutes),
    exercises: Array.isArray(session?.exercises) ? session.exercises
      .map(exercise => ({
        exerciseName: String(exercise?.exerciseName || '').trim(),
        sets: positiveIntegerOrNull(exercise?.sets),
        reps: positiveIntegerOrNull(exercise?.reps),
        restSeconds: positiveIntegerOrNull(exercise?.restSeconds),
        note: String(exercise?.note || '').trim(),
      }))
      .filter(exercise => exercise.exerciseName) : [],
  }))

  if (!sessions.length) {
    throw new Error('AI chưa trả về buổi tập nào. Vui lòng thử lại.')
  }

  return {
    goal: String(payload.goal || 'Chưa xác định').trim(),
    level: String(payload.level || 'Beginner').trim(),
    daysPerWeek: positiveIntegerOrNull(payload.daysPerWeek) || sessions.length,
    sessions,
    warnings: Array.isArray(payload.warnings)
      ? payload.warnings.map(warning => String(warning || '').trim()).filter(Boolean)
      : [],
  }
}

const normalizedExerciseName = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

const baseExerciseName = value => normalizedExerciseName(String(value || '').replace(/\([^)]*\)/g, ' '))

const findCatalogExercise = (exerciseName, catalog) => {
  const requestedName = normalizedExerciseName(exerciseName)
  const requestedBase = baseExerciseName(exerciseName)
  if (!requestedName) return null

  return catalog.find(item => {
    const catalogName = normalizedExerciseName(item?.exerciseName)
    const catalogBase = baseExerciseName(item?.exerciseName)
    return requestedName === catalogName
      || requestedName === catalogBase
      || requestedBase === catalogName
      || requestedBase === catalogBase
  }) || null
}

/**
 * Convert the AI response into rows accepted by POST /api/TrainingPlans.
 * Only exercises that exist in the catalog are included so an AI name can
 * never become an invalid exercise foreign key.
 */
export function mapWorkoutRecommendationToPlanExercises(recommendation, exerciseCatalog) {
  const catalog = Array.isArray(exerciseCatalog) ? exerciseCatalog : []
  const sessions = Array.isArray(recommendation?.sessions) ? recommendation.sessions : []
  const exercises = []
  const unmatchedNames = []

  sessions.forEach((session, sessionIndex) => {
    const sessionLabel = `Buổi ${session?.day || sessionIndex + 1}${session?.title ? `: ${session.title}` : ''}`
    const sessionExercises = Array.isArray(session?.exercises) ? session.exercises : []

    sessionExercises.forEach(exercise => {
      const catalogExercise = findCatalogExercise(exercise?.exerciseName, catalog)
      if (!catalogExercise) {
        const missingName = String(exercise?.exerciseName || '').trim()
        if (missingName && !unmatchedNames.includes(missingName)) unmatchedNames.push(missingName)
        return
      }

      const notes = [
        sessionLabel,
        exercise?.restSeconds ? `Nghỉ ${exercise.restSeconds} giây` : '',
        String(exercise?.note || '').trim(),
      ].filter(Boolean).join(' · ')

      exercises.push({
        exerciseId: String(catalogExercise.id),
        sets: String(positiveIntegerOrNull(exercise?.sets) || 1),
        reps: String(positiveIntegerOrNull(exercise?.reps) || 1),
        durationInMinutes: '',
        notes,
      })
    })
  })

  return { exercises, unmatchedNames }
}
