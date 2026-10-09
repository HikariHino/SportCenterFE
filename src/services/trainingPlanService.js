import api from './api'

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
  const response = await api.get(`/TrainingPlans/members/${memberId}`)
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải giáo án của học viên.')
  }

  const payload = body?.data ?? body
  return Array.isArray(payload) ? payload : []
}
