// Keep gateway values and checkout URLs intact; only change the displayed name.
export function formatBankingText(value) {
  return String(value ?? '').replace(/https?:\/\/[^\s<>"']+|\bpayos\b/gi,
    match => /^https?:\/\//i.test(match) ? match : match === 'PAYOS' ? 'BANKING' : 'Banking')
}

export const paymentMethodLabel = (method, fallback = 'Banking') => formatBankingText(method || fallback)
