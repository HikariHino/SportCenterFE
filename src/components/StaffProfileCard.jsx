import { Award } from 'lucide-react'
import '../style/StaffProfileCard.css'

const roles = {
  Coach: { label: 'Huấn luyện viên', badge: 'Huấn luyện viên Olympus', fallback: 'HLV' },
  Receptionist: { label: 'Lễ tân', badge: 'Lễ tân Olympus', fallback: 'LT' },
}

function accountStatus(profile) {
  const status = String(profile.status || '').trim().toLowerCase()
  if (status === 'active' || (!status && profile.isActive === true)) return { label: 'Đang hoạt động', tone: 'active' }
  if (['inactive', 'disabled'].includes(status) || (!status && profile.isActive === false)) return { label: 'Ngừng hoạt động', tone: 'inactive' }
  if (status === 'locked') return { label: 'Đã khóa', tone: 'inactive' }
  if (status === 'pending') return { label: 'Chờ kích hoạt', tone: 'pending' }
  return { label: profile.status || 'Chưa xác định', tone: 'unknown' }
}

function createdDate(value) {
  if (!value) return 'Chưa cập nhật'
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })
    : 'Chưa cập nhật'
}

export default function StaffProfileCard({ profile, role, className = '' }) {
  const details = roles[role]
  const name = profile.fullName || details.label
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(-2).map(part => Array.from(part)[0]).join('').toLocaleUpperCase('vi-VN') || details.fallback
  const status = accountStatus(profile)
  return <section className={`${className} staff-profile-card`} aria-label={`Thẻ thông tin ${details.label.toLocaleLowerCase('vi-VN')}`}>
    <header className="staff-profile-card-heading"><span>{details.badge}</span><Award size={25} aria-hidden="true" /></header>
    <div className="staff-profile-card-identity">
      <span className="staff-profile-card-avatar" aria-hidden="true">{initials}</span>
      <h2>{name}</h2>
      <p className="staff-profile-card-code">{profile.userId ? `#USR-${profile.userId}` : 'Chưa có mã tài khoản'}</p>
      <p className="staff-profile-card-email">{profile.email || 'Chưa cập nhật email'}</p>
      <div className="staff-profile-card-state"><span className={`staff-profile-card-status ${status.tone}`}><i aria-hidden="true" />{status.label}</span><span>{details.label}</span></div>
    </div>
    <footer className="staff-profile-card-footer"><div><small>Ngày tạo tài khoản</small><strong>{createdDate(profile.createdAt)}</strong></div><span>Tài khoản nhân viên</span></footer>
  </section>
}
