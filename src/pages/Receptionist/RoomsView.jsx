import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowRight, CalendarClock, CheckCircle2, DoorOpen, MapPin, RefreshCw, SlidersHorizontal, UsersRound, X } from 'lucide-react'
import { checkRoomAvailability, getRoomById, getRoomErrorMessage, getRooms } from '../../services/roomService'
import { ViewLoader } from './ReceptionistViewShared'

const toLocalInputValue = date => {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function RoomDetailDialog({ roomId, onClose }) {
  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)
  const initialStart = new Date(Date.now() + 60 * 60_000)
  const [availabilityForm, setAvailabilityForm] = useState({ startsAt: toLocalInputValue(initialStart), endsAt: toLocalInputValue(new Date(initialStart.getTime() + 60 * 60_000)) })
  const [availability, setAvailability] = useState(null)
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [availabilityError, setAvailabilityError] = useState('')

  useEffect(() => {
    let active = true
    const loadRoom = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getRoomById(roomId)
        if (active) setRoom(result)
      } catch (requestError) {
        if (active) setError(getRoomErrorMessage(requestError, 'Không thể tải chi tiết phòng.'))
      } finally {
        if (active) setLoading(false)
      }
    }
    loadRoom()
    return () => { active = false }
  }, [requestKey, roomId])

  const handleAvailability = async event => {
    event.preventDefault()
    const startsAt = new Date(availabilityForm.startsAt)
    const endsAt = new Date(availabilityForm.endsAt)
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      setAvailabilityError('Thời gian kết thúc phải sau thời gian bắt đầu.')
      setAvailability(null)
      return
    }
    setAvailabilityLoading(true)
    setAvailabilityError('')
    setAvailability(null)
    try {
      setAvailability(await checkRoomAvailability(roomId, startsAt.toISOString(), endsAt.toISOString()))
    } catch (requestError) {
      setAvailabilityError(getRoomErrorMessage(requestError, 'Không thể kiểm tra lịch phòng.'))
    } finally {
      setAvailabilityLoading(false)
    }
  }

  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="reception-dialog reception-room-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-room-detail-title">
      <header><div><span>CHI TIẾT PHÒNG</span><h2 id="reception-room-detail-title">Phòng #{roomId}</h2><p>Dữ liệu được tải trực tiếp từ hệ thống phòng tập.</p></div><button type="button" aria-label="Đóng chi tiết phòng" onClick={onClose}><X size={19} /></button></header>
      <div className="reception-room-detail-body">
        {loading ? <div className="reception-member-detail-state"><DoorOpen size={26} /><strong>Đang tải chi tiết phòng</strong><span>Vui lòng chờ dữ liệu được đồng bộ.</span></div> : error ? <div className="reception-member-detail-state"><DoorOpen size={26} /><strong>Không thể tải chi tiết</strong><span>{error}</span><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : room && <>
          <div className="reception-room-detail-title"><span><DoorOpen size={23} /></span><div><small>{room.roomType || 'General'}</small><h3>{room.name}</h3></div><b className={room.isActive ? 'active' : 'inactive'}>{room.isActive ? 'Đang hoạt động' : 'Tạm ngưng'}</b></div>
          <div className="reception-room-detail-grid"><div><small>Mã phòng</small><strong>#{room.id}</strong></div><div><small>Sức chứa</small><strong>{room.capacity} người</strong></div><div className="wide"><small>Vị trí</small><strong>{room.location || 'Chưa cập nhật vị trí'}</strong></div></div>
          <form className="reception-room-availability" onSubmit={handleAvailability}>
            <div className="reception-room-availability-heading"><span><CalendarClock size={18} /></span><div><small>KIỂM TRA LỊCH</small><strong>Khung giờ sử dụng phòng</strong></div></div>
            <label>Bắt đầu<input type="datetime-local" value={availabilityForm.startsAt} onChange={event => setAvailabilityForm(current => ({ ...current, startsAt: event.target.value }))} required /></label>
            <label>Kết thúc<input type="datetime-local" value={availabilityForm.endsAt} onChange={event => setAvailabilityForm(current => ({ ...current, endsAt: event.target.value }))} required /></label>
            <button type="submit" disabled={availabilityLoading}>{availabilityLoading ? 'Đang kiểm tra...' : 'Kiểm tra phòng'}</button>
            {availabilityError && <p className="error" role="alert"><AlertCircle size={15} />{availabilityError}</p>}
            {availability && <p className={availability.isAvailable ? 'available' : 'unavailable'}>{availability.isAvailable ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}<span><strong>{availability.isAvailable ? 'Phòng còn trống' : 'Phòng đã có lịch'}</strong><small>{availability.message}</small></span></p>}
          </form>
        </>}
      </div>
    </section>
  </div>
}

export function RoomsView({ query }) {
  const [rooms, setRooms] = useState([])
  const [status, setStatus] = useState('active')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)
  const [selectedRoomId, setSelectedRoomId] = useState(null)

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

  if (loading) return <ViewLoader />

  return <>
    <section className="reception-card reception-room-toolbar">
      <div><span><SlidersHorizontal size={17} /></span><div><small>DANH SÁCH PHÒNG</small><strong>{loading ? 'Đang đồng bộ...' : `${filteredRooms.length} phòng phù hợp`}</strong></div></div>
      <label>Trạng thái<select value={status} onChange={event => setStatus(event.target.value)}><option value="active">Đang hoạt động</option><option value="inactive">Ngừng hoạt động</option><option value="all">Tất cả</option></select></label>
      {error && <div className="reception-filter-error"><span>{error}</span><button type="button" onClick={() => setRequestKey(key => key + 1)}><RefreshCw size={12} />Thử lại</button></div>}
    </section>

    <section className="reception-card reception-room-catalog">
      <div className="reception-card-head"><div><span>DANH MỤC CƠ SỞ</span><h2>Phòng tập và khu chức năng</h2></div><strong>{rooms.length} phòng</strong></div>
      {loading ? <div className="reception-empty"><span><DoorOpen size={24} /></span><strong>Đang tải danh sách phòng</strong><p>Dữ liệu đang được lấy trực tiếp từ hệ thống.</p></div> : !filteredRooms.length ? <div className="reception-empty"><span><DoorOpen size={24} /></span><strong>Không tìm thấy phòng</strong><p>Thử đổi trạng thái hoặc từ khóa tìm kiếm.</p></div> : <div className="reception-room-grid">{filteredRooms.map(room => <article key={room.id}>
        <header><span><DoorOpen size={20} /></span><b className={room.isActive ? 'active' : 'inactive'}>{room.isActive ? 'Hoạt động' : 'Tạm ngưng'}</b></header>
        <small>PHÒNG #{room.id}</small><h3>{room.name}</h3><p>{room.roomType || 'General'}</p>
        <footer><span><UsersRound size={14} />{room.capacity} người</span><span><MapPin size={14} />{room.location || 'Chưa cập nhật'}</span></footer>
        <button className="reception-room-detail-trigger" type="button" onClick={() => setSelectedRoomId(room.id)}>Xem chi tiết <ArrowRight size={13} /></button>
      </article>)}</div>}
    </section>
    {selectedRoomId && <RoomDetailDialog roomId={selectedRoomId} onClose={() => setSelectedRoomId(null)} />}
  </>
}
