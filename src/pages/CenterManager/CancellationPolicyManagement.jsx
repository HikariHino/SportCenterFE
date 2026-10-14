import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownToLine,
  Ban,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Clock3,
  Edit2,
  Grid,
  Info,
  Layers,
  List,
  Plus,
  Power,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import {
  createCancellationPolicy,
  getCancellationPolicies,
  getPolicyErrorMessage,
  updateCancellationPolicy,
} from '../../services/cancellationPolicyService'
import '../../style/CenterManager/CancellationPolicyManagement.css'

const PRESET_HOURS = [
  { label: '2 Giờ (Tối thiểu)', hours: 2 },
  { label: '4 Giờ (Linh hoạt)', hours: 4 },
  { label: '6 Giờ', hours: 6 },
  { label: '12 Giờ (Nửa ngày)', hours: 12 },
  { label: '24 Giờ (1 ngày)', hours: 24 },
  { label: '48 Giờ (2 ngày)', hours: 48 },
  { label: '72 Giờ (3 ngày)', hours: 72 },
]

const PRESET_POLICY_NAMES = [
  'Chính sách Tiêu chuẩn (Hủy trước 2 tiếng)',
  'Chính sách Linh hoạt (Hủy trước 4 tiếng)',
  'Chính sách Nửa ngày (Hủy trước 12 tiếng)',
  'Chính sách Nghiêm ngặt (Hủy trước 24 tiếng)',
  'Chính sách Khóa đặc biệt (Hủy trước 48 tiếng)',
]

const formatHours = (hours) => {
  if (!hours) return '0 giờ'
  if (hours % 24 === 0) {
    const days = hours / 24
    return `${days} ngày (${hours} giờ)`
  }
  return `${hours} giờ`
}

