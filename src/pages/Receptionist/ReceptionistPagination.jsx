import { NumberedList, NumberedPagination } from '../../components/NumberedPagination'
import '../../style/Receptionist/ReceptionistPagination.css'
export const ReceptionistPagination = props => <NumberedPagination {...props} prefix="reception" />
export const ReceptionistList = props => <NumberedList {...props} prefix="reception" />
