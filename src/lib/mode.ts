/**
 * Runtime mode:
 *  - local  — packaged desktop app (file://): single-user, offline, no accounts.
 *  - server — hosted web app: email+password accounts, roles, server storage.
 */
export const isLocalMode =
  typeof window === 'undefined' || window.location.protocol === 'file:'
