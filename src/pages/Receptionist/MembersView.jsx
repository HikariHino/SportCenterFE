import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, Clock3, CreditCard, ReceiptText, Ban, LogIn, Plus, UserCheck, Users, WalletCards, X } from 'lucide-react'
import { createMember, getMemberById, getMembers } from '../../services/memberService'
import { getMembershipPackageById, getMembershipPackages } from '../../services/membershipPackageService'
import { confirmReceptionistSubscriptionPayment, getReceptionistMemberSubscriptions, getReceptionistSubscriptionById } from '../../services/memberSubscriptionService'
import SubscriptionPurchaseDialog from '../../components/SubscriptionPurchaseDialog'
import CounterOrderCancellationDialog from '../../components/CounterOrderCancellationDialog'
import { counterOrderCancellationReason } from '../../utils/counterOrders'
import { cancelReceptionistRegistration, checkInReceptionistRegistration, getReceptionistMemberRegistrations } from '../../services/receptionistClassService'
import { emptyMemberForm, EmptyState, formatMemberDate, genderLabel, requestErrorMessage, subscriptionStatusLabel, ViewLoader } from './ReceptionistViewShared'

function CreateMemberDialog({ onClose, onCreated }) {
  const [form, setForm] = useState(emptyMemberForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const updateField = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }))

  const submit = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const member = await createMember({
        ...form,
        phone: form.phone.trim() || null,
        dateOfBirth: form.dateOfBirth || null,
        gender: form.gender || null,
        address: form.address.trim() || null,
        fitnessGoal: form.fitnessGoal.trim() || null,
      })
      onCreated(member)
      onClose()
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'Không thể đăng ký hội viên tại quầy.'))
    } finally {
      setSaving(false)
    }
  }

  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="reception-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-create-member-title">
      <header><div><span>ĐĂNG KÝ TẠI QUẦY</span><h2 id="reception-create-member-title">Tạo tài khoản hội viên</h2><p>Thông tin đăng nhập sẽ được bàn giao trực tiếp cho hội viên.</p></div><button type="button" aria-label="Đóng biểu mẫu" onClick={onClose} disabled={saving}><X size={19} /></button></header>
      <form onSubmit={submit}>
        <div className="reception-member-form-grid">
          <label>Họ và tên<input name="fullName" value={form.fullName} onChange={updateField} maxLength="100" required /></label>
          <label>Email<input name="email" type="email" value={form.email} onChange={updateField} maxLength="256" required /></label>
          <label>Mật khẩu ban đầu<input name="password" type="password" value={form.password} onChange={updateField} minLength="6" autoComplete="new-password" required /></label>
          <label>Số điện thoại<input name="phone" type="tel" value={form.phone} onChange={updateField} /></label>
          <label>Ngày sinh<input name="dateOfBirth" type="date" value={form.dateOfBirth} max={new Date().toISOString().slice(0, 10)} onChange={updateField} /></label>
          <label>Giới tính<select name="gender" value={form.gender} onChange={updateField}><option value="">Chưa cung cấp</option><option value="Male">Nam</option><option value="Female">Nữ</option><option value="Other">Khác</option></select></label>
          <label className="wide">Địa chỉ<input name="address" value={form.address} onChange={updateField} maxLength="200" /></label>
          <label className="wide">Mục tiêu tập luyện<input name="fitnessGoal" value={form.fitnessGoal} onChange={updateField} maxLength="100" placeholder="Ví dụ: tăng sức bền, giảm cân..." /></label>
        </div>
        {error && <p className="reception-form-error" role="alert">{error}</p>}
        <footer><button type="button" onClick={onClose} disabled={saving}>Hủy</button><button type="submit" disabled={saving}>{saving ? 'Đang đăng ký...' : 'Đăng ký hội viên'}</button></footer>
      </form>
    </section>
  </div>
}

function MemberDetailDialog({ memberId, onClose, onViewRegistrations, onRegisterSubscription, onViewSubscriptions }) {
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)

  useEffect(() => {
    let active = true
    const loadMember = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getMemberById(memberId)
        if (active) setMember(result)
      } catch (requestError) {
        if (active) {
          setMember(null)
          setError(requestErrorMessage(requestError, 'Không thể tải thông tin hội viên.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadMember()
    return () => { active = false }
  }, [memberId, requestKey])

  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="reception-dialog reception-member-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-member-detail-title">
      <header><div><span>HỒ SƠ HỘI VIÊN</span><h2 id="reception-member-detail-title">Chi tiết hội viên #{memberId}</h2><p>Thông tin được tải trực tiếp từ hệ thống hội viên.</p></div><button type="button" aria-label="Đóng hồ sơ hội viên" onClick={onClose}><X size={19} /></button></header>
      <div className="reception-member-detail-body">
        {loading ? <div className="reception-member-detail-state"><Users size={26} /><strong>Đang tải hồ sơ</strong><span>Vui lòng chờ dữ liệu hội viên được đồng bộ.</span></div> : error ? <div className="reception-member-detail-state"><Users size={26} /><strong>Không thể tải hồ sơ</strong><span>{error}</span><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : member && <>
          <div className="reception-member-detail-profile"><span><UserCheck size={25} /></span><div><h3>{member.fullName}</h3><p>{member.email}</p></div><b className={member.isActive ? 'active' : 'inactive'}>{member.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}</b></div>
          <div className="reception-member-detail-grid">
            <div><small>Mã hội viên</small><strong>#{member.memberId}</strong></div>
            <div><small>Mã tài khoản</small><strong>#{member.userId}</strong></div>
            <div><small>Số điện thoại</small><strong>{member.phone || 'Chưa cập nhật'}</strong></div>
            <div><small>Ngày sinh</small><strong>{formatMemberDate(member.dateOfBirth)}</strong></div>
            <div><small>Giới tính</small><strong>{genderLabel(member.gender)}</strong></div>
            <div><small>Ngày đăng ký</small><strong>{formatMemberDate(member.createdAt)}</strong></div>
            <div className="wide"><small>Địa chỉ</small><strong>{member.address || 'Chưa cập nhật'}</strong></div>
            <div className="wide"><small>Mục tiêu tập luyện</small><strong>{member.fitnessGoal || 'Chưa cập nhật'}</strong></div>
          </div>
          <div className="reception-member-detail-actions"><button type="button" onClick={onViewRegistrations}><CalendarDays size={15} />Lượt đăng ký</button><button type="button" onClick={onViewSubscriptions}><ReceiptText size={15} />Gói hội viên</button><button type="button" onClick={onRegisterSubscription}><CreditCard size={15} />Đăng ký gói</button></div>
        </>}
      </div>
    </section>
  </div>
}

function CreateSubscriptionDialog({ memberId, onClose, onCreated }) {
  const [purchasePackage, setPurchasePackage] = useState(null)
  const [packages, setPackages] = useState([])
  const [packageId, setPackageId] = useState('')
  const [packageDetail, setPackageDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const loadPackages = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getMembershipPackages()
        const activePackages = result.filter(item => item.isActive !== false)
        if (active) {
          setPackages(activePackages)
          setPackageId(activePackages[0]?.id ? String(activePackages[0].id) : '')
        }
      } catch (requestError) {
        if (active) setError(requestErrorMessage(requestError, 'Không thể tải danh sách gói hội viên.'))
      } finally {
        if (active) setLoading(false)
      }
    }
    loadPackages()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!packageId) {
      setPackageDetail(null)
      return undefined
    }
    let active = true
    const loadPackageDetail = async () => {
      setDetailLoading(true)
      setDetailError('')
      try {
        const result = await getMembershipPackageById(Number(packageId))
        if (active) setPackageDetail(result)
      } catch (requestError) {
        if (active) {
          setPackageDetail(null)
          setDetailError(requestErrorMessage(requestError, 'Không thể tải chi tiết gói hội viên.'))
        }
      } finally {
        if (active) setDetailLoading(false)
      }
    }
    loadPackageDetail()
    return () => { active = false }
  }, [packageId])

  const submit = async event => {
    event.preventDefault()
    const normalizedPackageId = Number(packageId)
    if (!Number.isInteger(normalizedPackageId) || normalizedPackageId <= 0) {
      setError('Vui lòng chọn một gói hội viên hợp lệ.')
      return
    }
    if (saving || !selectedPackage) return
    setError('')
    setSaving(true)
    setPurchasePackage(selectedPackage)
  }

  const selectedPackage = packageDetail || packages.find(item => String(item.id) === packageId)

  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    {purchasePackage && <SubscriptionPurchaseDialog pkg={purchasePackage} memberId={memberId} onClose={() => { setPurchasePackage(null); setSaving(false) }} onCreated={subscription => { onCreated(subscription); onClose() }} />}
    <section className="reception-dialog reception-subscription-create-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-create-subscription-title">
      <header><div><span>ĐĂNG KÝ TẠI QUẦY</span><h2 id="reception-create-subscription-title">Đăng ký gói cho hội viên #{memberId}</h2><p>Đăng ký mới sẽ chờ xác nhận thanh toán trước khi kích hoạt.</p></div><button type="button" aria-label="Đóng biểu mẫu đăng ký gói" onClick={onClose} disabled={saving}><X size={19} /></button></header>
      <form onSubmit={submit}>
        {loading ? <div className="reception-subscription-loading"><CreditCard size={25} /><strong>Đang tải danh sách gói</strong></div> : packages.length ? <><label className="reception-subscription-package-field">Gói hội viên<select value={packageId} onChange={event => setPackageId(event.target.value)} disabled={saving}>{packages.map(item => <option value={item.id} key={item.id}>{item.packageName}</option>)}</select></label>{detailLoading ? <div className="reception-subscription-detail-loading">Đang tải chi tiết gói...</div> : detailError ? <p className="reception-form-error" role="alert">{detailError}</p> : selectedPackage && <div className="reception-subscription-package-preview"><span><small>Giá gói</small><strong>{Number(selectedPackage.price || 0).toLocaleString('vi-VN')} đ</strong></span><span><small>Thời hạn</small><strong>{selectedPackage.durationInDays} ngày</strong></span><p>{selectedPackage.description || 'Gói hội viên đang hoạt động.'}</p></div>}</> : !error && <div className="reception-subscription-loading"><CreditCard size={25} /><strong>Chưa có gói đang hoạt động</strong></div>}
        {error && <p className="reception-form-error" role="alert">{error}</p>}
        <footer><button type="button" onClick={onClose} disabled={saving}>Hủy</button><button type="submit" disabled={loading || detailLoading || saving || !packageDetail}>{saving ? 'Đang đăng ký...' : 'Tạo đăng ký gói'}</button></footer>
      </form>
    </section>
  </div>
}

