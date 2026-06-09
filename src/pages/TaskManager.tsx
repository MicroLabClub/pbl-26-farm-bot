import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Loader2, Circle, AlertTriangle, Clock, X } from 'lucide-react'
import { getTasks, createTask } from '@/api/farmbot'
import { Panel, PanelHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatTime, formatDate, cn } from '@/lib/utils'
import type { Task, TaskAction } from '@/types'

type Filter = 'all' | 'running' | 'pending' | 'completed' | 'failed'

const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'running', label: 'Running' },
  { id: 'pending', label: 'Queue' },
  { id: 'completed', label: 'Done' },
  { id: 'failed', label: 'Failed' },
]

const actionColor: Record<Task['action'], string> = {
  water: '#3a5a7c', plant: '#4a7c2c', probe: '#c9a032',
  photo: '#7a5fa3', home: '#8b6f47',
}

function statusIcon(s: Task['status']) {
  if (s === 'completed') return <CheckCircle2 size={13} className="text-[#4a7c2c]" />
  if (s === 'running') return <Loader2 size={13} className="text-[#3a5a7c] animate-spin" />
  if (s === 'failed') return <AlertTriangle size={13} className="text-[#b34a3a]" />
  if (s === 'skipped') return <Circle size={13} className="text-[#8b6f47]" />
  return <Clock size={13} className="text-[#8b6f47]" />
}

function statusVariant(s: Task['status']): 'green' | 'blue' | 'yellow' | 'red' | 'gray' {
  if (s === 'completed') return 'green'
  if (s === 'running') return 'blue'
  if (s === 'pending') return 'yellow'
  if (s === 'failed') return 'red'
  return 'gray'
}

