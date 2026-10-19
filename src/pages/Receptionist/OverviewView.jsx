import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, CalendarDays, CircleDollarSign, CreditCard, DoorOpen, MapPin, QrCode, RefreshCw, UserCheck, Users } from 'lucide-react'
import { getTodayCheckIns } from '../../services/gymCheckInService'
import { getMembers } from '../../services/memberService'
import { getPayments } from '../../services/paymentService'
import { getRooms } from '../../services/roomService'
import { EmptyState, formatDateTime, ViewLoader } from './ReceptionistViewShared'

export function Overview({ onNavigate }) {
  const [data, setData] = useState({ checkIns: [], members: [], payments: [], rooms: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)

  useEffect(() => {
    let active = true
    const loadOverview = async () => {
      setLoading(true)
      setError('')
      const results = await Promise.allSettled([getTodayCheckIns(), getMembers(), getPayments(), getRooms(true)])
      if (!active) return
      const [checkIns, members, payments, rooms] = results.map(result => result.status === 'fulfilled' ? result.value : [])
      setData({ checkIns, members, payments, rooms })
      const failedCount = results.filter(result => result.status === 'rejected').length
      if (failedCount) setError(`${failedCount}/4 nguồn dữ liệu tổng quan chưa thể đồng bộ.`)
      setLoading(false)
    }
    loadOverview()
    return () => { active = false }
  }, [requestKey])

  const completedPayments = data.payments.filter(payment => payment.status === 'Completed')
  const revenue = completedPayments.reduce((total, payment) => total + Number(payment.amountReceived || payment.amount || 0), 0)
  const activeCheckIns = data.checkIns.filter(item => !item.checkOutTime)
  const metrics = [
    [Users, 'Hội viên quản lý', data.members.length, 'blue', 'Tài khoản trong hệ thống'],
    [UserCheck, 'Check-in hôm nay', data.checkIns.length, 'green', `${activeCheckIns.length} khách đang ở phòng gym`],
    [MapPin, 'Phòng hoạt động', data.rooms.length, 'purple', 'Phòng đang sẵn sàng'],
    [CircleDollarSign, 'Tổng đã thu', `${revenue.toLocaleString('vi-VN')} đ`, 'amber', `${completedPayments.length} giao dịch hoàn tất`],
  ]

  if (loading) return <ViewLoader />

  return <>
    {error && <div className="reception-overview-warning" role="alert"><span>{error}</span><button type="button" onClick={() => setRequestKey(key => key + 1)}><RefreshCw size={13} />Thử lại</button></div>}
    <section className="reception-metrics" aria-label="Thống kê lễ tân">
      {metrics.map(([Icon, label, value, tone, note]) => <article key={label}><span className={tone}><Icon size={20} /></span><div><small>{label}</small><strong>{loading ? '--' : value}</strong><p>{loading ? 'Đang đồng bộ...' : note}</p></div><ArrowUpRight size={17} /></article>)}
    </section>
    <div className="reception-overview-grid">
      <section className="reception-card reception-queue">
        <div className="reception-card-head"><div><span>CHECK-IN HÔM NAY</span><h2>Khách đang sử dụng phòng gym</h2></div><button type="button" onClick={() => onNavigate('Check-in')}>Mở check-in <ArrowRight size={15} /></button></div>
        {loading ? <EmptyState icon={UserCheck} title="Đang tải check-in" text="Dữ liệu đang được đồng bộ từ Gym Check-in API." /> : activeCheckIns.length ? <div className="reception-overview-checkins">{activeCheckIns.slice(0, 5).map(item => <article key={item.id}><span>{String(item.memberName || 'HV').split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase()}</span><div><strong>{item.memberName}</strong><small>{item.memberCode} · {item.packageName || 'Chưa có gói'}</small></div><time>{formatDateTime(item.checkInTime)}</time></article>)}</div> : <EmptyState icon={UserCheck} title="Chưa có khách trong phòng gym" text="Hôm nay chưa có lượt check-in đang hoạt động." />}
      </section>
      <section className="reception-card reception-court-panel">
        <div className="reception-card-head"><div><span>PHÒNG HOẠT ĐỘNG</span><h2>Cơ sở đang sẵn sàng</h2></div><button type="button" onClick={() => onNavigate('Phòng tập')}>Xem phòng <ArrowRight size={15} /></button></div>
        {loading ? <EmptyState icon={DoorOpen} title="Đang tải phòng" text="Dữ liệu đang được đồng bộ từ Rooms API." /> : data.rooms.length ? <div className="reception-overview-rooms">{data.rooms.slice(0, 5).map(room => <article key={room.id}><span><DoorOpen size={16} /></span><div><strong>{room.name}</strong><small>{room.roomType} · {room.capacity} người</small></div></article>)}</div> : <EmptyState icon={MapPin} title="Chưa có phòng hoạt động" text="Hiện chưa có phòng nào ở trạng thái hoạt động." />}
      </section>
    </div>
    <section className="reception-card reception-shortcuts">
      <div className="reception-card-head"><div><span>TRUY CẬP NHANH</span><h2>Nghiệp vụ tại quầy</h2></div></div>
      <div className="reception-shortcut-grid">
        <button type="button" onClick={() => onNavigate('Buổi học')}><span className="blue"><CalendarDays size={21} /></span><div><strong>Quản lý buổi học</strong><small>Đăng ký và kiểm tra học viên</small></div><ArrowRight size={17} /></button>
        <button type="button" onClick={() => onNavigate('Check-in')}><span className="green"><QrCode size={21} /></span><div><strong>Quét mã check-in</strong><small>Xác minh hội viên tại quầy</small></div><ArrowRight size={17} /></button>
        <button type="button" onClick={() => onNavigate('Hội viên')}><span className="purple"><Users size={21} /></span><div><strong>Tra cứu hội viên</strong><small>Kiểm tra tài khoản và gói dịch vụ</small></div><ArrowRight size={17} /></button>
        <button type="button" onClick={() => onNavigate('Thanh toán')}><span className="amber"><CreditCard size={21} /></span><div><strong>Kiểm tra thanh toán</strong><small>Theo dõi giao dịch và hóa đơn</small></div><ArrowRight size={17} /></button>
      </div>
    </section>
  </>
}