function MemberSubscriptionsDialog({ memberId, onClose, showNotice }) {
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState(null)
  const [cancelSubscription, setCancelSubscription] = useState(null)
  const [paymentSubscription, setPaymentSubscription] = useState(null)

  useEffect(() => {
    let active = true
    const loadSubscriptions = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getReceptionistMemberSubscriptions(memberId)
        if (active) setSubscriptions(result)
      } catch (requestError) {
        if (active) {
          setSubscriptions([])
          setError(requestErrorMessage(requestError, 'Không thể tải các gói của hội viên.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadSubscriptions()
    return () => { active = false }
  }, [memberId, requestKey])

  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="reception-dialog reception-subscriptions-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-member-subscriptions-title">
      <header><div><span>GÓI HỘI VIÊN</span><h2 id="reception-member-subscriptions-title">Các gói của hội viên #{memberId}</h2><p>{subscriptions.length} đăng ký gói được tìm thấy.</p></div><button type="button" aria-label="Đóng danh sách gói" onClick={onClose}><X size={19} /></button></header>
      <div className="reception-subscriptions-body">
        {loading ? <div className="reception-member-detail-state"><CreditCard size={26} /><strong>Đang tải các gói hội viên</strong><span>Dữ liệu gói hội viên đang được đồng bộ từ hệ thống.</span></div> : error ? <div className="reception-member-detail-state"><CreditCard size={26} /><strong>Không thể tải các gói</strong><span>{error}</span><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : subscriptions.length ? <div className="reception-subscription-list">{subscriptions.map(item => <article key={item.id}><header><div><small>Đăng ký #{item.id}</small><strong>{item.packageName}</strong></div><b className={String(item.status || '').toLowerCase()}>{subscriptionStatusLabel(item.status)}</b></header><div><span><small>Giá đăng ký</small><strong>{Number(item.agreedPrice || 0).toLocaleString('vi-VN')} đ</strong></span><span><small>Thời hạn</small><strong>{item.durationInDays} ngày</strong></span><span><small>Ngày tạo</small><strong>{formatMemberDate(item.createdAt)}</strong></span><span><small>Hiệu lực</small><strong>{item.startDate ? `${formatMemberDate(item.startDate)} – ${formatMemberDate(item.endDate)}` : 'Chờ kích hoạt'}</strong></span></div><footer className="reception-subscription-actions"><button type="button" onClick={() => setSelectedSubscriptionId(item.id)}>Xem chi tiết <ArrowRight size={14} /></button>{item.status === 'Pending' && <><button className="payment" type="button" onClick={() => setPaymentSubscription(item)}><WalletCards size={13} />Thu tiền</button>{!counterOrderCancellationReason(item) && <button className="cancel" type="button" onClick={() => setCancelSubscription(item)}><Ban size={13} />Hủy đơn thanh toán</button>}</>}</footer></article>)}</div> : <div className="reception-member-detail-state"><CreditCard size={26} /><strong>Chưa đăng ký gói</strong><span>Hội viên này chưa có đăng ký gói nào.</span></div>}
      </div>
      {selectedSubscriptionId !== null && <SubscriptionDetailDialog subscriptionId={selectedSubscriptionId} onClose={() => setSelectedSubscriptionId(null)} />}
      {cancelSubscription && <CancelSubscriptionDialog subscription={cancelSubscription} onClose={() => setCancelSubscription(null)} onCancelled={updated => { setSubscriptions(current => current.map(item => item.id === updated.id ? updated : item)); showNotice(`Đã hủy đăng ký gói #${updated.id}.`) }} />}
      {paymentSubscription && <ConfirmSubscriptionPaymentDialog subscription={paymentSubscription} onClose={() => setPaymentSubscription(null)} onCancelOrder={() => { setCancelSubscription(paymentSubscription); setPaymentSubscription(null) }} onConfirmed={receipt => { setRequestKey(key => key + 1); showNotice(`Đã xác nhận biên nhận #${receipt.id} và kích hoạt gói.`) }} />}
    </section>
  </div>
}

function ConfirmSubscriptionPaymentDialog({ subscription, onClose, onConfirmed, onCancelOrder }) {
  const [amount, setAmount] = useState(String(subscription.agreedPrice || ''))
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [paymentReceived, setPaymentReceived] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async event => {
    event.preventDefault()
    const normalizedAmount = Number(amount)
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      setError('Số tiền phải lớn hơn 0.')
      return
    }
    if (normalizedAmount !== Number(subscription.agreedPrice)) {
      setError('Số tiền phải bằng giá đã chốt của đăng ký gói.')
      return
    }
    if (!paymentReceived) {
      setError('Vui lòng xác nhận đã thực nhận đủ tiền từ hội viên.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const receipt = await confirmReceptionistSubscriptionPayment(subscription.id, {
        amount: normalizedAmount,
        paymentMethod,
        paymentReceived: true,
      })
      onConfirmed(receipt)
      onClose()
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'Không thể xác nhận thanh toán đăng ký gói.'))
    } finally {
      setSaving(false)
    }
  }

  return <div className="reception-dialog-backdrop reception-nested-dialog" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="reception-dialog reception-subscription-payment-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-confirm-payment-title">
      <header><div><span>XÁC NHẬN THU TIỀN</span><h2 id="reception-confirm-payment-title">Thanh toán đăng ký #{subscription.id}</h2><p>{subscription.packageName} · {Number(subscription.agreedPrice || 0).toLocaleString('vi-VN')} đ</p></div><button type="button" aria-label="Đóng biểu mẫu thanh toán" onClick={onClose} disabled={saving}><X size={19} /></button></header>
      <form onSubmit={submit}><div className="reception-payment-form-grid"><label>Số tiền đã nhận<input type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} disabled={saving} required /></label><label>Phương thức<select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)} disabled={saving}><option value="Cash">Tiền mặt</option><option value="BankTransfer">Chuyển khoản</option><option value="CreditCard">Thẻ tín dụng</option></select></label></div><label className="reception-payment-confirm"><input type="checkbox" checked={paymentReceived} onChange={event => setPaymentReceived(event.target.checked)} disabled={saving} /><span><strong>Tôi xác nhận đã thực nhận đủ tiền</strong><small>Thao tác này ghi nhận khoản tiền đã thu và kích hoạt gói; không tự trừ tiền ngân hàng hoặc thẻ.</small></span></label>{error && <p className="reception-form-error" role="alert">{error}</p>}<footer>{!counterOrderCancellationReason(subscription) && <button className="danger" type="button" disabled={saving} onClick={onCancelOrder}><Ban size={14} />Hủy đơn thanh toán</button>}<button type="button" onClick={onClose} disabled={saving}>Đóng</button><button type="submit" disabled={saving || !paymentReceived}>{saving ? 'Đang xác nhận...' : 'Xác nhận và kích hoạt'}</button></footer></form>
    </section>
  </div>
}

