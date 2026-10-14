import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowDownToLine,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock3,
  CreditCard,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Layers,
  LineChart,
  Percent,
  PieChart,
  Printer,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  getDashboardOverview,
  getReportErrorMessage,
  getRevenueByYear,
} from '../../services/reportService'
import '../../style/CenterManager/ReportManagement.css'

function formatVND(value) {
  const number = Number(value) || 0
  return number.toLocaleString('vi-VN') + ' ₫'
}

export default function ReportManagement() {
  const currentYear = new Date().getFullYear()

  // State overview & revenue
  const [activeTab, setActiveTab] = useState('revenue')
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [overview, setOverview] = useState(null)
  const [revenueData, setRevenueData] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)

  // Fetch overview & revenue data
  async function loadData(showSpinner = true) {
    if (showSpinner) setLoading(true)
    else setRefreshing(true)
    setErrorMessage(null)

    try {
      const [overviewRes, revenueRes] = await Promise.all([
        getDashboardOverview(),
        getRevenueByYear(selectedYear),
      ])
      setOverview(overviewRes)
      setRevenueData(revenueRes)
    } catch (err) {
      setErrorMessage(getReportErrorMessage(err))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Load when selectedYear changes
  useEffect(() => {
    loadData(true)
  }, [selectedYear])

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

  const availableYears = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3]

  return (
    <div className="report-mgmt">
      {/* Header */}
      <div className="report-mgmt-header">
        <div>
          <h2>
            <TrendingUp size={22} color="var(--manager-blue, #2463eb)" />
            Báo cáo thống kê & Doanh thu
          </h2>
          <p>Dữ liệu thời gian thực từ hệ thống thanh toán, gói hội viên và tình trạng lớp học.</p>
        </div>
        <div className="report-mgmt-actions">
          <button
            type="button"
            className="report-btn report-btn-secondary"
            onClick={() => loadData(false)}
            disabled={loading || refreshing}
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={15} className={refreshing ? 'report-spin' : ''} />
            {refreshing ? 'Đang cập nhật...' : 'Làm mới'}
          </button>
          <button
            type="button"
            className="report-btn report-btn-primary"
            onClick={() => window.print()}
            title="In hoặc lưu PDF trang báo cáo"
          >
            <Printer size={15} />
            In báo cáo
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="report-alert report-alert-danger">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            className="report-btn report-btn-secondary"
            onClick={() => loadData(true)}
            style={{ padding: '4px 10px', fontSize: 11 }}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="report-metrics-grid">
        <div className="report-metric-card">
          <div className="report-metric-top">
            <span className="report-metric-label">Tổng doanh thu hệ thống</span>
            <span className="report-metric-icon green">
              <DollarSign size={20} />
            </span>
          </div>
          <div className="report-metric-value">
            {overview ? formatVND(overview.totalRevenue) : '...'}
          </div>
          <p className="report-metric-note">
            <CheckCircle2 size={13} color="#059669" />
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
            {overview ? formatVND(overview.currentMonthRevenue) : '...'}
          </div>
          <p className="report-metric-note">
            <Clock3 size={13} color="#2563eb" />
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
            {overview ? overview.totalActiveMembers : '...'}
            <small>thành viên</small>
          </div>
          <p className="report-metric-note">
            <CheckCircle2 size={13} color="#7c3aed" />
            Tài khoản hội viên Active
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
            {overview ? overview.totalActiveClasses : '...'}
            <small>lớp học</small>
          </div>
          <p className="report-metric-note">
            <Calendar size={13} color="#d97706" />
            Lớp thể thao còn hạn đào tạo
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="report-tabs">
        <button
          type="button"
          className={`report-tab-btn ${activeTab === 'revenue' ? 'active' : ''}`}
          onClick={() => setActiveTab('revenue')}
        >
          <BarChart3 size={16} />
          Báo cáo doanh thu theo tháng
          <span className="report-tab-badge">Năm {selectedYear}</span>
        </button>
        <button
          type="button"
          className={`report-tab-btn ${activeTab === 'class-status' ? 'active' : ''}`}
          onClick={() => setActiveTab('class-status')}
        >
          <Percent size={16} />
          Tỷ lệ lấp đầy & Sĩ số lớp
        </button>
        <button
          type="button"
          className={`report-tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => setActiveTab('payments')}
        >
          <FileText size={16} />
          Lịch sử giao dịch & Hóa đơn PDF
        </button>
      </div>

      {/* Tab 1: Báo cáo Doanh thu */}
      {activeTab === 'revenue' && (
        <div className="report-section">
          {/* Toolbar */}
          <div className="report-revenue-toolbar">
            <div className="report-year-picker">
              <label htmlFor="revenue-year-select">Chọn năm báo cáo:</label>
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

            <div className="report-summary-chips">
              <span className="report-chip blue">
                Tổng năm {selectedYear}: <strong>{formatVND(yearStats.totalYear)}</strong>
              </span>
              <span className="report-chip green">
                Tháng cao nhất:{' '}
                <strong>
                  {yearStats.maxMonth ? `T${yearStats.maxMonth.month} (${formatVND(yearStats.maxMonth.revenue)})` : 'N/A'}
                </strong>
              </span>
              <span className="report-chip amber">
                Trung bình:{' '}
                <strong>{formatVND(Math.round(yearStats.avgMonth))}/tháng</strong>
              </span>
            </div>
          </div>

          {/* Biểu đồ cột 12 tháng */}
          <div className="report-chart-card">
            <div className="report-chart-header">
              <div>
                <h3>Biểu đồ dòng tiền 12 tháng — Năm {selectedYear}</h3>
                <p>Mức thu thực tế ghi nhận từ các giao dịch thanh toán gói tập và dịch vụ.</p>
              </div>
              <span className="report-badge info">
                Đơn vị: VNĐ
              </span>
            </div>

            {loading ? (
              <div className="report-loading-box">
                <RefreshCw size={28} className="report-spin" />
                <span>Đang tổng hợp dữ liệu doanh thu năm {selectedYear}...</span>
              </div>
            ) : revenueData.length === 0 ? (
              <div className="report-empty-box">
                <BarChart3 size={32} />
                <p>Không có dữ liệu giao dịch cho năm {selectedYear}.</p>
              </div>
            ) : (
              <div className="report-chart-bars-wrap">
                <div className="report-bars-container">
                  {revenueData.map((item) => {
                    const rev = Number(item.revenue) || 0
                    const heightPercent = yearStats.maxRevenue > 0
                      ? Math.max(Math.round((rev / yearStats.maxRevenue) * 100), rev > 0 ? 6 : 0)
                      : 0
                    const isMax = yearStats.maxMonth && yearStats.maxMonth.month === item.month && rev > 0
                    const isCurrentMonth =
                      selectedYear === currentYear && item.month === new Date().getMonth() + 1

                    return (
                      <div
                        key={item.month}
                        className={`report-bar-col ${isCurrentMonth ? 'current' : ''}`}
                      >
                        <div className="report-bar-tooltip">
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
            )}
          </div>

          {/* Bảng chi tiết 12 tháng */}
          <div className="report-table-card">
            <div className="report-table-header">
              <h4>Bảng kê khai chi tiết doanh thu theo tháng</h4>
              <span className="report-badge info">{revenueData.length} tháng</span>
            </div>
            <div className="report-table-scroll">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Tháng / Năm</th>
                    <th>Doanh thu ghi nhận</th>
                    <th>Tỷ trọng đóng góp</th>
                    <th>So với trung bình tháng</th>
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
                      <tr key={item.month}>
                        <td>
                          <strong>Tháng {String(item.month).padStart(2, '0')}/{item.year}</strong>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: rev > 0 ? 'var(--manager-ink, #18263e)' : '#94a3b8' }}>
                            {formatVND(rev)}
                          </span>
                        </td>
                        <td>
                          <div className="report-progress-track">
                            <div
                              className="report-progress-fill blue"
                              style={{ width: `${Math.min(share, 100)}%` }}
                            />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{share}%</span>
                        </td>
                        <td>
                          {rev === 0 ? (
                            <span style={{ color: '#94a3b8', fontSize: 12 }}>Chưa có thu</span>
                          ) : diffFromAvg >= 0 ? (
                            <span style={{ color: '#059669', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <TrendingUp size={13} /> +{diffFromAvg}%
                            </span>
                          ) : (
                            <span style={{ color: '#dc2626', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <TrendingDown size={13} /> {diffFromAvg}%
                            </span>
                          )}
                        </td>
                        <td>
                          {item === yearStats.maxMonth && rev > 0 ? (
                            <span className="report-badge success">Tháng cao điểm</span>
                          ) : rev >= yearStats.avgMonth && rev > 0 ? (
                            <span className="report-badge info">Đạt kỳ vọng</span>
                          ) : rev > 0 ? (
                            <span className="report-badge warning">Dưới trung bình</span>
                          ) : (
                            <span className="report-badge" style={{ background: '#f1f5f9', color: '#64748b' }}>
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
                    <td colSpan={2} style={{ color: '#059669', fontSize: 15 }}>
                      {formatVND(yearStats.totalYear)}
                    </td>
                    <td colSpan={2} style={{ color: 'var(--manager-muted, #748096)' }}>
                      Trung bình: {formatVND(Math.round(yearStats.avgMonth))}/tháng
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Placeholder for tabs 2 & 3 in Commit 1 */}
      {activeTab === 'class-status' && (
        <div className="report-section">
          <div className="report-loading-box">
            <Percent size={32} color="#2563eb" />
            <p>Đang chuẩn bị Báo cáo hoạt động lớp học & Tỷ lệ lấp đầy...</p>
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="report-section">
          <div className="report-loading-box">
            <FileText size={32} color="#2563eb" />
            <p>Đang chuẩn bị Lịch sử giao dịch & Xuất PDF QuestPDF...</p>
          </div>
        </div>
      )}
    </div>
  )
}
