import { CheckCircle2 } from 'lucide-react'
import { membershipPackageTypeLabel } from '../../utils/memberSubscriptions'

const money = value => `${Number(value || 0).toLocaleString('vi-VN')} ₫`

export function FrontDeskPackageSelect({ packages, selectedId, onSelect, disabled, reasonForPackage }) {
  return <div className="fdesk-input-group">
    <label htmlFor="sub-package-select">Chọn gói thẻ (*):</label>
    <select id="sub-package-select" className="fdesk-select" value={selectedId} onChange={event => onSelect(event.target.value)} disabled={disabled} required>
      <option value="">-- Chọn gói tập phù hợp --</option>
      {packages.map(pkg => {
        const reason = reasonForPackage(pkg)
        return <option key={pkg.id} value={pkg.id} disabled={Boolean(reason)} title={reason || undefined}>
          {membershipPackageTypeLabel(pkg)} · {pkg.packageName} — {money(pkg.price)} ({pkg.durationInDays} ngày){reason ? ' — Không thể đăng ký' : ''}
        </option>
      })}
    </select>
  </div>
}

export function FrontDeskPackageCards({ packages, selectedId, onSelect, disabled, reasonForPackage }) {
  return <div className="fdesk-package-grid" style={{ padding: 0 }}>
    {packages.map(pkg => {
      const reason = reasonForPackage(pkg)
      const blocked = disabled || Boolean(reason)
      const selected = !blocked && selectedId === String(pkg.id)
      return <button key={pkg.id} type="button" data-package-id={pkg.id}
        className={`fdesk-package-card${selected ? ' selected' : ''}`} disabled={blocked}
        aria-pressed={selected} aria-describedby={reason ? `fdesk-package-reason-${pkg.id}` : undefined}
        onClick={() => { if (!blocked) onSelect(String(pkg.id)) }}>
        <span className="fdesk-package-card-heading"><strong>{pkg.packageName}</strong>{selected && <CheckCircle2 size={16} />}</span>
        <span className="fdesk-package-price">{money(pkg.price)}</span>
        <small>{membershipPackageTypeLabel(pkg)}</small>
        <span className="fdesk-package-duration">Thời hạn: <strong>{pkg.durationInDays} ngày</strong></span>
        <span className="fdesk-package-description">{pkg.description || 'Gói tập chất lượng cao tại Sports Center.'}</span>
        {reason && <span id={`fdesk-package-reason-${pkg.id}`} className="fdesk-package-registration-reason">{reason}</span>}
      </button>
    })}
  </div>
}
