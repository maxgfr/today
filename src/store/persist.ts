/**
 * Reading and writing the one blob that is the whole app.
 *
 * The state is small enough to serialise whole on every change, which removes
 * an entire category of bug: there is no partial write, no per-entity diff, and
 * no way for the store to end up describing a day that never existed. Writes
 * are debounced so a burst of keystrokes costs one round trip, and flushed on
 * `pagehide` so closing the tab mid-sentence still lands.
 */

import { idbDelete, idbGet, idbSet, isStorageAvailable } from '../lib/idb'
import { migrate } from './migrate'
import type { AppState } from '../domain/types'
import { emptyState } from '../domain/types'

const KEY = 'app-state'
const DEBOUNCE_MS = 250

export type LoadResult = {
  state: AppState
  /** False when the browser refused to give us storage at all. */
  persisted: boolean
}

export async function loadState(): Promise<LoadResult> {
  if (!isStorageAvailable()) return { state: emptyState(), persisted: false }

  try {
    const stored = await idbGet<unknown>(KEY)
    if (stored === undefined) return { state: emptyState(), persisted: true }

    const migrated = migrate(stored)
    // A corrupt blob must not cost the session. Starting empty is bad; a white
    // screen with no way back is worse.
    return { state: migrated ?? emptyState(), persisted: true }
  } catch {
    return { state: emptyState(), persisted: false }
  }
}

/**
 * A debounced writer bound to one store.
 *
 * Returns `flush` so callers can force a write at moments where losing the last
 * 250 ms would be visible — closing the tab, exporting a file.
 */
export function createWriter(onError?: (error: unknown) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: AppState | null = null
  let inFlight: Promise<void> = Promise.resolve()

  const write = async () => {
    const state = pending
    pending = null
    if (state === null) return

    try {
      await idbSet(KEY, state)
    } catch (error) {
      onError?.(error)
    }
  }

  const schedule = (state: AppState) => {
    pending = state
    clearTimeout(timer)
    timer = setTimeout(() => {
      inFlight = write()
    }, DEBOUNCE_MS)
  }

  const flush = async () => {
    clearTimeout(timer)
    await inFlight
    await write()
  }

  return { schedule, flush }
}

export async function clearStoredState(): Promise<void> {
  try {
    await idbDelete(KEY)
  } catch {
    // Nothing actionable: the caller has already reset the in-memory state.
  }
}
