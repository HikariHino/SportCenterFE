import { getSessionRoom, roomSessionForTimetable } from '../utils/roomTimetable.js'
import { checkRoomAvailability } from './roomService'
import { createClassSession, getClassById, getClassErrorMessage, updateClassSession, updateSportClass } from './sportClassService'
import { buildSessionReschedule, sessionsOverlap } from '../utils/sessionReschedule.js'
import { loadClassTimetables, loadSchedulingContext, loadSchedulingPages as loadAllPages, withSessionWriteLock } from './sessionSchedulingService'
import { assertSessionCapacity, assertSessionSchedule } from '../utils/sessionScheduling.js'

export async function getRoomTimetableClasses({ signal } = {}) {
  return loadAllPages('/classes/manage', signal)
}

export async function getRoomTimetable(room, rooms, { signal } = {}) {
  const groups = await loadClassTimetables(signal)
  const sessions = []
  const unassignedClasses = []
  for (const { sportClass, items } of groups) {
    const unassigned = items.filter(item => !getSessionRoom(item, sportClass, rooms))
    if (unassigned.length) unassignedClasses.push({ ...sportClass, unassignedCount: unassigned.length })
    sessions.push(...items.map(item => roomSessionForTimetable(item, sportClass, rooms, room)).filter(Boolean))
  }
  return { items: sessions, unassignedClasses: unassignedClasses.sort((a, b) => String(a.className).localeCompare(String(b.className), 'vi')) }
}

export async function rescheduleRoomSession({ room, rooms, session, draft }) {
  if (room.isActive === false) throw new Error('Phòng đã ngừng hoạt động, không thể đổi lịch.')
  const groups = await loadClassTimetables()
  const group = groups.find(item => String(item.sportClass.id) === String(session.classId))
  const current = group?.items.find(item => String(item.id) === String(session.id))
  if (!current || !roomSessionForTimetable(current, group.sportClass, rooms, room)) throw new Error('Buổi học không còn thuộc phòng này. Vui lòng tải lại lịch.')
  if (Date.parse(current.startsAt) !== Date.parse(session.startsAt) || Date.parse(current.endsAt) !== Date.parse(session.endsAt)) {
    throw new Error('Buổi học đã được thay đổi. Hãy đóng biểu mẫu và làm mới lịch trước khi đổi tiếp.')
  }
  const payload = buildSessionReschedule(current, draft, { sportClass: group.sportClass })
  if (Date.parse(payload.startsAt) === Date.parse(current.startsAt) && Date.parse(payload.endsAt) === Date.parse(current.endsAt)) throw new Error('Hãy chọn ngày hoặc khung giờ khác lịch hiện tại.')
  // The room availability endpoint has no excludeSessionId. Check a fresh full
  // catalog and exclude this session, including overlapping moves on the same day.
  for (const { sportClass, items } of groups) {
    for (const item of items) {
      if (String(item.id) === String(current.id) && String(sportClass.id) === String(group.sportClass.id)) continue
      if (['cancelled', 'canceled'].includes(String(item.status || item.Status).toLowerCase()) || !sessionsOverlap(payload, item)) continue
      if (roomSessionForTimetable(item, sportClass, rooms, room)) throw new Error(`Phòng đã có buổi học ${item.className || sportClass.className} trong khung giờ này.`)
      if (String(item.coachId ?? sportClass.coachId) === String(payload.coachId)) throw new Error('Huấn luyện viên đã có buổi học khác trong khung giờ này.')
    }
  }
  await updateClassSession(group.sportClass.id, current.id, { ...payload, roomId: room.id })
  return { ...roomSessionForTimetable(current, group.sportClass, rooms, room), ...payload }
}

