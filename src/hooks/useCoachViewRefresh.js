import { useEffect, useRef, useState } from 'react'

const refreshEvent = 'sportcenter:coach-data-changed'
const refreshInterval = 60_000

export function notifyCoachDataChanged(source) {
  window.dispatchEvent(new CustomEvent(refreshEvent, { detail: source }))
}

// Coach panels stay mounted after their initial load. Revalidate stale panels
// when they become visible, without replacing their existing content.
export default function useCoachViewRefresh(active, view) {
  const [version, setVersion] = useState(0)
  const lastRefresh = useRef(Date.now())

  useEffect(() => {
    const refresh = () => {
      if (!active || document.visibilityState === 'hidden') return
      if (Date.now() - lastRefresh.current < refreshInterval) return
      lastRefresh.current = Date.now()
      setVersion(value => value + 1)
    }
    const onDataChanged = event => {
      if (event.detail === view) {
        lastRefresh.current = Date.now()
        return
      }
      lastRefresh.current = 0
      refresh()
    }

    refresh()
    const timer = active ? window.setInterval(refresh, refreshInterval) : null
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener(refreshEvent, onDataChanged)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener(refreshEvent, onDataChanged)
    }
  }, [active, view])

  return version
}
