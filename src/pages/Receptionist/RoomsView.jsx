import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Ban, CalendarClock, CalendarDays, CheckCircle2, DoorOpen, Layers3, MapPin, Power, RefreshCw, Search, UsersRound, X } from 'lucide-react'
import { checkRoomAvailability, getRoomById, getRoomErrorMessage, getRooms } from '../../services/roomService'
import { getReceptionistClasses, getReceptionistClassSessionsByClass } from '../../services/receptionistCatalogService'
import WeeklyTimetable from '../../components/WeeklyTimetable'
import { timetableWeekStart } from '../../utils/memberTimetable'
import { roomSessionForTimetable } from '../../utils/roomTimetable'
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

async function loadEveryPage(requestPage) {
  const pageSize = 100
  const first = await requestPage(1, pageSize)
  const items = [...first.items]
  const pageCount = Math.ceil(first.total / pageSize)
  for (let page = 2; page <= pageCount; page += 1) {
    const result = await requestPage(page, pageSize)
    items.push(...result.items)
  }
  return items
}

async function loadRoomSchedule(room, rooms) {
  const classes = await loadEveryPage((page, pageSize) => getReceptionistClasses({ page, pageSize }))
  const result = []
  for (let offset = 0; offset < classes.length; offset += 4) {
    const batch = await Promise.all(classes.slice(offset, offset + 4).map(async sportClass => {
      const sessions = await loadEveryPage((page, pageSize) => getReceptionistClassSessionsByClass(sportClass.id, { page, pageSize }))
      return sessions.map(session => roomSessionForTimetable(session, sportClass, rooms, room)).filter(Boolean)
    }))
    result.push(...batch.flat())
  }
  return result.sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
}

const sessionDateTime = value => value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : 'Chưa cập nhật'

