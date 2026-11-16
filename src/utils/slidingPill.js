// A single decorative background follows the active button. Offsets deliberately
// ignore hover transforms so the pill aligns to the button's resting position.
export function attachSlidingPill(container, pill, {
  Observer = globalThis.ResizeObserver,
  requestFrame = callback => window.requestAnimationFrame(callback),
  cancelFrame = id => window.cancelAnimationFrame(id),
  viewport = window,
} = {}) {
  if (!container || !pill) return { update() {}, dispose() {} }
  let disposed = false
  let frame = null

  const update = () => {
    if (disposed) return
    const active = container.querySelector('button[aria-pressed="true"]')
    if (!active || !active.offsetWidth || !active.offsetHeight) {
      delete container.dataset.pillReady
      delete container.dataset.pillAnimated
      if (frame !== null) cancelFrame(frame)
      frame = null
      return
    }
    pill.style.width = `${active.offsetWidth}px`
    pill.style.height = `${active.offsetHeight}px`
    pill.style.transform = `translate3d(${active.offsetLeft}px, ${active.offsetTop}px, 0)`
    container.dataset.pillReady = 'true'
    // Position the first frame immediately, then enable subsequent transitions.
    if (!container.dataset.pillAnimated && frame === null) {
      frame = requestFrame(() => {
        frame = null
        if (!disposed && container.dataset.pillReady) container.dataset.pillAnimated = 'true'
      })
    }
  }

  const observer = typeof Observer === 'function' ? new Observer(update) : null
  observer?.observe(container)
  viewport.addEventListener('resize', update)
  update()
  return {
    update,
    dispose() {
      disposed = true
      if (frame !== null) cancelFrame(frame)
      observer?.disconnect()
      viewport.removeEventListener('resize', update)
      delete container.dataset.pillReady
      delete container.dataset.pillAnimated
      for (const property of ['width', 'height', 'transform']) pill.style.removeProperty(property)
    },
  }
}
