import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyState } from '../domain/types'

const idbSet = vi.fn<(key: string, value: unknown) => Promise<unknown>>()
vi.mock('../lib/idb', () => ({
  idbSet: (key: string, value: unknown) => idbSet(key, value),
  idbGet: vi.fn(),
  idbDelete: vi.fn(),
  isStorageAvailable: () => true,
}))

const { createWriter } = await import('./persist')

describe('createWriter', () => {
  beforeEach(() => idbSet.mockReset())

  it('reports a write the browser refused, then a later one that landed', async () => {
    const onError = vi.fn()
    const onSaved = vi.fn()
    const writer = createWriter(onError, onSaved)

    idbSet.mockRejectedValueOnce(
      new DOMException('The quota has been exceeded.', 'QuotaExceededError'),
    )
    writer.schedule(emptyState())
    await writer.flush()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onSaved).not.toHaveBeenCalled()

    idbSet.mockResolvedValueOnce(undefined)
    writer.schedule(emptyState())
    await writer.flush()
    expect(onSaved).toHaveBeenCalledTimes(1)
  })
})
