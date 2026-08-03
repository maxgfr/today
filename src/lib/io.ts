/**
 * Export and import.
 *
 * The claim "your data is yours" is only worth something if you can walk away
 * with it. The export is plain, indented JSON — readable in any text editor,
 * diffable, and re-importable here or parseable anywhere else. No proprietary
 * envelope, no compression, no obfuscation.
 *
 * The download is built from a Blob and an object URL: no server round trip,
 * nothing crosses the network to produce the file.
 */

import { migrate } from '../store/migrate'
import { today } from './date'
import type { AppState } from '../domain/types'

export type ExportFile = AppState & {
  exportedAt: string
  app: 'today'
}

export function serialise(state: AppState, now = new Date()): string {
  const file: ExportFile = { app: 'today', exportedAt: now.toISOString(), ...state }
  return JSON.stringify(file, null, 2)
}

export type ImportResult =
  { ok: true; state: AppState; taskCount: number } | { ok: false; reason: string }

export function deserialise(text: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'That file is not valid JSON.' }
  }

  const state = migrate(parsed)
  if (state === null) {
    return {
      ok: false,
      reason: 'That does not look like a Today export, or it came from a newer version.',
    }
  }

  return { ok: true, state, taskCount: Object.keys(state.tasks).length }
}

export function downloadJson(contents: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()

  // Revoking immediately can race the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const exportFilename = (day = today()): string => `today-backup-${day}.json`

export function exportState(state: AppState): void {
  downloadJson(serialise(state), exportFilename())
}

export function readFileText(file: File): Promise<string> {
  return file.text()
}
