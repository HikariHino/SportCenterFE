import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowDownToLine,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
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
  deleteMembershipPackage,
  getMembershipPackagesForManagement,
  getPackageErrorMessage,
  updateMembershipPackage,
} from '../../services/membershipPackageService'
import '../../style/CenterManager/PackageManagement.css'

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

  // Modals placeholder for Commit 1 (expanded in Commit 2)
  const [selectedPackageForDetail, setSelectedPackageForDetail] = useState(null)
  const [togglingPackage, setTogglingPackage] = useState(null)
  const [submitting, setSubmitting] = useState(false)

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

  // Quick toggle active / inactive
  const handleToggleStatus = async (pkg) => {
    setSubmitting(true)
    setError('')
    try {
      const nextActive = !pkg.isActive
      if (!nextActive) {
        // Deactivate via DELETE /api/membership-packages/{id}
        await deleteMembershipPackage(pkg.id)
        setPackages((prev) =>
          prev.map((item) => (item.id === pkg.id ? { ...item, isActive: false } : item))
        )
        setSuccess(`Đã tạm dừng bán gói "${pkg.packageName}".`)
      } else {
        // Activate via PUT /api/membership-packages/{id}
        const updated = await updateMembershipPackage(pkg.id, {
          packageName: pkg.packageName,
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
      ['Mã gói', 'Tên gói hội viên', 'Giá niêm yết (VND)', 'Thời hạn (ngày)', 'Mô tả & Quyền lợi', 'Trạng thái'],
      ...filteredPackages.map((p) => [
        `#${p.id}`,
        p.packageName,
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

  return (
    <div className="pkg-mgmt">
      {/* Header */}
      <section className="pkg-mgmt-header manager-card">
        <div>
          <h2>Quản lý gói thẻ hội viên</h2>
          <p>
            Thiết lập danh sách các gói thành viên (1 tháng, 6 tháng, 1 năm, VIP,...), quản lý giá tiền, thời hạn và trạng thái mở bán.
          </p>
        </div>
        <div className="pkg-mgmt-actions">
          <button
            type="button"
            className="pkg-btn pkg-btn-secondary"
            onClick={handleExportCSV}
            title="Xuất file CSV"
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
            onClick={() => {
              // Trigger create event or modal
              window.dispatchEvent(new CustomEvent('open-create-package-modal'))
            }}
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
            <strong>{packages.length}</strong>
          </div>
        </article>

        <article className="pkg-metric-card">
          <div className="pkg-metric-icon green">
            <CheckCircle2 size={22} />
          </div>
          <div className="pkg-metric-info">
            <span>Đang mở bán</span>
            <strong>{activeCount}</strong>
          </div>
        </article>

        <article className="pkg-metric-card">
          <div className="pkg-metric-icon amber">
            <Power size={22} />
          </div>
          <div className="pkg-metric-info">
            <span>Tạm dừng mở bán</span>
            <strong>{inactiveCount}</strong>
          </div>
        </article>

        <article className="pkg-metric-card">
          <div className="pkg-metric-icon purple">
            <Sparkles size={22} />
          </div>
          <div className="pkg-metric-info">
            <span>Gói cao cấp nhất</span>
            <strong>{formatCurrency(maxPrice)}</strong>
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

      {/* Filter Toolbar */}
      <div className="pkg-toolbar">
        <div className="pkg-search-box">
          <Search size={16} />
          <input
            type="text"
            className="pkg-search-input"
            placeholder="Tìm theo tên gói thẻ hoặc mô tả quyền lợi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="pkg-filter-group">
          <select
            className="pkg-select"
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang mở bán</option>
            <option value="INACTIVE">Tạm dừng bán</option>
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
        <div className="pkg-loading">
          <div className="pkg-spinner" />
          <span>Đang tải danh sách gói thẻ hội viên...</span>
        </div>
      ) : filteredPackages.length === 0 ? (
        <div className="pkg-empty">
          <Package size={40} />
          <strong>Không tìm thấy gói thẻ phù hợp</strong>
          <p>Thử điều chỉnh bộ lọc hoặc tạo gói thẻ hội viên mới cho trung tâm.</p>
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
                  <div className="package-card-title">
                    <h3>{pkg.packageName}</h3>
                    <small>Mã gói: #{pkg.id}</small>
                  </div>
                  <span className={`package-badge ${pkg.isActive ? 'active' : 'inactive'}`}>
                    <i />
                    {pkg.isActive ? 'Đang mở bán' : 'Tạm dừng'}
                  </span>
                </div>

                <div className="package-pricing">
                  <strong>{formatCurrency(pkg.price)}</strong>
                  <span>/ {formatDuration(pkg.durationInDays)}</span>
                </div>

                <p className="package-desc">
                  {pkg.description || 'Chưa có mô tả chi tiết quyền lợi cho gói này.'}
                </p>

                <div className="package-card-footer">
                  <span style={{ fontSize: 11, color: 'var(--manager-muted)' }}>
                    ~ {formatCurrency(perDayPrice)} / ngày
                  </span>

                  <div className="package-actions">
                    <button
                      type="button"
                      className="package-action-btn"
                      title="Xem chi tiết gói thẻ"
                      onClick={() => setSelectedPackageForDetail(pkg)}
                    >
                      <Info size={15} />
                    </button>
                    <button
                      type="button"
                      className={`package-action-btn ${pkg.isActive ? 'danger' : 'info'}`}
                      title={pkg.isActive ? 'Tạm dừng bán gói này' : 'Mở bán lại gói này'}
                      onClick={() => setTogglingPackage(pkg)}
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
        <div className="package-table-container manager-card" style={{ margin: '0 24px', padding: '16px' }}>
          <table className="package-table">
            <thead>
              <tr>
                <th>MÃ GÓI</th>
                <th>TÊN GÓI THẺ</th>
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
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="package-action-btn"
                          title="Xem chi tiết"
                          onClick={() => setSelectedPackageForDetail(pkg)}
                        >
                          <Info size={14} />
                        </button>
                        <button
                          type="button"
                          className={`package-action-btn ${pkg.isActive ? 'danger' : 'info'}`}
                          title={pkg.isActive ? 'Tạm dừng bán' : 'Mở bán lại'}
                          onClick={() => setTogglingPackage(pkg)}
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

      {/* CONFIRM TOGGLE STATUS MODAL */}
      {togglingPackage && (
        <div className="pkg-modal-overlay" onClick={() => setTogglingPackage(null)}>
          <div className="pkg-modal" onClick={(e) => e.stopPropagation()}>
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

      {/* DETAIL MODAL */}
      {selectedPackageForDetail && (
        <div className="pkg-modal-overlay" onClick={() => setSelectedPackageForDetail(null)}>
          <div className="pkg-modal" onClick={(e) => e.stopPropagation()}>
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
                  <p style={{ margin: '6px 0 0', lineHeight: 1.6, color: '#334155' }}>
                    {selectedPackageForDetail.description || 'Chưa cập nhật mô tả chi tiết.'}
                  </p>
                </div>
              </div>
            </div>
            <div className="pkg-modal-footer">
              <button
                type="button"
                className="pkg-btn pkg-btn-secondary"
                onClick={() => setSelectedPackageForDetail(null)}
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
