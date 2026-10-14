import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Ban,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Clock3,
  CreditCard,
  DoorOpen,
  ExternalLink,
  FileText,
  Headset,
  HelpCircle,
  Layers,
  LifeBuoy,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Plus,
  QrCode,
  ReceiptText,
  RefreshCw,
  ScanLine,
  Search,
  ShieldAlert,
  ShieldCheck,
  TicketCheck,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  Wallet,
  X,
  Zap,
} from 'lucide-react'
import {
  createMember,
  deactivateMember,
  getMemberById,
  getMembers,
} from '../../services/memberService'
import {
  checkOutGymMember,
  getCheckInErrorMessage,
  getTodayCheckIns,
  manualCheckIn,
  scanQrCheckIn,
} from '../../services/gymCheckInService'
import { getMembershipPackages } from '../../services/membershipPackageService'
import {
  cancelPendingSubscription,
  confirmSubscriptionPayment,
  createReceptionistMemberSubscription,
  getReceptionistMemberSubscriptions,
} from '../../services/memberSubscriptionService'
import { createPayment } from '../../services/paymentService'
import {
  cancelReceptionistRegistration,
  checkInReceptionistRegistration,
  getReceptionistSessionRoster,
  registerMemberForSession,
} from '../../services/receptionistClassService'
import {
  getReceptionistSessionAttendances,
  markReceptionistAttendance,
} from '../../services/receptionistAttendanceService'
import {
  getAllSupportTickets,
  getTicketErrorMessage,
  resolveSupportTicket,
} from '../../services/supportTicketService'
import '../../style/CenterManager/FrontDeskOperations.css'

function formatVND(value) {
  const number = Number(value) || 0
  return number.toLocaleString('vi-VN') + ' ₫'
}

