/**
 * Undo/redo as a wrapper around the domain reducer.
 *
 * Snapshots rather than inverse actions: the state is a handful of plain
 * objects sharing structure between versions, so keeping the last hundred is
 * cheap, and there is no second implementation of every mutation to keep in
 * sync — the class of bug where undo drifts from redo simply cannot occur.
 *
 * History is deliberately not persisted. Reopening the app tomorrow and being
 * able to undo something from last week would be a way to lose work, not a way
 * to recover it.
 */

import type { AppState } from './types'
import type { Action } from './reducer'
import { reducer } from './reducer'

const LIMIT = 100

/** Actions that are not user edits, so they must not become undo steps. */
const NOT_UNDOABLE = new Set<Action['type']>(['materialise', 'setTheme'])

/** Actions that invalidate history entirely: the old timeline no longer applies. */
const RESETS_HISTORY = new Set<Action['type']>(['hydrate', 'importState', 'clearAll'])

/**
 * Preferences ride outside the timeline.
 *
 * Snapshot undo restores the whole state object, so without this a `⌘Z` on a
 * task would also revert a theme switched in between — the user changed one
 * thing and two things moved. Anything that is a preference rather than a piece
 * of the day's record belongs here.
 *
 * `lastMaterialisedDay` deliberately stays *in* the timeline: it has to travel
 * with the recurring instances it accounts for, or undoing them would leave the
 * app convinced it had already generated tasks that no longer exist.
 */
const carryPreferences = (restored: AppState, current: AppState): AppState => ({
  ...restored,
  settings: { ...restored.settings, theme: current.settings.theme },
})

/**
 * Rapid edits to the same target collapse into one undo step, so `⌘Z` after
 * typing a title returns to before the sentence, not before the last letter.
 */
const COALESCE_WINDOW_MS = 600

type Coalescing = { key: string; at: number }

export type HistoryState = {
  present: AppState
  past: AppState[]
  future: AppState[]
  coalescing: Coalescing | null
}

export type HistoryAction = Action | { type: 'undo' } | { type: 'redo' }

export const initHistory = (present: AppState): HistoryState => ({
  present,
  past: [],
  future: [],
  coalescing: null,
})

/** Identifies a run of edits that should collapse together. */
function coalesceKey(action: Action): string | null {
  switch (action.type) {
    case 'editTask':
      return `editTask:${action.id}`
    case 'setNotes':
      return `setNotes:${action.id}`
    case 'editSubtask':
      return `editSubtask:${action.taskId}:${action.subtaskId}`
    default:
      return null
  }
}

export function historyReducer(
  state: HistoryState,
  action: HistoryAction,
  now: number = Date.now(),
): HistoryState {
  if (action.type === 'undo') {
    const previous = state.past.at(-1)
    if (!previous) return state
    return {
      present: carryPreferences(previous, state.present),
      past: state.past.slice(0, -1),
      future: [state.present, ...state.future].slice(0, LIMIT),
      coalescing: null,
    }
  }

  if (action.type === 'redo') {
    const [next, ...rest] = state.future
    if (!next) return state
    return {
      present: carryPreferences(next, state.present),
      past: [...state.past, state.present].slice(-LIMIT),
      future: rest,
      coalescing: null,
    }
  }

  const present = reducer(state.present, action)

  // A no-op action (empty title, unknown id) must not consume an undo slot.
  if (present === state.present) return state

  if (RESETS_HISTORY.has(action.type)) {
    return { present, past: [], future: [], coalescing: null }
  }

  if (NOT_UNDOABLE.has(action.type)) {
    return { ...state, present }
  }

  const key = coalesceKey(action)
  const continues =
    key !== null && state.coalescing?.key === key && now - state.coalescing.at < COALESCE_WINDOW_MS

  return {
    present,
    // Continuing a run keeps the checkpoint from before the run started.
    past: continues ? state.past : [...state.past, state.present].slice(-LIMIT),
    future: [],
    coalescing: key === null ? null : { key, at: now },
  }
}

export const canUndo = (state: HistoryState): boolean => state.past.length > 0
export const canRedo = (state: HistoryState): boolean => state.future.length > 0
