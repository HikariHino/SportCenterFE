import { useId } from 'react'
import { timetableDateKey } from '../../utils/memberTimetable'

export default function ClassCourseFields({ values, onChange, error }) {
  const id = useId()
  const today = timetableDateKey()
  const minimumEnd = values.startDate > today ? values.startDate : today
  const change = (field, value) => onChange(previous => ({ ...previous, [field]: value }))
  return <>
    <div className="class-form-group">
      <label htmlFor={`${id}-price`}>Học phí khóa học (VND) <span className="required">*</span></label>
      <input id={`${id}-price`} type="number" name="price" className="class-form-input" min="0" max="10000000000000000" step="0.01" required value={values.price} onChange={event => change('price', event.target.value)} />
      <small className="class-form-help">Có thể nhập 0; tối đa 2 chữ số thập phân.</small>
    </div>
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
