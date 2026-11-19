import { MemberList } from './MemberPagination'
import { useCallback, useState } from 'react'
import { useMemberResource } from '../../contexts/MemberWorkspaceContext'
import { AlertCircle, ArrowDownLeft, ArrowUpRight, History, LoaderCircle, QrCode, RefreshCw, ScanLine } from 'lucide-react'
import QRCode from 'qrcode'
import { getMyQrCode, getMyGymCheckInHistory, getCheckInErrorMessage } from '../../services/gymCheckInService'
import { GymCheckInStatus, GymDateRangeFields } from '../../components/GymHistoryControls'
import { formatGymDate, GYM_TIME_ZONE, gymCheckInStatus, gymDateRangeReason, gymDurationLabel, gymDurationMinutes, gymTimestamp } from '../../utils/gymCheckInHistory'
import '../../style/member/GymCheckInView.css'

import { LIST_PAGE_SIZE as PAGE_SIZE } from '../../utils/listPagination'

function formatDate(value, dateOnly = false) {
  return formatGymDate(value, dateOnly)
}

function duration(item) {
  return gymDurationLabel(gymDurationMinutes(item))
}

function packageLabel(status) {
  const labels = {
    active: 'Đang hoạt động', expired: 'Đã hết hạn', inactive: 'Chưa kích hoạt',
    suspended: 'Tạm ngưng', frozen: 'Bảo lưu', cancelled: 'Đã hủy', pending: 'Chờ kích hoạt',
  }
  return labels[String(status || '').toLowerCase()] || status || 'Chưa có thông tin gói tập'
}

async function loadQr(options) {
  const info = await getMyQrCode(options)
  if (typeof info?.qrData !== 'string' || !info.qrData.trim()) {
    throw new Error('Chưa có mã QR thẻ số. Vui lòng liên hệ lễ tân để kiểm tra thông tin hội viên.')
  }
  // Encode the exact server payload locally; never send the member's QR to a third party.
  const image = await QRCode.toDataURL(info.qrData, {
    width: 320, margin: 4, errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  })
  return { ...info, image }
}

function useGymData(loader, fallback, key) {
  const query = useMemberResource(key, () => loader({}))
  return { ...query, error: !query.hasData && query.error ? getCheckInErrorMessage(query.error, fallback) : '' }
}

function LoadingState({ children }) {
  return <div className="gym-checkin-state" role="status"><LoaderCircle className="member-spin" size={24} /><span>{children}</span></div>
}

function ErrorState({ message, retry }) {
  return (
    <div className="gym-checkin-state gym-checkin-error" role="alert">
      <AlertCircle size={24} />
      <p>{message}</p>
      <button type="button" className="gym-button" onClick={retry}><RefreshCw size={15} /> Thử lại</button>
    </div>
  )
}

