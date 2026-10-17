import { useEffect, useState } from 'react'
import {
  CreditCard, Award, CheckCircle2, AlertCircle, LoaderCircle,
  Coins, Trophy, Info, Search, Eye, Sparkles, X, Check,
  ExternalLink, CalendarDays, ShieldCheck, Tag, ArrowRight,
} from 'lucide-react'
import { getMembershipPackages, getMembershipPackageById } from '../../services/membershipPackageService'
import {
  getMySubscriptions,
  createMemberSubscription,
} from '../../services/memberSubscriptionService'
import { createPayment } from '../../services/paymentService'

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')} đ`
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN')
}

export function SubscriptionsView({ showNotice }) {
  const [packages, setPackages] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subscribingId, setSubscribingId] = useState(null)

  // Bộ lọc & tìm kiếm gói tập mở bán
  const [packageSearch, setPackageSearch] = useState('')
  const [packageFilter, setPackageFilter] = useState('all')

  // Modals
  const [viewingPackage, setViewingPackage] = useState(null)
  const [packageDetailLoading, setPackageDetailLoading] = useState(false)
  const [registrationSuccessSub, setRegistrationSuccessSub] = useState(null)
  const [payingSubId, setPayingSubId] = useState(null)

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [pkgs, subs] = await Promise.all([
        getMembershipPackages(),
        getMySubscriptions(),
      ])
      setPackages(Array.isArray(pkgs) ? pkgs : [])
      setSubscriptions(Array.isArray(subs) ? subs : [])
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách gói tập.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Mở modal xem chi tiết gói tập (GET /api/membership-packages/{id})
  const handleOpenPackageDetail = async (pkg) => {
    setPackageDetailLoading(true)
    setViewingPackage(pkg)
    try {
      const detail = await getMembershipPackageById(pkg.id)
      if (detail) {
        setViewingPackage(detail)
      }
    } catch (err) {
      // Dùng dữ liệu sẵn có nếu không gọi được API chi tiết
      console.warn('Lỗi khi tải chi tiết gói:', err)
    } finally {
      setPackageDetailLoading(false)
    }
  }

  // Tự đăng ký gói tập mới (POST /api/member-subscriptions)
  const handleRegister = async (pkg) => {
    setSubscribingId(pkg.id)
    try {
      const sub = await createMemberSubscription(pkg.id)
      if (viewingPackage) {
        setViewingPackage(null)
      }
      setRegistrationSuccessSub(sub)
      if (showNotice) {
        showNotice(`Đăng ký gói "${pkg.packageName}" thành công! Trạng thái: Chờ thanh toán.`)
      }
      // Tải lại danh sách gói cá nhân để cập nhật gói mới tạo
      const updatedSubs = await getMySubscriptions()
      setSubscriptions(Array.isArray(updatedSubs) ? updatedSubs : [])
    } catch (err) {
      alert('Không thể tạo đơn đăng ký: ' + (err.message || 'Lỗi không xác định.'))
    } finally {
      setSubscribingId(null)
    }
  }

  // Chuyển hướng thanh toán PayOS trực tuyến
  const handlePayOSCheckout = async (subId) => {
    setPayingSubId(subId)
    try {
      const pay = await createPayment(subId)
      if (pay?.checkoutUrl) {
        window.location.assign(pay.checkoutUrl)
      } else {
        alert('Đã tạo giao dịch thanh toán nhưng chưa có liên kết PayOS. Vui lòng kiểm tra mục Thanh toán trực tuyến.')
      }
    } catch (err) {
      alert('Không thể khởi tạo thanh toán PayOS: ' + (err.message || 'Lỗi hệ thống'))
    } finally {
      setPayingSubId(null)
    }
  }

  // Lọc danh sách gói tập mở bán
  const filteredPackages = packages.filter(pkg => {
    // Tìm kiếm theo tên hoặc mô tả
    const matchesSearch = !packageSearch.trim() ||
      pkg.packageName?.toLowerCase().includes(packageSearch.toLowerCase()) ||
      pkg.description?.toLowerCase().includes(packageSearch.toLowerCase())

    if (!matchesSearch) return false

    const days = Number(pkg.durationInDays || 0)
    const nameLower = (pkg.packageName || '').toLowerCase()
    const isVip = nameLower.includes('vip') || nameLower.includes('diamond') || nameLower.includes('platinum')

    if (packageFilter === '1m') {
      return days <= 35
    }
    if (packageFilter === '3m') {
      return days > 35 && days <= 100
    }
    if (packageFilter === '6m') {
      return days > 100 && days <= 200
    }
    if (packageFilter === '1y') {
      return days > 200
    }
    if (packageFilter === 'vip') {
      return isVip
    }

    return true
  })

  const activeSub = subscriptions.find(s => String(s.status).toLowerCase() === 'active')

  if (loading) {
    return (
      <div className="member-card member-api-state">
        <LoaderCircle className="member-spin" size={26} />
        <strong>Đang tải gói thẻ hội viên & danh mục mở bán...</strong>
      </div>
    )
  }

  return (
    <div className="member-view-stack">
      {/* Header */}
      <div className="member-section-heading">
        <div>
          <p className="member-eyebrow"><CreditCard size={16} /> MEMBER SUBSCRIPTIONS CONTROLLER</p>
          <h2>Gói tập & Thẻ hội viên</h2>
          <p className="member-muted">
            Tra cứu các gói tập mở bán, tự đăng ký gói mới và theo dõi các gói thẻ hội viên cá nhân của bạn.
          </p>
        </div>
      </div>

      {error && (
        <div className="member-api-message member-api-message--error">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {/* Thẻ gói hiện hành (Active Pass) */}
      {activeSub ? (
        <article className="member-card member-active-pass" style={{ marginBottom: 28 }}>
          <div className="member-pass-heading">
            <div>
              <div className="member-pass-status">
                <span className="member-status"><span />Đang kích hoạt</span>
                <small className="member-muted">#SUB-{activeSub.id}</small>
              </div>
              <h2>{activeSub.packageName}</h2>
              <p className="member-muted">
                Thời hạn gói: {activeSub.durationInDays} ngày · Ngày hết hạn: {formatDate(activeSub.endDate)}
              </p>
            </div>
            <div className="member-expiry">
              <strong>{formatDate(activeSub.endDate)}</strong>
              <span>Hạn sử dụng thẻ</span>
            </div>
          </div>
          <div className="member-benefits">
            <div>
              <span>Quyền lợi phòng tập<Trophy size={18} /></span>
              <strong>100% Free</strong>
              <small>Check-in toàn bộ sân và phòng gym</small>
            </div>
            <div className="member-benefit--green">
              <span>Giá đăng ký<Coins size={18} /></span>
              <strong>{formatCurrency(activeSub.agreedPrice || activeSub.price)}</strong>
              <small>Đã hoàn tất thanh toán</small>
            </div>
            <div className="member-benefit--gold">
              <span>Trạng thái<CheckCircle2 size={18} /></span>
              <strong>Có hiệu lực</strong>
              <small>Bắt đầu từ: {formatDate(activeSub.startDate)}</small>
            </div>
          </div>
        </article>
      ) : (
        <article className="member-card" style={{ padding: 20, marginBottom: 28, background: '#fffbeb', borderColor: '#fde68a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Info size={24} style={{ color: '#d97706', flexShrink: 0 }} />
            <div>
              <strong style={{ color: '#92400e', fontSize: 13, display: 'block' }}>
                Bạn chưa có gói hội viên nào đang kích hoạt
              </strong>
              <p style={{ color: '#b45309', fontSize: 11, margin: '3px 0 0' }}>
                Hãy tra cứu danh mục gói tập bên dưới và đăng ký để bắt đầu trải nghiệm dịch vụ tại Olympus Sports Center!
              </p>
            </div>
          </div>
        </article>
      )}

      {/* KHÁM PHÁ & TRA CỨU CÁC GÓI TẬP ĐANG MỞ BÁN */}
      <div className="member-section-heading" style={{ marginBottom: 16 }}>
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} style={{ color: '#f59e0b' }} /> Tra cứu gói tập đang mở bán
          </h3>
          <p className="member-muted">
            Xem chi tiết thông tin, quyền lợi và chọn mua gói tập phù hợp với nhu cầu rèn luyện của bạn.
          </p>
        </div>
      </div>

      {/* Thanh tìm kiếm & bộ lọc kỳ hạn */}
      <div className="member-card" style={{ padding: '16px 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          {/* Input tìm kiếm */}
          <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 420 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Tìm theo tên gói tập hoặc từ khóa..."
              value={packageSearch}
              onChange={e => setPackageSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                fontSize: 12,
                outline: 'none',
              }}
            />
            {packageSearch && (
              <button
                type="button"
                onClick={() => setPackageSearch('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 2,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="member-filters">
            <button
              type="button"
              aria-pressed={packageFilter === 'all'}
              onClick={() => setPackageFilter('all')}
            >
              Tất cả ({packages.length})
            </button>
            <button
              type="button"
              aria-pressed={packageFilter === '1m'}
              onClick={() => setPackageFilter('1m')}
            >
              Gói 1 tháng
            </button>
            <button
              type="button"
              aria-pressed={packageFilter === '3m'}
              onClick={() => setPackageFilter('3m')}
            >
              Gói 3 tháng
            </button>
            <button
              type="button"
              aria-pressed={packageFilter === '6m'}
              onClick={() => setPackageFilter('6m')}
            >
              Gói 6 tháng
            </button>
            <button
              type="button"
              aria-pressed={packageFilter === '1y'}
              onClick={() => setPackageFilter('1y')}
            >
              Gói 1 năm
            </button>
            <button
              type="button"
              aria-pressed={packageFilter === 'vip'}
              onClick={() => setPackageFilter('vip')}
            >
              VIP / Cao cấp
            </button>
          </div>
        </div>
      </div>

      {/* Grid danh mục gói tập */}
      {filteredPackages.length === 0 ? (
        <div className="member-card" style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
          <Tag size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          <p style={{ fontWeight: 600, fontSize: 13 }}>Không tìm thấy gói tập nào phù hợp.</p>
          <small>Vui lòng thử lại với từ khóa khác hoặc bỏ bớt tiêu chí lọc.</small>
        </div>
      ) : (
        <div className="member-package-grid" style={{ marginBottom: 36 }}>
          {filteredPackages.map(pkg => {
            const isVip = (pkg.packageName || '').toLowerCase().includes('vip')
            return (
              <article
                key={pkg.id}
                className="member-card member-package"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: isVip ? '2px solid #f59e0b' : '1px solid var(--member-line)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {isVip && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: -30,
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 800,
                      padding: '3px 32px',
                      transform: 'rotate(45deg)',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                    }}
                  >
                    VIP
                  </div>
                )}

                <div>
                  <div className="member-row" style={{ marginBottom: 12 }}>
                    <span className={`member-tag ${isVip ? 'member-tag--gold' : ''}`}>
                      {pkg.durationInDays} ngày ({Math.round(pkg.durationInDays / 30)} tháng)
                    </span>
                    <Award size={20} style={{ color: isVip ? '#f59e0b' : '#3b82f6' }} />
                  </div>

                  <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: 'var(--member-ink)' }}>
                    {pkg.packageName}
                  </h3>

                  <p
                    className="member-package-description"
                    style={{
                      fontSize: 12,
                      color: '#64748b',
                      lineHeight: 1.5,
                      marginBottom: 16,
                      minHeight: 48,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {pkg.description || 'Gói thẻ hội viên chuẩn quốc tế rèn luyện sức khỏe tại Olympus Sports Center.'}
                  </p>

                  <div className="member-price" style={{ margin: '12px 0 16px' }}>
                    <strong style={{ fontSize: 21, color: 'var(--member-blue)' }}>
                      {formatCurrency(pkg.price)}
                    </strong>
                    <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>
                      Thời hạn: {pkg.durationInDays} ngày rèn luyện
                    </p>
                  </div>

                  {/* Danh sách quyền lợi tóm tắt */}
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 18px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#334155' }}>
                      <Check size={14} style={{ color: '#16a34a', flexShrink: 0 }} /> Check-in không giới hạn phòng tập
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#334155' }}>
                      <Check size={14} style={{ color: '#16a34a', flexShrink: 0 }} /> Tủ đồ cá nhân thông minh & phòng tắm
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#334155' }}>
                      <Check size={14} style={{ color: '#16a34a', flexShrink: 0 }} /> Hỗ trợ đo InBody & tư vấn thể lực
                    </li>
                  </ul>
                </div>

                {/* Các nút hành động */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 8, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                  <button
                    type="button"
                    className="member-button"
                    onClick={() => handleOpenPackageDetail(pkg)}
                    style={{ fontSize: 11 }}
                  >
                    <Eye size={14} /> Chi tiết
                  </button>
                  <button
                    type="button"
                    disabled={subscribingId === pkg.id}
                    className="member-button member-button--primary"
                    onClick={() => handleRegister(pkg)}
                    style={{ fontSize: 11 }}
                  >
                    {subscribingId === pkg.id ? (
                      <><LoaderCircle className="member-spin" size={14} /> Đang tạo...</>
                    ) : (
                      <><CreditCard size={14} /> Đăng ký ngay</>
                    )}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* LỊCH SỬ ĐĂNG KÝ GÓI CỦA BẠN */}
      <div className="member-section-heading" style={{ marginBottom: 12 }}>
        <div>
          <h3>Lịch sử đăng ký gói của bạn</h3>
          <p className="member-muted">Danh sách các gói tập bạn đã và đang sử dụng.</p>
        </div>
      </div>

      <div className="member-card member-table-card" style={{ marginBottom: 32 }}>
        <div className="member-table-scroll">
          <table>
            <thead>
              <tr>
                <th>MÃ ĐĂNG KÝ</th>
                <th>TÊN GÓI TẬP</th>
                <th>GIÁ NIÊM YẾT</th>
                <th>THỜI HẠN</th>
                <th>NGÀY BẮT ĐẦU</th>
                <th>NGÀY HẾT HẠN</th>
                <th>TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="member-empty">
                    Bạn chưa có lịch sử đăng ký gói nào. Hãy đăng ký một gói ở danh mục trên!
                  </td>
                </tr>
              ) : (
                subscriptions.map(sub => {
                  const statusLower = String(sub.status || '').toLowerCase()
                  const isAct = statusLower === 'active'
                  const isPend = statusLower === 'pending'
                  const isCan = statusLower === 'cancelled'
                  return (
                    <tr key={sub.id}>
                      <td><strong>#SUB-{sub.id}</strong></td>
                      <td><strong>{sub.packageName}</strong></td>
                      <td className="member-amount">{formatCurrency(sub.agreedPrice || sub.price)}</td>
                      <td>{sub.durationInDays} ngày</td>
                      <td>{formatDate(sub.startDate)}</td>
                      <td>{formatDate(sub.endDate)}</td>
                      <td>
                        <span className={`member-status ${isAct ? '' : isPend ? 'member-status--pending' : isCan ? 'member-status--danger' : 'member-status--muted'}`}>
                          <span />
                          {isPend ? 'Chờ thanh toán (Pending)' : isAct ? 'Đang hoạt động' : isCan ? 'Đã hủy' : sub.status}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: XEM CHI TIẾT GÓI TẬP (GET /api/membership-packages/{id}) */}
      {viewingPackage && (
        <div className="member-modal-overlay" onClick={() => setViewingPackage(null)}>
          <div className="member-modal" onClick={e => e.stopPropagation()}>
            <div className="member-modal-header">
              <h3>
                <Award size={18} style={{ color: 'var(--member-blue)' }} />
                Chi tiết gói tập: {viewingPackage.packageName}
              </h3>
              <button
                type="button"
                className="member-modal-close"
                onClick={() => setViewingPackage(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="member-modal-body">
              {packageDetailLoading ? (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <LoaderCircle className="member-spin" size={24} style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 12, color: '#64748b' }}>Đang tải thông tin chi tiết gói...</p>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: 12,
                      background: '#f8fafc',
                      padding: 16,
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div>
                      <small style={{ color: '#64748b', fontSize: 11, display: 'block' }}>Giá gói</small>
                      <strong style={{ fontSize: 18, color: 'var(--member-blue)' }}>
                        {formatCurrency(viewingPackage.price)}
                      </strong>
                    </div>
                    <div>
                      <small style={{ color: '#64748b', fontSize: 11, display: 'block' }}>Thời hạn sử dụng</small>
                      <strong style={{ fontSize: 16, color: '#1e293b' }}>
                        {viewingPackage.durationInDays} ngày
                      </strong>
                    </div>
                    <div>
                      <small style={{ color: '#64748b', fontSize: 11, display: 'block' }}>Trạng thái mở bán</small>
                      <span className="member-status" style={{ marginTop: 4 }}>
                        <span />
                        {viewingPackage.isActive !== false ? 'Đang mở bán' : 'Tạm dừng'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 6px', color: '#1e293b' }}>Mô tả gói tập</h4>
                    <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.6, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                      {viewingPackage.description || 'Gói thẻ hội viên chuẩn chất lượng cao tại Olympus Sports Center, tạo điều kiện tối ưu để bạn rèn luyện thể lực và duy trì phong độ thể thao hàng ngày.'}
                    </p>
                  </div>

                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px', color: '#1e293b' }}>Quyền lợi hội viên bao gồm</h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155' }}>
                        <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
                        <span>Sử dụng toàn bộ trang thiết bị máy tập Cardio & Kháng lực hiện đại.</span>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155' }}>
                        <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
                        <span>Tủ đồ thông minh (Smart Locker) bảo mật bằng mã QR cá nhân.</span>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155' }}>
                        <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
                        <span>Miễn phí phòng tắm nóng lạnh, máy sấy tóc và nước uống tinh khiết.</span>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155' }}>
                        <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
                        <span>Được đăng ký và tham gia các lớp học theo lịch sinh hoạt quy định.</span>
                      </li>
                    </ul>
                  </div>

                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12, display: 'flex', gap: 10 }}>
                    <Info size={18} style={{ color: '#2563eb', flexShrink: 0, marginTop: 2 }} />
                    <small style={{ color: '#1e40af', fontSize: 11, lineHeight: 1.5 }}>
                      Khi bạn chọn <strong>Đăng ký gói này</strong>, hệ thống sẽ tạo đơn với trạng thái <strong>Chờ thanh toán (Pending)</strong>. Bạn có thể thanh toán trực tuyến ngay qua cổng PayOS hoặc thanh toán tiền mặt tại quầy lễ tân.
                    </small>
                  </div>
                </>
              )}
            </div>

            <div className="member-modal-footer">
              <button
                type="button"
                className="member-button"
                onClick={() => setViewingPackage(null)}
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={subscribingId === viewingPackage.id}
                className="member-button member-button--primary"
                onClick={() => handleRegister(viewingPackage)}
              >
                {subscribingId === viewingPackage.id ? (
                  <><LoaderCircle className="member-spin" size={15} /> Đang tạo đơn...</>
                ) : (
                  <><CreditCard size={15} /> Đăng ký gói này ngay</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: THÔNG BÁO TỰ ĐĂNG KÝ GÓI THÀNH CÔNG (Trạng thái Pending) */}
      {registrationSuccessSub && (
        <div className="member-modal-overlay" onClick={() => setRegistrationSuccessSub(null)}>
          <div className="member-modal" onClick={e => e.stopPropagation()}>
            <div className="member-modal-header" style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0' }}>
              <h3 style={{ color: '#15803d' }}>
                <CheckCircle2 size={20} style={{ color: '#16a34a' }} />
                Đăng ký gói thành công!
              </h3>
              <button
                type="button"
                className="member-modal-close"
                onClick={() => setRegistrationSuccessSub(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="member-modal-body">
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: '#dcfce7',
                    color: '#16a34a',
                    display: 'grid',
                    placeItems: 'center',
                    margin: '0 auto 12px',
                  }}
                >
                  <Award size={28} />
                </div>
                <h4 style={{ fontSize: 16, margin: 0, color: '#1e293b' }}>
                  Đơn đăng ký gói của bạn đã được ghi nhận
                </h4>
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  Gói tập đang ở trạng thái <strong>Chờ thanh toán (Pending)</strong>
                </p>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#64748b' }}>Mã đơn đăng ký:</span>
                  <strong>#SUB-{registrationSuccessSub.id}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#64748b' }}>Tên gói tập:</span>
                  <strong>{registrationSuccessSub.packageName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#64748b' }}>Thời hạn:</span>
                  <span>{registrationSuccessSub.durationInDays} ngày</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#64748b' }}>Số tiền cần thanh toán:</span>
                  <strong style={{ color: 'var(--member-blue)', fontSize: 15 }}>
                    {formatCurrency(registrationSuccessSub.agreedPrice || registrationSuccessSub.price)}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <span style={{ color: '#64748b' }}>Trạng thái:</span>
                  <span className="member-status member-status--pending">
                    <span /> Chờ thanh toán (Pending)
                  </span>
                </div>
              </div>

              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 11, color: '#92400e', lineHeight: 1.5 }}>
                  💡 <strong>Bước tiếp theo:</strong> Bạn có thể bấm <strong>"Thanh toán PayOS ngay"</strong> để quét mã QR ngân hàng và kích hoạt gói tức thì, hoặc chọn <strong>"Để sau"</strong> để thanh toán tiền mặt tại quầy lễ tân hoặc thanh toán sau tại mục Thanh toán trực tuyến.
                </p>
              </div>
            </div>

            <div className="member-modal-footer">
              <button
                type="button"
                className="member-button"
                onClick={() => setRegistrationSuccessSub(null)}
              >
                Để sau / Thanh toán tại quầy
              </button>
              <button
                type="button"
                disabled={payingSubId === registrationSuccessSub.id}
                className="member-button member-button--primary"
                onClick={() => handlePayOSCheckout(registrationSuccessSub.id)}
              >
                {payingSubId === registrationSuccessSub.id ? (
                  <><LoaderCircle className="member-spin" size={15} /> Đang mở cổng...</>
                ) : (
                  <><CreditCard size={15} /> Thanh toán PayOS ngay <ArrowRight size={14} /></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SubscriptionsView
