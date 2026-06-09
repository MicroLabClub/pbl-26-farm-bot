// Client-side task queue, persisted in localStorage.
// FarmBot has no simple "tasks" REST endpoint, so the dashboard owns the queue
// and a background scheduler (see TaskScheduler) runs due tasks over MQTT while
// the app is open.
import type { Task } from '@/types'

const STORAGE_KEY = 'dashboard-tasks'

export function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Task[]) : []
  } catch {
    return []
  }
}

export function saveTasks(tasks: Task[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
}

export function addTask(task: Task): Task[] {
  const tasks = [...loadTasks(), task]
  saveTasks(tasks)
  return tasks
}

export function updateTask(id: string, patch: Partial<Task>): Task[] {
  const tasks = loadTasks().map(t => (t.id === id ? { ...t, ...patch } : t))
  saveTasks(tasks)
  return tasks
}

export function removeTask(id: string): Task[] {
  const tasks = loadTasks().filter(t => t.id !== id)
  saveTasks(tasks)
  return tasks
}
