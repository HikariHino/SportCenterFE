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
