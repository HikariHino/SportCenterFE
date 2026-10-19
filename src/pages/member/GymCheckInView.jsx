import { useEffect, useState } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, History, LoaderCircle, QrCode, RefreshCw } from 'lucide-react'
import QRCode from 'qrcode'
import { getMyQrCode, getMyGymCheckInHistory, getCheckInErrorMessage } from '../../services/gymCheckInService'
import '../../style/member/GymCheckInView.css'

const PAGE_SIZE = 10

function formatDate(value, dateOnly = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('vi-VN', dateOnly
    ? { dateStyle: 'short' }
    : { dateStyle: 'short', timeStyle: 'short' })
}

function duration(item) {
  if (!item.checkOutTime) return '—'
  const start = new Date(item.checkInTime).getTime()
  const end = new Date(item.checkOutTime).getTime()
  if (!item.checkInTime || !Number.isFinite(start) || !Number.isFinite(end) || end < start) return '—'
  const minutes = Math.floor((end - start) / 60000)
  if (minutes < 1) return 'Dưới 1 phút'
  return minutes < 60 ? `${minutes} phút` : `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`
}

function packageLabel(status) {
  const labels = {
    active: 'Đang hoạt động', expired: 'Đã hết hạn', inactive: 'Chưa kích hoạt',
    suspended: 'Tạm ngưng', frozen: 'Bảo lưu', cancelled: 'Đã hủy', pending: 'Chờ kích hoạt',
  }
  return labels[String(status || '').toLowerCase()] || status || 'Chưa có thông tin gói tập'
}

async function loadQr() {
  const info = await getMyQrCode()
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

function useGymData(loader, fallback) {
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    setState({ data: null, loading: true, error: '' })
    loader().then(data => {
      if (active) setState({ data, loading: false, error: '' })
    }).catch(error => {
      if (active) setState({ data: null, loading: false, error: getCheckInErrorMessage(error, fallback) })
    })
    return () => { active = false }
  }, [loader, fallback, revision])

  return { ...state, reload: () => setRevision(value => value + 1) }
}

function LoadingState({ children }) {
  return <div className="gym-checkin-state" role="status"><LoaderCircle className="member-spin" size={24} /><span>{children}</span></div>
}

function ErrorState({ message, retry }) {
  return (
    <div className="gym-checkin-state gym-checkin-error" role="alert">
      <AlertCircle size={24} />
      <p>{message}</p>
      <button type="button" className="member-button" onClick={retry}><RefreshCw size={15} /> Thử lại</button>
    </div>
  )
}

