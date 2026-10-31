import { useEffect, useState } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, History, LogOut, RefreshCw, Search, Users } from 'lucide-react'
import { getCheckInErrorMessage, getGymCheckInHistory, getGymCheckInSummaryByMember } from '../../services/gymCheckInService'
import { GymCheckInStatus, GymDateRangeFields } from '../../components/GymHistoryControls'
import { formatGymDate, gymCheckInStatus, gymDateKey, gymDateRangeReason, gymDurationLabel, gymDurationMinutes, gymHistoryParams } from '../../utils/gymCheckInHistory'
import '../../style/CenterManager/FrontDeskGymHistory.css'

const PAGE_SIZE = 10
const statusOptions = [['All', 'Tất cả trạng thái'], ['InGym', 'Đang tập'], ['CheckedOut', 'Đã ra về'], ['ForgotCheckOut', 'Quên check-out']]

export function GymHistoryTable({ items, summary = false, onCheckOut, disabled }) {
  return <div className="fdesk-table-scroll"><table className="fdesk-table fdesk-gym-history-table">
    <thead><tr><th>Hội viên</th><th>{summary ? 'Gói trong lượt gần nhất' : 'Gói tập'}</th>
      {summary ? <><th>Số lượt</th><th>Tổng thời lượng</th><th>Lần vào gần nhất</th><th>Trạng thái trong khoảng chọn</th></>
        : <><th>Giờ vào</th><th>Giờ ra</th><th>Thời lượng</th><th>Trạng thái</th><th>Nhân viên trực</th><th>Thao tác</th></>}
    </tr></thead>
    <tbody>{items.map(item => <tr key={summary ? item.memberId : item.id}>
      <td><strong>{item.memberName || 'Hội viên'}</strong><small>{item.memberCode || `#${item.memberId}`} · {item.phoneNumber || 'Chưa có SĐT'}</small></td>
      <td>{summary ? item.currentPackageName || '—' : item.packageName || '—'}</td>
      {summary ? <><td><strong>{item.totalCheckIns}</strong></td><td>{gymDurationLabel(item.totalDurationMinutes)}</td><td>{formatGymDate(item.lastCheckInTime)}</td><td>{item.isCurrentlyInGym ? <span className="gym-checkin-status" data-status="InGym">Có lượt đang tập</span> : 'Không có lượt đang tập'}</td></>
        : <><td>{formatGymDate(item.checkInTime)}</td><td>{formatGymDate(item.checkOutTime)}</td><td>{gymDurationLabel(gymDurationMinutes(item))}</td><td><GymCheckInStatus item={item} /></td><td>{item.checkedByStaffName || '—'}</td><td>
          {gymCheckInStatus(item) === 'InGym' && !item.checkOutTime && onCheckOut
            ? <button type="button" className="fdesk-btn fdesk-btn-secondary" data-checkout-id={item.id} disabled={disabled} onClick={() => onCheckOut(item.id, item.memberName)}><LogOut size={13} />Check-out</button> : '—'}
        </td></>}
    </tr>)}</tbody>
  </table></div>
}

