/**
 * The only place application state changes.
 *
 * Pure by construction: every action that needs a clock or an id carries it in
 * its payload. That is what lets the tests assert on carry-over and recurrence
 * without freezing time, and what lets undo replay a state without side effects
 * firing a second time.
 */

import { newId } from '../lib/id'
import { today as todayOf, addDays } from '../lib/date'
import { parseInput } from './parse'
import { needsRenormalisation, orderAtEnd, orderAtStart, orderBetween, renormalise } from './order'
import { dueInstances } from './recurrence'
import type {
  AppState,
  DayId,
  Priority,
  RecurrenceRule,
  RecurringTemplate,
  Subtask,
  Task,
  Theme,
} from './types'
import { emptyState } from './types'

export type TriageDecision = 'keep' | 'later' | 'drop'

export type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'addTask'; day: DayId; input: string; now: string; position?: 'start' | 'end' }
  | { type: 'editTask'; id: string; input: string }
  | { type: 'setNotes'; id: string; notes: string }
  | { type: 'setPriority'; id: string; priority: Priority }
  | { type: 'toggleTask'; id: string; now: string }
  | { type: 'deleteTask'; id: string }
  | { type: 'moveTask'; id: string; toDay: DayId; toIndex: number }
  | { type: 'addSubtask'; taskId: string; title: string }
  | { type: 'toggleSubtask'; taskId: string; subtaskId: string }
  | { type: 'editSubtask'; taskId: string; subtaskId: string; title: string }
  | { type: 'deleteSubtask'; taskId: string; subtaskId: string }
  | { type: 'triage'; id: string; decision: TriageDecision; today: DayId }
  | { type: 'triageAll'; decision: TriageDecision; today: DayId }
  | { type: 'dismissTriage'; today: DayId }
  | { type: 'addTemplate'; title: string; rule: RecurrenceRule; startDay: DayId; now: string }
  | { type: 'updateTemplate'; id: string; patch: Partial<Omit<RecurringTemplate, 'id'>> }
  | { type: 'deleteTemplate'; id: string }
  | { type: 'materialise'; day: DayId; now: string }
  | { type: 'setTheme'; theme: Theme }
  | { type: 'importState'; state: AppState }
  | { type: 'clearAll' }

/** Tasks of a day, in display order. Shared by the reducer and the selectors. */
export function sortedTasksOf(state: AppState, day: DayId): Task[] {
  return Object.values(state.tasks)
    .filter((task) => task.day === day && task.status !== 'dropped')
    .sort((a, b) => a.order - b.order)
}

const withTask = (state: AppState, id: string, update: (task: Task) => Task): AppState => {
  const task = state.tasks[id]
  if (!task) return state
  return { ...state, tasks: { ...state.tasks, [id]: update(task) } }
}

const withSubtasks = (
  state: AppState,
  taskId: string,
  update: (subtasks: Subtask[]) => Subtask[],
): AppState => withTask(state, taskId, (task) => ({ ...task, subtasks: update(task.subtasks) }))

function makeTask(day: DayId, input: string, now: string, order: number): Task {
  const parsed = parseInput(input)
  return {
    id: newId(),
    title: parsed.title,
    notes: '',
    status: 'open',
    day,
    order,
    priority: parsed.priority,
    tags: parsed.tags,
    subtasks: [],
    estimateMin: parsed.estimateMin,
    createdAt: now,
    completedAt: null,
    carriedFrom: null,
    seriesId: null,
  }
}

/**
 * Applies a triage decision. `keep` is the only one that changes the day, and
 * it records where the task came from so the age badge stays truthful across
 * several carries — otherwise a task carried three times would read as new.
 */
