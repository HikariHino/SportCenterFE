import { useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Eye,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserCog,
  Users,
  UserX,
  X,
} from "lucide-react"
import { useAuth } from "../../contexts/AuthContext"
import {
  createStaffUser,
  deactivateStaffUser,
  getStaffUsers,
  getUserErrorMessage,
  updateStaffRole,
} from "../../services/userService"
import "../../style/CenterManager/StaffManagement.css"

const ROLE_OPTIONS = [
  { value: "Manager", label: "Quản lý", tone: "role-manager", icon: ShieldCheck, desc: "Toàn quyền quản trị trung tâm, tài khoản và chính sách." },
  { value: "Coach", label: "Huấn luyện viên", tone: "role-coach", icon: Shield, desc: "Quản lý lớp học, điểm danh và học viên." },
  { value: "Receptionist", label: "Lễ tân", tone: "role-receptionist", icon: UserCheck, desc: "Tiếp đón khách, check-in, đăng ký gói và giao dịch tại quầy." },
]

const roleBadgeClass = (role) => {
  switch (String(role || "").toLowerCase()) {
    case "manager":
      return "role-manager"
    case "coach":
      return "role-coach"
    case "receptionist":
      return "role-receptionist"
    default:
      return "role-other"
  }
}

const roleNameVi = (role) => {
  switch (String(role || "").toLowerCase()) {
    case "manager":
      return "Quản lý"
    case "coach":
      return "Huấn luyện viên"
    case "receptionist":
      return "Lễ tân"
    default:
      return role || "Chưa phân quyền"
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return "Chưa cập nhật"
  const date = new Date(dateStr)
  return Number.isNaN(date.getTime())
    ? "Chưa cập nhật"
    : new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
}

export default function StaffManagement() {
  const { user: currentUser } = useAuth()

  const [staffList, setStaffList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Filters & search
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState("ALL")

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedStaffForRole, setSelectedStaffForRole] = useState(null)
  const [selectedStaffForDeactivate, setSelectedStaffForDeactivate] = useState(null)
  const [selectedStaffForDetail, setSelectedStaffForDetail] = useState(null)

  // Form states
  const [createForm, setCreateForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    role: "Coach",
  })
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createError, setCreateError] = useState("")

  const [updateRoleForm, setUpdateRoleForm] = useState("Coach")
  const [updateRoleSubmitting, setUpdateRoleSubmitting] = useState(false)
  const [updateRoleError, setUpdateRoleError] = useState("")

  const [deactivateSubmitting, setDeactivateSubmitting] = useState(false)
  const [deactivateError, setDeactivateError] = useState("")

  // Toast notification
  const [toast, setToast] = useState(null)

  const showToast = (message, type = "success") => {
    setToast({ message, type })
    window.clearTimeout(window.__staffToastTimeout)
    window.__staffToastTimeout = window.setTimeout(() => {
      setToast(null)
    }, 3500)
  }

  // Load staff list
  const fetchStaff = async () => {
    setLoading(true)
    setError("")
    try {
      const data = await getStaffUsers()
      setStaffList(data)
    } catch (err) {
      const msg = getUserErrorMessage(err, "Không thể tải danh sách nhân sự.")
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStaff()
  }, [])

  // Metrics calculation
  const metrics = useMemo(() => {
    const total = staffList.length
    const managers = staffList.filter((s) => String(s.role).toLowerCase() === "manager").length
    const coaches = staffList.filter((s) => String(s.role).toLowerCase() === "coach").length
    const receptionists = staffList.filter((s) => String(s.role).toLowerCase() === "receptionist").length
    const active = staffList.filter((s) => s.isActive).length
    const inactive = staffList.filter((s) => !s.isActive).length
    return { total, managers, coaches, receptionists, active, inactive }
  }, [staffList])

  // Filtered list
  const filteredList = useMemo(() => {
    return staffList.filter((staff) => {
      if (roleFilter !== "ALL" && staff.role !== roleFilter) {
        return false
      }
      if (statusFilter === "ACTIVE" && !staff.isActive) return false
      if (statusFilter === "INACTIVE" && staff.isActive) return false

      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase()
        const matchName = (staff.fullName || "").toLowerCase().includes(query)
        const matchEmail = (staff.email || "").toLowerCase().includes(query)
        const matchPhone = (staff.phone || "").toLowerCase().includes(query)
        const matchRole = roleNameVi(staff.role).toLowerCase().includes(query)
        const matchId = String(staff.userId).includes(query)
        return matchName || matchEmail || matchPhone || matchRole || matchId
      }

      return true
    })
  }, [staffList, roleFilter, statusFilter, searchQuery])

  // Handlers for Create Staff
  const handleOpenCreateModal = () => {
    setCreateForm({
      fullName: "",
      email: "",
      password: "",
      phone: "",
      role: "Coach",
    })
    setCreateError("")
    setShowCreateModal(true)
  }

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    setCreateError("")

    if (!createForm.fullName.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      setCreateError("Vui lòng điền đầy đủ họ tên, email và mật khẩu.")
      return
    }

    if (createForm.password.length < 6) {
      setCreateError("Mật khẩu tối thiểu phải từ 6 ký tự trở lên.")
      return
    }

    setCreateSubmitting(true)
    try {
      const newStaff = await createStaffUser(createForm)
      showToast("Tạo tài khoản nhân viên " + newStaff.fullName + " thành công!")
      setShowCreateModal(false)
      fetchStaff()
    } catch (err) {
      setCreateError(getUserErrorMessage(err, "Không thể tạo nhân viên."))
    } finally {
      setCreateSubmitting(false)
    }
  }

  // Handlers for Update Role
  const handleOpenUpdateRole = (staff) => {
    setSelectedStaffForRole(staff)
    setUpdateRoleForm(staff.role || "Coach")
    setUpdateRoleError("")
  }

  const handleUpdateRoleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedStaffForRole) return

    setUpdateRoleError("")
    setUpdateRoleSubmitting(true)
    try {
      const updated = await updateStaffRole(selectedStaffForRole.userId, {
        role: updateRoleForm,
      })
      showToast("Đã cập nhật vai trò của " + updated.fullName + " thành " + roleNameVi(updated.role) + "!")
      setSelectedStaffForRole(null)
      fetchStaff()
    } catch (err) {
      setUpdateRoleError(getUserErrorMessage(err, "Không thể cập nhật quyền."))
    } finally {
      setUpdateRoleSubmitting(false)
    }
  }

  // Handlers for Deactivate Staff
  const handleOpenDeactivate = (staff) => {
    setSelectedStaffForDeactivate(staff)
    setDeactivateError("")
  }

  const handleDeactivateSubmit = async () => {
    if (!selectedStaffForDeactivate) return

    setDeactivateSubmitting(true)
    setDeactivateError("")
    try {
      await deactivateStaffUser(selectedStaffForDeactivate.userId)
      showToast("Đã vô hiệu hóa tài khoản " + selectedStaffForDeactivate.fullName + ". Lịch sử đã được bảo toàn trong Audit Log!")
      setSelectedStaffForDeactivate(null)
      fetchStaff()
    } catch (err) {
      setDeactivateError(getUserErrorMessage(err, "Không thể vô hiệu hóa tài khoản."))
    } finally {
      setDeactivateSubmitting(false)
    }
  }

  const isCurrentLoggedInUser = (staff) => {
    return (
      currentUser?.userId === staff.userId ||
      currentUser?.id === staff.userId ||
      (currentUser?.email && currentUser.email.toLowerCase() === (staff.email || "").toLowerCase())
    )
  }

  return (
    <div className="staff-mgmt">
      {/* Toast Feedback */}
      {toast && (
        <div className={"staff-toast " + toast.type}>
          {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <section className="manager-card staff-mgmt-card">
        <div className="staff-mgmt-header">
          <div>
            <h2>Quản lý nhân sự & Phân quyền</h2>
            <p>Tra cứu thông tin, tạo tài khoản mới, điều chỉnh phân quyền và quản lý trạng thái hoạt động nhân sự.</p>
          </div>
          <div className="staff-mgmt-actions">
            <button type="button" className="staff-btn staff-btn-primary" onClick={handleOpenCreateModal}>
              <Plus size={16} /> Thêm nhân viên
            </button>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="staff-metrics" style={{ marginTop: "20px" }}>
          <div className="staff-metric-card">
            <span className="staff-metric-icon blue">
              <Users size={22} />
            </span>
            <div className="staff-metric-info">
              <small>Tổng nhân sự</small>
              <strong>{loading ? "--" : metrics.total}</strong>
            </div>
          </div>
          <div className="staff-metric-card">
            <span className="staff-metric-icon blue">
              <ShieldCheck size={22} />
            </span>
            <div className="staff-metric-info">
              <small>Quản lý (Manager)</small>
              <strong>{loading ? "--" : metrics.managers}</strong>
            </div>
          </div>
          <div className="staff-metric-card">
            <span className="staff-metric-icon purple">
              <Shield size={22} />
            </span>
            <div className="staff-metric-info">
              <small>HLV (Coach)</small>
              <strong>{loading ? "--" : metrics.coaches}</strong>
            </div>
          </div>
          <div className="staff-metric-card">
            <span className="staff-metric-icon green">
              <UserCheck size={22} />
            </span>
            <div className="staff-metric-info">
              <small>Lễ tân (Receptionist)</small>
              <strong>{loading ? "--" : metrics.receptionists}</strong>
            </div>
          </div>
          <div className="staff-metric-card">
            <span className="staff-metric-icon amber">
              <UserX size={22} />
            </span>
            <div className="staff-metric-info">
              <small>Đã vô hiệu hóa</small>
              <strong>{loading ? "--" : metrics.inactive}</strong>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="staff-toolbar" style={{ marginTop: "20px", marginBottom: "16px" }}>
          <div className="staff-search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Tìm theo tên, email, SĐT hoặc mã nhân viên..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="staff-filters">
            <select
              className="staff-filter-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Lọc vai trò"
            >
              <option value="ALL">Tất cả vai trò</option>
              <option value="Manager">Quản lý (Manager)</option>
              <option value="Coach">Huấn luyện viên (Coach)</option>
              <option value="Receptionist">Lễ tân (Receptionist)</option>
            </select>

            <select
              className="staff-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Lọc trạng thái"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="INACTIVE">Đã vô hiệu hóa</option>
            </select>

            <button
              type="button"
              className="staff-refresh-btn"
              onClick={fetchStaff}
              title="Làm mới danh sách"
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "spin" : ""} />
            </button>
          </div>
        </div>

        {/* Staff Table */}
        <div className="staff-table-wrap">
          {loading ? (
            <div className="staff-state-box">
              <span>
                <RefreshCw size={24} className="spin" />
              </span>
              <strong>Đang tải danh sách nhân sự...</strong>
              <p>Vui lòng chờ trong giây lát để hệ thống đồng bộ dữ liệu.</p>
            </div>
          ) : error ? (
            <div className="staff-state-box">
              <span>
                <AlertCircle size={24} color="#ef4444" />
              </span>
              <strong>Không thể tải dữ liệu</strong>
              <p>{error}</p>
              <button type="button" className="staff-btn staff-btn-secondary" onClick={fetchStaff}>
                <RefreshCw size={14} /> Thử lại
              </button>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="staff-state-box">
              <span>
                <Users size={24} />
              </span>
              <strong>Không tìm thấy nhân sự phù hợp</strong>
              <p>Thử điều chỉnh từ khóa tìm kiếm hoặc bỏ bớt các bộ lọc.</p>
              {(searchQuery || roleFilter !== "ALL" || statusFilter !== "ALL") && (
                <button
                  type="button"
                  className="staff-btn staff-btn-secondary"
                  onClick={() => {
                    setSearchQuery("")
                    setRoleFilter("ALL")
                    setStatusFilter("ALL")
                  }}
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
          ) : (
            <div className="staff-table-scroll">
              <table className="staff-table">
                <thead>
                  <tr>
                    <th style={{ width: "80px" }}>MÃ NV</th>
                    <th>NHÂN SỰ</th>
                    <th>SỐ ĐIỆN THOẠI</th>
                    <th>VAI TRÒ (ROLE)</th>
                    <th>TRẠNG THÁI</th>
                    <th>NGÀY TẠO</th>
                    <th style={{ textAlign: "right" }}>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map((staff) => {
                    const initials = (staff.fullName || "NV")
                      .split(/\s+/)
                      .slice(-2)
                      .map((p) => p[0])
                      .join("")
                      .toUpperCase()
                    const isSelf = isCurrentLoggedInUser(staff)

                    return (
                      <tr key={staff.userId} className={!staff.isActive ? "inactive-row" : ""}>
                        <td>
                          <strong>#{staff.userId}</strong>
                        </td>
                        <td>
                          <div className="staff-user-cell">
                            <span className={"staff-avatar " + roleBadgeClass(staff.role)}>{initials}</span>
                            <div className="staff-user-names">
                              <strong>
                                {staff.fullName} {isSelf && <small style={{ color: "#2563eb" }}>(Bạn)</small>}
                              </strong>
                              <small>{staff.email}</small>
                            </div>
                          </div>
                        </td>
                        <td>{staff.phone || <span style={{ color: "#94a3b8" }}>Chưa cập nhật</span>}</td>
                        <td>
                          <span className={"staff-role-badge " + roleBadgeClass(staff.role)}>
                            {staff.role === "Manager" ? <ShieldCheck size={12} /> : staff.role === "Coach" ? <Shield size={12} /> : <UserCheck size={12} />}
                            {roleNameVi(staff.role)}
                          </span>
                        </td>
                        <td>
                          <span className={"staff-status-badge " + (staff.isActive ? "status-active" : "status-inactive")}>
                            <i />
                            {staff.isActive ? "Đang hoạt động" : "Đã vô hiệu hóa"}
                          </span>
                        </td>
                        <td>
                          <span title={staff.createdAt}>{formatDate(staff.createdAt)}</span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className="staff-row-actions" style={{ justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              className="staff-action-icon-btn"
                              title="Xem chi tiết"
                              onClick={() => setSelectedStaffForDetail(staff)}
                            >
                              <Eye size={15} />
                            </button>

                            <button
                              type="button"
                              className="staff-action-icon-btn"
                              title={isSelf ? "Không thể tự đổi quyền của mình" : "Đổi vai trò"}
                              disabled={isSelf || !staff.isActive}
                              onClick={() => handleOpenUpdateRole(staff)}
                            >
                              <UserCog size={15} />
                            </button>

                            <button
                              type="button"
                              className="staff-action-icon-btn danger"
                              title={
                                isSelf
                                  ? "Không thể vô hiệu hóa tài khoản của chính mình"
                                  : !staff.isActive
                                  ? "Tài khoản đã vô hiệu hóa"
                                  : "Vô hiệu hóa tài khoản"
                              }
                              disabled={isSelf || !staff.isActive}
                              onClick={() => handleOpenDeactivate(staff)}
                            >
                              <Ban size={15} />
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
      </section>

      {/* Modal 1: Create Staff */}
      {showCreateModal && (
        <div className="staff-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}>
          <div className="staff-modal">
            <div className="staff-modal-header">
              <div>
                <h3>Tạo mới tài khoản nhân viên</h3>
                <p>Khởi tạo thông tin đăng nhập và chỉ định vai trò ban đầu.</p>
              </div>
              <button
                type="button"
                className="staff-modal-close"
                onClick={() => setShowCreateModal(false)}
                disabled={createSubmitting}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="staff-modal-body">
                {createError && (
                  <div className="staff-form-error">
                    <AlertCircle size={16} />
                    <span>{createError}</span>
                  </div>
                )}

                <div className="staff-form-group">
                  <label htmlFor="staff-fullname">Họ và tên *</label>
                  <input
                    id="staff-fullname"
                    type="text"
                    placeholder="Ví dụ: Nguyễn Văn An"
                    value={createForm.fullName}
                    onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                    required
                  />
                </div>

                <div className="staff-form-group">
                  <label htmlFor="staff-email">Email đăng nhập *</label>
                  <input
                    id="staff-email"
                    type="email"
                    placeholder="email@sportcenter.com"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    required
                  />
                </div>

                <div className="staff-form-group">
                  <label htmlFor="staff-password">Mật khẩu khởi tạo *</label>
                  <input
                    id="staff-password"
                    type="password"
                    placeholder="Tối thiểu 6 ký tự"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    minLength={6}
                    required
                  />
                  <small>Nhân viên có thể đổi lại mật khẩu sau khi đăng nhập.</small>
                </div>

                <div className="staff-form-group">
                  <label htmlFor="staff-phone">Số điện thoại</label>
                  <input
                    id="staff-phone"
                    type="tel"
                    placeholder="0912 345 678"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  />
                </div>

                <div className="staff-form-group">
                  <label htmlFor="staff-role">Vai trò (Role) *</label>
                  <select
                    id="staff-role"
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    required
                  >
                    <option value="Coach">Huấn luyện viên (Coach)</option>
                    <option value="Receptionist">Lễ tân (Receptionist)</option>
                    <option value="Manager">Quản lý (Manager)</option>
                  </select>
                </div>
              </div>

              <div className="staff-modal-footer">
                <button
                  type="button"
                  className="staff-btn staff-btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={createSubmitting}
                >
                  Hủy bỏ
                </button>
                <button type="submit" className="staff-btn staff-btn-primary" disabled={createSubmitting}>
                  {createSubmitting ? "Đang tạo..." : "Xác nhận tạo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Update Role */}
      {selectedStaffForRole && (
        <div
          className="staff-modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setSelectedStaffForRole(null)}
        >
          <div className="staff-modal">
            <div className="staff-modal-header">
              <div>
                <h3>Điều chỉnh vai trò nhân viên</h3>
                <p>Nâng cấp hoặc thay đổi quyền truy cập của nhân viên.</p>
              </div>
              <button
                type="button"
                className="staff-modal-close"
                onClick={() => setSelectedStaffForRole(null)}
                disabled={updateRoleSubmitting}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateRoleSubmit}>
              <div className="staff-modal-body">
                {updateRoleError && (
                  <div className="staff-form-error">
                    <AlertCircle size={16} />
                    <span>{updateRoleError}</span>
                  </div>
                )}

                <div className="staff-detail-item full-width" style={{ marginBottom: "6px" }}>
                  <small>NHÂN VIÊN</small>
                  <strong>
                    {selectedStaffForRole.fullName} ({selectedStaffForRole.email})
                  </strong>
                  <span style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                    Vai trò hiện tại: <strong>{roleNameVi(selectedStaffForRole.role)}</strong>
                  </span>
                </div>

                <div className="staff-form-group">
                  <label htmlFor="update-role-select">Chọn vai trò mới *</label>
                  <select
                    id="update-role-select"
                    value={updateRoleForm}
                    onChange={(e) => setUpdateRoleForm(e.target.value)}
                    required
                  >
                    <option value="Coach">Huấn luyện viên (Coach)</option>
                    <option value="Receptionist">Lễ tân (Receptionist)</option>
                    <option value="Manager">Quản lý (Manager)</option>
                  </select>
                </div>

                <div className="staff-deactivate-notice" style={{ background: "#f0f9ff", borderColor: "#bae6fd", color: "#0369a1" }}>
                  <ShieldCheck size={20} style={{ flexShrink: 0 }} />
                  <div>
                    <strong style={{ color: "#0284c7" }}>Lưu ý về lịch sử</strong>
                    <p style={{ color: "#0369a1" }}>
                      Khi chuyển đổi vai trò, các phân quyền trong hệ thống sẽ được cập nhật ngay lập tức. Nếu chuyển từ
                      Coach sang vai trò khác, hồ sơ lịch sử lớp dạy vẫn được bảo toàn.
                    </p>
                  </div>
                </div>
              </div>

              <div className="staff-modal-footer">
                <button
                  type="button"
                  className="staff-btn staff-btn-secondary"
                  onClick={() => setSelectedStaffForRole(null)}
                  disabled={updateRoleSubmitting}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="staff-btn staff-btn-primary"
                  disabled={updateRoleSubmitting || updateRoleForm === selectedStaffForRole.role}
                >
                  {updateRoleSubmitting ? "Đang cập nhật..." : "Cập nhật vai trò"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Deactivate Staff */}
      {selectedStaffForDeactivate && (
        <div
          className="staff-modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setSelectedStaffForDeactivate(null)}
        >
          <div className="staff-modal">
            <div className="staff-modal-header">
              <div>
                <h3 style={{ color: "#dc2626" }}>Xác nhận vô hiệu hóa tài khoản</h3>
                <p>Khóa quyền truy cập hệ thống của nhân viên.</p>
              </div>
              <button
                type="button"
                className="staff-modal-close"
                onClick={() => setSelectedStaffForDeactivate(null)}
                disabled={deactivateSubmitting}
              >
                <X size={18} />
              </button>
            </div>

            <div className="staff-modal-body">
              {deactivateError && (
                <div className="staff-form-error">
                  <AlertCircle size={16} />
                  <span>{deactivateError}</span>
                </div>
              )}

              <div className="staff-deactivate-notice">
                <ShieldAlert size={24} style={{ flexShrink: 0 }} />
                <div>
                  <strong>Bảo toàn dữ liệu Audit Log</strong>
                  <p>
                    Tài khoản của <strong>{selectedStaffForDeactivate.fullName}</strong> (#{selectedStaffForDeactivate.userId})
                    sẽ bị khóa và không thể đăng nhập. Toàn bộ lịch sử hoạt động, lớp học, hóa đơn và dữ liệu vận hành
                    vẫn được bảo toàn trọn vẹn trong hệ thống.
                  </p>
                </div>
              </div>
            </div>

            <div className="staff-modal-footer">
              <button
                type="button"
                className="staff-btn staff-btn-secondary"
                onClick={() => setSelectedStaffForDeactivate(null)}
                disabled={deactivateSubmitting}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="staff-btn staff-btn-danger"
                onClick={handleDeactivateSubmit}
                disabled={deactivateSubmitting}
              >
                {deactivateSubmitting ? "Đang vô hiệu hóa..." : "Xác nhận vô hiệu hóa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Staff Detail */}
      {selectedStaffForDetail && (
        <div
          className="staff-modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setSelectedStaffForDetail(null)}
        >
          <div className="staff-modal">
            <div className="staff-modal-header">
              <div>
                <h3>Hồ sơ nhân sự #{selectedStaffForDetail.userId}</h3>
                <p>Thông tin chi tiết tài khoản từ UsersController.</p>
              </div>
              <button
                type="button"
                className="staff-modal-close"
                onClick={() => setSelectedStaffForDetail(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="staff-modal-body">
              <div className="staff-detail-grid">
                <div className="staff-detail-item full-width">
                  <small>Họ và tên</small>
                  <strong>{selectedStaffForDetail.fullName}</strong>
                </div>

                <div className="staff-detail-item">
                  <small>Email</small>
                  <strong>{selectedStaffForDetail.email}</strong>
                </div>

                <div className="staff-detail-item">
                  <small>Số điện thoại</small>
                  <strong>{selectedStaffForDetail.phone || "Chưa cập nhật"}</strong>
                </div>

                <div className="staff-detail-item">
                  <small>Vai trò</small>
                  <div>
                    <span className={"staff-role-badge " + roleBadgeClass(selectedStaffForDetail.role)}>
                      {roleNameVi(selectedStaffForDetail.role)}
                    </span>
                  </div>
                </div>

                <div className="staff-detail-item">
                  <small>Trạng thái</small>
                  <div>
                    <span className={"staff-status-badge " + (selectedStaffForDetail.isActive ? "status-active" : "status-inactive")}>
                      <i />
                      {selectedStaffForDetail.isActive ? "Đang hoạt động" : "Đã vô hiệu hóa"}
                    </span>
                  </div>
                </div>

                {selectedStaffForDetail.coachId && (
                  <div className="staff-detail-item">
                    <small>Mã hồ sơ Huấn luyện viên</small>
                    <strong>Coach #{selectedStaffForDetail.coachId}</strong>
                  </div>
                )}

                <div className="staff-detail-item">
                  <small>Ngày tạo tài khoản</small>
                  <strong>{formatDate(selectedStaffForDetail.createdAt)}</strong>
                </div>

                <div className="staff-detail-item">
                  <small>Cập nhật lần cuối</small>
                  <strong>{formatDate(selectedStaffForDetail.updatedAt)}</strong>
                </div>
              </div>
            </div>

            <div className="staff-modal-footer">
              <button
                type="button"
                className="staff-btn staff-btn-secondary"
                onClick={() => setSelectedStaffForDetail(null)}
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
