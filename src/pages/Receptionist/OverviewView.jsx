import { ArrowRight, CalendarDays, CircleDollarSign, CreditCard, MapPin, QrCode, UserCheck, Users } from 'lucide-react'
import { EmptyState } from './ReceptionistViewShared'

export function Overview({ onNavigate }) {
  const metrics = [
    [CalendarDays, 'Lượt đặt hôm nay', '--', 'blue'],
    [UserCheck, 'Khách đã check-in', '--', 'green'],
    [MapPin, 'Sân đang hoạt động', '--', 'purple'],
    [CircleDollarSign, 'Doanh thu tại quầy', '--', 'amber'],
  ]

  return <>
    <section className="reception-metrics" aria-label="Thống kê lễ tân">
      {metrics.map(([Icon, label, value, tone]) => <article key={label}><span className={tone}><Icon size={21} /></span><div><small>{label}</small><strong>{value}</strong><p>Chờ dữ liệu từ API</p></div></article>)}
    </section>

    <div className="reception-overview-grid">
      <section className="reception-card reception-queue">
        <div className="reception-card-head"><div><span>HÀNG ĐỢI</span><h2>Khách chờ check-in</h2></div><button type="button" onClick={() => onNavigate('Check-in')}>Mở check-in <ArrowRight size={15} /></button></div>
        <EmptyState icon={UserCheck} title="Chưa có khách trong hàng đợi" text="Danh sách sẽ cập nhật khi API check-in được kết nối." />
      </section>
      <section className="reception-card reception-court-panel">
        <div className="reception-card-head"><div><span>TÌNH TRẠNG SÂN</span><h2>Vận hành hiện tại</h2></div></div>
        <EmptyState icon={MapPin} title="Chưa có dữ liệu sân" text="Tình trạng sử dụng sân sẽ hiển thị theo thời gian thực." />
      </section>
    </div>

    <section className="reception-card reception-shortcuts">
      <div className="reception-card-head"><div><span>TRUY CẬP NHANH</span><h2>Nghiệp vụ tại quầy</h2></div></div>
      <div className="reception-shortcut-grid">
        <button type="button" onClick={() => onNavigate('Buổi học')}><span className="blue"><CalendarDays size={21} /></span><div><strong>Quản lý buổi học</strong><small>Đăng ký và kiểm tra học viên</small></div><ArrowRight size={17} /></button>
        <button type="button" onClick={() => onNavigate('Check-in')}><span className="green"><QrCode size={21} /></span><div><strong>Quét mã check-in</strong><small>Xác minh lượt đặt tại quầy</small></div><ArrowRight size={17} /></button>
        <button type="button" onClick={() => onNavigate('Hội viên')}><span className="purple"><Users size={21} /></span><div><strong>Tra cứu hội viên</strong><small>Kiểm tra tài khoản và gói dịch vụ</small></div><ArrowRight size={17} /></button>
        <button type="button" onClick={() => onNavigate('Thanh toán')}><span className="amber"><CreditCard size={21} /></span><div><strong>Kiểm tra thanh toán</strong><small>Theo dõi giao dịch và hóa đơn</small></div><ArrowRight size={17} /></button>
      </div>
    </section>
  </>
}

