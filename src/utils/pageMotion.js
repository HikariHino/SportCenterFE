const easing = 'cubic-bezier(.22, 1, .36, 1)'
const noMotion = () => {}

function animate(element, frames, options, animations) {
  if (typeof element?.animate !== 'function') return
  try {
    const animation = element.animate(frames, { easing, fill: 'none', ...options })
    animations.add(animation)
    animation.finished?.then(() => animations.delete(animation), () => animations.delete(animation))
  } catch { /* Content stays visible when Web Animations are unavailable. */ }
}

function motionSession(media) {
  const animations = new Set()
  const cancel = () => { animations.forEach(animation => animation.cancel()); animations.clear() }
  const onChange = event => { if (event.matches) cancel() }
  media.addEventListener?.('change', onChange)
  return { animations, cancel, dispose() { cancel(); media.removeEventListener?.('change', onChange) } }
}

/** Animate the existing view; never key/remount forms, chat history or portals. */
export function playPageTransition(element, { matchMedia = query => window.matchMedia(query) } = {}) {
  if (!element || typeof element.animate !== 'function') return noMotion
  const media = matchMedia('(prefers-reduced-motion: reduce)')
  if (media.matches) return noMotion
  const session = motionSession(media)
  // Only opacity on the content root: transforms would reposition fixed dialogs.
  animate(element, [{ opacity: .45 }, { opacity: 1 }], { duration: 240 }, session.animations)
  const heading = element.querySelector('h1, h2')
  animate(heading, [{ opacity: .6, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 320 }, session.animations)
  return () => session.dispose()
}

/** Landing sections reveal once when entering the viewport, with no hidden base style. */
export function observePageReveals(element, selector, {
  matchMedia = query => window.matchMedia(query),
  Observer = globalThis.IntersectionObserver,
} = {}) {
  if (!element || !selector || typeof Observer !== 'function') return noMotion
  const media = matchMedia('(prefers-reduced-motion: reduce)')
  if (media.matches) return noMotion
  const session = motionSession(media)
  const revealed = new WeakSet()
  const observer = new Observer(entries => {
    if (media.matches) return
    for (const entry of entries) {
      if (!entry.isIntersecting || revealed.has(entry.target)) continue
      revealed.add(entry.target)
      observer.unobserve(entry.target)
      animate(entry.target, [{ opacity: .25, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 480 }, session.animations)
    }
  }, { threshold: .08, rootMargin: '0px 0px -24px 0px' })
  element.querySelectorAll(selector).forEach(section => observer.observe(section))
  return () => { observer.disconnect(); session.dispose() }
}
