import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowDownToLine,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Crown,
  Edit2,
  Grid,
  Info,
  Layers,
  List,
  Package,
  Plus,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  Users,
  X,
  Zap,
} from 'lucide-react'
import {
  createMembershipPackage,
  deleteMembershipPackage,
  getMembershipPackagesForManagement,
  getPackageErrorMessage,
  updateMembershipPackage,
} from '../../services/membershipPackageService'
import '../../style/CenterManager/PackageManagement.css'
import { membershipPackageType, membershipPackageTypeLabel } from '../../utils/memberSubscriptions'

export function PackageTypeField({ id, value, onChange, disabled }) {
  return <div className="pkg-form-group">
    <label htmlFor={id}>Loại gói <span className="required">*</span></label>
    <select id={id} name="packageType" className="pkg-form-select" value={value} onChange={event => onChange(event.target.value)} disabled={disabled} required>
      <option value="Standard">Standard — Gói tập chung / cơ bản</option>
      <option value="PT">PT — Gói tập kèm HLV 1-1</option>
    </select>
    <span className="pkg-form-help">Loại gói được lưu riêng với tên và mô tả quyền lợi.</span>
  </div>
}

const PRESET_DURATIONS = [
  { label: '1 Tháng (30 ngày)', days: 30 },
  { label: '3 Tháng (90 ngày)', days: 90 },
  { label: '6 Tháng (180 ngày)', days: 180 },
  { label: '1 Năm (365 ngày)', days: 365 },
]

const PRESET_NAMES = [
  'Gói Hội Viên 1 Tháng (Basic)',
  'Gói Hội Viên 3 Tháng (Standard)',
  'Gói Hội Viên 6 Tháng (Pro)',
  'Gói Hội Viên 1 Năm (Diamond)',
  'Gói Hội Viên VIP All-Access',
  'Thẻ Tập Cuối Tuần (Weekend Pass)',
  'Gói Học Sinh / Sinh Viên (Student Pass)',
]

const BENEFIT_SUGGESTIONS = [
  'Không giới hạn giờ tập',
  'Tham gia toàn bộ lớp Yoga & Gym miễn phí',
  'Miễn phí sử dụng Bể bơi bốn mùa',
  'Tủ đồ cá nhân (Locker VIP)',
  '02 buổi tập cùng HLV cá nhân (PT)',
  'Đo chỉ số cơ thể InBody định kỳ hàng tháng',
  'Miễn phí khăn tập và nước uống cao cấp',
  'Tặng 01 vé mời bạn bè trải nghiệm/tháng',
]

const formatCurrency = (val) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0)

const formatDuration = (days) => {
  if (!days) return 'Chưa thiết lập'
  if (days % 365 === 0) {
    const years = days / 365
    return `${years} năm (${days} ngày)`
  }
  if (days % 30 === 0) {
    const months = days / 30
    return `${months} tháng (${days} ngày)`
  }
  return `${days} ngày`
}

