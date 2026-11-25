const paletteProperty = /^(?:background-color|color|border(?:-(?:top|right|bottom|left))?-color|outline-color|box-shadow|fill|stroke|text-decoration-color)$/

function finishPaletteTransitions(doc) {
  // Capture the final palette without interrupting transforms, drawers or page motion.
  const animations = doc.getAnimations?.() || []
  for (const animation of animations) {
    if (paletteProperty.test(animation.transitionProperty || '')) {
      try { animation.finish() } catch { /* A detached transition may already have ended. */ }
    }
  }
}

/** One viewport crossfade instead of animating every element's paint properties. */
export function createThemeTransition(doc = document, media = window.matchMedia('(prefers-reduced-motion: reduce)')) {
  const root = doc.documentElement
  let revision = 0
  let active = null
  let latestTheme = root.dataset.theme

  const writeTheme = theme => {
    const changed = root.dataset.theme !== theme
    root.dataset.theme = theme
    root.style.colorScheme = theme
    if (changed) finishPaletteTransitions(doc)
  }
  const stop = () => {
    const previous = active
    active = null
    try { previous?.skipTransition() } catch { /* Theme changes still work if the capture has ended. */ }
    root.classList.remove('theme-transitioning')
  }
  const onReducedMotion = event => {
    if (!event.matches) return
    revision++
    stop()
    if (latestTheme) writeTheme(latestTheme)
  }
  media.addEventListener?.('change', onReducedMotion)

  return {
    apply(theme, { animate = true } = {}) {
      const request = ++revision
      latestTheme = theme
      stop()
      const commit = () => { if (request === revision) writeTheme(theme) }

      // Initial paint, reduced motion and older browsers apply the palette immediately.
      if (!animate || root.dataset.theme === theme || media.matches || doc.visibilityState === 'hidden'
        || typeof doc.startViewTransition !== 'function') {
        commit()
        return
      }

      root.classList.add('theme-transitioning')
      try {
        const transition = doc.startViewTransition(commit)
        active = transition
        // Skips and unavailable snapshots reject ready, but must still apply the theme.
        transition.ready.catch(() => commit())
        transition.updateCallbackDone?.catch(() => commit())
        const complete = () => {
          if (request !== revision) return
          commit()
          active = null
          root.classList.remove('theme-transitioning')
        }
        transition.finished.then(complete, complete)
      } catch {
        commit()
        root.classList.remove('theme-transitioning')
      }
    },
    dispose() {
      revision++
      stop()
      if (latestTheme) writeTheme(latestTheme)
      media.removeEventListener?.('change', onReducedMotion)
    },
  }
}
