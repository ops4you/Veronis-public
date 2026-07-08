import type { StateStorage } from 'zustand/middleware'

/**
 * IndexedDB-backed key-value storage for the app state.
 *
 * Why not localStorage: 5–10 MB cap, synchronous whole-blob writes, and the
 * first thing "clear browsing data" wipes. IndexedDB gives us hundreds of MB+,
 * async transactional writes, and works identically in the browser and in the
 * packaged desktop app.
 *
 * Falls back to an in-memory Map when IndexedDB is unavailable (tests, very
 * old browsers) so the app still runs — without persistence, but without
 * crashing.
 */

const DB_NAME = 'veronis'
const STORE = 'kv'
const LEGACY_LS_KEY = 'veronis-store'

const memoryFallback = new Map<string, string>()

function hasIdb(): boolean {
  return typeof indexedDB !== 'undefined'
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function idbGet(key: string): Promise<string | null> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly')
        const req = tx.objectStore(STORE).get(key)
        req.onsuccess = () => resolve((req.result as string | undefined) ?? null)
        req.onerror = () => reject(req.error)
      }),
  )
}

function idbSet(key: string, value: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).put(value, key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }),
  )
}

function idbDel(key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).delete(key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }),
  )
}

/**
 * One-time migration: earlier versions persisted to localStorage. If IndexedDB
 * has no data yet but localStorage does, adopt it, and keep the old copy under
 * a backup key rather than deleting it.
 */
async function migrateFromLocalStorage(key: string): Promise<string | null> {
  if (typeof localStorage === 'undefined') return null
  try {
    const legacy = localStorage.getItem(LEGACY_LS_KEY)
    if (legacy === null) return null
    await idbSet(key, legacy)
    localStorage.setItem(`${LEGACY_LS_KEY}-migrated-backup`, legacy)
    localStorage.removeItem(LEGACY_LS_KEY)
    return legacy
  } catch {
    return null
  }
}

export const idbStorage: StateStorage = {
  async getItem(key: string): Promise<string | null> {
    if (!hasIdb()) return memoryFallback.get(key) ?? null
    try {
      const existing = await idbGet(key)
      if (existing !== null) return existing
      return await migrateFromLocalStorage(key)
    } catch {
      return memoryFallback.get(key) ?? null
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (!hasIdb()) {
      memoryFallback.set(key, value)
      return
    }
    try {
      await idbSet(key, value)
    } catch {
      // Quota/transaction failure: keep the app alive; data stays in memory
      // for this session. The UI surfaces persistence problems via backups.
      memoryFallback.set(key, value)
    }
  },
  async removeItem(key: string): Promise<void> {
    memoryFallback.delete(key)
    if (!hasIdb()) return
    try {
      await idbDel(key)
    } catch {
      /* already gone or blocked — nothing sensible to do */
    }
  },
}
