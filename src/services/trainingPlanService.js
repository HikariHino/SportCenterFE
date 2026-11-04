import api from './api'
import { getMyMemberProfile } from './memberService'
import { EXERCISE_NOTES_MAX_LENGTH, getTextLengthValidationError, TRAINING_PLAN_NAME_MAX_LENGTH } from '../utils/textLengthValidation.js'
import { getTrainingExercisesValidationError } from '../utils/trainingPlanValidation.js'

const toUtcISOString = value => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Thời gian giáo án không hợp lệ.')
  }
  return date.toISOString()
}

export function getTrainingPlanErrorMessage(error) {
  const body = error?.response?.data
  return body?.message || body?.detail || error?.message || 'Không thể tải lộ trình tập luyện. Vui lòng thử lại.'
}

/** GET /api/Exercises — danh mục bài tập dùng khi lập giáo án. */
export async function getExerciseCatalog() {
  const response = await api.get('/Exercises')
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải kho bài tập.')
  }

  const payload = body?.data ?? body
  if (!Array.isArray(payload)) throw new Error('Dữ liệu kho bài tập không hợp lệ. Vui lòng thử lại.')
  return payload
    .filter(exercise => Number(exercise.id) > 0 && String(exercise.exerciseName || '').trim())
    .sort((left, right) => String(left.exerciseName).localeCompare(String(right.exerciseName), 'vi'))
}

export async function createTrainingPlan({ planName, goal, memberId, startDate, endDate, exercises = [] }) {
  const nameError = getTextLengthValidationError(planName, 'Tên giáo án', TRAINING_PLAN_NAME_MAX_LENGTH)
  if (nameError) throw new Error(nameError)
  const exerciseError = getTrainingExercisesValidationError(exercises)
  if (exerciseError) throw new Error(exerciseError)
  for (const exercise of exercises) {
    const notesError = getTextLengthValidationError(exercise.notes, 'Ghi chú bài tập', EXERCISE_NOTES_MAX_LENGTH)
    if (notesError) throw new Error(notesError)
  }
  const response = await api.post('/TrainingPlans', {
    planName,
    goal,
    memberId,
    startDate: toUtcISOString(startDate),
    endDate: toUtcISOString(endDate),
    exercises: exercises.map(exercise => ({ ...exercise, exerciseId: Number(exercise.exerciseId), sets: Number(exercise.sets), reps: Number(exercise.reps),
      durationInMinutes: exercise.durationInMinutes == null || String(exercise.durationInMinutes).trim() === '' ? null : Number(exercise.durationInMinutes) })),
  })
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tạo giáo án.')
  }

  return body?.data ?? body
}

export async function getMemberTrainingPlans(memberId) {
  if (!Number.isSafeInteger(Number(memberId)) || Number(memberId) <= 0) {
    throw new Error('Không xác định được mã hội viên để tải giáo án.')
  }
  const response = await api.get(`/TrainingPlans/members/${memberId}`)
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải giáo án của học viên.')
  }

  const payload = body?.data ?? body
  if (!Array.isArray(payload)) throw new Error('Dữ liệu giáo án không hợp lệ. Vui lòng thử lại.')
  return payload
}

/** Resolve the signed-in member before requesting their personal plans. */
export async function getMyTrainingPlans() {
  const profile = await getMyMemberProfile()
  // A user ID is not a member ID; a failed profile lookup must not select another member.
  return getMemberTrainingPlans(profile?.memberId)
}

export async function updateTrainingPlanExerciseResult(planExerciseId, notes) {
  const notesError = getTextLengthValidationError(notes, 'Kết quả / ghi chú thực hiện', EXERCISE_NOTES_MAX_LENGTH)
  if (notesError) throw new Error(notesError)
  const response = await api.put(`/TrainingPlans/exercises/${planExerciseId}/result`, { notes })
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể cập nhật kết quả bài tập.')
  }

  return body
}
