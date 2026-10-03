import api from './api'
import { getLoginData } from '../utils/auth'

// Login returns validated session data; other methods return the complete API body.
// HTTP errors reject with the backend body available at error.response.data.

/**
 * POST /api/Auth/login
 * @param {{ email: string, password: string }} credentials
 */
export async function login({ email, password }) {
  const response = await api.post('/Auth/login', { email: email.trim(), password }, { skipAuth: true })
  return getLoginData(response.data)
}

/**
 * POST /api/auth/register
 * @param {Object} details
 * @param {string} details.email
 * @param {string} details.password
 * @param {string} details.fullName
 * @param {string} details.phone
 * @param {string} details.dateOfBirth ISO 8601 date-time string.
 * @param {string} details.gender
 * @param {string} details.address
 * @param {string} details.fitnessGoal
 */
export async function register({ email, password, fullName, phone, dateOfBirth, gender, address, fitnessGoal }) {
  const response = await api.post('/auth/register', {
    email,
    password,
    fullName,
    phone,
    dateOfBirth,
    gender,
    address,
    fitnessGoal,
  }, { skipAuth: true })
  return response.data
}

/** POST /api/Auth/send-register-otp */
export async function sendRegisterOtp({ email, password, fullName, phone, dateOfBirth, gender, address, fitnessGoal }) {
  const response = await api.post('/Auth/send-register-otp', {
    email,
    password,
    fullName,
    phone,
    dateOfBirth,
    gender,
    address,
    fitnessGoal,
  }, { skipAuth: true })
  return response.data
}

/** POST /api/Auth/verify-register-otp */
export async function verifyRegisterOtp({ email, otp }) {
  const response = await api.post('/Auth/verify-register-otp', { email, otp }, { skipAuth: true })
  return response.data
}

/** POST /api/Auth/request-reset-password */
export async function requestResetPassword({ email }) {
  const response = await api.post('/Auth/request-reset-password', { email }, { skipAuth: true })
  return response.data
}

/** POST /api/Auth/verify-reset-password */
export async function verifyResetPassword({ email, otp, newPassword, confirmPassword }) {
  const response = await api.post('/Auth/verify-reset-password', {
    email,
    otp,
    newPassword,
    confirmPassword,
  }, { skipAuth: true })
  return response.data
}

/** POST /api/Auth/refresh-token */
export async function refreshToken({ refreshTokenKey }) {
  const response = await api.post('/Auth/refresh-token', { refreshTokenKey }, { skipAuth: true })
  return response.data
}

/** POST /api/Auth/logout */
export async function logout({ refreshTokenKey }) {
  const response = await api.post('/Auth/logout', { refreshTokenKey })
  return response.data
}

export default {
  login,
  register,
  sendRegisterOtp,
  verifyRegisterOtp,
  requestResetPassword,
  verifyResetPassword,
  refreshToken,
  logout,
}
