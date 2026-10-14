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
  Headset,
  Layers,
  LogIn,
  LogOut,
  Mail,
  MapPin,
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
  User,
  UserCheck,
  UserPlus,
  Users,
  UserX,
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
import '../../style/CenterManager/FrontDeskOperations.css'

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

  // Loading states
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [loadingCheckIns, setLoadingCheckIns] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Feedback states
  const [errorMessage, setErrorMessage] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  // Modals
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

  // Initial load
  useEffect(() => {
    loadMembersData(true)
    loadTodayCheckInsData(false)
  }, [])

  // Refresh handler
  function handleRefresh() {
    if (activeTab === 'members') loadMembersData(true)
    else if (activeTab === 'checkin') loadTodayCheckInsData(true)
  }

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
            <RefreshCw size={15} className={loadingMembers || loadingCheckIns ? 'fdesk-spin' : ''} />
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
            <span className="fdesk-metric-label">Tài khoản bị khóa</span>
            <span className="fdesk-metric-icon red">
              <UserX size={20} />
            </span>
          </div>
          <div className="fdesk-metric-value" style={{ color: '#dc2626' }}>
            {members.filter((m) => !m.isActive).length}
            <small style={{ color: '#dc2626' }}>hồ sơ vi phạm</small>
          </div>
          <p className="fdesk-metric-note">
            <ShieldAlert size={13} color="#dc2626" />
            Đã vô hiệu hóa quyền ra vào
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
                                Khóa tài khoản
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

      {/* Placeholder for tabs 3, 4, 5 in Commit 1 */}
      {activeTab === 'packages' && (
        <div className="fdesk-section">
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            <ReceiptText size={32} color="var(--manager-blue, #2463eb)" />
            <p style={{ marginTop: 10 }}>Đang chuẩn bị module Đăng ký gói thẻ & Thanh toán tại quầy...</p>
          </div>
        </div>
      )}

      {activeTab === 'classes' && (
        <div className="fdesk-section">
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            <CalendarDays size={32} color="var(--manager-blue, #2463eb)" />
            <p style={{ marginTop: 10 }}>Đang chuẩn bị module Điểm danh & Quản lý đăng ký lớp...</p>
          </div>
        </div>
      )}

      {activeTab === 'tickets' && (
        <div className="fdesk-section">
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            <Headset size={32} color="var(--manager-blue, #2463eb)" />
            <p style={{ marginTop: 10 }}>Đang chuẩn bị module Chăm sóc khách hàng & Xử lý Ticket...</p>
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
