import api from './api'
import { receptionistCheckInReason } from '../utils/receptionistCheckIn'
import { getReceptionistMemberRegistrations } from './receptionistClassService'

// Read the saved registration again so an old dialog cannot use a rescheduled
// session or an attendance that another staff member has already recorded.
export async function checkInReceptionistMemberRegistration(memberId, registrationId) {
  let registration
  for (let page = 1; ; page += 1) {
    const result = await getReceptionistMemberRegistrations(memberId, { page, pageSize: 100 })
    registration = result.items.find(item => String(item.id) === String(registrationId))
    if (registration || !result.items.length || result.page * result.pageSize >= result.total) break
  }
  if (!registration || String(registration.memberId) !== String(memberId)) {
    throw new Error('Không tìm thấy lượt đăng ký của hội viên. Vui lòng tải lại danh sách.')
  }
  const reason = receptionistCheckInReason(registration)
  if (reason) throw new Error(reason)

  const response = await api.post(`/class-registrations/${registrationId}/check-in`)
  const body = response.data
  if (body?.success === false) throw new Error(body.message || 'Không thể check-in hội viên.')
  return body?.data ?? body
}