function formatDate(dateString) {
  if (!dateString) return '—'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatDateTime(dateString) {
  if (!dateString) return '—'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const emptyMemberForm = {
  fullName: '',
  email: '',
  password: '',
  phone: '',
  dateOfBirth: '',
  gender: 'Male',
  address: '',
  fitnessGoal: '',
}

export default function FrontDeskOperations() {
  const [activeTab, setActiveTab] = useState('members') // members, checkin, packages, classes, tickets

  // Data states
  const [members, setMembers] = useState([])
  const [todayCheckIns, setTodayCheckIns] = useState([])
  const [packages, setPackages] = useState([])
  const [tickets, setTickets] = useState([])

  // Loading states
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [loadingCheckIns, setLoadingCheckIns] = useState(false)
  const [loadingPackages, setLoadingPackages] = useState(false)
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false)
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Feedback states
  const [errorMessage, setErrorMessage] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  // Modals - Members
  const [showCreateMemberModal, setShowCreateMemberModal] = useState(false)
  const [memberForm, setMemberForm] = useState(emptyMemberForm)
  const [memberToDeactivate, setMemberToDeactivate] = useState(null)
  const [selectedMemberDetail, setSelectedMemberDetail] = useState(null)

  // Search & Filters - Members
  const [memberSearch, setMemberSearch] = useState('')
  const [memberStatusFilter, setMemberStatusFilter] = useState('all') // all, active, inactive

  // Check-in Inputs
  const [qrCodeInput, setQrCodeInput] = useState('')
  const [manualMemberId, setManualMemberId] = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [checkInNotes, setCheckInNotes] = useState('')

  // Tab 3: Packages & Payment states
  const [subMemberId, setSubMemberId] = useState('')
  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [memberSubscriptions, setMemberSubscriptions] = useState([])
  const [payModalSubscription, setPayModalSubscription] = useState(null)
  const [payOsData, setPayOsData] = useState(null) // { qrCode, checkoutUrl }

  // Tab 4: Class & Attendance states
  const [classSessionId, setClassSessionId] = useState('')
  const [classMemberId, setClassMemberId] = useState('')
  const [rosterSessionId, setRosterSessionId] = useState('')
  const [sessionRoster, setSessionRoster] = useState([])
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [cancelRegModal, setCancelRegModal] = useState(null) // { registrationId, memberName }
  const [cancelReason, setCancelReason] = useState('')

  // Tab 5: Support Tickets states
  const [ticketSearch, setTicketSearch] = useState('')
  const [ticketStatusFilter, setTicketStatusFilter] = useState('all')
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState('all')
  const [ticketToResolve, setTicketToResolve] = useState(null)
  const [resolutionStatus, setResolutionStatus] = useState('Resolved')
  const [resolutionNote, setResolutionNote] = useState('')

  // Auto-dismiss success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  // Load Members
  async function loadMembersData(showSpinner = true) {
    if (showSpinner) setLoadingMembers(true)
    try {
      const data = await getMembers()
      setMembers(data)
    } catch (err) {
      setErrorMessage(err.message || 'Không thể tải danh sách hội viên.')
    } finally {
      setLoadingMembers(false)
    }
  }

  // Load Today Check-Ins
  async function loadTodayCheckInsData(showSpinner = true) {
    if (showSpinner) setLoadingCheckIns(true)
    try {
      const data = await getTodayCheckIns()
      setTodayCheckIns(data)
    } catch (err) {
      setErrorMessage(getCheckInErrorMessage(err, 'Không thể tải danh sách check-in hôm nay.'))
    } finally {
      setLoadingCheckIns(false)
    }
  }

  // Load Packages
  async function loadPackagesData() {
    setLoadingPackages(true)
    try {
      const data = await getMembershipPackages()
      const activePkgs = data.filter((p) => p.isActive !== false)
      setPackages(activePkgs)
      if (activePkgs.length > 0 && !selectedPackageId) {
        setSelectedPackageId(String(activePkgs[0].id))
      }
    } catch (err) {
      setErrorMessage(err.message || 'Không thể tải danh sách gói tập.')
    } finally {
      setLoadingPackages(false)
    }
  }

  // Load Support Tickets
  async function loadTicketsData(showSpinner = true) {
    if (showSpinner) setLoadingTickets(true)
    try {
      const data = await getAllSupportTickets(ticketStatusFilter !== 'all' ? ticketStatusFilter : null)
      setTickets(data)
    } catch (err) {
      setErrorMessage(getTicketErrorMessage(err, 'Không thể tải danh sách phiếu hỗ trợ.'))
    } finally {
      setLoadingTickets(false)
    }
  }

  // Initial load
  useEffect(() => {
    loadMembersData(true)
    loadTodayCheckInsData(false)
    loadPackagesData()
    loadTicketsData(false)
  }, [])

  // Refresh handler
  function handleRefresh() {
    if (activeTab === 'members') loadMembersData(true)
    else if (activeTab === 'checkin') loadTodayCheckInsData(true)
    else if (activeTab === 'packages') {
      loadPackagesData()
      if (subMemberId) handleLoadMemberSubscriptions(subMemberId)
    } else if (activeTab === 'classes') {
      if (rosterSessionId) handleLoadRoster(rosterSessionId)
    } else if (activeTab === 'tickets') {
      loadTicketsData(true)
    }
  }

  // Effect when switching tabs
  useEffect(() => {
    if (activeTab === 'tickets' && tickets.length === 0) {
      loadTicketsData(true)
    }
  }, [activeTab])

  // Create member at counter
  async function handleCreateMember(e) {
    e.preventDefault()
    setSubmitting(true)
    setErrorMessage(null)

    try {
      const payload = {
        ...memberForm,
        dateOfBirth: memberForm.dateOfBirth
          ? new Date(memberForm.dateOfBirth).toISOString()
          : new Date('2000-01-01').toISOString(),
      }
      await createMember(payload)
      setSuccessMessage(`Đã đăng ký tài khoản hội viên "${memberForm.fullName}" thành công!`)
      setShowCreateMemberModal(false)
      setMemberForm(emptyMemberForm)
      await loadMembersData(false)
    } catch (err) {
      setErrorMessage(err.message || 'Không thể đăng ký hội viên.')
    } finally {
      setSubmitting(false)
    }
  }

  // Deactivate (Khóa tài khoản hội viên vi phạm) - Manager Exclusive
  async function handleDeactivateMember() {
    if (!memberToDeactivate) return
    setSubmitting(true)
    setErrorMessage(null)

    try {
      await deactivateMember(memberToDeactivate.memberId)
      setSuccessMessage(`Đã khóa/vô hiệu hóa tài khoản của hội viên "${memberToDeactivate.fullName}" thành công.`)
      setMemberToDeactivate(null)
      await loadMembersData(false)
    } catch (err) {
      setErrorMessage(err.message || 'Không thể vô hiệu hóa tài khoản hội viên.')
    } finally {
      setSubmitting(false)
    }
  }

  // Check-in via QR
  async function handleScanQrCheckIn(e) {
    e.preventDefault()
    if (!qrCodeInput.trim()) return

    setSubmitting(true)
    setErrorMessage(null)
    try {
      const result = await scanQrCheckIn({ qrCode: qrCodeInput, notes: checkInNotes })
      setSuccessMessage(`Check-in thành công cho hội viên: ${result.memberName || result.memberCode}!`)
      setQrCodeInput('')
      setCheckInNotes('')
      await loadTodayCheckInsData(false)
    } catch (err) {
      setErrorMessage(getCheckInErrorMessage(err, 'Check-in bằng mã QR thất bại.'))
    } finally {
      setSubmitting(false)
    }
  }

  // Check-in via MemberId or Phone
  async function handleManualCheckIn(e) {
    e.preventDefault()
    if (!manualMemberId.trim() && !manualPhone.trim()) {
      setErrorMessage('Vui lòng nhập Mã hội viên HOẶC Số điện thoại để check-in.')
      return
    }

    setSubmitting(true)
    setErrorMessage(null)
    try {
      const result = await manualCheckIn({
        memberId: manualMemberId ? Number(manualMemberId) : null,
        phoneNumber: manualPhone || null,
        notes: checkInNotes,
      })
      setSuccessMessage(`Check-in thành công cho khách hàng: ${result.memberName || 'Hội viên'}!`)
      setManualMemberId('')
      setManualPhone('')
      setCheckInNotes('')
      await loadTodayCheckInsData(false)
    } catch (err) {
      setErrorMessage(getCheckInErrorMessage(err, 'Check-in thủ công thất bại.'))
    } finally {
      setSubmitting(false)
    }
  }

  // Check-out
  async function handleCheckOut(checkInId, memberName) {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      await checkOutGymMember(checkInId)
      setSuccessMessage(`Đã check-out cho hội viên ${memberName || ''} thành công!`)
      await loadTodayCheckInsData(false)
    } catch (err) {
      setErrorMessage(getCheckInErrorMessage(err, 'Check-out thất bại.'))
    } finally {
      setSubmitting(false)
    }
  }

  // Load subscriptions of member
  async function handleLoadMemberSubscriptions(memId) {
    if (!memId) return
    setLoadingSubscriptions(true)
    try {
      const data = await getReceptionistMemberSubscriptions(Number(memId))
      setMemberSubscriptions(data)
    } catch (err) {
      setMemberSubscriptions([])
      setErrorMessage(err.message || 'Không thể tải gói của hội viên.')
    } finally {
      setLoadingSubscriptions(false)
    }
  }

  // Register subscription at counter
  async function handleRegisterSubscription(e) {
    e.preventDefault()
    if (!subMemberId || !selectedPackageId) {
      setErrorMessage('Vui lòng chọn hội viên và gói tập.')
      return
    }

    setSubmitting(true)
    setErrorMessage(null)
    try {
      const newSub = await createReceptionistMemberSubscription(
        Number(subMemberId),
        Number(selectedPackageId)
      )
      setSuccessMessage(`Đã tạo đăng ký gói "${newSub.packageName || ''}" cho hội viên #${subMemberId}!`)
      await handleLoadMemberSubscriptions(subMemberId)
      // Open payment confirmation right away
      setPayModalSubscription(newSub)
    } catch (err) {
      setErrorMessage(err.message || 'Không thể tạo đăng ký gói.')
    } finally {
      setSubmitting(false)
    }
  }

  // Confirm direct counter payment (Cash / BankTransfer)
  async function handleConfirmCounterPayment(paymentMethod) {
    if (!payModalSubscription) return
    setSubmitting(true)
    setErrorMessage(null)

    try {
      const amount = payModalSubscription.agreedPrice || payModalSubscription.price || 0
      await confirmSubscriptionPayment(payModalSubscription.id, {
        amount,
        paymentMethod,
        paymentReceived: true,
      })
      setSuccessMessage(`Đã xác nhận thanh toán (${paymentMethod}) và kích hoạt gói thành công!`)
      setPayModalSubscription(null)
      setPayOsData(null)
      if (subMemberId) await handleLoadMemberSubscriptions(subMemberId)
    } catch (err) {
      setErrorMessage(err.message || 'Không thể xác nhận thanh toán.')
    } finally {
      setSubmitting(false)
    }
  }

  // Create PayOS online link
  async function handleCreatePayOsLink() {
    if (!payModalSubscription) return
    setSubmitting(true)
    setErrorMessage(null)

    try {
      const payment = await createPayment(payModalSubscription.id)
      setPayOsData(payment)
      setSuccessMessage('Đã tạo link thanh toán PayOS thành công! Khách hàng có thể quét mã QR để trả tiền.')
    } catch (err) {
      setErrorMessage(err.message || 'Không thể tạo mã thanh toán PayOS.')
    } finally {
      setSubmitting(false)
    }
  }

  // Book session for member
  async function handleRegisterSession(e) {
    e.preventDefault()
    if (!classSessionId || !classMemberId) {
      setErrorMessage('Vui lòng nhập Mã buổi học và Mã hội viên.')
      return
    }

    setSubmitting(true)
    setErrorMessage(null)
    try {
      const reg = await registerMemberForSession(Number(classSessionId), Number(classMemberId))
      setSuccessMessage(`Đã đăng ký hội viên #${classMemberId} vào buổi học #${classSessionId} thành công!`)
      setRosterSessionId(classSessionId)
      await handleLoadRoster(classSessionId)
      setClassMemberId('')
    } catch (err) {
      setErrorMessage(err.message || 'Không thể đăng ký buổi học.')
    } finally {
      setSubmitting(false)
    }
  }

  // Load roster
  async function handleLoadRoster(sessId) {
    if (!sessId) return
    setLoadingRoster(true)
    try {
      const data = await getReceptionistSessionRoster(Number(sessId))
      setSessionRoster(data)
    } catch (err) {
      setSessionRoster([])
      setErrorMessage(err.message || 'Không thể tải danh sách học viên của buổi học.')
    } finally {
      setLoadingRoster(false)
    }
  }

  // Check in student in roster
  async function handleCheckInStudent(student) {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      await checkInReceptionistRegistration(student.registrationId)
      setSuccessMessage(`Đã điểm danh cho học viên ${student.fullName || `#${student.memberId}`} thành công!`)
      if (rosterSessionId) await handleLoadRoster(rosterSessionId)
    } catch (err) {
      setErrorMessage(err.message || 'Không thể điểm danh học viên.')
    } finally {
      setSubmitting(false)
    }
  }

  // Cancel student registration
  async function handleCancelRegistration() {
    if (!cancelRegModal) return
    setSubmitting(true)
    setErrorMessage(null)
    try {
      await cancelReceptionistRegistration(cancelRegModal.registrationId, cancelReason || 'Hủy tại quầy lễ tân')
      setSuccessMessage('Đã hủy đăng ký buổi học và giải phóng chỗ thành công!')
      setCancelRegModal(null)
      setCancelReason('')
      if (rosterSessionId) await handleLoadRoster(rosterSessionId)
    } catch (err) {
      setErrorMessage(err.message || 'Không thể hủy đăng ký buổi học.')
    } finally {
      setSubmitting(false)
    }
  }

  // Resolve Ticket
  async function handleResolveTicket(e) {
    e.preventDefault()
    if (!ticketToResolve) return

    setSubmitting(true)
    setErrorMessage(null)
    try {
      await resolveSupportTicket(ticketToResolve.id, {
        status: resolutionStatus,
        resolutionNote: resolutionNote || 'Đã tiếp nhận và hỗ trợ tại quầy lễ tân.',
      })
      setSuccessMessage(`Đã xử lý phiếu hỗ trợ #${ticketToResolve.id} thành công!`)
      setTicketToResolve(null)
      setResolutionNote('')
      await loadTicketsData(false)
    } catch (err) {
      setErrorMessage(getTicketErrorMessage(err, 'Không thể cập nhật phiếu hỗ trợ.'))
    } finally {
      setSubmitting(false)
    }
  }

  // Filtered members
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const query = memberSearch.toLowerCase().trim()
      const matchesSearch =
        !query ||
        m.fullName?.toLowerCase().includes(query) ||
        m.email?.toLowerCase().includes(query) ||
        m.phone?.includes(query) ||
        String(m.memberId).includes(query)

      if (!matchesSearch) return false

      if (memberStatusFilter === 'active' && !m.isActive) return false
      if (memberStatusFilter === 'inactive' && m.isActive) return false

      return true
    })
  }, [members, memberSearch, memberStatusFilter])

  // Real-time gym presence calculations
  const gymStats = useMemo(() => {
    const totalToday = todayCheckIns.length
    const currentlyInGym = todayCheckIns.filter((c) => !c.checkOutTime)
    return {
      totalToday,
      currentlyInGymCount: currentlyInGym.length,
      currentlyInGymList: currentlyInGym,
    }
  }, [todayCheckIns])

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const query = ticketSearch.toLowerCase().trim()
      const matchesSearch =
        !query ||
        t.title?.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.memberName?.toLowerCase().includes(query) ||
        String(t.id).includes(query)

      if (!matchesSearch) return false

      if (ticketStatusFilter !== 'all' && t.status !== ticketStatusFilter) {
        return false
      }

      if (ticketPriorityFilter !== 'all' && t.priority !== ticketPriorityFilter) {
        return false
      }

      return true
    })
  }, [tickets, ticketSearch, ticketStatusFilter, ticketPriorityFilter])

  // Pending tickets count
  const pendingTicketsCount = useMemo(() => {
    return tickets.filter((t) => t.status === 'Open' || t.status === 'Pending').length
  }, [tickets])

  return (
    <div className="fdesk-mgmt">
      {/* Header */}
      <div className="fdesk-header">
        <div>
          <h2>
            <Headset size={22} color="var(--manager-blue, #2463eb)" />
            Vận hành dịch vụ khách hàng (FrontDesk)
          </h2>
          <p>
            Thừa hưởng quyền lễ tân & quản lý: Check-in thời gian thực, quản lý hội viên, khóa tài khoản vi phạm, đăng ký gói tập và hỗ trợ ticket.
          </p>
        </div>
        <div className="fdesk-actions">
          <button
            type="button"
            className="fdesk-btn fdesk-btn-secondary"
            onClick={handleRefresh}
            disabled={loadingMembers || loadingCheckIns || submitting}
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={15} className={loadingMembers || loadingCheckIns || loadingTickets ? 'fdesk-spin' : ''} />
            Làm mới
          </button>
          <button
            type="button"
            className="fdesk-btn fdesk-btn-primary"
            onClick={() => setShowCreateMemberModal(true)}
          >
            <UserPlus size={16} />
            Đăng ký hội viên tại quầy
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="fdesk-alert fdesk-alert-danger">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            className="fdesk-btn fdesk-btn-secondary"
            onClick={() => setErrorMessage(null)}
            style={{ padding: '4px 8px', fontSize: 11 }}
          >
            Đóng
          </button>
        </div>
      )}

      {successMessage && (
        <div className="fdesk-alert fdesk-alert-success">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={18} />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            className="fdesk-btn fdesk-btn-secondary"
            onClick={() => setSuccessMessage(null)}
            style={{ padding: '4px 8px', fontSize: 11 }}
          >
            Đóng
          </button>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="fdesk-metrics-grid">
        <div className="fdesk-metric-card">
          <div className="fdesk-metric-top">
            <span className="fdesk-metric-label">Khách đang có mặt tại phòng tập</span>
            <span className="fdesk-metric-icon green">
              <DoorOpen size={20} />
            </span>
          </div>
          <div className="fdesk-metric-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{gymStats.currentlyInGymCount}</span>
            <span className="fdesk-live-pill">
              <span className="fdesk-live-dot" />
              Real-time
            </span>
          </div>
          <p className="fdesk-metric-note">
            <UserCheck size={13} color="#059669" />
            Hội viên đã check-in chưa check-out
          </p>
        </div>

        <div className="fdesk-metric-card">
          <div className="fdesk-metric-top">
            <span className="fdesk-metric-label">Lượt Check-in hôm nay</span>
            <span className="fdesk-metric-icon blue">
              <ScanLine size={20} />
            </span>
          </div>
          <div className="fdesk-metric-value">
            {gymStats.totalToday}
            <small>lượt vào</small>
          </div>
          <p className="fdesk-metric-note">
            <Clock3 size={13} color="#2563eb" />
            Ghi nhận tại cổng kiểm soát
          </p>
        </div>

        <div className="fdesk-metric-card">
          <div className="fdesk-metric-top">
            <span className="fdesk-metric-label">Tổng số hội viên</span>
            <span className="fdesk-metric-icon purple">
              <Users size={20} />
            </span>
          </div>
          <div className="fdesk-metric-value">
            {members.length}
            <small>thành viên</small>
          </div>
          <p className="fdesk-metric-note">
            <CheckCircle2 size={13} color="#7c3aed" />
            {members.filter((m) => m.isActive).length} tài khoản đang kích hoạt
          </p>
        </div>

        <div className="fdesk-metric-card">
          <div className="fdesk-metric-top">
            <span className="fdesk-metric-label">Phiếu hỗ trợ / Ticket chờ</span>
            <span className="fdesk-metric-icon amber">
              <Headset size={20} />
            </span>
          </div>
          <div className="fdesk-metric-value" style={{ color: pendingTicketsCount > 0 ? '#d97706' : 'inherit' }}>
            {pendingTicketsCount}
            <small>yêu cầu</small>
          </div>
          <p className="fdesk-metric-note">
            <LifeBuoy size={13} color="#d97706" />
            Khiếu nại/trợ giúp từ hội viên
          </p>
        </div>
      </div>

      {/* Module Tabs */}
      <div className="fdesk-tabs">
        <button
          type="button"
          className={`fdesk-tab-btn ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          <Users size={16} />
          Quản lý Hội viên & Khóa vi phạm
          <span className="fdesk-tab-badge">{members.length}</span>
        </button>

        <button
          type="button"
          className={`fdesk-tab-btn ${activeTab === 'checkin' ? 'active' : ''}`}
          onClick={() => setActiveTab('checkin')}
        >
          <ScanLine size={16} />
          Check-in phòng tập Real-time
          {gymStats.currentlyInGymCount > 0 && (
            <span className="fdesk-tab-badge" style={{ background: '#ecfdf5', color: '#047857' }}>
              {gymStats.currentlyInGymCount} đang tập
            </span>
          )}
        </button>

        <button
          type="button"
          className={`fdesk-tab-btn ${activeTab === 'packages' ? 'active' : ''}`}
          onClick={() => setActiveTab('packages')}
        >
          <ReceiptText size={16} />
          Đăng ký gói thẻ & Thanh toán
        </button>

        <button
          type="button"
          className={`fdesk-tab-btn ${activeTab === 'classes' ? 'active' : ''}`}
          onClick={() => setActiveTab('classes')}
        >
          <CalendarDays size={16} />
          Điểm danh & Đăng ký lớp
        </button>

        <button
          type="button"
          className={`fdesk-tab-btn ${activeTab === 'tickets' ? 'active' : ''}`}
          onClick={() => setActiveTab('tickets')}
        >
          <Headset size={16} />
          Chăm sóc khách hàng & Ticket
          {pendingTicketsCount > 0 ? (
            <span className="fdesk-tab-badge danger">{pendingTicketsCount} cần xử lý</span>
          ) : (
            <span className="fdesk-tab-badge">{tickets.length}</span>
          )}
        </button>
      </div>

      {/* Tab 1: Quản lý Hội viên */}
      {activeTab === 'members' && (
        <div className="fdesk-section">
          <div className="fdesk-card">
            <div className="fdesk-card-header">
              <div>
                <h3>Danh sách hồ sơ hội viên</h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--manager-muted, #748096)' }}>
                  Tra cứu thông tin, lịch sử và sử dụng quyền Quản lý để khóa tài khoản khi phát hiện vi phạm quy định.
                </p>
              </div>
              <span className="fdesk-badge info">
                Hiển thị {filteredMembers.length} / {members.length} hội viên
              </span>
            </div>

            {/* Filter Toolbar */}
            <div className="fdesk-toolbar">
              <div className="fdesk-search-box">
                <Search size={16} color="var(--manager-muted, #748096)" />
                <input
                  type="text"
                  placeholder="Tìm theo họ tên, email, số điện thoại, mã HV..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
              </div>

              <div className="fdesk-filter-group">
                <select
                  className="fdesk-select"
                  value={memberStatusFilter}
                  onChange={(e) => setMemberStatusFilter(e.target.value)}
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="active">Đang hoạt động (Active)</option>
                  <option value="inactive">Đã khóa / Vô hiệu hóa</option>
                </select>
              </div>
            </div>

            {/* Table */}
            {loadingMembers ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                <RefreshCw size={28} className="fdesk-spin" />
                <p style={{ marginTop: 10 }}>Đang tải danh sách hội viên...</p>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                <Users size={32} />
                <p style={{ marginTop: 10 }}>Không tìm thấy hội viên phù hợp với bộ lọc.</p>
              </div>
            ) : (
              <div className="fdesk-table-scroll">
                <table className="fdesk-table">
                  <thead>
                    <tr>
                      <th>Hội viên</th>
                      <th>Liên hệ</th>
                      <th>Ngày sinh / Giới tính</th>
                      <th>Mục tiêu tập luyện</th>
                      <th>Trạng thái</th>
                      <th style={{ textAlign: 'right' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((m) => (
                      <tr key={m.memberId}>
                        <td>
                          <strong>{m.fullName}</strong>
                          <div style={{ fontSize: 11, color: 'var(--manager-muted, #748096)' }}>
                            Mã HV: #{m.memberId}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 12 }}>
                              <Phone size={12} style={{ display: 'inline', marginRight: 4 }} />
                              {m.phone || 'Chưa có SĐT'}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--manager-muted, #748096)' }}>
                              <Mail size={11} style={{ display: 'inline', marginRight: 4 }} />
                              {m.email}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span>{formatDate(m.dateOfBirth)}</span>
                          <div style={{ fontSize: 11, color: 'var(--manager-muted, #748096)' }}>
                            {m.gender === 'Male' ? 'Nam' : m.gender === 'Female' ? 'Nữ' : m.gender || '—'}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: 12, color: 'var(--manager-ink, #18263e)' }}>
                            {m.fitnessGoal || 'Rèn luyện sức khỏe'}
                          </span>
                        </td>
                        <td>
                          {m.isActive ? (
                            <span className="fdesk-badge active">
                              <CheckCircle2 size={12} /> Hoạt động
                            </span>
                          ) : (
                            <span className="fdesk-badge inactive">
                              <Ban size={12} /> Đã khóa
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <button
                              type="button"
                              className="fdesk-btn fdesk-btn-secondary"
                              style={{ padding: '6px 10px', fontSize: 11 }}
                              onClick={() => {
                                setSubMemberId(String(m.memberId))
                                setActiveTab('packages')
                                handleLoadMemberSubscriptions(m.memberId)
                              }}
                              title="Đăng ký gói thẻ cho hội viên này"
                            >
                              Đăng ký gói
                            </button>

                            <button
                              type="button"
                              className="fdesk-btn fdesk-btn-secondary"
                              style={{ padding: '6px 10px', fontSize: 11 }}
                              onClick={() => setSelectedMemberDetail(m)}
                              title="Xem chi tiết hồ sơ"
                            >
                              Chi tiết
                            </button>

                            {/* Quyền độc quyền của Manager: Khóa tài khoản vi phạm */}
                            {m.isActive ? (
                              <button
                                type="button"
                                className="fdesk-btn fdesk-btn-danger"
                                style={{ padding: '6px 10px', fontSize: 11 }}
                                onClick={() => setMemberToDeactivate(m)}
                                title="Khóa / Vô hiệu hóa tài khoản vi phạm quy định"
                              >
                                <Ban size={12} />
                                Khóa
                              </button>
                            ) : (
                              <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>
                                Đã vô hiệu hóa
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Check-in phòng tập Real-time */}
      {activeTab === 'checkin' && (
        <div className="fdesk-section">
          {/* Check-in panel */}
          <div className="fdesk-checkin-panel">
            {/* Phương án 1: Quét mã QR */}
            <div className="fdesk-checkin-box">
              <h4>
                <QrCode size={18} color="var(--manager-blue, #2463eb)" />
                Quét mã QR thẻ hội viên
              </h4>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--manager-muted, #748096)' }}>
                Sử dụng máy quét mã vạch/camera hoặc dán chuỗi dữ liệu mã QR từ ứng dụng của khách.
              </p>
              <form onSubmit={handleScanQrCheckIn} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="fdesk-input-group">
                  <label htmlFor="qr-code-input">Dữ liệu mã QR:</label>
                  <input
                    id="qr-code-input"
                    type="text"
                    className="fdesk-input"
                    placeholder="Quét hoặc nhập mã QR (vd: MEM-1028-QR)..."
                    value={qrCodeInput}
                    onChange={(e) => setQrCodeInput(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="fdesk-input-group">
                  <label htmlFor="qr-notes-input">Ghi chú (tùy chọn):</label>
                  <input
                    id="qr-notes-input"
                    type="text"
                    className="fdesk-input"
                    placeholder="Ghi chú check-in nếu có..."
                    value={checkInNotes}
                    onChange={(e) => setCheckInNotes(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="fdesk-btn fdesk-btn-primary"
                  disabled={submitting || !qrCodeInput.trim()}
                >
                  <ScanLine size={16} />
                  Xác nhận Check-in QR
                </button>
              </form>
            </div>

            {/* Phương án 2: Nhập tay MemberId hoặc SĐT */}
            <div className="fdesk-checkin-box">
              <h4>
                <UserCheck size={18} color="#059669" />
                Check-in thủ công tại quầy
              </h4>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--manager-muted, #748096)' }}>
                Dành cho trường hợp khách quên điện thoại hoặc mã QR không quét được.
              </p>
              <form onSubmit={handleManualCheckIn} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="fdesk-input-group">
                  <label htmlFor="manual-member-id">Mã hội viên (Member ID):</label>
                  <input
                    id="manual-member-id"
                    type="number"
                    className="fdesk-input"
                    placeholder="Nhập mã số hội viên (vd: 12)"
                    value={manualMemberId}
                    onChange={(e) => setManualMemberId(e.target.value)}
                  />
                </div>
                <div className="fdesk-input-group">
                  <label htmlFor="manual-phone">Hoặc Số điện thoại:</label>
                  <input
                    id="manual-phone"
                    type="tel"
                    className="fdesk-input"
                    placeholder="Số điện thoại hội viên đăng ký (vd: 0987654321)"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="fdesk-btn fdesk-btn-success"
                  disabled={submitting || (!manualMemberId.trim() && !manualPhone.trim())}
                >
                  <LogIn size={16} />
                  Check-in thủ công
                </button>
              </form>
            </div>
          </div>

          {/* Today Check-in History Table */}
          <div className="fdesk-card">
            <div className="fdesk-card-header">
              <div>
                <h3>Danh sách khách ra vào trong ngày</h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--manager-muted, #748096)' }}>
                  Theo dõi thời gian vào/ra và số lượng người đang tập luyện thực tế.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="fdesk-live-pill">
                  <span className="fdesk-live-dot" />
                  {gymStats.currentlyInGymCount} người đang có mặt
                </span>
                <span className="fdesk-badge info">{todayCheckIns.length} lượt hôm nay</span>
              </div>
            </div>

            {loadingCheckIns ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                <RefreshCw size={28} className="fdesk-spin" />
                <p style={{ marginTop: 10 }}>Đang tải lịch sử check-in...</p>
              </div>
            ) : todayCheckIns.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                <DoorOpen size={32} />
                <p style={{ marginTop: 10 }}>Hôm nay chưa có lượt check-in nào được ghi nhận.</p>
              </div>
            ) : (
              <div className="fdesk-table-scroll">
                <table className="fdesk-table">
                  <thead>
                    <tr>
                      <th>Hội viên</th>
                      <th>Số điện thoại</th>
                      <th>Gói tập sử dụng</th>
                      <th>Thời gian vào</th>
                      <th>Thời gian ra</th>
                      <th>Trạng thái</th>
                      <th>Nhân viên trực</th>
                      <th style={{ textAlign: 'right' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayCheckIns.map((ci) => {
                      const isStillInGym = !ci.checkOutTime

                      return (
                        <tr key={ci.id}>
                          <td>
                            <strong>{ci.memberName || 'Hội viên'}</strong>
                            <div style={{ fontSize: 11, color: 'var(--manager-muted, #748096)' }}>
                              Mã: #{ci.memberCode || ci.memberId}
                            </div>
                          </td>
                          <td>{ci.phoneNumber || '—'}</td>
                          <td>
                            <span style={{ fontWeight: 600, color: 'var(--manager-blue, #2463eb)' }}>
                              {ci.packageName || 'Gói tập tiêu chuẩn'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#059669', fontWeight: 600 }}>
                              <Clock size={13} />
                              {formatDateTime(ci.checkInTime)}
                            </div>
                          </td>
                          <td>
                            {ci.checkOutTime ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#64748b' }}>
                                <Clock3 size={13} />
                                {formatDateTime(ci.checkOutTime)}
                              </div>
                            ) : (
                              <span style={{ color: '#d97706', fontSize: 12, fontWeight: 600 }}>
                                Chưa check-out
                              </span>
                            )}
                          </td>
                          <td>
                            {isStillInGym ? (
                              <span className="fdesk-badge present">
                                <span className="fdesk-live-dot" /> Đang tập
                              </span>
                            ) : (
                              <span className="fdesk-badge" style={{ background: '#f1f5f9', color: '#64748b' }}>
                                Đã về
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--manager-muted, #748096)' }}>
                            {ci.checkedByStaffName || 'Lễ tân / Quản lý'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {isStillInGym ? (
                              <button
                                type="button"
                                className="fdesk-btn fdesk-btn-secondary"
                                style={{ padding: '6px 12px', fontSize: 12, color: '#d97706', borderColor: '#fde68a' }}
                                onClick={() => handleCheckOut(ci.id, ci.memberName)}
                                disabled={submitting}
                                title="Xác nhận khách ra về"
                              >
                                <LogOut size={13} />
                                Check-out
                              </button>
                            ) : (
                              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                                Hoàn tất
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
        </div>
      )}

      {/* Tab 3: Đăng ký gói thẻ & Thanh toán tại quầy */}
      {activeTab === 'packages' && (
        <div className="fdesk-section">
          {/* Card: Đăng ký gói mới cho hội viên */}
          <div className="fdesk-card">
            <div className="fdesk-card-header">
              <div>
                <h3>Đăng ký gói thẻ hội viên tại quầy</h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--manager-muted, #748096)' }}>
                  Chọn hội viên và gói tập phù hợp. Sau khi đăng ký có thể xác nhận thu tiền mặt hoặc tạo link PayOS.
                </p>
              </div>
            </div>

            <form onSubmit={handleRegisterSubscription} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                <div className="fdesk-input-group">
                  <label htmlFor="sub-member-select">Chọn hội viên (*):</label>
                  <select
                    id="sub-member-select"
                    className="fdesk-select"
                    value={subMemberId}
                    onChange={(e) => {
                      setSubMemberId(e.target.value)
                      handleLoadMemberSubscriptions(e.target.value)
                    }}
                    required
                  >
                    <option value="">-- Chọn hội viên --</option>
                    {members.map((m) => (
                      <option key={m.memberId} value={m.memberId}>
                        #{m.memberId} - {m.fullName} ({m.phone || m.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="fdesk-input-group">
                  <label htmlFor="sub-package-select">Chọn gói thẻ (*):</label>
                  <select
                    id="sub-package-select"
                    className="fdesk-select"
                    value={selectedPackageId}
                    onChange={(e) => setSelectedPackageId(e.target.value)}
                    required
                  >
                    {packages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.packageName} — {formatVND(pkg.price)} ({pkg.durationInDays} ngày)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Package cards preview */}
              <div className="fdesk-package-grid" style={{ padding: 0 }}>
                {packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className={`fdesk-package-card ${selectedPackageId === String(pkg.id) ? 'selected' : ''}`}
                    onClick={() => setSelectedPackageId(String(pkg.id))}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{pkg.packageName}</strong>
                      {selectedPackageId === String(pkg.id) && <CheckCircle2 size={16} color="var(--manager-blue, #2463eb)" />}
                    </div>
                    <div className="fdesk-package-price">{formatVND(pkg.price)}</div>
                    <div style={{ fontSize: 12, color: 'var(--manager-muted, #748096)' }}>
                      Thời hạn: <strong>{pkg.durationInDays} ngày</strong>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>
                      {pkg.description || 'Gói tập chất lượng cao tại Sports Center.'}
                    </p>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="submit"
                  className="fdesk-btn fdesk-btn-primary"
                  disabled={submitting || !subMemberId || !selectedPackageId}
                >
                  <Plus size={16} />
                  {submitting ? 'Đang tạo...' : 'Tạo đăng ký gói & Chuyển sang thanh toán'}
                </button>
              </div>
            </form>
          </div>

          {/* Subscriptions history of selected member */}
          {subMemberId && (
            <div className="fdesk-card">
              <div className="fdesk-card-header">
                <div>
                  <h3>Lịch sử đăng ký gói của hội viên #{subMemberId}</h3>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--manager-muted, #748096)' }}>
                    Danh sách các gói thẻ đã đăng ký, trạng thái thanh toán và hiệu lực.
                  </p>
                </div>
                <button
                  type="button"
                  className="fdesk-btn fdesk-btn-secondary"
                  style={{ padding: '6px 12px', fontSize: 11 }}
                  onClick={() => handleLoadMemberSubscriptions(subMemberId)}
                  disabled={loadingSubscriptions}
                >
                  <RefreshCw size={13} className={loadingSubscriptions ? 'fdesk-spin' : ''} />
                  Làm mới gói
                </button>
              </div>

              {loadingSubscriptions ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                  <RefreshCw size={26} className="fdesk-spin" />
                  <p style={{ marginTop: 8 }}>Đang tải danh sách gói của hội viên...</p>
                </div>
              ) : memberSubscriptions.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                  <Package size={30} />
                  <p style={{ marginTop: 8 }}>Hội viên này chưa đăng ký gói thẻ nào.</p>
                </div>
              ) : (
                <div className="fdesk-table-scroll">
                  <table className="fdesk-table">
                    <thead>
                      <tr>
                        <th>Mã ĐK</th>
                        <th>Gói thẻ</th>
                        <th>Giá thỏa thuận</th>
                        <th>Thời hạn</th>
                        <th>Hiệu lực</th>
                        <th>Trạng thái</th>
                        <th style={{ textAlign: 'right' }}>Thanh toán</th>
                      </tr>
                    </thead>
                    <tbody>
                      {memberSubscriptions.map((sub) => {
                        const isPending = sub.status === 'Pending'

                        return (
                          <tr key={sub.id}>
                            <td>
                              <strong>#{sub.id}</strong>
                            </td>
                            <td>
                              <strong>{sub.packageName}</strong>
                            </td>
                            <td style={{ fontWeight: 600, color: '#059669' }}>
                              {formatVND(sub.agreedPrice || sub.price)}
                            </td>
                            <td>{sub.durationInDays} ngày</td>
                            <td style={{ fontSize: 12 }}>
                              {sub.startDate
                                ? `${formatDate(sub.startDate)} – ${formatDate(sub.endDate)}`
                                : 'Chờ kích hoạt khi thanh toán'}
                            </td>
                            <td>
                              {sub.status === 'Active' ? (
                                <span className="fdesk-badge active">
                                  <CheckCircle2 size={12} /> Đang hoạt động
                                </span>
                              ) : sub.status === 'Pending' ? (
                                <span className="fdesk-badge warning">
                                  <Clock3 size={12} /> Chờ thanh toán
                                </span>
                              ) : sub.status === 'Expired' ? (
                                <span className="fdesk-badge inactive">Hết hạn</span>
                              ) : (
                                <span className="fdesk-badge">{sub.status}</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {isPending ? (
                                <button
                                  type="button"
                                  className="fdesk-btn fdesk-btn-success"
                                  style={{ padding: '6px 12px', fontSize: 12 }}
                                  onClick={() => {
                                    setPayModalSubscription(sub)
                                    setPayOsData(null)
                                  }}
                                >
                                  <CreditCard size={13} />
                                  Thu tiền / PayOS
                                </button>
                              ) : (
                                <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>
                                  Đã thanh toán
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
          )}
        </div>
      )}

      {/* Tab 4: Điểm danh & Quản lý đăng ký lớp */}
      {activeTab === 'classes' && (
        <div className="fdesk-section">
          {/* Card 1: Thêm học viên vào buổi học */}
          <div className="fdesk-card">
            <div className="fdesk-card-header">
              <div>
                <h3>Đăng ký buổi học cho học viên tại quầy</h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--manager-muted, #748096)' }}>
                  Hỗ trợ học viên đăng ký hoặc đặt chỗ ca học trực tiếp tại quầy lễ tân.
                </p>
              </div>
            </div>

            <form onSubmit={handleRegisterSession} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                <div className="fdesk-input-group">
                  <label htmlFor="class-session-id">Mã buổi học (Session ID) (*):</label>
                  <input
                    id="class-session-id"
                    type="number"
                    min="1"
                    className="fdesk-input"
                    placeholder="Ví dụ: 12"
                    value={classSessionId}
                    onChange={(e) => setClassSessionId(e.target.value)}
                    required
                  />
                </div>

                <div className="fdesk-input-group">
                  <label htmlFor="class-member-select">Học viên (*):</label>
                  <select
                    id="class-member-select"
                    className="fdesk-select"
                    value={classMemberId}
                    onChange={(e) => setClassMemberId(e.target.value)}
                    required
                  >
                    <option value="">-- Chọn hội viên --</option>
                    {members.map((m) => (
                      <option key={m.memberId} value={m.memberId}>
                        #{m.memberId} - {m.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="submit"
                  className="fdesk-btn fdesk-btn-primary"
                  disabled={submitting || !classSessionId || !classMemberId}
                >
                  <Plus size={16} />
                  {submitting ? 'Đang đăng ký...' : 'Xác nhận đăng ký buổi học'}
                </button>
              </div>
            </form>
          </div>

          {/* Card 2: Danh sách học viên & Điểm danh buổi học */}
          <div className="fdesk-card">
            <div className="fdesk-card-header">
              <div>
                <h3>Danh sách học viên & Điểm danh buổi học</h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--manager-muted, #748096)' }}>
                  Nhập mã buổi học để tra cứu danh sách học viên đăng ký, điểm danh hoặc hủy đăng ký khi có yêu cầu.
                </p>
              </div>
            </div>

            <div className="fdesk-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', width: '100%' }}>
                <div className="fdesk-input-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <label htmlFor="roster-session-input" style={{ whiteSpace: 'nowrap' }}>Mã buổi học:</label>
                  <input
                    id="roster-session-input"
                    type="number"
                    min="1"
                    className="fdesk-input"
                    style={{ width: 140 }}
                    placeholder="Nhập Session ID"
                    value={rosterSessionId}
                    onChange={(e) => setRosterSessionId(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  className="fdesk-btn fdesk-btn-primary"
                  onClick={() => handleLoadRoster(rosterSessionId)}
                  disabled={loadingRoster || !rosterSessionId}
                >
                  <Search size={15} />
                  {loadingRoster ? 'Đang tải...' : 'Xem danh sách học viên'}
                </button>

                {sessionRoster.length > 0 && (
                  <span className="fdesk-badge info" style={{ marginLeft: 'auto' }}>
                    {sessionRoster.length} học viên đăng ký
                  </span>
                )}
              </div>
            </div>

            {loadingRoster ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                <RefreshCw size={28} className="fdesk-spin" />
                <p style={{ marginTop: 10 }}>Đang tải danh sách học viên của buổi học...</p>
              </div>
            ) : sessionRoster.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                <CalendarDays size={32} />
                <p style={{ marginTop: 10 }}>
                  {rosterSessionId
                    ? 'Buổi học này chưa có học viên nào đăng ký.'
                    : 'Nhập mã buổi học và bấm "Xem danh sách học viên" để điểm danh.'}
                </p>
              </div>
            ) : (
              <div className="fdesk-table-scroll">
                <table className="fdesk-table">
                  <thead>
                    <tr>
                      <th>Mã ĐK</th>
                      <th>Học viên</th>
                      <th>Mã hội viên</th>
                      <th>Trạng thái đăng ký</th>
                      <th>Điểm danh</th>
                      <th>Thời gian check-in</th>
                      <th style={{ textAlign: 'right' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionRoster.map((student) => {
                      const isPresent = Boolean(student.checkInTime) || student.attendanceStatus === 'Present'

                      return (
                        <tr key={student.registrationId}>
                          <td>
                            <strong>#{student.registrationId}</strong>
                          </td>
                          <td>
                            <strong>{student.fullName || 'Học viên'}</strong>
                          </td>
                          <td>#{student.memberId}</td>
                          <td>
                            <span className="fdesk-badge info">
                              {student.registrationStatus || 'Registered'}
                            </span>
                          </td>
                          <td>
                            {isPresent ? (
                              <span className="fdesk-badge present">
                                <Check size={12} /> Có mặt
                              </span>
                            ) : (
                              <span className="fdesk-badge absent">
                                Chưa điểm danh
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {student.checkInTime ? formatDateTime(student.checkInTime) : '—'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="fdesk-action-group">
                              {!isPresent ? (
                                <button
                                  type="button"
                                  className="fdesk-btn fdesk-btn-success"
                                  style={{ padding: '6px 12px', fontSize: 11 }}
                                  onClick={() => handleCheckInStudent(student)}
                                  disabled={submitting}
                                  title="Điểm danh có mặt tại lớp"
                                >
                                  <Check size={12} />
                                  Điểm danh
                                </button>
                              ) : (
                                <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>
                                  Đã check-in
                                </span>
                              )}

                              <button
                                type="button"
                                className="fdesk-btn fdesk-btn-danger"
                                style={{ padding: '6px 10px', fontSize: 11 }}
                                onClick={() => setCancelRegModal({
                                  registrationId: student.registrationId,
                                  memberName: student.fullName,
                                })}
                                disabled={submitting}
                                title="Hủy đăng ký và giải phóng chỗ"
                              >
                                <Trash2 size={12} />
                                Hủy chỗ
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Chăm sóc khách hàng & Ticket */}
      {activeTab === 'tickets' && (
        <div className="fdesk-section">
          <div className="fdesk-card">
            <div className="fdesk-card-header">
              <div>
                <h3>Danh sách phiếu khiếu nại & yêu cầu hỗ trợ</h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--manager-muted, #748096)' }}>
                  Tiếp nhận các vấn đề hội viên gửi lên, cập nhật tiến độ và gửi ghi chú giải quyết trực tiếp.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {pendingTicketsCount > 0 && (
                  <span className="fdesk-badge warning">
                    {pendingTicketsCount} phiếu chưa xử lý
                  </span>
                )}
                <span className="fdesk-badge info">
                  Tổng {tickets.length} phiếu
                </span>
              </div>
            </div>

            {/* Filter toolbar */}
            <div className="fdesk-toolbar">
              <div className="fdesk-search-box">
                <Search size={16} color="var(--manager-muted, #748096)" />
                <input
                  type="text"
                  placeholder="Tìm theo tiêu đề, nội dung, tên hội viên..."
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                />
              </div>

              <div className="fdesk-filter-group">
                <select
                  className="fdesk-select"
                  value={ticketStatusFilter}
                  onChange={(e) => {
                    setTicketStatusFilter(e.target.value)
                  }}
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="Pending">Chờ xử lý (Pending)</option>
                  <option value="Open">Đang mở (Open)</option>
                  <option value="Resolved">Đã giải quyết (Resolved)</option>
                  <option value="Closed">Đã đóng (Closed)</option>
                </select>

                <select
                  className="fdesk-select"
                  value={ticketPriorityFilter}
                  onChange={(e) => setTicketPriorityFilter(e.target.value)}
                >
                  <option value="all">Tất cả mức độ ưu tiên</option>
                  <option value="Urgent">Khẩn cấp (Urgent)</option>
                  <option value="High">Cao (High)</option>
                  <option value="Normal">Bình thường (Normal)</option>
                </select>
              </div>
            </div>

            {/* Tickets table */}
            {loadingTickets ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                <RefreshCw size={28} className="fdesk-spin" />
                <p style={{ marginTop: 10 }}>Đang tải danh sách phiếu hỗ trợ...</p>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                <Headset size={32} />
                <p style={{ marginTop: 10 }}>Không có phiếu hỗ trợ nào phù hợp với bộ lọc.</p>
              </div>
            ) : (
              <div className="fdesk-table-scroll">
                <table className="fdesk-table">
                  <thead>
                    <tr>
                      <th>Mã</th>
                      <th>Tiêu đề & Nội dung khiếu nại</th>
                      <th>Hội viên</th>
                      <th>Ưu tiên</th>
                      <th>Thời gian gửi</th>
                      <th>Trạng thái</th>
                      <th>Người xử lý & Phản hồi</th>
                      <th style={{ textAlign: 'right' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map((t) => {
                      const isPending = t.status === 'Pending' || t.status === 'Open'
                      const priorityTone =
                        t.priority === 'Urgent'
                          ? 'urgent'
                          : t.priority === 'High'
                          ? 'high'
                          : 'normal'

                      return (
                        <tr key={t.id}>
                          <td>
                            <strong>#{t.id}</strong>
                          </td>
                          <td style={{ maxWidth: 300 }}>
                            <strong style={{ display: 'block', fontSize: 13, color: 'var(--manager-ink, #18263e)' }}>
                              {t.title}
                            </strong>
                            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--manager-muted, #748096)', lineHeight: 1.4 }}>
                              {t.description}
                            </p>
                          </td>
                          <td>
                            <strong>{t.memberName || 'Hội viên'}</strong>
                          </td>
                          <td>
                            <span className={`fdesk-priority-pill ${priorityTone}`}>
                              {t.priority}
                            </span>
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {formatDateTime(t.createdAt)}
                          </td>
                          <td>
                            {t.status === 'Resolved' ? (
                              <span className="fdesk-badge success">
                                <CheckCircle2 size={12} /> Đã giải quyết
                              </span>
                            ) : t.status === 'Closed' ? (
                              <span className="fdesk-badge" style={{ background: '#f1f5f9', color: '#64748b' }}>
                                Đã đóng
                              </span>
                            ) : (
                              <span className="fdesk-badge warning">
                                <Clock3 size={12} /> Chờ xử lý
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: 12, maxWidth: 240 }}>
                            {t.handledByUserName && (
                              <div style={{ color: 'var(--manager-blue, #2463eb)', fontWeight: 600 }}>
                                Xử lý bởi: {t.handledByUserName}
                              </div>
                            )}
                            {t.resolutionNote ? (
                              <div className="fdesk-ticket-note-box">
                                {t.resolutionNote}
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>Chưa có phản hồi</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="fdesk-btn fdesk-btn-primary"
                              style={{ padding: '6px 12px', fontSize: 11 }}
                              onClick={() => {
                                setTicketToResolve(t)
                                setResolutionStatus(t.status === 'Resolved' ? 'Closed' : 'Resolved')
                                setResolutionNote(t.resolutionNote || '')
                              }}
                              title="Xử lý và gửi phản hồi"
                            >
                              <MessageSquare size={13} />
                              {isPending ? 'Xử lý ticket' : 'Cập nhật lại'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Xử lý Ticket */}
      {ticketToResolve && (
        <div className="fdesk-dialog-overlay" onClick={() => setTicketToResolve(null)}>
          <div className="fdesk-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="fdesk-dialog-header">
              <h3>Phản hồi & Xử lý phiếu hỗ trợ #{ticketToResolve.id}</h3>
              <button
                type="button"
                className="fdesk-dialog-close"
                onClick={() => setTicketToResolve(null)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleResolveTicket}>
              <div className="fdesk-dialog-body">
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div>Hội viên gửi: <strong>{ticketToResolve.memberName}</strong></div>
                  <div>Tiêu đề: <strong>{ticketToResolve.title}</strong></div>
                  <div style={{ fontSize: 12, color: 'var(--manager-muted, #748096)' }}>
                    Nội dung: {ticketToResolve.description}
                  </div>
                </div>

                <div className="fdesk-input-group">
                  <label htmlFor="resolve-status-select">Cập nhật trạng thái (*):</label>
                  <select
                    id="resolve-status-select"
                    className="fdesk-select"
                    value={resolutionStatus}
                    onChange={(e) => setResolutionStatus(e.target.value)}
                    required
                  >
                    <option value="Resolved">Đã giải quyết (Resolved)</option>
                    <option value="Closed">Đóng phiếu hỗ trợ (Closed)</option>
                    <option value="In Progress">Đang xử lý (In Progress)</option>
                  </select>
                </div>

                <div className="fdesk-input-group">
                  <label htmlFor="resolve-note-input">Nội dung giải quyết / Phản hồi tới hội viên (*):</label>
                  <textarea
                    id="resolve-note-input"
                    rows={4}
                    required
                    className="fdesk-input"
                    placeholder="Ghi rõ giải pháp đã hỗ trợ (vd: Đã kiểm tra và đổi lịch học / Đã hướng dẫn tại quầy)..."
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>

              <div className="fdesk-dialog-footer">
                <button
                  type="button"
                  className="fdesk-btn fdesk-btn-secondary"
                  onClick={() => setTicketToResolve(null)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="fdesk-btn fdesk-btn-primary"
                  disabled={submitting || !resolutionNote.trim()}
                >
                  {submitting ? 'Đang cập nhật...' : 'Xác nhận xử lý'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Thanh toán gói tập (Tiền mặt / PayOS QR) */}
      {payModalSubscription && (
        <div className="fdesk-dialog-overlay" onClick={() => setPayModalSubscription(null)}>
          <div className="fdesk-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="fdesk-dialog-header">
              <h3>
                Xác nhận thanh toán gói #{payModalSubscription.id}
              </h3>
              <button
                type="button"
                className="fdesk-dialog-close"
                onClick={() => setPayModalSubscription(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="fdesk-dialog-body">
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div>Gói thẻ: <strong>{payModalSubscription.packageName}</strong></div>
                <div>Số tiền cần thanh toán: <strong style={{ color: '#059669', fontSize: 16 }}>{formatVND(payModalSubscription.agreedPrice || payModalSubscription.price)}</strong></div>
                <div>Thời hạn: <strong>{payModalSubscription.durationInDays} ngày</strong></div>
              </div>

              {/* PayOS QR code preview if generated */}
              {payOsData ? (
                <div className="fdesk-qr-container">
                  <h4>Mã QR thanh toán PayOS</h4>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                    Cho hội viên quét mã bằng ứng dụng Ngân hàng để thanh toán ngay lập tức.
                  </p>
                  {payOsData.qrCode ? (
                    <img
                      src={payOsData.qrCode}
                      alt="PayOS QR Code"
                      className="fdesk-qr-image"
                    />
                  ) : (
                    <div style={{ padding: 20 }}>
                      <QrCode size={80} color="#2563eb" />
                    </div>
                  )}
                  {payOsData.checkoutUrl && (
                    <a
                      href={payOsData.checkoutUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="fdesk-btn fdesk-btn-primary"
                      style={{ textDecoration: 'none' }}
                    >
                      <ExternalLink size={14} />
                      Mở cổng thanh toán PayOS
                    </a>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Chọn hình thức thanh toán:</p>
                  <button
                    type="button"
                    className="fdesk-btn fdesk-btn-success"
                    style={{ justifyContent: 'center', padding: '12px' }}
                    onClick={() => handleConfirmCounterPayment('Cash')}
                    disabled={submitting}
                  >
                    <Wallet size={16} />
                    Thu tiền mặt tại quầy (Kích hoạt ngay)
                  </button>

                  <button
                    type="button"
                    className="fdesk-btn fdesk-btn-secondary"
                    style={{ justifyContent: 'center', padding: '12px', borderColor: '#2563eb', color: '#2563eb' }}
                    onClick={() => handleConfirmCounterPayment('BankTransfer')}
                    disabled={submitting}
                  >
                    <CreditCard size={16} />
                    Chuyển khoản trực tiếp vào tài khoản trung tâm
                  </button>

                  <button
                    type="button"
                    className="fdesk-btn fdesk-btn-primary"
                    style={{ justifyContent: 'center', padding: '12px' }}
                    onClick={handleCreatePayOsLink}
                    disabled={submitting}
                  >
                    <QrCode size={16} />
                    Tạo mã QR thanh toán PayOS trực tuyến
                  </button>
                </div>
              )}
            </div>
            <div className="fdesk-dialog-footer">
              <button
                type="button"
                className="fdesk-btn fdesk-btn-secondary"
                onClick={() => setPayModalSubscription(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Hủy đăng ký buổi học */}
      {cancelRegModal && (
        <div className="fdesk-dialog-overlay" onClick={() => setCancelRegModal(null)}>
          <div className="fdesk-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="fdesk-dialog-header">
              <h3 style={{ color: '#dc2626' }}>Hủy đăng ký buổi học</h3>
              <button
                type="button"
                className="fdesk-dialog-close"
                onClick={() => setCancelRegModal(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="fdesk-dialog-body">
              <p style={{ margin: 0, fontSize: 13 }}>
                Xác nhận hủy lượt đăng ký <strong>#{cancelRegModal.registrationId}</strong> của học viên{' '}
                <strong>{cancelRegModal.memberName || ''}</strong>?
              </p>
              <div className="fdesk-input-group">
                <label htmlFor="cancel-reason-input">Lý do hủy:</label>
                <input
                  id="cancel-reason-input"
                  type="text"
                  className="fdesk-input"
                  placeholder="Học viên báo bận / Yêu cầu hủy tại quầy..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </div>
            </div>
            <div className="fdesk-dialog-footer">
              <button
                type="button"
                className="fdesk-btn fdesk-btn-secondary"
                onClick={() => setCancelRegModal(null)}
              >
                Giữ lại
              </button>
              <button
                type="button"
                className="fdesk-btn fdesk-btn-danger"
                style={{ background: '#dc2626', color: '#fff' }}
                onClick={handleCancelRegistration}
                disabled={submitting}
              >
                {submitting ? 'Đang hủy...' : 'Xác nhận hủy chỗ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Đăng ký hội viên tại quầy */}
      {showCreateMemberModal && (
        <div className="fdesk-dialog-overlay" onClick={() => setShowCreateMemberModal(false)}>
          <div className="fdesk-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="fdesk-dialog-header">
              <h3>Đăng ký hồ sơ hội viên mới tại quầy</h3>
              <button
                type="button"
                className="fdesk-dialog-close"
                onClick={() => setShowCreateMemberModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateMember}>
              <div className="fdesk-dialog-body">
                <div className="fdesk-input-group">
                  <label>Họ và tên (*):</label>
                  <input
                    type="text"
                    required
                    className="fdesk-input"
                    placeholder="Nguyễn Văn A"
                    value={memberForm.fullName}
                    onChange={(e) => setMemberForm({ ...memberForm, fullName: e.target.value })}
                  />
                </div>

                <div className="fdesk-input-group">
                  <label>Email (*):</label>
                  <input
                    type="email"
                    required
                    className="fdesk-input"
                    placeholder="nguyenvana@gmail.com"
                    value={memberForm.email}
                    onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                  />
                </div>

                <div className="fdesk-input-group">
                  <label>Mật khẩu khởi tạo (*):</label>
                  <input
                    type="password"
                    required
                    className="fdesk-input"
                    placeholder="Tối thiểu 6 ký tự"
                    value={memberForm.password}
                    onChange={(e) => setMemberForm({ ...memberForm, password: e.target.value })}
                  />
                </div>

                <div className="fdesk-input-group">
                  <label>Số điện thoại (*):</label>
                  <input
                    type="tel"
                    required
                    className="fdesk-input"
                    placeholder="0987654321"
                    value={memberForm.phone}
                    onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="fdesk-input-group">
                    <label>Ngày sinh:</label>
                    <input
                      type="date"
                      className="fdesk-input"
                      value={memberForm.dateOfBirth}
                      onChange={(e) => setMemberForm({ ...memberForm, dateOfBirth: e.target.value })}
                    />
                  </div>
                  <div className="fdesk-input-group">
                    <label>Giới tính:</label>
                    <select
                      className="fdesk-select"
                      value={memberForm.gender}
                      onChange={(e) => setMemberForm({ ...memberForm, gender: e.target.value })}
                    >
                      <option value="Male">Nam</option>
                      <option value="Female">Nữ</option>
                      <option value="Other">Khác</option>
                    </select>
                  </div>
                </div>

                <div className="fdesk-input-group">
                  <label>Địa chỉ:</label>
                  <input
                    type="text"
                    className="fdesk-input"
                    placeholder="Số nhà, đường, quận/huyện..."
                    value={memberForm.address}
                    onChange={(e) => setMemberForm({ ...memberForm, address: e.target.value })}
                  />
                </div>

                <div className="fdesk-input-group">
                  <label>Mục tiêu tập luyện:</label>
                  <input
                    type="text"
                    className="fdesk-input"
                    placeholder="Giảm cân, Tăng cơ, Thể lực, Yoga..."
                    value={memberForm.fitnessGoal}
                    onChange={(e) => setMemberForm({ ...memberForm, fitnessGoal: e.target.value })}
                  />
                </div>
              </div>

              <div className="fdesk-dialog-footer">
                <button
                  type="button"
                  className="fdesk-btn fdesk-btn-secondary"
                  onClick={() => setShowCreateMemberModal(false)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="fdesk-btn fdesk-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Đang tạo...' : 'Tạo hồ sơ hội viên'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Xác nhận Khóa / Vô hiệu hóa tài khoản hội viên */}
      {memberToDeactivate && (
        <div className="fdesk-dialog-overlay" onClick={() => setMemberToDeactivate(null)}>
          <div className="fdesk-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="fdesk-dialog-header">
              <h3 style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldAlert size={20} />
                Khóa tài khoản hội viên vi phạm
              </h3>
              <button
                type="button"
                className="fdesk-dialog-close"
                onClick={() => setMemberToDeactivate(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="fdesk-dialog-body">
              <p style={{ margin: 0, fontSize: 14, color: 'var(--manager-ink, #18263e)' }}>
                Bạn có chắc chắn muốn vô hiệu hóa tài khoản của hội viên{' '}
                <strong>{memberToDeactivate.fullName}</strong> (Mã: #{memberToDeactivate.memberId})?
              </p>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 14, borderRadius: 8, fontSize: 12, color: '#991b1b' }}>
                <AlertTriangle size={15} style={{ display: 'inline', marginRight: 6 }} />
                <strong>Hậu quả:</strong> Tài khoản này sẽ bị ngừng kích hoạt ngay lập tức, không thể check-in phòng gym hoặc tham gia các lớp học, nhưng lịch sử giao dịch và dữ liệu tài chính vẫn được lưu giữ trọn vẹn để kiểm toán.
              </div>
            </div>
            <div className="fdesk-dialog-footer">
              <button
                type="button"
                className="fdesk-btn fdesk-btn-secondary"
                onClick={() => setMemberToDeactivate(null)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="fdesk-btn fdesk-btn-danger"
                style={{ background: '#dc2626', color: '#fff' }}
                onClick={handleDeactivateMember}
                disabled={submitting}
              >
                {submitting ? 'Đang xử lý...' : 'Xác nhận khóa tài khoản'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Chi tiết hội viên */}
      {selectedMemberDetail && (
        <div className="fdesk-dialog-overlay" onClick={() => setSelectedMemberDetail(null)}>
          <div className="fdesk-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="fdesk-dialog-header">
              <h3>Hồ sơ hội viên #{selectedMemberDetail.memberId}</h3>
              <button
                type="button"
                className="fdesk-dialog-close"
                onClick={() => setSelectedMemberDetail(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="fdesk-dialog-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 13 }}>
                <div>
                  <small style={{ color: 'var(--manager-muted, #748096)', display: 'block' }}>Họ và tên</small>
                  <strong>{selectedMemberDetail.fullName}</strong>
                </div>
                <div>
                  <small style={{ color: 'var(--manager-muted, #748096)', display: 'block' }}>Trạng thái</small>
                  {selectedMemberDetail.isActive ? (
                    <span className="fdesk-badge active">Hoạt động</span>
                  ) : (
                    <span className="fdesk-badge inactive">Đã khóa</span>
                  )}
                </div>
                <div>
                  <small style={{ color: 'var(--manager-muted, #748096)', display: 'block' }}>Số điện thoại</small>
                  <span>{selectedMemberDetail.phone || 'Chưa cập nhật'}</span>
                </div>
                <div>
                  <small style={{ color: 'var(--manager-muted, #748096)', display: 'block' }}>Email</small>
                  <span>{selectedMemberDetail.email}</span>
                </div>
                <div>
                  <small style={{ color: 'var(--manager-muted, #748096)', display: 'block' }}>Ngày sinh</small>
                  <span>{formatDate(selectedMemberDetail.dateOfBirth)}</span>
                </div>
                <div>
                  <small style={{ color: 'var(--manager-muted, #748096)', display: 'block' }}>Giới tính</small>
                  <span>{selectedMemberDetail.gender === 'Male' ? 'Nam' : selectedMemberDetail.gender === 'Female' ? 'Nữ' : 'Khác'}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <small style={{ color: 'var(--manager-muted, #748096)', display: 'block' }}>Địa chỉ</small>
                  <span>{selectedMemberDetail.address || 'Chưa cập nhật'}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <small style={{ color: 'var(--manager-muted, #748096)', display: 'block' }}>Mục tiêu tập luyện</small>
                  <span>{selectedMemberDetail.fitnessGoal || 'Rèn luyện thể chất'}</span>
                </div>
              </div>
            </div>
            <div className="fdesk-dialog-footer">
              <button
                type="button"
                className="fdesk-btn fdesk-btn-primary"
                onClick={() => setSelectedMemberDetail(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
