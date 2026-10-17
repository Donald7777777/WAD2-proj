import axios from 'axios'

// All requests go to our Express server. Vite forwards /api to localhost:8000 (see vite.config.js)
export const api = axios.create({ baseURL: '/api' })

// Turn an Axios error into a message we can show the user
export function errorMessage(error) {
  return error.response?.data?.error || error.message
}
