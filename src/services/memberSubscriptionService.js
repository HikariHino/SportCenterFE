import api from './api'

function unwrap(body, fallback) {
  if (body?.success === false) {
    throw new Error(body.message || fallback)
  }

  return body?.data ?? body
}

/** GET /api/member-subscriptions/mine */
export async function getMySubscriptions() {
  const response = await api.get('/member-subscriptions/mine')
  const payload = unwrap(response.data, 'Không thể tải danh sách đăng ký gói.')
  return Array.isArray(payload) ? payload : []
}

/** POST /api/member-subscriptions */
export async function createMemberSubscription(packageId) {
  const response = await api.post('/member-subscriptions', { packageId })
  return unwrap(response.data, 'Không thể đăng ký gói hội viên.')
}

/** POST /api/member-subscriptions/members/{memberId} */
export async function createReceptionistMemberSubscription(memberId, packageId) {
  const response = await api.post(`/member-subscriptions/members/${memberId}`, { packageId })
  return unwrap(response.data, 'Không thể đăng ký gói cho hội viên.')
}

/** GET /api/member-subscriptions/members/{memberId} */
export async function getReceptionistMemberSubscriptions(memberId) {
  const response = await api.get(`/member-subscriptions/members/${memberId}`)
  const payload = unwrap(response.data, 'Không thể tải các gói của hội viên.')
  return Array.isArray(payload) ? payload : []
}

/** GET /api/member-subscriptions/{id} */
export async function getReceptionistSubscriptionById(id) {
  const response = await api.get(`/member-subscriptions/${id}`)
  return unwrap(response.data, 'Không thể tải chi tiết đăng ký gói.')
}

/** POST /api/member-subscriptions/{id}/cancel */
export async function cancelReceptionistSubscription(id) {
  const response = await api.post(`/member-subscriptions/${id}/cancel`)
  return unwrap(response.data, 'Không thể hủy đăng ký gói.')
}
