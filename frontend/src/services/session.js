const TOKEN_KEY = 'hrms_token'
const PROFILE_KEY = 'hrms_profile'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setSession(token, profile) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile ?? {}))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(PROFILE_KEY)
}

export function getProfileCache() {
  const raw = localStorage.getItem(PROFILE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
