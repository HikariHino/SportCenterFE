import { formatOtpRemaining } from '../utils/otpTiming'
import '../style/OtpCountdown.css'

export default function OtpCountdown({ id, remaining }) {
  return <p id={id} className={`otp-countdown${remaining ? '' : ' is-expired'}`} role={remaining ? 'timer' : 'status'} aria-live={remaining ? 'off' : 'polite'}>
    {remaining ? `Mã còn hiệu lực ${formatOtpRemaining(remaining)}` : 'Mã đã hết hạn. Vui lòng gửi lại mã mới.'}
  </p>
}
