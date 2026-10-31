import { useEffect, useId, useRef } from 'react'
import { ChevronLeft, ChevronRight, LoaderCircle, RefreshCw, Trash2, X } from 'lucide-react'
import '../../style/member/MemberAiHistory.css'

export function AiHistoryControls({ history, disabled, label }) {
  const pages = Math.max(1, Math.ceil((history.data?.total || 0) / history.pageSize))
  return <div className="member-ai-history-controls" aria-label={label}>
    <span>{history.data?.total ?? '—'} bản ghi · Trang {history.page}/{pages}</span>
    <div><button type="button" disabled={disabled || history.loading} onClick={history.reload} aria-label={`Làm mới ${label}`}><RefreshCw size={14} /></button>
      <button type="button" disabled={disabled || history.loading || history.page <= 1} onClick={() => history.setPage(history.page - 1)}><ChevronLeft size={14} />Mới hơn</button>
      <button type="button" disabled={disabled || history.loading || history.page >= pages} onClick={() => history.setPage(history.page + 1)}>Cũ hơn<ChevronRight size={14} /></button></div>
  </div>
}

export function AiDeleteConfirmation({ title, children, busy, error, onClose, onConfirm }) {
  const dialogRef = useRef(null)
  const titleId = useId()
  useEffect(() => { const dialog = dialogRef.current; dialog.showModal(); return () => dialog.close() }, [])
  return <dialog ref={dialogRef} className="member-ai-delete-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <form onSubmit={event => { event.preventDefault(); if (!busy) onConfirm() }}>
      <header><h3 id={titleId}>{title}</h3><button type="button" aria-label="Đóng xác nhận xóa" disabled={busy} onClick={onClose}><X size={18} /></button></header>
      <div>{children}{error && <p className="member-ai-history-error" role="alert">{error}</p>}</div>
      <footer><button type="button" autoFocus disabled={busy} onClick={onClose}>Quay lại</button><button type="submit" className="danger" disabled={busy}>{busy ? <LoaderCircle size={15} className="member-spin" /> : <Trash2 size={15} />}{busy ? 'Đang xóa...' : 'Xác nhận xóa'}</button></footer>
    </form>
  </dialog>
}
