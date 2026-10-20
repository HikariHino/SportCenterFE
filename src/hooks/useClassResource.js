import { useCallback, useEffect, useState } from 'react'
import { getMemberClassErrorMessage } from '../services/memberClassService'

export default function useClassResource(loader, params = {}, refreshKey = 0, { refreshInterval = 0 } = {}) {
  const key = JSON.stringify(params)
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  const requestKey = JSON.stringify([key, revision, refreshKey])
  const reload = useCallback(() => setRevision(value => value + 1), [])
  useEffect(() => {
    let active = true
    let initialDone = false
    let refreshing = false
    setState({ data: null, loading: true, error: '', requestKey })
    loader(JSON.parse(key)).then(data => {
      initialDone = true
      if (active) setState({ data, loading: false, error: '', requestKey })
    }).catch(error => {
      initialDone = true
      if (active) setState({ data: null, loading: false, error: getMemberClassErrorMessage(error), requestKey })
    })
    const refreshVisible = async () => {
      if (!active || !initialDone || refreshing || document.visibilityState !== 'visible') return
      refreshing = true
      try {
        const data = await loader(JSON.parse(key))
        if (active) setState({ data, loading: false, error: '', backgroundError: '', requestKey })
      } catch (error) {
        if (active) setState(previous => ({ ...previous, backgroundError: getMemberClassErrorMessage(error) }))
      } finally { refreshing = false }
    }
    if (refreshInterval > 0) {
      const timer = window.setInterval(refreshVisible, refreshInterval)
      window.addEventListener('focus', refreshVisible)
      document.addEventListener('visibilitychange', refreshVisible)
      return () => {
        active = false
        window.clearInterval(timer)
        window.removeEventListener('focus', refreshVisible)
        document.removeEventListener('visibilitychange', refreshVisible)
      }
    }
    return () => { active = false }
  }, [loader, key, requestKey, refreshInterval])
  return { ...(state.requestKey === requestKey ? state : { data: null, loading: true, error: '' }), reload }
}
