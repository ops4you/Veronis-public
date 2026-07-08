import type { StateStorage } from 'zustand/middleware'
import { idbStorage } from './idbStorage'
import { api } from './api'

/**
 * Server-backed persistence with a local IndexedDB cache.
 *
 *  - Reads: server first; if the business has no server data yet, adopt
 *    whatever is cached locally (seamless upgrade from the local-only era).
 *  - Writes: cached locally at once, pushed to the server debounced; failed
 *    pushes retry with backoff so a Wi-Fi blip never loses a ticket.
 */

let pushTimer: number | undefined
let retryDelay = 2_000
let latestPayload: string | null = null

function schedulePush(delay: number) {
  if (typeof window === 'undefined') return
  window.clearTimeout(pushTimer)
  pushTimer = window.setTimeout(flush, delay)
}

async function flush() {
  if (latestPayload === null) return
  const payload = latestPayload
  try {
    await api.putState(payload)
    if (latestPayload === payload) latestPayload = null
    retryDelay = 2_000
  } catch {
    retryDelay = Math.min(retryDelay * 2, 60_000)
    schedulePush(retryDelay)
  }
}

export const remoteStorage: StateStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const { data } = await api.getState()
      if (data !== null) {
        await idbStorage.setItem(key, data)
        return data
      }
      // First login for this business: adopt local data if any exists.
      return await idbStorage.getItem(key)
    } catch {
      // Offline or unauthenticated: fall back to the local cache.
      return idbStorage.getItem(key)
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    await idbStorage.setItem(key, value)
    latestPayload = value
    schedulePush(800)
  },

  async removeItem(key: string): Promise<void> {
    await idbStorage.removeItem(key)
  },
}

/** Push any pending write immediately (used on logout/page hide). */
export function flushPendingState(): Promise<void> {
  window.clearTimeout(pushTimer)
  return flush()
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushPendingState()
  })
}
