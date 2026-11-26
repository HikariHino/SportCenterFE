import RoomDialog from './RoomDialog'
import useExclusiveAction from '../../hooks/useExclusiveAction'
import useSlidingPill from '../../hooks/useSlidingPill'
import ManagerFormError from './ManagerFormError'
import { ManagerList } from './ManagerPagination'
import { useManagerResource, useManagerViewActive } from '../../contexts/ManagerWorkspaceContext'
import { useEffect, useId, useMemo, useState } from 'react'
import { AlertCircle, AlertTriangle, ArrowDownToLine, Calendar, CheckCircle2, Clock, DoorOpen, Dumbbell, Edit2, Filter, Grid, List, MapPin, Plus, Power, RefreshCw, Search, ShieldCheck, Trash2, Users, Volleyball, Waves, X, Zap } from "lucide-react"
import {
  checkRoomAvailability,
  createRoom,
  deleteRoom,
  getRoomErrorMessage,
  getRooms,
  updateRoom,
} from '../../services/roomService'
import '../../style/CenterManager/RoomManagement.css'
import '../../style/CenterManager/ManagerTabMotion.css'
import RoomTimetableDialog from './RoomTimetableDialog'
import { getManagerFormValidationError, MANAGER_FORM_LIMITS } from '../../utils/managerFormValidation'

const ROOM_TYPE_OPTIONS = [
  { value: 'Yoga', label: 'Phòng Yoga / Pilates', icon: Zap, iconClass: 'yoga' },
  { value: 'Gym', label: 'Phòng Gym / Thể hình', icon: Dumbbell, iconClass: 'gym' },
  { value: 'Boxing', label: 'Phòng Boxing / Võ thuật', icon: ShieldCheck, iconClass: 'yoga' },
  { value: 'Bơi lội', label: 'Bể bơi / Swimming Pool', icon: Waves, iconClass: 'pool' },
  { value: 'Cầu lông', label: 'Sân Cầu lông', icon: Volleyball, iconClass: 'court' },
  { value: 'Pickleball', label: 'Sân Pickleball', icon: Volleyball, iconClass: 'court' },
  { value: 'Tennis', label: 'Sân Tennis', icon: Volleyball, iconClass: 'court' },
  { value: 'Bóng đá', label: 'Sân Bóng đá Mini', icon: Volleyball, iconClass: 'court' },
  { value: 'General', label: 'Phòng tập Đa năng', icon: DoorOpen, iconClass: 'general' },
]

function getRoomTypeIcon(roomType) {
  const lower = (roomType || '').toLowerCase()
  if (lower.includes('yoga') || lower.includes('pilates')) {
    return <Zap size={22} />
  }
  if (lower.includes('gym') || lower.includes('thể hình') || lower.includes('fitness')) {
    return <Dumbbell size={22} />
  }
  if (lower.includes('bơi') || lower.includes('pool') || lower.includes('swim')) {
    return <Waves size={22} />
  }
  if (
    lower.includes('sân') ||
    lower.includes('court') ||
    lower.includes('cầu lông') ||
    lower.includes('pickleball') ||
    lower.includes('tennis') ||
    lower.includes('bóng đá')
  ) {
    return <Volleyball size={22} />
  }
  return <DoorOpen size={22} />
}

function getRoomIconClass(roomType) {
  const lower = (roomType || '').toLowerCase()
  if (lower.includes('yoga') || lower.includes('pilates')) return 'yoga'
  if (lower.includes('gym') || lower.includes('thể hình')) return 'gym'
  if (lower.includes('bơi') || lower.includes('swim')) return 'pool'
  if (
    lower.includes('sân') ||
    lower.includes('court') ||
    lower.includes('cầu lông') ||
    lower.includes('pickleball') ||
    lower.includes('tennis') ||
    lower.includes('bóng')
  ) {
    return 'court'
  }
  return 'general'
}

