import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Bell, CheckCheck, ChevronLeft, ChevronRight, LoaderCircle, RefreshCw } from 'lucide-react'
import { getNotifications, markNotificationRead, markAllNotificationsRead, getNotificationErrorMessage } from '../../services/notificationService'
import { isSessionUpdateNotification } from '../../utils/sessionNotifications'
import '../../style/member/NotificationsView.css'

const PAGE_SIZE = 10

function formatDate(value) {
  if (!value) return 'Chưa cập nhật thời gian'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Chưa cập nhật thời gian' : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

export function NotificationsView({ refreshKey = 0, onNotificationsChange, onViewSchedule, unreadCount }) {
  const [result, setResult] = useState({ items: [], total: 0, pageSize: PAGE_SIZE })
  const [page, setPage] = useState(1)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [markingId, setMarkingId] = useState(null)
  const [markingAll, setMarkingAll] = useState(false)
  const actionBusy = markingAll || markingId !== null
  const locked = useRef(false)
  const mounted = useRef(true)
  const reload = () => setRevision(value => value + 1)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    getNotifications({ unreadOnly, page, pageSize: PAGE_SIZE }).then(data => {
      if (!active) return
      const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize))
      if (page > lastPage) {
        setPage(lastPage)
        return
      }
      setResult(data)
      setLoading(false)
    }).catch(requestError => {
      if (!active) return
      setError(getNotificationErrorMessage(requestError, 'Không thể tải thông báo.'))
      setLoading(false)
    })
    return () => { active = false }
  }, [page, unreadOnly, revision, refreshKey])

  const markRead = async item => {
    if (locked.current || item.isRead) return
    locked.current = true
    setMarkingId(item.id)
    setActionError('')
    setNotice('')
    try {
      await markNotificationRead(item.id)
      // Notify the parent even if this list was unmounted while the request completed.
      onNotificationsChange?.()
      if (!mounted.current) return
      setNotice('Đã đánh dấu thông báo là đã đọc.')
      reload()
    } catch (requestError) {
      if (mounted.current) setActionError(getNotificationErrorMessage(requestError, 'Không thể đánh dấu đã đọc.'))
    } finally {
      locked.current = false
      if (mounted.current) setMarkingId(null)
    }
  }

  const changeFilter = value => {
    setUnreadOnly(value)
    setPage(1)
    setActionError('')
    setNotice('')
  }
  const markAllRead = async () => {
    if (locked.current) return
    locked.current = true
    setMarkingAll(true)
    setActionError('')
    setNotice('')
    try {
      const outcome = await markAllNotificationsRead()
      if (!mounted.current) return
      setNotice((outcome.total ? `Đã đọc ${outcome.read}/${outcome.total} thông báo.` : outcome.requiresReview ? '' : 'Bạn đã đọc hết thông báo.') + (outcome.requiresReview ? ` Có ${outcome.requiresReview} thông báo thay đổi lịch cần kiểm tra và xác nhận.` : ''))
      if (outcome.failed.length) setActionError(`Còn ${outcome.failed.length} thông báo chưa cập nhật được. Vui lòng bấm Đọc tất cả để thử lại.`)
    } catch (requestError) {
      if (mounted.current) setActionError(getNotificationErrorMessage(requestError, 'Không thể đọc tất cả thông báo.'))
    } finally {
      locked.current = false
      onNotificationsChange?.()
      if (mounted.current) { setMarkingAll(false); reload() }
    }
  }
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize))

  return <div className="member-view-stack member-notifications-view">
    <div className="member-section-heading">
      <div><p className="member-eyebrow"><Bell size={16} /> CẬP NHẬT DÀNH CHO BẠN</p><h2>Thông báo hệ thống</h2><p className="member-notifications-muted">Theo dõi thay đổi lịch học, huấn luyện viên, thanh toán và gói tập.</p></div>
      <div className="member-notifications-heading-actions">
        <button type="button" className="member-notifications-read-all" disabled={loading || actionBusy || Boolean(error) || result.total === 0 || unreadCount === 0} onClick={markAllRead}>{markingAll ? <LoaderCircle className="member-spin" size={16} /> : <CheckCheck size={16} />}{markingAll ? 'Đang đọc...' : 'Đọc tất cả'}</button>
        <button type="button" disabled={loading || actionBusy} onClick={() => { reload(); onNotificationsChange?.() }}><RefreshCw size={16} /> Làm mới</button>
      </div>
    </div>
    <div className="member-notifications-filters" role="group" aria-label="Lọc thông báo">
      <button type="button" aria-pressed={!unreadOnly} onClick={() => changeFilter(false)}>Tất cả thông báo</button>
      <button type="button" aria-pressed={unreadOnly} onClick={() => changeFilter(true)}>Chưa đọc</button>
    </div>
    {notice && <p className="member-notifications-notice" role="status"><CheckCheck size={18} />{notice}</p>}
    {actionError && <p className="member-notifications-error" role="alert">{actionError}</p>}
    <section aria-label={unreadOnly ? 'Thông báo chưa đọc' : 'Tất cả thông báo'} aria-busy={loading}>
      {loading ? <div className="member-notifications-state" role="status"><LoaderCircle className="member-spin" size={28} /><p>Đang tải thông báo...</p></div>
        : error ? <div className="member-notifications-state member-notifications-error" role="alert"><AlertCircle size={28} /><h3>Không thể tải thông báo</h3><p>{error}</p><button type="button" onClick={reload}>Thử lại</button></div>
          : !result.items.length ? <div className="member-notifications-state" role="status"><Bell size={36} /><h3>{unreadOnly ? 'Bạn đã đọc hết thông báo' : 'Chưa có thông báo'}</h3><p>{unreadOnly ? 'Chọn “Tất cả thông báo” để xem lại các thông báo đã đọc.' : 'Các thông báo gửi đến tài khoản của bạn sẽ xuất hiện tại đây.'}</p></div>
            : <>
              <p className="member-notifications-count">{result.total} thông báo{unreadOnly ? ' chưa đọc' : ''}</p>
              <div className="member-notifications-list">{result.items.map(item => <article className={`member-notifications-card ${item.isRead ? '' : 'unread'}`} key={item.id} aria-labelledby={`member-notification-${item.id}`}>
                <span className="member-notifications-icon"><Bell size={21} /></span>
                <div className="member-notifications-content">
                  <header><span className="member-notifications-badge">{item.isRead ? 'Đã đọc' : 'Chưa đọc'}</span><span className="member-notifications-muted">{formatDate(item.sentAt)}</span></header>
                  <h3 id={`member-notification-${item.id}`}>{item.title || 'Thông báo từ trung tâm'}</h3>
                  <p>{item.content}</p>
                  {isSessionUpdateNotification(item) && <div className="member-session-update-notice"><p>Vui lòng kiểm tra ngày, giờ và HLV trong lịch đã đặt (giờ Việt Nam). Đăng ký của bạn được giữ nguyên. Nếu không thể tham gia, bạn có thể tự hủy đăng ký theo hạn hủy của buổi học.</p>{onViewSchedule && <button type="button" onClick={() => onViewSchedule(item)}>Xem lịch đã đặt</button>}</div>}
                  {!item.isRead && !isSessionUpdateNotification(item) && <button type="button" disabled={actionBusy} onClick={() => markRead(item)}>{markingId === item.id ? <><LoaderCircle className="member-spin" size={15} /> Đang cập nhật...</> : <><CheckCheck size={15} /> Đánh dấu đã đọc</>}</button>}
                </div>
              </article>)}</div>
              {totalPages > 1 && <nav className="member-notifications-pagination" aria-label="Phân trang thông báo"><span>Trang {page}/{totalPages}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={15} /> Trang trước</button><button type="button" disabled={page >= totalPages} onClick={() => setPage(value => value + 1)}>Trang sau <ChevronRight size={15} /></button></div></nav>}
            </>}
    </section>
  </div>
}
