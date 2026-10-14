import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Dumbbell,
  Edit2,
  Filter,
  Flame,
  Layers,
  Plus,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  Trophy,
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
  getClassErrorMessage,
  getManagedClasses,
  getRooms,
} from '../../services/sportClassService'
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

export default function ClassManagement() {
  const [activeTab, setActiveTab] = useState('sports') // 'sports' | 'classes'

  // Data states
  const [sports, setSports] = useState([])
  const [coaches, setCoaches] = useState([])
  const [classes, setClasses] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [classesLoading, setClassesLoading] = useState(false)

  // Feedback states
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Search & Filter for Sports
  const [sportSearch, setSportSearch] = useState('')
  const [sportFilterStatus, setSportFilterStatus] = useState('ALL') // 'ALL' | 'ACTIVE' | 'INACTIVE'

  // Modal states for Sports
  const [showCreateSportModal, setShowCreateSportModal] = useState(false)
  const [editingSport, setEditingSport] = useState(null)
  const [togglingSport, setTogglingSport] = useState(null)
  const [submittingSport, setSubmittingSport] = useState(false)

  // Sport Form State
  const [sportForm, setSportForm] = useState({
    name: '',
    description: '',
    isActive: true,
  })

  // Auto clear success message
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 4000)
      return () => clearTimeout(timer)
    }
  }, [success])

  // Load sports, coaches, and rooms initially
  const loadInitialData = async () => {
    setLoading(true)
    setError('')
    try {
      const [sportsData, coachesData, roomsData] = await Promise.all([
        getSports(),
        getCoaches().catch(() => []),
        getRooms().catch(() => []),
      ])
      // Map sports data ensuring isActive property (GET /api/sports returns active ones)
      setSports(
        sportsData.map((s) => ({
          ...s,
          isActive: s.isActive !== undefined ? s.isActive : true,
        }))
      )
      setCoaches(coachesData)
      setRooms(roomsData)
    } catch (err) {
      setError(getClassErrorMessage(err, 'Không thể tải danh mục bộ môn và dữ liệu trung tâm.'))
    } finally {
      setLoading(false)
    }
  }

  // Load classes
  const loadClasses = async () => {
    setClassesLoading(true)
    try {
      const res = await getManagedClasses()
      setClasses(res.items || [])
    } catch (err) {
      console.error('Error loading classes:', err)
    } finally {
      setClassesLoading(false)
    }
  }

  useEffect(() => {
    loadInitialData()
    loadClasses()
  }, [])

  // Filtered sports
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

  // Handle open create sport modal
  const handleOpenCreateSport = () => {
    setSportForm({
      name: '',
      description: '',
      isActive: true,
    })
    setShowCreateSportModal(true)
    setError('')
  }

  // Handle open edit sport modal
  const handleOpenEditSport = (sport) => {
    setEditingSport(sport)
    setSportForm({
      name: sport.name || '',
      description: sport.description || '',
      isActive: sport.isActive !== false,
    })
    setError('')
  }

  // Submit Create Sport
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
      setSuccess(`Đã tạo mới bộ môn "${created.name}" thành công!`)
    } catch (err) {
      setError(getClassErrorMessage(err, 'Không thể tạo mới bộ môn thể thao.'))
    } finally {
      setSubmittingSport(false)
    }
  }

  // Submit Edit Sport
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

  // Handle quick toggle active status
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

  const activeSportsCount = sports.filter((s) => s.isActive !== false).length

  return (
    <div className="class-mgmt">
      {/* Module Header */}
      <section className="class-mgmt-header manager-card">
        <div>
          <h2>Quản lý danh mục & Lớp học</h2>
          <p>
            Cấu hình danh mục thể thao, thiết lập khóa học, gán huấn luyện viên và điều phối buổi học chi tiết.
          </p>
        </div>
        <div className="class-mgmt-actions">
          <button
            type="button"
            className="class-btn class-btn-secondary"
            onClick={() => {
              loadInitialData()
              loadClasses()
            }}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
          {activeTab === 'sports' ? (
            <button
              type="button"
              className="class-btn class-btn-primary"
              onClick={handleOpenCreateSport}
            >
              <Plus size={16} /> Thêm bộ môn mới
            </button>
          ) : (
            <button
              type="button"
              className="class-btn class-btn-primary"
              onClick={() => setActiveTab('classes')}
            >
              <Plus size={16} /> Tạo lớp học mới
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
      <div className="class-tabs">
        <button
          type="button"
          className={`class-tab ${activeTab === 'sports' ? 'active' : ''}`}
          onClick={() => setActiveTab('sports')}
        >
          <Trophy size={16} />
          Danh mục bộ môn (Sports)
          <span className="class-tab-badge">{sports.length}</span>
        </button>
        <button
          type="button"
          className={`class-tab ${activeTab === 'classes' ? 'active' : ''}`}
          onClick={() => setActiveTab('classes')}
        >
          <BookOpen size={16} />
          Lớp học & Buổi học (Sport Classes)
          <span className="class-tab-badge">{classes.length}</span>
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

      {/* TAB 1: SPORTS CATALOG MANAGEMENT */}
      {activeTab === 'sports' && (
        <>
          {/* Toolbar */}
          <div className="class-toolbar">
            <div className="class-search-box">
              <Search size={16} />
              <input
                type="text"
                className="class-search-input"
                placeholder="Tìm kiếm môn thể thao (Gym, Yoga, Boxing...)..."
                value={sportSearch}
                onChange={(e) => setSportSearch(e.target.value)}
              />
            </div>
            <div className="class-filter-group">
              <select
                className="class-select"
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
        </>
      )}

      {/* TAB 2: SPORT CLASSES & SESSIONS (Preview & Container for Commit 2) */}
      {activeTab === 'classes' && (
        <div className="manager-card" style={{ margin: '0 24px', padding: '24px' }}>
          <div className="manager-card-heading">
            <div>
              <h2>Quản lý toàn diện lớp học & buổi học</h2>
              <p>Danh sách các lớp học hiện có trong hệ thống</p>
            </div>
          </div>
          {classesLoading ? (
            <div className="class-loading">
              <div className="class-spinner" />
              <span>Đang tải danh sách lớp học...</span>
            </div>
          ) : classes.length === 0 ? (
            <div className="class-empty">
              <BookOpen size={40} />
              <strong>Chưa có lớp học nào được tạo</strong>
              <p>Hệ thống lớp học kết nối trực tiếp với SportClassesController và ClassSessionsController.</p>
            </div>
          ) : (
            <div className="class-table-container">
              <table className="class-table">
                <thead>
                  <tr>
                    <th>MÃ LỚP</th>
                    <th>TÊN LỚP HỌC</th>
                    <th>BỘ MÔN</th>
                    <th>HLV PHỤ TRÁCH</th>
                    <th>LỊCH HỌC</th>
                    <th>SĨ SỐ TỐI ĐA</th>
                    <th>TRẠNG THÁI</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((cls) => (
                    <tr key={cls.id}>
                      <td><strong>#{cls.id}</strong></td>
                      <td>
                        <div className="class-item-name">{cls.className}</div>
                        <div className="class-item-meta">
                          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(cls.price)}
                        </div>
                      </td>
                      <td>
                        <span className="class-tag sport">{cls.sportName}</span>
                      </td>
                      <td>
                        <span className="class-tag coach">{cls.coachName || 'Chưa gán'}</span>
                      </td>
                      <td>{cls.schedule || 'Chưa có lịch'}</td>
                      <td>{cls.maxCapacity} học viên</td>
                      <td>
                        <span className={`sport-badge ${cls.isActive ? 'active' : 'inactive'}`}>
                          <i />
                          {cls.isActive ? 'Đang mở' : 'Đã đóng'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: CREATE SPORT */}
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

      {/* MODAL: EDIT SPORT */}
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

      {/* MODAL: CONFIRM TOGGLE STATUS */}
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
    </div>
  )
}
