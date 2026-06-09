import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { loadTasks, updateTask } from '@/lib/taskQueue'
import { runScheduledTask } from '@/api/farmbot'
import { isConnected } from '@/api/mqtt'
import { loadSettings } from '@/lib/settings'

const TICK_MS = 3000

/**
 * Headless component: polls the local task queue and runs any pending task
 * whose scheduled time has passed, over MQTT. Mounted once at app root, so
 * tasks fire regardless of which page is open (as long as the app is open).
 */
export function TaskScheduler() {
  const qc = useQueryClient()

  useEffect(() => {
    let running = false

    const tick = async () => {
      if (running) return // don't overlap ticks while a task executes
      const mock = loadSettings().mock
      // When live, wait until the broker is connected so we don't fail tasks
      // we could run a moment later.
      if (!mock && !isConnected()) return

      const now = Date.now()
      const due = loadTasks().filter(
        t => t.status === 'pending' && new Date(t.scheduledAt).getTime() <= now,
      )
      if (due.length === 0) return

      running = true
      try {
        for (const task of due) {
          updateTask(task.id, { status: 'running' })
          qc.invalidateQueries({ queryKey: ['tasks'] })
          const started = Date.now()
          try {
            await runScheduledTask(task)
            updateTask(task.id, {
              status: 'completed',
              executedAt: new Date().toISOString(),
              durationMs: Date.now() - started,
            })
          } catch {
            updateTask(task.id, {
              status: 'failed',
              executedAt: new Date().toISOString(),
              durationMs: Date.now() - started,
            })
          }
          qc.invalidateQueries({ queryKey: ['tasks'] })
        }
      } finally {
        running = false
      }
    }

    const id = setInterval(tick, TICK_MS)
    tick()
    return () => clearInterval(id)
  }, [qc])

  return null
}
