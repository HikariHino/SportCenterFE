export const MEMBER_FAST_REFRESH = 10000
export const MEMBER_NORMAL_REFRESH = 30000

export function memberRefreshInterval(key) {
  return /^(subscriptions|subscription-data|payments|registrations|available-sessions|notifications|gym-history)(:|$)/.test(key)
    ? MEMBER_FAST_REFRESH : MEMBER_NORMAL_REFRESH
}

// Background reads pause in hidden windows and never overlap for one resource.
export function watchMemberResource(refresh, interval, { viewport = window, document = globalThis.document } = {}) {
  const visible = () => { if (document.visibilityState === 'visible') refresh() }
  const timer = viewport.setInterval(visible, interval)
  viewport.addEventListener('focus', visible)
  document.addEventListener('visibilitychange', visible)
  return () => {
    viewport.clearInterval(timer)
    viewport.removeEventListener('focus', visible)
    document.removeEventListener('visibilitychange', visible)
  }
}

const readerIds = new WeakMap()
let nextReader = 0
export function memberReadKey(loader, params = {}) {
  if (!readerIds.has(loader)) readerIds.set(loader, ++nextReader)
  return `member-read:${readerIds.get(loader)}:${JSON.stringify(params)}`
}
