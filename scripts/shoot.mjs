#!/usr/bin/env node
// Captures the app's surfaces for the README and for design review.
//
// Seeds IndexedDB directly before the app boots, so the shots show a real
// working day rather than an empty state — and so the same day comes out
// identically every run, which is what makes two screenshots comparable.
//
//   pnpm build && node scripts/shoot.mjs [baseUrl]
//
// Demo content is deliberately domain-neutral: this is a general-purpose tool,
// and a screenshot full of engineering tickets would quietly tell most visitors
// it is not for them.

import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import process from 'node:process'

const BASE = process.argv[2] ?? 'http://localhost:4173/today/'
const OUT = 'docs/screenshots'

const day = (offset) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const task = (id, title, dayId, order, extra = {}) => ({
  id,
  title,
  notes: '',
  status: 'open',
  day: dayId,
  order,
  priority: 0,
  tags: [],
  subtasks: [],
  estimateMin: null,
  createdAt: new Date().toISOString(),
  completedAt: null,
  carriedFrom: null,
  seriesId: null,
  ...extra,
})

const state = (extraTasks = []) => ({
  version: 1,
  tasks: Object.fromEntries(
    [
      task('a', 'Finish the quarterly write-up', day(0), 1024, {
        priority: 1,
        tags: ['work'],
        estimateMin: 90,
      }),
      task('b', 'Book the dentist', day(0), 2048, { tags: ['admin'], estimateMin: 10 }),
      task('c', 'Read two chapters', day(0), 3072, {
        subtasks: [
          { id: 's1', title: 'Chapter 4', done: true },
          { id: 's2', title: 'Chapter 5', done: false },
        ],
      }),
      task('d', 'Water the plants', day(0), 4096, {
        status: 'done',
        completedAt: new Date().toISOString(),
        tags: ['home'],
      }),
      task('e', 'Reply to Sam about the weekend', day(0), 5120, { priority: 2 }),
      task('f', 'Pick up the parcel', day(1), 1024, { tags: ['errands'] }),
      task('g', 'Plan the trip', day(2), 1024, { priority: 2, estimateMin: 45 }),
      task('h', 'Clear the inbox', day(-1), 1024, {
        status: 'done',
        completedAt: new Date().toISOString(),
      }),
      ...extraTasks,
    ].map((entry) => [entry.id, entry]),
  ),
  templates: {},
  settings: { theme: 'system', lastTriagedDay: day(0), lastMaterialisedDay: day(0) },
})

const seed = (blob) => `
  new Promise((resolve) => {
    const request = indexedDB.open('today', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('state')
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('state', 'readwrite')
      tx.objectStore('state').put(${JSON.stringify(blob)}, 'app-state')
      tx.oncomplete = () => resolve()
    }
  })
`

async function shoot(browser, { name, width, height, theme, blob, hash = '', before }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    colorScheme: theme,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()

  await page.addInitScript(`window.__seed = () => ${seed(blob)}`)
  await page.goto(BASE)
  await page.evaluate('window.__seed()')
  await page.goto(`${BASE}${hash}`)
  await page.waitForSelector('h1')
  await page.waitForTimeout(400)

  if (before) await before(page)

  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log(`  ${OUT}/${name}.png  ${width}x${height} ${theme}`)
  await context.close()
}

const carried = [
  task('x1', 'Send the signed form back', day(-3), 1024),
  task('x2', 'Fix the wobbly shelf', day(-1), 1024, { priority: 3 }),
]

await mkdir(OUT, { recursive: true })
const browser = await chromium.launch()

const shots = [
  { name: 'today-light', width: 1280, height: 900, theme: 'light', blob: state() },
  { name: 'today-dark', width: 1280, height: 900, theme: 'dark', blob: state() },
  {
    name: 'triage',
    width: 1280,
    height: 900,
    theme: 'light',
    blob: {
      ...state(carried),
      settings: { theme: 'system', lastTriagedDay: null, lastMaterialisedDay: null },
    },
  },
  { name: 'week', width: 1280, height: 800, theme: 'light', blob: state(), hash: '#/week' },
  { name: 'stats', width: 1280, height: 900, theme: 'dark', blob: state(), hash: '#/stats' },
  { name: 'settings', width: 1280, height: 900, theme: 'light', blob: state(), hash: '#/settings' },
  { name: 'mobile-light', width: 390, height: 844, theme: 'light', blob: state() },
  { name: 'mobile-dark', width: 390, height: 844, theme: 'dark', blob: state() },
  { name: 'empty', width: 1280, height: 900, theme: 'light', blob: { version: 1 } },
  {
    name: 'palette',
    width: 1280,
    height: 900,
    theme: 'dark',
    blob: state(),
    before: async (page) => {
      await page.keyboard.press('Meta+k')
      await page.waitForTimeout(300)
    },
  },
  {
    name: 'cleared',
    width: 1280,
    height: 760,
    theme: 'light',
    blob: {
      version: 1,
      tasks: Object.fromEntries(
        ['Finish the quarterly write-up', 'Book the dentist', 'Water the plants'].map(
          (title, index) => [
            `c${index}`,
            task(`c${index}`, title, day(0), (index + 1) * 1024, {
              status: 'done',
              completedAt: new Date().toISOString(),
            }),
          ],
        ),
      ),
      templates: {},
      settings: { theme: 'system', lastTriagedDay: day(0), lastMaterialisedDay: day(0) },
    },
  },
]

for (const shot of shots) await shoot(browser, shot)

await browser.close()
console.log(`\n  ${shots.length} screenshots written to ${OUT}/`)
