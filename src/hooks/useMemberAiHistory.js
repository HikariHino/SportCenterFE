import { useEffect, useRef, useState } from 'react'
import { getMemberAiErrorMessage } from '../services/memberAiService'

export default function useMemberAiHistory(loader, active, pageSize = 10) {
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState({ data: null, loading: false, error: '' })
  const requestRef = useRef(null)
  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    requestRef.current = controller
    setState(previous => ({ ...previous, loading: true, error: '' }))
    loader({ page, pageSize }, { signal: controller.signal }).then(data => {
      if (controller.signal.aborted) return
      const lastPage = Math.max(1, Math.ceil(data.total / pageSize))
      if (page > lastPage) { setPage(lastPage); return }
      setState({ data, loading: false, error: '' })
    }).catch(error => {
      if (!controller.signal.aborted) setState(previous => ({ ...previous, loading: false, error: getMemberAiErrorMessage(error) }))
    })
    return () => { controller.abort(); if (requestRef.current === controller) requestRef.current = null }
  }, [loader, active, page, pageSize, revision])
  const cancel = () => { requestRef.current?.abort(); setState(previous => ({ ...previous, loading: false })) }
  const reload = () => setRevision(value => value + 1)
  const latest = () => { setPage(1); reload() }
  const clear = () => {
    cancel()
    setState({ data: { items: [], total: 0, page: 1, pageSize }, loading: false, error: '' })
    setPage(1)
    reload()
  }
  const remove = id => {
    cancel()
    setState(previous => ({ ...previous, data: previous.data && { ...previous.data, items: previous.data.items.filter(item => String(item.id) !== String(id)), total: Math.max(0, previous.data.total - 1) } }))
    reload()
  }
  return { ...state, page, pageSize, setPage, reload, latest, cancel, clear, remove }
}