export default function FrontDeskGymHistory({ reloadKey = 0, disabled = false, onCheckOut, todayItems = [] }) {
  const [mode, setMode] = useState('history')
  const [filters, setFilters] = useState(() => ({ fromDate: gymDateKey(), toDate: gymDateKey(), search: '', memberId: '', status: 'All' }))
  const [draft, setDraft] = useState(filters)
  const [filterError, setFilterError] = useState('')
  const [revision, setRevision] = useState(0)
  const [page, setPage] = useState(1)
  const [state, setState] = useState({ key: '', items: [], loading: true, error: '' })
  const key = JSON.stringify([mode, filters])
  const current = state.key === key
  const loading = !current || state.loading
  const items = current ? state.items : []
  const error = current ? state.error : ''
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visible = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const summary = mode === 'summary'
  const canShowTodayFallback = state.unavailable && !summary && filters.fromDate === gymDateKey() && filters.toDate === gymDateKey()
    && !filters.search.trim() && !filters.memberId && filters.status === 'All' && todayItems.length > 0

  useEffect(() => {
    const controller = new AbortController()
    setState({ key, items: [], loading: true, error: '' })
    const request = mode === 'summary'
      ? getGymCheckInSummaryByMember(filters, { signal: controller.signal })
      : getGymCheckInHistory(filters, { signal: controller.signal })
    request.then(items => { if (!controller.signal.aborted) setState({ key, items, loading: false, error: '' }) })
      .catch(error => { if (!controller.signal.aborted) setState({ key, items: [], loading: false, unavailable: error.code === 'GYM_HISTORY_UNAVAILABLE', error: getCheckInErrorMessage(error, 'Không thể tải lịch sử check-in.') }) })
    return () => controller.abort()
  }, [key, mode, filters, revision, reloadKey])

  const apply = values => {
    try {
      const next = summary ? { ...values, memberId: '', status: 'All' } : values
      const reason = gymDateRangeReason(next)
      if (reason) throw new Error(reason)
      gymHistoryParams(next)
      setFilterError(''); setFilters(next); setDraft(next); setPage(1)
    } catch (error) { setFilterError(error.message) }
  }

  return <section className="fdesk-card fdesk-gym-history" aria-label="Lịch sử ra vào phòng gym" aria-busy={loading}>
    <header className="fdesk-card-header"><div><h3><History size={19} />Lịch sử ra/vào phòng gym</h3><p>Tra cứu theo ngày Việt Nam, hội viên và trạng thái. Thống kê áp dụng cho khoảng ngày đang xem.</p></div><button type="button" className="fdesk-btn fdesk-btn-secondary" disabled={disabled || loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} />Làm mới lịch sử</button></header>
    <div className="fdesk-gym-history-body">
      <div className="fdesk-gym-history-tabs" role="group" aria-label="Chế độ xem lịch sử check-in">
        <button type="button" aria-pressed={!summary} disabled={disabled} onClick={() => { setMode('history'); setPage(1); setFilterError('') }}><History size={15} />Các lượt ra/vào</button>
        <button type="button" aria-pressed={summary} disabled={disabled} onClick={() => { setMode('summary'); setPage(1); setFilterError('') }}><Users size={15} />Tổng hợp theo hội viên</button>
      </div>
      <form className="gym-history-query" aria-label="Bộ lọc lịch sử check-in" onSubmit={event => { event.preventDefault(); apply(draft) }}>
        <GymDateRangeFields value={draft} disabled={disabled} onChange={setDraft} onPreset={range => apply({ ...draft, ...range })} />
        <label className="gym-history-search">Tìm hội viên<input type="search" maxLength={200} placeholder="Tên, số điện thoại hoặc mã thẻ" value={draft.search} disabled={disabled} onChange={event => setDraft({ ...draft, search: event.target.value })} /></label>
        {!summary && <><label>Mã hội viên<input type="number" min="1" step="1" placeholder="Tất cả" value={draft.memberId} disabled={disabled} onChange={event => setDraft({ ...draft, memberId: event.target.value })} /></label>
          <label>Trạng thái<select value={draft.status} disabled={disabled} onChange={event => setDraft({ ...draft, status: event.target.value })}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></>}
        <button type="submit" disabled={disabled}><Search size={14} />Tra cứu</button>
        {filterError && <p className="gym-history-range-error" role="alert">{filterError}</p>}
      </form>
      {!loading && !error && <div className="fdesk-gym-history-count" role="status">{summary ? `${items.length} hội viên · ${items.reduce((sum, item) => sum + item.totalCheckIns, 0)} lượt tập` : `${items.length} lượt ra/vào`}</div>}
    </div>
    {loading ? <p className="fdesk-gym-history-state" role="status"><RefreshCw size={20} className="fdesk-spin" />Đang tải lịch sử...</p>
      : error ? <><div className="fdesk-gym-history-state is-error" role="alert"><AlertCircle size={20} /><p>{error}</p><button type="button" className="fdesk-btn fdesk-btn-secondary" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div>
        {canShowTodayFallback && <details className="fdesk-gym-today-fallback" open><summary>Danh sách hôm nay đang có tại quầy · {todayItems.length} lượt</summary><p>Danh sách này vẫn hỗ trợ check-out. Bộ lọc lịch sử ngày cũ chưa khả dụng.</p><GymHistoryTable items={todayItems} onCheckOut={onCheckOut} disabled={disabled} /></details>}</>
        : !items.length ? <p className="fdesk-gym-history-state" role="status">Không có dữ liệu phù hợp. Thử đổi khoảng ngày hoặc điều kiện tìm kiếm.</p>
          : <><GymHistoryTable items={visible} summary={summary} onCheckOut={onCheckOut} disabled={disabled} />
            <nav className="fdesk-gym-history-pagination" aria-label="Phân trang lịch sử check-in"><span>{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, items.length)} / {items.length} {summary ? 'hội viên' : 'lượt'} · Trang {currentPage}/{totalPages}</span><div><button type="button" className="fdesk-btn fdesk-btn-secondary" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} aria-label="Trang lịch sử trước"><ChevronLeft size={16} /></button><button type="button" className="fdesk-btn fdesk-btn-secondary" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)} aria-label="Trang lịch sử sau"><ChevronRight size={16} /></button></div></nav>
          </>}
  </section>
}
