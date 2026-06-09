import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Droplets, TrendingUp, Calendar, Hash, Sprout, Camera, RefreshCw } from 'lucide-react'
import { getCrops, getSensorReadings, createTask, getImages, activateTool } from '@/api/farmbot'
import { useToast } from '@/context/ToastContext'
import { Panel, PanelHeader, PanelBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { moistureColor, healthColor, daysLeft, formatDate, formatRelative } from '@/lib/utils'
import type { CropCell } from '@/types'

const COLS = 4
const ROWS = 4
const BED_W = 1200
const BED_H = 1200

const cropEmoji: Record<string, string> = {
  Tomato: '🍅', Lettuce: '🥬', Carrot: '🥕', Radish: '🫒',
  Basil: '🌿', Spinach: '🥬', Pepper: '🫑', Kale: '🥬',
  Cucumber: '🥒', Zucchini: '🥒',
}

function statusVariant(s: CropCell['status']): 'green' | 'yellow' | 'blue' | 'gray' {
  if (s === 'ready') return 'green'
  if (s === 'growing') return 'blue'
  if (s === 'planted') return 'yellow'
  return 'gray'
}

export default function FarmPlanner() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const { data: crops = [] } = useQuery({ queryKey: ['crops'], queryFn: getCrops })
  const { data: sensors = [] } = useQuery({ queryKey: ['sensors'], queryFn: getSensorReadings })
  const { data: images = [], isLoading: imagesLoading } = useQuery({
    queryKey: ['images'],
    queryFn: getImages,
    refetchInterval: 30_000,
    staleTime: 10_000,
    retry: false,
  })
  const [selected, setSelected] = useState<CropCell | null>(null)
  const [plantingCellId, setPlantingCellId] = useState<string | null>(null)

  const handleTakePhoto = async () => {
    try {
      await activateTool('camera', true)
      toast('Photo command sent — image will appear shortly', 'success')
      setTimeout(() => qc.invalidateQueries({ queryKey: ['images'] }), 5000)
    } catch {
      toast('Command failed', 'error')
    }
  }

  const cellPosition = (id: string) => {
    const [col, row] = id.split('-').map(Number)
    return { x: col * Math.floor(BED_W / COLS), y: row * Math.floor(BED_H / ROWS), z: 0 }
  }

  const dispatchCellAction = async (action: 'water' | 'probe', cellId: string) => {
    try {
      await createTask(action, cellPosition(cellId), new Date().toISOString(), cellId)
      await qc.invalidateQueries({ queryKey: ['tasks'] })
      toast(`${action === 'water' ? 'Watering' : 'Probe'} queued for cell ${cellId}`, 'success')
    } catch {
      toast('Command failed', 'error')
    }
  }

  const cropMap = Object.fromEntries(crops.filter(c => c.status !== 'harvested').map(c => [c.id, c]))
  const sensorMap = Object.fromEntries(sensors.map(s => [s.cellId, s]))

  return (
    <div className="px-6 py-8 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b6f47] font-mono mb-2">
            Bed · {BED_W} × {BED_H}mm · {COLS}×{ROWS} grid
          </div>
          <h1 className="font-display text-4xl text-[#1a1f1a]">
            The <span className="italic text-[#2d5016]">bed</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              const emptyCells = Array.from({ length: ROWS }, (_, r) =>
                Array.from({ length: COLS }, (_, c) => `${c}-${r}`)
              ).flat().find(id => !cropMap[id])
              if (emptyCells) setPlantingCellId(emptyCells)
            }}
            className="px-4 py-2 border border-[#d4cdb8] hover:border-[#2d5016] text-xs font-mono uppercase tracking-[0.15em] rounded-sm transition-colors"
          >
            + Plant crop
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Grid */}
        <div className="col-span-12 xl:col-span-8">
          <Panel>
            <PanelHeader label="Plot Layout" meta="click cell to inspect" />
            <PanelBody>
              {/* Legend */}
              <div className="flex gap-5 mb-5 pb-4 border-b border-[#d4cdb8]">
                {[
                  { label: 'Ready', color: '#4a7c2c' },
                  { label: 'Growing', color: '#3a5a7c' },
                  { label: 'Planted', color: '#c9a032' },
                  { label: 'Empty', color: '#d4cdb8' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                    <span className="text-[10px] uppercase tracking-wider text-[#4a5444] font-mono">{l.label}</span>
                  </div>
                ))}
              </div>

              {/* Plot grid */}
              <div className="relative">
                {/* Row labels */}
                <div className="absolute -left-6 top-0 bottom-0 flex flex-col justify-around text-[9px] font-mono text-[#8b6f47]">
                  {Array.from({ length: ROWS }, (_, r) => <span key={r}>R{r}</span>)}
                </div>
                {/* Col labels */}
                <div className="absolute -top-5 left-0 right-0 grid gap-2 text-[9px] font-mono text-[#8b6f47]"
                     style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
                  {Array.from({ length: COLS }, (_, c) => <span key={c} className="text-center">C{c}</span>)}
                </div>

                <div
                  className="grid gap-2 mt-1"
                  style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: ROWS }, (_, row) =>
                    Array.from({ length: COLS }, (_, col) => {
                      const id = `${col}-${row}`
                      const crop = cropMap[id]
                      const sensor = sensorMap[id]
                      const moisture = sensor?.moisture ?? null
                      const isSelected = selected?.id === id

                      return (
                        <motion.button
                          key={id}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => crop ? setSelected(crop) : setPlantingCellId(id)}
                          className={`
                            relative aspect-square rounded-sm text-left p-3
                            flex flex-col justify-between transition-all
                            ${crop
                              ? 'bg-[#ebe5d4]/40 border border-[#8b6f47]/30 hover:border-[#2d5016]'
                              : 'bg-[#f5f1e8] border border-dashed border-[#d4cdb8]'}
                            ${isSelected ? 'border-[#2d5016] ring-2 ring-[#2d5016]/20' : ''}
                          `}
                        >
                          {crop ? (
                            <>
                              <div>
                                <div className="flex items-start justify-between mb-2">
                                  <div className="text-2xl leading-none">{cropEmoji[crop.cropName] ?? '🌱'}</div>
                                  <div
                                    className="w-2 h-2 rounded-full mt-1"
                                    style={{
                                      backgroundColor:
                                        crop.status === 'ready' ? '#4a7c2c'
                                        : crop.status === 'growing' ? '#3a5a7c'
                                        : '#c9a032',
                                    }}
                                  />
                                </div>
                                <div className="text-xs font-medium text-[#1a1f1a] leading-tight">{crop.cropName}</div>
                                <div className="text-[10px] text-[#8b6f47] truncate font-mono">{crop.variety}</div>
                              </div>
                              {moisture !== null && (
                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#8b6f47]/15">
                                  <Droplets size={9} style={{ color: moistureColor(moisture) }} />
                                  <span className="text-[10px] font-mono tabular-nums" style={{ color: moistureColor(moisture) }}>
                                    {moisture}%
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="flex-1 flex items-center justify-center">
                              <span className="text-[10px] text-[#d4cdb8] font-mono">empty</span>
                            </div>
                          )}
                        </motion.button>
                      )
                    })
                  )}
                </div>
              </div>
            </PanelBody>
          </Panel>
        </div>

        {/* Detail panel */}
        <div className="col-span-12 xl:col-span-4">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.18 }}
              >
                <Panel>
                  <PanelHeader
                    label={`Cell ${selected.id}`}
                    meta={
                      <button onClick={() => setSelected(null)} className="hover:text-[#1a1f1a]">
                        <X size={12} />
                      </button>
                    }
                  />
                  <PanelBody className="space-y-5">
                    {/* Identity */}
                    <div>
                      <div className="flex items-baseline justify-between">
                        <div>
                          <div className="font-display text-2xl text-[#1a1f1a]">{selected.cropName}</div>
                          <div className="text-xs text-[#8b6f47] italic font-mono">{selected.variety}</div>
                        </div>
                        <Badge variant={statusVariant(selected.status)}>{selected.status}</Badge>
                      </div>
                    </div>

                    {/* Progress */}
                    <div>
                      <div className="flex justify-between text-[10px] uppercase tracking-wider text-[#8b6f47] font-mono mb-1.5">
                        <span>Growth</span>
                        <span>{selected.growthStageDays}/{selected.totalDays} days</span>
                      </div>
                      <div className="h-1.5 bg-[#ebe5d4] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(selected.growthStageDays / selected.totalDays) * 100}%` }}
                          transition={{ duration: 0.6 }}
                          className="h-full bg-[#2d5016]"
                        />
                      </div>
                      <div className="text-[10px] text-[#8b6f47] font-mono mt-1.5">
                        {daysLeft(selected.plantedAt, selected.totalDays)} days remaining
                      </div>
                    </div>

                    {/* Stat rows */}
                    <div className="space-y-2">
                      <DetailRow icon={Calendar} label="Planted" value={formatDate(selected.plantedAt)} />
                      <DetailRow icon={TrendingUp} label="Health" value={`${selected.healthScore}%`} valueColor={healthColor(selected.healthScore)} />
                      <DetailRow icon={Droplets} label="Waterings" value={`${selected.wateringCount}× · ${(selected.totalWaterMl / 1000).toFixed(2)}L`} />
                      <DetailRow icon={Hash} label="Cell ID" value={selected.id} mono />
                    </div>

                    {/* Moisture */}
                    {sensorMap[selected.id] && (
                      <div className="pt-4 border-t border-[#d4cdb8]">
                        <div className="flex justify-between text-[10px] uppercase tracking-wider text-[#8b6f47] font-mono mb-1.5">
                          <span>Soil moisture</span>
                          <span style={{ color: moistureColor(sensorMap[selected.id].moisture) }}>
                            {sensorMap[selected.id].moisture}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-[#ebe5d4] rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${sensorMap[selected.id].moisture}%`,
                              backgroundColor: moistureColor(sensorMap[selected.id].moisture),
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        onClick={() => dispatchCellAction('water', selected.id)}
                        className="px-3 py-2 bg-[#2d5016] text-[#f5f1e8] text-xs font-mono uppercase tracking-wider rounded-sm hover:bg-[#1f3810] transition-colors"
                      >
                        Water now
                      </button>
                      <button
                        onClick={() => dispatchCellAction('probe', selected.id)}
                        className="px-3 py-2 border border-[#d4cdb8] text-xs font-mono uppercase tracking-wider rounded-sm hover:border-[#2d5016] transition-colors"
                      >
                        Probe
                      </button>
                    </div>
                  </PanelBody>
                </Panel>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Panel>
                  <PanelHeader label="Inspector" />
                  <PanelBody className="py-12 text-center">
                    <div className="text-xs text-[#8b6f47] font-mono uppercase tracking-wider">
                      Click a cell to inspect
                    </div>
                  </PanelBody>
                </Panel>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Recent Photos */}
      <div className="mt-6">
        <Panel>
          <div className="flex items-center justify-between px-4 py-2 border-b border-[#d4cdb8] bg-[#ebe5d4]/30">
            <div className="flex items-center gap-2">
              <Camera size={12} className="text-[#4a5444]" />
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#4a5444] font-mono font-medium">
                Recent Photos
              </span>
              {images.length > 0 && (
                <span className="text-[10px] text-[#8b6f47] font-mono">· {images.length}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => qc.invalidateQueries({ queryKey: ['images'] })}
                className="p-1 text-[#8b6f47] hover:text-[#1a1f1a] transition-colors"
                title="Refresh"
              >
                <RefreshCw size={11} />
              </button>
              <button
                onClick={handleTakePhoto}
                className="flex items-center gap-1.5 px-3 py-1 border border-[#d4cdb8] hover:border-[#2d5016] text-[10px] font-mono uppercase tracking-[0.15em] rounded-sm transition-colors"
              >
                <Camera size={10} /> Take photo
              </button>
            </div>
          </div>
          <PanelBody>
            {imagesLoading ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-[4/3] bg-[#ebe5d4] animate-pulse rounded-sm" />
                ))}
              </div>
            ) : images.length === 0 ? (
              <div className="py-10 text-center">
                <Camera size={24} className="mx-auto text-[#d4cdb8] mb-3" />
                <p className="text-xs text-[#8b6f47] font-mono uppercase tracking-wider">No photos yet</p>
                <p className="text-[10px] text-[#8b6f47]/70 font-mono mt-1">Use "Take photo" above or the camera tool in Control</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {images.map(img => (
                  <a
                    key={img.id}
                    href={img.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block border border-[#d4cdb8] rounded-sm overflow-hidden hover:border-[#2d5016] transition-colors"
                  >
                    <div className="aspect-[4/3] bg-[#ebe5d4] overflow-hidden">
                      <img
                        src={img.url}
                        alt={`Bed photo ${img.id}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                    <div className="px-2 py-1.5 bg-white/40">
                      <div className="text-[9px] font-mono text-[#8b6f47] uppercase tracking-wider">
                        {formatRelative(img.capturedAt)}
                      </div>
                      <div className="text-[9px] font-mono text-[#4a5444] mt-0.5 tabular-nums">
                        X{Math.round(img.x)} Y{Math.round(img.y)}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </PanelBody>
        </Panel>
      </div>

      {/* Plant crop modal */}
      <AnimatePresence>
        {plantingCellId && (
          <PlantForm
            cellId={plantingCellId}
            onClose={() => setPlantingCellId(null)}
            onPlanted={(cellId) => {
              setPlantingCellId(null)
              toast(`Planted in cell ${cellId}`, 'success')
              qc.invalidateQueries({ queryKey: ['tasks'] })
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function PlantForm({ cellId, onClose, onPlanted }: {
  cellId: string
  onClose: () => void
  onPlanted: (cellId: string) => void
}) {
  const [cropName, setCropName] = useState('')
  const [variety, setVariety] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cropName.trim()) return
    const [col, row] = cellId.split('-').map(Number)
    await createTask('plant', { x: col * Math.floor(BED_W / COLS), y: row * Math.floor(BED_H / ROWS), z: 0 }, new Date().toISOString(), cellId)
    onPlanted(cellId)
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
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.18 }}
        className="bg-[#f5f1e8] border border-[#8b6f47]/30 w-full max-w-sm rounded-sm"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[#d4cdb8] flex items-center justify-between bg-[#ebe5d4]/40">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b6f47] font-mono">New plant · Cell {cellId}</div>
            <div className="font-display text-xl text-[#1a1f1a] mt-0.5">Plant a crop</div>
          </div>
          <button onClick={onClose} className="text-[#8b6f47] hover:text-[#1a1f1a]"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8b6f47] font-mono mb-1.5">Crop name</label>
            <input
              autoFocus
              value={cropName}
              onChange={e => setCropName(e.target.value)}
              placeholder="e.g. Lettuce"
              className="w-full px-3 py-2 bg-white/60 border border-[#d4cdb8] rounded-sm font-mono text-sm focus:border-[#2d5016] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8b6f47] font-mono mb-1.5">Variety <span className="normal-case opacity-60">(optional)</span></label>
            <input
              value={variety}
              onChange={e => setVariety(e.target.value)}
              placeholder="e.g. Butterhead"
              className="w-full px-3 py-2 bg-white/60 border border-[#d4cdb8] rounded-sm font-mono text-sm focus:border-[#2d5016] focus:outline-none"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={!cropName.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#2d5016] text-[#f5f1e8] text-xs font-mono uppercase tracking-[0.15em] rounded-sm hover:bg-[#1f3810] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Sprout size={11} /> Plant
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-[#d4cdb8] text-xs font-mono uppercase tracking-[0.15em] rounded-sm hover:border-[#8b6f47] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

function DetailRow({ icon: Icon, label, value, valueColor, mono }: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  value: string
  valueColor?: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 text-xs text-[#4a5444]">
        <Icon size={12} className="text-[#8b6f47]" />
        <span>{label}</span>
      </div>
      <span
        className={mono ? 'text-xs font-mono text-[#1a1f1a]' : 'text-xs text-[#1a1f1a] font-medium'}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </span>
    </div>
  )
}
