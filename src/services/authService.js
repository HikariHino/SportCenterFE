import api from './api'

// Return the complete API body: success, statusCode, message, data, errors, timestamp.
// On success, data contains userId, email, fullName, role, token.
// HTTP errors reject with the backend body available at error.response.data.

/**
 * POST /api/auth/login
 * @param {{ email: string, password: string }} credentials
 */
export async function login({ email, password }) {
  const response = await api.post('/auth/login', { email, password }, { skipAuth: true })
  return response.data
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

export default { login, register }
