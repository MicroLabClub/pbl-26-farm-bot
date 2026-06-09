import { useState, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUpRight, AlertTriangle, CheckCircle2, Loader2, Circle, Clock, Zap, ScanLine } from 'lucide-react'
import { getSystemStatus, getAlerts, getTasks, getCrops, createTask, sendHome, sendEStop, getImages, scanBed, getBedDimensions } from '@/api/farmbot'
import { usePosition } from '@/context/PositionContext'
import { Panel, PanelHeader, PanelBody } from '@/components/ui/Card'
import { SkeletonBlock } from '@/components/ui/Skeleton'
import { useToast } from '@/context/ToastContext'
import { formatUptime, formatRelative, formatTime, healthColor } from '@/lib/utils'
import type { Task, BedImage, Position } from '@/types'

const SCAN_COLS = 4
const SCAN_ROWS = 4

function scanGrid(bedW: number, bedH: number): Position[] {
  const out: Position[] = []
  for (let r = 0; r < SCAN_ROWS; r++) {
    for (let c = 0; c < SCAN_COLS; c++) {
      out.push({
        x: Math.round((c + 0.5) * (bedW / SCAN_COLS)),
        y: Math.round((r + 0.5) * (bedH / SCAN_ROWS)),
        z: 0,
      })
    }
  }
  return out
}

function cellIndexForImage(img: BedImage, bedW: number, bedH: number): number {
  const c = Math.min(SCAN_COLS - 1, Math.max(0, Math.floor(img.x / (bedW / SCAN_COLS))))
  const r = Math.min(SCAN_ROWS - 1, Math.max(0, Math.floor(img.y / (bedH / SCAN_ROWS))))
  return r * SCAN_COLS + c
}

function taskIcon(s: Task['status']) {
  if (s === 'completed') return <CheckCircle2 size={12} className="text-[#4a7c2c]" />
  if (s === 'running') return <Loader2 size={12} className="text-[#3a5a7c] animate-spin" />
  if (s === 'failed') return <AlertTriangle size={12} className="text-[#b34a3a]" />
  return <Circle size={12} className="text-[#8b6f47]" />
}

