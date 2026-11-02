// Sign-up and reset-password rules. Must match server/utils/validation.js (the server checks again)

// something@something.something, no spaces
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isValidEmail(email) {
  return EMAIL_PATTERN.test(email)
}

// Returns what is wrong with the password, or '' when it is fine
export function passwordProblem(password) {
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(password)) return 'Password must contain at least 1 capital letter.'
  // Anything that isn't a letter, number or space counts as special (e.g. ! @ # $ ?)
  if (!/[^A-Za-z0-9\s]/.test(password)) return 'Password must contain at least 1 special character (e.g. ! @ # $).'
  return ''
}

// Name: 2 to 40 characters (it must also not be taken, which the server checks)
export function nameProblem(name) {
  if (name.length < 2 || name.length > 40) return 'Your name should be 2 to 40 characters.'
  return ''
}

export const PASSWORD_HINT = 'At least 8 characters, with 1 capital letter and 1 special character (e.g. ! @ # $).'
