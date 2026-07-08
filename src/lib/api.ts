/** Thin client for the Veronis server API. All requests carry the session cookie. */

export interface SessionUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'employee'
  emailVerified: boolean
}

export interface TeamMember {
  id: string
  name: string
  role: 'admin' | 'employee'
  email?: string
  created_at?: number
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, (body as { error?: string }).error ?? `Request failed (${res.status})`)
  return body as T
}

export const api = {
  me: () => call<{ user: SessionUser; businessName: string }>('/api/auth/me'),
  login: (email: string, password: string) =>
    call<{ user: SessionUser; businessName: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (businessName: string, name: string, email: string, password: string) =>
    call<{ user: SessionUser; businessName: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ businessName, name, email, password }),
    }),
  logout: () => call<{ ok: true }>('/api/auth/logout', { method: 'POST' }),

  resendVerification: () => call<{ ok: true }>('/api/auth/resend-verification', { method: 'POST' }),
  forgotPassword: (email: string) =>
    call<{ ok: true; message: string }>('/api/auth/forgot', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) =>
    call<{ ok: true }>('/api/auth/reset', { method: 'POST', body: JSON.stringify({ token, password }) }),
  changePassword: (current: string, next: string) =>
    call<{ ok: true }>('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ current, next }) }),

  listUsers: () => call<{ users: TeamMember[] }>('/api/users'),
  createEmployee: (name: string, email: string, password?: string) =>
    call<{ user: TeamMember; invited: boolean }>('/api/users', {
      method: 'POST',
      body: JSON.stringify({ name, email, password: password || undefined }),
    }),
  deleteEmployee: (id: string) => call<{ ok: true }>(`/api/users/${id}`, { method: 'DELETE' }),

  getState: () => call<{ data: string | null; version: number }>('/api/state'),
  putState: (data: string) =>
    call<{ ok: true; version: number }>('/api/state', { method: 'PUT', body: JSON.stringify({ data }) }),
}
