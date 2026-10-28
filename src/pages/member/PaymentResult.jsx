import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock3, LoaderCircle, ReceiptText, XCircle } from 'lucide-react'

import { isTemporaryPaymentError, verifyPaymentResult } from '../../services/paymentService'
import { completeCancelledPaymentSubscription } from '../../services/subscriptionCancellationService'
import { getAuthErrorMessage } from '../../utils/auth'
import '../../style/member/PaymentResult.css'

const resultContent = {
  success: { icon: CheckCircle2, title: 'Thanh toán thành công', description: 'Gói hội viên của bạn đã được kích hoạt trên hệ thống.' },
  cancelled: { icon: XCircle, title: 'Thanh toán đã hủy', description: 'Giao dịch chưa thu tiền. Bạn có thể quay lại và thanh toán sau.' },
  failed: { icon: XCircle, title: 'Thanh toán không thành công', description: 'Giao dịch đã thất bại hoặc hết hạn. Vui lòng kiểm tra lịch sử thanh toán trước khi thử lại.' },
  pending: { icon: Clock3, title: 'Đang xác nhận thanh toán', description: 'PayOS đang xử lý giao dịch. Hãy xem lại trạng thái trong lịch sử thanh toán.' },
  review: { icon: Clock3, title: 'Giao dịch cần đối soát', description: 'Hệ thống đã ghi nhận giao dịch cần kiểm tra. Vui lòng liên hệ trung tâm để được đối soát.' },
  error: { icon: XCircle, title: 'Chưa thể xác nhận giao dịch', description: 'Bạn vẫn có thể kiểm tra và đồng bộ lại trong trang hội viên.' },
}

export default function PaymentResult() {
  const [searchParams] = useSearchParams()
  const orderCode = searchParams.get('orderCode')
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState({ status: 'loading', message: '' })

  useEffect(() => {
    let active = true
    setState({ orderCode, status: 'loading', message: '' })

    async function verifyPayment() {
      try {
        const synced = await verifyPaymentResult(orderCode)
        if (!active) return
        const normalizedStatus = String(synced.status || '').trim().toLowerCase()
        const status = { completed: 'success', cancelled: 'cancelled', canceled: 'cancelled', expired: 'failed', failed: 'failed', needsreview: 'review' }[normalizedStatus] || 'pending'
        let subscriptionCancelled = false
        let cancellationError = ''
        if (status === 'cancelled') {
          try { subscriptionCancelled = Boolean(await completeCancelledPaymentSubscription(synced)) }
          catch (error) { cancellationError = error?.response?.data?.message || error.message || 'Chưa hoàn tất hủy đơn đăng ký gói.' }
        }
        if (active) setState({ orderCode, status, subscriptionCancelled, cancellationError, message: synced.transactionReference || `PAY-${synced.id}` })
      } catch (error) {
        if (active) setState({ orderCode, status: 'error', message: isTemporaryPaymentError(error)
          ? 'Kết nối xác nhận thanh toán đang gián đoạn. Vui lòng kiểm tra lại sau ít giây.'
          : getAuthErrorMessage(error, 'Không thể kiểm tra trạng thái thanh toán.') })
      }
    }

    verifyPayment()
    return () => { active = false }
  }, [orderCode, revision])

  if (state.status === 'loading' || state.orderCode !== orderCode) {
    return <main className="payment-result-page"><section className="payment-result-card"><LoaderCircle className="payment-result-spin" size={54} /><h1>Đang kiểm tra thanh toán...</h1><p>Vui lòng giữ nguyên trang trong giây lát.</p></section></main>
  }

  const content = resultContent[state.status]
  const Icon = content.icon
  const notice = state.subscriptionCancelled ? 'Đã hủy thanh toán và đơn đăng ký gói.' : state.cancellationError ? 'Thanh toán đã hủy; đơn gói chưa hủy xong.' : content.title
  return <main className={`payment-result-page payment-result-page--${state.status}`}><section className="payment-result-card" role="status" aria-live="polite"><span className="payment-result-icon"><Icon size={54} /></span><p className="payment-result-label"><ReceiptText size={16} />Kết quả thanh toán PayOS</p><h1>{content.title}</h1><p>{state.status === 'error' ? state.message : state.subscriptionCancelled ? 'Giao dịch PayOS và đơn đăng ký gói đã được hủy thành công.' : content.description}</p>{state.cancellationError && <p className="payment-result-order-error" role="alert">Giao dịch đã hủy nhưng chưa hoàn tất hủy đơn gói: {state.cancellationError}</p>}{state.message && state.status !== 'error' && <strong>Mã giao dịch: {state.message}</strong>}<div className="payment-result-actions">{(['pending', 'error'].includes(state.status) || state.cancellationError) && <button type="button" onClick={() => setRevision(value => value + 1)}>Kiểm tra lại</button>}<Link to="/member" state={{ activeNav: 'payments', paymentNotice: notice, paymentStatus: state.status }}>Về lịch sử thanh toán</Link><Link to="/member" state={{ activeNav: 'subscriptions', paymentNotice: notice, paymentStatus: state.status }}>Về gói hội viên</Link></div></section></main>
}