export default function PackageManagement() {
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // View & Filters
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'table'
  const [searchQuery, setSearchQuery] = useState('')
  const [durationFilter, setDurationFilter] = useState('ALL') // 'ALL' | '1M' | '3M' | '6M' | '1Y'
  const [statusFilter, setStatusFilter] = useState('ALL') // 'ALL' | 'ACTIVE' | 'INACTIVE'

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingPackage, setEditingPackage] = useState(null)
  const [selectedPackageForDetail, setSelectedPackageForDetail] = useState(null)
  const [togglingPackage, setTogglingPackage] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Package Form State
  const [packageForm, setPackageForm] = useState({
    packageName: '',
    packageType: 'Standard',
    description: '',
    price: 600000,
    durationInDays: 30,
    isActive: true,
  })

  // Auto clear success message
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 4500)
      return () => clearTimeout(timer)
    }
  }, [success])

  // Load packages for manager
  const loadPackages = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getMembershipPackagesForManagement()
      setPackages(data)
    } catch (err) {
      setError(getPackageErrorMessage(err, 'Không thể tải danh sách gói hội viên.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPackages()
  }, [])

  // Listen for custom trigger from button
  useEffect(() => {
    const handleOpen = () => handleOpenCreate()
    window.addEventListener('open-create-package-modal', handleOpen)
    return () => window.removeEventListener('open-create-package-modal', handleOpen)
  }, [])

  // Filtered packages
  const filteredPackages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return packages.filter((pkg) => {
      const matchesQuery =
        !q ||
        pkg.packageName.toLowerCase().includes(q) ||
        (pkg.description && pkg.description.toLowerCase().includes(q))

      let matchesDuration = true
      if (durationFilter === '1M') {
        matchesDuration = pkg.durationInDays >= 28 && pkg.durationInDays <= 31
      } else if (durationFilter === '3M') {
        matchesDuration = pkg.durationInDays >= 85 && pkg.durationInDays <= 95
      } else if (durationFilter === '6M') {
        matchesDuration = pkg.durationInDays >= 170 && pkg.durationInDays <= 190
      } else if (durationFilter === '1Y') {
        matchesDuration = pkg.durationInDays >= 360
      }

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && pkg.isActive) ||
        (statusFilter === 'INACTIVE' && !pkg.isActive)

      return matchesQuery && matchesDuration && matchesStatus
    })
  }, [packages, searchQuery, durationFilter, statusFilter])

  // Stats
  const activeCount = packages.filter((p) => p.isActive).length
  const inactiveCount = packages.length - activeCount
  const maxPrice = packages.reduce((max, p) => Math.max(max, Number(p.price) || 0), 0)
  const hasFilters = Boolean(searchQuery.trim() || durationFilter !== 'ALL' || statusFilter !== 'ALL')
  const clearFilters = () => { setSearchQuery(''); setDurationFilter('ALL'); setStatusFilter('ALL') }

  // Open Create Modal
  const handleOpenCreate = () => {
    setPackageForm({
      packageName: 'Gói Hội Viên 1 Tháng (Basic)',
      packageType: 'Standard',
      description: 'Không giới hạn giờ tập tại trung tâm. Miễn phí tủ đồ cá nhân và đo chỉ số InBody.',
      price: 600000,
      durationInDays: 30,
      isActive: true,
    })
    setShowCreateModal(true)
    setError('')
  }

  // Open Edit Modal
  const handleOpenEdit = (pkg) => {
    setEditingPackage(pkg)
    setPackageForm({
      packageName: pkg.packageName || '',
      packageType: membershipPackageType(pkg),
      description: pkg.description || '',
      price: pkg.price || 0,
      durationInDays: pkg.durationInDays || 30,
      isActive: pkg.isActive !== false,
    })
    setError('')
  }

  // Append a benefit suggestion into description
  const handleAddBenefit = (benefit) => {
    setPackageForm((prev) => {
      const current = prev.description ? prev.description.trim() : ''
      if (current.includes(benefit)) return prev
      const updated = current ? `${current}\n• ${benefit}` : `• ${benefit}`
      return { ...prev, description: updated }
    })
  }

  // Submit Create Package
  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!packageForm.packageName.trim()) {
      setError('Vui lòng nhập tên gói thẻ hội viên.')
      return
    }
    if (!packageForm.price || Number(packageForm.price) <= 0) {
      setError('Giá bán gói tập phải lớn hơn 0 VND.')
      return
    }
    if (!packageForm.durationInDays || Number(packageForm.durationInDays) < 1) {
      setError('Thời hạn gói tập phải từ 1 ngày trở lên.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const created = await createMembershipPackage({
        packageName: packageForm.packageName.trim(),
        packageType: packageForm.packageType,
        description: packageForm.description ? packageForm.description.trim() : null,
        price: Number(packageForm.price),
        durationInDays: Number(packageForm.durationInDays),
      })
      await loadPackages()
      setShowCreateModal(false)
      setSuccess(`Đã tạo gói thẻ hội viên "${created.packageName}" thành công!`)
    } catch (err) {
      setError(getPackageErrorMessage(err, 'Không thể tạo mới gói hội viên.'))
    } finally {
      setSubmitting(false)
    }
  }

  // Submit Edit Package
  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!editingPackage) return
    if (!packageForm.packageName.trim()) {
      setError('Vui lòng nhập tên gói thẻ hội viên.')
      return
    }
    if (!packageForm.price || Number(packageForm.price) <= 0) {
      setError('Giá bán gói tập phải lớn hơn 0 VND.')
      return
    }
    if (!packageForm.durationInDays || Number(packageForm.durationInDays) < 1) {
      setError('Thời hạn gói tập phải từ 1 ngày trở lên.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const updated = await updateMembershipPackage(editingPackage.id, {
        packageName: packageForm.packageName.trim(),
        packageType: packageForm.packageType,
        description: packageForm.description ? packageForm.description.trim() : null,
        price: Number(packageForm.price),
        durationInDays: Number(packageForm.durationInDays),
        isActive: Boolean(packageForm.isActive),
      })
      await loadPackages()
      setEditingPackage(null)
      setSuccess(`Đã cập nhật gói thẻ "${updated.packageName}" thành công!`)
    } catch (err) {
      setError(getPackageErrorMessage(err, 'Không thể cập nhật gói hội viên.'))
    } finally {
      setSubmitting(false)
    }
  }

  // Quick toggle active / inactive
  const handleToggleStatus = async (pkg) => {
    setSubmitting(true)
    setError('')
    try {
      const nextActive = !pkg.isActive
      if (!nextActive) {
        await deleteMembershipPackage(pkg.id)
        setPackages((prev) =>
          prev.map((item) => (item.id === pkg.id ? { ...item, isActive: false } : item))
        )
        setSuccess(`Đã tạm dừng bán gói "${pkg.packageName}".`)
      } else {
        const updated = await updateMembershipPackage(pkg.id, {
          packageName: pkg.packageName,
          packageType: membershipPackageType(pkg),
          description: pkg.description,
          price: pkg.price,
          durationInDays: pkg.durationInDays,
          isActive: true,
        })
        setPackages((prev) =>
          prev.map((item) => (item.id === pkg.id ? { ...item, ...updated } : item))
        )
        setSuccess(`Đã mở bán lại gói "${pkg.packageName}".`)
      }
    } catch (err) {
      setError(getPackageErrorMessage(err, 'Không thể cập nhật trạng thái gói hội viên.'))
    } finally {
      setSubmitting(false)
      setTogglingPackage(null)
    }
  }

  // Export CSV
  const handleExportCSV = () => {
    const rows = [
      ['Mã gói', 'Tên gói hội viên', 'Loại gói', 'Giá niêm yết (VND)', 'Thời hạn (ngày)', 'Mô tả & Quyền lợi', 'Trạng thái'],
      ...filteredPackages.map((p) => [
        `#${p.id}`,
        p.packageName,
        membershipPackageType(p),
        p.price,
        p.durationInDays,
        p.description || 'Chưa cập nhật',
        p.isActive ? 'Đang mở bán' : 'Tạm dừng bán',
      ]),
    ]
    const csvContent =
      '\uFEFF' +
      rows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `danh-sach-goi-hoi-vien-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setSuccess('Đã xuất danh sách gói hội viên ra file CSV thành công!')
  }

  // Calculated per-day cost in form
  const formPerDayCost =
    packageForm.durationInDays > 0
      ? Math.round(Number(packageForm.price || 0) / Number(packageForm.durationInDays))
      : 0

  return (
    <div className="pkg-mgmt">
      {/* Header */}
      <section className="pkg-mgmt-header manager-card">
        <div>
          <h2>Quản lý gói thẻ hội viên</h2>
          <p>
            Quản lý giá bán, thời hạn sử dụng và quyền lợi của từng gói hội viên.
          </p>
        </div>
        <div className="pkg-mgmt-actions">
          <button
            type="button"
            className="pkg-btn pkg-btn-secondary"
            onClick={handleExportCSV}
            disabled={loading || !filteredPackages.length}
            title="Xuất file CSV danh sách gói thẻ"
          >
            <ArrowDownToLine size={15} /> Xuất CSV
          </button>
          <button
            type="button"
            className="pkg-btn pkg-btn-secondary"
            onClick={loadPackages}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
          <button
            type="button"
            className="pkg-btn pkg-btn-primary"
            onClick={handleOpenCreate}
          >
            <Plus size={16} /> Tạo gói thẻ mới
          </button>
        </div>
      </section>

      {/* Metrics */}
      <section className="pkg-metrics">
        <article className="pkg-metric-card">
          <div className="pkg-metric-icon blue">
            <Package size={22} />
          </div>
          <div className="pkg-metric-info">
            <span>Tổng số gói hội viên</span>
            <strong>{loading ? '—' : packages.length}</strong>
          </div>
        </article>

        <article className="pkg-metric-card">
          <div className="pkg-metric-icon green">
            <CheckCircle2 size={22} />
          </div>
          <div className="pkg-metric-info">
            <span>Đang mở bán</span>
            <strong>{loading ? '—' : activeCount}</strong>
          </div>
        </article>

        <article className="pkg-metric-card">
          <div className="pkg-metric-icon amber">
            <Power size={22} />
          </div>
          <div className="pkg-metric-info">
            <span>Tạm dừng mở bán</span>
            <strong>{loading ? '—' : inactiveCount}</strong>
          </div>
        </article>

        <article className="pkg-metric-card">
          <div className="pkg-metric-icon purple">
            <Sparkles size={22} />
          </div>
          <div className="pkg-metric-info">
            <span>Giá bán cao nhất</span>
            <strong>{loading ? '—' : formatCurrency(maxPrice)}</strong>
          </div>
        </article>
      </section>

      {/* Notification Alerts */}
      {error && (
        <div className="pkg-alert pkg-alert-error" role="alert">
          <div className="pkg-alert-content">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="pkg-alert-close"
            onClick={() => setError('')}
            aria-label="Đóng thông báo lỗi"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="pkg-alert pkg-alert-success" role="status">
          <div className="pkg-alert-content">
            <CheckCircle2 size={18} />
            <span>{success}</span>
          </div>
          <button
            type="button"
            className="pkg-alert-close"
            onClick={() => setSuccess('')}
            aria-label="Đóng thông báo thành công"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <section className="pkg-catalog manager-card" aria-labelledby="pkg-catalog-title" aria-busy={loading}>
        <header className="pkg-catalog-heading">
          <div><h3 id="pkg-catalog-title">Danh sách gói hội viên</h3><p>Tìm kiếm, so sánh và cập nhật các gói thẻ của trung tâm.</p></div>
          <div className="pkg-catalog-tools">
            <span className="pkg-result-count">{loading ? 'Đang tải…' : `${filteredPackages.length} / ${packages.length} gói`}</span>
            <div className="pkg-view-toggle" role="group" aria-label="Cách hiển thị gói hội viên">
              <button type="button" className={viewMode === 'grid' ? 'active' : ''} aria-pressed={viewMode === 'grid'} aria-label="Xem dạng thẻ" title="Xem dạng thẻ" onClick={() => setViewMode('grid')}><Grid size={16} /></button>
              <button type="button" className={viewMode === 'table' ? 'active' : ''} aria-pressed={viewMode === 'table'} aria-label="Xem dạng bảng" title="Xem dạng bảng" onClick={() => setViewMode('table')}><List size={16} /></button>
            </div>
          </div>
        </header>
      <div className="pkg-toolbar" role="search" aria-label="Lọc gói hội viên">
        <div className="pkg-search-box">
          <Search size={16} />
          <input
            type="text"
            className="pkg-search-input"
            aria-label="Tìm gói hội viên"
            placeholder="Tìm tên gói hoặc quyền lợi…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="pkg-filter-group">
          <select
            className="pkg-select"
            aria-label="Lọc theo thời hạn"
            value={durationFilter}
            onChange={(e) => setDurationFilter(e.target.value)}
          >
            <option value="ALL">Tất cả thời hạn</option>
            <option value="1M">Gói 1 tháng (~30 ngày)</option>
            <option value="3M">Gói 3 tháng (~90 ngày)</option>
            <option value="6M">Gói 6 tháng (~180 ngày)</option>
            <option value="1Y">Gói 1 năm (từ 360 ngày)</option>
          </select>

          <select
            className="pkg-select"
            aria-label="Lọc theo trạng thái"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang mở bán</option>
            <option value="INACTIVE">Tạm dừng bán</option>
          </select>

        </div>
      </div>
      {hasFilters && <div className="pkg-filter-summary"><span>Đang áp dụng bộ lọc</span><button type="button" onClick={clearFilters}>Xóa bộ lọc <X size={13} /></button></div>}

      {/* Body: Loading / Empty / Grid / Table */}
      {loading ? (
        <div className="pkg-loading" role="status">
          <div className="pkg-spinner" />
          <span>Đang tải danh sách gói thẻ hội viên...</span>
        </div>
      ) : filteredPackages.length === 0 ? (
        <div className="pkg-empty" role="status">
          <Package size={40} />
          <strong>Không tìm thấy gói thẻ phù hợp</strong>
          <p>Thử điều chỉnh bộ lọc hoặc tạo gói thẻ hội viên mới cho trung tâm.</p>
          <button
            type="button"
            className="pkg-btn pkg-btn-primary"
            onClick={handleOpenCreate}
          >
            <Plus size={16} /> Tạo gói thẻ ngay
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="packages-grid">
          {filteredPackages.map((pkg) => {
            const isVip = (pkg.packageName || '').toLowerCase().includes('vip')
            const perDayPrice =
              pkg.durationInDays > 0 ? Math.round(Number(pkg.price) / pkg.durationInDays) : 0

            return (
              <article
                key={pkg.id}
                className={`package-card ${pkg.isActive ? '' : 'inactive'} ${isVip ? 'vip' : ''}`}
              >
                <div className="package-card-top">
                  <span className="package-code">Mã gói #{pkg.id}</span>
                  <span className={`package-badge ${pkg.isActive ? 'active' : 'inactive'}`}>
                    <i />
                    {pkg.isActive ? 'Đang mở bán' : 'Tạm dừng'}
                  </span>
                </div>
                <div className="package-card-title"><h3>{pkg.packageName}</h3>{isVip && <span className="package-vip-label"><Crown size={13} />VIP</span>}</div>
                <span className="package-code">Loại gói: {membershipPackageTypeLabel(pkg)}</span>

                <div className="package-pricing">
                  <strong>{formatCurrency(pkg.price)}</strong>
                  <span><Calendar size={14} />{formatDuration(pkg.durationInDays)}</span>
                </div>
                <span className="package-per-day">Khoảng {formatCurrency(perDayPrice)} / ngày</span>

                <p className="package-desc">
                  {pkg.description || 'Chưa có mô tả chi tiết quyền lợi cho gói này.'}
                </p>

                <div className="package-card-footer">
                  <div className="package-actions" role="group" aria-label={`Thao tác gói ${pkg.packageName}`}>
                    <button
                      type="button"
                      className="package-action-btn"
                      title="Xem chi tiết quyền lợi"
                      onClick={() => setSelectedPackageForDetail(pkg)}
                    >
                      <Info size={14} />Chi tiết
                    </button>
                    <button
                      type="button"
                      className="package-action-btn"
                      title="Chỉnh sửa giá bán, quyền lợi hoặc thời hạn"
                      onClick={() => handleOpenEdit(pkg)}
                    >
                      <Edit2 size={14} />Sửa
                    </button>
                    <button
                      type="button"
                      className={`package-action-btn ${pkg.isActive ? 'danger' : 'info'}`}
                      title={pkg.isActive ? 'Tạm dừng bán gói này' : 'Mở bán lại gói này'}
                      onClick={() => setTogglingPackage(pkg)}
                    >
                      <Power size={14} />{pkg.isActive ? 'Tạm dừng' : 'Mở bán'}
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="package-table-container" role="region" aria-label="Bảng gói hội viên" tabIndex={0}>
          <table className="package-table">
            <thead>
              <tr>
                <th>MÃ GÓI</th>
                <th>TÊN GÓI THẺ</th>
                <th>LOẠI GÓI</th>
                <th>GIÁ BÁN</th>
                <th>THỜI HẠN</th>
                <th>ƯỚC TÍNH / NGÀY</th>
                <th>TRẠNG THÁI</th>
                <th style={{ textAlign: 'right' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {filteredPackages.map((pkg) => {
                const perDayPrice =
                  pkg.durationInDays > 0 ? Math.round(Number(pkg.price) / pkg.durationInDays) : 0

                return (
                  <tr key={pkg.id}>
                    <td><strong>#{pkg.id}</strong></td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--manager-ink)' }}>
                        {pkg.packageName}
                      </div>
                    </td>
                    <td>{membershipPackageTypeLabel(pkg)}</td>
                    <td>
                      <strong style={{ color: 'var(--manager-ink)' }}>{formatCurrency(pkg.price)}</strong>
                    </td>
                    <td>{formatDuration(pkg.durationInDays)}</td>
                    <td>{formatCurrency(perDayPrice)} / ngày</td>
                    <td>
                      <span className={`package-badge ${pkg.isActive ? 'active' : 'inactive'}`}>
                        <i />
                        {pkg.isActive ? 'Đang mở bán' : 'Tạm dừng'}
                      </span>
                    </td>
                    <td>
                      <div className="package-actions" role="group" aria-label={`Thao tác gói ${pkg.packageName}`}>
                        <button
                          type="button"
                          className="package-action-btn"
                          title="Xem chi tiết"
                          onClick={() => setSelectedPackageForDetail(pkg)}
                        >
                          <Info size={14} />Chi tiết
                        </button>
                        <button
                          type="button"
                          className="package-action-btn"
                          title="Chỉnh sửa"
                          onClick={() => handleOpenEdit(pkg)}
                        >
                          <Edit2 size={14} />Sửa
                        </button>
                        <button
                          type="button"
                          className={`package-action-btn ${pkg.isActive ? 'danger' : 'info'}`}
                          title={pkg.isActive ? 'Tạm dừng bán' : 'Mở bán lại'}
                          onClick={() => setTogglingPackage(pkg)}
                        >
                          <Power size={14} />{pkg.isActive ? 'Tạm dừng' : 'Mở bán'}
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
      </section>

      {/* ======================================================== */}
      {/* MODAL: CREATE PACKAGE */}
      {/* ======================================================== */}
      {showCreateModal && (
        <div className="pkg-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="pkg-modal wide" role="dialog" aria-modal="true" aria-label="Tạo gói thẻ hội viên mới" onClick={(e) => e.stopPropagation()}>
            <div className="pkg-modal-header">
              <h3>Tạo gói thẻ hội viên mới</h3>
              <button
                type="button"
                className="pkg-modal-close"
                onClick={() => setShowCreateModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="pkg-modal-body">
                <PackageTypeField id="create-package-type" value={packageForm.packageType} onChange={packageType => setPackageForm(current => ({ ...current, packageType }))} disabled={submitting} />
                <div className="pkg-form-group">
                  <label>
                    Tên gói thẻ <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="pkg-form-input"
                    placeholder="Ví dụ: Gói 1 Tháng, Gói 6 Tháng VIP, Thẻ Tập Sinh Viên..."
                    value={packageForm.packageName}
                    onChange={(e) => setPackageForm({ ...packageForm, packageName: e.target.value })}
                    required
                    autoFocus
                  />
                  <div className="pkg-preset-chips">
                    <span style={{ fontSize: 11, color: 'var(--manager-muted)', alignSelf: 'center' }}>
                      Gợi ý tên:
                    </span>
                    {PRESET_NAMES.slice(0, 4).map((name) => (
                      <button
                        key={name}
                        type="button"
                        className="pkg-chip-btn"
                        onClick={() => setPackageForm({ ...packageForm, packageName: name })}
                      >
                        {name.split(' (')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pkg-form-grid-2">
                  <div className="pkg-form-group">
                    <label>
                      Thời hạn sử dụng (ngày) <span className="required">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="36500"
                      className="pkg-form-input"
                      value={packageForm.durationInDays}
                      onChange={(e) =>
                        setPackageForm({ ...packageForm, durationInDays: Number(e.target.value) })
                      }
                      required
                    />
                    <div className="pkg-preset-chips">
                      {PRESET_DURATIONS.map((dur) => (
                        <button
                          key={dur.days}
                          type="button"
                          className="pkg-chip-btn"
                          onClick={() => setPackageForm({ ...packageForm, durationInDays: dur.days })}
                        >
                          {dur.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pkg-form-group">
                    <label>
                      Giá niêm yết (VND) <span className="required">*</span>
                    </label>
                    <input
                      type="number"
                      min="1000"
                      step="50000"
                      className="pkg-form-input"
                      value={packageForm.price}
                      onChange={(e) => setPackageForm({ ...packageForm, price: Number(e.target.value) })}
                      required
                    />
                    <span className="pkg-form-help">
                      Định dạng: <strong>{formatCurrency(packageForm.price)}</strong>
                    </span>
                  </div>
                </div>

                {/* Calculation Preview */}
                <div className="pkg-calc-box">
                  <div>
                    <span>Ước tính chi phí trung bình:</span>
                    <strong> ~ {formatCurrency(formPerDayCost)} / ngày</strong>
                  </div>
                  <Sparkles size={18} />
                </div>

                <div className="pkg-form-group">
                  <label>Mô tả quyền lợi & Chính sách lớp học</label>
                  <textarea
                    className="pkg-form-textarea"
                    placeholder="Mô tả các tiện ích, quyền lợi lớp học kèm theo, số buổi PT, v.v..."
                    value={packageForm.description}
                    onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })}
                  />
                  <div className="pkg-benefits-wrap">
                    <span style={{ fontSize: 11, color: 'var(--manager-muted)', width: '100%' }}>
                      Click để thêm nhanh quyền lợi vào mô tả:
                    </span>
                    {BENEFIT_SUGGESTIONS.map((ben) => (
                      <button
                        key={ben}
                        type="button"
                        className="pkg-benefit-chip"
                        onClick={() => handleAddBenefit(ben)}
                      >
                        + {ben}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="pkg-modal-footer">
                <button
                  type="button"
                  className="pkg-btn pkg-btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="pkg-btn pkg-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Đang tạo...' : 'Tạo gói thẻ ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT PACKAGE */}
      {/* ======================================================== */}
      {editingPackage && (
        <div className="pkg-modal-overlay" onClick={() => setEditingPackage(null)}>
          <div className="pkg-modal wide" role="dialog" aria-modal="true" aria-label="Chỉnh sửa gói hội viên" onClick={(e) => e.stopPropagation()}>
            <div className="pkg-modal-header">
              <h3>Chỉnh sửa gói thẻ: #{editingPackage.id}</h3>
              <button
                type="button"
                className="pkg-modal-close"
                onClick={() => setEditingPackage(null)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="pkg-modal-body">
                <PackageTypeField id="edit-package-type" value={packageForm.packageType} onChange={packageType => setPackageForm(current => ({ ...current, packageType }))} disabled={submitting} />
                <div className="pkg-form-group">
                  <label>
                    Tên gói thẻ <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="pkg-form-input"
                    value={packageForm.packageName}
                    onChange={(e) => setPackageForm({ ...packageForm, packageName: e.target.value })}
                    required
                  />
                </div>

                <div className="pkg-form-grid-2">
                  <div className="pkg-form-group">
                    <label>
                      Thời hạn sử dụng (ngày) <span className="required">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="36500"
                      className="pkg-form-input"
                      value={packageForm.durationInDays}
                      onChange={(e) =>
                        setPackageForm({ ...packageForm, durationInDays: Number(e.target.value) })
                      }
                      required
                    />
                    <div className="pkg-preset-chips">
                      {PRESET_DURATIONS.map((dur) => (
                        <button
                          key={dur.days}
                          type="button"
                          className="pkg-chip-btn"
                          onClick={() => setPackageForm({ ...packageForm, durationInDays: dur.days })}
                        >
                          {dur.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pkg-form-group">
                    <label>
                      Giá bán niêm yết (VND) <span className="required">*</span>
                    </label>
                    <input
                      type="number"
                      min="1000"
                      step="50000"
                      className="pkg-form-input"
                      value={packageForm.price}
                      onChange={(e) => setPackageForm({ ...packageForm, price: Number(e.target.value) })}
                      required
                    />
                    <span className="pkg-form-help">
                      Định dạng: <strong>{formatCurrency(packageForm.price)}</strong>
                    </span>
                  </div>
                </div>

                {/* Calculation Preview */}
                <div className="pkg-calc-box">
                  <div>
                    <span>Ước tính chi phí trung bình:</span>
                    <strong> ~ {formatCurrency(formPerDayCost)} / ngày</strong>
                  </div>
                  <Sparkles size={18} />
                </div>

                <div className="pkg-form-group">
                  <label>Mô tả quyền lợi & Chính sách lớp học</label>
                  <textarea
                    className="pkg-form-textarea"
                    value={packageForm.description}
                    onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })}
                  />
                  <div className="pkg-benefits-wrap">
                    <span style={{ fontSize: 11, color: 'var(--manager-muted)', width: '100%' }}>
                      Click để thêm nhanh quyền lợi vào mô tả:
                    </span>
                    {BENEFIT_SUGGESTIONS.map((ben) => (
                      <button
                        key={ben}
                        type="button"
                        className="pkg-benefit-chip"
                        onClick={() => handleAddBenefit(ben)}
                      >
                        + {ben}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pkg-form-group">
                  <label className="pkg-form-checkbox">
                    <input
                      type="checkbox"
                      checked={packageForm.isActive}
                      onChange={(e) => setPackageForm({ ...packageForm, isActive: e.target.checked })}
                    />
                    <span>Trạng thái mở bán (Active)</span>
                  </label>
                  <span className="pkg-form-help">
                    Tắt mở bán để tạm dừng không cho hội viên đăng ký hoặc lễ tân bán gói này.
                  </span>
                </div>
              </div>
              <div className="pkg-modal-footer">
                <button
                  type="button"
                  className="pkg-btn pkg-btn-secondary"
                  onClick={() => setEditingPackage(null)}
                  disabled={submitting}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="pkg-btn pkg-btn-primary"
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
      {selectedPackageForDetail && (
        <div className="pkg-modal-overlay" onClick={() => setSelectedPackageForDetail(null)}>
          <div className="pkg-modal" role="dialog" aria-modal="true" aria-label="Chi tiết gói hội viên" onClick={(e) => e.stopPropagation()}>
            <div className="pkg-modal-header">
              <h3>Chi tiết gói thẻ: {selectedPackageForDetail.packageName}</h3>
              <button
                type="button"
                className="pkg-modal-close"
                onClick={() => setSelectedPackageForDetail(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="pkg-modal-body">
              <div className="package-pricing">
                <strong>{formatCurrency(selectedPackageForDetail.price)}</strong>
                <span>/ {formatDuration(selectedPackageForDetail.durationInDays)}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <div>
                  <span style={{ color: 'var(--manager-muted)' }}>Mã gói thẻ: </span>
                  <strong>#{selectedPackageForDetail.id}</strong>
                </div>
                <div><span style={{ color: 'var(--manager-muted)' }}>Loại gói: </span><strong>{membershipPackageTypeLabel(selectedPackageForDetail)}</strong></div>
                <div>
                  <span style={{ color: 'var(--manager-muted)' }}>Chi phí trung bình: </span>
                  <strong>
                    ~{' '}
                    {formatCurrency(
                      selectedPackageForDetail.durationInDays > 0
                        ? Math.round(
                            Number(selectedPackageForDetail.price) /
                              selectedPackageForDetail.durationInDays
                          )
                        : 0
                    )}{' '}
                    / ngày
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--manager-muted)' }}>Trạng thái: </span>
                  <span
                    className={`package-badge ${selectedPackageForDetail.isActive ? 'active' : 'inactive'}`}
                  >
                    <i />
                    {selectedPackageForDetail.isActive ? 'Đang mở bán' : 'Tạm dừng bán'}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--manager-muted)' }}>Mô tả & Quyền lợi:</span>
                  <div
                    style={{
                      marginTop: 6,
                      lineHeight: 1.6,
                      color: 'var(--manager-text, #334155)',
                      background: 'var(--manager-raised, #f8fafc)',
                      padding: '12px 14px',
                      borderRadius: 8,
                      border: '1px solid var(--manager-line)',
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {selectedPackageForDetail.description || 'Chưa cập nhật mô tả chi tiết.'}
                  </div>
                </div>
              </div>
            </div>
            <div className="pkg-modal-footer">
              <button
                type="button"
                className="pkg-btn pkg-btn-secondary"
                onClick={() => {
                  const pkg = selectedPackageForDetail
                  setSelectedPackageForDetail(null)
                  handleOpenEdit(pkg)
                }}
              >
                <Edit2 size={14} /> Chỉnh sửa gói
              </button>
              <button
                type="button"
                className="pkg-btn pkg-btn-primary"
                onClick={() => setSelectedPackageForDetail(null)}
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
      {togglingPackage && (
        <div className="pkg-modal-overlay" onClick={() => setTogglingPackage(null)}>
          <div className="pkg-modal" role="dialog" aria-modal="true" aria-label="Thay đổi trạng thái gói hội viên" onClick={(e) => e.stopPropagation()}>
            <div className="pkg-modal-header">
              <h3>
                {togglingPackage.isActive ? 'Tạm dừng bán gói hội viên' : 'Mở bán lại gói hội viên'}
              </h3>
              <button
                type="button"
                className="pkg-modal-close"
                onClick={() => setTogglingPackage(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="pkg-modal-body">
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
                Bạn có chắc chắn muốn{' '}
                <strong>{togglingPackage.isActive ? 'tạm dừng bán' : 'mở bán lại'}</strong> gói thẻ{' '}
                <strong>"{togglingPackage.packageName}"</strong>?
              </p>
              {togglingPackage.isActive && (
                <div className="pkg-alert pkg-alert-error" style={{ margin: '8px 0 0' }}>
                  <AlertCircle size={18} />
                  <span>
                    Khi tạm dừng, gói thẻ sẽ không còn hiển thị cho hội viên đăng ký mới hoặc lễ tân bán tại quầy. Các hội viên đã mua gói trước đó vẫn duy trì quyền lợi bình thường.
                  </span>
                </div>
              )}
            </div>
            <div className="pkg-modal-footer">
              <button
                type="button"
                className="pkg-btn pkg-btn-secondary"
                onClick={() => setTogglingPackage(null)}
                disabled={submitting}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className={`pkg-btn ${togglingPackage.isActive ? 'pkg-btn-danger' : 'pkg-btn-primary'}`}
                onClick={() => handleToggleStatus(togglingPackage)}
                disabled={submitting}
              >
                {submitting
                  ? 'Đang xử lý...'
                  : togglingPackage.isActive
                  ? 'Xác nhận tạm dừng'
                  : 'Xác nhận mở bán'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
