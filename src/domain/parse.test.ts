import { describe, expect, it } from 'vitest'
import { formatInput, parseInput } from './parse'

describe('parseInput', () => {
  it('keeps a plain title untouched', () => {
    expect(parseInput('Call the bank')).toEqual({
      title: 'Call the bank',
      tags: [],
      priority: 0,
      estimateMin: null,
    })
  })

  it('pulls markers out of the title', () => {
    expect(parseInput('Ship the deploy workflow #dev !1 ~45m')).toEqual({
      title: 'Ship the deploy workflow',
      tags: ['dev'],
      priority: 1,
      estimateMin: 45,
    })
  })

  it('collects several tags and lowercases them', () => {
    const parsed = parseInput('Review PR #Dev #Urgent')
    expect(parsed.tags).toEqual(['dev', 'urgent'])
    expect(parsed.title).toBe('Review PR')
  })

  it('does not repeat a tag written twice', () => {
    expect(parseInput('Thing #work #work').tags).toEqual(['work'])
  })

  it('reads hours as minutes', () => {
    expect(parseInput('Deep work ~2h').estimateMin).toBe(120)
    expect(parseInput('Deep work ~1.5h').estimateMin).toBe(90)
    expect(parseInput('Deep work ~1,5h').estimateMin).toBe(90)
  })

  it('treats a bare number as minutes', () => {
    expect(parseInput('Standup ~15').estimateMin).toBe(15)
  })

  it('leaves a mid-word hash alone', () => {
    // "issue#42" is a reference, not a tag.
    expect(parseInput('Fix issue#42').tags).toEqual([])
    expect(parseInput('Fix issue#42').title).toBe('Fix issue#42')
  })

  it('ignores a priority marker that is not 1-3', () => {
    expect(parseInput('Thing !9').priority).toBe(0)
    expect(parseInput('Thing !9').title).toBe('Thing !9')
  })

  it('accepts unicode tags', () => {
    expect(parseInput('Réunion #équipe').tags).toEqual(['équipe'])
  })

  it('returns an empty title when there is nothing but markers', () => {
    expect(parseInput('  #tag !2  ').title).toBe('')
  })

  it('collapses the whitespace left behind by stripping markers', () => {
    expect(parseInput('Buy #shopping milk').title).toBe('Buy milk')
  })
})

describe('formatInput', () => {
  it('round-trips through parseInput', () => {
    const original = 'Ship the deploy workflow #dev !1 ~45m'
    expect(formatInput(parseInput(original))).toBe(original)
  })

  it('omits markers that are unset', () => {
    expect(formatInput({ title: 'Plain', tags: [], priority: 0, estimateMin: null })).toBe('Plain')
  })
})
