import { useCallback, useEffect, useState } from 'react'
import { getMemberClassErrorMessage } from '../services/memberClassService'

export default function useClassResource(loader, params = {}, refreshKey = 0) {
  const key = JSON.stringify(params)
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  const requestKey = JSON.stringify([key, revision, refreshKey])
  const reload = useCallback(() => setRevision(value => value + 1), [])
  useEffect(() => {
    let active = true
    setState({ data: null, loading: true, error: '', requestKey })
    loader(JSON.parse(key)).then(data => {
      if (active) setState({ data, loading: false, error: '', requestKey })
    }).catch(error => {
      if (active) setState({ data: null, loading: false, error: getMemberClassErrorMessage(error), requestKey })
    })
    return () => { active = false }
  }, [loader, key, requestKey])
  return { ...(state.requestKey === requestKey ? state : { data: null, loading: true, error: '' }), reload }
}
