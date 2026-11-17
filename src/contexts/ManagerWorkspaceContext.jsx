import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { createWorkspaceResourceCache } from '../utils/workspaceResourceCache'
import { managerRefreshInterval, managerRelatedResources, watchManagerResource } from '../utils/managerWorkspaceRefresh'

const Workspace = createContext(null)
const View = createContext(true)

export function ManagerWorkspaceProvider({ sessionKey, children }) {
  const cache = useMemo(() => createWorkspaceResourceCache(), [sessionKey])
  useEffect(() => {
    const changed = () => cache.invalidate(['classes', 'class-sessions:*', 'attendance:*', 'report-classes', 'overview'])
    window.addEventListener('sportcenter:sessions-completed', changed)
    return () => window.removeEventListener('sportcenter:sessions-completed', changed)
  }, [cache])
  return <Workspace.Provider value={cache}>{children}</Workspace.Provider>
}

export function ManagerViewActivity({ active, children }) {
  return <View.Provider value={active}>{children}</View.Provider>
}
export const useManagerViewActive = () => useContext(View)

export function useManagerCache() {
  const shared = useContext(Workspace)
  const standalone = useRef(null)
  if (!shared && !standalone.current) standalone.current = createWorkspaceResourceCache()
  return shared || standalone.current
}

export function useManagerResource(key, loader, { initialData = null, enabled = true, paused = false, refreshKey = 0, interval = managerRefreshInterval(key) } = {}) {
  const cache = useManagerCache()
  const loaderRef = useRef(loader)
  loaderRef.current = loader
  const fallback = useRef({ key, data: initialData })
  if (fallback.current.key !== key) fallback.current = { key, data: initialData }
  const previousRefresh = useRef(refreshKey)
  const subscribe = useCallback(listener => cache.subscribe(key, listener), [cache, key])
  const snapshotForKey = useCallback(() => cache.snapshot(key), [cache, key])
  const snapshot = useSyncExternalStore(subscribe, snapshotForKey, snapshotForKey)
  const read = useCallback(async (force = false, background = false) => {
    try {
      await cache.load(key, () => loaderRef.current(), { force, background, staleTime: interval })
      if (cache.snapshot(key).updatedAt === -Infinity) await cache.load(key, () => loaderRef.current(), { force: true, staleTime: interval })
      return true
    } catch { return false }
  }, [cache, key, interval])

  useEffect(() => {
    if (!enabled || paused) return
    const force = previousRefresh.current !== refreshKey
    previousRefresh.current = refreshKey
    read(force)
  }, [read, enabled, paused, refreshKey, snapshot.invalidation])

  useEffect(() => {
    if (!enabled || paused) return
    return watchManagerResource(() => read(true, true), interval)
  }, [read, interval, enabled, paused])

  return {
    data: snapshot.hasData ? snapshot.data : fallback.current.data,
    hasData: snapshot.hasData,
    loading: enabled && !snapshot.hasData && !snapshot.error,
    refreshing: snapshot.hasData && snapshot.fetching,
    error: snapshot.error,
    setData: next => { cache.setData(key, next); cache.invalidate(managerRelatedResources(key)) },
    reload: () => { cache.invalidate([key, ...managerRelatedResources(key)]); return read(true) },
    cancel: () => cache.invalidate([key]),
  }
}
