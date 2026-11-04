export const BACKEND_ID_MAX = 2147483647

export const isNumericInput = value => ['string', 'number'].includes(typeof value) && String(value).trim() !== '' && Number.isFinite(Number(value))

export const isIntegerInRange = (value, min, max) => isNumericInput(value) && Number.isInteger(Number(value)) && Number(value) >= min && Number(value) <= max

export function getBackendIdValidationError(value, label = 'Mã số') {
  return isIntegerInRange(value, 1, BACKEND_ID_MAX) ? '' : `${label} phải là số nguyên từ 1 đến ${BACKEND_ID_MAX}.`
}
