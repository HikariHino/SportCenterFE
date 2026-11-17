import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { createReceptionistResourceCache } from '../utils/receptionistResourceCache'

const Workspace = createContext(null)
const ActiveView = createContext(true)

export function ReceptionistWorkspaceProvider({ sessionKey, children }) {
  const cache = useMemo(() => createReceptionistResourceCache(), [sessionKey])
  return <Workspace.Provider value={cache}>{children}</Workspace.Provider>
}

export function ReceptionistViewActivity({ active, children }) {
  return <ActiveView.Provider value={active}>{children}</ActiveView.Provider>
}

export const useReceptionistViewActive = () => useContext(ActiveView)

export function useReceptionistCache() {
  const shared = useContext(Workspace)
  const standalone = useRef(null)
  if (!shared && !standalone.current) standalone.current = createReceptionistResourceCache()
  return shared || standalone.current
}

export function useReceptionistResource(key, loader, { initialData, refreshKey = 0, enabled = true, staleTime = 30000 } = {}) {
  const cache = useReceptionistCache()
  const active = useReceptionistViewActive()
  const loaderRef = useRef(loader)
  loaderRef.current = loader
  const previousRefresh = useRef(refreshKey)
  const subscribe = useCallback(listener => cache.subscribe(key, listener), [cache, key])
  const getSnapshot = useCallback(() => cache.snapshot(key), [cache, key])
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    if (!active || !enabled) return
    let cancelled = false
    const force = previousRefresh.current !== refreshKey
    previousRefresh.current = refreshKey
    cache.load(key, () => loaderRef.current(), { force, staleTime }).then(() => {
      // A write may invalidate a read already in flight. Re-read once after it
      // settles so that obsolete response never becomes the visible result.
      if (!cancelled && cache.snapshot(key).updatedAt === -Infinity) cache.load(key, () => loaderRef.current(), { force: true, staleTime }).catch(() => {})
    }).catch(() => {})
    return () => { cancelled = true }
  }, [cache, key, active, enabled, refreshKey, staleTime, snapshot.invalidation])

  useEffect(() => {
    if (!active || !enabled) return
    const refresh = () => {
      if (document.visibilityState === 'visible') cache.load(key, () => loaderRef.current(), { background: true, staleTime }).catch(() => {})
    }
    const timer = window.setInterval(refresh, staleTime)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [cache, key, active, enabled, staleTime])

  return {
    data: snapshot.hasData ? snapshot.data : initialData,
    hasData: snapshot.hasData,
    loading: enabled && !snapshot.hasData && !snapshot.error,
    refreshing: snapshot.hasData && snapshot.fetching,
    error: snapshot.error,
    setData: next => cache.setData(key, next),
    refresh: () => cache.load(key, () => loaderRef.current(), { force: true, staleTime }),
  }
}
