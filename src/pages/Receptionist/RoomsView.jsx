import { useEffect, useMemo, useState } from 'react'
import { DoorOpen, MapPin, RefreshCw, SlidersHorizontal, UsersRound } from 'lucide-react'
import { getRoomErrorMessage, getRooms } from '../../services/roomService'

export function RoomsView({ query }) {
  const [rooms, setRooms] = useState([])
  const [status, setStatus] = useState('active')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)

  useEffect(() => {
    let active = true
    const loadRooms = async () => {
      setLoading(true)
      setError('')
      try {
        const isActive = status === 'all' ? null : status === 'active'
        const result = await getRooms(isActive)
        if (active) setRooms(result)
      } catch (requestError) {
        if (active) setError(getRoomErrorMessage(requestError, 'Không thể tải danh sách phòng.'))
      } finally {
        if (active) setLoading(false)
      }
    }
    loadRooms()
    return () => { active = false }
  }, [status, requestKey])

  const filteredRooms = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('vi-VN')
    if (!keyword) return rooms
    return rooms.filter(room => [room.name, room.roomType, room.location, room.id].some(value => String(value ?? '').toLocaleLowerCase('vi-VN').includes(keyword)))
  }, [query, rooms])

  return <>
    <section className="reception-card reception-room-toolbar">
      <div><span><SlidersHorizontal size={17} /></span><div><small>ROOMS API</small><strong>{loading ? 'Đang đồng bộ...' : `${filteredRooms.length} phòng phù hợp`}</strong></div></div>
      <label>Trạng thái<select value={status} onChange={event => setStatus(event.target.value)}><option value="active">Đang hoạt động</option><option value="inactive">Ngừng hoạt động</option><option value="all">Tất cả</option></select></label>
      {error && <div className="reception-filter-error"><span>{error}</span><button type="button" onClick={() => setRequestKey(key => key + 1)}><RefreshCw size={12} />Thử lại</button></div>}
    </section>

    <section className="reception-card reception-room-catalog">
      <div className="reception-card-head"><div><span>DANH MỤC CƠ SỞ</span><h2>Phòng tập và khu chức năng</h2></div><strong>{rooms.length} phòng</strong></div>
      {loading ? <div className="reception-empty"><span><DoorOpen size={24} /></span><strong>Đang tải danh sách phòng</strong><p>Dữ liệu đang được lấy trực tiếp từ hệ thống.</p></div> : !filteredRooms.length ? <div className="reception-empty"><span><DoorOpen size={24} /></span><strong>Không tìm thấy phòng</strong><p>Thử đổi trạng thái hoặc từ khóa tìm kiếm.</p></div> : <div className="reception-room-grid">{filteredRooms.map(room => <article key={room.id}>
        <header><span><DoorOpen size={20} /></span><b className={room.isActive ? 'active' : 'inactive'}>{room.isActive ? 'Hoạt động' : 'Tạm ngưng'}</b></header>
        <small>PHÒNG #{room.id}</small><h3>{room.name}</h3><p>{room.roomType || 'General'}</p>
        <footer><span><UsersRound size={14} />{room.capacity} người</span><span><MapPin size={14} />{room.location || 'Chưa cập nhật'}</span></footer>
      </article>)}</div>}
    </section>
  </>
}
