export const FULL_NAME_MESSAGE = 'Họ và tên chỉ được chứa chữ cái và khoảng trắng, không được chứa chữ số hoặc ký tự đặc biệt.'
export const FULL_NAME_PATTERN = ' *(?:\\p{L}\\p{M}*)+(?: +(?:\\p{L}\\p{M}*)+)* *'
const fullNamePattern = new RegExp(`^(?:${FULL_NAME_PATTERN})$`, 'u')

// Combining accents must follow a letter, including Vietnamese names entered
// with decomposed Unicode. Validation never strips or silently replaces input.
export function getFullNameCharactersError(value) {
  if (typeof value !== 'string') return FULL_NAME_MESSAGE
  const fullName = value.normalize('NFC')
  return fullNamePattern.exec(fullName)?.[0] === fullName ? '' : FULL_NAME_MESSAGE
}
