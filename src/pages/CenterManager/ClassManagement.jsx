import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  BookOpen,
  Calendar,
  CalendarX2,
  CheckCircle2,
  Clock,
  DoorOpen,
  Dumbbell,
  Edit,
  Edit2,
  Eye,
  Flame,
  Layers,
  Plus,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  Trophy,
  UserCheck,
  Users,
  X,
  Zap,
} from 'lucide-react'
import {
  createSport,
  getCoaches,
  getSports,
  updateSport,
} from '../../services/classCatalogService'
import {
  cancelClassSession,
  completeClassSession,
  createClassSession,
  createSportClass,
  getClassErrorMessage,
  getAllClassSessions,
  getManagedClassesWithSessionDates,
  getRooms,
  getSessionRoster,
  updateClassSession,
  updateSportClass,
} from '../../services/sportClassService'
import { validateSessionWrite } from '../../services/sessionSchedulingService'
import { assignClassToRoom } from '../../services/roomTimetableService'
import { SESSION_COMPLETION_EVENT } from '../../services/sessionCompletionService'
import { getClassSessionDateRange } from '../../utils/classSessionDates'
import { classDateInput } from '../../utils/classForm'
import { shiftTimetableDate, timetableDateKey } from '../../utils/memberTimetable'
import ClassCourseFields from './ClassCourseFields'
import ClassSessionGroups from './ClassSessionGroups'
import CancelClassSessionsDialog from './CancelClassSessionsDialog'
import CloseClassDialog from './CloseClassDialog'
import { applyRoomSessionCancellations } from '../../utils/roomTimetable'
import '../../style/CenterManager/ClassManagement.css'

// Sport icon helper based on keywords
function getSportIcon(name) {
  const lower = (name || '').toLowerCase()
  if (lower.includes('gym') || lower.includes('thể hình') || lower.includes('fitness')) {
    return <Dumbbell size={22} />
  }
  if (lower.includes('yoga') || lower.includes('pilates')) {
    return <Zap size={22} />
  }
  if (lower.includes('boxing') || lower.includes('võ') || lower.includes('kick')) {
    return <Flame size={22} />
  }
  if (lower.includes('bơi') || lower.includes('swim')) {
    return <WavesIcon size={22} />
  }
  return <Trophy size={22} />
}

function WavesIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    </svg>
  )
}

const formatDateTime = (dateStr) => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

const formatSessionDate = value => new Date(value).toLocaleDateString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
})

const toLocalInputString = (isoDate) => {
  if (!isoDate) return ''
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Trích xuất phòng tập đã gán cho lớp học từ roomId, roomName hoặc chuỗi schedule
 */
export function getRoomForClass(cls, roomsList = []) {
  if (!cls) return null
  if (cls.roomId) {
    const found = roomsList.find((r) => r.id === Number(cls.roomId))
    if (found) return found
  }
  if (cls.roomName) {
    const found = roomsList.find((r) => r.name?.toLowerCase() === cls.roomName?.toLowerCase())
    if (found) return found
  }
  if (cls.schedule) {
    // Check [Phòng: XYZ] or [XYZ]
    const match = cls.schedule.match(/\[Phòng:\s*([^\]]+)\]/i) || cls.schedule.match(/\[([^\]]+)\]/)
    if (match) {
      const candidate = match[1].trim()
      const found = roomsList.find(
        (r) =>
          r.name?.toLowerCase() === candidate.toLowerCase() ||
          candidate.toLowerCase().includes(r.name?.toLowerCase())
      )
      if (found) return found
      return { id: null, name: candidate }
    }
    // Check pipe format "... | XYZ"
    if (cls.schedule.includes('|')) {
      const parts = cls.schedule.split('|').map((p) => p.trim())
      for (const part of parts) {
        const found = roomsList.find(
          (r) =>
            r.name?.toLowerCase() === part.toLowerCase() ||
            part.toLowerCase().includes(r.name?.toLowerCase())
        )
        if (found) return found
      }
    }
    // Check direct name match in schedule string
    for (const r of roomsList) {
      if (r.name && cls.schedule.toLowerCase().includes(r.name.toLowerCase())) {
        return r
      }
    }
  }
  return null
}

