import { useEffect, useState } from 'react'
import { getMemberAiErrorMessage } from '../services/memberAiService'
import { useMemberResource } from '../contexts/MemberWorkspaceContext'
import { memberReadKey } from '../utils/memberWorkspaceRefresh'

export default function useMemberAiHistory(loader, active, pageSize = 10) {
  const [page, setPage] = useState(1)
  const [suspended, setSuspended] = useState(false)
  // Warm both AI histories on entry; generating answers remains an explicit action.
  const query = useMemberResource(memberReadKey(loader, { page, pageSize }), () => loader({ page, pageSize }), { enabled: !suspended })
  useEffect(() => {
    if (query.data) setPage(previous => Math.min(previous, Math.max(1, Math.ceil(query.data.total / pageSize))))
  }, [query.data, pageSize])
  const cancel = () => { setSuspended(true); query.cancel() }
  const resume = () => setSuspended(false)
  const reload = () => { setSuspended(false); return query.reload() }
  const latest = () => { setPage(1); reload() }
  const clear = () => {
    query.setData({ items: [], total: 0, page: 1, pageSize })
    setPage(1)
    reload()
  }
  const remove = id => {
    query.setData(previous => previous && { ...previous, items: previous.items.filter(item => String(item.id) !== String(id)), total: Math.max(0, previous.total - 1) })
    reload()
  }
  return { ...query, error: query.error ? getMemberAiErrorMessage(query.error) : '', page, pageSize, setPage, reload, latest, cancel, resume, clear, remove }
}
