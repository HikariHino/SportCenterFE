import { Children, cloneElement, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { listPage, LIST_PAGE_SIZE } from '../utils/listPagination'

export function NumberedPagination({ total, page = 1, onChange, label = 'Danh sách', disabled = false, prefix = 'list', iconOnly = false }) {
  const range = listPage(total, page)
  if (!total) return null
  return <nav className={`${prefix}-pagination`} aria-label={`Phân trang ${label}`}>
    <span role="status">{range.from}–{range.to} / {range.total} · {LIST_PAGE_SIZE} dòng/trang</span>
    <div><button type="button" disabled={disabled || range.page <= 1} onClick={() => onChange(range.page - 1)} aria-label={`Trang trước: ${label}`}><ChevronLeft size={15} />{!iconOnly && 'Trước'}</button>
      <label>{!iconOnly && 'Trang'}<select value={range.page} disabled={disabled} onChange={event => onChange(Number(event.target.value))} aria-label={`Chọn trang: ${label}`}>{Array.from({ length: range.pageCount }, (_, index) => <option value={index + 1} key={index}>{index + 1}</option>)}</select><span>/ {range.pageCount}</span></label>
      <button type="button" disabled={disabled || range.page >= range.pageCount} onClick={() => onChange(range.page + 1)} aria-label={`Trang sau: ${label}`}>{!iconOnly && 'Sau'}<ChevronRight size={15} /></button></div>
  </nav>
}

export function NumberedList({ items = [], children, label, resetKey = '', table = false, page, total, onPageChange, disabled, renderLayout, prefix = 'list', showOrdinal = true, iconOnlyPagination = false }) {
  const [selection, setSelection] = useState({ resetKey, page: 1 })
  const remote = typeof onPageChange === 'function'
  const range = listPage(remote ? total : items.length, remote ? page : selection.resetKey === resetKey ? selection.page : 1)
  const visibleItems = remote ? items.slice(0, LIST_PAGE_SIZE) : items.slice(range.offset, range.to)
  const rows = visibleItems.map((item, index) => {
    const ordinal = range.offset + index + 1
    const row = children(item, ordinal)
    return cloneElement(row, { key: row.key ?? item.id ?? ordinal, 'data-stt': ordinal, className: `${row.props.className || ''} ${table ? `${prefix}-numbered-row` : showOrdinal ? `${prefix}-numbered-item` : ''}`.trim() },
      table ? [<span className={`${prefix}-stt`} key="ordinal" aria-label={`STT ${ordinal}`}>{ordinal}</span>, ...Children.toArray(row.props.children)] : row.props.children)
  })
  const pagination = <NumberedPagination prefix={prefix} label={label} total={remote ? total : items.length} page={range.page} disabled={disabled} iconOnly={iconOnlyPagination} onChange={remote ? onPageChange : page => setSelection({ resetKey, page })} />
  return renderLayout ? renderLayout(rows, pagination) : <>{rows}{pagination}</>
}
