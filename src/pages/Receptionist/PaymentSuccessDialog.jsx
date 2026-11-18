import { useEffect, useId, useRef } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import '../../style/Receptionist/PaymentSuccessDialog.css'

export default function PaymentSuccessDialog({ paymentId, payment, onClose }) {
  const dialog = useRef(null)
  const titleId = useId()
  useEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [])

  return <dialog ref={dialog} className="reception-payment-success-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <button className="reception-payment-success-close" type="button" aria-label="Đóng thông báo thanh toán thành công" onClick={onClose}><X size={19} /></button>
    <CheckCircle2 className="reception-payment-success-icon" size={54} aria-hidden="true" />
    <h2 id={titleId}>Thanh toán thành công</h2>
    <p>Hệ thống đã xác nhận thanh toán chuyển khoản và cập nhật trạng thái giao dịch.</p>
    <strong>Giao dịch #PAY-{paymentId}</strong>
    {payment && <p className="reception-payment-success-amount">{Number(payment.amount).toLocaleString('vi-VN')} đ</p>}
    <button className="reception-payment-success-done" type="button" onClick={onClose} autoFocus>Đóng</button>
  </dialog>
}