function RoomSchedule({ room, rooms, onClose, onOpenSessions }) {
  const [weekStart, setWeekStart] = useState(() => timetableWeekStart())
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const selected = items.find(item => String(item.id) === String(selectedId))
  const { scheduledItems, cancelledItems } = useMemo(() => {
    const scheduled = []
    const cancelled = []
    items.forEach(item => {
      const status = String(item.status || item.sessionStatus || '').toLowerCase()
      if (status === 'cancelled' || status === 'canceled') cancelled.push(item)
      else scheduled.push(item)
    })
    cancelled.sort((left, right) => Date.parse(right.startsAt) - Date.parse(left.startsAt))
    return { scheduledItems: scheduled, cancelledItems: cancelled }
  }, [items])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setSelectedId(null)
    loadRoomSchedule(room, rooms).then(result => {
      if (active) setItems(result)
    }).catch(requestError => {
      if (active) setError(getRoomErrorMessage(requestError, 'Không thể tải lịch sử dụng phòng.'))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [requestKey, room, rooms])

  return <section className="reception-room-schedule" aria-label={`Lịch sử dụng ${room.name}`}>
    <header className="reception-room-schedule-header">
      <div><span><CalendarDays size={16} />LỊCH SỬ DỤNG PHÒNG</span><h2>{room.name}</h2><p><MapPin size={15} />{room.location || 'Chưa cập nhật vị trí'}<i>·</i><UsersRound size={15} />{room.capacity} học viên</p></div>
      <div><button type="button" className="primary" onClick={onOpenSessions}><CalendarDays size={17} />Nghiệp vụ buổi học</button><button type="button" disabled={loading} onClick={() => setRequestKey(key => key + 1)}><RefreshCw size={17} />Làm mới</button><button type="button" aria-label="Đóng lịch phòng" onClick={onClose}><X size={21} /></button></div>
    </header>

    {loading ? <div className="reception-room-schedule-state"><ViewLoader /></div> : error ? <div className="reception-room-schedule-state" role="alert"><AlertCircle size={30} /><strong>Không thể tải lịch phòng</strong><p>{error}</p><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : <>
      <WeeklyTimetable items={scheduledItems} weekStart={weekStart} onWeekChange={value => { setWeekStart(value); setSelectedId(null) }} onSelect={setSelectedId} totalCount={scheduledItems.length} title="Thời khóa biểu của phòng" description="Chỉ hiển thị các buổi đang sử dụng lịch phòng · Chọn buổi học để xem chi tiết" />
      <section className="reception-room-cancelled" aria-labelledby="reception-room-cancelled-title">
        <header><div><span><Ban size={15} />LỊCH ĐÃ HỦY</span><h3 id="reception-room-cancelled-title">Buổi học đã hủy</h3><p>Các buổi đã hủy không còn chiếm thời gian sử dụng phòng.</p></div><strong>{cancelledItems.length} buổi</strong></header>
        {cancelledItems.length ? <div className="reception-room-cancelled-list">{cancelledItems.map(item => <button type="button" key={item.id} onClick={() => setSelectedId(item.id)}>
          <span><small>BUỔI #{item.id}</small><b>{item.className || `Buổi học #${item.id}`}</b></span>
          <span><small>THỜI GIAN</small><b>{sessionDateTime(item.startsAt)}</b></span>
          <span><small>HUẤN LUYỆN VIÊN</small><b>{item.coachName || 'Chưa phân công'}</b></span>
          <span><small>LÝ DO HỦY</small><b>{item.cancellationReason || 'Chưa cập nhật lý do'}</b></span>
        </button>)}</div> : <div className="reception-room-cancelled-empty"><CheckCircle2 size={20} /><span>Phòng chưa có buổi học nào bị hủy.</span></div>}
      </section>
      {selected && <article className="reception-room-session-detail">
        <header><div><small>BUỔI HỌC #{selected.id}</small><h3>{selected.className}</h3></div><button type="button" aria-label="Đóng chi tiết buổi học" onClick={() => setSelectedId(null)}><X size={17} /></button></header>
        <dl><div><dt>Bộ môn</dt><dd>{selected.sportName || 'Chưa cập nhật'}</dd></div><div><dt>Huấn luyện viên</dt><dd>{selected.coachName || 'Chưa phân công'}</dd></div><div><dt>Bắt đầu</dt><dd>{sessionDateTime(selected.startsAt)}</dd></div><div><dt>Kết thúc</dt><dd>{sessionDateTime(selected.endsAt)}</dd></div><div><dt>Sĩ số / Sức chứa</dt><dd>{selected.currentEnrollment ?? selected.registeredCount ?? 0} / {selected.capacity ?? room.capacity}</dd></div><div><dt>Trạng thái</dt><dd>{selected.status || 'Scheduled'}</dd></div></dl>
      </article>}
    </>}
  </section>
}

export function RoomsView({ query = '', onOpenSessions }) {
  const [rooms, setRooms] = useState([])
  const [status, setStatus] = useState('all')
  const [roomType, setRoomType] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)
  const [selectedRoomId, setSelectedRoomId] = useState(null)
  const [scheduleRoom, setScheduleRoom] = useState(null)

  useEffect(() => {
    let active = true
    const loadRooms = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getRooms()
        if (active) setRooms(result)
      } catch (requestError) {
        if (active) setError(getRoomErrorMessage(requestError, 'Không thể tải danh sách phòng.'))
      } finally {
        if (active) setLoading(false)
      }
    }
    loadRooms()
    return () => { active = false }
  }, [requestKey])

  const filteredRooms = useMemo(() => {
    const keyword = `${query} ${search}`.trim().toLocaleLowerCase('vi-VN')
    return rooms.filter(room => {
      const matchesKeyword = !keyword || [room.name, room.roomType, room.location, room.id].some(value => String(value ?? '').toLocaleLowerCase('vi-VN').includes(keyword))
      const matchesStatus = status === 'all' || (status === 'active' ? room.isActive !== false : room.isActive === false)
      const matchesType = roomType === 'all' || String(room.roomType || 'General') === roomType
      return matchesKeyword && matchesStatus && matchesType
    })
  }, [query, roomType, rooms, search, status])
  const roomTypes = useMemo(() => [...new Set(rooms.map(room => room.roomType || 'General'))].sort((left, right) => left.localeCompare(right, 'vi')), [rooms])
  const activeCount = rooms.filter(room => room.isActive !== false).length
  const inactiveCount = rooms.length - activeCount
  const totalCapacity = rooms.reduce((total, room) => total + Number(room.capacity || 0), 0)

  if (scheduleRoom) return <RoomSchedule room={scheduleRoom} rooms={rooms} onClose={() => setScheduleRoom(null)} onOpenSessions={onOpenSessions} />

  return <div className="reception-facility-rooms">
    <section className="reception-facility-metrics" aria-label="Thống kê phòng tập">
      <article><span className="blue"><DoorOpen size={22} /></span><div><small>Tổng số phòng & sân tập</small><strong>{rooms.length}</strong></div></article>
      <article><span className="green"><CheckCircle2 size={22} /></span><div><small>Đang hoạt động (Sẵn sàng)</small><strong>{activeCount}</strong></div></article>
      <article><span className="amber"><Power size={22} /></span><div><small>Đã khóa / Ngừng sử dụng</small><strong>{inactiveCount}</strong></div></article>
      <article><span className="purple"><UsersRound size={22} /></span><div><small>Tổng sức chứa trung tâm</small><strong>{totalCapacity} <i>chỗ</i></strong></div></article>
    </section>

    <section className="reception-card reception-room-catalog reception-facility-catalog">
      <div className="reception-card-head"><div><span>DANH MỤC CƠ SỞ</span><h2>Phòng tập và khu chức năng</h2></div><button type="button" disabled={loading} onClick={() => setRequestKey(key => key + 1)}><RefreshCw size={14} />Làm mới</button></div>
      <div className="reception-facility-toolbar">
        <label className="reception-facility-search"><Search size={17} /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm theo tên phòng, loại phòng hoặc vị trí..." aria-label="Tìm phòng tập" /></label>
        <div><label><Layers3 size={15} /><select value={roomType} onChange={event => setRoomType(event.target.value)} aria-label="Lọc loại phòng"><option value="all">Tất cả loại phòng</option>{roomTypes.map(type => <option value={type} key={type}>{type}</option>)}</select></label><label><CheckCircle2 size={15} /><select value={status} onChange={event => setStatus(event.target.value)} aria-label="Lọc trạng thái phòng"><option value="all">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="inactive">Ngừng hoạt động</option></select></label></div>
      </div>
      {error && <div className="reception-filter-error"><span>{error}</span><button type="button" onClick={() => setRequestKey(key => key + 1)}><RefreshCw size={12} />Thử lại</button></div>}
      {loading ? <ViewLoader /> : !filteredRooms.length ? <div className="reception-empty"><span><DoorOpen size={24} /></span><strong>Không tìm thấy phòng</strong><p>Thử đổi trạng thái, loại phòng hoặc từ khóa tìm kiếm.</p></div> : <div className="reception-facility-room-grid">{filteredRooms.map(room => <article key={room.id} className={room.isActive === false ? 'inactive' : ''}>
        <header><span><DoorOpen size={21} /></span><div><h3>{room.name}</h3><small>Mã phòng: #{room.id} · Xem lịch tuần</small></div><b className={room.isActive !== false ? 'active' : 'inactive'}><i />{room.isActive !== false ? 'Hoạt động' : 'Đã khóa'}</b></header>
        <dl><div><dt><Layers3 size={14} />Loại</dt><dd>{room.roomType || 'General'}</dd></div><div><dt><UsersRound size={14} />Sức chứa</dt><dd>{room.capacity} học viên</dd></div><div><dt><MapPin size={14} />Vị trí</dt><dd>{room.location || 'Chưa cập nhật'}</dd></div></dl>
        <footer><button type="button" className="primary" onClick={() => setScheduleRoom(room)}><CalendarDays size={15} />Xem lịch tuần</button><button type="button" onClick={() => setSelectedRoomId(room.id)}><CalendarClock size={15} />Kiểm tra lịch</button></footer>
      </article>)}</div>}
    </section>
    {selectedRoomId && <RoomDetailDialog roomId={selectedRoomId} onClose={() => setSelectedRoomId(null)} />}
  </div>
}
