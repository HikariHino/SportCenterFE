import { Children, cloneElement, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { receptionistPage, RECEPTIONIST_PAGE_SIZE } from '../../utils/receptionistPagination'
import '../../style/Receptionist/ReceptionistPagination.css'

export function ReceptionistPagination({ total, page = 1, onChange, label = 'Danh sách', disabled = false }) {
  const range = receptionistPage(total, page)
  if (!total) return null
  return <nav className="reception-pagination" aria-label={`Phân trang ${label}`}>
    <span role="status">{range.from}–{range.to} / {range.total} · {RECEPTIONIST_PAGE_SIZE} dòng/trang</span>
    <div><button type="button" disabled={disabled || range.page <= 1} onClick={() => onChange(range.page - 1)} aria-label={`Trang trước: ${label}`}><ChevronLeft size={15} />Trước</button>
      <label>Trang<select value={range.page} disabled={disabled} onChange={event => onChange(Number(event.target.value))} aria-label={`Chọn trang: ${label}`}>{Array.from({ length: range.pageCount }, (_, index) => <option value={index + 1} key={index}>{index + 1}</option>)}</select><span>/ {range.pageCount}</span></label>
      <button type="button" disabled={disabled || range.page >= range.pageCount} onClick={() => onChange(range.page + 1)} aria-label={`Trang sau: ${label}`}>Sau<ChevronRight size={15} /></button></div>
  </nav>
}

export function ReceptionistList({ items = [], children, label, resetKey = '', table = false, page, total, onPageChange, disabled, renderLayout }) {
  const [selection, setSelection] = useState({ resetKey, page: 1 })
  const remote = typeof onPageChange === 'function'
  const range = receptionistPage(remote ? total : items.length, remote ? page : selection.resetKey === resetKey ? selection.page : 1)
  const visibleItems = remote ? items.slice(0, RECEPTIONIST_PAGE_SIZE) : items.slice(range.offset, range.to)
  const rows = visibleItems.map((item, index) => {
    const ordinal = range.offset + index + 1
    const row = children(item, ordinal)
    return cloneElement(row, { key: row.key ?? item.id ?? ordinal, 'data-stt': ordinal, className: `${row.props.className || ''} ${table ? 'reception-numbered-row' : 'reception-numbered-item'}` },
      table ? [<span className="reception-stt" key="ordinal" aria-label={`STT ${ordinal}`}>{ordinal}</span>, ...Children.toArray(row.props.children)] : row.props.children)
  })
  const pagination = <ReceptionistPagination label={label} total={remote ? total : items.length} page={range.page} disabled={disabled} onChange={remote ? onPageChange : page => setSelection({ resetKey, page })} />
  return renderLayout ? renderLayout(rows, pagination) : <>{rows}{pagination}</>
}