function CancelSubscriptionDialog({ subscription, onClose, onCancelled }) {
  return <CounterOrderCancellationDialog subscription={subscription} onClose={onClose} onCancelled={onCancelled} />
}

function SubscriptionDetailDialog({ subscriptionId, onClose }) {
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)

  useEffect(() => {
    let active = true
    const loadSubscription = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getReceptionistSubscriptionById(subscriptionId)
        if (active) setSubscription(result)
      } catch (requestError) {
        if (active) {
          setSubscription(null)
          setError(requestErrorMessage(requestError, 'Không thể tải chi tiết đăng ký gói.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadSubscription()
    return () => { active = false }
  }, [subscriptionId, requestKey])

  return <div className="reception-dialog-backdrop reception-nested-dialog" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="reception-dialog reception-subscription-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-subscription-detail-title">
      <header><div><span>CHI TIẾT ĐĂNG KÝ</span><h2 id="reception-subscription-detail-title">Đăng ký gói #{subscriptionId}</h2><p>Dữ liệu chi tiết được tải từ hệ thống gói hội viên.</p></div><button type="button" aria-label="Đóng chi tiết đăng ký gói" onClick={onClose}><X size={19} /></button></header>
      <div className="reception-subscription-detail-body">
        {loading ? <div className="reception-member-detail-state"><ReceiptText size={26} /><strong>Đang tải chi tiết đăng ký</strong></div> : error ? <div className="reception-member-detail-state"><ReceiptText size={26} /><strong>Không thể tải chi tiết</strong><span>{error}</span><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : subscription && <><div className="reception-subscription-detail-title"><span><CreditCard size={22} /></span><div><small>Gói hội viên</small><h3>{subscription.packageName}</h3></div><b className={String(subscription.status || '').toLowerCase()}>{subscriptionStatusLabel(subscription.status)}</b></div><div className="reception-subscription-detail-grid"><div><small>Mã hội viên</small><strong>#{subscription.memberId}</strong></div><div><small>Mã gói</small><strong>#{subscription.packageId}</strong></div><div><small>Giá đăng ký</small><strong>{Number(subscription.agreedPrice || 0).toLocaleString('vi-VN')} đ</strong></div><div><small>Thời hạn</small><strong>{subscription.durationInDays} ngày</strong></div><div><small>Ngày tạo</small><strong>{formatMemberDate(subscription.createdAt)}</strong></div><div><small>Ngày bắt đầu</small><strong>{formatMemberDate(subscription.startDate)}</strong></div><div><small>Ngày kết thúc</small><strong>{formatMemberDate(subscription.endDate)}</strong></div><div><small>Số biên nhận</small><strong>{subscription.payments?.length || 0}</strong></div></div>{subscription.payments?.length > 0 && <div className="reception-subscription-receipts"><h4>Biên nhận thanh toán</h4>{subscription.payments.map(payment => <div key={payment.id}><span><small>Mã #{payment.id}</small><strong>{payment.paymentMethod}</strong></span><span><small>Số tiền</small><strong>{Number(payment.amount || 0).toLocaleString('vi-VN')} đ</strong></span><span><small>Trạng thái</small><strong>{payment.status}</strong></span></div>)}</div>}</>}
      </div>
    </section>
  </div>
}

function CancelRegistrationDialog({ registration, onClose, onCancelled }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async event => {
    event.preventDefault()
    const normalizedReason = reason.trim()
    if (!normalizedReason) {
      setError('Vui lòng nhập lý do hủy đăng ký.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const result = await cancelReceptionistRegistration(registration.id, normalizedReason)
      onCancelled(result)
      onClose()
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'Không thể hủy lượt đăng ký.'))
    } finally {
      setSaving(false)
    }
  }

  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="reception-dialog reception-cancel-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-cancel-registration-title">
      <header><div><span>HỦY LƯỢT ĐĂNG KÝ</span><h2 id="reception-cancel-registration-title">Đăng ký #{registration.id}</h2><p>{registration.className} · Buổi #{registration.sessionId}</p></div><button type="button" aria-label="Đóng biểu mẫu hủy" onClick={onClose} disabled={saving}><X size={19} /></button></header>
      <form onSubmit={submit}><label className="reception-cancel-reason">Lý do hủy<textarea value={reason} onChange={event => setReason(event.target.value)} rows="4" maxLength="500" placeholder="Nhập lý do hủy để lưu vào lịch sử..." required /></label>{error && <p className="reception-form-error" role="alert">{error}</p>}<footer><button type="button" onClick={onClose} disabled={saving}>Quay lại</button><button type="submit" disabled={saving}>{saving ? 'Đang hủy...' : 'Xác nhận hủy'}</button></footer></form>
    </section>
  </div>
}

function MemberRegistrationsDialog({ memberId, onClose, showNotice }) {
  const [registrations, setRegistrations] = useState({ items: [], total: 0, page: 1, pageSize: 20 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [requestKey, setRequestKey] = useState(0)
  const [cancelRegistration, setCancelRegistration] = useState(null)
  const [checkingInId, setCheckingInId] = useState(null)
  const [checkIns, setCheckIns] = useState({})
  const [actionError, setActionError] = useState(null)

  useEffect(() => {
    let active = true
    const loadRegistrations = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getReceptionistMemberRegistrations(memberId, { page, pageSize: 20 })
        if (active) setRegistrations(result)
      } catch (requestError) {
        if (active) {
          setRegistrations({ items: [], total: 0, page, pageSize: 20 })
          setError(requestErrorMessage(requestError, 'Không thể tải các lượt đăng ký của hội viên.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadRegistrations()
    return () => { active = false }
  }, [memberId, page, requestKey])

  const pageCount = Math.max(1, Math.ceil(registrations.total / registrations.pageSize))

  const handleCancelled = updatedRegistration => {
    setRegistrations(current => ({
      ...current,
      items: current.items.map(item => item.id === updatedRegistration.id ? updatedRegistration : item),
    }))
    showNotice(`Đã hủy lượt đăng ký #${updatedRegistration.id}.`)
  }

  const handleCheckIn = async registration => {
    setCheckingInId(registration.id)
    setActionError(null)
    try {
      const attendance = await checkInReceptionistRegistration(registration.id)
      setCheckIns(current => ({ ...current, [registration.id]: attendance }))
      showNotice(`Đã check-in hội viên #${attendance.memberId} cho buổi học #${attendance.sessionId}.`)
    } catch (requestError) {
      setActionError({
        id: registration.id,
        message: requestErrorMessage(requestError, 'Không thể check-in hội viên.'),
      })
    } finally {
      setCheckingInId(null)
    }
  }

  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="reception-dialog reception-registrations-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-member-registrations-title">
      <header><div><span>LỊCH SỬ BUỔI HỌC</span><h2 id="reception-member-registrations-title">Lượt đăng ký của hội viên #{memberId}</h2><p>{registrations.total} lượt đăng ký được tìm thấy.</p></div><button type="button" aria-label="Đóng lịch sử đăng ký" onClick={onClose}><X size={19} /></button></header>
      <div className="reception-registrations-body">
        {loading ? <div className="reception-member-detail-state"><CalendarDays size={26} /><strong>Đang tải lượt đăng ký</strong><span>Dữ liệu đăng ký buổi học đang được đồng bộ từ hệ thống.</span></div> : error ? <div className="reception-member-detail-state"><CalendarDays size={26} /><strong>Không thể tải lượt đăng ký</strong><span>{error}</span><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : registrations.items.length ? <div className="reception-registration-list">{registrations.items.map(item => <article key={item.id}><header><div><small>Mã đăng ký #{item.id}</small><strong>{item.className}</strong></div><div className="reception-registration-card-actions"><b className={String(item.status || '').toLowerCase()}>{item.status}</b>{item.status === 'Registered' && item.sessionId && <>{checkIns[item.id] ? <span className="reception-registration-checked"><CheckCircle2 size={12} />Đã check-in</span> : <button className="checkin" type="button" disabled={checkingInId === item.id} onClick={() => handleCheckIn(item)}><LogIn size={13} />{checkingInId === item.id ? 'Đang check-in...' : 'Check-in'}</button>}{!checkIns[item.id] && <button className="cancel" type="button" disabled={checkingInId === item.id} onClick={() => setCancelRegistration(item)}><Ban size={13} />Hủy đăng ký</button>}</>}</div></header><div><span><small>Mã buổi học</small><strong>{item.sessionId ? `#${item.sessionId}` : 'Chưa gắn buổi'}</strong></span><span><small>Thời gian bắt đầu</small><strong>{item.startsAt ? sessionDateTimeFormatter.format(new Date(item.startsAt)) : 'Chưa xác định'}</strong></span><span><small>Ngày đăng ký</small><strong>{formatMemberDate(item.registrationDate)}</strong></span></div>{actionError?.id === item.id && <p className="reception-registration-action-error" role="alert">{actionError.message}</p>}</article>)}</div> : <div className="reception-member-detail-state"><CalendarDays size={26} /><strong>Chưa có lượt đăng ký</strong><span>Hội viên này chưa đăng ký buổi học nào.</span></div>}
      </div>
      {!loading && !error && pageCount > 1 && <footer className="reception-registration-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage(current => current - 1)}>Trang trước</button><span>{page}/{pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage(current => current + 1)}>Trang sau</button></footer>}
      {cancelRegistration && <CancelRegistrationDialog registration={cancelRegistration} onClose={() => setCancelRegistration(null)} onCancelled={handleCancelled} />}
    </section>
  </div>
}

export function MembersView({ query, showNotice }) {
  const [status, setStatus] = useState('Tất cả')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState(null)
  const [registrationsMemberId, setRegistrationsMemberId] = useState(null)
  const [subscriptionMemberId, setSubscriptionMemberId] = useState(null)
  const [subscriptionsMemberId, setSubscriptionsMemberId] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)
  const normalizedQuery = query.trim().toLocaleLowerCase('vi')

  useEffect(() => {
    let active = true
    const loadMembers = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getMembers()
        if (active) setMembers(result)
      } catch (requestError) {
        if (active) {
          setMembers([])
          setError(requestErrorMessage(requestError, 'Không thể tải danh sách hội viên.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadMembers()
    return () => { active = false }
  }, [requestKey])

  const filteredMembers = useMemo(() => members.filter(member => {
    const matchesStatus = status === 'Tất cả'
      || (status === 'Đang hoạt động' && member.isActive)
      || (status === 'Ngừng hoạt động' && !member.isActive)
    const matchesQuery = !normalizedQuery
      || `${member.memberId} ${member.fullName || ''} ${member.email || ''} ${member.phone || ''}`.toLocaleLowerCase('vi').includes(normalizedQuery)
    return matchesStatus && matchesQuery
  }), [members, normalizedQuery, status])

  const activeCount = members.filter(member => member.isActive).length

  const handleCreated = member => {
    showNotice(`Đã đăng ký ${member.fullName} với mã hội viên #${member.memberId}.`)
    setRequestKey(key => key + 1)
  }

  const handleSubscriptionCreated = subscription => {
    showNotice(`Đã đăng ký gói ${subscription.packageName} cho hội viên #${subscription.memberId}.`)
  }

  if (loading) return <ViewLoader />

  return <>
    <section className="reception-member-metrics"><article><span><Users size={20} /></span><div><small>Tổng hội viên</small><strong>{loading ? '--' : members.length}</strong><p>Dữ liệu tài khoản</p></div></article><article><span><BadgeCheck size={20} /></span><div><small>Đang hoạt động</small><strong>{loading ? '--' : activeCount}</strong><p>Có thể sử dụng dịch vụ</p></div></article><article><span><Clock3 size={20} /></span><div><small>Ngừng hoạt động</small><strong>{loading ? '--' : members.length - activeCount}</strong><p>Tài khoản đã khóa</p></div></article></section>
    <section className="reception-card reception-table-card reception-members-card">
      <div className="reception-table-tools"><div><strong>Danh sách hội viên</strong><small>{filteredMembers.length} kết quả</small></div><div>{['Tất cả', 'Đang hoạt động', 'Ngừng hoạt động'].map(item => <button type="button" className={status === item ? 'active' : ''} onClick={() => setStatus(item)} key={item}>{item}</button>)}<button className="reception-primary-button" type="button" onClick={() => setShowCreateDialog(true)}><Plus size={14} />Đăng ký hội viên</button></div></div>
      <div className="reception-table-heading"><span>Mã hội viên</span><span>Họ và tên</span><span>Email</span><span>Số điện thoại</span><span>Trạng thái</span></div>
      {loading ? <EmptyState icon={Users} title="Đang tải hội viên" text="Dữ liệu hội viên đang được đồng bộ từ hệ thống." /> : error ? <div className="reception-inline-error"><EmptyState icon={Users} title="Không thể tải hội viên" text={error} /><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : filteredMembers.length ? <div>{filteredMembers.map(member => <button type="button" className="reception-table-row" key={member.memberId} onClick={() => setSelectedMemberId(member.memberId)} aria-label={`Xem chi tiết ${member.fullName}`}><span>#{member.memberId}</span><span>{member.fullName}</span><span>{member.email}</span><span>{member.phone || 'Chưa cập nhật'}</span><span className={member.isActive ? 'reception-member-active' : 'reception-member-inactive'}>{member.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span></button>)}</div> : <EmptyState icon={Users} title="Không có hội viên phù hợp" text={query || status !== 'Tất cả' ? 'Thử thay đổi từ khóa hoặc bộ lọc trạng thái.' : 'Hệ thống chưa có tài khoản hội viên.'} />}
    </section>
    {showCreateDialog && <CreateMemberDialog onClose={() => setShowCreateDialog(false)} onCreated={handleCreated} />}
    {selectedMemberId !== null && <MemberDetailDialog memberId={selectedMemberId} onClose={() => setSelectedMemberId(null)} onViewRegistrations={() => { setRegistrationsMemberId(selectedMemberId); setSelectedMemberId(null) }} onViewSubscriptions={() => { setSubscriptionsMemberId(selectedMemberId); setSelectedMemberId(null) }} onRegisterSubscription={() => { setSubscriptionMemberId(selectedMemberId); setSelectedMemberId(null) }} />}
    {registrationsMemberId !== null && <MemberRegistrationsDialog memberId={registrationsMemberId} onClose={() => setRegistrationsMemberId(null)} showNotice={showNotice} />}
    {subscriptionMemberId !== null && <CreateSubscriptionDialog memberId={subscriptionMemberId} onClose={() => setSubscriptionMemberId(null)} onCreated={handleSubscriptionCreated} />}
    {subscriptionsMemberId !== null && <MemberSubscriptionsDialog memberId={subscriptionsMemberId} onClose={() => setSubscriptionsMemberId(null)} showNotice={showNotice} />}
  </>
}

