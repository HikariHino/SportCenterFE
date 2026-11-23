import { useId } from 'react'
import { timetableDateKey } from '../../utils/memberTimetable'

export default function ClassCourseFields({ values, onChange, error, fieldErrors = {}, disabled = false, onBlur, allowPastStart = true }) {
  const id = useId()
  const today = timetableDateKey()
  const minimumEnd = values.startDate > today ? values.startDate : today
  const change = (field, value) => onChange(previous => ({ ...previous, [field]: value }))
  return <>
    <p className="class-form-help">Lớp học thuộc quyền lợi gói hội viên, không thu học phí riêng.</p>
    <div className="class-form-grid-2">
      <div className="class-form-group">
        <label htmlFor={`${id}-start`}>Ngày bắt đầu khóa <span className="required">*</span></label>
        <input id={`${id}-start`} type="date" name="startDate" className="class-form-input" required disabled={disabled} aria-invalid={Boolean(fieldErrors.startDate)} aria-describedby={fieldErrors.startDate ? `${id}-start-error` : undefined} onBlur={() => onBlur?.('startDate')} min={allowPastStart ? '2000-01-01' : today} max="9999-12-31" value={values.startDate} onChange={event => change('startDate', event.target.value)} />
        {fieldErrors.startDate && <p id={`${id}-start-error`} className="class-field-error" role="alert">{fieldErrors.startDate}</p>}
      </div>
      <div className="class-form-group">
        <label htmlFor={`${id}-end`}>Ngày kết thúc khóa <span className="required">*</span></label>
        <input id={`${id}-end`} type="date" name="endDate" className="class-form-input" required disabled={disabled} aria-invalid={Boolean(fieldErrors.endDate)} aria-describedby={fieldErrors.endDate ? `${id}-end-error` : undefined} onBlur={() => onBlur?.('endDate')} min={minimumEnd} max="9999-12-31" value={values.endDate} onChange={event => change('endDate', event.target.value)} />
        {fieldErrors.endDate && <p id={`${id}-end-error`} className="class-field-error" role="alert">{fieldErrors.endDate}</p>}
      </div>
    </div>
    {error && <p className="class-course-error" role="alert">{error}</p>}
  </>
}
