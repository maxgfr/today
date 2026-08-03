/**
 * Quick-capture parsing.
 *
 * Typing "call the bank #admin !1 ~20m" should not require reaching for three
 * separate controls. The markers are stripped from the title so what you read
 * back is the task, not the syntax you used to file it.
 *
 * Deliberately small: no natural-language dates. "next tuesday" is ambiguous
 * often enough that guessing wrong costs more trust than the shortcut earns,
 * and every task already lands on a day the user is looking at.
 */

import type { Priority } from './types'

export type ParsedInput = {
  title: string
  tags: string[]
  priority: Priority
  estimateMin: number | null
}

const TAG = /(?:^|\s)#([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu
const PRIORITY = /(?:^|\s)!([1-3])(?=\s|$)/u
const ESTIMATE = /(?:^|\s)~(\d+(?:[.,]\d+)?)(m|min|h|hr)?(?=\s|$)/iu

export function parseInput(raw: string): ParsedInput {
  let rest = raw

  const tags: string[] = []
  for (const [, tag] of raw.matchAll(TAG)) {
    const normalised = tag!.toLowerCase()
    if (!tags.includes(normalised)) tags.push(normalised)
  }
  rest = rest.replace(TAG, ' ')

  const priorityMatch = rest.match(PRIORITY)
  const priority = (priorityMatch ? Number(priorityMatch[1]) : 0) as Priority
  if (priorityMatch) rest = rest.replace(PRIORITY, ' ')

  const estimateMatch = rest.match(ESTIMATE)
  let estimateMin: number | null = null
  if (estimateMatch) {
    const amount = Number(estimateMatch[1]!.replace(',', '.'))
    const unit = estimateMatch[2]?.toLowerCase()
    estimateMin = Math.round(unit === 'h' || unit === 'hr' ? amount * 60 : amount)
    rest = rest.replace(ESTIMATE, ' ')
  }

  return {
    title: rest.replace(/\s+/g, ' ').trim(),
    tags,
    priority,
    estimateMin,
  }
}

/** Renders a task back into quick-capture syntax, for editing what was parsed. */
export function formatInput(parsed: ParsedInput): string {
  return [
    parsed.title,
    ...parsed.tags.map((tag) => `#${tag}`),
    parsed.priority > 0 ? `!${parsed.priority}` : '',
    parsed.estimateMin === null ? '' : `~${parsed.estimateMin}m`,
  ]
    .filter(Boolean)
    .join(' ')
}