const toLocalInputString = (d) => {
  if (!d) return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function RoomManagement() {
  const exclusiveAction = useExclusiveAction()
  const fieldId = useId()
  const viewActive = useManagerViewActive()

  const [localError, setError] = useState('')
  const [success, setSuccess] = useState('')

  // View & Filters
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'table'
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL') // 'ALL' | 'ACTIVE' | 'INACTIVE'

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState(null)
  const [deletingRoom, setDeletingRoom] = useState(null)
  const [checkingRoom, setCheckingRoom] = useState(null)
  const [timetableRoom, setTimetableRoom] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Room Form State
  const [roomForm, setRoomForm] = useState({
    name: '',
    roomType: 'General',
    capacity: 30,
    location: '',
    isActive: true,
  })

  // Availability Check State
  const [availForm, setAvailForm] = useState({
    startsAt: '',
    endsAt: '',
  })
  const [availResult, setAvailResult] = useState(null)
  const [checkingAvail, setCheckingAvail] = useState(false)

  // Auto clear success message
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 4500)
      return () => clearTimeout(timer)
    }
  }, [success])

  // Load all rooms from API
  const dataRead = useManagerResource('rooms', getRooms, { initialData: [], paused: submitting })
  const rooms = dataRead.data
  const setRooms = dataRead.setData
  const loading = dataRead.loading
  const error = localError || (!dataRead.hasData && dataRead.error ? getRoomErrorMessage(dataRead.error) : '')
  const loadRooms = () => { setError(''); return dataRead.reload() }

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return rooms.filter((room) => {
      const matchesQuery =
        !q ||
        room.name.toLowerCase().includes(q) ||
        (room.roomType && room.roomType.toLowerCase().includes(q)) ||
        (room.location && room.location.toLowerCase().includes(q))

      const matchesType =
        typeFilter === 'ALL' || (room.roomType && room.roomType.toLowerCase() === typeFilter.toLowerCase())

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && room.isActive) ||
        (statusFilter === 'INACTIVE' && !room.isActive)

      return matchesQuery && matchesType && matchesStatus
    })
  }, [rooms, searchQuery, typeFilter, statusFilter])

  // Stats
  const activeRoomsCount = rooms.filter((r) => r.isActive !== false).length
  const inactiveRoomsCount = rooms.length - activeRoomsCount
  const statusPill = useSlidingPill(`${statusFilter}:${activeRoomsCount}:${inactiveRoomsCount}:${loading}`, viewActive)
  const totalCapacity = rooms.reduce((sum, r) => sum + (Number(r.capacity) || 0), 0)
  const hasFilters = Boolean(searchQuery.trim() || typeFilter !== 'ALL' || statusFilter !== 'ALL')
  const resetFilters = () => { setSearchQuery(''); setTypeFilter('ALL'); setStatusFilter('ALL') }

  // Open Create Modal
  const handleOpenCreate = () => {
    setRoomForm({
      name: '',
      roomType: 'General',
      capacity: 30,
      location: 'Tầng 1 - Khu A',
      isActive: true,
    })
    setShowCreateModal(true)
    setError('')
  }

  // Open Edit Modal
  const handleOpenEdit = (room) => {
    setEditingRoom(room)
    setRoomForm({
      name: room.name || '',
      roomType: room.roomType || 'General',
      capacity: room.capacity || 30,
      location: room.location || '',
      isActive: room.isActive !== false,
    })
    setError('')
  }

  // Open Delete Modal
  const handleOpenDelete = (room) => {
    setDeletingRoom(room)
    setError('')
  }

  // Open Check Availability Modal
  const handleOpenCheck = (room) => {
    setError('')
    setCheckingRoom(room)
    setAvailResult(null)
    const now = new Date()
    now.setHours(now.getHours() + 1, 0, 0, 0)
    const end = new Date(now)
    end.setHours(now.getHours() + 1, 30, 0, 0)

    setAvailForm({
      startsAt: toLocalInputString(now),
      endsAt: toLocalInputString(end),
    })
  }

  // Submit Create Room
  const handleCreateSubmit = exclusiveAction(async (e) => {
    e.preventDefault()
    const validationError = getManagerFormValidationError('room', roomForm)
    if (validationError) { setError(validationError); return }
    if (!roomForm.name.trim()) {
      setError('Vui lòng nhập tên phòng tập / cơ sở vật chất.')
      return
    }
    if (!roomForm.capacity || roomForm.capacity < 1) {
      setError('Sức chứa tối thiểu của phòng phải từ 1 người trở lên.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const created = await createRoom(roomForm)
      setRooms((prev) => [...prev, created])
      setShowCreateModal(false)
      setSuccess(`Đã tạo phòng tập "${created.name}" thành công!`)
    } catch (err) {
      setError(getRoomErrorMessage(err, 'Không thể tạo mới phòng tập.'))
    } finally {
      setSubmitting(false)
    }
  })

  // Submit Edit Room
  const handleEditSubmit = exclusiveAction(async (e) => {
    e.preventDefault()
    const validationError = getManagerFormValidationError('room', roomForm)
    if (validationError) { setError(validationError); return }
    if (!editingRoom) return
    if (!roomForm.name.trim()) {
      setError('Vui lòng nhập tên phòng tập.')
      return
    }
    if (!roomForm.capacity || roomForm.capacity < 1) {
      setError('Sức chứa phòng phải từ 1 người trở lên.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const updated = await updateRoom(editingRoom.id, roomForm)
      setRooms((prev) =>
        prev.map((r) => (r.id === editingRoom.id ? { ...r, ...updated } : r))
      )
      setEditingRoom(null)
      setSuccess(`Đã cập nhật phòng tập "${updated.name}" thành công!`)
    } catch (err) {
      setError(getRoomErrorMessage(err, 'Không thể cập nhật phòng tập.'))
    } finally {
      setSubmitting(false)
    }
  })

  // Submit Delete Room
  const handleDeleteSubmit = exclusiveAction(async () => {
    if (!deletingRoom) return
    setSubmitting(true)
    setError('')
    try {
      await deleteRoom(deletingRoom.id)
      // Soft delete: update local state to inactive
      setRooms((prev) =>
        prev.map((r) => (r.id === deletingRoom.id ? { ...r, isActive: false } : r))
      )
      setDeletingRoom(null)
      setSuccess(`Đã xóa / ngừng hoạt động phòng "${deletingRoom.name}".`)
    } catch (err) {
      setError(getRoomErrorMessage(err, 'Không thể xóa phòng tập.'))
    } finally {
      setSubmitting(false)
    }
  })

  // Quick toggle active
  const handleToggleActive = exclusiveAction(async (room) => {
    const nextActive = !room.isActive
    if (!nextActive) {
      // Prompt confirm deletion
      setDeletingRoom(room)
      return
    }
    try {
      const updated = await updateRoom(room.id, {
        ...room,
        isActive: true,
      })
      setRooms((prev) =>
        prev.map((r) => (r.id === room.id ? { ...r, ...updated } : r))
      )
      setSuccess(`Đã kích hoạt lại phòng "${room.name}".`)
    } catch (err) {
      setError(getRoomErrorMessage(err, 'Không thể kích hoạt lại phòng tập.'))
    }
  })

  // Submit Availability Check
  const handleCheckAvailabilitySubmit = exclusiveAction(async (e) => {
    e.preventDefault()
    if (!checkingRoom) return
    if (!availForm.startsAt || !availForm.endsAt) {
      setError('Vui lòng chọn thời gian bắt đầu và kết thúc.')
      return
    }
    if (new Date(availForm.startsAt) >= new Date(availForm.endsAt)) {
      setError('Thời gian kết thúc phải sau thời gian bắt đầu.')
      return
    }

    setCheckingAvail(true)
    setAvailResult(null)
    try {
      const result = await checkRoomAvailability(
        checkingRoom.id,
        new Date(availForm.startsAt).toISOString(),
        new Date(availForm.endsAt).toISOString()
      )
      setAvailResult(result)
    } catch (err) {
      setError(getRoomErrorMessage(err, 'Không thể kiểm tra lịch trống phòng.'))
    } finally {
      setCheckingAvail(false)
    }
  })

  // Export CSV
  const handleExportCSV = () => {
    const rows = [
      ['Mã phòng', 'Tên phòng/Sân', 'Loại phòng', 'Sức chứa (người)', 'Vị trí', 'Trạng thái'],
      ...filteredRooms.map((r) => [
        `#${r.id}`,
        r.name,
        r.roomType,
        r.capacity,
        r.location || 'Chưa cập nhật',
        r.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động',
      ]),
    ]
    const csvContent =
      '\uFEFF' +
      rows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `danh-sach-phong-tap-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setSuccess('Đã xuất danh sách phòng tập thành công!')
  }

  return (
    <div className="room-mgmt">
      {/* Header */}
      <section className="room-mgmt-header">
        <div>
          <span className="room-eyebrow"><DoorOpen size={15} /> QUẢN LÝ CƠ SỞ</span>
          <h1>Phòng tập & Cơ sở vật chất</h1>
          <p>
            Quản lý không gian tập luyện, sức chứa và lịch sử dụng tại trung tâm.
          </p>
        </div>
        <div className="room-mgmt-actions">
          <button
            type="button"
            className="room-btn room-btn-secondary"
            onClick={handleExportCSV}
            title="Xuất file CSV danh sách phòng"
          >
            <ArrowDownToLine size={15} /> Xuất CSV
          </button>
          <button
            type="button"
            className="room-btn room-btn-secondary"
            onClick={loadRooms}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
          <button
            type="button"
            className="room-btn room-btn-primary"
            onClick={handleOpenCreate}
          >
            <Plus size={16} /> Thêm phòng tập
          </button>
        </div>
      </section>

      {/* Metrics */}
      <section className="room-metrics">
        <article className="room-metric-card">
          <div className="room-metric-icon blue">
            <DoorOpen size={22} />
          </div>
          <div className="room-metric-info">
            <span>Phòng & sân tập</span>
            <strong>{loading ? '—' : rooms.length}</strong>
          </div>
        </article>

        <article className="room-metric-card">
          <div className="room-metric-icon green">
            <CheckCircle2 size={22} />
          </div>
          <div className="room-metric-info">
            <span>Đang hoạt động</span>
            <strong>{loading ? '—' : activeRoomsCount}</strong>
          </div>
        </article>

        <article className="room-metric-card">
          <div className="room-metric-icon amber">
            <Power size={22} />
          </div>
          <div className="room-metric-info">
            <span>Ngừng hoạt động</span>
            <strong>{loading ? '—' : inactiveRoomsCount}</strong>
          </div>
        </article>

        <article className="room-metric-card">
          <div className="room-metric-icon purple">
            <Users size={22} />
          </div>
          <div className="room-metric-info">
            <span>Tổng sức chứa</span>
            <strong>{loading ? '—' : totalCapacity} <small>chỗ</small></strong>
          </div>
        </article>
      </section>

      {/* Notification Alerts */}
      {error && !(showCreateModal || editingRoom || deletingRoom || checkingRoom) && (
        <div className="room-alert room-alert-error" role="alert">
          <div className="room-alert-content">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="room-alert-close"
            onClick={() => setError('')}
            aria-label="Đóng thông báo lỗi"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="room-alert room-alert-success" role="status">
          <div className="room-alert-content">
            <CheckCircle2 size={18} />
            <span>{success}</span>
          </div>
          <button
            type="button"
            className="room-alert-close"
            onClick={() => setSuccess('')}
            aria-label="Đóng thông báo thành công"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <section className="room-directory manager-card" aria-labelledby="room-directory-title">
      <header className="room-directory-heading">
        <div><h3 id="room-directory-title">Danh sách phòng & sân tập</h3><p>Chọn phòng để xem lịch tuần hoặc kiểm tra khung giờ trống.</p></div>
        {hasFilters && <button type="button" className="room-reset-filters" onClick={resetFilters}><X size={14} /> Xóa bộ lọc</button>}
      </header>
      <div className="room-status-tabs manager-smooth-tabs" ref={statusPill.container} role="group" aria-label="Lọc trạng thái phòng">
        <span className="manager-tab-highlight" ref={statusPill.pill} aria-hidden="true" />
        {[
          ['ALL', 'Tất cả', rooms.length],
          ['ACTIVE', 'Hoạt động', activeRoomsCount],
          ['INACTIVE', 'Tạm ngừng', inactiveRoomsCount],
        ].map(([value, label, count]) => <button key={value} type="button" aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)}>
          {label}<span>{loading ? '—' : count}</span>
        </button>)}
      </div>
      <div className="room-toolbar">
        <div className="room-search-box">
          <Search size={16} />
          <input
            type="search"
            className="room-search-input"
            aria-label="Tìm phòng theo tên, loại phòng hoặc vị trí"
            placeholder="Tìm tên phòng, loại phòng, vị trí..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="room-filter-group">
          <label className="room-type-filter"><Filter size={15} />
          <select
            className="room-select"
            aria-label="Lọc loại phòng"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="ALL">Tất cả loại phòng</option>
            {ROOM_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          </label>
          <div className="view-mode-toggle" role="group" aria-label="Kiểu hiển thị phòng">
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Xem dạng thẻ"
              aria-label="Xem dạng thẻ"
              aria-pressed={viewMode === 'grid'}
            >
              <Grid size={16} />
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Xem dạng bảng"
              aria-label="Xem dạng bảng"
              aria-pressed={viewMode === 'table'}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Body: Loading / Empty / Grid / Table */}
      {loading ? (
        <div className="room-loading" role="status">
          <div className="room-spinner" />
          <span>Đang tải dữ liệu phòng tập...</span>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="room-empty">
          <DoorOpen size={40} />
          <strong>{hasFilters ? 'Không có phòng phù hợp' : 'Chưa có phòng tập nào'}</strong>
          <p>{hasFilters ? 'Thử từ khóa khác hoặc xóa bộ lọc để xem tất cả phòng.' : 'Thêm phòng hoặc sân tập để bắt đầu quản lý không gian và lịch sử dụng.'}</p>
          {hasFilters ? <button type="button" className="room-btn room-btn-secondary" onClick={resetFilters}><RefreshCw size={15} /> Xóa bộ lọc</button> :
          <button
            type="button"
            className="room-btn room-btn-primary"
            onClick={handleOpenCreate}
          >
            <Plus size={16} /> Thêm phòng tập ngay
          </button>}
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <ManagerList items={filteredRooms} label="Phòng tập" className="rooms-grid" as="div" showOrdinal={false} resetKey={JSON.stringify([searchQuery,typeFilter,statusFilter])}>{(room) => {
            const isActive = room.isActive !== false
            const iconClass = getRoomIconClass(room.roomType)

            return (
              <article key={room.id} className={`room-card ${isActive ? '' : 'inactive'}`}>
                <div className="room-card-top">
                  <div className={`room-card-icon ${iconClass}`}>
                    {getRoomTypeIcon(room.roomType)}
                  </div>
                  <div className="room-card-title">
                    <h3><button type="button" className="room-name-button room-card-schedule-trigger" title={`Xem thời khóa biểu ${room.name}`} onClick={() => setTimetableRoom(room)}>{room.name}</button></h3>
                    <small>Phòng #{room.id} · {room.roomType || 'Đa năng'}</small>
                  </div>
                  <span className={`room-badge ${isActive ? 'active' : 'inactive'}`}>
                    <i />
                    {isActive ? 'Hoạt động' : 'Ngừng hoạt động'}
                  </span>
                </div>

                <div className="room-details-list">
                  <div className="room-detail-row">
                    <Users size={16} />
                    <div><span>Sức chứa</span><strong>{room.capacity} học viên</strong></div>
                  </div>
                  <div className="room-detail-row">
                    <MapPin size={16} />
                    <div><span>Vị trí</span><strong>{room.location || 'Chưa cập nhật vị trí'}</strong></div>
                  </div>
                </div>

                <div className="room-card-footer">
                  <button
                    type="button"
                    className="room-btn room-card-calendar"
                    title={`Xem thời khóa biểu ${room.name}`}
                    onClick={() => setTimetableRoom(room)}
                  >
                    <Calendar size={13} /> Xem lịch tuần
                  </button>

                  <div className="room-actions">
                    <button type="button" className="room-action-btn" aria-label={`Kiểm tra lịch trống ${room.name}`} title="Kiểm tra lịch trống phòng" onClick={() => handleOpenCheck(room)}><Clock size={15} /></button>
                    <button
                      type="button"
                      className="room-action-btn"
                      title="Chỉnh sửa thông tin phòng"
                      aria-label={`Chỉnh sửa ${room.name}`}
                      onClick={() => handleOpenEdit(room)}
                    >
                      <Edit2 size={15} />
                    </button>
                    {isActive ? (
                      <button
                        type="button"
                        className="room-action-btn danger"
                        title="Xóa / Ngừng hoạt động phòng này"
                        aria-label={`Ngừng hoạt động ${room.name}`}
                        onClick={() => handleOpenDelete(room)}
                      >
                        <Trash2 size={15} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="room-action-btn info"
                        title="Kích hoạt lại phòng này"
                        aria-label={`Kích hoạt lại ${room.name}`}
                        onClick={() => handleToggleActive(room)}
                      >
                        <Power size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            )
          }}</ManagerList>
      ) : (
        /* TABLE VIEW */
        <div className="room-table-container" role="region" aria-label="Danh sách phòng dạng bảng, có thể cuộn ngang" tabIndex={0}>
          <ManagerList items={filteredRooms} label="Phòng tập" table className="room-table" resetKey={JSON.stringify([searchQuery,typeFilter,statusFilter])} heading={<tr><th scope="col" className="manager-stt">STT</th>
                <th>MÃ PHÒNG</th>
                <th>TÊN PHÒNG / SÂN TẬP</th>
                <th>LOẠI PHÒNG</th>
                <th>SỨC CHỨA</th>
                <th>VỊ TRÍ</th>
                <th>TRẠNG THÁI</th>
                <th style={{ textAlign: 'right' }}>THAO TÁC</th>
              </tr>}>{(room) => {
                const isActive = room.isActive !== false
                return (
                  <tr key={room.id}>
                    <td><strong>#{room.id}</strong></td>
                    <td>
                      <button type="button" className="room-name-button" title={`Xem thời khóa biểu ${room.name}`} onClick={() => setTimetableRoom(room)}>{room.name}</button>
                    </td>
                    <td>
                      <span className="room-type-tag">{room.roomType || 'Đa năng'}</span>
                    </td>
                    <td>
                      <strong>{room.capacity}</strong> người
                    </td>
                    <td>{room.location || '—'}</td>
                    <td>
                      <span className={`room-badge ${isActive ? 'active' : 'inactive'}`}>
                        <i />
                        {isActive ? 'Hoạt động' : 'Ngừng hoạt động'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button type="button" className="room-action-btn" title={`Xem thời khóa biểu ${room.name}`} onClick={() => setTimetableRoom(room)}><Calendar size={14} /></button>
                        <button
                          type="button"
                          className="room-action-btn"
                          title="Kiểm tra lịch trống phòng"
                          onClick={() => handleOpenCheck(room)}
                        >
                          <Clock size={14} />
                        </button>
                        <button
                          type="button"
                          className="room-action-btn"
                          title="Chỉnh sửa phòng"
                          onClick={() => handleOpenEdit(room)}
                        >
                          <Edit2 size={14} />
                        </button>
                        {isActive ? (
                          <button
                            type="button"
                            className="room-action-btn danger"
                            title="Xóa / Ngừng hoạt động"
                            onClick={() => handleOpenDelete(room)}
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="room-action-btn info"
                            title="Kích hoạt lại"
                            onClick={() => handleToggleActive(room)}
                          >
                            <Power size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              }}</ManagerList>
        </div>
      )}
      <footer className="room-directory-footer" role="status">
        <span>{loading ? 'Đang tải danh sách...' : <>Hiển thị <strong>{filteredRooms.length}</strong> / {rooms.length} phòng & sân tập</>}</span>
        <span><Calendar size={14} /> Lịch sử dụng được xem theo từng phòng</span>
      </footer>
      </section>

      {viewActive && timetableRoom && <RoomTimetableDialog room={timetableRoom} rooms={rooms} onClose={() => setTimetableRoom(null)} />}

      {/* ======================================================== */}
      {/* MODAL: CREATE ROOM */}
      {/* ======================================================== */}
      {viewActive && showCreateModal && (
        <RoomDialog label="Thêm phòng tập" busy={submitting} onClose={() => setShowCreateModal(false)}>
            <div className="room-modal-header">
              <h3>Thêm phòng / sân tập mới</h3>
              <button aria-label="Đóng cửa sổ" disabled={submitting}
                type="button"
                className="room-modal-close"
                onClick={() => setShowCreateModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="room-modal-body">
                <ManagerFormError message={error} />
                <div className="room-form-group">
                  <label htmlFor={fieldId + '-create-name'}>
                    Tên phòng / sân tập <span className="required">*</span>
                  </label>
                  <input id={fieldId + '-create-name'}
                    type="text"
                    className="room-form-input"
                    placeholder="Ví dụ: Phòng Yoga 01, Sân Pickleball P01, Phòng Gym VIP..."
                    maxLength={MANAGER_FORM_LIMITS.room.name}
                    value={roomForm.name}
                    onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>

                <div className="room-form-group">
                  <label htmlFor={fieldId + '-create-roomType'}>Loại hình phòng tập</label>
                  <select id={fieldId + '-create-roomType'}
                    className="room-form-select"
                    value={roomForm.roomType}
                    onChange={(e) => setRoomForm({ ...roomForm, roomType: e.target.value })}
                  >
                    {ROOM_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="room-type-chips">
                    <span style={{ fontSize: 'calc(16px + var(--font-size-adjustment, 0px))', color: 'var(--manager-muted)', alignSelf: 'center' }}>
                      Chọn nhanh:
                    </span>
                    {ROOM_TYPE_OPTIONS.slice(0, 5).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className="room-chip-btn"
                        onClick={() => setRoomForm({ ...roomForm, roomType: opt.value })}
                      >
                        {opt.value}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="room-form-grid-2">
                  <div className="room-form-group">
                    <label htmlFor={fieldId + '-create-capacity'}>
                      Sức chứa tối đa (Capacity) <span className="required">*</span>
                    </label>
                    <input id={fieldId + '-create-capacity'}
                      type="number"
                      min="1"
                      max="500"
                      className="room-form-input"
                      value={roomForm.capacity}
                      onChange={(e) =>
                        setRoomForm({ ...roomForm, capacity: Number(e.target.value) })
                      }
                      required
                    />
                    <span className="room-form-help">Số người tối đa (1 - 500)</span>
                  </div>

                  <div className="room-form-group">
                    <label htmlFor={fieldId + '-create-location'}>Vị trí / Khu vực</label>
                    <input id={fieldId + '-create-location'}
                      type="text"
                      className="room-form-input"
                      placeholder="Ví dụ: Tầng 2 - Tòa A"
                      maxLength={MANAGER_FORM_LIMITS.room.location}
                      value={roomForm.location}
                      onChange={(e) => setRoomForm({ ...roomForm, location: e.target.value })}
                    />
                    <span className="room-form-help">Tùy chọn ghi chú vị trí</span>
                  </div>
                </div>
              </div>
              <div className="room-modal-footer">
                <button
                  type="button"
                  className="room-btn room-btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="room-btn room-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Đang tạo...' : 'Tạo phòng tập'}
                </button>
              </div>
            </form>
          </RoomDialog>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT ROOM */}
      {/* ======================================================== */}
      {viewActive && editingRoom && (
        <RoomDialog label="Chỉnh sửa phòng tập" busy={submitting} onClose={() => setEditingRoom(null)}>
            <div className="room-modal-header">
              <h3>Chỉnh sửa phòng tập: #{editingRoom.id}</h3>
              <button aria-label="Đóng cửa sổ" disabled={submitting}
                type="button"
                className="room-modal-close"
                onClick={() => setEditingRoom(null)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="room-modal-body">
                <ManagerFormError message={error} />
                <div className="room-form-group">
                  <label htmlFor={fieldId + '-edit-name'}>
                    Tên phòng / sân tập <span className="required">*</span>
                  </label>
                  <input id={fieldId + '-edit-name'}
                    type="text"
                    className="room-form-input"
                    maxLength={MANAGER_FORM_LIMITS.room.name}
                    value={roomForm.name}
                    onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="room-form-group">
                  <label htmlFor={fieldId + '-edit-roomType'}>Loại hình phòng tập</label>
                  <select id={fieldId + '-edit-roomType'}
                    className="room-form-select"
                    value={roomForm.roomType}
                    onChange={(e) => setRoomForm({ ...roomForm, roomType: e.target.value })}
                  >
                    {ROOM_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="room-form-grid-2">
                  <div className="room-form-group">
                    <label htmlFor={fieldId + '-edit-capacity'}>
                      Sức chứa tối đa <span className="required">*</span>
                    </label>
                    <input id={fieldId + '-edit-capacity'}
                      type="number"
                      min="1"
                      max="500"
                      className="room-form-input"
                      value={roomForm.capacity}
                      onChange={(e) =>
                        setRoomForm({ ...roomForm, capacity: Number(e.target.value) })
                      }
                      required
                    />
                  </div>

                  <div className="room-form-group">
                    <label htmlFor={fieldId + '-edit-location'}>Vị trí</label>
                    <input id={fieldId + '-edit-location'}
                      type="text"
                      className="room-form-input"
                      maxLength={MANAGER_FORM_LIMITS.room.location}
                      value={roomForm.location}
                      onChange={(e) => setRoomForm({ ...roomForm, location: e.target.value })}
                    />
                  </div>
                </div>

                <div className="room-form-group">
                  <label className="room-form-checkbox">
                    <input
                      type="checkbox"
                      checked={roomForm.isActive}
                      onChange={(e) => setRoomForm({ ...roomForm, isActive: e.target.checked })}
                    />
                    <span>Kích hoạt phòng tập (Sẵn sàng xếp lịch)</span>
                  </label>
                  <span className="room-form-help">
                    Tắt kích hoạt sẽ ngăn không cho các buổi học mới xếp vào phòng này.
                  </span>
                </div>
              </div>
              <div className="room-modal-footer">
                <button
                  type="button"
                  className="room-btn room-btn-secondary"
                  onClick={() => setEditingRoom(null)}
                  disabled={submitting}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="room-btn room-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </RoomDialog>
      )}

      {/* ======================================================== */}
      {/* MODAL: DELETE ROOM CONFIRMATION */}
      {/* ======================================================== */}
      {viewActive && deletingRoom && (
        <RoomDialog label="Ngừng hoạt động phòng tập" busy={submitting} onClose={() => setDeletingRoom(null)}>
            <div className="room-modal-header">
              <h3>Xóa / Ngừng hoạt động phòng tập</h3>
              <button aria-label="Đóng cửa sổ" disabled={submitting}
                type="button"
                className="room-modal-close"
                onClick={() => setDeletingRoom(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="room-modal-body">
              <ManagerFormError message={error} />
              <p style={{ margin: 0, fontSize: 'calc(18px + var(--font-size-adjustment, 0px))', lineHeight: 1.6 }}>
                Bạn có chắc chắn muốn xóa phòng <strong>"{deletingRoom.name}"</strong> (Mã: #{deletingRoom.id})?
              </p>
              <div className="room-alert room-alert-error" style={{ margin: '10px 0 0' }}>
                <AlertTriangle size={18} />
                <span>
                  Hệ thống sẽ thực hiện chuyển trạng thái phòng sang ngừng hoạt động (Soft Delete) để bảo toàn lịch sử dữ liệu.
                  Nếu phòng đang có buổi học diễn ra trong tương lai, thao tác xóa sẽ bị từ chối.
                </span>
              </div>
            </div>
            <div className="room-modal-footer">
              <button
                type="button"
                className="room-btn room-btn-secondary"
                onClick={() => setDeletingRoom(null)}
                disabled={submitting}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="room-btn room-btn-danger"
                onClick={handleDeleteSubmit}
                disabled={submitting}
              >
                {submitting ? 'Đang xóa...' : 'Xác nhận xóa phòng'}
              </button>
            </div>
          </RoomDialog>
      )}

      {/* ======================================================== */}
      {/* MODAL: CHECK ROOM AVAILABILITY */}
      {/* ======================================================== */}
      {viewActive && checkingRoom && (
        <RoomDialog label="Kiểm tra lịch trống phòng" busy={checkingAvail} onClose={() => setCheckingRoom(null)}>
            <div className="room-modal-header">
              <div>
                <h3>Kiểm tra lịch trống phòng</h3>
                <small style={{ color: 'var(--manager-muted)' }}>
                  Phòng: <strong>{checkingRoom.name}</strong> (#{checkingRoom.id})
                </small>
              </div>
              <button aria-label="Đóng cửa sổ" disabled={checkingAvail}
                type="button"
                className="room-modal-close"
                onClick={() => setCheckingRoom(null)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCheckAvailabilitySubmit}>
              <div className="room-modal-body">
                <ManagerFormError message={error} />
                <p style={{ margin: 0, fontSize: 'calc(17px + var(--font-size-adjustment, 0px))', color: 'var(--manager-muted)' }}>
                  Kiểm tra xem phòng có bị trùng với bất kỳ buổi học nào trong khung thời gian dự kiến hay không.
                </p>

                <div className="room-form-grid-2">
                  <div className="room-form-group">
                    <label htmlFor={fieldId + '-availability-startsAt'}>
                      Khung giờ bắt đầu <span className="required">*</span>
                    </label>
                    <input id={fieldId + '-availability-startsAt'}
                      type="datetime-local"
                      className="room-form-input"
                      value={availForm.startsAt}
                      onChange={(e) => setAvailForm({ ...availForm, startsAt: e.target.value })}
                      required
                    />
                  </div>

                  <div className="room-form-group">
                    <label htmlFor={fieldId + '-availability-endsAt'}>
                      Khung giờ kết thúc <span className="required">*</span>
                    </label>
                    <input id={fieldId + '-availability-endsAt'}
                      type="datetime-local"
                      className="room-form-input"
                      value={availForm.endsAt}
                      onChange={(e) => setAvailForm({ ...availForm, endsAt: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {availResult && (
                  <div
                    className={`availability-result-box ${
                      availResult.isAvailable ? 'free' : 'busy'
                    }`}
                  >
                    {availResult.isAvailable ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <AlertTriangle size={18} />
                    )}
                    <div>
                      <strong>
                        {availResult.isAvailable
                          ? 'Phòng còn trống!'
                          : 'Phòng đã có lịch học trùng!'}
                      </strong>
                      <div style={{ fontSize: 'calc(16px + var(--font-size-adjustment, 0px))', marginTop: 2 }}>
                        {availResult.message}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="room-modal-footer">
                <button
                  type="button"
                  className="room-btn room-btn-secondary"
                  onClick={() => setCheckingRoom(null)}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="room-btn room-btn-primary"
                  disabled={checkingAvail}
                >
                  {checkingAvail ? 'Đang kiểm tra...' : 'Kiểm tra ngay'}
                </button>
              </div>
            </form>
          </RoomDialog>
      )}
    </div>
  )
}
