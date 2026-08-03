/**
 * A single-key IndexedDB store, hand-rolled.
 *
 * Why IndexedDB and not localStorage: localStorage caps at about 5 MB and, more
 * importantly, is synchronous — every write would block the main thread while
 * someone is typing. IndexedDB has no practical quota here and writes off the
 * critical path.
 *
 * Why hand-rolled and not `idb`: the app needs get, set and delete on one key.
 * A wrapper library would be more code to audit for a promise-shaped adapter
 * that fits in forty lines, and auditability is the point of this project.
 */

const DB_NAME = 'today'
const DB_VERSION = 1
const STORE = 'state'

let connection: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    // Another tab is holding an older version open; it will resolve when it closes.
    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'))
  })

  return connection
}

async function transact<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = run(tx.objectStore(STORE))

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    tx.onabort = () => reject(tx.error)
  })
}

export const idbGet = <T>(key: string): Promise<T | undefined> =>
  transact('readonly', (store) => store.get(key) as IDBRequest<T | undefined>)

export const idbSet = (key: string, value: unknown): Promise<unknown> =>
  transact('readwrite', (store) => store.put(value, key))

export const idbDelete = (key: string): Promise<unknown> =>
  transact('readwrite', (store) => store.delete(key))

/** True when the browser can persist at all — private windows sometimes cannot. */
export function isStorageAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

/**
 * Asks the browser not to evict this origin's data under storage pressure.
 *
 * Best-effort by design: browsers may grant it silently, prompt, or refuse, and
 * a refusal is not an error worth surfacing — the data is still written either
 * way. It matters here because eviction would mean losing tasks that exist
 * nowhere else.
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
