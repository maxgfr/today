/**
 * `crypto.randomUUID` needs a secure context. The app is served over HTTPS and
 * `file://` counts as secure too, but a plain-HTTP LAN preview does not — and
 * failing to mint an id there would break task creation entirely. The fallback
 * is not cryptographically meaningful; it only has to avoid collisions inside
 * one person's list.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
