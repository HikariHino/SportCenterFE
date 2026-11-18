const noMotion = () => {}
const easing = 'cubic-bezier(.22, 1, .36, 1)'

export function playProfileMorph(element, fromHeight, { matchMedia = query => window.matchMedia(query) } = {}) {
  if (!element || typeof element.animate !== 'function' || !Number.isFinite(fromHeight) || fromHeight <= 0) return noMotion
  const media = matchMedia('(prefers-reduced-motion: reduce)')
  if (media.matches) return noMotion
  const toHeight = element.getBoundingClientRect().height
  if (!Number.isFinite(toHeight) || toHeight <= 0) return noMotion
  const animations = []
  const overflow = element.style.overflow
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    media.removeEventListener?.('change', reduce)
    animations.forEach(animation => animation.cancel())
    element.style.overflow = overflow
  }
  const reduce = event => { if (event.matches) dispose() }
  try {
    element.style.overflow = 'hidden'
    animations.push(element.animate([{ height: `${fromHeight}px` }, { height: `${toHeight}px` }], {
      duration: 360, easing, fill: 'none',
    }))
    // Fade the new form or read-only details without replacing their DOM nodes.
    for (const child of [...element.children].slice(1)) {
      if (typeof child.animate !== 'function') continue
      animations.push(child.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], {
        duration: 240, delay: 35, easing, fill: 'backwards',
      }))
    }
    media.addEventListener?.('change', reduce)
  } catch { dispose() }
  Promise.allSettled(animations.map(animation => animation.finished)).then(dispose)
  return dispose
}
