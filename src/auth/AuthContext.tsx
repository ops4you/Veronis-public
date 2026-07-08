import { createContext, useContext } from 'react'
import type { SessionUser } from '../lib/api'

export interface AuthState {
  /** null in local (desktop) mode — no accounts there */
  user: SessionUser | null
  businessName: string | null
  isAdmin: boolean
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthState>({
  user: null,
  businessName: null,
  isAdmin: true, // local mode: the owner is at the machine
  logout: async () => {},
})

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
