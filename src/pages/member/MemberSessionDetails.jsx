import { Clock3, MapPin, User } from 'lucide-react'
import { cancellationDeadline } from '../../utils/memberClasses'

export function formatClassDateTime(value) {
  if (!value) return 'Chưa cập nhật'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Chưa cập nhật' : date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' })
}

export default function MemberSessionDetails({ item }) {
  const deadline = cancellationDeadline(item)
  return <dl className="member-classes-details">
    <div><dt><Clock3 size={15} /> Bắt đầu</dt><dd>{formatClassDateTime(item.startsAt)}</dd></div>
    <div><dt><Clock3 size={15} /> Kết thúc</dt><dd>{formatClassDateTime(item.endsAt)}</dd></div>
    <div><dt><User size={15} /> Huấn luyện viên</dt><dd>{item.coachName || 'Chưa cập nhật'}</dd></div>
    <div><dt><MapPin size={15} /> Phòng tập</dt><dd>{item.roomName || 'Chưa cập nhật'}</dd></div>
    {deadline && <div><dt>Hạn hủy đăng ký</dt><dd>{formatClassDateTime(deadline)}</dd></div>}
  </dl>
}
