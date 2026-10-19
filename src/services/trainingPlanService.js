import api from './api'
import { getMyMemberProfile } from './memberService'

export function getTrainingPlanErrorMessage(error) {
  const body = error?.response?.data
  return body?.message || body?.detail || error?.message || 'Không thể tải lộ trình tập luyện. Vui lòng thử lại.'
}

export async function createTrainingPlan({ planName, goal, memberId, startDate, endDate, exercises = [] }) {
  const response = await api.post('/TrainingPlans', {
    planName,
    goal,
    memberId,
    startDate,
    endDate,
    exercises,
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
  const response = await api.put(`/TrainingPlans/exercises/${planExerciseId}/result`, { notes })
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể cập nhật kết quả bài tập.')
  }

  return body
}
