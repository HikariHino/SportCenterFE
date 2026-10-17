import { Search } from 'lucide-react'

export const emptyMemberForm = {
  fullName: '',
  email: '',
  password: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  address: '',
  fitnessGoal: '',
}

export const requestErrorMessage = (error, fallback) => {
  const validationErrors = error.response?.data?.errors
  return error.response?.data?.message
    || (validationErrors && Object.values(validationErrors).flat()[0])
    || error.message
    || fallback
}

export const memberDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export const formatMemberDate = value => {
  if (!value) return 'Chưa cập nhật'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Chưa cập nhật' : memberDateFormatter.format(date)
}

export const genderLabel = gender => ({ Male: 'Nam', Female: 'Nữ', Other: 'Khác' })[gender] || gender || 'Chưa cập nhật'
export const attendanceStatusLabel = status => ({ Present: 'Có mặt', Absent: 'Vắng mặt', Excused: 'Có phép' })[status] || status
export const subscriptionStatusLabel = status => ({ Pending: 'Chờ thanh toán', Active: 'Đang hoạt động', Cancelled: 'Đã hủy', Expired: 'Hết hạn' })[status] || status
export const paymentStatusLabel = status => ({ Pending: 'Chờ thanh toán', Completed: 'Thành công', Cancelled: 'Đã hủy', Expired: 'Hết hạn', Failed: 'Thất bại', NeedsReview: 'Cần kiểm tra', Refunded: 'Hoàn tiền' })[status] || status

export const sessionDateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export const formatDateTime = value => {
  if (!value) return 'Chưa có'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Chưa có' : sessionDateTimeFormatter.format(date)
}

export function EmptyState({ icon: Icon = Search, title, text }) {
  return <div className="reception-empty"><span><Icon size={25} /></span><strong>{title}</strong><p>{text}</p></div>
}

export function ViewLoader() {
  return <section className="reception-card reception-view-loader" role="status" aria-live="polite" aria-label="Đang tải nội dung">
    <svg className="reception-loader-orbit" viewBox="0 0 80 80" aria-hidden="true">
      <circle className="reception-loader-track" cx="40" cy="40" r="32" pathLength="100" />
      <circle className="reception-loader-arc" cx="40" cy="40" r="32" pathLength="100" />
    </svg>
  </section>
}
