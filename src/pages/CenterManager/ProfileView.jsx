import { UserRound } from 'lucide-react'
import FontSizeControl from '../../components/FontSizeControl'
import '../../style/CenterManager/ManagerProfile.css'

export default function ManagerProfileView({ user }) {
  return <div className="manager-profile-layout">
    <section className="manager-card manager-personal-profile">
      <header><UserRound size={24} /><div><h1>Hồ sơ cá nhân</h1><p>Thông tin tài khoản quản lý trung tâm.</p></div></header>
      <dl>{[
        ['Họ và tên', user?.fullName || user?.name],
        ['Email', user?.email],
        ['Vai trò', 'Quản lý trung tâm'],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Chưa cập nhật'}</dd></div>)}</dl>
    </section>
    <FontSizeControl />
  </div>
}
