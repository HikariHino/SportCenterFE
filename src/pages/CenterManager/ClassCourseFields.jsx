import { useId } from 'react'
import { timetableDateKey } from '../../utils/memberTimetable'

export default function ClassCourseFields({ values, onChange, error }) {
  const id = useId()
  const today = timetableDateKey()
  const minimumEnd = values.startDate > today ? values.startDate : today
  const change = (field, value) => onChange(previous => ({ ...previous, [field]: value }))
  return <>
    <p className="class-form-help">Lớp học thuộc quyền lợi gói hội viên, không thu học phí riêng.</p>
    <div className="class-form-grid-2">
      <div className="class-form-group">
        <label htmlFor={`${id}-start`}>Ngày bắt đầu khóa <span className="required">*</span></label>
        <input id={`${id}-start`} type="date" name="startDate" className="class-form-input" required min="2000-01-01" max="9999-12-31" value={values.startDate} onChange={event => change('startDate', event.target.value)} />
      </div>
      <div className="class-form-group">
        <label htmlFor={`${id}-end`}>Ngày kết thúc khóa <span className="required">*</span></label>
        <input id={`${id}-end`} type="date" name="endDate" className="class-form-input" required min={minimumEnd} max="9999-12-31" value={values.endDate} onChange={event => change('endDate', event.target.value)} />
      </div>
    </div>
    {error && <p className="class-course-error" role="alert">{error}</p>}
  </>
}
