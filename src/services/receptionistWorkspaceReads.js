import { getMembers } from './memberService'
import { getRooms } from './roomService'
import { getPayments } from './paymentService'
import { getTodayCheckIns } from './gymCheckInService'
import { getSports, getCoaches } from './classCatalogService'
import { getAllSupportTickets } from './supportTicketService'
import { getProfile } from './profileService'

// Only safe list/profile GETs are prefetched. Payment writes and camera access
// always remain explicit actions, and pending-order fan-out is not prefetched.
export const receptionistReadTasks = [
  ['members', getMembers], ['rooms', getRooms], ['checkins', getTodayCheckIns],
  ['payments', getPayments], ['sports', getSports], ['coaches', getCoaches],
  ['support:all', () => getAllSupportTickets('all')], ['profile', getProfile],
]