function assertClassRoom(sportClass, room, rooms) {
  const assigned = getSessionRoom({}, sportClass, rooms)
  if (assigned && !roomSessionForTimetable({}, sportClass, rooms, room)) {
    throw new Error(`Lớp đã được gán vào ${assigned.name || `phòng #${assigned.id}`}. Vui lòng tạo lịch tại phòng đó.`)
  }
  return assigned
}

function classScheduleForRoom(sportClass, room) {
  const schedule = `[Phòng: ${room.name}]${sportClass.schedule?.trim() ? ` ${sportClass.schedule.trim()}` : ''}`
  if (schedule.length > 1000) throw new Error('Thông tin lịch của lớp quá dài để lưu phòng. Vui lòng rút gọn lịch của lớp.')
  return schedule
}

export async function assignClassToRoom({ classId, room, rooms }) {
  return withSessionWriteLock(async () => {
    // SessionRequest has no room field. Persist the class room using the supported
    // schedule metadata, so sessions still resolve after reloading or signing in elsewhere.
    const context = await loadSchedulingContext(classId, room.id)
    const sportClass = context.sportClass
    room = context.room
    rooms = context.rooms
    if (!room) throw new Error('Phòng không còn tồn tại. Vui lòng tải lại.')
    if (assertClassRoom(sportClass, room, rooms)) return sportClass
    if (room.isActive === false) throw new Error('Phòng đã ngừng hoạt động, không thể gán lịch.')
    const { items: occupied } = await getRoomTimetable(room, rooms)
    const sessions = await loadAllPages(`/classes/${classId}/sessions`)
    const assigning = []
    for (const session of sessions.filter(item => !getSessionRoom(item, sportClass, rooms))) {
      if (['cancelled', 'canceled'].includes(String(session.status || session.Status).toLowerCase())) continue
      assertSessionCapacity(session.capacity, room, sportClass, session)
      if (assigning.some(item => sessionsOverlap(item, session))) throw new Error('Lớp đang có các buổi học trùng giờ. Hãy xử lý lịch trùng trước khi gán phòng.')
      assigning.push(session)
      if (occupied.some(item => String(item.classId) !== String(classId)
        && !['cancelled', 'canceled'].includes(String(item.status).toLowerCase())
        && Date.parse(item.startsAt) < Date.parse(session.endsAt) && Date.parse(session.startsAt) < Date.parse(item.endsAt))) {
        throw new Error(`Lịch lớp bị trùng với lịch đã có trong ${room.name}. Vui lòng kiểm tra lại giờ học.`)
      }
    }
    const schedule = classScheduleForRoom(sportClass, room)
    await updateSportClass(classId, { ...sportClass, schedule })
    const saved = await getClassById(classId)
    if (!roomSessionForTimetable({}, saved, rooms, room)) throw new Error('Máy chủ chưa lưu liên kết phòng cho lớp. Vui lòng thử lại.')
    return saved
  })
}

export async function createRecurringRoomSessions({ room, rooms, sportClass, coachId, cancellationPolicyId, capacity, sessions }, onProgress = () => {}) {
  const context = await loadSchedulingContext(sportClass.id, room.id)
  sportClass = context.sportClass
  room = context.room
  rooms = context.rooms
  if (!room) throw new Error('Phòng không còn tồn tại. Vui lòng tải lại.')
  if (room.isActive === false) throw new Error('Phòng đã ngừng hoạt động, không thể mở buổi học.')
  assertSessionCapacity(capacity, room, sportClass)
  if (!assertClassRoom(sportClass, room, rooms)) sportClass = { ...sportClass, schedule: classScheduleForRoom(sportClass, room) }
  context.groups.find(group => String(group.sportClass.id) === String(sportClass.id)).sportClass = sportClass
  sessions = [...new Map(sessions.map(item => [`${Date.parse(item.startsAt)}-${Date.parse(item.endsAt)}`, item])).values()]
  // Reconcile existing sessions before retries, including requests whose response was lost.
  const saved = await loadAllPages(`/classes/${sportClass.id}/sessions`)
  const existing = []
  const remaining = []
  for (const planned of sessions) {
    const found = saved.some(item => !['cancelled', 'canceled'].includes(String(item.status || item.Status).toLowerCase())
      && roomSessionForTimetable(item, sportClass, rooms, room)
      && Date.parse(item.startsAt) === Date.parse(planned.startsAt) && Date.parse(item.endsAt) === Date.parse(planned.endsAt)
      && String(item.coachId ?? sportClass.coachId) === String(coachId))
    if (found) existing.push(planned)
    else remaining.push(planned)
  }
  // Verify every date before sending any create requests.
  const conflicts = []
  const planned = { sportClass, items: [] }
  for (let index = 0; index < remaining.length; index += 1) {
    const item = remaining[index]
    onProgress({ phase: 'checking', completed: index, total: remaining.length })
    try {
      const data = { ...item, coachId, cancellationPolicyId, capacity }
      assertSessionSchedule({ ...context, sportClass, groups: [...context.groups, planned], data })
      planned.items.push({ ...data, id: `planned-${index}`, status: 'Scheduled' })
      const result = await checkRoomAvailability(room.id, item.startsAt, item.endsAt)
      if (result !== true && result?.isAvailable !== true) {
        conflicts.push({ ...item, message: result?.message || (result?.isAvailable === false ? 'Phòng đã có lịch trong khung giờ này.' : 'Không xác nhận được phòng trống. Vui lòng thử lại.') })
      }
    } catch (error) {
      conflicts.push({ ...item, message: getClassErrorMessage(error, 'Không thể kiểm tra phòng trống.') })
    }
  }
  if (conflicts.length) return { created: [], existing, remaining, conflicts, phase: 'checking' }

  // Save the room before creating any sessions: the backend ignores session.roomId.
  await assignClassToRoom({ classId: sportClass.id, room, rooms })
  const created = []
  for (let index = 0; index < remaining.length; index += 1) {
    const item = remaining[index]
    onProgress({ phase: 'creating', completed: index, total: remaining.length })
    try {
      await createClassSession(sportClass.id, { coachId, cancellationPolicyId, capacity, roomId: room.id, startsAt: item.startsAt, endsAt: item.endsAt })
      created.push(item)
    } catch (error) {
      return { created, existing, remaining: remaining.slice(index), conflicts: [{ ...item, message: getClassErrorMessage(error, 'Không thể tạo buổi học.') }], phase: 'creating' }
    }
  }
  return { created, existing, remaining: [], conflicts: [], phase: 'done' }
}
