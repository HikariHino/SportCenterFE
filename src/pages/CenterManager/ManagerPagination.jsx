import { Children, cloneElement, isValidElement, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NumberedList, NumberedPagination } from '../../components/NumberedPagination'
import { listPage } from '../../utils/listPagination'
import '../../style/CenterManager/ManagerPagination.css'

export const ManagerPagination = props => <NumberedPagination {...props} prefix="manager" />

function ListLayout({ rows, pagination, as: Element, className, heading, compact, resetKey, table, tableFooter, label }) {
  const scroll = useRef(null)
  const first = rows[0]?.props['data-stt']
  useLayoutEffect(() => { if (scroll.current) scroll.current.scrollTop = 0 }, [first, resetKey])
  return <div className={`manager-paged-list${compact ? ' manager-paged-list--compact' : ''}`}>
    <div className="manager-list-scroll" ref={scroll} role="region" aria-label={`${label || 'Danh sách'} - nội dung`} tabIndex={0}>
      {table ? <table className={className} aria-label={label}><thead>{heading}</thead><tbody>{rows.map(row => cloneElement(row, {},
        <td className="manager-stt" key="stt" aria-label={`STT ${row.props['data-stt']}`}>{row.props['data-stt']}</td>,
        ...Children.toArray(row.props.children)))}</tbody>{tableFooter && cloneElement(tableFooter, {}, Children.toArray(tableFooter.props.children).map(row => isValidElement(row) ? cloneElement(row, {}, <td key="stt" aria-hidden="true" />, ...Children.toArray(row.props.children)) : row))}</table> : <>
        {heading && <div className="manager-list-heading">{heading}</div>}
        <Element className={className} aria-label={label}>{rows}</Element>
      </>}
    </div>
    {pagination}
  </div>
}

export function ManagerList({ items = [], page, total, onPageChange, as = 'div', className = '', heading, tableFooter, compact = false, table = false, hideSinglePagePagination = false, resetKey = '', ...props }) {
  const [selection, setSelection] = useState({ resetKey, page: 1 })
  const remote = typeof onPageChange === 'function'
  const range = listPage(remote ? total : items.length, remote ? page : selection.resetKey === resetKey ? selection.page : 1)
  useEffect(() => {
    if (!remote && (selection.resetKey !== resetKey || selection.page !== range.page)) setSelection({ resetKey, page: range.page })
  }, [remote, resetKey, range.page, selection])
  if (!range.total) return <div className="manager-list-empty" role="status">Không có dữ liệu phù hợp.</div>
  const visible = remote ? items : items.slice(range.offset, range.to)
  return <NumberedList {...props} items={visible} page={range.page} total={range.total} onPageChange={remote ? onPageChange : next => setSelection({ resetKey, page: next })} prefix="manager" renderLayout={(rows, pagination) =>
    <ListLayout rows={rows} pagination={hideSinglePagePagination && range.pageCount === 1 ? null : pagination} as={as} className={className} heading={heading} compact={compact} resetKey={resetKey} table={table} tableFooter={tableFooter} label={props.label} />
  } />
}