export default function Dashboard() {
  const qc = useQueryClient()
  const { data: status } = useQuery({ queryKey: ['status'], queryFn: getSystemStatus, refetchInterval: 2000 })
  const { data: alerts = [] } = useQuery({ queryKey: ['alerts'], queryFn: getAlerts })
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({ queryKey: ['tasks'], queryFn: getTasks })
  const { data: crops = [] } = useQuery({ queryKey: ['crops'], queryFn: getCrops })
  const { data: images = [] } = useQuery({ queryKey: ['images'], queryFn: getImages, refetchInterval: 30_000, retry: false })
  const { data: bedDims = { width: 1200, height: 1200 } } = useQuery({ queryKey: ['bedDims'], queryFn: getBedDimensions, staleTime: Infinity, retry: false })
  const { position: livePos } = usePosition()
  const [estopConfirm, setEstopConfirm] = useState(false)
  const [scanning, setScanning] = useState(false)
  const { toast } = useToast()

  const dispatch = useCallback(async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn()
      await qc.invalidateQueries({ queryKey: ['tasks'] })
      toast(label, 'success')
    } catch {
      toast('Command failed', 'error')
    }
  }, [qc, toast])

  const handleScan = useCallback(async () => {
    setScanning(true)
    try {
      await scanBed(scanGrid(bedDims.width, bedDims.height))
      toast(`Bed scan started — ${SCAN_COLS * SCAN_ROWS} photos queued`, 'success')
      // Photos upload as the bot moves; refresh the mosaic a few times.
      ;[10_000, 25_000, 45_000].forEach(t =>
        setTimeout(() => qc.invalidateQueries({ queryKey: ['images'] }), t),
      )
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Scan command failed', 'error')
    } finally {
      setTimeout(() => setScanning(false), 3000)
    }
  }, [qc, toast, bedDims])

  // Most-recent photo per grid cell (images arrive sorted newest-first).
  const cellImages = useMemo(() => {
    const cells: (BedImage | undefined)[] = Array(SCAN_COLS * SCAN_ROWS).fill(undefined)
    for (const img of images) {
      const idx = cellIndexForImage(img, bedDims.width, bedDims.height)
      if (!cells[idx]) cells[idx] = img
    }
    return cells
  }, [images, bedDims])

  const unacked = alerts.filter(a => !a.acknowledged)
  const recentTasks = tasks.slice(0, 6)
  const active = crops.filter(c => c.status !== 'harvested')
  const ready = crops.filter(c => c.status === 'ready')
  const avgHealth = active.length > 0
    ? Math.round(active.reduce((s, c) => s + c.healthScore, 0) / active.length)
    : 0
  const totalWaterToday = 2_340 // mock summary
  const waterYesterday = 2_180

  return (
    <div className="px-6 py-8 max-w-[1400px] mx-auto">
      {/* Hero strip */}
      <div className="grid grid-cols-12 gap-x-8 gap-y-6 mb-10">
        <div className="col-span-12 lg:col-span-7">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b6f47] font-mono mb-2">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <h1 className="font-display text-5xl leading-[1.05] text-[#1a1f1a]">
            Good morning,<br />
            <span className="italic text-[#2d5016]">your bed is healthy.</span>
          </h1>
          <p className="text-sm text-[#4a5444] mt-4 max-w-md leading-relaxed">
            {active.length} crops growing across {ready.length > 0 ? `${ready.length} ready to harvest, ` : ''}
            avg health {avgHealth}%. Last sync {status ? formatRelative(status.lastHeartbeat) : '—'}.
          </p>
        </div>

        {/* Vital stats column */}
        <div className="col-span-12 lg:col-span-5 grid grid-cols-2 gap-x-6 gap-y-5 self-end">
          <Stat label="Active crops" value={String(active.length)} sub={`${ready.length} ready`} />
          <Stat label="Avg health" value={`${avgHealth}%`} sub="across bed" valueColor={healthColor(avgHealth)} />
          <Stat label="Water today" value={`${(totalWaterToday / 1000).toFixed(1)}L`} sub={`${waterYesterday < totalWaterToday ? '+' : ''}${(((totalWaterToday - waterYesterday) / waterYesterday) * 100).toFixed(0)}% vs yesterday`} />
          <Stat label="Uptime" value={status ? formatUptime(status.uptime) : '—'} sub={`motor ${status?.motorTemperature ?? '—'}°C`} />
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[#d4cdb8] mb-8" />

      {/* Two-column body */}
      <div className="grid grid-cols-12 gap-6">
        {/* Telemetry chart panel */}
        <div className="col-span-12 lg:col-span-7">
          <Panel>
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#d4cdb8] bg-[#ebe5d4]/30">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#4a5444] font-mono font-medium">
                Live Position
              </span>
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase tracking-wider text-[#8b6f47] font-mono">
                  {cellImages.filter(Boolean).length}/{SCAN_COLS * SCAN_ROWS} scanned
                  {status ? ` · ${status.tool}` : ''}
                </span>
                <button
                  onClick={handleScan}
                  disabled={scanning}
                  className="flex items-center gap-1.5 px-3 py-1 border border-[#d4cdb8] hover:border-[#2d5016] text-[10px] font-mono uppercase tracking-[0.15em] rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {scanning
                    ? <Loader2 size={10} className="animate-spin" />
                    : <ScanLine size={10} />}
                  {scanning ? 'Scanning…' : 'Scan bed'}
                </button>
              </div>
            </div>
            <PanelBody className="p-0">
              <BedView x={livePos.x} y={livePos.y} z={livePos.z} cellImages={cellImages} bedW={bedDims.width} bedH={bedDims.height} />
            </PanelBody>
          </Panel>

          {/* Recent activity table */}
          <div className="mt-6">
            <Panel>
              <PanelHeader label="Recent Activity" meta={`${tasks.length} total`} />
              <div>
                {tasksLoading ? (
                  <div className="p-4 space-y-3">
                    {[...Array(4)].map((_, i) => <SkeletonBlock key={i} lines={1} className="h-8" />)}
                  </div>
                ) : recentTasks.map((task, i) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="grid grid-cols-12 items-center gap-3 px-4 py-2.5 border-b border-[#d4cdb8] last:border-0 hover:bg-[#ebe5d4]/30 transition-colors text-xs"
                  >
                    <div className="col-span-1 flex justify-center">{taskIcon(task.status)}</div>
                    <div className="col-span-3 capitalize text-[#1a1f1a] font-medium">{task.action}</div>
                    <div className="col-span-3 font-mono text-[#4a5444]">
                      {task.cellId ? `cell ${task.cellId}` : '—'}
                    </div>
                    <div className="col-span-3 font-mono text-[#8b6f47] tabular-nums">
                      X{task.position.x} Y{task.position.y} Z{task.position.z}
                    </div>
                    <div className="col-span-2 text-right font-mono text-[#8b6f47]">
                      {formatTime(task.scheduledAt)}
                    </div>
                  </motion.div>
                ))}
              </div>
            </Panel>
          </div>
        </div>

        {/* Right column */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          {/* Alerts */}
          <Panel>
            <PanelHeader label="Alerts" meta={`${unacked.length} unread`} />
            <PanelBody className="p-0">
              {alerts.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-[#8b6f47]">No alerts</div>
              ) : (
                alerts.map(alert => (
                  <div
                    key={alert.id}
                    className="px-4 py-3 border-b border-[#d4cdb8] last:border-0 flex items-start gap-3"
                  >
                    <div className={
                      'w-1 self-stretch rounded-full ' +
                      (alert.severity === 'critical' ? 'bg-[#b34a3a]' : alert.severity === 'warning' ? 'bg-[#c9a032]' : 'bg-[#4a7c2c]')
                    } />
                    <div className="flex-1 min-w-0">
                      <p className={
                        'text-sm leading-snug ' +
                        (alert.acknowledged ? 'text-[#8b6f47]' : 'text-[#1a1f1a]')
                      }>
                        {alert.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock size={10} className="text-[#8b6f47]" />
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[#8b6f47]">
                          {formatRelative(alert.timestamp)}
                        </span>
                        {alert.acknowledged && (
                          <span className="text-[10px] font-mono uppercase tracking-wider text-[#8b6f47]">· ack'd</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </PanelBody>
          </Panel>

          {/* Quick actions */}
          <Panel>
            <PanelHeader label="Quick Actions" />
            <PanelBody className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Run watering cycle', sub: 'all dry cells', fn: () => createTask('water', status?.position ?? { x: 0, y: 0, z: 0 }, new Date().toISOString()), msg: 'Watering queued' },
                  { label: 'Snap photo', sub: 'overhead view', fn: () => createTask('photo', status?.position ?? { x: 0, y: 0, z: 0 }, new Date().toISOString()), msg: 'Photo queued' },
                  { label: 'Re-home', sub: 'reset to origin', fn: () => sendHome(), msg: 'Homing sent' },
                  { label: 'Full bed scan', sub: 'moisture probe', fn: () => createTask('probe', { x: 0, y: 0, z: 0 }, new Date().toISOString()), msg: 'Scan queued' },
                ].map(a => (
                  <button
                    key={a.label}
                    onClick={() => dispatch(a.msg, a.fn)}
                    className="text-left p-3 border border-[#d4cdb8] rounded-sm hover:border-[#2d5016] hover:bg-[#2d5016]/5 transition-all group"
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-sm font-medium text-[#1a1f1a]">{a.label}</span>
                      <ArrowUpRight size={12} className="text-[#8b6f47] group-hover:text-[#2d5016] transition-colors" />
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-[#8b6f47] font-mono mt-1 block">{a.sub}</span>
                  </button>
                ))}
              </div>

              {/* E-Stop */}
              <div className="pt-1">
                {!estopConfirm ? (
                  <button
                    onClick={() => setEstopConfirm(true)}
                    className="w-full flex items-center justify-center gap-2 p-2.5 border border-[#b34a3a]/40 text-[#b34a3a] text-xs font-mono uppercase tracking-[0.15em] rounded-sm hover:bg-[#b34a3a]/5 hover:border-[#b34a3a] transition-all"
                  >
                    <Zap size={11} /> Emergency Stop
                  </button>
                ) : (
                  <div className="border border-[#b34a3a] rounded-sm p-2.5 bg-[#b34a3a]/5">
                    <p className="text-xs text-[#b34a3a] font-mono text-center mb-2">Halt all motion immediately?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { dispatch('E-Stop sent', sendEStop); setEstopConfirm(false) }}
                        className="flex-1 py-1.5 bg-[#b34a3a] text-white text-xs font-mono uppercase tracking-wider rounded-sm hover:bg-[#922e20] transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setEstopConfirm(false)}
                        className="flex-1 py-1.5 border border-[#d4cdb8] text-xs font-mono uppercase tracking-wider rounded-sm hover:border-[#8b6f47] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, sub, valueColor }: { label: string; value: string; sub?: string; valueColor?: string }) {
  return (
    <div className="border-l-2 border-[#d4cdb8] pl-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#8b6f47] font-mono mb-1">{label}</div>
      <div
        className="font-display text-3xl leading-none tabular-nums"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </div>
      {sub && <div className="text-[11px] text-[#4a5444] mt-1.5 font-mono">{sub}</div>}
    </div>
  )
}

/**
 * Unified bed view: 4×3 photo mosaic (most recent photo per region) as the
 * background, with the gantry head's live position + crosshair overlaid on top.
 */
function BedView({ x, y, z, cellImages, bedW, bedH }: { x: number; y: number; z: number; cellImages: (BedImage | undefined)[]; bedW: number; bedH: number }) {
  const px = (x / bedW) * 100
  const py = (y / bedH) * 100

  return (
    <div className="p-4">
      <div className="relative aspect-[2/1]">
        {/* Photo mosaic background */}
        <div
          className="absolute inset-0 grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${SCAN_COLS}, 1fr)`, gridTemplateRows: `repeat(${SCAN_ROWS}, 1fr)` }}
        >
          {Array.from({ length: SCAN_COLS * SCAN_ROWS }).map((_, i) => {
            const img = cellImages[i]
            return img ? (
              <a
                key={i}
                href={img.url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative block rounded-sm overflow-hidden border border-[#8b6f47]/30 group"
                title={`X${Math.round(img.x)} Y${Math.round(img.y)} · ${formatRelative(img.capturedAt)}`}
              >
                <img src={img.url} alt="" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" style={{ transform: 'rotate(90deg)' }} loading="lazy" />
              </a>
            ) : (
              <div key={i} className="rounded-sm border border-dashed border-[#d4cdb8] bg-[#f5f1e8] flex items-center justify-center">
                <span className="text-[8px] font-mono text-[#8b6f47]/40 uppercase tracking-wider">empty</span>
              </div>
            )
          })}
        </div>

        {/* Live position overlay (doesn't intercept clicks on the photos) */}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            className="absolute top-0 bottom-0 w-px bg-[#2d5016]/50"
            animate={{ left: `${px}%` }}
            transition={{ type: 'spring', stiffness: 80, damping: 20 }}
          />
          <motion.div
            className="absolute left-0 right-0 h-px bg-[#2d5016]/50"
            animate={{ top: `${py}%` }}
            transition={{ type: 'spring', stiffness: 80, damping: 20 }}
          />
          <motion.div
            className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2"
            animate={{ left: `${px}%`, top: `${py}%` }}
            transition={{ type: 'spring', stiffness: 80, damping: 20 }}
          >
            <div className="w-full h-full bg-[#2d5016] rounded-full ring-2 ring-[#f5f1e8] shadow" />
            <div className="absolute inset-0 bg-[#2d5016] rounded-full animate-ping opacity-40" />
          </motion.div>
        </div>
      </div>

      {/* Coordinate readout */}
      <div className="flex justify-between mt-4 text-[10px] uppercase tracking-[0.18em] font-mono">
        <div>
          <span className="text-[#8b6f47]">X </span>
          <span className="text-[#1a1f1a] tabular-nums">{Math.round(x)}mm</span>
        </div>
        <div>
          <span className="text-[#8b6f47]">Y </span>
          <span className="text-[#1a1f1a] tabular-nums">{Math.round(y)}mm</span>
        </div>
        <div>
          <span className="text-[#8b6f47]">Z </span>
          <span className="text-[#1a1f1a] tabular-nums">{Math.round(z)}mm</span>
        </div>
      </div>
    </div>
  )
}
