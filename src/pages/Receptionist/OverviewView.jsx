import { ReceptionistList } from './ReceptionistPagination'
import { useReceptionistResource } from '../../contexts/ReceptionistWorkspaceContext'
import RefreshStatus from './RefreshStatus'
import { useState } from 'react'
import { ArrowRight, CircleDollarSign, CreditCard, DoorOpen, MapPin, RefreshCw, UserCheck, Users } from 'lucide-react'
import { getTodayCheckIns } from '../../services/gymCheckInService'
import { getMembers } from '../../services/memberService'
import { getPayments } from '../../services/paymentService'
import { getRooms } from '../../services/roomService'
import { EmptyState, formatDateTime, ViewLoader } from './ReceptionistViewShared'

export function Overview({ onNavigate }) {
  const [requestKey, setRequestKey] = useState(0)
  const options = { initialData: [], refreshKey: requestKey }
  const checkInsQuery = useReceptionistResource('checkins', getTodayCheckIns, options)
  const membersQuery = useReceptionistResource('members', getMembers, options)
  const paymentsQuery = useReceptionistResource('payments', getPayments, options)
  const roomsQuery = useReceptionistResource('rooms', getRooms, options)
  const resources = [checkInsQuery, membersQuery, paymentsQuery, roomsQuery]
  const loading = resources.some(resource => resource.loading)
  const refreshing = resources.some(resource => resource.refreshing)
  const failedCount = resources.filter(resource => resource.error).length
  const error = failedCount ? failedCount + '/4 nguồn dữ liệu tổng quan chưa thể đồng bộ.' : ''
  const data = { checkIns: checkInsQuery.data, members: membersQuery.data, payments: paymentsQuery.data, rooms: roomsQuery.data.filter(room => room.isActive !== false) }

  const completedPayments = data.payments.filter(payment => payment.status === 'Completed')
  const pendingPayments = data.payments.filter(payment => ['Pending', 'RequiresReview'].includes(payment.status))
  const revenue = completedPayments.reduce((total, payment) => total + Number(payment.amountReceived || payment.amount || 0), 0)
  const activeCheckIns = data.checkIns.filter(item => !item.checkOutTime)
  const metrics = [
    [Users, 'Hội viên', data.members.length, 'blue', 'Hội viên'],
    [UserCheck, 'Check-in hôm nay', data.checkIns.length, 'green', 'Check-in'],
    [MapPin, 'Phòng hoạt động', data.rooms.length, 'purple', 'Phòng tập'],
    [CircleDollarSign, 'Đã thu', `${new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(revenue)} đ`, 'amber', 'Thanh toán'],
  ]
  const focus = activeCheckIns.length
    ? { icon: UserCheck, eyebrow: 'ĐANG PHỤC VỤ', title: `${activeCheckIns.length} khách đang sử dụng phòng gym`, description: 'Theo dõi lượt đang hoạt động và thực hiện check-out khi khách rời trung tâm.', action: 'Mở Check-in', target: 'Check-in' }
    : pendingPayments.length
      ? { icon: CreditCard, eyebrow: 'CẦN XỬ LÝ', title: `${pendingPayments.length} giao dịch đang chờ`, description: 'Kiểm tra trạng thái hoặc đồng bộ thanh toán tại quầy.', action: 'Xem thanh toán', target: 'Thanh toán' }
      : { icon: DoorOpen, eyebrow: 'TRẠNG THÁI QUẦY', title: 'Không có tác vụ khẩn cấp', description: 'Kiểm tra phòng trước khi tiếp nhận yêu cầu tiếp theo.', action: 'Xem phòng tập', target: 'Phòng tập' }
  const FocusIcon = focus.icon

  if (loading) return <ViewLoader />

  return <>
    <RefreshStatus refreshing={refreshing} />
    {error && <div className="reception-overview-warning" role="alert"><span>{error}</span><button type="button" onClick={() => setRequestKey(key => key + 1)}><RefreshCw size={13} />Thử lại</button></div>}
    <section className="reception-overview-focus" aria-label="Công việc ưu tiên tại quầy">
      <div className="reception-overview-focus-main">
        <span><FocusIcon size={22} /></span>
        <div><small>{focus.eyebrow}</small><strong>{focus.title}</strong><p>{focus.description}</p></div>
        <button type="button" onClick={() => onNavigate(focus.target)}>{focus.action}<ArrowRight size={15} /></button>
      </div>
    </section>
    <section className="reception-overview-stats reception-overview-metrics" aria-label="Thống kê lễ tân">
      {metrics.map(([Icon, label, value, tone, target]) => <button type="button" key={label} onClick={() => onNavigate(target)} aria-label={`${label}: ${value}. Mở ${target}`}><span className={tone}><Icon size={17} /></span><span><strong>{value}</strong><small>{label}</small></span></button>)}
    </section>
    <div className="reception-overview-grid">
      <section className="reception-card reception-queue">
        <div className="reception-card-head"><div><span>CHECK-IN HÔM NAY</span><h2>Khách đang sử dụng phòng gym</h2></div><button type="button" onClick={() => onNavigate('Check-in')}>Mở check-in <ArrowRight size={15} /></button></div>
        {loading ? <EmptyState icon={UserCheck} title="Đang tải check-in" text="Dữ liệu check-in đang được đồng bộ từ hệ thống." /> : activeCheckIns.length ? <div className="reception-overview-checkins">{<ReceptionistList items={activeCheckIns} label="Khách đang ở phòng gym">{(item, ordinal) => <article key={item.id}><span>{String(item.memberName || 'HV').split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase()}</span><div><strong>{item.memberName}</strong><small>{item.memberCode} · {item.packageName || 'Chưa có gói'}</small></div><time>{formatDateTime(item.checkInTime)}</time></article>}</ReceptionistList>}</div> : <EmptyState icon={UserCheck} title="Chưa có khách trong phòng gym" text="Hôm nay chưa có lượt check-in đang hoạt động." />}
        {activeCheckIns.length > 0 && <button className="reception-overview-more" type="button" onClick={() => onNavigate('Check-in')}>Mở danh sách {activeCheckIns.length} lượt check-in <ArrowRight size={15} /></button>}
      </section>
      <section className="reception-card reception-court-panel">
        <div className="reception-card-head"><div><span>PHÒNG HOẠT ĐỘNG</span><h2>Cơ sở đang sẵn sàng</h2></div><button type="button" onClick={() => onNavigate('Phòng tập')}>Xem phòng <ArrowRight size={15} /></button></div>
        {loading ? <EmptyState icon={DoorOpen} title="Đang tải phòng" text="Dữ liệu phòng đang được đồng bộ từ hệ thống." /> : data.rooms.length ? <div className="reception-overview-rooms">
          <ReceptionistList items={data.rooms} label="Phòng đang hoạt động" showOrdinal={false}
            renderLayout={(rooms, pagination) => <><div className="reception-overview-room-grid">{rooms}</div>{pagination}</>}>
            {room => <article key={room.id}><span><DoorOpen size={16} /></span><div><strong>{room.name}</strong><small>{room.roomType} · {room.capacity} người</small></div></article>}
          </ReceptionistList>
        </div> : <EmptyState icon={MapPin} title="Chưa có phòng hoạt động" text="Hiện chưa có phòng nào ở trạng thái hoạt động." />}
        {data.rooms.length > 0 && <button className="reception-overview-more" type="button" onClick={() => onNavigate('Phòng tập')}>Mở danh sách {data.rooms.length} phòng <ArrowRight size={15} /></button>}
      </section>
    </div>
  </>
}
