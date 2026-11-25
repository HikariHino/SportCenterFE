import api from './api'
import { getManagerFormValidationError } from '../utils/managerFormValidation.js'
import { loadClassTimetables, withSessionWriteLock } from './sessionSchedulingService'
import { assertRoomMutationAllowed } from '../utils/roomMutationValidation.js'

async function validateRoomMutation(id, data, deactivate = false) {
  const rooms = await getRooms()
  const room = rooms.find(item => String(item.id) === String(id))
  if (!room) throw new Error('Chưa xác nhận được thông tin phòng. Vui lòng tải lại danh sách phòng.')
  if (!Number.isInteger(Number(room.capacity)) || Number(room.capacity) < 1) throw new Error('Chưa xác nhận được sức chứa hiện tại của phòng. Vui lòng tải lại.')
  if (deactivate || Number(data.capacity) < Number(room.capacity)) {
    const groups = await loadClassTimetables()
    assertRoomMutationAllowed({ room, rooms, groups, capacity: data?.capacity, deactivate })
  }
}

function assertRoomWriteSucceeded(response) {
  if (response.data?.success === false || Number(response.data?.statusCode) >= 400) {
    throw Object.assign(new Error(response.data.message || 'Không thể lưu thay đổi phòng.'), { response })
  }
}

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
  const error = getManagerFormValidationError('room', data)
  if (error) throw new Error(error)
  const response = await api.post('/Rooms', {
    name: data.name.trim(),
    roomType: data.roomType ? data.roomType.trim() : 'General',
    capacity: Number(data.capacity),
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
  const error = getManagerFormValidationError('room', data)
  if (error) throw new Error(error)
  return withSessionWriteLock(async () => {
    await validateRoomMutation(id, data, data.isActive === false)
    const response = await api.put(`/Rooms/${id}`, {
      name: data.name.trim(),
      roomType: data.roomType ? data.roomType.trim() : 'General',
      capacity: Number(data.capacity),
      location: data.location ? data.location.trim() : null,
      isActive: data.isActive !== false,
    })
    assertRoomWriteSucceeded(response)
    const body = response.data
    return body?.data ?? body
  })
}

/**
 * DELETE /api/Rooms/{id}
 * Quản lý xóa / ngừng hoạt động phòng tập (soft delete)
 * @param {number} id
 */
export async function deleteRoom(id) {
  return withSessionWriteLock(async () => {
    await validateRoomMutation(id, null, true)
    const response = await api.delete(`/Rooms/${id}`)
    assertRoomWriteSucceeded(response)
    return response.data
  })
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