export default function ClassManagement() {
  const [activeTab, setActiveTab] = useState('classes') // 'sports' | 'classes'

  // Master Data
  const [sports, setSports] = useState([])
  const [coaches, setCoaches] = useState([])
  const [rooms, setRooms] = useState([])
  const [classes, setClasses] = useState([])

  // Loading & Error States
  const [loading, setLoading] = useState(true)
  const [classesLoading, setClassesLoading] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Filters for Sports Tab
  const [sportSearch, setSportSearch] = useState('')
  const [sportFilterStatus, setSportFilterStatus] = useState('ALL')

  // Filters for Classes Tab
  const [classSearch, setClassSearch] = useState('')
  const [classSportFilter, setClassSportFilter] = useState('ALL')
  const [classCoachFilter, setClassCoachFilter] = useState('ALL')
  const [classStatusFilter, setClassStatusFilter] = useState('ALL') // 'ALL' | 'ACTIVE' | 'INACTIVE'

  // Modal States for Sports
  const [showCreateSportModal, setShowCreateSportModal] = useState(false)
  const [editingSport, setEditingSport] = useState(null)
  const [togglingSport, setTogglingSport] = useState(null)
  const [submittingSport, setSubmittingSport] = useState(false)

  // Sport Form
  const [sportForm, setSportForm] = useState({
    name: '',
    description: '',
    isActive: true,
  })

  // Modal States for Classes
  const [showCreateClassModal, setShowCreateClassModal] = useState(false)
  const [editingClass, setEditingClass] = useState(null)
  const [deactivatingClass, setDeactivatingClass] = useState(null)
  const [submittingClass, setSubmittingClass] = useState(false)

  // Class Form
  const [classForm, setClassForm] = useState({
    className: '',
    sportId: '',
    coachId: '',
    maxCapacity: 20,
    startDate: '',
    endDate: '',
    isActive: true,
  })

  // Modal States for Sessions
  const [selectedClassForSessions, setSelectedClassForSessions] = useState(null)
  const [sessionsList, setSessionsList] = useState([])
  const [showAddSessionModal, setShowAddSessionModal] = useState(false)
  const [reschedulingSession, setReschedulingSession] = useState(null)
  const [cancellingSession, setCancellingSession] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [submittingSession, setSubmittingSession] = useState(false)
  const [cancellingClass, setCancellingClass] = useState(null)

  // Session Form
  const [sessionForm, setSessionForm] = useState({
    coachId: '',
    roomId: '',
    cancellationPolicyId: 1,
    startsAt: '',
    endsAt: '',
    capacity: 20,
  })
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [availabilityResult, setAvailabilityResult] = useState(null)
  const sessionRoom = rooms.find(room => String(room.id) === String(sessionForm.roomId))
  const sessionCapacityLimit = Math.min(Number(sessionRoom?.capacity) || 0, Number(selectedClassForSessions?.maxCapacity) || 0)
  const invalidSessionCapacity = !Number.isInteger(Number(sessionForm.capacity)) || Number(sessionForm.capacity) < 1 || Number(sessionForm.capacity) > sessionCapacityLimit

  // Roster Modal
  const [rosterSession, setRosterSession] = useState(null)
  const [rosterList, setRosterList] = useState([])
  const [rosterLoading, setRosterLoading] = useState(false)

  // Auto clear success message
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 4500)
      return () => clearTimeout(timer)
    }
  }, [success])

  // Load master data: sports, coaches, rooms
  const loadMasterData = async () => {
    setLoading(true)
    setError('')
    try {
      const [sportsData, coachesData, roomsData] = await Promise.all([
        getSports(),
        getCoaches().catch(() => []),
        getRooms().catch(() => []),
      ])
      setSports(
        sportsData.map((s) => ({
          ...s,
          isActive: s.isActive !== undefined ? s.isActive : true,
        }))
      )
      setCoaches(coachesData)
      setRooms(roomsData)
    } catch (err) {
      setError(getClassErrorMessage(err, 'Không thể tải danh mục thể thao và danh sách huấn luyện viên.'))
    } finally {
      setLoading(false)
    }
  }

  // Load managed classes list
  const loadClasses = async () => {
    setClassesLoading(true)
    try {
      const res = await getManagedClassesWithSessionDates()
      setClasses(res.items || [])
    } catch (err) {
      console.error('Error loading classes:', err)
      setError(getClassErrorMessage(err, 'Không thể tải danh sách lớp học.'))
    } finally {
      setClassesLoading(false)
    }
  }

  // Load sessions for a specific class
  const loadClassSessions = async (classId) => {
    setSessionsLoading(true)
    try {
      const sessions = await getAllClassSessions(classId)
      setSessionsList(sessions)
      setClasses(previous => previous.map(item => String(item.id) === String(classId)
        ? { ...item, sessionDateRange: getClassSessionDateRange(sessions), sessionDatesError: '' }
        : item))
    } catch (err) {
      setClasses(previous => previous.map(item => String(item.id) === String(classId)
        ? { ...item, sessionDateRange: null, sessionDatesError: getClassErrorMessage(err, 'Không thể tải ngày học của lớp.') }
        : item))
      setError(getClassErrorMessage(err, 'Không thể tải danh sách buổi học của lớp.'))
    } finally {
      setSessionsLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    const refresh = event => {
      const classId = selectedClassForSessions?.id
      if (classId != null && event.detail.some(session => String(session.classId) === String(classId))) {
        void loadClassSessions(classId)
      }
    }
    window.addEventListener(SESSION_COMPLETION_EVENT, refresh)
    return () => window.removeEventListener(SESSION_COMPLETION_EVENT, refresh)
  }, [selectedClassForSessions?.id])

  useEffect(() => {
    loadMasterData()
    loadClasses()
  }, [])

  // ==========================================
  // SPORTS CATALOG LOGIC
  // ==========================================
  const filteredSports = useMemo(() => {
    const q = sportSearch.trim().toLowerCase()
    return sports.filter((item) => {
      const matchesQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))

      const matchesStatus =
        sportFilterStatus === 'ALL' ||
        (sportFilterStatus === 'ACTIVE' && item.isActive) ||
        (sportFilterStatus === 'INACTIVE' && !item.isActive)

      return matchesQuery && matchesStatus
    })
  }, [sports, sportSearch, sportFilterStatus])

  const handleOpenCreateSport = () => {
    setSportForm({
      name: '',
      description: '',
      isActive: true,
    })
    setShowCreateSportModal(true)
    setError('')
  }

  const handleOpenEditSport = (sport) => {
    setEditingSport(sport)
    setSportForm({
      name: sport.name || '',
      description: sport.description || '',
      isActive: sport.isActive !== false,
    })
    setError('')
  }

  const handleCreateSportSubmit = async (e) => {
    e.preventDefault()
    if (!sportForm.name.trim()) {
      setError('Vui lòng nhập tên bộ môn thể thao.')
      return
    }

    setSubmittingSport(true)
    setError('')
    try {
      const created = await createSport({
        name: sportForm.name.trim(),
        description: sportForm.description.trim() || null,
        isActive: Boolean(sportForm.isActive),
      })
      setSports((prev) => [created, ...prev])
      setShowCreateSportModal(false)
      setSuccess(`Đã tạo bộ môn "${created.name}" thành công!`)
    } catch (err) {
      setError(getClassErrorMessage(err, 'Không thể tạo mới bộ môn thể thao.'))
    } finally {
      setSubmittingSport(false)
    }
  }

  const handleEditSportSubmit = async (e) => {
    e.preventDefault()
    if (!editingSport) return
    if (!sportForm.name.trim()) {
      setError('Vui lòng nhập tên bộ môn thể thao.')
      return
    }

    setSubmittingSport(true)
    setError('')
    try {
      const updated = await updateSport(editingSport.id, {
        name: sportForm.name.trim(),
        description: sportForm.description.trim() || null,
        isActive: Boolean(sportForm.isActive),
      })
      setSports((prev) =>
        prev.map((s) => (s.id === editingSport.id ? { ...s, ...updated } : s))
      )
      setEditingSport(null)
      setSuccess(`Đã cập nhật bộ môn "${updated.name}" thành công!`)
    } catch (err) {
      setError(getClassErrorMessage(err, 'Không thể cập nhật môn thể thao.'))
    } finally {
      setSubmittingSport(false)
    }
  }

  const handleToggleSportStatus = async (sport) => {
    const nextStatus = !sport.isActive
    try {
      const updated = await updateSport(sport.id, {
        name: sport.name,
        description: sport.description,
        isActive: nextStatus,
      })
      setSports((prev) =>
        prev.map((s) => (s.id === sport.id ? { ...s, ...updated } : s))
      )
      setTogglingSport(null)
      setSuccess(
        nextStatus
          ? `Đã kích hoạt lại bộ môn "${sport.name}".`
          : `Đã vô hiệu hóa bộ môn "${sport.name}".`
      )
    } catch (err) {
      setTogglingSport(null)
      setError(getClassErrorMessage(err, 'Không thể thay đổi trạng thái bộ môn.'))
    }
  }

  // ==========================================
  // SPORT CLASSES LOGIC
  // ==========================================
  const filteredClasses = useMemo(() => {
    const q = classSearch.trim().toLowerCase()
    return classes.filter((cls) => {
      const matchesQuery =
        !q ||
        cls.className.toLowerCase().includes(q) ||
        (cls.sportName && cls.sportName.toLowerCase().includes(q)) ||
        (cls.coachName && cls.coachName.toLowerCase().includes(q))

      const matchesSport =
        classSportFilter === 'ALL' || cls.sportId === Number(classSportFilter)

      const matchesCoach =
        classCoachFilter === 'ALL' || cls.coachId === Number(classCoachFilter)

      const matchesStatus =
        classStatusFilter === 'ALL' ||
        (classStatusFilter === 'ACTIVE' && cls.isActive) ||
        (classStatusFilter === 'INACTIVE' && !cls.isActive)

      return matchesQuery && matchesSport && matchesCoach && matchesStatus
    })
  }, [classes, classSearch, classSportFilter, classCoachFilter, classStatusFilter])

  const handleOpenCreateClass = () => {
    const startDate = timetableDateKey()
    setClassForm({
      className: '',
      sportId: sports[0]?.id || '',
      coachId: coaches[0]?.id || '',
      maxCapacity: 20,
      startDate,
      endDate: shiftTimetableDate(startDate, 35),
      isActive: true,
    })
    setShowCreateClassModal(true)
    setError('')
  }

  const handleOpenEditClass = (cls) => {
    setEditingClass(cls)
    setClassForm({
      className: cls.className || '',
      sportId: cls.sportId || '',
      coachId: cls.coachId || '',
      maxCapacity: cls.maxCapacity || 20,
      startDate: classDateInput(cls.startDate),
      endDate: classDateInput(cls.endDate),
      isActive: cls.isActive !== false,
    })
    setError('')
  }

  const handleCreateClassSubmit = async (e) => {
    e.preventDefault()
    if (!classForm.className.trim()) {
      setError('Vui lòng nhập tên lớp học.')
      return
    }
    if (!classForm.sportId) {
      setError('Vui lòng chọn bộ môn thể thao.')
      return
    }
    if (!classForm.coachId) {
      setError('Vui lòng chọn huấn luyện viên phụ trách.')
      return
    }

    setSubmittingClass(true)
    setError('')
    try {
      const created = await createSportClass(classForm)
      await loadClasses()
      setShowCreateClassModal(false)
      setSuccess(`Đã tạo lớp học "${created.className}". Bạn có thể xếp lịch tại mục Phòng tập / Cơ sở vật chất.`)
    } catch (err) {
      setError(getClassErrorMessage(err, 'Không thể tạo mới lớp học.'))
    } finally {
      setSubmittingClass(false)
    }
  }

  const handleEditClassSubmit = async (e) => {
    e.preventDefault()
    if (!editingClass) return
    if (!classForm.className.trim()) {
      setError('Vui lòng nhập tên lớp học.')
      return
    }

    setSubmittingClass(true)
    setError('')
    try {
      const updated = await updateSportClass(editingClass.id, {
        ...classForm,
        // Room and schedule are managed separately from the course fields.
        roomId: editingClass.roomId,
        roomName: editingClass.roomName,
        schedule: editingClass.schedule,
        startDate: classForm.startDate === classDateInput(editingClass.startDate) ? editingClass.startDate : classForm.startDate,
        endDate: classForm.endDate === classDateInput(editingClass.endDate) ? editingClass.endDate : classForm.endDate,
      })
      await loadClasses()
      setEditingClass(null)
      setSuccess(`Đã cập nhật lớp học "${updated.className}" thành công!`)
    } catch (err) {
      setError(getClassErrorMessage(err, 'Không thể cập nhật thông tin lớp học.'))
    } finally {
      setSubmittingClass(false)
    }
  }

  // ==========================================
  // CLASS SESSIONS LOGIC
  // ==========================================
  const handleOpenSessions = (cls) => {
    setSelectedClassForSessions(cls)
    loadClassSessions(cls.id)
  }

  const handleClassSessionsCancelled = result => {
    if (String(selectedClassForSessions?.id) === String(cancellingClass?.id)) {
      setSessionsList(previous => applyRoomSessionCancellations(previous, result.cancelled))
    }
    loadClasses()
  }

  const handleOpenAddSession = () => {
    if (!selectedClassForSessions) return
    const defaultRoom = getRoomForClass(selectedClassForSessions, rooms)
    // Default session: next week, starting at 18:00, lasting 90 minutes
    const start = new Date()
    start.setDate(start.getDate() + 2)
    start.setHours(18, 0, 0, 0)
    const end = new Date(start)
    end.setHours(19, 30, 0, 0)

    setSessionForm({
      coachId: selectedClassForSessions.coachId || coaches[0]?.id || '',
      roomId: defaultRoom?.id || rooms[0]?.id || '',
      cancellationPolicyId: 1,
      startsAt: toLocalInputString(start),
      endsAt: toLocalInputString(end),
      capacity: Math.min(Number(selectedClassForSessions.maxCapacity) || 20, Number((defaultRoom || rooms[0])?.capacity) || 20),
    })
    setAvailabilityResult(null)
    setShowAddSessionModal(true)
  }

  const handleCheckRoomAvailability = async () => {
    if (!sessionForm.roomId) {
      setError('Vui lòng chọn phòng trước khi kiểm tra.')
      return
    }
    if (!sessionForm.startsAt || !sessionForm.endsAt) {
      setError('Vui lòng chọn thời gian bắt đầu và kết thúc trước khi kiểm tra.')
      return
    }
    setCheckingAvailability(true)
    setAvailabilityResult(null)
    try {
      await validateSessionWrite(selectedClassForSessions.id, {
        ...sessionForm,
        startsAt: reschedulingSession && sessionForm.startsAt === toLocalInputString(reschedulingSession.startsAt) ? reschedulingSession.startsAt : new Date(sessionForm.startsAt).toISOString(),
        endsAt: reschedulingSession && sessionForm.endsAt === toLocalInputString(reschedulingSession.endsAt) ? reschedulingSession.endsAt : new Date(sessionForm.endsAt).toISOString(),
      }, reschedulingSession?.id)
      setAvailabilityResult({ isAvailable: true })
    } catch (error) {
      setAvailabilityResult({
        isAvailable: false,
        message: getClassErrorMessage(error, 'Không thể xác nhận lịch phòng. Vui lòng thử lại.'),
      })
    } finally {
      setCheckingAvailability(false)
    }
  }

  const handleCreateSessionSubmit = async (e) => {
    e.preventDefault()
    if (!selectedClassForSessions) return
    if (!sessionForm.coachId) {
      setError('Vui lòng chọn huấn luyện viên cho buổi học.')
      return
    }
    if (!sessionForm.roomId) {
      setError('Vui lòng chọn phòng tập cho buổi học.')
      return
    }
    if (!sessionForm.startsAt || !sessionForm.endsAt) {
      setError('Vui lòng nhập thời gian bắt đầu và kết thúc buổi học.')
      return
    }
    if (new Date(sessionForm.startsAt) >= new Date(sessionForm.endsAt)) {
      setError('Thời gian kết thúc phải sau thời gian bắt đầu buổi học.')
      return
    }

    const selectedRoom = rooms.find((r) => r.id === Number(sessionForm.roomId))
    setSubmittingSession(true)
    setError('')
    try {
      await validateSessionWrite(selectedClassForSessions.id, {
        ...sessionForm, startsAt: new Date(sessionForm.startsAt).toISOString(), endsAt: new Date(sessionForm.endsAt).toISOString(),
      })
      await assignClassToRoom({ classId: selectedClassForSessions.id, room: selectedRoom, rooms })
      await createClassSession(selectedClassForSessions.id, {
        ...sessionForm,
        roomId: Number(sessionForm.roomId),
        startsAt: new Date(sessionForm.startsAt).toISOString(),
        endsAt: new Date(sessionForm.endsAt).toISOString(),
      })
      await loadClassSessions(selectedClassForSessions.id)
      setShowAddSessionModal(false)
      setSuccess(`Đã lên lịch buổi học mới tại ${selectedRoom?.name || 'phòng tập'} thành công!`)
    } catch (err) {
      setError(getClassErrorMessage(err, 'Không thể thêm buổi học.'))
    } finally {
      setSubmittingSession(false)
    }
  }

  const handleOpenReschedule = (session) => {
    setReschedulingSession(session)
    const classRoom = getRoomForClass(selectedClassForSessions, rooms)
    const currentRoom = session.roomId
      ? rooms.find((r) => r.id === session.roomId)
      : classRoom
    setSessionForm({
      coachId: session.coachId,
      roomId: currentRoom?.id || rooms[0]?.id || '',
      cancellationPolicyId: session.cancellationPolicyId || 1,
      startsAt: toLocalInputString(session.startsAt),
      endsAt: toLocalInputString(session.endsAt),
      capacity: session.capacity,
    })
    setAvailabilityResult(null)
  }

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedClassForSessions || !reschedulingSession) return
    if (!sessionForm.roomId) {
      setError('Vui lòng chọn phòng tập cho buổi học.')
      return
    }

    const selectedRoom = rooms.find((r) => r.id === Number(sessionForm.roomId))
    setSubmittingSession(true)
    setError('')
    try {
      await updateClassSession(selectedClassForSessions.id, reschedulingSession.id, {
        ...sessionForm,
        roomId: Number(sessionForm.roomId),
        startsAt: sessionForm.startsAt === toLocalInputString(reschedulingSession.startsAt) ? reschedulingSession.startsAt : new Date(sessionForm.startsAt).toISOString(),
        endsAt: sessionForm.endsAt === toLocalInputString(reschedulingSession.endsAt) ? reschedulingSession.endsAt : new Date(sessionForm.endsAt).toISOString(),
      })
      await loadClassSessions(selectedClassForSessions.id)
      setReschedulingSession(null)
      setSuccess(`Đã cập nhật buổi học tại ${selectedRoom?.name || 'phòng tập'}. Khi đổi lịch hoặc HLV, học viên đã đăng ký được giữ chỗ và nhận thông báo kiểm tra lại lịch.`)
    } catch (err) {
      setError(getClassErrorMessage(err, 'Không thể dời lịch hoặc đổi huấn luyện viên buổi học.'))
    } finally {
      setSubmittingSession(false)
    }
  }

  const handleOpenCancelSession = (session) => {
    setCancellingSession(session)
    setCancelReason('')
  }

  const handleCancelSessionSubmit = async (e) => {
    e.preventDefault()
    if (!cancellingSession) return
    if (!cancelReason.trim()) {
      setError('Vui lòng nhập lý do hủy buổi học đột xuất.')
      return
    }

    setSubmittingSession(true)
    setError('')
    try {
      await cancelClassSession(cancellingSession.id, cancelReason)
      await loadClassSessions(selectedClassForSessions.id)
      setCancellingSession(null)
      setSuccess(`Đã hủy buổi học #${cancellingSession.id} và gửi thông báo tới học viên.`)
    } catch (err) {
      setError(getClassErrorMessage(err, 'Không thể hủy buổi học.'))
    } finally {
      setSubmittingSession(false)
    }
  }

  const handleCompleteSession = async (session) => {
    try {
      await completeClassSession(session.id)
      await loadClassSessions(selectedClassForSessions.id)
      setSuccess(`Đã đánh dấu hoàn thành buổi học #${session.id}.`)
    } catch (err) {
      setError(getClassErrorMessage(err, 'Không thể hoàn thành buổi học.'))
    }
  }

  // Roster logic
  const handleOpenRoster = async (session) => {
    setRosterSession(session)
    setRosterLoading(true)
    try {
      const students = await getSessionRoster(session.id)
      setRosterList(students)
    } catch (err) {
      setError(getClassErrorMessage(err, 'Không thể tải danh sách học viên của buổi học.'))
      setRosterList([])
    } finally {
      setRosterLoading(false)
    }
  }

  const activeSportsCount = sports.filter((s) => s.isActive !== false).length

  return (
    <div className="class-mgmt">
      {/* Module Header */}
      <section className="class-mgmt-header manager-card">
        <div>
          <h2>Bộ môn & Lớp học</h2>
          <p>
            Cấu hình danh mục thể thao, thiết lập khóa học, gán huấn luyện viên và điều phối buổi học chi tiết.
          </p>
        </div>
        <div className="class-mgmt-actions">
          <button
            type="button"
            className="class-btn class-btn-secondary"
            onClick={() => {
              loadMasterData()
              loadClasses()
            }}
            disabled={loading || classesLoading}
          >
            <RefreshCw size={15} className={loading || classesLoading ? 'animate-spin' : ''} />
            Làm mới
          </button>
          {activeTab === 'sports' ? (
            <button
              type="button"
              className="class-btn class-btn-primary"
              onClick={handleOpenCreateSport}
            >
              <Plus size={16} /> Thêm bộ môn
            </button>
          ) : (
            <button
              type="button"
              className="class-btn class-btn-primary"
              onClick={handleOpenCreateClass}
            >
              <Plus size={16} /> Tạo lớp học
            </button>
          )}
        </div>
      </section>

      {/* Metric Cards */}
      <section className="class-metrics">
        <article className="class-metric-card">
          <div className="class-metric-icon blue">
            <Trophy size={22} />
          </div>
          <div className="class-metric-info">
            <span>Danh mục bộ môn</span>
            <strong>{sports.length}</strong>
          </div>
        </article>
        <article className="class-metric-card">
          <div className="class-metric-icon green">
            <ShieldCheck size={22} />
          </div>
          <div className="class-metric-info">
            <span>Môn đang kích hoạt</span>
            <strong>{activeSportsCount}</strong>
          </div>
        </article>
        <article className="class-metric-card">
          <div className="class-metric-icon purple">
            <BookOpen size={22} />
          </div>
          <div className="class-metric-info">
            <span>Tổng số lớp học</span>
            <strong>{classes.length}</strong>
          </div>
        </article>
        <article className="class-metric-card">
          <div className="class-metric-icon amber">
            <Users size={22} />
          </div>
          <div className="class-metric-info">
            <span>Huấn luyện viên</span>
            <strong>{coaches.length}</strong>
          </div>
        </article>
      </section>

      {/* Tabs */}
      <div className="class-tabs" role="group" aria-label="Danh mục quản lý">
        <button
          type="button"
          className={`class-tab ${activeTab === 'classes' ? 'active' : ''}`}
          aria-pressed={activeTab === 'classes'}
          onClick={() => setActiveTab('classes')}
        >
          <BookOpen size={16} />
          Lớp học
          <span className="class-tab-badge">{classes.length}</span>
        </button>
        <button
          type="button"
          className={`class-tab ${activeTab === 'sports' ? 'active' : ''}`}
          aria-pressed={activeTab === 'sports'}
          onClick={() => setActiveTab('sports')}
        >
          <Trophy size={16} />
          Bộ môn
          <span className="class-tab-badge">{sports.length}</span>
        </button>
      </div>

      {/* Alert Notifications */}
      {error && (
        <div className="class-alert class-alert-error" role="alert">
          <div className="class-alert-content">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="class-alert-close"
            onClick={() => setError('')}
            aria-label="Đóng thông báo lỗi"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="class-alert class-alert-success" role="status">
          <div className="class-alert-content">
            <CheckCircle2 size={18} />
            <span>{success}</span>
          </div>
          <button
            type="button"
            className="class-alert-close"
            onClick={() => setSuccess('')}
            aria-label="Đóng thông báo thành công"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: SPORT CLASSES MANAGEMENT */}
      {/* ======================================================== */}
      {activeTab === 'classes' && (
        <section className="manager-card class-content-card" aria-labelledby="class-list-title">
          <div className="class-content-heading"><div><h3 id="class-list-title">Danh sách lớp học</h3><p>Xem thông tin lớp, quản lý buổi học và lịch giảng dạy.</p></div><span className="class-result-count" role="status">{classesLoading ? 'Đang tải...' : `${filteredClasses.length} / ${classes.length} lớp`}</span></div>
          {/* Toolbar */}
          <div className="class-toolbar">
            <div className="class-search-box">
              <Search size={16} />
              <input
                type="search"
                aria-label="Tìm lớp học"
                className="class-search-input"
                placeholder="Tìm kiếm lớp học, môn, HLV..."
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
              />
            </div>
            <div className="class-filter-group">
              <select
                className="class-select"
                aria-label="Lọc bộ môn của lớp"
                value={classSportFilter}
                onChange={(e) => setClassSportFilter(e.target.value)}
              >
                <option value="ALL">Tất cả bộ môn</option>
                {sports.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                className="class-select"
                aria-label="Lọc huấn luyện viên"
                value={classCoachFilter}
                onChange={(e) => setClassCoachFilter(e.target.value)}
              >
                <option value="ALL">Tất cả huấn luyện viên</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>

              <select
                className="class-select"
                aria-label="Lọc trạng thái lớp"
                value={classStatusFilter}
                onChange={(e) => setClassStatusFilter(e.target.value)}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang mở</option>
                <option value="INACTIVE">Đã đóng</option>
              </select>
            </div>
          </div>

          {/* Classes Table */}
          {classesLoading ? (
            <div className="class-loading">
              <div className="class-spinner" />
              <span>Đang tải danh sách lớp học...</span>
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="class-empty">
              <BookOpen size={40} />
              <strong>Không tìm thấy lớp học nào</strong>
              <p>Thử điều chỉnh bộ lọc hoặc tạo lớp học mới cho trung tâm.</p>
              <button
                type="button"
                className="class-btn class-btn-primary"
                onClick={handleOpenCreateClass}
              >
                <Plus size={16} /> Tạo lớp học ngay
              </button>
            </div>
          ) : (
            <div className="class-table-container" role="region" aria-label="Danh sách lớp học" tabIndex={0}>
              <table className="class-table">
                <thead>
                  <tr>
                    <th>LỚP HỌC</th>
                    <th>BỘ MÔN</th>
                    <th>HLV PHỤ TRÁCH</th>
                    <th>THỜI GIAN HỌC</th>
                    <th>SĨ SỐ TỐI ĐA</th>
                    <th>TRẠNG THÁI</th>
                    <th className="class-actions-heading">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClasses.map((cls) => {
                    const isActive = cls.isActive !== false
                    return (
                      <tr key={cls.id}>
                        <td>
                          <div className="class-item-name">{cls.className}</div>
                          <div className="class-item-meta">Mã lớp #{cls.id}</div>
                        </td>
                        <td>
                          <span className="class-tag sport">{cls.sportName}</span>
                        </td>
                        <td>
                          <span className="class-tag coach">{cls.coachName || 'Chưa gán HLV'}</span>
                        </td>
                        <td className="class-date-cell" title={cls.sessionDatesError || 'Từ buổi học đầu tiên đến buổi cuối cùng chưa bị hủy'}>
                          <span className="class-date-line"><small>Từ</small>
                          {cls.sessionDatesError ? 'Không tải được' : cls.sessionDateRange?.startDate
                            ? <time dateTime={cls.sessionDateRange.startDate}>{formatSessionDate(cls.sessionDateRange.startDate)}</time>
                            : <span>Chưa có buổi học</span>}</span>
                          <span className="class-date-line"><small>Đến</small>
                          {cls.sessionDatesError ? 'Không tải được' : cls.sessionDateRange?.endDate
                            ? <time dateTime={cls.sessionDateRange.endDate}>{formatSessionDate(cls.sessionDateRange.endDate)}</time>
                            : '—'}</span>
                        </td>
                        <td>
                          <strong>{cls.maxCapacity} học viên</strong>
                        </td>
                        <td>
                          <span className={`sport-badge ${isActive ? 'active' : 'inactive'}`}>
                            <i />
                            {isActive ? 'Đang mở' : 'Đã đóng'}
                          </span>
                        </td>
                        <td className="class-actions-cell">
                          <div className="class-action-group" role="group" aria-label={`Thao tác lớp ${cls.className} #${cls.id}`}>
                            <button
                              type="button"
                              className="class-row-btn primary"
                              title="Xem và điều phối các buổi học trong lớp"
                              onClick={() => handleOpenSessions(cls)}
                            >
                              <Calendar size={14} /> Buổi học
                            </button>
                            <button
                              type="button"
                              className="class-row-btn"
                              title="Chỉnh sửa thông tin chung của lớp học"
                              onClick={() => handleOpenEditClass(cls)}
                            >
                              <Edit size={14} /> Chỉnh sửa
                            </button>
                            <button type="button" className="class-row-btn danger" title="Hủy các buổi học chưa bắt đầu của lớp này" onClick={() => setCancellingClass(cls)}><CalendarX2 size={14} />Hủy buổi</button>
                            {isActive && (
                              <button
                                type="button"
                                className="class-row-btn danger"
                                title="Đóng lớp học hoặc ngừng hoạt động"
                                onClick={() => setDeactivatingClass(cls)}
                              >
                                <Power size={14} /> Đóng lớp
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ======================================================== */}
      {/* TAB 2: SPORTS CATALOG MANAGEMENT */}
      {/* ======================================================== */}
      {activeTab === 'sports' && (
        <section className="manager-card class-content-card" aria-labelledby="sport-list-title">
          <div className="class-content-heading"><div><h3 id="sport-list-title">Danh mục bộ môn</h3><p>Quản lý các môn thể thao và lớp học liên kết.</p></div><span className="class-result-count" role="status">{loading ? 'Đang tải...' : `${filteredSports.length} / ${sports.length} bộ môn`}</span></div>
          {/* Toolbar */}
          <div className="class-toolbar">
            <div className="class-search-box">
              <Search size={16} />
              <input
                type="search"
                aria-label="Tìm bộ môn"
                className="class-search-input"
                placeholder="Tìm tên bộ môn..."
                value={sportSearch}
                onChange={(e) => setSportSearch(e.target.value)}
              />
            </div>
            <div className="class-filter-group">
              <select
                className="class-select"
                aria-label="Lọc trạng thái bộ môn"
                value={sportFilterStatus}
                onChange={(e) => setSportFilterStatus(e.target.value)}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="INACTIVE">Đã vô hiệu hóa</option>
              </select>
            </div>
          </div>

          {/* Sports Grid */}
          {loading ? (
            <div className="class-loading">
              <div className="class-spinner" />
              <span>Đang tải danh mục môn thể thao...</span>
            </div>
          ) : filteredSports.length === 0 ? (
            <div className="class-empty">
              <Trophy size={40} />
              <strong>Không tìm thấy bộ môn thể thao</strong>
              <p>Thử tìm kiếm với từ khóa khác hoặc tạo mới bộ môn cho trung tâm.</p>
              <button
                type="button"
                className="class-btn class-btn-primary"
                onClick={handleOpenCreateSport}
              >
                <Plus size={16} /> Thêm bộ môn ngay
              </button>
            </div>
          ) : (
            <div className="sports-grid">
              {filteredSports.map((sport) => {
                const isActive = sport.isActive !== false
                return (
                  <article key={sport.id} className="sport-card">
                    <div className="sport-card-top">
                      <div className="sport-avatar">{getSportIcon(sport.name)}</div>
                      <div className="sport-main-info">
                        <h3>{sport.name}</h3>
                        <small>Mã bộ môn: #{sport.id}</small>
                      </div>
                      <span className={`sport-badge ${isActive ? 'active' : 'inactive'}`}>
                        <i />
                        {isActive ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </div>

                    <p className="sport-desc">
                      {sport.description || 'Chưa có mô tả chi tiết cho bộ môn này.'}
                    </p>

                    <div className="sport-card-footer">
                      <span className="class-form-help">
                        {classes.filter((c) => c.sportId === sport.id).length} lớp học liên kết
                      </span>
                      <div className="sport-card-actions">
                        <button
                          type="button"
                          className="sport-action-btn"
                          title="Chỉnh sửa môn thể thao"
                          onClick={() => handleOpenEditSport(sport)}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          className={`sport-action-btn ${isActive ? 'danger' : ''}`}
                          title={isActive ? 'Vô hiệu hóa môn này' : 'Kích hoạt lại'}
                          onClick={() => setTogglingSport(sport)}
                        >
                          <Power size={15} />
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* ======================================================== */}
      {/* MODAL: SESSIONS MANAGEMENT (Chi tiết các buổi học) */}
      {/* ======================================================== */}
      {selectedClassForSessions && (
        <div className="class-modal-overlay" onClick={() => setSelectedClassForSessions(null)}>
          <div className="class-modal wide class-session-modal" onClick={(e) => e.stopPropagation()}>
            <div className="class-modal-header">
              <div>
                <h3>Quản lý buổi học chi tiết</h3>
                <small style={{ color: 'var(--manager-muted)' }}>
                  Lớp: <strong>{selectedClassForSessions.className}</strong> (#{selectedClassForSessions.id})
                </small>
              </div>
              <button
                type="button"
                className="class-modal-close"
                onClick={() => setSelectedClassForSessions(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="class-modal-body">
              {/* Header card summary */}
              <div className="sessions-header-card">
                <div className="sessions-header-info">
                  <h4>{selectedClassForSessions.className}</h4>
                  <p>
                    Môn: <strong>{selectedClassForSessions.sportName}</strong> · HLV khóa:{' '}
                    <strong>{selectedClassForSessions.coachName || 'Chưa gán'}</strong>
                  </p>
                </div>
                <button type="button" className="class-btn class-btn-danger" disabled={sessionsLoading || submittingSession} onClick={() => setCancellingClass(selectedClassForSessions)}><Ban size={15} />Hủy buổi theo lớp</button>
                <button
                  type="button"
                  className="class-btn class-btn-primary"
                  onClick={handleOpenAddSession}
                >
                  <Plus size={15} /> Thêm buổi học
                </button>
              </div>

              {/* Sessions List */}
              {sessionsLoading ? (
                <div className="class-loading">
                  <div className="class-spinner" />
                  <span>Đang tải danh sách buổi học...</span>
                </div>
              ) : sessionsList.length === 0 ? (
                <div className="class-empty">
                  <Calendar size={36} />
                  <strong>Chưa có buổi học nào được tạo</strong>
                  <p>Bấm nút "Thêm buổi học" để tạo buổi đầu tiên cho khóa này.</p>
                </div>
              ) : (
                <ClassSessionGroups items={sessionsList}>
                  {(session) => {
                    const rawStatus = String(session.Status || session.status || 'scheduled').trim().toLowerCase()
                    const statusClass = rawStatus === 'canceled' ? 'cancelled' : rawStatus
                    const isScheduled = statusClass === 'scheduled'
                    const isCompleted = statusClass === 'completed'
                    const isCancelled = statusClass === 'cancelled'

                    const classDefaultRoom = getRoomForClass(selectedClassForSessions, rooms)
                    const sessionRoom = session.roomId
                      ? rooms.find((r) => r.id === session.roomId)
                      : (session.roomName ? rooms.find((r) => r.name?.toLowerCase() === session.roomName?.toLowerCase()) : classDefaultRoom)

                    return (
                      <article key={session.id} className={`session-card-item ${statusClass}`}>
                        <div className="session-col-time">
                          <strong>
                            <Clock size={14} />
                            {formatDateTime(session.startsAt)}
                          </strong>
                          <span>đến {formatDateTime(session.endsAt)}</span>
                        </div>

                        <div className="session-col-room">
                          <span>Phòng tập:</span>
                          <strong>
                            <DoorOpen size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                            {sessionRoom?.name || session.roomName || 'Phòng theo lớp'}
                          </strong>
                        </div>

                        <div className="session-col-coach">
                          <span>HLV buổi học:</span>
                          <strong>{session.coachName || 'HLV lớp'}</strong>
                        </div>

                        <div className="session-col-seats">
                          <span>Sĩ số / Còn trống:</span>
                          <strong>
                            {session.currentEnrollment || 0} / {session.capacity} (còn {session.availableSeats ?? session.capacity})
                          </strong>
                        </div>

                        <div>
                          <span className={`session-status-badge ${statusClass}`}>
                            <i />
                            {isScheduled ? 'Đã lên lịch' : isCompleted ? 'Đã hoàn thành' : isCancelled ? 'Đã hủy' : session.Status || session.status}
                          </span>
                          {isCancelled && (
                            <div className="class-session-cancel-reason">
                              Lý do: {session.cancellationReason || 'Chưa cập nhật'}
                            </div>
                          )}
                        </div>

                        <div className="session-actions">
                          {/* Xem Roster */}
                          <button
                            type="button"
                            className="session-btn-icon"
                            title="Xem danh sách học viên đăng ký"
                            onClick={() => handleOpenRoster(session)}
                          >
                            <Users size={15} />
                          </button>

                          {/* Dời lịch / Đổi HLV */}
                          {isScheduled && (
                            <button
                              type="button"
                              className="session-btn-icon"
                              title="Dời lịch (Reschedule) hoặc đổi HLV phụ trách buổi này"
                              onClick={() => handleOpenReschedule(session)}
                            >
                              <Edit size={15} />
                            </button>
                          )}

                          {/* Hoàn thành */}
                          {isScheduled && (
                            <button
                              type="button"
                              className="session-btn-icon success"
                              title="Đánh dấu buổi học hoàn thành"
                              onClick={() => handleCompleteSession(session)}
                            >
                              <CheckCircle2 size={15} />
                            </button>
                          )}

                          {/* Hủy buổi đột xuất */}
                          {isScheduled && (
                            <button
                              type="button"
                              className="session-btn-icon danger"
                              title="Hủy buổi học đột xuất kèm lý do"
                              onClick={() => handleOpenCancelSession(session)}
                            >
                              <Ban size={15} />
                            </button>
                          )}
                        </div>
                      </article>
                    )
                  }}
                </ClassSessionGroups>
              )}
            </div>

            <div className="class-modal-footer">
              <button
                type="button"
                className="class-btn class-btn-secondary"
                onClick={() => setSelectedClassForSessions(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD SESSION */}
      {/* ======================================================== */}
      {showAddSessionModal && (
        <div className="class-modal-overlay" onClick={() => setShowAddSessionModal(false)}>
          <div className="class-modal" onClick={(e) => e.stopPropagation()}>
            <div className="class-modal-header">
              <h3>Thêm buổi học mới</h3>
              <button
                type="button"
                className="class-modal-close"
                onClick={() => setShowAddSessionModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSessionSubmit}>
              <div className="class-modal-body">
                {error && <p className="class-form-error" role="alert">{error}</p>}
                {invalidSessionCapacity && <p className="class-form-error" role="alert">{sessionCapacityLimit > 0 ? `Sức chứa phải từ 1 đến ${sessionCapacityLimit} học viên, theo sức chứa của phòng và lớp.` : 'Vui lòng chọn phòng để xác nhận sức chứa.'}</p>}
                <div className="class-form-group">
                  <label>
                    Huấn luyện viên phụ trách <span className="required">*</span>
                  </label>
                  <select
                    className="class-form-select"
                    value={sessionForm.coachId}
                    onChange={(e) => setSessionForm({ ...sessionForm, coachId: e.target.value })}
                    required
                  >
                    <option value="">-- Chọn Huấn luyện viên --</option>
                    {coaches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.specialization || 'Chuyên viên'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="class-form-group">
                  <label>
                    Phòng tập cho buổi học <span className="required">*</span>
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      className="class-form-select"
                      style={{ flex: 1 }}
                      name="sessionRoomId"
                      value={sessionForm.roomId}
                      onChange={(e) => {
                        setSessionForm({ ...sessionForm, roomId: e.target.value })
                        setAvailabilityResult(null)
                      }}
                      required
                    >
                      <option value="">-- Chọn phòng tập cho buổi học --</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} · {r.roomType || 'Tổng hợp'} (Sức chứa: {r.capacity} người{r.location ? ` - ${r.location}` : ''})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="class-btn class-btn-secondary"
                      style={{ whiteSpace: 'nowrap', fontSize: 11, padding: '0 12px' }}
                      onClick={handleCheckRoomAvailability}
                      disabled={checkingAvailability || !sessionForm.roomId || !sessionForm.startsAt || !sessionForm.endsAt}
                      title="Kiểm tra phòng có trống vào khung giờ này không"
                    >
                      {checkingAvailability ? 'Đang check...' : 'Kiểm tra trống'}
                    </button>
                  </div>
                  {availabilityResult && (
                    <div className={`session-room-check-result ${availabilityResult.isAvailable === true ? 'available' : 'unavailable'}`}>
                      {availabilityResult.isAvailable === true ? (
                        <>
                          <CheckCircle2 size={14} />
                          <span>Phòng sẵn sàng cho buổi học (Không phát hiện xung đột lịch).</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle size={14} />
                          <span>{availabilityResult.message || 'Phòng đã có lịch vào khung giờ này!'}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="class-form-grid-2">
                  <div className="class-form-group">
                    <label>
                      Bắt đầu <span className="required">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      className="class-form-input"
                      name="sessionStartsAt"
                      value={sessionForm.startsAt}
                      onChange={(e) => {
                        setSessionForm({ ...sessionForm, startsAt: e.target.value })
                        setAvailabilityResult(null)
                      }}
                      required
                    />
                  </div>

                  <div className="class-form-group">
                    <label>
                      Kết thúc <span className="required">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      className="class-form-input"
                      name="sessionEndsAt"
                      value={sessionForm.endsAt}
                      onChange={(e) => {
                        setSessionForm({ ...sessionForm, endsAt: e.target.value })
                        setAvailabilityResult(null)
                      }}
                      required
                    />
                  </div>
                </div>

                <div className="class-form-group">
                  <label>
                    Sức chứa buổi học (Capacity) <span className="required">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={sessionCapacityLimit || undefined}
                    step="1"
                    className="class-form-input"
                    name="sessionCapacity"
                    value={sessionForm.capacity}
                    onChange={(e) => setSessionForm({ ...sessionForm, capacity: Number(e.target.value) })}
                    required
                  />
                  {(() => {
                    const roomObj = rooms.find((r) => r.id === Number(sessionForm.roomId))
                    if (roomObj && sessionForm.capacity > roomObj.capacity) {
                      return (
                        <div className="room-capacity-alert" style={{ marginTop: 4 }}>
                          <AlertTriangle size={13} />
                          <span>Sức chứa buổi ({sessionForm.capacity}) vượt quá sức chứa tối đa của phòng ({roomObj.capacity}).</span>
                        </div>
                      )
                    }
                    return null
                  })()}
                  <span className="class-form-help">
                    Chọn thời gian diễn ra cho buổi học này.
                  </span>
                </div>
              </div>
              <div className="class-modal-footer">
                <button
                  type="button"
                  className="class-btn class-btn-secondary"
                  onClick={() => setShowAddSessionModal(false)}
                  disabled={submittingSession}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="class-btn class-btn-primary"
                  disabled={submittingSession || invalidSessionCapacity}
                >
                  {submittingSession ? 'Đang tạo...' : 'Tạo buổi học'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: RESCHEDULE / EDIT SESSION */}
      {/* ======================================================== */}
      {reschedulingSession && (
        <div className="class-modal-overlay" onClick={() => setReschedulingSession(null)}>
          <div className="class-modal" onClick={(e) => e.stopPropagation()}>
            <div className="class-modal-header">
              <h3>Dời lịch / Đổi HLV buổi học #{reschedulingSession.id}</h3>
              <button
                type="button"
                className="class-modal-close"
                onClick={() => setReschedulingSession(null)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRescheduleSubmit}>
              <div className="class-modal-body">
                <p className="class-scheduling-note" role="status">Khi đổi ngày, giờ hoặc HLV, học viên đã đăng ký sẽ nhận thông báo kiểm tra lại lịch. Đăng ký được giữ nguyên; học viên tự hủy nếu không thể tham gia, theo hạn hủy của buổi học.</p>
                {error && <p className="class-form-error" role="alert">{error}</p>}
                {invalidSessionCapacity && <p className="class-form-error" role="alert">{sessionCapacityLimit > 0 ? `Sức chứa phải từ 1 đến ${sessionCapacityLimit} học viên, theo sức chứa của phòng và lớp.` : 'Vui lòng chọn phòng để xác nhận sức chứa.'}</p>}
                <div className="class-form-group">
                  <label>
                    Huấn luyện viên phụ trách <span className="required">*</span>
                  </label>
                  <select
                    className="class-form-select"
                    value={sessionForm.coachId}
                    onChange={(e) => setSessionForm({ ...sessionForm, coachId: e.target.value })}
                    required
                  >
                    {coaches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.specialization || 'Chuyên viên'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="class-form-group">
                  <label>
                    Phòng tập cho buổi học <span className="required">*</span>
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      className="class-form-select"
                      style={{ flex: 1 }}
                      name="sessionRoomId"
                      value={sessionForm.roomId}
                      onChange={(e) => {
                        setSessionForm({ ...sessionForm, roomId: e.target.value })
                        setAvailabilityResult(null)
                      }}
                      required
                    >
                      <option value="">-- Chọn phòng tập cho buổi học --</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} · {r.roomType || 'Tổng hợp'} (Sức chứa: {r.capacity} người{r.location ? ` - ${r.location}` : ''})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="class-btn class-btn-secondary"
                      style={{ whiteSpace: 'nowrap', fontSize: 11, padding: '0 12px' }}
                      onClick={handleCheckRoomAvailability}
                      disabled={checkingAvailability || !sessionForm.roomId || !sessionForm.startsAt || !sessionForm.endsAt}
                      title="Kiểm tra phòng có trống vào khung giờ mới không"
                    >
                      {checkingAvailability ? 'Đang check...' : 'Kiểm tra trống'}
                    </button>
                  </div>
                  {availabilityResult && (
                    <div className={`session-room-check-result ${availabilityResult.isAvailable === true ? 'available' : 'unavailable'}`}>
                      {availabilityResult.isAvailable === true ? (
                        <>
                          <CheckCircle2 size={14} />
                          <span>Phòng sẵn sàng cho buổi học!</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle size={14} />
                          <span>{availabilityResult.message || 'Phòng đã có lịch vào khung giờ này!'}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="class-form-grid-2">
                  <div className="class-form-group">
                    <label>
                      Thời gian bắt đầu mới <span className="required">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      className="class-form-input"
                      name="sessionStartsAt"
                      value={sessionForm.startsAt}
                      onChange={(e) => {
                        setSessionForm({ ...sessionForm, startsAt: e.target.value })
                        setAvailabilityResult(null)
                      }}
                      required
                    />
                  </div>

                  <div className="class-form-group">
                    <label>
                      Thời gian kết thúc mới <span className="required">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      className="class-form-input"
                      name="sessionEndsAt"
                      value={sessionForm.endsAt}
                      onChange={(e) => {
                        setSessionForm({ ...sessionForm, endsAt: e.target.value })
                        setAvailabilityResult(null)
                      }}
                      required
                    />
                  </div>
                </div>

                <div className="class-form-group">
                  <label>
                    Sức chứa buổi học <span className="required">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={sessionCapacityLimit || undefined}
                    step="1"
                    className="class-form-input"
                    name="sessionCapacity"
                    value={sessionForm.capacity}
                    onChange={(e) => setSessionForm({ ...sessionForm, capacity: Number(e.target.value) })}
                    required
                  />
                  {(() => {
                    const roomObj = rooms.find((r) => r.id === Number(sessionForm.roomId))
                    if (roomObj && sessionForm.capacity > roomObj.capacity) {
                      return (
                        <div className="room-capacity-alert" style={{ marginTop: 4 }}>
                          <AlertTriangle size={13} />
                          <span>Sức chứa buổi ({sessionForm.capacity}) vượt quá sức chứa tối đa của phòng ({roomObj.capacity}).</span>
                        </div>
                      )
                    }
                    return null
                  })()}
                  <span className="class-form-help">
                    Sức chứa không được nhỏ hơn số học viên đã đăng ký hoặc vượt quá giới hạn của phòng và lớp.
                  </span>
                </div>
              </div>
              <div className="class-modal-footer">
                <button
                  type="button"
                  className="class-btn class-btn-secondary"
                  onClick={() => setReschedulingSession(null)}
                  disabled={submittingSession}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="class-btn class-btn-primary"
                  disabled={submittingSession || invalidSessionCapacity}
                >
                  {submittingSession ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CANCEL SESSION WITH REASON */}
      {/* ======================================================== */}
      {cancellingSession && (
        <div className="class-modal-overlay" onClick={() => setCancellingSession(null)}>
          <div className="class-modal" onClick={(e) => e.stopPropagation()}>
            <div className="class-modal-header">
              <h3>Hủy buổi học đột xuất #{cancellingSession.id}</h3>
              <button
                type="button"
                className="class-modal-close"
                onClick={() => setCancellingSession(null)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCancelSessionSubmit}>
              <div className="class-modal-body">
                <div className="class-alert class-alert-error" style={{ margin: 0 }}>
                  <AlertTriangle size={18} />
                  <span>
                    Thao tác này sẽ hủy buổi học vào lúc{' '}
                    <strong>{formatDateTime(cancellingSession.startsAt)}</strong> và tự động thông báo tới tất cả học viên đã đăng ký.
                  </span>
                </div>

                <div className="class-form-group">
                  <label>
                    Lý do hủy buổi học <span className="required">*</span>
                  </label>
                  <textarea
                    className="class-form-textarea"
                    placeholder="Nhập lý do chi tiết (ví dụ: HLV bị ốm đột xuất, bảo trì cơ sở vật chất phòng tập, thời tiết xấu...)"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    maxLength={500}
                    required
                    autoFocus
                  />
                  <span className="class-form-help">
                    Tối đa 500 ký tự. Lý do sẽ được lưu trong lịch sử kiểm toán và gửi thông báo.
                  </span>
                </div>
              </div>
              <div className="class-modal-footer">
                <button
                  type="button"
                  className="class-btn class-btn-secondary"
                  onClick={() => setCancellingSession(null)}
                  disabled={submittingSession}
                >
                  Không hủy
                </button>
                <button
                  type="submit"
                  className="class-btn class-btn-danger"
                  disabled={submittingSession}
                >
                  {submittingSession ? 'Đang hủy...' : 'Xác nhận hủy buổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: SESSION ROSTER */}
      {/* ======================================================== */}
      {rosterSession && (
        <div className="class-modal-overlay" onClick={() => setRosterSession(null)}>
          <div className="class-modal wide class-session-modal" onClick={(e) => e.stopPropagation()}>
            <div className="class-modal-header">
              <div>
                <h3>Danh sách học viên đăng ký</h3>
                <small style={{ color: 'var(--manager-muted)' }}>
                  Buổi học #{rosterSession.id} · {formatDateTime(rosterSession.startsAt)}
                </small>
              </div>
              <button
                type="button"
                className="class-modal-close"
                onClick={() => setRosterSession(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="class-modal-body">
              {rosterLoading ? (
                <div className="class-loading">
                  <div className="class-spinner" />
                  <span>Đang tải danh sách học viên...</span>
                </div>
              ) : rosterList.length === 0 ? (
                <div className="class-empty">
                  <Users size={36} />
                  <strong>Chưa có học viên đăng ký buổi này</strong>
                  <p>Học viên có thể đăng ký trực tuyến hoặc thông qua bàn lễ tân.</p>
                </div>
              ) : (
                <div className="roster-container">
                  <table className="roster-table">
                    <thead>
                      <tr>
                        <th>MÃ ĐĂNG KÝ</th>
                        <th>HỌC VIÊN</th>
                        <th>TRẠNG THÁI</th>
                        <th>ĐIỂM DANH</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rosterList.map((student) => {
                        const initials = (student.fullName || 'HV')
                          .split(/\s+/)
                          .slice(-2)
                          .map((p) => p[0])
                          .join('')
                          .toUpperCase()

                        const isCheckedIn = Boolean(student.checkInTime)
                        return (
                          <tr key={student.registrationId}>
                            <td>#{student.registrationId}</td>
                            <td>
                              <div className="roster-user">
                                <span className="roster-avatar">{initials}</span>
                                <div>
                                  <strong>{student.fullName}</strong>
                                  <div style={{ fontSize: 11, color: 'var(--manager-muted)' }}>
                                    Mã HV: #{student.memberId}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span
                                className={`roster-badge ${
                                  student.registrationStatus === 'Confirmed' ? 'confirmed' : 'cancelled'
                                }`}
                              >
                                {student.registrationStatus || 'Đã xác nhận'}
                              </span>
                            </td>
                            <td>
                              {isCheckedIn ? (
                                <span className="roster-badge checkedin">
                                  <UserCheck size={11} /> Đã điểm danh (
                                  {formatDateTime(student.checkInTime)})
                                </span>
                              ) : (
                                <span style={{ color: 'var(--manager-muted)', fontSize: 11 }}>
                                  Chưa điểm danh
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="class-modal-footer">
              <button
                type="button"
                className="class-btn class-btn-secondary"
                onClick={() => setRosterSession(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CREATE CLASS */}
      {/* ======================================================== */}
      {showCreateClassModal && (
        <div className="class-modal-overlay" onClick={() => setShowCreateClassModal(false)}>
          <div className="class-modal wide" onClick={(e) => e.stopPropagation()}>
            <div className="class-modal-header">
              <h3>Tạo lớp học mới</h3>
              <button
                type="button"
                className="class-modal-close"
                onClick={() => setShowCreateClassModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateClassSubmit}>
              <div className="class-modal-body">
                <div className="class-form-group">
                  <label>
                    Tên lớp học <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="class-form-input"
                    placeholder="Ví dụ: Lớp Yoga Cơ Bản Khóa 01, Boxing Cường Độ Cao..."
                    value={classForm.className}
                    onChange={(e) => setClassForm({ ...classForm, className: e.target.value })}
                    required
                    autoFocus
                  />
                </div>

                <div className="class-form-grid-2">
                  <div className="class-form-group">
                    <label>
                      Môn thể thao <span className="required">*</span>
                    </label>
                    <select
                      className="class-form-select"
                      value={classForm.sportId}
                      onChange={(e) => setClassForm({ ...classForm, sportId: e.target.value })}
                      required
                    >
                      <option value="">-- Chọn môn thể thao --</option>
                      {sports.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="class-form-group">
                    <label>
                      Huấn luyện viên phụ trách <span className="required">*</span>
                    </label>
                    <select
                      className="class-form-select"
                      value={classForm.coachId}
                      onChange={(e) => setClassForm({ ...classForm, coachId: e.target.value })}
                      required
                    >
                      <option value="">-- Gán Huấn luyện viên --</option>
                      {coaches.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.fullName} ({c.specialization || 'HLV'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className="class-scheduling-note"><Calendar size={16} /><span>Xếp phòng, thứ và giờ học tại <strong>Phòng tập / Cơ sở vật chất → chọn phòng → Thêm buổi học</strong>.</span></p>

                <div className="class-form-group">
                  <label>
                    Sĩ số tối đa <span className="required">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    className="class-form-input"
                    value={classForm.maxCapacity}
                    onChange={(e) =>
                      setClassForm({ ...classForm, maxCapacity: Number(e.target.value) })
                    }
                    required
                  />
                </div>

                <ClassCourseFields values={classForm} onChange={setClassForm} error={error} />

                <div className="class-form-group">
                  <label className="class-form-checkbox">
                    <input
                      type="checkbox"
                      checked={classForm.isActive}
                      onChange={(e) => setClassForm({ ...classForm, isActive: e.target.checked })}
                    />
                    <span>Kích hoạt và mở đăng ký cho lớp học ngay</span>
                  </label>
                </div>
              </div>
              <div className="class-modal-footer">
                <button
                  type="button"
                  className="class-btn class-btn-secondary"
                  onClick={() => setShowCreateClassModal(false)}
                  disabled={submittingClass}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="class-btn class-btn-primary"
                  disabled={submittingClass}
                >
                  {submittingClass ? 'Đang tạo...' : 'Tạo lớp học'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT CLASS */}
      {/* ======================================================== */}
      {editingClass && (
        <div className="class-modal-overlay" onClick={() => setEditingClass(null)}>
          <div className="class-modal wide" onClick={(e) => e.stopPropagation()}>
            <div className="class-modal-header">
              <h3>Chỉnh sửa lớp học: #{editingClass.id}</h3>
              <button
                type="button"
                className="class-modal-close"
                onClick={() => setEditingClass(null)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditClassSubmit}>
              <div className="class-modal-body">
                <div className="class-form-group">
                  <label>
                    Tên lớp học <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="class-form-input"
                    value={classForm.className}
                    onChange={(e) => setClassForm({ ...classForm, className: e.target.value })}
                    required
                  />
                </div>

                <div className="class-form-grid-2">
                  <div className="class-form-group">
                    <label>
                      Môn thể thao <span className="required">*</span>
                    </label>
                    <select
                      className="class-form-select"
                      value={classForm.sportId}
                      onChange={(e) => setClassForm({ ...classForm, sportId: e.target.value })}
                      required
                    >
                      {sports.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="class-form-group">
                    <label>
                      Huấn luyện viên phụ trách <span className="required">*</span>
                    </label>
                    <select
                      className="class-form-select"
                      value={classForm.coachId}
                      onChange={(e) => setClassForm({ ...classForm, coachId: e.target.value })}
                      required
                    >
                      {coaches.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.fullName} ({c.specialization || 'HLV'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className="class-scheduling-note"><Calendar size={16} /><span>Xếp phòng, thứ và giờ học tại <strong>Phòng tập / Cơ sở vật chất → chọn phòng → Thêm buổi học</strong>.</span></p>

                <div className="class-form-group">
                  <label>
                    Sĩ số tối đa <span className="required">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    className="class-form-input"
                    value={classForm.maxCapacity}
                    onChange={(e) =>
                      setClassForm({ ...classForm, maxCapacity: Number(e.target.value) })
                    }
                    required
                  />
                </div>

                <ClassCourseFields values={classForm} onChange={setClassForm} error={error} />

                <div className="class-form-group">
                  <label className="class-form-checkbox">
                    <input
                      type="checkbox"
                      checked={classForm.isActive}
                      onChange={(e) => setClassForm({ ...classForm, isActive: e.target.checked })}
                    />
                    <span>Trạng thái mở đăng ký (Active)</span>
                  </label>
                </div>
              </div>
              <div className="class-modal-footer">
                <button
                  type="button"
                  className="class-btn class-btn-secondary"
                  onClick={() => setEditingClass(null)}
                  disabled={submittingClass}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="class-btn class-btn-primary"
                  disabled={submittingClass}
                >
                  {submittingClass ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: DEACTIVATE / CLOSE CLASS */}
      {/* ======================================================== */}
      {deactivatingClass && (
        <CloseClassDialog sportClass={deactivatingClass} onClose={() => setDeactivatingClass(null)}
          onViewSessions={() => { handleOpenSessions(deactivatingClass); setDeactivatingClass(null) }}
          onClosed={() => {
            setSuccess(`Đã đóng / ngừng hoạt động lớp học "${deactivatingClass.className}".`)
            setDeactivatingClass(null)
            void loadClasses()
          }} />
      )}

      {/* ======================================================== */}
      {/* MODAL: CREATE SPORT */}
      {/* ======================================================== */}
      {showCreateSportModal && (
        <div className="class-modal-overlay" onClick={() => setShowCreateSportModal(false)}>
          <div className="class-modal" onClick={(e) => e.stopPropagation()}>
            <div className="class-modal-header">
              <h3>Thêm môn thể thao mới</h3>
              <button
                type="button"
                className="class-modal-close"
                onClick={() => setShowCreateSportModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSportSubmit}>
              <div className="class-modal-body">
                <div className="class-form-group">
                  <label>
                    Tên môn thể thao <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="class-form-input"
                    placeholder="Ví dụ: Gym, Yoga, Boxing, Bơi lội, Pickleball..."
                    value={sportForm.name}
                    onChange={(e) => setSportForm({ ...sportForm, name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>

                <div className="class-form-group">
                  <label>Mô tả chi tiết</label>
                  <textarea
                    className="class-form-textarea"
                    placeholder="Mô tả lợi ích, trang thiết bị yêu cầu hoặc đối tượng phù hợp..."
                    value={sportForm.description}
                    onChange={(e) => setSportForm({ ...sportForm, description: e.target.value })}
                  />
                </div>

                <div className="class-form-group">
                  <label className="class-form-checkbox">
                    <input
                      type="checkbox"
                      checked={sportForm.isActive}
                      onChange={(e) => setSportForm({ ...sportForm, isActive: e.target.checked })}
                    />
                    <span>Kích hoạt môn thể thao ngay sau khi tạo</span>
                  </label>
                  <span className="class-form-help">
                    Bộ môn khi kích hoạt sẽ hiển thị để tạo lớp học và mở đăng ký cho hội viên.
                  </span>
                </div>
              </div>
              <div className="class-modal-footer">
                <button
                  type="button"
                  className="class-btn class-btn-secondary"
                  onClick={() => setShowCreateSportModal(false)}
                  disabled={submittingSport}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="class-btn class-btn-primary"
                  disabled={submittingSport}
                >
                  {submittingSport ? 'Đang tạo...' : 'Tạo môn thể thao'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT SPORT */}
      {/* ======================================================== */}
      {editingSport && (
        <div className="class-modal-overlay" onClick={() => setEditingSport(null)}>
          <div className="class-modal" onClick={(e) => e.stopPropagation()}>
            <div className="class-modal-header">
              <h3>Chỉnh sửa môn thể thao: {editingSport.name}</h3>
              <button
                type="button"
                className="class-modal-close"
                onClick={() => setEditingSport(null)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSportSubmit}>
              <div className="class-modal-body">
                <div className="class-form-group">
                  <label>
                    Tên môn thể thao <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="class-form-input"
                    value={sportForm.name}
                    onChange={(e) => setSportForm({ ...sportForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="class-form-group">
                  <label>Mô tả chi tiết</label>
                  <textarea
                    className="class-form-textarea"
                    value={sportForm.description}
                    onChange={(e) => setSportForm({ ...sportForm, description: e.target.value })}
                  />
                </div>

                <div className="class-form-group">
                  <label className="class-form-checkbox">
                    <input
                      type="checkbox"
                      checked={sportForm.isActive}
                      onChange={(e) => setSportForm({ ...sportForm, isActive: e.target.checked })}
                    />
                    <span>Trạng thái kích hoạt (Active)</span>
                  </label>
                  <span className="class-form-help">
                    Lưu ý: Không thể tắt kích hoạt bộ môn nếu đang có buổi học Scheduled chưa hoàn thành hoặc hủy.
                  </span>
                </div>
              </div>
              <div className="class-modal-footer">
                <button
                  type="button"
                  className="class-btn class-btn-secondary"
                  onClick={() => setEditingSport(null)}
                  disabled={submittingSport}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="class-btn class-btn-primary"
                  disabled={submittingSport}
                >
                  {submittingSport ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CONFIRM TOGGLE SPORT STATUS */}
      {/* ======================================================== */}
      {togglingSport && (
        <div className="class-modal-overlay" onClick={() => setTogglingSport(null)}>
          <div className="class-modal" onClick={(e) => e.stopPropagation()}>
            <div className="class-modal-header">
              <h3>
                {togglingSport.isActive !== false ? 'Vô hiệu hóa bộ môn' : 'Kích hoạt lại bộ môn'}
              </h3>
              <button
                type="button"
                className="class-modal-close"
                onClick={() => setTogglingSport(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="class-modal-body">
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
                Bạn có chắc chắn muốn{' '}
                <strong>
                  {togglingSport.isActive !== false ? 'vô hiệu hóa' : 'kích hoạt lại'}
                </strong>{' '}
                bộ môn <strong>"{togglingSport.name}"</strong>?
              </p>
              {togglingSport.isActive !== false && (
                <div className="class-alert class-alert-error" style={{ margin: '8px 0 0' }}>
                  <AlertCircle size={18} />
                  <span>
                    Hệ thống sẽ kiểm tra các buổi học thuộc bộ môn này. Nếu còn buổi học đang lên lịch (Scheduled), thao tác sẽ bị từ chối.
                  </span>
                </div>
              )}
            </div>
            <div className="class-modal-footer">
              <button
                type="button"
                className="class-btn class-btn-secondary"
                onClick={() => setTogglingSport(null)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className={`class-btn ${togglingSport.isActive !== false ? 'class-btn-danger' : 'class-btn-primary'}`}
                onClick={() => handleToggleSportStatus(togglingSport)}
              >
                {togglingSport.isActive !== false ? 'Vô hiệu hóa ngay' : 'Kích hoạt ngay'}
              </button>
            </div>
          </div>
        </div>
      )}
      {cancellingClass && <CancelClassSessionsDialog sportClass={cancellingClass} onClose={() => setCancellingClass(null)} onUpdated={handleClassSessionsCancelled} />}
    </div>
  )
}
