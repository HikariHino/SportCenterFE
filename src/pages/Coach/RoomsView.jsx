import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ChevronRight, Clock3, DoorOpen, MapPin, X } from 'lucide-react'
import { checkRoomAvailability, getRoomById, getRoomErrorMessage, getRooms } from '../../services/roomService'
import { ViewLoader } from './CoachViewShared'
import useCoachViewRefresh from '../../hooks/useCoachViewRefresh'

function CoachRoomDetailDialog({ roomId, onClose }) {
  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)
  const [availabilityForm, setAvailabilityForm] = useState({ startsAt: '', endsAt: '' })
  const [availability, setAvailability] = useState(null)
  const [availabilityError, setAvailabilityError] = useState('')
  const [checkingAvailability, setCheckingAvailability] = useState(false)

  useEffect(() => {
    let active = true
    const loadRoom = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getRoomById(roomId)
        if (active) setRoom(result)
      } catch (requestError) {
        if (active) setError(getRoomErrorMessage(requestError, 'Không thể tải chi tiết phòng tập.'))
      } finally {
        if (active) setLoading(false)
      }
    }
    loadRoom()
    return () => { active = false }
  }, [requestKey, roomId])

  const submitAvailability = async event => {
    event.preventDefault()
    setAvailability(null)
    setAvailabilityError('')
    const start = new Date(availabilityForm.startsAt)
    const end = new Date(availabilityForm.endsAt)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setAvailabilityError('Thời gian kết thúc phải sau thời gian bắt đầu.')
      return
    }
    setCheckingAvailability(true)
    try {
      const result = await checkRoomAvailability(roomId, start.toISOString(), end.toISOString())
      setAvailability(result)
    } catch (requestError) {
      setAvailabilityError(getRoomErrorMessage(requestError, 'Không thể kiểm tra tình trạng phòng.'))
    } finally {
      setCheckingAvailability(false)
    }
  }

  return <div className="coach-room-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="coach-room-dialog" role="dialog" aria-modal="true" aria-labelledby="coach-room-detail-title">
      <header><div><span>THÔNG TIN PHÒNG</span><h2 id="coach-room-detail-title">Chi tiết phòng #{roomId}</h2><p>Thông tin được tải trực tiếp theo mã phòng.</p></div><button type="button" onClick={onClose} aria-label="Đóng chi tiết phòng"><X size={18} /></button></header>
      <div className="coach-room-dialog-body">{loading ? <div className="coach-room-state"><DoorOpen size={28} /><strong>Đang tải chi tiết phòng</strong><p>Dữ liệu phòng đang được đồng bộ từ hệ thống.</p></div> : error ? <div className="coach-room-state error"><DoorOpen size={28} /><strong>Không thể tải chi tiết</strong><p>{error}</p><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : room && <><div className="coach-room-detail-title"><span><DoorOpen size={22} /></span><div><small>Phòng #{room.id}</small><h3>{room.name}</h3></div><b className={room.isActive ? 'active' : 'inactive'}>{room.isActive ? 'Đang mở' : 'Tạm ngừng'}</b></div><div className="coach-room-detail-grid"><article><small>Loại phòng</small><strong>{room.roomType || 'General'}</strong></article><article><small>Sức chứa</small><strong>{room.capacity} người</strong></article><article className="wide"><small>Vị trí</small><strong><MapPin size={14} />{room.location || 'Chưa cập nhật'}</strong></article></div><form className="coach-room-availability" onSubmit={submitAvailability}><header><div><span>KIỂM TRA LỊCH PHÒNG</span><strong>Phòng có trống không?</strong></div><Clock3 size={19} /></header><div><label>Bắt đầu<input type="datetime-local" value={availabilityForm.startsAt} onChange={event => setAvailabilityForm(current => ({ ...current, startsAt: event.target.value }))} required /></label><label>Kết thúc<input type="datetime-local" value={availabilityForm.endsAt} onChange={event => setAvailabilityForm(current => ({ ...current, endsAt: event.target.value }))} required /></label><button type="submit" disabled={checkingAvailability}>{checkingAvailability ? 'Đang kiểm tra...' : 'Kiểm tra phòng'}</button></div>{availabilityError && <p className="error" role="alert">{availabilityError}</p>}{availability && <p className={availability.isAvailable ? 'available' : 'occupied'}><CheckCircle2 size={16} /><span><strong>{availability.isAvailable ? 'Phòng đang trống' : 'Phòng đã có lịch'}</strong><small>{availability.message}</small></span></p>}</form></>}</div>
    </section>
  </div>
}

export function CoachRoomsView({ active = true }) {
  const [rooms, setRooms] = useState([])
  const [filter, setFilter] = useState('active')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)
  const [selectedRoomId, setSelectedRoomId] = useState(null)
  const loadedFilter = useRef(null)
  const refreshKey = useCoachViewRefresh(active, 'rooms')

  useEffect(() => {
    let active = true
    const loadRooms = async () => {
      setLoading(loadedFilter.current !== filter)
      setError('')
      try {
        const isActive = filter === 'all' ? null : filter === 'active'
        const result = await getRooms(isActive)
        if (active) {
          loadedFilter.current = filter
          setRooms(result)
        }
      } catch (requestError) {
        if (active) {
          setRooms([])
          setError(getRoomErrorMessage(requestError, 'Không thể tải danh sách phòng tập.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadRooms()
    return () => { active = false }
  }, [filter, requestKey, refreshKey])

  if (loading) return <ViewLoader />

  return <section className="coach-card coach-rooms-catalog">
    <div className="coach-card-head"><div><span>DANH SÁCH PHÒNG</span><h2>Danh sách phòng tập</h2></div><div className="coach-room-filters">{[['all', 'Tất cả'], ['active', 'Đang mở'], ['inactive', 'Tạm ngừng']].map(([value, label]) => <button type="button" key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div></div>
    {loading ? <div className="coach-room-state"><DoorOpen size={28} /><strong>Đang tải phòng tập</strong><p>Dữ liệu phòng đang được đồng bộ từ hệ thống.</p></div> : error ? <div className="coach-room-state error"><DoorOpen size={28} /><strong>Không thể tải phòng tập</strong><p>{error}</p><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : rooms.length ? <div className="coach-room-list">{rooms.map(room => <article key={room.id}><header><span><DoorOpen size={19} /></span><div><small>Phòng #{room.id}</small><h3>{room.name}</h3></div><b className={room.isActive ? 'active' : 'inactive'}>{room.isActive ? 'Đang mở' : 'Tạm ngừng'}</b></header><div><span><small>Loại phòng</small><strong>{room.roomType || 'General'}</strong></span><span><small>Sức chứa</small><strong>{room.capacity} người</strong></span><span className="wide"><small>Vị trí</small><strong><MapPin size={13} />{room.location || 'Chưa cập nhật'}</strong></span></div><button type="button" className="coach-room-detail-trigger" onClick={() => setSelectedRoomId(room.id)}>Xem chi tiết <ChevronRight size={13} /></button></article>)}</div> : <div className="coach-room-state"><DoorOpen size={28} /><strong>Chưa có phòng phù hợp</strong><p>Chưa có dữ liệu phòng theo bộ lọc đã chọn.</p></div>}
    {selectedRoomId !== null && <CoachRoomDetailDialog roomId={selectedRoomId} onClose={() => setSelectedRoomId(null)} />}
  </section>
}
