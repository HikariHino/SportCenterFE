export function readPortalPage(storage, key, allowedPages, fallback) {
  try {
    const storedPage = storage?.getItem(key)
    return allowedPages.includes(storedPage) ? storedPage : fallback
  } catch {
    return fallback
  }
}

export function storePortalPage(storage, key, page) {
  try {
    storage?.setItem(key, page)
  } catch {
    // Navigation must continue even when browser storage is unavailable.
  }
}

export function clearPortalPage(storage, key) {
  try {
    storage?.removeItem(key)
  } catch {
    // Logout must continue even when browser storage is unavailable.
  }
}
