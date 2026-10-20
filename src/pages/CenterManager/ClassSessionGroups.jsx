import { useId, useMemo } from 'react'

const status = item => String(item.Status || item.status || 'Scheduled').trim().toLowerCase()
const start = item => Date.parse(item.startsAt) || 0

export default function ClassSessionGroups({ items, children }) {
  const id = useId()
  const groups = useMemo(() => {
    const groups = { scheduled: [], cancelled: [], completed: [], other: [] }
    for (const item of items) {
      const value = status(item)
      const key = ['cancelled', 'canceled'].includes(value) ? 'cancelled' : Object.hasOwn(groups, value) ? value : 'other'
      groups[key].push(item)
    }
    groups.scheduled.sort((a, b) => start(a) - start(b))
    for (const key of ['cancelled', 'completed', 'other']) groups[key].sort((a, b) => start(b) - start(a))
    return groups
  }, [items])

  return <div className="class-session-groups">
    <section className="class-session-group scheduled" aria-labelledby={`${id}-scheduled`}>
      <div className="class-session-group-heading"><h4 id={`${id}-scheduled`}>Buổi học đã lên lịch</h4><span>{groups.scheduled.length} buổi</span></div>
      {groups.scheduled.length ? <div className="sessions-list">{groups.scheduled.map(children)}</div> : <p className="class-session-group-empty">Không có buổi học nào đang được lên lịch.</p>}
    </section>
    <details className="class-session-group cancelled">
      <summary>Buổi học đã hủy <span>{groups.cancelled.length} buổi</span></summary>
      <p className="class-session-group-note">Các buổi đã hủy được lưu riêng để tra cứu, sắp xếp từ mới đến cũ.</p>
      {groups.cancelled.length ? <div className="sessions-list">{groups.cancelled.map(children)}</div> : <p className="class-session-group-empty">Lớp chưa có buổi học nào bị hủy.</p>}
    </details>
    {groups.completed.length > 0 && <details className="class-session-group completed"><summary>Buổi học đã hoàn thành <span>{groups.completed.length} buổi</span></summary><div className="sessions-list">{groups.completed.map(children)}</div></details>}
    {groups.other.length > 0 && <details className="class-session-group other"><summary>Buổi học khác <span>{groups.other.length} buổi</span></summary><div className="sessions-list">{groups.other.map(children)}</div></details>}
  </div>
}
