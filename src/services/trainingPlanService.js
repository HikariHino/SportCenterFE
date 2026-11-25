import api from './api'
import { getMyMemberProfile } from './memberService'
import { EXERCISE_NOTES_MAX_LENGTH, getTextLengthValidationError } from '../utils/textLengthValidation.js'
import { getTrainingExercisesValidationError, getTrainingPlanValidationError } from '../utils/trainingPlanValidation.js'

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

function trainingPlanPayload({ planName, goal, memberId, startDate, endDate, exercises = [], confirmRepeat = false }) {
  const planError = getTrainingPlanValidationError({ planName, goal, memberId, startDate, endDate })
  if (planError) throw new Error(planError)
  const exerciseError = getTrainingExercisesValidationError(exercises)
  if (exerciseError) throw new Error(exerciseError)
  for (const exercise of exercises) {
    const notesError = getTextLengthValidationError(exercise.notes, 'Ghi chú bài tập', EXERCISE_NOTES_MAX_LENGTH)
    if (notesError) throw new Error(notesError)
  }
  if (typeof confirmRepeat !== 'boolean') throw new Error('Xác nhận tập lại giáo án không hợp lệ.')
  return {
    planName: planName.trim(),
    goal,
    memberId: Number(memberId),
    startDate: toUtcISOString(startDate),
    endDate: toUtcISOString(endDate),
    ...(confirmRepeat && { confirmRepeat: true }),
    exercises: exercises.map(exercise => ({ exerciseId: Number(exercise.exerciseId), sets: Number(exercise.sets), reps: Number(exercise.reps),
      durationInMinutes: exercise.durationInMinutes == null || String(exercise.durationInMinutes).trim() === '' ? null : Number(exercise.durationInMinutes),
      notes: exercise.notes?.trim() || null })),
  }
}

function readDuplicatePlanResult(result) {
  if (!result || typeof result.isDuplicate !== 'boolean' || !Array.isArray(result.matchedPlans)
    || result.isDuplicate !== (result.matchedPlans.length > 0)
    || result.matchedPlans.some(plan => !Number.isSafeInteger(Number(plan?.id)) || Number(plan.id) < 1
      || typeof plan.planName !== 'string' || !plan.planName.trim()
      || !Number.isFinite(Date.parse(plan.startDate)) || !Number.isFinite(Date.parse(plan.endDate)))) {
    throw new Error('Chưa xác nhận được lịch sử giáo án trùng. Vui lòng thử lại trước khi lưu.')
  }
  return { ...result, message: result.message || 'Học viên đã hoàn thành giáo án tương tự. Hãy kiểm tra trước khi cho tập lại.' }
}

export async function checkTrainingPlanDuplicate(input) {
  const response = await api.post('/TrainingPlans/check-duplicate', trainingPlanPayload(input))
  const body = response.data
  if (body?.success === false || Number(body?.statusCode) >= 400) throw new Error(body.message || 'Không thể kiểm tra giáo án đã hoàn thành.')
  return readDuplicatePlanResult(body?.data ?? body)
}

export function getTrainingPlanDuplicateConflict(error) {
  const body = error?.response?.data
  if (body?.code !== 'DUPLICATE_COMPLETED_PLAN') return null
  return readDuplicatePlanResult({ isDuplicate: true, message: body.message, matchedPlans: body.matchedPlans })
}

export async function createTrainingPlan(input) {
  const response = await api.post('/TrainingPlans', trainingPlanPayload(input))
  const body = response.data

  if (body?.success === false || Number(body?.statusCode) >= 400) {
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

const validPlanId = id => Number.isSafeInteger(Number(id)) && Number(id) > 0

export async function deleteTrainingPlan(planId) {
  if (!validPlanId(planId)) throw new Error('Không xác định được giáo án cần xóa.')
  const response = await api.delete(`/TrainingPlans/${Number(planId)}`)
  if (response.data?.success === false) throw new Error(response.data.message || 'Không thể xóa giáo án.')
}

export async function completeTrainingPlan(planId) {
  if (!validPlanId(planId)) throw new Error('Không xác định được giáo án cần hoàn thành.')
  const response = await api.put(`/TrainingPlans/${Number(planId)}/status`, null, { params: { status: 'Completed' } })
  if (response.data?.success === false) throw new Error(response.data.message || 'Không thể hoàn thành giáo án.')
}