export function GymCheckInView() {
  const qr = useGymData(loadQr, 'Không thể tải mã QR hội viên.', 'gym-qr')
  const [dateRange, setDateRange] = useState({ fromDate: '', toDate: '' })
  const [dateDraft, setDateDraft] = useState(dateRange)
  const [rangeError, setRangeError] = useState('')
  const historyLoader = useCallback(options => getMyGymCheckInHistory(dateRange, options), [dateRange])
  const history = useGymData(historyLoader, 'Không thể tải lịch sử ra/vào trung tâm.', 'gym-history:' + JSON.stringify(dateRange))
  const [filter, setFilter] = useState('All')
  const [page, setPage] = useState(1)
  const records = [...(history.data || [])].sort((a, b) =>
    (gymTimestamp(b.checkInTime) || 0) - (gymTimestamp(a.checkInTime) || 0))
  const filtered = records.filter(item => filter === 'All' || gymCheckInStatus(item) === filter)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visibleRecords = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const info = qr.data

  const reloadHistory = () => {
    setPage(1)
    history.reload()
  }

  const filters = [
    { value: 'All', label: 'Tất cả trạng thái' },
    { value: 'InGym', label: 'Đang tập' },
    { value: 'CheckedOut', label: 'Đã ra về' },
    { value: 'ForgotCheckOut', label: 'Quên check-out' },
  ]
  const applyRange = value => {
    const reason = gymDateRangeReason(value)
    setRangeError(reason)
    if (!reason) { setDateRange(value); setDateDraft(value); setPage(1) }
  }

  return (
    <div className="gym-checkin-view">
      <header className="gym-page-heading">
        <div>
          <p className="member-eyebrow"><ScanLine size={16} /> THẺ SỐ HỘI VIÊN</p>
          <h2>Ra/Vào trung tâm</h2>
          <p>Thẻ QR cá nhân và lịch sử tập luyện của bạn, ngay tại đây.</p>
        </div>
        <button type="button" className="gym-icon-button" aria-label="Làm mới thẻ và lịch sử ra/vào" title="Làm mới" disabled={qr.loading || history.loading} onClick={() => { qr.reload(); reloadHistory() }}>
          <RefreshCw size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="gym-checkin-overview">
        <section className="gym-panel gym-member-card" aria-labelledby="gym-qr-title" aria-busy={qr.loading}>
          <div className="gym-card-heading">
            <h3 id="gym-qr-title"><QrCode size={18} /> Thẻ hội viên</h3>
            <button type="button" className="gym-icon-button" disabled={qr.loading} onClick={qr.reload} aria-label="Làm mới mã QR"><RefreshCw size={16} /></button>
          </div>
          {qr.loading ? <LoadingState>Đang tải thẻ hội viên...</LoadingState>
            : qr.error ? <ErrorState message={qr.error} retry={qr.reload} />
              : info && <div className="gym-member-card-body">
                <div className="gym-checkin-identity">
                  <strong className="gym-checkin-name">{info.fullName || 'Hội viên'}</strong>
                  <span className="gym-member-code">{info.memberCode || 'Chưa có mã hội viên'}</span>
                </div>
                <div className="gym-checkin-qr"><img src={info.image} width="200" height="200" alt="Mã QR thẻ hội viên để lễ tân quét khi vào tập" /></div>
                <dl className="gym-checkin-details">
                  <div><dt>Gói tập</dt><dd>{info.packageName || 'Chưa có thông tin'}</dd></div>
                  <div><dt>Trạng thái</dt><dd><span className="gym-package-status" data-active={String(info.packageStatus).toLowerCase() === 'active'}>{packageLabel(info.packageStatus)}</span></dd></div>
                  <div><dt>Hết hạn ngày</dt><dd>{formatDate(info.expireDate, true)}</dd></div>
                </dl>
                <p className="gym-qr-caption">Xuất trình mã QR này tại quầy lễ tân.</p>
              </div>}
          <section className="gym-checkin-guide" aria-labelledby="gym-guide-title">
            <h4 id="gym-guide-title"><ScanLine size={16} />Hướng dẫn sử dụng</h4>
            <ol>
              <li><span>1</span><div><strong>Mở thẻ QR</strong><p>Chuẩn bị mã QR cá nhân khi đến trung tâm.</p></div></li>
              <li><span>2</span><div><strong>Quét mã tại lễ tân</strong><p>Lễ tân quét mã để ghi nhận giờ vào.</p></div></li>
              <li><span>3</span><div><strong>Xác nhận khi ra về</strong><p>Nhờ lễ tân check-out, sau đó làm mới lịch sử.</p></div></li>
            </ol>
          </section>
        </section>

        <section className="gym-checkin-history" aria-labelledby="gym-history-title" aria-busy={history.loading}>
          <div className="gym-history-heading">
            <div><h3 id="gym-history-title">Lịch sử tập luyện</h3><p>Sắp xếp theo thời gian vào mới nhất.</p></div>
            <button type="button" className="gym-button" disabled={history.loading} onClick={reloadHistory} aria-label="Làm mới lịch sử" title="Làm mới lịch sử"><RefreshCw size={15} /><span>Làm mới lịch sử</span></button>
          </div>
          <form className="gym-history-query" aria-label="Lọc lịch sử tập luyện" onSubmit={event => { event.preventDefault(); applyRange(dateDraft) }}>
            <GymDateRangeFields value={dateDraft} onChange={setDateDraft} />
            <label className="gym-history-status">Trạng thái
              <select name="status" value={filter} onChange={event => { setFilter(event.target.value); setPage(1) }}>
                {filters.map(({ value, label }) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
            <button type="submit">Xem lịch sử</button>
            {rangeError && <p className="gym-history-range-error" role="alert">{rangeError}</p>}
          </form>
          <div className="gym-panel gym-history-content">
            {history.loading ? <LoadingState>Đang tải lịch sử tập luyện...</LoadingState>
              : history.error ? <ErrorState message={history.error} retry={reloadHistory} />
                : filtered.length === 0 ? <div className="gym-checkin-state" role="status"><History size={30} /><strong>Không có lượt tập phù hợp</strong><p>Thử đổi khoảng ngày hoặc trạng thái để xem các lượt tập của bạn.</p>{filter !== 'All' && <button type="button" className="gym-button" onClick={() => { setFilter('All'); setPage(1) }}>Xem tất cả trạng thái</button>}</div>
                  : <>
                    <div className="gym-history-labels" aria-hidden="true"><span>Ngày tập</span><span>Giờ vào / Giờ ra</span><span>Thời lượng</span><span>Trạng thái</span></div>
                    <MemberList items={visibleRecords} total={filtered.length} page={currentPage} onPageChange={setPage} label="Lịch sử tập luyện" as="ol" className="gym-history-list">{item => <li className="gym-history-record" key={item.id}>
                        <div className="gym-record-main">
                          <div className="gym-record-date"><strong>{formatDate(item.checkInTime, true)}</strong><span>Lượt tập #{item.id}</span></div>
                          <div className="gym-record-times"><VisitTime label="Giờ vào" value={item.checkInTime} /><VisitTime label="Giờ ra" value={item.checkOutTime} outgoing /></div>
                          <div className="gym-record-duration"><span>Thời lượng</span><strong>{duration(item)}</strong></div>
                          <SessionStatus item={item} />
                        </div>
                        <div className="gym-record-meta"><span>Gói tập: <strong>{item.packageName || '—'}</strong></span><span>Nhân viên: <strong>{item.checkedByStaffName || '—'}</strong></span></div>
                        {item.notes && <p className="gym-record-notes"><span>Ghi chú:</span> {item.notes}</p>}
                      </li>}</MemberList>

                  </>}
          </div>
        </section>
      </div>
    </div>
  )
}

function SessionStatus({ item }) {
  return <GymCheckInStatus item={item} />
}

function VisitTime({ label, value, outgoing = false }) {
  const date = new Date(gymTimestamp(value))
  const valid = value && !Number.isNaN(date.getTime())
  return <div className="gym-visit-time">
    <span>{outgoing ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}{label}</span>
    {valid ? <time dateTime={value}><strong>{date.toLocaleTimeString('vi-VN', { timeZone: GYM_TIME_ZONE, hour: '2-digit', minute: '2-digit' })}</strong><small>{formatDate(value, true)}</small></time> : <strong className="gym-time-missing">{outgoing ? 'Chưa ghi nhận' : '—'}</strong>}
  </div>
}
