import { useSearchParams } from 'react-router-dom'
import { getPortalView, getPortalViewSearch } from '../utils/portalNavigation'

export default function usePortalNavigation(allowedViews, fallback, initialView) {
  const [searchParams, setSearchParams] = useSearchParams()
  const view = getPortalView(searchParams, allowedViews, fallback, initialView)

  const selectView = nextView => {
    if (nextView === view || !allowedViews.includes(nextView)) return
    setSearchParams(current => getPortalViewSearch(current, nextView, allowedViews))
  }

  return [view, selectView]
}
