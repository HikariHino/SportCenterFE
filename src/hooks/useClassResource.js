import { useMemberResource } from '../contexts/MemberWorkspaceContext'
import { memberReadKey } from '../utils/memberWorkspaceRefresh'
import { getMemberClassErrorMessage } from '../services/memberClassService'

export default function useClassResource(loader, params = {}, refreshKey = 0, { refreshInterval, resourceKey, paused = false } = {}) {
  const paramsKey = JSON.stringify(params)
  const query = useMemberResource(resourceKey || memberReadKey(loader, params), () => loader(JSON.parse(paramsKey)), {
    refreshKey, paused, ...(refreshInterval ? { interval: refreshInterval } : {}),
  })
  const error = query.error ? getMemberClassErrorMessage(query.error) : ''
  return { ...query, error: query.hasData ? '' : error, backgroundError: query.hasData ? error : '' }
}
