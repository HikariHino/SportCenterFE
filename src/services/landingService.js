import api from './api'

function payload(body) {
  if (body?.success === false || Number(body?.statusCode) >= 400) throw new Error('Chưa tải được danh mục. Vui lòng thử lại.')
  return body?.data ?? body
}

const validId = item => Number.isSafeInteger(item?.id) && item.id > 0
const hasName = (item, field) => validId(item) && typeof item[field] === 'string' && Boolean(item[field].trim())

async function readList(path, signal, valid) {
  const response = await api.get(path, { skipAuth: true, signal, timeout: 12000 })
  const data = payload(response.data)
  if (!Array.isArray(data) || data.some(item => !valid(item))) throw new Error('Dữ liệu danh mục chưa hợp lệ. Vui lòng thử lại.')
  return data.filter(item => item?.isActive !== false)
}

export const getLandingPackages = signal => readList('/membership-packages', signal, item => hasName(item, 'packageName') && Number.isFinite(item.price) && item.price > 0 && Number.isInteger(item.durationInDays) && item.durationInDays > 0)
export const getLandingSports = signal => readList('/sports', signal, item => hasName(item, 'name'))
export const getLandingCoaches = signal => readList('/coaches', signal, item => hasName(item, 'fullName'))

export async function getLandingSessions({ sportId, search, signal } = {}) {
  const params = { page: 1, pageSize: 6, from: new Date().toISOString(), onlyAvailable: true }
  if (Number.isSafeInteger(Number(sportId)) && Number(sportId) > 0) params.sportId = Number(sportId)
  if (search?.trim()) params.search = search.trim().slice(0, 200)
  const response = await api.get('/class-sessions', { skipAuth: true, params, signal, timeout: 12000 })
  const data = payload(response.data)
  if (!Array.isArray(data?.items) || !Number.isInteger(data.total) || data.total < data.items.length
    || data.items.some(item => !hasName(item, 'className') || !Number.isFinite(Date.parse(item.startsAt)) || !Number.isFinite(Date.parse(item.endsAt)) || Date.parse(item.endsAt) <= Date.parse(item.startsAt) || !Number.isInteger(item.availableSeats) || item.availableSeats < 0)) throw new Error('Dữ liệu lịch học chưa hợp lệ. Vui lòng thử lại.')
  return data
}
