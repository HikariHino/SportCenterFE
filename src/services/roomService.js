import api from './api'

/**
 * Trích xuất thông báo lỗi từ backend
 */
export function getRoomErrorMessage(error, fallback = 'Có lỗi xảy ra khi thao tác với phòng tập.') {
  const body = error?.response?.data
  const validationErrors = body?.errors
  if (validationErrors && typeof validationErrors === 'object') {
    const firstKey = Object.keys(validationErrors)[0]
    if (firstKey && Array.isArray(validationErrors[firstKey])) {
      return validationErrors[firstKey][0]
    }
  }
  return body?.message || error?.message || fallback
}

/**
 * GET /api/Rooms?isActive={bool}
 * Lấy danh sách tất cả phòng tập / cơ sở vật chất
 * @param {boolean|null} isActive Lọc theo trạng thái kích hoạt (null: lấy tất cả)
 */
export async function getRooms(isActive = null) {
  const params = {}
  if (isActive !== null && isActive !== undefined) {
    params.isActive = isActive
  }
  const response = await api.get('/Rooms', { params })
  const body = response.data
  const payload = body?.data ?? body
  return Array.isArray(payload) ? payload : []
}

/**
 * GET /api/Rooms/{id}
 * Xem chi tiết phòng tập
 */
export async function getRoomById(id) {
  const response = await api.get(`/Rooms/${id}`)
  const body = response.data
  return body?.data ?? body
}

/**
 * GET /api/Rooms/{id}/check-availability?startsAt={startsAt}&endsAt={endsAt}
 * Kiểm tra xem phòng có bị trùng lịch học vào khung giờ này không
 */
export async function checkRoomAvailability(id, startsAt, endsAt) {
  const response = await api.get(`/Rooms/${id}/check-availability`, {
    params: { startsAt, endsAt },
  })
  const body = response.data
  return body?.data ?? body
}

/**
 * POST /api/Rooms
 * Quản lý tạo phòng tập mới
 * @param {{ name: string, roomType: string, capacity: number, location: string|null }} data
 */
export async function createRoom(data) {
  const response = await api.post('/Rooms', {
    name: data.name.trim(),
    roomType: data.roomType ? data.roomType.trim() : 'General',
    capacity: Number(data.capacity) || 30,
    location: data.location ? data.location.trim() : null,
  })
  const body = response.data
  return body?.data ?? body
}

/**
 * PUT /api/Rooms/{id}
 * Quản lý cập nhật thông tin phòng tập (đổi tên, sức chứa, vị trí, trạng thái)
 * @param {number} id
 * @param {{ name: string, roomType: string, capacity: number, location: string|null, isActive: boolean }} data
 */
export async function updateRoom(id, data) {
  const response = await api.put(`/Rooms/${id}`, {
    name: data.name.trim(),
    roomType: data.roomType ? data.roomType.trim() : 'General',
    capacity: Number(data.capacity) || 30,
    location: data.location ? data.location.trim() : null,
    isActive: data.isActive !== false,
  })
  const body = response.data
  return body?.data ?? body
}

/**
 * DELETE /api/Rooms/{id}
 * Quản lý xóa / ngừng hoạt động phòng tập (soft delete)
 * @param {number} id
 */
export async function deleteRoom(id) {
  const response = await api.delete(`/Rooms/${id}`)
  return response.data
}

export default {
  getRoomErrorMessage,
  getRooms,
  getRoomById,
  checkRoomAvailability,
  createRoom,
  updateRoom,
  deleteRoom,
}
