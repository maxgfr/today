#!/usr/bin/env node
/**
 * today — read and write a Today list from the terminal.
 *
 * The app stores its data in the browser's IndexedDB, which no CLI can reach.
 * So this works on the app's own export file, which is the whole state as
 * indented JSON. The round trip is: Settings → Export JSON, edit here, then
 * Settings → Import JSON. Nothing is guessed about the format — it is the same
 * document the app reads, and anything this writes the app will accept.
 *
 * Semantics are kept identical to `src/domain/` in the app: days are local-time
 * `YYYY-MM-DD` strings, positions are fractional, statuses are open/done/
 * dropped, and nothing is ever carried forward on its own.
 *
 *   node today.mjs list [day]              today, or a given day
 *   node today.mjs add "Call the bank #admin !1 ~20m" [--day tomorrow]
 *   node today.mjs done|reopen|drop|rm <query>
 *   node today.mjs move <query> <day>
 *   node today.mjs carried                 what is still waiting, with its age
 *   node today.mjs carry <query> today|tomorrow|drop
 *   node today.mjs week [day]              seven days at a glance
 *   node today.mjs stats
 *   node today.mjs path | init | json
 *
 * The file is chosen by --file, then $TODAY_FILE, then ~/.today/today.json.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

// ---------------------------------------------------------------- days

const pad = (n) => String(n).padStart(2, '0')
const toDayId = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const todayId = () => toDayId(new Date())

/** Midday, so a DST shift can never push the date onto a neighbouring day. */
const fromDayId = (day) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

const addDays = (day, delta) => {
  const date = fromDayId(day)
  date.setDate(date.getDate() + delta)
  return toDayId(date)
}

const daysBetween = (a, b) => Math.round((fromDayId(b) - fromDayId(a)) / 86_400_000)

const isDayId = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  toDayId(fromDayId(value)) === value

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/** Accepts an ISO day, `today`, `tomorrow`, `yesterday`, `+3`, `-2`, or a weekday name. */
function parseDay(input, base = todayId()) {
  if (!input) return base
  const value = String(input).trim().toLowerCase()

  if (isDayId(value)) return value
  if (value === 'today') return base
  if (value === 'tomorrow') return addDays(base, 1)
  if (value === 'yesterday') return addDays(base, -1)
  if (/^[+-]\d+$/.test(value)) return addDays(base, Number(value))

  const weekday = WEEKDAYS.indexOf(value)
  if (weekday >= 0) {
    // The next occurrence, never today — "monday" on a Monday means next Monday.
    for (let i = 1; i <= 7; i++) {
      const day = addDays(base, i)
      if (fromDayId(day).getDay() === weekday) return day
    }
  }

  fail(`Not a day: "${input}". Try 2026-08-03, today, tomorrow, +3, or a weekday.`)
}

const relative = (day, base = todayId()) => {
  const delta = daysBetween(base, day)
  if (delta === 0) return 'today'
  if (delta === 1) return 'tomorrow'
  if (delta === -1) return 'yesterday'
  return `${Math.abs(delta)}d ${delta < 0 ? 'ago' : 'ahead'}`
}

const ageLabel = (from, to) => {
  const days = Math.max(0, daysBetween(from, to))
  if (days < 7) return `${days}d`
  if (days < 30) return `${Math.floor(days / 7)}w`
  return `${Math.floor(days / 30)}mo`
}

// ------------------------------------------------------- quick capture

const TAG = /(?:^|\s)#([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu
const PRIORITY = /(?:^|\s)!([1-3])(?=\s|$)/u
// The trailing group is what makes `~1h30` readable — the form the app prints.
const ESTIMATE = /(?:^|\s)~(\d+(?:[.,]\d+)?)(m|min|h|hr)?(\d{1,2})?(?=\s|$)/iu

/** Mirrors `src/domain/parse.ts` exactly. */
function parseInput(raw) {
  let rest = raw
  const tags = []
  for (const [, tag] of raw.matchAll(TAG)) {
    const normalised = tag.toLowerCase()
    if (!tags.includes(normalised)) tags.push(normalised)
  }
  rest = rest.replace(TAG, ' ')

  const priorityMatch = rest.match(PRIORITY)
  const priority = priorityMatch ? Number(priorityMatch[1]) : 0
  if (priorityMatch) rest = rest.replace(PRIORITY, ' ')

  const estimateMatch = rest.match(ESTIMATE)
  let estimateMin = null
  if (estimateMatch) {
    const amount = Number(estimateMatch[1].replace(',', '.'))
    const unit = estimateMatch[2]?.toLowerCase()
    const isHours = unit === 'h' || unit === 'hr'
    const trailing = isHours ? Number(estimateMatch[3] ?? 0) : 0
    estimateMin = Math.round(isHours ? amount * 60 + trailing : amount)
    rest = rest.replace(ESTIMATE, ' ')
  }

  return { title: rest.replace(/\s+/g, ' ').trim(), tags, priority, estimateMin }
}

