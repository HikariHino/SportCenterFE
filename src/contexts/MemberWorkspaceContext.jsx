import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { createWorkspaceResourceCache } from '../utils/workspaceResourceCache'
import { memberRefreshInterval, watchMemberResource } from '../utils/memberWorkspaceRefresh'

const Workspace = createContext(null)
const View = createContext(true)

export function MemberWorkspaceProvider({ sessionKey, children }) {
  const cache = useMemo(() => createWorkspaceResourceCache(), [sessionKey])
  return <Workspace.Provider value={cache}>{children}</Workspace.Provider>
}

export function MemberViewActivity({ active, children }) {
  return <View.Provider value={active}>{children}</View.Provider>
}
export const useMemberViewActive = () => useContext(View)

export function useMemberCache() {
  const shared = useContext(Workspace)
  const standalone = useRef(null)
  if (!shared && !standalone.current) standalone.current = createWorkspaceResourceCache()
  return shared || standalone.current
}

export function useMemberResource(key, loader, { initialData = null, enabled = true, paused = false, refreshKey = 0, interval = memberRefreshInterval(key) } = {}) {
  const cache = useMemberCache()
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
    return watchMemberResource(() => read(true, true), interval)
  }, [read, interval, enabled, paused])

  return {
    data: snapshot.hasData ? snapshot.data : fallback.current.data,
    hasData: snapshot.hasData,
    loading: enabled && !snapshot.hasData && !snapshot.error,
    refreshing: snapshot.hasData && snapshot.fetching,
    error: snapshot.error,
    setData: next => cache.setData(key, next),
    reload: () => { cache.invalidate([key]); return read(true) },
    cancel: () => cache.invalidate([key]),
  }
}

export const MEMBER_TRANSACTION_RESOURCES = ['subscriptions', 'subscription-data', 'payments', 'registrations', 'available-sessions', 'available-sessions:*', 'gym-history:*']
