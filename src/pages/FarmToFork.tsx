import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sprout, Droplets, CheckCircle2, Leaf,
  Calendar, Weight, X, Download, Link, ArrowRight, Plus,
} from 'lucide-react'
import { getCrops, addCrop } from '@/api/farmbot'
import { useToast } from '@/context/ToastContext'
import { Badge } from '@/components/ui/Badge'
import { healthColor, formatDate, daysLeft, cn } from '@/lib/utils'
import type { CropCell } from '@/types'

type View = 'active' | 'harvested'

function exportCSV(crops: ReturnType<typeof Array.prototype.filter>) {
  const headers = ['id', 'cropName', 'variety', 'status', 'plantedAt', 'harvestedAt', 'yieldGrams', 'totalWaterMl', 'wateringCount', 'healthScore', 'totalDays']
  const rows = (crops as import('@/types').CropCell[]).map(c =>
    headers.map(h => {
      const v = c[h as keyof typeof c]
      return v == null ? '' : String(v)
    }).join(',')
  )
  const csv = [headers.join(','), ...rows].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = `farmbot-crops-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function FarmToFork() {
  const { data: crops = [] } = useQuery({ queryKey: ['crops'], queryFn: getCrops })
  const [view, setView] = useState<View>('active')
  const [selected, setSelected] = useState<CropCell | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const active = crops.filter(c => c.status !== 'harvested')
  const harvested = crops.filter(c => c.status === 'harvested')
  const shown = view === 'active' ? active : harvested

  const totalWater = crops.reduce((s, c) => s + c.totalWaterMl, 0)
  const totalYield = harvested.reduce((s, c) => s + (c.yieldGrams ?? 0), 0)
  const waterPerGram = totalYield > 0 ? (totalWater / totalYield).toFixed(1) : '—'
  const totalDays = harvested.reduce((s, c) => s + c.totalDays, 0)

  return (
    <div className="px-6 py-8 max-w-[1400px] mx-auto">
      {/* Editorial hero */}
      <div className="mb-12 max-w-3xl">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b6f47] font-mono mb-3">
          Provenance · seed → harvest → table
        </div>
        <h1 className="font-display text-6xl leading-[1.05] text-[#1a1f1a] mb-4">
          From <span className="italic text-[#2d5016]">soil</span> to fork,<br />
          every gram <span className="italic text-[#2d5016]">tracked.</span>
        </h1>
        <p className="text-[#4a5444] leading-relaxed max-w-xl">
          Each crop in this bed carries a verifiable lineage — when it was planted,
          how often it was watered, every sensor reading along its growing cycle.
          Generate a passport for any harvest.
        </p>
      </div>

      {/* Aggregate stats — editorial layout */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6 py-6 border-y border-[#d4cdb8] mb-10">
        <BigStat label="Active" value={String(active.length)} sub="growing now" />
        <BigStat label="Harvested" value={String(harvested.length)} sub="lifetime" />
        <BigStat label="Yield" value={`${(totalYield / 1000).toFixed(1)}kg`} sub="total" />
        <BigStat label="Efficiency" value={`${waterPerGram}`} sub="ml water · gram" />
      </div>

      {/* View toggle */}
      <div className="flex items-center justify-between mb-6">
        <div className="inline-flex border border-[#d4cdb8] rounded-sm overflow-hidden">
          {(['active', 'harvested'] as View[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'px-5 py-2 text-xs font-mono uppercase tracking-[0.15em] transition-all',
                view === v
                  ? 'bg-[#2d5016] text-[#f5f1e8]'
                  : 'text-[#4a5444] hover:bg-[#ebe5d4]/50',
              )}
            >
              {v} · {v === 'active' ? active.length : harvested.length}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-5">
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#2d5016] text-[#f5f1e8] text-xs font-mono uppercase tracking-[0.15em] rounded-sm hover:bg-[#1f3810] transition-colors"
          >
            <Plus size={12} /> Add crop
          </button>
          <button
            onClick={() => exportCSV(crops)}
            className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#8b6f47] hover:text-[#2d5016] transition-colors"
          >
            <Download size={12} /> Export all (CSV)
          </button>
        </div>
      </div>

      {/* Crop cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shown.map((crop, i) => (
          <motion.div
            key={crop.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <CropCardEditorial crop={crop} onClick={() => setSelected(crop)} />
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selected && <CropPassport crop={selected} onClose={() => setSelected(null)} />}
        {showAdd && <AddCropForm onClose={() => setShowAdd(false)} />}
      </AnimatePresence>
    </div>
  )
}

function AddCropForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [name, setName] = useState('Radish')
  const [slug, setSlug] = useState('radish')
  const [x, setX] = useState('600')
  const [y, setY] = useState('400')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await addCrop(name, slug, parseFloat(x) || 0, parseFloat(y) || 0)
      await qc.invalidateQueries({ queryKey: ['crops'] })
      toast(`${name} added`, 'success')
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add crop', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#1a1f1a]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.2 }}
        className="bg-[#f5f1e8] border border-[#8b6f47]/30 w-full max-w-md rounded-sm"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-[#d4cdb8] flex items-start justify-between bg-[#ebe5d4]/40">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b6f47] font-mono mb-1">New plant</div>
            <div className="font-display text-2xl text-[#1a1f1a] leading-none">Add a crop</div>
          </div>
          <button onClick={onClose} className="text-[#8b6f47] hover:text-[#1a1f1a] transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 grid grid-cols-2 gap-4">
          <Field label="Crop name" className="col-span-2">
            <input value={name} onChange={e => setName(e.target.value)} required className={inputCls} />
          </Field>
          <Field label="Variety (slug)" className="col-span-2">
            <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="radish" className={inputCls} />
          </Field>
          <Field label="X (mm)">
            <input type="number" value={x} onChange={e => setX(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Y (mm)">
            <input type="number" value={y} onChange={e => setY(e.target.value)} className={inputCls} />
          </Field>
          <div className="col-span-2 flex justify-end pt-1">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-[#2d5016] text-[#f5f1e8] text-xs font-mono uppercase tracking-[0.15em] rounded-sm hover:bg-[#1f3810] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Adding…' : 'Add plant'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

const inputCls = 'w-full px-2.5 py-1.5 bg-[#f5f1e8] border border-[#d4cdb8] rounded-sm font-mono text-xs focus:border-[#2d5016] focus:outline-none'

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="block text-[10px] uppercase tracking-wider text-[#8b6f47] font-mono mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function BigStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#8b6f47] font-mono mb-2">{label}</div>
      <div className="font-display text-4xl tabular-nums leading-none text-[#1a1f1a]">{value}</div>
      <div className="text-[11px] text-[#4a5444] mt-2 italic">{sub}</div>
    </div>
  )
}

function CropCardEditorial({ crop, onClick }: { crop: CropCell; onClick: () => void }) {
  const progress = (crop.growthStageDays / crop.totalDays) * 100
  const isHarvested = crop.status === 'harvested'

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-[#ebe5d4]/30 border border-[#d4cdb8] rounded-sm p-5 hover:border-[#2d5016] transition-all group"
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#8b6f47] font-mono mb-1">
            Plant #{crop.id}
          </div>
          <div className="font-display text-2xl text-[#1a1f1a] leading-none">{crop.cropName}</div>
          <div className="text-xs text-[#4a5444] italic mt-1">{crop.variety}</div>
        </div>
        <Badge variant={crop.status === 'ready' ? 'green' : isHarvested ? 'gray' : 'blue'}>
          {crop.status}
        </Badge>
      </div>

      {/* Progress / yield */}
      {!isHarvested ? (
        <>
          <div className="flex justify-between text-[10px] font-mono text-[#8b6f47] uppercase tracking-wider mb-1.5">
            <span>{crop.growthStageDays}/{crop.totalDays}d</span>
            <span>{daysLeft(crop.plantedAt, crop.totalDays)}d left</span>
          </div>
          <div className="h-1 bg-[#ebe5d4] rounded-full overflow-hidden mb-4">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="h-full bg-[#2d5016]"
            />
          </div>
        </>
      ) : (
        <div className="font-display text-3xl tabular-nums text-[#2d5016] mb-3">
          {crop.yieldGrams}g <span className="text-sm text-[#8b6f47]">yield</span>
        </div>
      )}

      {/* Stats footer */}
      <div className="flex items-center justify-between pt-3 border-t border-[#d4cdb8]/60 text-[11px] font-mono text-[#4a5444]">
        <div className="flex gap-3">
          <span className="flex items-center gap-1">
            <Droplets size={10} className="text-[#3a5a7c]" />
            {(crop.totalWaterMl / 1000).toFixed(1)}L
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: healthColor(crop.healthScore) }} />
            {crop.healthScore}%
          </span>
        </div>
        <ArrowRight size={11} className="text-[#8b6f47] group-hover:text-[#2d5016] group-hover:translate-x-0.5 transition-all" />
      </div>
    </button>
  )
}

function CropPassport({ crop, onClose }: { crop: CropCell; onClose: () => void }) {
  const events = [
    { icon: Sprout, label: 'Seed planted', date: formatDate(crop.plantedAt), done: true, accent: '#2d5016' },
    { icon: Droplets, label: `${crop.wateringCount} watering events`, date: `${(crop.totalWaterMl / 1000).toFixed(2)}L applied`, done: true, accent: '#3a5a7c' },
    { icon: CheckCircle2, label: 'Ready for harvest', date: crop.status === 'ready' ? 'Today' : `~${daysLeft(crop.plantedAt, crop.totalDays)} days`, done: crop.status === 'ready' || crop.status === 'harvested', accent: '#c9a032' },
    ...(crop.harvestedAt ? [{ icon: Leaf, label: 'Harvested', date: `${formatDate(crop.harvestedAt)} · ${crop.yieldGrams}g`, done: true, accent: '#2d5016' }] : []),
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#1a1f1a]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.2 }}
        className="bg-[#f5f1e8] border border-[#8b6f47]/30 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-sm"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#d4cdb8] flex items-start justify-between bg-[#ebe5d4]/40">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b6f47] font-mono mb-1">
              Crop Passport · #{crop.id}
            </div>
            <div className="font-display text-3xl text-[#1a1f1a] leading-none">{crop.cropName}</div>
            <div className="text-sm text-[#4a5444] italic mt-1">{crop.variety}</div>
          </div>
          <button onClick={onClose} className="text-[#8b6f47] hover:text-[#1a1f1a] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-x-4 gap-y-4">
            <PassportStat icon={Calendar} label="Planted" value={formatDate(crop.plantedAt)} />
            <PassportStat icon={Droplets} label="Water" value={`${(crop.totalWaterMl / 1000).toFixed(2)}L`} />
            <PassportStat
              icon={() => <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: healthColor(crop.healthScore) }} />}
              label="Health"
              value={`${crop.healthScore}%`}
              valueColor={healthColor(crop.healthScore)}
            />
            {crop.harvestedAt && (
              <>
                <PassportStat icon={Leaf} label="Harvested" value={formatDate(crop.harvestedAt)} />
                <PassportStat icon={Weight} label="Yield" value={`${crop.yieldGrams}g`} />
                <PassportStat
                  icon={Droplets}
                  label="ml/g ratio"
                  value={crop.yieldGrams ? (crop.totalWaterMl / crop.yieldGrams).toFixed(1) : '—'}
                />
              </>
            )}
          </div>

          {/* Lifecycle timeline */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#8b6f47] font-mono mb-4">
              Lifecycle
            </div>
            <div className="relative pl-5">
              <div className="absolute left-1.5 top-2 bottom-2 w-px bg-[#d4cdb8]" />
              <div className="space-y-4">
                {events.map((ev, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.07 }}
                    className="flex items-start gap-3 relative"
                  >
                    <div
                      className="absolute -left-5 w-3 h-3 rounded-full border-2 mt-0.5"
                      style={{
                        backgroundColor: ev.done ? ev.accent : '#f5f1e8',
                        borderColor: ev.done ? ev.accent : '#d4cdb8',
                      }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <ev.icon size={12} style={{ color: ev.done ? ev.accent : '#d4cdb8' }} />
                        <span className={cn('text-sm font-medium', ev.done ? 'text-[#1a1f1a]' : 'text-[#d4cdb8]')}>
                          {ev.label}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#8b6f47] font-mono mt-0.5">{ev.date}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Quote */}
          <div className="border-l-2 border-[#2d5016] pl-4 py-2 italic text-[#4a5444] text-sm leading-relaxed">
            {crop.cropName === 'Lettuce' && '"This Butterhead lettuce was grown autonomously over 28 days, receiving 22 precisely-targeted waterings totaling 1.54L."'}
            {crop.cropName === 'Tomato' && '"This vine has been tended for 55 days. Pat dry, slice thin, finish with sea salt and basil."'}
            {crop.cropName !== 'Lettuce' && crop.cropName !== 'Tomato' &&
              `"Grown autonomously in plot 01-AFB. ${crop.wateringCount} watering events, zero manual intervention."`}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-[#d4cdb8]">
            <button
              onClick={() => window.print()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2d5016] text-[#f5f1e8] rounded-sm text-xs font-mono uppercase tracking-[0.15em] hover:bg-[#1f3810] transition-colors"
            >
              <Download size={12} /> Export PDF
            </button>
            <ShareButton crop={crop} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function ShareButton({ crop }: { crop: import('@/types').CropCell }) {
  const [copied, setCopied] = useState(false)
  const share = async () => {
    const text = [
      `Crop Passport — ${crop.cropName} (${crop.variety})`,
      `Cell: ${crop.id}`,
      `Planted: ${crop.plantedAt}`,
      `Water: ${(crop.totalWaterMl / 1000).toFixed(2)}L over ${crop.wateringCount} events`,
      `Health: ${crop.healthScore}%`,
      crop.harvestedAt ? `Harvested: ${crop.harvestedAt} · ${crop.yieldGrams}g yield` : `Status: ${crop.status}`,
    ].join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={share}
      className="flex items-center justify-center gap-2 px-4 py-2.5 border border-[#d4cdb8] rounded-sm text-xs font-mono uppercase tracking-[0.15em] hover:border-[#2d5016] transition-colors"
    >
      <Link size={12} /> {copied ? 'Copied!' : 'Share'}
    </button>
  )
}

function PassportStat({ icon: Icon, label, value, valueColor }: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-[#8b6f47] font-mono mb-1">
        <Icon size={11} />
        <span>{label}</span>
      </div>
      <div className="font-display text-lg" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
    </div>
  )
}
