// A browser lock belongs to a live document and disappears even if the tab is
// closed without running unload handlers. No timeout or heartbeat can expire a
// sleeping/background tab. BroadcastChannel covers browsers without Web Locks.
export function createBrowserSessionPresence({ locks, createChannel, timeout = 500 } = {}) {
  let currentId, controller, channel
  const name = id => `sportcenter:open-session:${id}`
  const stop = () => {
    controller?.abort()
    controller = null
    channel?.close()
    channel = null
    currentId = null
  }
  return {
    start(id) {
      if (currentId === id) return
      stop()
      currentId = id
      if (locks?.request) {
        controller = new AbortController()
        const { signal } = controller
        void locks.request(name(id), { mode: 'shared', signal }, () => new Promise(resolve => {
          if (signal.aborted) resolve()
          else signal.addEventListener('abort', resolve, { once: true })
        })).catch(() => {})
      }
      if (createChannel) {
        channel = createChannel(name(id))
        channel.onmessage = event => {
          if (event.data?.type === 'probe') channel?.postMessage({ type: 'alive', nonce: event.data.nonce })
        }
      }
    },
    async hasLiveTab(id) {
      if (locks?.query) {
        try {
          const snapshot = await locks.query()
          return [...snapshot.held, ...snapshot.pending].some(lock => lock.name === name(id))
        } catch { /* Try the channel if lock inspection is unavailable. */ }
      }
      if (!createChannel) return false
      const probe = createChannel(name(id))
      const nonce = globalThis.crypto?.randomUUID?.() || String(Math.random())
      return new Promise(resolve => {
        const finish = value => { clearTimeout(timer); probe.close(); resolve(value) }
        const timer = setTimeout(() => finish(false), timeout)
        probe.onmessage = event => {
          if (event.data?.type === 'alive' && event.data.nonce === nonce) finish(true)
        }
        probe.postMessage({ type: 'probe', nonce })
      })
    },
    stop,
  }
}

let presence
export function getBrowserSessionPresence() {
  if (!presence) presence = createBrowserSessionPresence({
    locks: globalThis.navigator?.locks,
    createChannel: typeof globalThis.window?.BroadcastChannel === 'function'
      ? name => new window.BroadcastChannel(name) : undefined,
  })
  return presence
}
