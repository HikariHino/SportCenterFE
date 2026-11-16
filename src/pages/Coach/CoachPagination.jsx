import { NumberedList, NumberedPagination } from '../../components/NumberedPagination'
import '../../style/Coach/CoachPagination.css'
export const CoachPagination = props => <NumberedPagination {...props} prefix="coach" />
export const CoachList = props => <NumberedList {...props} prefix="coach" />
