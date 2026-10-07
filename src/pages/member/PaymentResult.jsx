import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock3, LoaderCircle, ReceiptText, XCircle } from 'lucide-react'

import { getMyPayments, syncPayment } from '../../services/paymentService'
import { getAuthErrorMessage } from '../../utils/auth'
import '../../style/member/PaymentResult.css'

const resultContent = {
  success: { icon: CheckCircle2, title: 'Thanh toán thành công', description: 'Gói hội viên của bạn đã được kích hoạt trên hệ thống.' },
  cancelled: { icon: XCircle, title: 'Thanh toán đã hủy', description: 'Giao dịch chưa thu tiền. Bạn có thể quay lại và thanh toán sau.' },
  pending: { icon: Clock3, title: 'Đang xác nhận thanh toán', description: 'PayOS đang xử lý giao dịch. Hãy xem lại trạng thái trong lịch sử thanh toán.' },
  error: { icon: XCircle, title: 'Chưa thể xác nhận giao dịch', description: 'Bạn vẫn có thể kiểm tra và đồng bộ lại trong trang hội viên.' },
}

export default function PaymentResult({ cancelled = false }) {
  const [searchParams] = useSearchParams()
  const [state, setState] = useState({ status: 'loading', message: '' })

  useEffect(() => {
    let active = true

    async function verifyPayment() {
      try {
        const orderCode = searchParams.get('orderCode')
        const payments = await getMyPayments()
        const payment = payments.find((item) => String(item.payOSOrderCode) === String(orderCode))
        if (!payment) throw new Error('Không tìm thấy giao dịch PayOS vừa thực hiện.')

        const synced = await syncPayment(payment.id)
        if (!active) return
        const normalizedStatus = String(synced.status || '').toLowerCase()
        const status = normalizedStatus === 'completed'
          ? 'success'
          : cancelled || ['cancelled', 'expired', 'failed'].includes(normalizedStatus)
            ? 'cancelled'
            : 'pending'
        setState({ status, message: synced.transactionReference || `PAY-${synced.id}` })
      } catch (error) {
        if (active) setState({ status: 'error', message: getAuthErrorMessage(error, 'Không thể kiểm tra trạng thái thanh toán.') })
      }
    }

    verifyPayment()
    return () => { active = false }
  }, [cancelled, searchParams])

  if (state.status === 'loading') {
    return <main className="payment-result-page"><section className="payment-result-card"><LoaderCircle className="payment-result-spin" size={54} /><h1>Đang kiểm tra thanh toán...</h1><p>Vui lòng giữ nguyên trang trong giây lát.</p></section></main>
  }

  const content = resultContent[state.status]
  const Icon = content.icon
  return <main className={`payment-result-page payment-result-page--${state.status}`}><section className="payment-result-card"><span className="payment-result-icon"><Icon size={54} /></span><p className="payment-result-label"><ReceiptText size={16} />Kết quả thanh toán PayOS</p><h1>{content.title}</h1><p>{state.status === 'error' ? state.message : content.description}</p>{state.message && state.status !== 'error' && <strong>Mã giao dịch: {state.message}</strong>}<Link to="/member#hoa-don">Về lịch sử thanh toán</Link></section></main>
}