function decide(task: Task, decision: TriageDecision, today: DayId): Task {
  switch (decision) {
    case 'keep':
      return { ...task, day: today, carriedFrom: task.carriedFrom ?? task.day }
    case 'later':
      return { ...task, day: addDays(today, 1), carriedFrom: task.carriedFrom ?? task.day }
    case 'drop':
      return { ...task, status: 'dropped' }
  }
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
    case 'importState':
      return action.state

    case 'clearAll':
      return {
        ...emptyState(),
        settings: { ...emptyState().settings, theme: state.settings.theme },
      }

    case 'addTask': {
      const parsed = parseInput(action.input)
      if (parsed.title === '') return state

      const orders = sortedTasksOf(state, action.day).map((task) => task.order)
      const order = action.position === 'start' ? orderAtStart(orders) : orderAtEnd(orders)
      const task = makeTask(action.day, action.input, action.now, order)
      return { ...state, tasks: { ...state.tasks, [task.id]: task } }
    }

    case 'editTask': {
      const parsed = parseInput(action.input)
      if (parsed.title === '') return state
      return withTask(state, action.id, (task) => ({
        ...task,
        title: parsed.title,
        // Markers only overwrite when the user actually typed one, so editing
        // a title does not silently wipe a priority set from the keyboard.
        tags: parsed.tags.length > 0 ? parsed.tags : task.tags,
        priority: parsed.priority > 0 ? parsed.priority : task.priority,
        estimateMin: parsed.estimateMin ?? task.estimateMin,
      }))
    }

    case 'setNotes':
      return withTask(state, action.id, (task) => ({ ...task, notes: action.notes }))

    case 'setPriority':
      return withTask(state, action.id, (task) => ({ ...task, priority: action.priority }))

    case 'toggleTask':
      return withTask(state, action.id, (task) =>
        task.status === 'done'
          ? { ...task, status: 'open', completedAt: null }
          : { ...task, status: 'done', completedAt: action.now },
      )

    case 'deleteTask': {
      const { [action.id]: removed, ...rest } = state.tasks
      return removed ? { ...state, tasks: rest } : state
    }

    case 'moveTask': {
      const task = state.tasks[action.id]
      if (!task) return state

      const siblings = sortedTasksOf(state, action.toDay).filter((other) => other.id !== action.id)
      const index = Math.max(0, Math.min(action.toIndex, siblings.length))
      const order = orderBetween(siblings[index - 1]?.order ?? null, siblings[index]?.order ?? null)

      const moved: Task = { ...task, day: action.toDay, order }
      const tasks = { ...state.tasks, [action.id]: moved }

      // Renormalising only the affected day keeps the rewrite bounded.
      const dayTasks = [...siblings, moved]
      if (!needsRenormalisation(dayTasks.map((t) => t.order))) return { ...state, tasks }

      const respaced = renormalise(dayTasks)
      for (const [id, newOrder] of Object.entries(respaced)) {
        tasks[id] = { ...tasks[id]!, order: newOrder }
      }
      return { ...state, tasks }
    }

    case 'addSubtask': {
      const title = action.title.trim()
      if (title === '') return state
      return withSubtasks(state, action.taskId, (subtasks) => [
        ...subtasks,
        { id: newId(), title, done: false },
      ])
    }

    case 'toggleSubtask':
      return withSubtasks(state, action.taskId, (subtasks) =>
        subtasks.map((subtask) =>
          subtask.id === action.subtaskId ? { ...subtask, done: !subtask.done } : subtask,
        ),
      )

    case 'editSubtask': {
      const title = action.title.trim()
      if (title === '') return state
      return withSubtasks(state, action.taskId, (subtasks) =>
        subtasks.map((subtask) =>
          subtask.id === action.subtaskId ? { ...subtask, title } : subtask,
        ),
      )
    }

    case 'deleteSubtask':
      return withSubtasks(state, action.taskId, (subtasks) =>
        subtasks.filter((subtask) => subtask.id !== action.subtaskId),
      )

    case 'triage': {
      const task = state.tasks[action.id]
      if (!task) return state
      return {
        ...state,
        tasks: { ...state.tasks, [action.id]: decide(task, action.decision, action.today) },
      }
    }

    case 'triageAll': {
      const tasks = { ...state.tasks }
      for (const task of carriedOverTasks(state, action.today)) {
        tasks[task.id] = decide(task, action.decision, action.today)
      }
      return {
        ...state,
        tasks,
        settings: { ...state.settings, lastTriagedDay: action.today },
      }
    }

    case 'dismissTriage':
      return { ...state, settings: { ...state.settings, lastTriagedDay: action.today } }

    case 'addTemplate': {
      const parsed = parseInput(action.title)
      if (parsed.title === '') return state
      const template: RecurringTemplate = {
        id: newId(),
        title: parsed.title,
        priority: parsed.priority,
        tags: parsed.tags,
        rule: action.rule,
        startDay: action.startDay,
        active: true,
        createdAt: action.now,
      }
      return { ...state, templates: { ...state.templates, [template.id]: template } }
    }

    case 'updateTemplate': {
      const template = state.templates[action.id]
      if (!template) return state
      return {
        ...state,
        templates: { ...state.templates, [action.id]: { ...template, ...action.patch } },
      }
    }

    case 'deleteTemplate': {
      const { [action.id]: removed, ...rest } = state.templates
      return removed ? { ...state, templates: rest } : state
    }

    case 'materialise': {
      const instances = dueInstances(state, action.day, action.now)
      if (instances.length === 0) {
        return { ...state, settings: { ...state.settings, lastMaterialisedDay: action.day } }
      }
      const tasks = { ...state.tasks }
      let order = orderAtEnd(sortedTasksOf(state, action.day).map((task) => task.order))
      for (const instance of instances) {
        tasks[instance.id] = { ...instance, order }
        order += 1024
      }
      return {
        ...state,
        tasks,
        settings: { ...state.settings, lastMaterialisedDay: action.day },
      }
    }

    case 'setTheme':
      return { ...state, settings: { ...state.settings, theme: action.theme } }
  }
}

/**
 * Open tasks left behind on earlier days.
 *
 * This is the whole reason nothing auto-rolls: the list is computed on demand
 * and shown for a decision, so a task that has been sitting for three days is
 * visibly three days old instead of quietly blending into this morning.
 */
export function carriedOverTasks(state: AppState, day: DayId = todayOf()): Task[] {
  return Object.values(state.tasks)
    .filter((task) => task.status === 'open' && task.day < day)
    .sort((a, b) => a.day.localeCompare(b.day) || a.order - b.order)
}

export function needsTriage(state: AppState, day: DayId): boolean {
  return state.settings.lastTriagedDay !== day && carriedOverTasks(state, day).length > 0
}