export function GymCheckInView() {
  const qr = useGymData(loadQr, 'Không thể tải mã QR hội viên.')
  const history = useGymData(getMyGymCheckInHistory, 'Không thể tải lịch sử ra/vào phòng gym.')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const records = [...(history.data || [])].sort((a, b) =>
    (Date.parse(b.checkInTime) || 0) - (Date.parse(a.checkInTime) || 0))
  const filtered = records.filter(item => filter === 'all' || (filter === 'completed' ? Boolean(item.checkOutTime) : !item.checkOutTime))
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visibleRecords = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const info = qr.data

  const reloadHistory = () => {
    setPage(1)
    history.reload()
  }

  return (
    <div className="member-view-stack gym-checkin-view">
      <div className="member-section-heading">
        <div>
          <p className="member-eyebrow"><QrCode size={16} /> THẺ SỐ HỘI VIÊN</p>
          <h2>Ra/vào phòng gym</h2>
          <p className="member-muted">Xuất trình mã QR tại quầy lễ tân khi vào tập và theo dõi các buổi tập của bạn.</p>
        </div>
      </div>

      <div className="gym-checkin-overview">
        <section className="member-card gym-checkin-card" aria-labelledby="gym-qr-title" aria-busy={qr.loading}>
          <div className="gym-checkin-card-heading">
            <h3 id="gym-qr-title"><QrCode size={19} /> Mã QR của tôi</h3>
            <button type="button" className="member-button" disabled={qr.loading} onClick={qr.reload}>
              <RefreshCw size={15} /> Làm mới mã
            </button>
          </div>
          {qr.loading ? <LoadingState>Đang tải mã QR...</LoadingState>
            : qr.error ? <ErrorState message={qr.error} retry={qr.reload} />
              : info && (
                <div className="gym-checkin-identity">
                  <div className="gym-checkin-qr"><img src={info.image} width="256" height="256" alt="Mã QR thẻ số hội viên để lễ tân quét khi vào tập" /></div>
                  <strong className="gym-checkin-name">{info.fullName || 'Hội viên'}</strong>
                  <p className="member-muted">Mã hội viên: <strong>{info.memberCode || '—'}</strong></p>
                  <dl className="gym-checkin-details">
                    <div><dt>Gói tập</dt><dd>{info.packageName || 'Chưa có thông tin'}</dd></div>
                    <div><dt>Trạng thái gói</dt><dd>{packageLabel(info.packageStatus)}</dd></div>
                    <div><dt>Ngày hết hạn</dt><dd>{formatDate(info.expireDate, true)}</dd></div>
                  </dl>
                </div>
              )}
        </section>

        <aside className="gym-checkin-side">
          <section className="member-card gym-checkin-card gym-checkin-summary" aria-label="Tổng quan tập luyện">
            <div><span>Tổng lượt tập đã ghi nhận</span><strong>{history.loading || history.error ? '—' : records.length}</strong></div>
            <div><span>Lần vào tập gần nhất</span><strong>{history.loading || history.error ? '—' : formatDate(records[0]?.checkInTime)}</strong></div>
          </section>
          <section className="member-card gym-checkin-card gym-checkin-guide">
            <h3>Sử dụng thẻ số tại phòng gym</h3>
            <ol>
              <li>Mở mã QR cá nhân trên ứng dụng khi đến phòng tập.</li>
              <li>Đưa mã QR cho nhân viên lễ tân quét để ghi nhận lượt vào tập.</li>
              <li>Khi ra về, nhờ lễ tân ghi nhận check-out để hoàn tất buổi tập.</li>
            </ol>
            <p className="member-muted">Làm mới lịch sử sau khi lễ tân ghi nhận lượt ra/vào để xem thông tin mới nhất.</p>
          </section>
        </aside>
      </div>

      <section className="member-card gym-checkin-history" aria-labelledby="gym-history-title" aria-busy={history.loading}>
        <div className="gym-checkin-card-heading">
          <h3 id="gym-history-title"><History size={19} /> Lịch sử tập luyện</h3>
          <div className="gym-checkin-actions">
            <label htmlFor="gym-history-filter">Trạng thái</label>
            <select id="gym-history-filter" value={filter} onChange={event => { setFilter(event.target.value); setPage(1) }}>
              <option value="all">Tất cả lượt tập</option>
              <option value="ongoing">Chưa check-out</option>
              <option value="completed">Đã check-out</option>
            </select>
            <button type="button" className="member-button" disabled={history.loading} onClick={reloadHistory}>
              <RefreshCw size={15} /> Làm mới lịch sử
            </button>
          </div>
        </div>
        {history.loading ? <LoadingState>Đang tải lịch sử tập luyện...</LoadingState>
          : history.error ? <ErrorState message={history.error} retry={reloadHistory} />
            : filtered.length === 0 ? (
              <div className="gym-checkin-state" role="status"><History size={30} /><p>{records.length ? 'Không có lượt tập phù hợp với trạng thái đã chọn.' : 'Bạn chưa có lịch sử ra/vào phòng gym.'}</p></div>
            ) : (
              <>
                <div className="gym-checkin-table-scroll" role="region" aria-label="Bảng lịch sử ra/vào phòng gym" tabIndex={0}>
                  <table>
                    <thead><tr><th scope="col">Lượt tập</th><th scope="col">Giờ vào</th><th scope="col">Giờ ra</th><th scope="col">Thời lượng</th><th scope="col">Gói tập</th><th scope="col">Nhân viên ghi nhận</th><th scope="col">Ghi chú</th></tr></thead>
                    <tbody>
                      {visibleRecords.map(item => (
                        <tr key={item.id}>
                          <td><strong>#{item.id}</strong></td>
                          <td>{formatDate(item.checkInTime)}</td>
                          <td>{item.checkOutTime ? formatDate(item.checkOutTime) : <span className="gym-checkin-pending">Chưa check-out</span>}</td>
                          <td>{duration(item)}</td>
                          <td>{item.packageName || '—'}</td>
                          <td>{item.checkedByStaffName || '—'}</td>
                          <td className="gym-checkin-notes">{item.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="gym-checkin-pagination">
                  <span>{filtered.length} lượt tập · Trang {currentPage}/{totalPages}</span>
                  {totalPages > 1 && <div>
                    <button type="button" className="member-button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={15} /> Trang trước</button>
                    <button type="button" className="member-button" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Trang sau <ChevronRight size={15} /></button>
                  </div>}
                </div>
              </>
            )}
      </section>
    </div>
  )
}
