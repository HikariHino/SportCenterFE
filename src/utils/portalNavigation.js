export function getPortalView(search, allowedViews, fallback, initialView) {
  const selected = new URLSearchParams(search).get('view')
  if (allowedViews.includes(selected)) return selected
  if (selected === null && allowedViews.includes(initialView)) return initialView
  return fallback
}

export function getPortalViewSearch(search, view, allowedViews) {
  if (!allowedViews.includes(view)) return null
  const next = new URLSearchParams(search)
  next.set('view', view)
  return next
}