export default function TaskManager() {
  const qc = useQueryClient()
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: getTasks, refetchInterval: 3000 })
  const [filter, setFilter] = useState<Filter>('all')
  const [showScheduler, setShowScheduler] = useState(false)

  const counts = {
    all: tasks.length,
    running: tasks.filter(t => t.status === 'running').length,
    pending: tasks.filter(t => t.status === 'pending').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
  }

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter)

  return (
    <div className="px-6 py-8 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b6f47] font-mono mb-2">
            Scheduled operations
          </div>
          <h1 className="font-display text-4xl text-[#1a1f1a]">
            Task <span className="italic text-[#2d5016]">queue</span>
          </h1>
        </div>
        <button
          onClick={() => setShowScheduler(v => !v)}
          className="px-4 py-2 bg-[#2d5016] text-[#f5f1e8] text-xs font-mono uppercase tracking-[0.15em] rounded-sm hover:bg-[#1f3810] transition-colors"
        >
          {showScheduler ? '✕ Cancel' : '+ Schedule task'}
        </button>
      </div>

      {/* Scheduler drawer */}
      <AnimatePresence>
        {showScheduler && (
          <SchedulerDrawer
            onSubmit={async (action, cellId, notes, scheduledAt) => {
              await createTask(action, { x: 0, y: 0, z: 0 }, scheduledAt, cellId || undefined, notes || undefined)
              await qc.invalidateQueries({ queryKey: ['tasks'] })
              setShowScheduler(false)
            }}
            onClose={() => setShowScheduler(false)}
          />
        )}
      </AnimatePresence>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-[#d4cdb8]">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'px-4 py-2.5 text-xs font-mono uppercase tracking-wider transition-colors relative',
              filter === f.id ? 'text-[#1a1f1a]' : 'text-[#8b6f47] hover:text-[#4a5444]',
            )}
          >
            <span className="flex items-center gap-2">
              {f.label}
              <span className="text-[10px] tabular-nums opacity-60">{counts[f.id]}</span>
            </span>
            {filter === f.id && (
              <motion.div
                layoutId="filter-indicator"
                className="absolute -bottom-px left-0 right-0 h-[2px] bg-[#2d5016]"
                transition={{ duration: 0.2 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <Panel>
        <PanelHeader label="Tasks" meta={`showing ${filtered.length}`} />
        {/* Column headers */}
        <div className="grid grid-cols-12 gap-3 px-4 py-2 border-b border-[#d4cdb8] text-[9px] font-mono uppercase tracking-[0.18em] text-[#8b6f47] bg-[#ebe5d4]/20">
          <div className="col-span-1" />
          <div className="col-span-2">Action</div>
          <div className="col-span-2">Cell</div>
          <div className="col-span-3">Position</div>
          <div className="col-span-2">Scheduled</div>
          <div className="col-span-1 text-right">Dur</div>
          <div className="col-span-1 text-right">State</div>
        </div>

        {/* Rows */}
        <div>
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-xs font-mono uppercase tracking-wider text-[#8b6f47]">
              No tasks match this filter
            </div>
          ) : (
            filtered.map((task, i) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="grid grid-cols-12 gap-3 px-4 py-3 items-center border-b border-[#d4cdb8] last:border-0 hover:bg-[#ebe5d4]/30 transition-colors text-xs"
              >
                <div className="col-span-1 flex items-center gap-2">
                  {statusIcon(task.status)}
                  <div className="w-1 h-1 rounded-full" style={{ backgroundColor: actionColor[task.action] }} />
                </div>
                <div className="col-span-2 capitalize text-[#1a1f1a] font-medium">{task.action}</div>
                <div className="col-span-2 font-mono text-[#4a5444]">
                  {task.cellId ?? <span className="text-[#d4cdb8]">—</span>}
                </div>
                <div className="col-span-3 font-mono text-[#8b6f47] tabular-nums">
                  X{task.position.x} Y{task.position.y} Z{task.position.z}
                </div>
                <div className="col-span-2 font-mono text-[#4a5444] tabular-nums">
                  {formatDate(task.scheduledAt).split(',')[0]} {formatTime(task.scheduledAt)}
                </div>
                <div className="col-span-1 text-right font-mono text-[#8b6f47] tabular-nums">
                  {task.durationMs ? `${(task.durationMs / 1000).toFixed(1)}s` : '—'}
                </div>
                <div className="col-span-1 flex justify-end">
                  <Badge variant={statusVariant(task.status)}>{task.status}</Badge>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </Panel>
    </div>
  )
}

const taskActions: TaskAction[] = ['water', 'plant', 'probe', 'photo', 'home']

function SchedulerDrawer({ onSubmit, onClose }: {
  onSubmit: (action: TaskAction, cellId: string, notes: string, scheduledAt: string) => Promise<void>
  onClose: () => void
}) {
  const [action, setAction] = useState<TaskAction>('water')
  const [cellId, setCellId] = useState('')
  const [notes, setNotes] = useState('')
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() + 5)
    return d.toISOString().slice(0, 16)
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    await onSubmit(action, cellId, notes, new Date(scheduledAt).toISOString())
    setSubmitting(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden mb-6"
    >
      <div className="border border-[#d4cdb8] rounded-sm bg-[#ebe5d4]/20">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#d4cdb8] bg-[#ebe5d4]/30">
          <span className="text-[10px] uppercase tracking-[0.18em] text-[#4a5444] font-mono font-medium">New scheduled task</span>
          <button onClick={onClose} className="text-[#8b6f47] hover:text-[#1a1f1a]"><X size={13} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8b6f47] font-mono mb-1.5">Action</label>
            <select
              value={action}
              onChange={e => setAction(e.target.value as TaskAction)}
              className="w-full px-2.5 py-1.5 bg-[#f5f1e8] border border-[#d4cdb8] rounded-sm font-mono text-xs focus:border-[#2d5016] focus:outline-none"
            >
              {taskActions.map(a => <option key={a} value={a} className="capitalize">{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8b6f47] font-mono mb-1.5">Cell <span className="normal-case opacity-60">(opt.)</span></label>
            <input
              value={cellId}
              onChange={e => setCellId(e.target.value)}
              placeholder="e.g. 2-1"
              className="w-full px-2.5 py-1.5 bg-[#f5f1e8] border border-[#d4cdb8] rounded-sm font-mono text-xs focus:border-[#2d5016] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8b6f47] font-mono mb-1.5">Scheduled at</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[#f5f1e8] border border-[#d4cdb8] rounded-sm font-mono text-xs focus:border-[#2d5016] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8b6f47] font-mono mb-1.5">Notes <span className="normal-case opacity-60">(opt.)</span></label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="optional note"
              className="w-full px-2.5 py-1.5 bg-[#f5f1e8] border border-[#d4cdb8] rounded-sm font-mono text-xs focus:border-[#2d5016] focus:outline-none"
            />
          </div>
          <div className="col-span-2 md:col-span-4 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-[#2d5016] text-[#f5f1e8] text-xs font-mono uppercase tracking-[0.15em] rounded-sm hover:bg-[#1f3810] disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Scheduling…' : 'Schedule'}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  )
}