export default function CancellationPolicyManagement() {
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // View & Filters
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'table'
  const [searchQuery, setSearchQuery] = useState('')
  const [timeFilter, setTimeFilter] = useState('ALL') // 'ALL' | 'FLEXIBLE' | 'STANDARD' | 'STRICT'
  const [statusFilter, setStatusFilter] = useState('ALL') // 'ALL' | 'ACTIVE' | 'INACTIVE'

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState(null)
  const [selectedPolicyForDetail, setSelectedPolicyForDetail] = useState(null)
  const [togglingPolicy, setTogglingPolicy] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Policy Form State
  const [policyForm, setPolicyForm] = useState({
    name: '',
    minimumHoursBeforeStart: 2,
    isActive: true,
  })

  // Auto clear success message
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 4500)
      return () => clearTimeout(timer)
    }
  }, [success])

  // Load policies
  const loadPolicies = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getCancellationPolicies()
      setPolicies(data)
    } catch (err) {
      setError(getPolicyErrorMessage(err, 'Không thể tải danh sách chính sách hủy lịch.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPolicies()
  }, [])

  // Listen for custom trigger from button
  useEffect(() => {
    const handleOpen = () => handleOpenCreate()
    window.addEventListener('open-create-policy-modal', handleOpen)
    return () => window.removeEventListener('open-create-policy-modal', handleOpen)
  }, [])

  // Filtered policies
  const filteredPolicies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return policies.filter((p) => {
      const matchesQuery = !q || p.name.toLowerCase().includes(q)

      let matchesTime = true
      if (timeFilter === 'FLEXIBLE') {
        matchesTime = p.minimumHoursBeforeStart <= 4
      } else if (timeFilter === 'STANDARD') {
        matchesTime = p.minimumHoursBeforeStart > 4 && p.minimumHoursBeforeStart <= 12
      } else if (timeFilter === 'STRICT') {
        matchesTime = p.minimumHoursBeforeStart > 12
      }

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && p.isActive) ||
        (statusFilter === 'INACTIVE' && !p.isActive)

      return matchesQuery && matchesTime && matchesStatus
    })
  }, [policies, searchQuery, timeFilter, statusFilter])

  // Stats
  const activeCount = policies.filter((p) => p.isActive).length
  const inactiveCount = policies.length - activeCount
  const minHours = policies.length > 0 ? Math.min(...policies.map((p) => p.minimumHoursBeforeStart)) : 2
  const maxHours = policies.length > 0 ? Math.max(...policies.map((p) => p.minimumHoursBeforeStart)) : 24

  // Open Create Modal
  const handleOpenCreate = () => {
    setPolicyForm({
      name: 'Chính sách Tiêu chuẩn (Hủy trước 2 tiếng)',
      minimumHoursBeforeStart: 2,
      isActive: true,
    })
    setShowCreateModal(true)
    setError('')
  }

  // Open Edit Modal
  const handleOpenEdit = (policy) => {
    setEditingPolicy(policy)
    setPolicyForm({
      name: policy.name || '',
      minimumHoursBeforeStart: policy.minimumHoursBeforeStart || 2,
      isActive: policy.isActive !== false,
    })
    setError('')
  }

  // Submit Create Policy
  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!policyForm.name.trim()) {
      setError('Vui lòng nhập tên chính sách hủy lịch.')
      return
    }
    const hours = Number(policyForm.minimumHoursBeforeStart)
    if (hours < 2 || hours > 720) {
      setError('Thời gian hủy tối thiểu phải từ 2 giờ đến 720 giờ (30 ngày).')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const created = await createCancellationPolicy({
        name: policyForm.name.trim(),
        minimumHoursBeforeStart: hours,
        isActive: Boolean(policyForm.isActive),
      })
      await loadPolicies()
      setShowCreateModal(false)
      setSuccess(`Đã tạo chính sách hủy "${created.name || policyForm.name}" thành công!`)
    } catch (err) {
      setError(getPolicyErrorMessage(err, 'Không thể tạo mới chính sách hủy lịch.'))
    } finally {
      setSubmitting(false)
    }
  }

  // Submit Edit Policy
  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!editingPolicy) return
    if (!policyForm.name.trim()) {
      setError('Vui lòng nhập tên chính sách hủy lịch.')
      return
    }
    const hours = Number(policyForm.minimumHoursBeforeStart)
    if (hours < 2 || hours > 720) {
      setError('Thời gian hủy tối thiểu phải từ 2 giờ đến 720 giờ (30 ngày).')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const updated = await updateCancellationPolicy(editingPolicy.id, {
        name: policyForm.name.trim(),
        minimumHoursBeforeStart: hours,
        isActive: Boolean(policyForm.isActive),
      })
      await loadPolicies()
      setEditingPolicy(null)
      setSuccess(`Đã cập nhật chính sách hủy "${updated.name || policyForm.name}" thành công!`)
    } catch (err) {
      setError(getPolicyErrorMessage(err, 'Không thể cập nhật chính sách hủy.'))
    } finally {
      setSubmitting(false)
    }
  }

  // Quick toggle active / inactive
  const handleToggleStatus = async (policy) => {
    setSubmitting(true)
    setError('')
    try {
      const nextActive = !policy.isActive
      const updated = await updateCancellationPolicy(policy.id, {
        name: policy.name,
        minimumHoursBeforeStart: policy.minimumHoursBeforeStart,
        isActive: nextActive,
      })
      setPolicies((prev) =>
        prev.map((item) => (item.id === policy.id ? { ...item, ...updated } : item))
      )
      setSuccess(
        nextActive
          ? `Đã kích hoạt áp dụng chính sách "${policy.name}".`
          : `Đã tạm dừng áp dụng chính sách "${policy.name}".`
      )
    } catch (err) {
      setError(getPolicyErrorMessage(err, 'Không thể cập nhật trạng thái chính sách hủy.'))
    } finally {
      setSubmitting(false)
      setTogglingPolicy(null)
    }
  }

  // Export CSV
  const handleExportCSV = () => {
    const rows = [
      ['Mã chính sách', 'Tên chính sách', 'Thời gian hủy tối thiểu', 'Trạng thái'],
      ...filteredPolicies.map((p) => [
        `#${p.id}`,
        p.name,
        `${p.minimumHoursBeforeStart} giờ trước buổi học`,
        p.isActive ? 'Đang áp dụng' : 'Tạm dừng',
      ]),
    ]
    const csvContent =
      '\uFEFF' +
      rows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `chinh-sach-huy-lich-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setSuccess('Đã xuất danh sách chính sách hủy ra file CSV thành công!')
  }

  return (
    <div className="policy-mgmt">
      {/* Header */}
      <section className="policy-mgmt-header manager-card">
        <div>
          <h2>Quản lý chính sách hủy lịch</h2>
          <p>
            Thiết lập quy định thời hạn hủy buổi học (học viên phải hủy trước tối thiểu bao nhiêu tiếng để không bị trừ buổi hoặc phạt phí), và bật/tắt áp dụng cho các lớp học.
          </p>
        </div>
        <div className="policy-mgmt-actions">
          <button
            type="button"
            className="policy-btn policy-btn-secondary"
            onClick={handleExportCSV}
            title="Xuất file CSV danh sách chính sách"
          >
            <ArrowDownToLine size={15} /> Xuất CSV
          </button>
          <button
            type="button"
            className="policy-btn policy-btn-secondary"
            onClick={loadPolicies}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
          <button
            type="button"
            className="policy-btn policy-btn-primary"
            onClick={handleOpenCreate}
          >
            <Plus size={16} /> Thêm chính sách mới
          </button>
        </div>
      </section>

      {/* Metrics */}
      <section className="policy-metrics">
        <article className="policy-metric-card">
          <div className="policy-metric-icon blue">
            <Ban size={22} />
          </div>
          <div className="policy-metric-info">
            <span>Tổng số chính sách</span>
            <strong>{policies.length}</strong>
          </div>
        </article>

        <article className="policy-metric-card">
          <div className="policy-metric-icon green">
            <CheckCircle2 size={22} />
          </div>
          <div className="policy-metric-info">
            <span>Đang áp dụng</span>
            <strong>{activeCount}</strong>
          </div>
        </article>

        <article className="policy-metric-card">
          <div className="policy-metric-icon amber">
            <Power size={22} />
          </div>
          <div className="policy-metric-info">
            <span>Tạm dừng áp dụng</span>
            <strong>{inactiveCount}</strong>
          </div>
        </article>

        <article className="policy-metric-card">
          <div className="policy-metric-icon red">
            <Clock3 size={22} />
          </div>
          <div className="policy-metric-info">
            <span>Thời hạn linh hoạt nhất</span>
            <strong>{minHours} giờ <small style={{ fontSize: 11, fontWeight: 500 }}>(tối đa {maxHours}h)</small></strong>
          </div>
        </article>
      </section>

      {/* Notification Alerts */}
      {error && (
        <div className="policy-alert policy-alert-error" role="alert">
          <div className="policy-alert-content">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="policy-alert-close"
            onClick={() => setError('')}
            aria-label="Đóng thông báo lỗi"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="policy-alert policy-alert-success" role="status">
          <div className="policy-alert-content">
            <CheckCircle2 size={18} />
            <span>{success}</span>
          </div>
          <button
            type="button"
            className="policy-alert-close"
            onClick={() => setSuccess('')}
            aria-label="Đóng thông báo thành công"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="policy-toolbar">
        <div className="policy-search-box">
          <Search size={16} />
          <input
            type="text"
            className="policy-search-input"
            placeholder="Tìm theo tên chính sách hủy lịch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="policy-filter-group">
          <select
            className="policy-select"
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
          >
            <option value="ALL">Tất cả khung thời gian</option>
            <option value="FLEXIBLE">Linh hoạt (Dưới hoặc bằng 4 giờ)</option>
            <option value="STANDARD">Tiêu chuẩn (Từ 4 đến 12 giờ)</option>
            <option value="STRICT">Nghiêm ngặt (Trên 12 giờ)</option>
          </select>

          <select
            className="policy-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang áp dụng</option>
            <option value="INACTIVE">Tạm dừng áp dụng</option>
          </select>

          <div className="view-mode-toggle">
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Xem dạng thẻ"
            >
              <Grid size={16} />
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Xem dạng bảng"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Body: Loading / Empty / Grid / Table */}
      {loading ? (
        <div className="policy-loading">
          <div className="policy-spinner" />
          <span>Đang tải danh sách chính sách hủy...</span>
        </div>
      ) : filteredPolicies.length === 0 ? (
        <div className="policy-empty">
          <Ban size={40} />
          <strong>Không tìm thấy chính sách hủy nào</strong>
          <p>Thử điều chỉnh bộ lọc hoặc tạo chính sách hủy mới cho trung tâm.</p>
          <button
            type="button"
            className="policy-btn policy-btn-primary"
            onClick={handleOpenCreate}
          >
            <Plus size={16} /> Thêm chính sách ngay
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="policies-grid">
          {filteredPolicies.map((policy) => {
            return (
              <article
                key={policy.id}
                className={`policy-card ${policy.isActive ? '' : 'inactive'}`}
              >
                <div className="policy-card-top">
                  <div className="policy-card-title">
                    <h3>{policy.name}</h3>
                    <small>Mã chính sách: #{policy.id}</small>
                  </div>
                  <span className={`policy-badge ${policy.isActive ? 'active' : 'inactive'}`}>
                    <i />
                    {policy.isActive ? 'Đang áp dụng' : 'Tạm dừng'}
                  </span>
                </div>

                <div className="policy-rule-box">
                  <div className="policy-rule-info">
                    <span>Hạn chót hủy trước giờ học:</span>
                    <strong>Tối thiểu {formatHours(policy.minimumHoursBeforeStart)}</strong>
                  </div>
                  <Clock size={24} style={{ color: 'var(--manager-blue)', opacity: 0.8 }} />
                </div>

                <p className="policy-rule-example">
                  <Info size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 5 }} />
                  Ví dụ: Buổi học bắt đầu lúc 18:00, học viên được phép hủy trước{' '}
                  <strong>
                    {18 - policy.minimumHoursBeforeStart >= 0
                      ? `${18 - policy.minimumHoursBeforeStart}:00 cùng ngày`
                      : `${24 + (18 - policy.minimumHoursBeforeStart)}:00 ngày hôm trước`}
                  </strong>{' '}
                  để bảo toàn lượt học.
                </p>

                <div className="policy-card-footer">
                  <span style={{ fontSize: 11, color: 'var(--manager-muted)' }}>
                    Quy định: {policy.minimumHoursBeforeStart} giờ
                  </span>

                  <div className="policy-actions">
                    <button
                      type="button"
                      className="policy-action-btn"
                      title="Xem chi tiết & Mô phỏng thời gian chốt"
                      onClick={() => setSelectedPolicyForDetail(policy)}
                    >
                      <Info size={15} />
                    </button>
                    <button
                      type="button"
                      className="policy-action-btn"
                      title="Chỉnh sửa chính sách hủy"
                      onClick={() => handleOpenEdit(policy)}
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      type="button"
                      className={`policy-action-btn ${policy.isActive ? 'danger' : 'info'}`}
                      title={policy.isActive ? 'Tạm dừng áp dụng' : 'Kích hoạt lại'}
                      onClick={() => setTogglingPolicy(policy)}
                    >
                      <Power size={15} />
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="policy-table-container manager-card" style={{ margin: '0 24px', padding: '16px' }}>
          <table className="policy-table">
            <thead>
              <tr>
                <th>MÃ CS</th>
                <th>TÊN CHÍNH SÁCH HỦY</th>
                <th>THỜI HẠN TỐI THIỂU</th>
                <th>VÍ DỤ ÁP DỤNG</th>
                <th>TRẠNG THÁI</th>
                <th style={{ textAlign: 'right' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {filteredPolicies.map((policy) => {
                return (
                  <tr key={policy.id}>
                    <td><strong>#{policy.id}</strong></td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--manager-ink)' }}>
                        {policy.name}
                      </div>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--manager-blue)' }}>
                        {formatHours(policy.minimumHoursBeforeStart)}
                      </strong>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: '#475569' }}>
                        Hủy trước tối thiểu {policy.minimumHoursBeforeStart}h trước giờ bắt đầu
                      </span>
                    </td>
                    <td>
                      <span className={`policy-badge ${policy.isActive ? 'active' : 'inactive'}`}>
                        <i />
                        {policy.isActive ? 'Đang áp dụng' : 'Tạm dừng'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="policy-action-btn"
                          title="Xem chi tiết"
                          onClick={() => setSelectedPolicyForDetail(policy)}
                        >
                          <Info size={14} />
                        </button>
                        <button
                          type="button"
                          className="policy-action-btn"
                          title="Chỉnh sửa"
                          onClick={() => handleOpenEdit(policy)}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className={`policy-action-btn ${policy.isActive ? 'danger' : 'info'}`}
                          title={policy.isActive ? 'Tạm dừng' : 'Kích hoạt'}
                          onClick={() => setTogglingPolicy(policy)}
                        >
                          <Power size={14} />
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

      {/* ======================================================== */}
      {/* MODAL: CREATE POLICY */}
      {/* ======================================================== */}
      {showCreateModal && (
        <div className="policy-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="policy-modal" onClick={(e) => e.stopPropagation()}>
            <div className="policy-modal-header">
              <h3>Tạo chính sách hủy lịch mới</h3>
              <button
                type="button"
                className="policy-modal-close"
                onClick={() => setShowCreateModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="policy-modal-body">
                <div className="policy-form-group">
                  <label>
                    Tên chính sách hủy <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="policy-form-input"
                    placeholder="Ví dụ: Chính sách Tiêu chuẩn (2h), Chính sách 24h..."
                    value={policyForm.name}
                    onChange={(e) => setPolicyForm({ ...policyForm, name: e.target.value })}
                    required
                    autoFocus
                  />
                  <div className="policy-preset-chips">
                    <span style={{ fontSize: 11, color: 'var(--manager-muted)', alignSelf: 'center' }}>
                      Gợi ý:
                    </span>
                    {PRESET_POLICY_NAMES.slice(0, 3).map((name) => (
                      <button
                        key={name}
                        type="button"
                        className="policy-chip-btn"
                        onClick={() => setPolicyForm({ ...policyForm, name })}
                      >
                        {name.split(' (')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="policy-form-group">
                  <label>
                    Thời hạn hủy tối thiểu trước giờ học (Giờ) <span className="required">*</span>
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="720"
                    className="policy-form-input"
                    value={policyForm.minimumHoursBeforeStart}
                    onChange={(e) =>
                      setPolicyForm({
                        ...policyForm,
                        minimumHoursBeforeStart: Number(e.target.value),
                      })
                    }
                    required
                  />
                  <span className="policy-form-help">
                    Quy định từ 2 đến 720 giờ (tối đa 30 ngày trước buổi học).
                  </span>
                  <div className="policy-preset-chips">
                    {PRESET_HOURS.map((item) => (
                      <button
                        key={item.hours}
                        type="button"
                        className="policy-chip-btn"
                        onClick={() =>
                          setPolicyForm({
                            ...policyForm,
                            minimumHoursBeforeStart: item.hours,
                          })
                        }
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timeline Simulation */}
                <div className="policy-timeline-preview">
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--manager-ink)' }}>
                    Mô phỏng quy tắc chốt hủy:
                  </span>
                  <div className="policy-timeline-bar">
                    <div className="policy-timeline-point active" title="Học viên đăng ký" />
                    <div className="policy-timeline-point danger" title="Hạn chót hủy" />
                    <div className="policy-timeline-point" title="Bắt đầu buổi học" />
                  </div>
                  <div className="policy-timeline-labels">
                    <div>
                      <span>Đăng ký</span>
                      <strong>Bất kỳ lúc nào</strong>
                    </div>
                    <div>
                      <span style={{ color: '#dc2626' }}>Hạn chót hủy</span>
                      <strong style={{ color: '#b91c1c' }}>
                        Trước {formatHours(policyForm.minimumHoursBeforeStart)}
                      </strong>
                    </div>
                    <div>
                      <span>Buổi học</span>
                      <strong>Bắt đầu</strong>
                    </div>
                  </div>
                </div>

                <div className="policy-form-group">
                  <label className="policy-form-checkbox">
                    <input
                      type="checkbox"
                      checked={policyForm.isActive}
                      onChange={(e) =>
                        setPolicyForm({ ...policyForm, isActive: e.target.checked })
                      }
                    />
                    <span>Kích hoạt chính sách ngay sau khi tạo</span>
                  </label>
                </div>
              </div>
              <div className="policy-modal-footer">
                <button
                  type="button"
                  className="policy-btn policy-btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="policy-btn policy-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Đang tạo...' : 'Tạo chính sách'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT POLICY */}
      {/* ======================================================== */}
      {editingPolicy && (
        <div className="policy-modal-overlay" onClick={() => setEditingPolicy(null)}>
          <div className="policy-modal" onClick={(e) => e.stopPropagation()}>
            <div className="policy-modal-header">
              <h3>Chỉnh sửa chính sách: #{editingPolicy.id}</h3>
              <button
                type="button"
                className="policy-modal-close"
                onClick={() => setEditingPolicy(null)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="policy-modal-body">
                <div className="policy-form-group">
                  <label>
                    Tên chính sách hủy <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="policy-form-input"
                    value={policyForm.name}
                    onChange={(e) => setPolicyForm({ ...policyForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="policy-form-group">
                  <label>
                    Thời hạn hủy tối thiểu trước giờ học (Giờ) <span className="required">*</span>
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="720"
                    className="policy-form-input"
                    value={policyForm.minimumHoursBeforeStart}
                    onChange={(e) =>
                      setPolicyForm({
                        ...policyForm,
                        minimumHoursBeforeStart: Number(e.target.value),
                      })
                    }
                    required
                  />
                  <div className="policy-preset-chips">
                    {PRESET_HOURS.map((item) => (
                      <button
                        key={item.hours}
                        type="button"
                        className="policy-chip-btn"
                        onClick={() =>
                          setPolicyForm({
                            ...policyForm,
                            minimumHoursBeforeStart: item.hours,
                          })
                        }
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timeline Simulation */}
                <div className="policy-timeline-preview">
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--manager-ink)' }}>
                    Mô phỏng quy tắc chốt hủy:
                  </span>
                  <div className="policy-timeline-bar">
                    <div className="policy-timeline-point active" title="Học viên đăng ký" />
                    <div className="policy-timeline-point danger" title="Hạn chót hủy" />
                    <div className="policy-timeline-point" title="Bắt đầu buổi học" />
                  </div>
                  <div className="policy-timeline-labels">
                    <div>
                      <span>Đăng ký</span>
                      <strong>Bất kỳ lúc nào</strong>
                    </div>
                    <div>
                      <span style={{ color: '#dc2626' }}>Hạn chót hủy</span>
                      <strong style={{ color: '#b91c1c' }}>
                        Trước {formatHours(policyForm.minimumHoursBeforeStart)}
                      </strong>
                    </div>
                    <div>
                      <span>Buổi học</span>
                      <strong>Bắt đầu</strong>
                    </div>
                  </div>
                </div>

                <div className="policy-form-group">
                  <label className="policy-form-checkbox">
                    <input
                      type="checkbox"
                      checked={policyForm.isActive}
                      onChange={(e) =>
                        setPolicyForm({ ...policyForm, isActive: e.target.checked })
                      }
                    />
                    <span>Trạng thái áp dụng (Active)</span>
                  </label>
                  <span className="policy-form-help">
                    * Lưu ý: Các học viên đã đăng ký lịch học trước đó vẫn bảo toàn thời hạn hủy gốc ban đầu.
                  </span>
                </div>
              </div>
              <div className="policy-modal-footer">
                <button
                  type="button"
                  className="policy-btn policy-btn-secondary"
                  onClick={() => setEditingPolicy(null)}
                  disabled={submitting}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="policy-btn policy-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: DETAIL */}
      {/* ======================================================== */}
      {selectedPolicyForDetail && (
        <div className="policy-modal-overlay" onClick={() => setSelectedPolicyForDetail(null)}>
          <div className="policy-modal" onClick={(e) => e.stopPropagation()}>
            <div className="policy-modal-header">
              <h3>Chi tiết chính sách: {selectedPolicyForDetail.name}</h3>
              <button
                type="button"
                className="policy-modal-close"
                onClick={() => setSelectedPolicyForDetail(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="policy-modal-body">
              <div className="policy-rule-box">
                <div className="policy-rule-info">
                  <span>Thời gian hủy tối thiểu:</span>
                  <strong>{formatHours(selectedPolicyForDetail.minimumHoursBeforeStart)}</strong>
                </div>
                <Clock size={28} style={{ color: 'var(--manager-blue)' }} />
              </div>

              {/* Timeline Simulation */}
              <div className="policy-timeline-preview">
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--manager-ink)' }}>
                  Sơ đồ mốc thời gian hủy lịch:
                </span>
                <div className="policy-timeline-bar">
                  <div className="policy-timeline-point active" title="Đăng ký" />
                  <div className="policy-timeline-point danger" title="Hạn chót hủy" />
                  <div className="policy-timeline-point" title="Bắt đầu ca học" />
                </div>
                <div className="policy-timeline-labels">
                  <div>
                    <span>Đăng ký</span>
                    <strong>Hợp lệ</strong>
                  </div>
                  <div>
                    <span style={{ color: '#dc2626' }}>Hạn chót hủy</span>
                    <strong style={{ color: '#b91c1c' }}>
                      Trước {formatHours(selectedPolicyForDetail.minimumHoursBeforeStart)}
                    </strong>
                  </div>
                  <div>
                    <span>Ca học</span>
                    <strong>Bắt đầu</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <div>
                  <span style={{ color: 'var(--manager-muted)' }}>Mã chính sách: </span>
                  <strong>#{selectedPolicyForDetail.id}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--manager-muted)' }}>Trạng thái áp dụng: </span>
                  <span
                    className={`policy-badge ${
                      selectedPolicyForDetail.isActive ? 'active' : 'inactive'
                    }`}
                  >
                    <i />
                    {selectedPolicyForDetail.isActive ? 'Đang áp dụng' : 'Tạm dừng áp dụng'}
                  </span>
                </div>
                <div className="policy-rule-example">
                  <p style={{ margin: 0, lineHeight: 1.6 }}>
                    Học viên đăng ký buổi học áp dụng chính sách này bắt buộc phải gửi yêu cầu hủy lịch trước giờ bắt đầu buổi học ít nhất{' '}
                    <strong>{selectedPolicyForDetail.minimumHoursBeforeStart} tiếng</strong>. Sau mốc thời gian này, hệ thống sẽ khóa chức năng hủy và tính là buổi học đã sử dụng.
                  </p>
                </div>
              </div>
            </div>
            <div className="policy-modal-footer">
              <button
                type="button"
                className="policy-btn policy-btn-secondary"
                onClick={() => {
                  const p = selectedPolicyForDetail
                  setSelectedPolicyForDetail(null)
                  handleOpenEdit(p)
                }}
              >
                <Edit2 size={14} /> Chỉnh sửa chính sách
              </button>
              <button
                type="button"
                className="policy-btn policy-btn-primary"
                onClick={() => setSelectedPolicyForDetail(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: TOGGLE STATUS CONFIRM */}
      {/* ======================================================== */}
      {togglingPolicy && (
        <div className="policy-modal-overlay" onClick={() => setTogglingPolicy(null)}>
          <div className="policy-modal" onClick={(e) => e.stopPropagation()}>
            <div className="policy-modal-header">
              <h3>
                {togglingPolicy.isActive
                  ? 'Tạm dừng áp dụng chính sách'
                  : 'Kích hoạt lại chính sách'}
              </h3>
              <button
                type="button"
                className="policy-modal-close"
                onClick={() => setTogglingPolicy(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="policy-modal-body">
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
                Bạn có chắc chắn muốn{' '}
                <strong>{togglingPolicy.isActive ? 'tạm dừng áp dụng' : 'kích hoạt lại'}</strong> chính sách{' '}
                <strong>"{togglingPolicy.name}"</strong>?
              </p>
              {togglingPolicy.isActive && (
                <div className="policy-alert policy-alert-error" style={{ margin: '8px 0 0' }}>
                  <AlertCircle size={18} />
                  <span>
                    Khi tạm dừng, các buổi học mới sẽ không thể gán chính sách này. Các buổi học đã xếp lịch trước đó vẫn giữ nguyên thời hạn chót hủy ban đầu.
                  </span>
                </div>
              )}
            </div>
            <div className="policy-modal-footer">
              <button
                type="button"
                className="policy-btn policy-btn-secondary"
                onClick={() => setTogglingPolicy(null)}
                disabled={submitting}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className={`policy-btn ${togglingPolicy.isActive ? 'policy-btn-danger' : 'policy-btn-primary'}`}
                onClick={() => handleToggleStatus(togglingPolicy)}
                disabled={submitting}
              >
                {submitting
                  ? 'Đang xử lý...'
                  : togglingPolicy.isActive
                  ? 'Xác nhận tạm dừng'
                  : 'Xác nhận kích hoạt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
