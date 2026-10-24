import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Award,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Clock3,
  CreditCard,
  DollarSign,
  FileDown,
  FileText,
  Layers,
  Percent,
  Printer,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import {
  exportInvoicePdf,
  getClassStatusReport,
  getDashboardOverview,
  getPaymentsReport,
  getReportErrorMessage,
  getRevenueByYear,
  triggerBlobDownload,
} from '../../services/reportService'
import '../../style/CenterManager/ReportManagement.css'

function formatVND(value) {
  const number = Number(value) || 0
  return number.toLocaleString('vi-VN') + ' ₫'
}

function formatChartValue(value) {
  return new Intl.NumberFormat('vi-VN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatDate(dateString) {
  if (!dateString) return '—'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ReportManagement() {
  const currentYear = new Date().getFullYear()

  // Navigation tab
  const [activeTab, setActiveTab] = useState('revenue')
  const [selectedYear, setSelectedYear] = useState(currentYear)

  // Data states
  const [overview, setOverview] = useState(null)
  const [revenueData, setRevenueData] = useState([])
  const [classStatusList, setClassStatusList] = useState([])
  const [paymentsList, setPaymentsList] = useState([])

  // Loading states
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [exportingPdfId, setExportingPdfId] = useState(null)

  // Feedback states
  const [errorMessage, setErrorMessage] = useState(null)
  const [hasReportError, setHasReportError] = useState(false)
  const [successMessage, setSuccessMessage] = useState(null)

  // Filter states - Class status
  const [classSearch, setClassSearch] = useState('')
  const [classFillFilter, setClassFillFilter] = useState('all') // all, high, medium, low
  const [classSort, setClassSort] = useState('fillDesc')

  // Filter states - Payments
  const [paymentSearch, setPaymentSearch] = useState('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all')

  // Auto-dismiss success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  // Load initial overview & revenue
  async function loadInitialData(showSpinner = true) {
    if (showSpinner) setLoading(true)
    else setRefreshing(true)
    setErrorMessage(null)
    setHasReportError(false)

    try {
      const [overviewRes, revenueRes] = await Promise.all([
        getDashboardOverview(),
        getRevenueByYear(selectedYear),
      ])
      setOverview(overviewRes)
      setRevenueData(revenueRes)
    } catch (err) {
      setHasReportError(true)
      setErrorMessage(getReportErrorMessage(err))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Load class status data
  async function loadClassStatus(showSpinner = true) {
    if (showSpinner) setLoadingClasses(true)
    try {
      const data = await getClassStatusReport()
      setClassStatusList(data)
    } catch (err) {
      setErrorMessage(getReportErrorMessage(err, 'Không thể tải báo cáo lớp học.'))
    } finally {
      setLoadingClasses(false)
    }
  }

  // Load payments data
  async function loadPayments(showSpinner = true) {
    if (showSpinner) setLoadingPayments(true)
    try {
      const data = await getPaymentsReport()
      setPaymentsList(data)
    } catch (err) {
      setErrorMessage(getReportErrorMessage(err, 'Không thể tải danh sách giao dịch.'))
    } finally {
      setLoadingPayments(false)
    }
  }

  // Refresh current view data
  function handleRefresh() {
    loadInitialData(false)
    if (activeTab === 'class-status') loadClassStatus(false)
    if (activeTab === 'payments') loadPayments(false)
  }

  // Effect when year changes
  useEffect(() => {
    loadInitialData(true)
  }, [selectedYear])

  // Effect when switching tabs
  useEffect(() => {
    if (activeTab === 'class-status' && classStatusList.length === 0) {
      loadClassStatus(true)
    } else if (activeTab === 'payments' && paymentsList.length === 0) {
      loadPayments(true)
    }
  }, [activeTab])

  // Export QuestPDF single invoice
  async function handleExportInvoice(payment) {
    if (!payment?.id) return
    if (payment.status !== 'Completed') {
      setErrorMessage('Chỉ có thể xuất hóa đơn PDF cho giao dịch có trạng thái Hoàn tất (Completed).')
      return
    }

    setExportingPdfId(payment.id)
    setErrorMessage(null)

    try {
      const blob = await exportInvoicePdf(payment.id)
      const filename = `HoaDon_${payment.transactionReference || payment.id}.pdf`
      triggerBlobDownload(blob, filename)
      setSuccessMessage(`Đã xuất hóa đơn PDF "${filename}" thành công!`)
    } catch (err) {
      setErrorMessage(getReportErrorMessage(err, 'Không thể tạo file PDF hóa đơn.'))
    } finally {
      setExportingPdfId(null)
    }
  }

  // Calculations for selected year revenue
  const yearStats = useMemo(() => {
    if (!revenueData || revenueData.length === 0) {
      return { totalYear: 0, maxMonth: null, minMonth: null, avgMonth: 0, maxRevenue: 0 }
    }

    let total = 0
    let max = -1
    let maxObj = null
    let min = Infinity
    let minObj = null

    revenueData.forEach((item) => {
      const val = Number(item.revenue) || 0
      total += val
      if (val > max) {
        max = val
        maxObj = item
      }
      if (val < min) {
        min = val
        minObj = item
      }
    })

    const avg = total / (revenueData.length || 1)
    return {
      totalYear: total,
      maxMonth: maxObj,
      minMonth: minObj,
      avgMonth: avg,
      maxRevenue: max > 0 ? max : 1,
    }
  }, [revenueData])

  // Filtered & sorted class status list
  const filteredClasses = useMemo(() => {
    return classStatusList
      .filter((cls) => {
        const matchesSearch =
          cls.className.toLowerCase().includes(classSearch.toLowerCase().trim()) ||
          cls.coachName.toLowerCase().includes(classSearch.toLowerCase().trim())

        if (!matchesSearch) return false

        const rate = Number(cls.fillRatePercentage) || 0
        if (classFillFilter === 'high') return rate >= 80
        if (classFillFilter === 'medium') return rate >= 50 && rate < 80
        if (classFillFilter === 'low') return rate < 50
        return true
      })
      .sort((a, b) => {
        const rateA = Number(a.fillRatePercentage) || 0
        const rateB = Number(b.fillRatePercentage) || 0
        if (classSort === 'fillDesc') return rateB - rateA
        if (classSort === 'fillAsc') return rateA - rateB
        if (classSort === 'regDesc') return b.totalRegistration - a.totalRegistration
        if (classSort === 'nameAsc') return a.className.localeCompare(b.className)
        return 0
      })
  }, [classStatusList, classSearch, classFillFilter, classSort])

  // Overall class metrics
  const classOverallStats = useMemo(() => {
    if (!classStatusList || classStatusList.length === 0) {
      return { avgFill: 0, highCount: 0, mediumCount: 0, lowCount: 0, totalCapacity: 0, totalRegistered: 0 }
    }

    let totalRate = 0
    let high = 0
    let medium = 0
    let low = 0
    let cap = 0
    let reg = 0

    classStatusList.forEach((cls) => {
      const rate = Number(cls.fillRatePercentage) || 0
      totalRate += rate
      if (rate >= 80) high++
      else if (rate >= 50) medium++
      else low++

      cap += Number(cls.maxCapacity) || 0
      reg += Number(cls.totalRegistration) || 0
    })

    return {
      avgFill: (totalRate / classStatusList.length).toFixed(1),
      highCount: high,
      mediumCount: medium,
      lowCount: low,
      totalCapacity: cap,
      totalRegistered: reg,
    }
  }, [classStatusList])

  // Filtered payments list
  const filteredPayments = useMemo(() => {
    return paymentsList.filter((p) => {
      const matchesSearch =
        !paymentSearch ||
        String(p.id).includes(paymentSearch.trim()) ||
        String(p.memberId).includes(paymentSearch.trim()) ||
        (p.transactionReference && p.transactionReference.toLowerCase().includes(paymentSearch.toLowerCase().trim())) ||
        (p.paymentMethod && p.paymentMethod.toLowerCase().includes(paymentSearch.toLowerCase().trim()))

      if (!matchesSearch) return false

      if (paymentStatusFilter !== 'all' && p.status !== paymentStatusFilter) {
        return false
      }

      return true
    })
  }, [paymentsList, paymentSearch, paymentStatusFilter])

  const availableYears = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3]
  const chartMax = yearStats.maxRevenue * 1.15
  const revenueReady = !loading && !hasReportError
  const hasRevenue = yearStats.totalYear > 0

  return (
    <div className="report-mgmt">
      {/* Header */}
      <div className="report-mgmt-header">
        <div>
          <span className="report-eyebrow">HIỆU QUẢ KINH DOANH</span>
          <h1>Báo cáo & doanh thu</h1>
          <p>Theo dõi doanh thu, hoạt động lớp học và giao dịch của trung tâm.</p>
        </div>
        <div className="report-mgmt-actions">
          <button
            type="button"
            className="report-btn report-btn-secondary"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            title="Làm mới dữ liệu từ máy chủ"
          >
            <RefreshCw size={15} className={refreshing ? 'report-spin' : ''} />
            {refreshing ? 'Đang cập nhật...' : 'Làm mới'}
          </button>
          <button
            type="button"
            className="report-btn report-btn-primary"
            onClick={() => window.print()}
            title="In hoặc lưu PDF trang báo cáo tổng hợp"
          >
            <Printer size={15} />
            <span>In / Xuất PDF</span>
          </button>
        </div>
      </div>

      {/* Notification Alerts */}
      {errorMessage && (
        <div className="report-alert report-alert-danger" role="alert">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            className="report-btn report-btn-secondary"
            onClick={() => setErrorMessage(null)}
            style={{ padding: '4px 10px', fontSize: 11 }}
          >
            Đóng
          </button>
        </div>
      )}

      {successMessage && (
        <div className="report-alert report-alert-success" role="status">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={18} />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            className="report-btn report-btn-secondary"
            onClick={() => setSuccessMessage(null)}
            style={{ padding: '4px 10px', fontSize: 11 }}
          >
            Đóng
          </button>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="report-metrics-grid">
        <div className="report-metric-card report-metric-featured">
          <div className="report-metric-top">
            <span className="report-metric-label">Tổng doanh thu hệ thống</span>
            <span className="report-metric-icon green">
              <DollarSign size={20} />
            </span>
          </div>
          <div className="report-metric-value">
            {overview ? formatVND(overview.totalRevenue) : loading ? 'Đang tải...' : '—'}
          </div>
          <p className="report-metric-note">
            <CheckCircle2 size={13} color="var(--manager-success, #059669)" />
            Lũy kế từ các hóa đơn hoàn tất
          </p>
        </div>

        <div className="report-metric-card">
          <div className="report-metric-top">
            <span className="report-metric-label">Doanh thu tháng này</span>
            <span className="report-metric-icon blue">
              <CreditCard size={20} />
            </span>
          </div>
          <div className="report-metric-value">
            {overview ? formatVND(overview.currentMonthRevenue) : loading ? 'Đang tải...' : '—'}
          </div>
          <p className="report-metric-note">
            <Clock3 size={13} color="var(--manager-info, #2563eb)" />
            Tháng {new Date().getMonth() + 1}/{new Date().getFullYear()}
          </p>
        </div>

        <div className="report-metric-card">
          <div className="report-metric-top">
            <span className="report-metric-label">Hội viên đang hoạt động</span>
            <span className="report-metric-icon purple">
              <Users size={20} />
            </span>
          </div>
          <div className="report-metric-value">
            {overview ? overview.totalActiveMembers : loading ? '...' : '—'}
            <small>thành viên</small>
          </div>
          <p className="report-metric-note">
            <CheckCircle2 size={13} color="var(--manager-purple, #7c3aed)" />
            Hội viên có tài khoản hoạt động
          </p>
        </div>

        <div className="report-metric-card">
          <div className="report-metric-top">
            <span className="report-metric-label">Lớp học đang mở</span>
            <span className="report-metric-icon amber">
              <Layers size={20} />
            </span>
          </div>
          <div className="report-metric-value">
            {overview ? overview.totalActiveClasses : loading ? '...' : '—'}
            <small>lớp học</small>
          </div>
          <p className="report-metric-note">
            <Calendar size={13} color="var(--manager-warning, #d97706)" />
            Lớp thể thao còn hạn đào tạo
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="report-tabs" aria-label="Loại báo cáo">
        <button
          type="button"
          className={`report-tab-btn ${activeTab === 'revenue' ? 'active' : ''}`}
          onClick={() => setActiveTab('revenue')}
          aria-pressed={activeTab === 'revenue'}
        >
          <BarChart3 size={16} />
          Doanh thu
        </button>
        <button
          type="button"
          className={`report-tab-btn ${activeTab === 'class-status' ? 'active' : ''}`}
          onClick={() => setActiveTab('class-status')}
          aria-pressed={activeTab === 'class-status'}
        >
          <Percent size={16} />
          Hoạt động lớp học
          {classStatusList.length > 0 && (
            <span className="report-tab-badge">{classStatusList.length}</span>
          )}
        </button>
        <button
          type="button"
          className={`report-tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => setActiveTab('payments')}
          aria-pressed={activeTab === 'payments'}
        >
          <FileText size={16} />
          Giao dịch & hóa đơn
          {paymentsList.length > 0 && (
            <span className="report-tab-badge">{paymentsList.length}</span>
          )}
        </button>
      </div>

      {/* Tab 1: Báo cáo Doanh thu */}
      {activeTab === 'revenue' && (
        <div className="report-section report-revenue-section" aria-busy={loading || refreshing}>
          {/* Toolbar */}
          <div className="report-revenue-toolbar">
            <div>
              <h2>Tổng quan doanh thu</h2>
              <p>Phân tích kết quả kinh doanh theo từng tháng trong năm.</p>
            </div>
            <div className="report-year-picker">
              <Calendar size={16} aria-hidden="true" />
              <label htmlFor="revenue-year-select">Năm báo cáo</label>
              <select
                id="revenue-year-select"
                className="report-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    Năm {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="report-year-summary">
            <article className="report-year-stat">
              <span className="report-year-stat-label"><BarChart3 size={16} /> Doanh thu năm {selectedYear}</span>
              <strong>{revenueReady ? formatVND(yearStats.totalYear) : '—'}</strong>
              <small>Tổng doanh thu ghi nhận trong năm</small>
            </article>
            <article className="report-year-stat">
              <span className="report-year-stat-label"><Calendar size={16} /> Trung bình mỗi tháng</span>
              <strong>{revenueReady ? formatVND(Math.round(yearStats.avgMonth)) : '—'}</strong>
              <small>Tính trên {revenueReady ? revenueData.length : '—'} tháng có dữ liệu báo cáo</small>
            </article>
            <article className="report-year-stat report-year-stat-peak">
              <span className="report-year-stat-label"><Award size={16} /> Tháng có doanh thu cao nhất</span>
              <strong>{revenueReady && hasRevenue ? formatVND(yearStats.maxMonth.revenue) : '—'}</strong>
              <small>{!revenueReady ? 'Đang chờ dữ liệu báo cáo' : hasRevenue ? `Tháng ${yearStats.maxMonth.month}/${selectedYear}` : 'Chưa ghi nhận doanh thu'}</small>
            </article>
          </div>

          {/* Biểu đồ cột 12 tháng */}
          <div className="report-chart-card">
            <div className="report-chart-header">
              <div>
                <h3>Doanh thu theo tháng</h3>
                <p>Doanh thu từ các giao dịch thanh toán gói tập và dịch vụ · {selectedYear}</p>
              </div>
              <div className="report-chart-legend">
                <span><i /> Doanh thu</span>
                <span><i className="report-legend-peak" /> Cao nhất</span>
              </div>
            </div>

            {loading ? (
              <div className="report-loading-box" role="status">
                <RefreshCw size={28} className="report-spin" />
                <span>Đang tổng hợp dữ liệu doanh thu năm {selectedYear}...</span>
              </div>
            ) : hasReportError ? (
              <div className="report-empty-box">
                <AlertCircle size={32} />
                <p>Chưa thể hiển thị báo cáo. Vui lòng thử làm mới dữ liệu.</p>
              </div>
            ) : !hasRevenue ? (
              <div className="report-empty-box">
                <BarChart3 size={32} />
                <p>Không có dữ liệu giao dịch cho năm {selectedYear}.</p>
              </div>
            ) : (
              <div className="report-chart-scroll" role="region" aria-label={`Biểu đồ doanh thu năm ${selectedYear}, cuộn ngang để xem đủ các tháng`} tabIndex={0}>
                <div className="report-chart-bars-wrap">
                  <div className="report-chart-axis" aria-hidden="true">
                    {[1, 0.75, 0.5, 0.25, 0].map((step) => <span key={step}>{formatChartValue(chartMax * step)}</span>)}
                  </div>
                  <div className="report-bars-container">
                    {revenueData.map((item) => {
                      const rev = Number(item.revenue) || 0
                      const heightPercent = (rev / chartMax) * 100
                      const isMax = yearStats.maxMonth && yearStats.maxMonth.month === item.month && rev > 0
                      const isCurrentMonth =
                        selectedYear === currentYear && item.month === new Date().getMonth() + 1

                      return (
                        <div
                          key={item.month}
                          className={`report-bar-col ${isCurrentMonth ? 'current' : ''}`}
                          tabIndex={0}
                          aria-label={`Tháng ${item.month}: ${formatVND(rev)}${isMax ? ', doanh thu cao nhất' : ''}`}
                        >
                          <div className="report-bar-tooltip" aria-hidden="true">
                            Tháng {item.month}: {formatVND(rev)}
                            {yearStats.totalYear > 0 && (
                              <span> ({Math.round((rev / yearStats.totalYear) * 100)}%)</span>
                            )}
                          </div>
                          <div className="report-bar-col-track">
                            <div
                              className={`report-bar-fill ${isMax ? 'highlight' : ''} ${rev === 0 ? 'zero' : ''}`}
                              style={{ height: `${heightPercent}%` }}
                            />
                          </div>
                          <span className="report-bar-label">
                            T{item.month}
                            {isCurrentMonth && ' •'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
            <div className="report-chart-footer">
              <span>Đơn vị: VNĐ</span>
              <span>Chi tiết từng tháng được liệt kê bên dưới</span>
            </div>
          </div>

          {/* Bảng chi tiết 12 tháng */}
          <div className="report-table-card report-revenue-table-card">
            <div className="report-table-header">
              <div>
                <h3>Chi tiết doanh thu</h3>
                <p>So sánh doanh thu và tỷ trọng đóng góp của từng tháng.</p>
              </div>
              <span className="report-badge info">Năm {selectedYear}</span>
            </div>
            {loading ? (
              <div className="report-loading-box" role="status"><RefreshCw size={24} className="report-spin" /><span>Đang tải chi tiết doanh thu...</span></div>
            ) : hasReportError || revenueData.length === 0 ? (
              <div className="report-empty-box"><FileText size={28} /><p>Chưa có dữ liệu chi tiết để hiển thị.</p></div>
            ) : (
              <div className="report-table-scroll" role="region" aria-label="Chi tiết doanh thu theo tháng, cuộn ngang để xem đầy đủ" tabIndex={0}>
                <table className="report-table report-revenue-table">
                  <thead>
                    <tr>
                      <th>Tháng / Năm</th>
                      <th className="report-numeric">Doanh thu</th>
                      <th>Tỷ trọng trong năm</th>
                      <th className="report-numeric">So với trung bình</th>
                      <th>Đánh giá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueData.map((item) => {
                      const rev = Number(item.revenue) || 0
                      const share = yearStats.totalYear > 0
                        ? Math.round((rev / yearStats.totalYear) * 100)
                        : 0
                      const diffFromAvg = yearStats.avgMonth > 0
                        ? Math.round(((rev - yearStats.avgMonth) / yearStats.avgMonth) * 100)
                        : 0

                      return (
                        <tr key={item.month} className={item === yearStats.maxMonth && rev > 0 ? 'report-peak-row' : ''}>
                          <td>
                            <strong>Tháng {String(item.month).padStart(2, '0')}/{item.year}</strong>
                          </td>
                          <td className="report-numeric">
                            <span style={{ fontWeight: 600, color: rev > 0 ? 'var(--manager-ink, #18263e)' : 'var(--manager-secondary, #94a3b8)' }}>
                              {formatVND(rev)}
                            </span>
                          </td>
                          <td>
                            <div className="report-share-cell">
                              <div className="report-progress-track">
                                <div
                                  className="report-progress-fill blue"
                                  style={{ width: `${Math.min(share, 100)}%` }}
                                />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 600 }}>{share}%</span>
                            </div>
                          </td>
                          <td className="report-numeric">
                            {rev === 0 ? (
                              <span style={{ color: 'var(--manager-secondary, #94a3b8)', fontSize: 12 }}>Chưa có thu</span>
                            ) : diffFromAvg >= 0 ? (
                              <span style={{ color: 'var(--manager-success, #059669)', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <TrendingUp size={13} /> +{diffFromAvg}%
                              </span>
                            ) : (
                              <span style={{ color: 'var(--manager-danger, #dc2626)', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <TrendingDown size={13} /> {diffFromAvg}%
                              </span>
                            )}
                          </td>
                          <td>
                            {item === yearStats.maxMonth && rev > 0 ? (
                              <span className="report-badge success">Tháng cao điểm</span>
                            ) : rev >= yearStats.avgMonth && rev > 0 ? (
                              <span className="report-badge info">Trên / bằng trung bình</span>
                            ) : rev > 0 ? (
                              <span className="report-badge warning">Dưới trung bình</span>
                            ) : (
                              <span className="report-badge" style={{ background: 'var(--manager-raised, #f1f5f9)', color: 'var(--manager-secondary, #64748b)' }}>
                                Không có dữ liệu
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>TỔNG DOANH THU NĂM {selectedYear}</td>
                      <td className="report-numeric" style={{ color: 'var(--manager-success, #059669)', fontSize: 15 }}>
                        {formatVND(yearStats.totalYear)}
                      </td>
                      <td colSpan={3} style={{ color: 'var(--manager-muted, #748096)' }}>
                        Trung bình: {formatVND(Math.round(yearStats.avgMonth))}/tháng
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Hoạt động lớp học & Tỷ lệ lấp đầy */}
      {activeTab === 'class-status' && (
        <div className="report-section">
          {/* Summary insights chips */}
          <div className="report-revenue-toolbar">
            <div className="report-summary-chips" style={{ width: '100%', justifyContent: 'space-between' }}>
              <span className="report-chip blue">
                Tỷ lệ lấp đầy trung bình: <strong>{classOverallStats.avgFill}%</strong>
              </span>
              <span className="report-chip green">
                Lớp đầy / Tốt (≥80%): <strong>{classOverallStats.highCount} lớp</strong>
              </span>
              <span className="report-chip amber">
                Lớp ổn định (50-79%): <strong>{classOverallStats.mediumCount} lớp</strong>
              </span>
              <span className="report-chip" style={{ background: 'var(--manager-danger-bg, #fef2f2)', color: 'var(--manager-danger, #b91c1c)' }}>
                Cần tối ưu (&lt;50%): <strong>{classOverallStats.lowCount} lớp</strong>
              </span>
              <span className="report-chip" style={{ background: 'var(--manager-raised, #f8fafc)', color: 'var(--manager-ink, #18263e)' }}>
                Tổng học viên: <strong>{classOverallStats.totalRegistered} / {classOverallStats.totalCapacity} chỗ</strong>
              </span>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="report-class-filter-bar">
            <div className="report-search-box">
              <Search size={16} color="var(--manager-muted, #748096)" />
              <input
                type="text"
                placeholder="Tìm theo tên lớp học, huấn luyện viên..."
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
              />
            </div>

            <div className="report-filter-group">
              <select
                className="report-select"
                value={classFillFilter}
                onChange={(e) => setClassFillFilter(e.target.value)}
              >
                <option value="all">Tất cả tỷ lệ lấp đầy</option>
                <option value="high">Đầy lớp / Sắp đầy (≥ 80%)</option>
                <option value="medium">Ổn định (50% – 79%)</option>
                <option value="low">Sĩ số thấp / Cần tối ưu (&lt; 50%)</option>
              </select>

              <select
                className="report-select"
                value={classSort}
                onChange={(e) => setClassSort(e.target.value)}
              >
                <option value="fillDesc">Lấp đầy cao nhất</option>
                <option value="fillAsc">Lấp đầy thấp nhất</option>
                <option value="regDesc">Số học viên nhiều nhất</option>
                <option value="nameAsc">Tên lớp học A-Z</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="report-table-card">
            <div className="report-table-header">
              <h4>Báo cáo hoạt động & Tỷ lệ lấp đầy từng lớp học</h4>
              <span className="report-badge info">
                {filteredClasses.length} / {classStatusList.length} lớp học
              </span>
            </div>

            {loadingClasses ? (
              <div className="report-loading-box">
                <RefreshCw size={28} className="report-spin" />
                <span>Đang thống kê sĩ số và tỷ lệ lấp đầy các lớp học...</span>
              </div>
            ) : filteredClasses.length === 0 ? (
              <div className="report-empty-box">
                <Layers size={32} />
                <p>Không tìm thấy lớp học nào phù hợp với bộ lọc.</p>
              </div>
            ) : (
              <div className="report-table-scroll">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Lớp học</th>
                      <th>Huấn luyện viên</th>
                      <th>Đăng ký / Sức chứa</th>
                      <th>Tỷ lệ lấp đầy</th>
                      <th>Trạng thái</th>
                      <th>Đề xuất tối ưu hóa lịch học</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClasses.map((cls) => {
                      const rate = Number(cls.fillRatePercentage) || 0
                      const fillTone = rate >= 80 ? 'green' : rate >= 50 ? 'amber' : 'red'

                      return (
                        <tr key={cls.classId}>
                          <td>
                            <strong>{cls.className}</strong>
                            <div style={{ fontSize: 11, color: 'var(--manager-muted, #748096)' }}>
                              Mã lớp: #{cls.classId}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <UserCheck size={14} color="var(--manager-secondary, #64748b)" />
                              <span>{cls.coachName || 'Chưa gán HLV'}</span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>
                              {cls.totalRegistration}
                            </span>
                            <span style={{ color: 'var(--manager-muted, #748096)' }}>
                              {' '}/ {cls.maxCapacity} học viên
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div className="report-progress-track">
                                <div
                                  className={`report-progress-fill ${fillTone}`}
                                  style={{ width: `${Math.min(rate, 100)}%` }}
                                />
                              </div>
                              <strong style={{ fontSize: 13 }}>{rate}%</strong>
                            </div>
                          </td>
                          <td>
                            {rate >= 90 ? (
                              <span className="report-badge success">Đã đầy lớp</span>
                            ) : rate >= 80 ? (
                              <span className="report-badge success">Gần kín</span>
                            ) : rate >= 50 ? (
                              <span className="report-badge warning">Ổn định</span>
                            ) : (
                              <span className="report-badge danger">Sĩ số thấp</span>
                            )}
                          </td>
                          <td>
                            {rate >= 90 ? (
                              <span className="report-suggestion-pill green">
                                <Zap size={12} /> Xem xét mở thêm lớp hoặc tăng giới hạn
                              </span>
                            ) : rate >= 80 ? (
                              <span className="report-suggestion-pill green">
                                <Check size={12} /> Duy trì lịch học hiện tại
                              </span>
                            ) : rate >= 50 ? (
                              <span className="report-suggestion-pill amber">
                                <Clock size={12} /> Theo dõi thêm các ca học tiếp theo
                              </span>
                            ) : (
                              <span className="report-suggestion-pill red">
                                <AlertCircle size={12} /> Cần điều chỉnh giờ học / Đẩy mạnh quảng bá
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2}>TỔNG SỐ HỌC VIÊN ĐANG THEO HỌC</td>
                      <td style={{ fontWeight: 700, color: 'var(--manager-ink, #18263e)' }}>
                        {classOverallStats.totalRegistered} / {classOverallStats.totalCapacity}
                      </td>
                      <td colSpan={3} style={{ color: 'var(--manager-blue, #2463eb)', fontWeight: 700 }}>
                        Tỷ lệ lấp đầy trung bình toàn trung tâm: {classOverallStats.avgFill}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Lịch sử giao dịch & Hóa đơn QuestPDF */}
      {activeTab === 'payments' && (
        <div className="report-section">
          {/* Filter Bar */}
          <div className="report-class-filter-bar">
            <div className="report-search-box">
              <Search size={16} color="var(--manager-muted, #748096)" />
              <input
                type="text"
                placeholder="Tìm mã thanh toán, mã tham chiếu, phương thức..."
                value={paymentSearch}
                onChange={(e) => setPaymentSearch(e.target.value)}
              />
            </div>

            <div className="report-filter-group">
              <select
                className="report-select"
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
              >
                <option value="all">Tất cả trạng thái giao dịch</option>
                <option value="Completed">Hoàn tất (Completed)</option>
                <option value="Pending">Đang xử lý (Pending)</option>
                <option value="Cancelled">Đã hủy (Cancelled)</option>
                <option value="Failed">Thất bại (Failed)</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="report-table-card">
            <div className="report-table-header">
              <div>
                <h4>Danh sách giao dịch thanh toán</h4>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--manager-muted, #748096)' }}>
                  Tra cứu thanh toán và tải hóa đơn PDF cho các giao dịch đã hoàn tất.
                </p>
              </div>
              <span className="report-badge info">
                {filteredPayments.length} / {paymentsList.length} giao dịch
              </span>
            </div>

            {loadingPayments ? (
              <div className="report-loading-box">
                <RefreshCw size={28} className="report-spin" />
                <span>Đang tải lịch sử giao dịch từ hệ thống...</span>
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="report-empty-box">
                <CreditCard size={32} />
                <p>Không tìm thấy giao dịch thanh toán nào phù hợp.</p>
              </div>
            ) : (
              <div className="report-table-scroll">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Mã giao dịch</th>
                      <th>Ngày thanh toán</th>
                      <th>Số tiền</th>
                      <th>Thực thu</th>
                      <th>Phương thức</th>
                      <th>Trạng thái</th>
                      <th style={{ textAlign: 'right' }}>Hóa đơn PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((p) => {
                      const isCompleted = p.status === 'Completed'
                      const isExporting = exportingPdfId === p.id

                      return (
                        <tr key={p.id}>
                          <td>
                            <strong>#{p.id}</strong>
                            {p.transactionReference && (
                              <div style={{ fontSize: 11, color: 'var(--manager-muted, #748096)' }}>
                                Ref: {p.transactionReference}
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Clock3 size={13} color="var(--manager-secondary, #64748b)" />
                              <span>{formatDate(p.paidAt || p.createdAt)}</span>
                            </div>
                          </td>
                          <td>
                            <strong style={{ color: 'var(--manager-ink, #18263e)' }}>
                              {formatVND(p.amount)}
                            </strong>
                          </td>
                          <td>
                            <span style={{ color: p.amountReceived > 0 ? 'var(--manager-success, #059669)' : 'var(--manager-secondary, #94a3b8)', fontWeight: 600 }}>
                              {formatVND(p.amountReceived > 0 ? p.amountReceived : p.amount)}
                            </span>
                          </td>
                          <td>
                            <span className="report-chip" style={{ background: 'var(--manager-raised, #f1f5f9)', color: 'var(--manager-secondary, #475569)', fontSize: 11 }}>
                              {p.paymentMethod || 'PayOS / Online'}
                            </span>
                          </td>
                          <td>
                            {p.status === 'Completed' ? (
                              <span className="report-badge success">
                                <CheckCircle2 size={12} /> Hoàn tất
                              </span>
                            ) : p.status === 'Pending' ? (
                              <span className="report-badge warning">
                                <Clock3 size={12} /> Đang chờ
                              </span>
                            ) : p.status === 'Cancelled' ? (
                              <span className="report-badge danger">
                                <XCircle size={12} /> Đã hủy
                              </span>
                            ) : (
                              <span className="report-badge" style={{ background: 'var(--manager-raised, #f1f5f9)', color: 'var(--manager-secondary, #64748b)' }}>
                                {p.status}
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="report-invoice-btn"
                              disabled={!isCompleted || isExporting}
                              onClick={() => handleExportInvoice(p)}
                              title={
                                isCompleted
                                  ? 'Tải hóa đơn PDF của giao dịch'
                                  : 'Chỉ xuất hóa đơn cho giao dịch hoàn tất'
                              }
                            >
                              {isExporting ? (
                                <>
                                  <RefreshCw size={13} className="report-spin" />
                                  <span>Đang tạo PDF...</span>
                                </>
                              ) : (
                                <>
                                  <FileDown size={13} />
                                  <span>Xuất PDF</span>
                                </>
                              )}
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
    </div>
  )
}
