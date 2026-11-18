import { RefreshCw } from 'lucide-react'

export default function RefreshStatus({ refreshing, error, onRetry }) {
  if (!error) return null
  return <div className={`coach-refresh-status${error ? ' is-error' : ''}`} role={error ? 'alert' : 'status'}>
    <RefreshCw size={14} aria-hidden="true" />
    <span>{error ? `${error} Đang giữ dữ liệu lần tải trước.` : 'Đang cập nhật dữ liệu mới...'}</span>
    {error && <button type="button" onClick={onRetry}>Thử lại</button>}
  </div>
}
