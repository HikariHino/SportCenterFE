import { Children, cloneElement, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NumberedList, NumberedPagination } from '../../components/NumberedPagination'
import { listPage } from '../../utils/listPagination'
import '../../style/member/MemberPagination.css'

export const MemberPagination = props => <NumberedPagination {...props} prefix="member" />

function ListLayout({ rows, pagination, as: Element, className, heading, compact, resetKey, table, label, layout }) {
  const scroll = useRef(null)
  const first = rows[0]?.props['data-stt']
  useLayoutEffect(() => { if (scroll.current) scroll.current.scrollTop = 0 }, [first, resetKey])
  return <div className={`member-paged-list${compact ? ' member-paged-list--compact' : ''}${layout !== 'default' ? ` member-paged-list--${layout}` : ''}`}>
    <div className="member-list-scroll" ref={scroll} role="region" aria-label={`${label || 'Danh sách'} - nội dung`} tabIndex={layout === 'flow' ? undefined : 0}>
      {table ? <table className={className} aria-label={label}><thead>{heading}</thead><tbody>{rows.map(row => cloneElement(row, {},
        <td className="member-stt" key="stt" aria-label={`STT ${row.props['data-stt']}`}>{row.props['data-stt']}</td>,
        ...Children.toArray(row.props.children)))}</tbody></table> : <>
        {heading && <div className="member-list-heading">{heading}</div>}
        <Element className={className} aria-label={label}>{rows}</Element>
      </>}
    </div>
    {pagination}
  </div>
}

export function MemberList({ items = [], page, total, onPageChange, as = 'div', className = '', heading, compact = false, table = false, resetKey = '', layout = 'default', hideSinglePagePagination = false, iconOnlyPagination = false, ...props }) {
  const [selection, setSelection] = useState({ resetKey, page: 1 })
  const remote = typeof onPageChange === 'function'
  const range = listPage(remote ? total : items.length, remote ? page : selection.resetKey === resetKey ? selection.page : 1)
  useEffect(() => {
    if (!remote && (selection.resetKey !== resetKey || selection.page !== range.page)) setSelection({ resetKey, page: range.page })
  }, [remote, resetKey, range.page, selection])
  if (!range.total) return null
  const visible = remote ? items : items.slice(range.offset, range.to)
  return <NumberedList {...props} items={visible} page={range.page} total={range.total} iconOnlyPagination={iconOnlyPagination} onPageChange={remote ? onPageChange : next => setSelection({ resetKey, page: next })} prefix="member" renderLayout={(rows, pagination) =>
    <ListLayout rows={rows} pagination={hideSinglePagePagination && range.pageCount === 1 ? null : pagination} as={as} className={className} heading={heading} compact={compact} resetKey={resetKey} table={table} label={props.label} layout={layout} />
  } />
}
