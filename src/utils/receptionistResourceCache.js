// Read-only view data belongs to one mounted Receptionist workspace, never storage.
export function createReceptionistResourceCache({ now = Date.now } = {}) {
  const entries = new Map()
  const listeners = new Map()
  let generation = 0
  const empty = () => ({ data: undefined, hasData: false, fetching: false, error: null, updatedAt: 0, invalidation: 0 })
  const entry = key => {
    if (!entries.has(key)) entries.set(key, { snapshot: empty(), request: null, version: 0 })
    return entries.get(key)
  }
  const publish = (key, value, changes) => {
    value.snapshot = { ...value.snapshot, ...changes }
    listeners.get(key)?.forEach(listener => listener())
  }
  return {
    snapshot(key) { return entry(key).snapshot },
    subscribe(key, listener) {
      if (!listeners.has(key)) listeners.set(key, new Set())
      listeners.get(key).add(listener)
      return () => { listeners.get(key)?.delete(listener); if (!listeners.get(key)?.size) listeners.delete(key) }
    },
    load(key, loader, { force = false, staleTime = 30000 } = {}) {
      const value = entry(key)
      if (value.request) return value.request
      if (!force && value.snapshot.hasData && now() - value.snapshot.updatedAt < staleTime) return Promise.resolve(value.snapshot.data)
      const currentGeneration = generation
      const version = value.version
      const request = Promise.resolve().then(loader).then(data => {
        if (generation === currentGeneration && value.version === version) publish(key, value, { data, hasData: true, error: null, updatedAt: now() })
        return data
      }, error => {
        if (generation === currentGeneration && value.version === version) publish(key, value, { error })
        throw error
      }).finally(() => {
        if (value.request === request) {
          value.request = null
          if (generation === currentGeneration) publish(key, value, { fetching: false })
        }
      })
      value.request = request
      publish(key, value, { fetching: true, error: null })
      return request
    },
    setData(key, next) {
      const value = entry(key)
      value.version++ // A late background response cannot overwrite a confirmed mutation.
      const data = typeof next === 'function' ? next(value.snapshot.data) : next
      publish(key, value, { data, hasData: true, error: null, updatedAt: now() })
    },
    invalidate(keys) {
      const selected = new Set(keys.flatMap(key => key.endsWith(':*') ? [...entries.keys()].filter(candidate => candidate.startsWith(key.slice(0, -1))) : [key]))
      selected.forEach(key => {
        const value = entry(key)
        value.version++
        publish(key, value, { updatedAt: -Infinity, invalidation: value.snapshot.invalidation + 1 })
      })
    },
    clear() {
      generation++
      entries.clear()
      listeners.forEach(set => set.forEach(listener => listener()))
    },
  }
}

export async function prefetchReceptionistResources(cache, tasks, { isCancelled = () => false } = {}) {
  let next = 0
  async function worker() {
    while (!isCancelled() && next < tasks.length) {
      const [key, loader] = tasks[next++]
      try { await cache.load(key, loader) } catch { /* A visible tab owns its error/retry UI. */ }
    }
  }
  await Promise.all([worker(), worker()])
}
