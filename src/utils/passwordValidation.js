export const NEW_PASSWORD_MIN_LENGTH = 8
export const NEW_PASSWORD_MAX_LENGTH = 72

export function getNewPasswordValidationError(password) {
  if (typeof password !== 'string' || !password.trim()) return 'Vui lòng nhập mật khẩu.'
  if (password.length < NEW_PASSWORD_MIN_LENGTH || password.length > NEW_PASSWORD_MAX_LENGTH) {
    return 'Mật khẩu phải từ 8 đến 72 ký tự.'
  }
  if (new TextEncoder().encode(password).length > 72) {
    return 'Mật khẩu quá dài khi chứa ký tự có dấu hoặc biểu tượng. Vui lòng rút ngắn mật khẩu.'
  }
  return ''
}
