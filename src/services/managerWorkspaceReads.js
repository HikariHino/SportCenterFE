import { getManagedClassesWithSessionDates } from './sportClassService'
import { getAllListPages } from '../utils/listPagination'

export const getAllManagerClasses = () => getAllListPages((page, pageSize) => getManagedClassesWithSessionDates({ page, pageSize }))
