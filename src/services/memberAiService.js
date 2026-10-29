import api from './api'

export const AI_QUESTION_MAX_LENGTH = 1000
export const AI_WORKOUT_GOAL_MAX_LENGTH = 200
export const AI_WORKOUT_LEVELS = [
  { value: 'Beginner', label: 'Mới bắt đầu' },
  { value: 'Intermediate', label: 'Trung cấp' },
  { value: 'Advanced', label: 'Nâng cao' },
]

function readAiAnswer(body) {
  if (body?.success === false) throw new Error(body.message || 'Chưa thể nhận câu trả lời. Vui lòng thử lại.')
  const answer = (body?.data ?? body)?.answer
  if (typeof answer !== 'string' || !answer.trim()) throw new Error('AI chưa trả về nội dung. Vui lòng thử lại.')
  return answer.trim()
}

export async function askMemberAi(question, { signal } = {}) {
  const text = typeof question === 'string' ? question.trim() : ''
  if (!text) throw new Error('Vui lòng nhập câu hỏi.')
  if (text.length > AI_QUESTION_MAX_LENGTH) throw new Error('Câu hỏi tối đa 1000 ký tự.')

  const { data: body } = await api.post('/ai/chat', { question: text }, { signal, timeout: 90000 })
  return readAiAnswer(body)
}

export function getMemberWorkoutErrors(request) {
  const errors = {}
  const goal = typeof request?.goal === 'string' ? request.goal.trim() : ''
  if (!goal) errors.goal = 'Vui lòng nhập mục tiêu tập luyện.'
  else if (goal.length > AI_WORKOUT_GOAL_MAX_LENGTH) errors.goal = 'Mục tiêu tập luyện tối đa 200 ký tự.'
  if (!AI_WORKOUT_LEVELS.some(item => item.value === request?.level)) errors.level = 'Vui lòng chọn trình độ hợp lệ.'
  const days = typeof request?.daysPerWeek === 'string' || typeof request?.daysPerWeek === 'number' ? Number(request.daysPerWeek) : NaN
  if (!Number.isInteger(days) || days < 1 || days > 7) errors.daysPerWeek = 'Số ngày tập mỗi tuần phải từ 1 đến 7.'
  return errors
}

export async function getMemberWorkoutRecommendation(request, { signal } = {}) {
  const fieldErrors = getMemberWorkoutErrors(request)
  if (Object.keys(fieldErrors).length) throw Object.assign(new Error(Object.values(fieldErrors)[0]), { fieldErrors })
  // The member's identity comes from JWT; never send another member's ID.
  const payload = { goal: request.goal.trim(), level: request.level, daysPerWeek: Number(request.daysPerWeek) }
  const { data: body } = await api.post('/ai/workout-recommendations', payload, { signal, timeout: 90000 })
  return readAiAnswer(body)
}

export function getMemberAiErrorMessage(error) {
  const status = Number(error?.response?.status)
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  if (status === 403) return 'Trợ lý AI chỉ dành cho tài khoản hội viên.'
  if (status === 429) return 'Bạn đã gửi nhiều câu hỏi. Vui lòng chờ một lát rồi thử lại.'
  if (status === 503) return 'Trợ lý AI đang tạm thời không khả dụng. Vui lòng thử lại sau.'
  if (status === 504 || error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') return 'AI phản hồi quá lâu. Vui lòng thử lại.'
  if (error?.code === 'ERR_NETWORK') return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối và thử lại.'
  const body = error?.response?.data
  const validation = Object.values(body?.errors || {}).flat().find(value => typeof value === 'string' && value.trim())
  return body?.message || validation || body?.detail || error?.message || 'Không thể gửi câu hỏi. Vui lòng thử lại.'
}
