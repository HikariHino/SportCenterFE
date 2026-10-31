import api from './api'
import { extractWorkoutRecommendation } from '../utils/aiWorkoutRecommendation'

export const AI_QUESTION_MAX_LENGTH = 1000
export const AI_WORKOUT_GOAL_MAX_LENGTH = 200
export const AI_WORKOUT_LEVELS = [
  { value: 'Beginner', label: 'Mới bắt đầu' },
  { value: 'Intermediate', label: 'Trung cấp' },
  { value: 'Advanced', label: 'Nâng cao' },
]

function unwrapAi(body) {
  if (body?.success === false || Number(body?.statusCode) >= 400) throw new Error(body.message || 'Chưa thể nhận dữ liệu AI. Vui lòng thử lại.')
  return body?.data ?? body
}

function readAiAnswer(body) {
  unwrapAi(body)
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
  const data = unwrapAi(body)
  // Older servers returned markdown; the current API returns WorkoutPlanResponse.
  return typeof data?.answer === 'string' ? readAiAnswer(body) : extractWorkoutRecommendation(data)
}

const validId = value => typeof value === 'number' ? Number.isSafeInteger(value) && value > 0 : typeof value === 'string' && /^[1-9]\d*$/.test(value)
const pageNumber = (value, max) => Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= max

async function readHistory(url, { page = 1, pageSize = 20 } = {}, { signal } = {}, validate) {
  if (!pageNumber(page, 100000) || !pageNumber(pageSize, 100)) throw new Error('Trang hoặc số bản ghi lịch sử không hợp lệ.')
  const { data: body } = await api.get(url, { params: { page: Number(page), pageSize: Number(pageSize) }, signal })
  const data = unwrapAi(body)
  const total = Number(data?.total ?? data?.totalCount)
  if (!Array.isArray(data?.items) || !Number.isInteger(total) || total < 0
    || Number(data.pageNumber ?? data.page) !== Number(page) || Number(data.pageSize) !== Number(pageSize)
    || data.items.length > Number(pageSize) || data.items.length > total
    || data.items.some(item => !validId(item?.id) || !validate(item))
    || new Set(data.items.map(item => String(item.id))).size !== data.items.length) {
    throw new Error('Dữ liệu lịch sử AI không hợp lệ. Vui lòng tải lại.')
  }
  return { items: data.items, total, page: Number(page), pageSize: Number(pageSize) }
}

export const getMemberAiChatHistory = (params, options) => readHistory('/ai/chat/history', params, options,
  item => typeof item.question === 'string' && Boolean(item.question.trim()) && typeof item.answer === 'string' && Boolean(item.answer.trim()))

export const getMemberAiWorkoutHistory = (params, options) => readHistory('/ai/workout-recommendations/history', params, options,
  item => typeof item.goal === 'string' && AI_WORKOUT_LEVELS.some(level => level.value === item.level) && pageNumber(item.daysPerWeek, 7))

export async function getMemberAiWorkoutHistoryDetail(id, { signal } = {}) {
  if (!validId(id)) throw new Error('Mã bản gợi ý bài tập không hợp lệ.')
  const { data: body } = await api.get(`/ai/workout-recommendations/history/${id}`, { signal })
  const detail = unwrapAi(body)
  if (String(detail?.id) !== String(id)) throw new Error('Bản gợi ý trả về không khớp. Vui lòng tải lại.')
  return { ...detail, plan: extractWorkoutRecommendation(detail.plan) }
}

export async function deleteMemberAiWorkoutHistory(id) {
  if (!validId(id)) throw new Error('Mã bản gợi ý bài tập không hợp lệ.')
  const response = await api.delete(`/ai/workout-recommendations/history/${id}`)
  unwrapAi(response.data)
}

export async function clearMemberAiChatHistory() {
  const response = await api.delete('/ai/chat/history')
  unwrapAi(response.data)
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
