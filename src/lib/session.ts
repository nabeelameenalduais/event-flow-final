export const SESSION_KEY = "eventflow_session"

/** The opaque device-session token used by the app's custom auth flow. */
export function getSessionToken(): string {
  return localStorage.getItem(SESSION_KEY) ?? ""
}