const formatEstimate = (minutes) => {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h${pad(rest)}`
}

// ------------------------------------------------------------- storage

const args = process.argv.slice(2)

function flag(name) {
  const at = args.indexOf(`--${name}`)
  if (at === -1) return undefined
  const value = args[at + 1]
  args.splice(at, value !== undefined && !value.startsWith('--') ? 2 : 1)
  return value
}

const fileFlag = flag('file')
const dayFlag = flag('day')
const asJson = args.includes('--json') && args.splice(args.indexOf('--json'), 1) !== undefined

const STORE = resolve(fileFlag ?? process.env.TODAY_FILE ?? `${homedir()}/.today/today.json`)

function fail(message) {
  console.error(`today: ${message}`)
  process.exit(1)
}

const emptyState = () => ({
  version: 1,
  tasks: {},
  templates: {},
  settings: { theme: 'system', lastTriagedDay: null, lastMaterialisedDay: null },
})

async function load() {
  if (!existsSync(STORE)) {
    fail(
      `no list at ${STORE}\n` +
        `  Export one from the app (Settings → Export JSON) and save it there,\n` +
        `  or run:  today init`,
    )
  }

  let parsed
  try {
    parsed = JSON.parse(await readFile(STORE, 'utf8'))
  } catch {
    fail(`${STORE} is not valid JSON`)
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('tasks' in parsed || 'version' in parsed)
  ) {
    fail(`${STORE} does not look like a Today export`)
  }

  return { ...emptyState(), ...parsed, tasks: parsed.tasks ?? {} }
}

async function save(state) {
  await mkdir(dirname(STORE), { recursive: true })
  // The app writes `app` and `exportedAt` on export; keeping them means the file
  // stays importable and says when it was last touched.
  const out = { app: 'today', exportedAt: new Date().toISOString(), ...state }
  await writeFile(STORE, `${JSON.stringify(out, null, 2)}\n`)
}

const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

// ----------------------------------------------------------- selecting

const live = (state) => Object.values(state.tasks).filter((task) => task.status !== 'dropped')

const ofDay = (state, day) =>
  live(state)
    .filter((task) => task.day === day)
    .sort((a, b) => a.order - b.order)

const carriedOver = (state, day = todayId()) =>
  Object.values(state.tasks)
    .filter((task) => task.status === 'open' && task.day < day)
    .sort((a, b) => a.day.localeCompare(b.day) || a.order - b.order)

/**
 * Finds the one task a query means, and refuses rather than guessing when it is
 * ambiguous — silently acting on the wrong task is the one failure mode that
 * costs more than an error message.
 */
function findOne(state, query) {
  if (!query) fail('which task? pass part of its title')

  const needle = query.trim().toLowerCase()
  const candidates = live(state).filter((task) => task.title.toLowerCase().includes(needle))

  if (candidates.length === 0) fail(`nothing matches "${query}"`)
  if (candidates.length === 1) return candidates[0]

  const exact = candidates.filter((task) => task.title.toLowerCase() === needle)
  if (exact.length === 1) return exact[0]

  // Prefer today when the query is otherwise ambiguous across days.
  const onToday = candidates.filter((task) => task.day === todayId())
  if (onToday.length === 1) return onToday[0]

  console.error(`today: "${query}" matches ${candidates.length} tasks:`)
  for (const task of candidates) console.error(`  · ${task.title}  (${task.day})`)
  console.error('  Narrow the query.')
  process.exit(1)
}

// ------------------------------------------------------------- output

const c = process.stdout.isTTY
  ? {
      dim: (s) => `[2m${s}[0m`,
      bold: (s) => `[1m${s}[0m`,
      accent: (s) => `[38;5;202m${s}[0m`,
      strike: (s) => `[9;2m${s}[0m`,
    }
  : { dim: (s) => s, bold: (s) => s, accent: (s) => s, strike: (s) => s }

function renderTask(task, index) {
  const done = task.status === 'done'
  const number = done ? c.dim(' —') : c.dim(pad(index))
  const box = done ? c.accent('[x]') : '[ ]'
  const title = done ? c.strike(task.title) : task.title

  const meta = [
    task.priority > 0 ? c.accent(`P${task.priority}`) : '',
    ...task.tags.map((tag) => c.dim(`#${tag}`)),
    task.estimateMin ? c.dim(formatEstimate(task.estimateMin)) : '',
    task.subtasks?.length
      ? c.dim(`${task.subtasks.filter((s) => s.done).length}/${task.subtasks.length}`)
      : '',
    task.carriedFrom ? c.accent(ageLabel(task.carriedFrom, todayId())) : '',
  ].filter(Boolean)

  return `  ${number} ${box} ${title}${meta.length ? `  ${meta.join(' ')}` : ''}`
}

function renderDay(state, day) {
  const tasks = ofDay(state, day)
  const done = tasks.filter((task) => task.status === 'done').length
  const label = fromDayId(day).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const lines = [
    '',
    `  ${c.bold(label.toUpperCase())}  ${c.dim(`${done}/${tasks.length}`)}${
      day === todayId() ? '' : c.dim(`  · ${relative(day)}`)
    }`,
    '',
  ]

  if (tasks.length === 0) {
    lines.push(c.dim('  nothing written down for this day'), '')
    return lines.join('\n')
  }

  let position = 0
  for (const task of tasks) {
    lines.push(renderTask(task, task.status === 'done' ? 0 : ++position))
  }

  if (tasks.length > 0 && done === tasks.length) {
    lines.push('', `  ${c.accent('day cleared')}`)
  }
  lines.push('')
  return lines.join('\n')
}

// ----------------------------------------------------------- commands

const [command = 'list', ...rest] = args

const commands = {
  async path() {
    console.log(STORE)
  },

  async init() {
    if (existsSync(STORE)) fail(`${STORE} already exists — refusing to overwrite it`)
    await save(emptyState())
    console.log(`Created an empty list at ${STORE}`)
    console.log('Import it into the app with Settings → Import JSON, or export over it from there.')
  },

  async json() {
    console.log(JSON.stringify(await load(), null, 2))
  },

  async list() {
    const state = await load()
    const day = parseDay(rest[0])
    if (asJson) return console.log(JSON.stringify(ofDay(state, day), null, 2))

    process.stdout.write(renderDay(state, day))

    const waiting = carriedOver(state, todayId())
    if (day === todayId() && waiting.length > 0) {
      console.log(c.dim(`  ${waiting.length} left over from earlier days — run: today carried\n`))
    }
  },

  async add() {
    const day = parseDay(dayFlag)
    const text = rest.join(' ').trim()
    const parsed = parseInput(text)
    if (parsed.title === '') fail('nothing to add — give the task a title')

    const state = await load()
    const orders = ofDay(state, day).map((task) => task.order)
    const task = {
      id: newId(),
      title: parsed.title,
      notes: '',
      status: 'open',
      day,
      order: orders.length === 0 ? 1024 : Math.max(...orders) + 1024,
      priority: parsed.priority,
      tags: parsed.tags,
      subtasks: [],
      estimateMin: parsed.estimateMin,
      createdAt: new Date().toISOString(),
      completedAt: null,
      carriedFrom: null,
      seriesId: null,
    }

    state.tasks[task.id] = task
    await save(state)
    console.log(`Added to ${relative(day)}: ${task.title}`)
  },

  async done() {
    const state = await load()
    const task = findOne(state, rest.join(' '))
    if (task.status === 'done') return console.log(`Already done: ${task.title}`)

    task.status = 'done'
    task.completedAt = new Date().toISOString()
    await save(state)

    const remaining = ofDay(state, task.day).filter((t) => t.status === 'open').length
    console.log(`Done: ${task.title}`)
    console.log(
      remaining === 0
        ? c.accent(`  ${relative(task.day)} is clear.`)
        : c.dim(`  ${remaining} left on ${relative(task.day)}.`),
    )
  },

  async reopen() {
    const state = await load()
    const task = findOne(state, rest.join(' '))
    task.status = 'open'
    task.completedAt = null
    await save(state)
    console.log(`Reopened: ${task.title}`)
  },

  async drop() {
    const state = await load()
    const task = findOne(state, rest.join(' '))
    task.status = 'dropped'
    await save(state)
    console.log(`Dropped: ${task.title}`)
  },

  async rm() {
    const state = await load()
    const task = findOne(state, rest.join(' '))
    delete state.tasks[task.id]
    await save(state)
    console.log(`Deleted: ${task.title}`)
  },

  async move() {
    const state = await load()
    const day = parseDay(rest.at(-1))
    const task = findOne(state, rest.slice(0, -1).join(' '))

    const orders = ofDay(state, day)
      .filter((other) => other.id !== task.id)
      .map((other) => other.order)

    task.day = day
    task.order = orders.length === 0 ? 1024 : Math.max(...orders) + 1024
    await save(state)
    console.log(`Moved to ${relative(day)}: ${task.title}`)
  },

  async carried() {
    const state = await load()
    const waiting = carriedOver(state, todayId())
    if (asJson) return console.log(JSON.stringify(waiting, null, 2))

    if (waiting.length === 0) return console.log('\n  Nothing left over. The past is closed.\n')

    console.log(`\n  ${c.bold('LEFT OVER')}  ${c.dim(waiting.length)}\n`)
    for (const task of waiting) {
      const age = ageLabel(task.carriedFrom ?? task.day, todayId())
      console.log(`  ${c.accent(age.padStart(4))}  ${task.title}  ${c.dim(`(${task.day})`)}`)
    }
    console.log(c.dim('\n  today carry "<title>" today|tomorrow|drop\n'))
  },

  async carry() {
    const decision = (rest.at(-1) ?? '').toLowerCase()
    if (!['today', 'tomorrow', 'drop'].includes(decision)) {
      fail('carry needs a decision: today, tomorrow, or drop')
    }

    const state = await load()
    const query = rest.slice(0, -1).join(' ')

    const targets =
      query.trim() === '' || query.trim().toLowerCase() === 'all'
        ? carriedOver(state, todayId())
        : [findOne(state, query)]

    if (targets.length === 0) return console.log('Nothing left over to carry.')

    for (const task of targets) {
      if (decision === 'drop') {
        task.status = 'dropped'
        continue
      }
      task.carriedFrom ??= task.day
      task.day = decision === 'today' ? todayId() : addDays(todayId(), 1)
    }

    await save(state)
    console.log(
      `${targets.length} ${targets.length === 1 ? 'task' : 'tasks'} ${
        decision === 'drop' ? 'dropped' : `moved to ${decision}`
      }.`,
    )
  },

  async week() {
    const state = await load()
    const anchor = parseDay(rest[0])
    const weekday = fromDayId(anchor).getDay()
    const monday = addDays(anchor, weekday === 0 ? -6 : 1 - weekday)

    console.log('')
    for (let i = 0; i < 7; i++) {
      const day = addDays(monday, i)
      const tasks = ofDay(state, day)
      const done = tasks.filter((task) => task.status === 'done').length
      const name = fromDayId(day).toLocaleDateString('en-GB', { weekday: 'short' })
      const mark = day === todayId() ? c.accent('›') : ' '

      const summary =
        tasks.length === 0
          ? c.dim('—')
          : `${done}/${tasks.length}  ${c.dim(
              tasks
                .filter((task) => task.status === 'open')
                .map((task) => task.title)
                .join(', ')
                .slice(0, 60),
            )}`

      console.log(`  ${mark} ${c.bold(name)} ${c.dim(day.slice(8))}  ${summary}`)
    }
    console.log('')
  },

  async stats() {
    const state = await load()
    const tasks = live(state)
    const byDay = new Map()

    for (const task of tasks) {
      const entry = byDay.get(task.day) ?? { total: 0, done: 0 }
      entry.total += 1
      if (task.status === 'done') entry.done += 1
      byDay.set(task.day, entry)
    }

    const completed = tasks.filter((task) => task.status === 'done').length
    const cleared = [...byDay.values()].filter((d) => d.total > 0 && d.done === d.total).length

    // Same rule as the app: an empty day is skipped, not counted against you,
    // and an unfinished today does not break a run that is still in progress.
    let streak = 0
    let cursor = todayId()
    for (let i = 0; i < 366; i++) {
      const entry = byDay.get(cursor)
      if (entry && entry.total > 0) {
        if (entry.done === entry.total) streak += 1
        else if (cursor !== todayId()) break
      }
      cursor = addDays(cursor, -1)
    }

    console.log('')
    console.log(`  ${c.bold(streak)} day streak`)
    console.log(`  ${c.bold(completed)} things done across ${byDay.size} days`)
    console.log(`  ${c.bold(cleared)} days cleared`)
    console.log(`  ${c.dim(`left over right now: ${carriedOver(state).length}`)}`)
    console.log('')
  },

  async help() {
    console.log(`
  today — manage a Today list from the terminal

  The app keeps its data in the browser. This works on its export file:
  Settings → Export JSON, edit here, Settings → Import JSON.

  ${c.dim('file:')} ${STORE}

    list [day]                    the day's board (default: today)
    add "<text>" [--day <day>]    #tag  !1..!3  ~30m/~2h
    done|reopen|drop|rm <query>
    move <query> <day>
    carried                       what is still waiting, with its age
    carry <query>|all today|tomorrow|drop
    week [day]
    stats
    path | init | json

  ${c.dim('day:')} 2026-08-03 · today · tomorrow · yesterday · +3 · -2 · friday
`)
  },
}

const run = commands[command] ?? (command.startsWith('-') ? commands.help : undefined)
if (!run) fail(`unknown command "${command}" — run: today help`)

await run()
