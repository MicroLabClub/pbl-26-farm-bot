import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  ChevronUp, ChevronDown, Home, AlertOctagon, Droplets,
  Sprout, Camera, Gauge,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { jogAxis, sendHome, sendEStop, activateTool, moveTo, getSystemStatus, mountAndWater, stopAndDismount, mountAndSeed, dismountSeeder, mountAndProbe, dismountSensor, SEED_POSITION, SEED_SOURCE } from '@/api/farmbot'
import { loadSettings } from '@/lib/settings'
import { Panel, PanelHeader, PanelBody } from '@/components/ui/Card'
import { useToast } from '@/context/ToastContext'
import { cn } from '@/lib/utils'

type StepSize = 1 | 10 | 100

const tools = [
  { id: 'water', label: 'Water', icon: Droplets },
  { id: 'seeder', label: 'Seeder', icon: Sprout },
  { id: 'sensor', label: 'Sensor', icon: Gauge },
  { id: 'camera', label: 'Camera', icon: Camera },
] as const

export default function ControlPanel() {
  const [step, setStep] = useState<StepSize>(10)
  const [activeTool, setActiveTool] = useState<typeof tools[number]['id']>('water')
  const [waterOn, setWaterOn] = useState(false)
  const [isMock, setIsMock] = useState(false)
  const [moisture, setMoisture] = useState<number | null>(null)
  const [goX, setGoX] = useState('')
  const [goY, setGoY] = useState('')
  const [goZ, setGoZ] = useState('')
  const { toast } = useToast()

  const { data: status } = useQuery({ queryKey: ['status'], queryFn: getSystemStatus, refetchInterval: 1000 })

  useEffect(() => { setIsMock(loadSettings().mock) }, [])

  // Capture the soil-moisture reading the firmware logs after a probe.
  useEffect(() => {
    const onLog = (e: Event) => {
      const detail = (e as CustomEvent<{ type: string; message: string }>).detail
      const m = detail?.message?.match(/soil moisture:\s*([\d.]+)/i)
      if (m) {
        const value = Math.round(parseFloat(m[1]))
        setMoisture(value)
        toast(`Soil moisture: ${value}`, 'success')
      }
    }
    window.addEventListener('farmbot:log', onLog)
    return () => window.removeEventListener('farmbot:log', onLog)
  }, [toast])

  return (
    <div className="px-6 py-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b6f47] font-mono mb-2">Manual Override</div>
          <h1 className="font-display text-4xl text-[#1a1f1a]">
            Control <span className="italic text-[#2d5016]">terminal</span>
          </h1>
        </div>
        <button
          onClick={sendEStop}
          className="group flex items-center gap-2.5 px-4 py-2.5 bg-[#b34a3a] text-[#f5f1e8] hover:bg-[#9a3d2f] transition-all border border-[#9a3d2f] rounded-sm"
        >
          <AlertOctagon size={16} />
          <span className="text-xs font-mono uppercase tracking-[0.15em] font-medium">Emergency Stop</span>
        </button>
      </div>

      {/* Live position banner */}
      <div className="mb-8 px-5 py-3 bg-[#1a1f1a] text-[#f5f1e8] rounded-sm font-mono text-sm flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#7ba05b] animate-pulse" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#7ba05b]">Live</span>
          </div>
          <div className="flex gap-5 tabular-nums">
            <span><span className="text-[#7ba05b]">X</span> {status?.position.x ?? '---'}<span className="text-[#7ba05b]/60 text-xs">mm</span></span>
            <span><span className="text-[#7ba05b]">Y</span> {status?.position.y ?? '---'}<span className="text-[#7ba05b]/60 text-xs">mm</span></span>
            <span><span className="text-[#7ba05b]">Z</span> {status?.position.z ?? '---'}<span className="text-[#7ba05b]/60 text-xs">mm</span></span>
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#7ba05b]/70">
          tool: {status?.tool ?? '—'} · motor: {status?.motorTemperature ?? '—'}°C
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* XY Jog */}
        <div className="col-span-12 lg:col-span-5">
          <Panel>
            <PanelHeader label="XY Movement" meta={`step: ${step}mm`} />
            <PanelBody className="flex flex-col items-center py-8 gap-6">
              {/* Step selector */}
              <div className="inline-flex border border-[#d4cdb8] rounded-sm overflow-hidden">
                {([1, 10, 100] as StepSize[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setStep(s)}
                    className={cn(
                      'px-4 py-1.5 text-xs font-mono uppercase tracking-wider transition-all',
                      step === s
                        ? 'bg-[#2d5016] text-[#f5f1e8]'
                        : 'text-[#4a5444] hover:bg-[#ebe5d4]/50',
                    )}
                  >
                    {s}mm
                  </button>
                ))}
              </div>

              {/* D-pad */}
              <div className="grid grid-cols-3 gap-2">
                <div />
                <JogButton onClick={() => jogAxis('y', step)} label="Y+"><ArrowUp size={20} /></JogButton>
                <div />

                <JogButton onClick={() => jogAxis('x', -step)} label="X-"><ArrowLeft size={20} /></JogButton>
                <div className="w-14 h-14 border-2 border-dashed border-[#8b6f47]/40 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-[#2d5016]" />
                </div>
                <JogButton onClick={() => jogAxis('x', step)} label="X+"><ArrowRight size={20} /></JogButton>

                <div />
                <JogButton onClick={() => jogAxis('y', -step)} label="Y-"><ArrowDown size={20} /></JogButton>
                <div />
              </div>
            </PanelBody>
          </Panel>
        </div>

        {/* Z + Tools */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
          <Panel>
            <PanelHeader label="Z Axis" meta={`step: ${step}mm`} />
            <PanelBody className="flex flex-col items-center py-6 gap-3">
              <JogButton onClick={() => jogAxis('z', step)} label="Z+"><ChevronUp size={20} /></JogButton>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b6f47] font-mono">Vertical</div>
              <JogButton onClick={() => jogAxis('z', -step)} label="Z-"><ChevronDown size={20} /></JogButton>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader label="System" />
            <PanelBody className="space-y-2">
              <button
                onClick={sendHome}
                className="w-full flex items-center gap-2 px-3 py-2 border border-[#d4cdb8] text-[#1a1f1a] hover:border-[#2d5016] hover:bg-[#2d5016]/5 rounded-sm transition-all text-sm"
              >
                <Home size={14} className="text-[#2d5016]" />
                <span>Home all axes</span>
              </button>
            </PanelBody>
          </Panel>
        </div>

        {/* Tools */}
        <div className="col-span-12 lg:col-span-4">
          <Panel>
            <PanelHeader label="Tool Head" meta={`active: ${activeTool}`} />
            <PanelBody className="space-y-4">
              {/* Tool selector */}
              <div className="grid grid-cols-2 gap-2">
                {tools.map(t => {
                  const Icon = t.icon
                  return (
                    <button
                      key={t.id}
                      onClick={() => { setActiveTool(t.id); setWaterOn(false) }}
                      className={cn(
                        'flex flex-col items-center gap-1.5 px-3 py-3 border rounded-sm transition-all',
                        activeTool === t.id
                          ? 'border-[#2d5016] bg-[#2d5016]/5'
                          : 'border-[#d4cdb8] hover:border-[#8b6f47]',
                      )}
                    >
                      <Icon size={18} className={activeTool === t.id ? 'text-[#2d5016]' : 'text-[#4a5444]'} />
                      <span className="text-[10px] font-mono uppercase tracking-wider">{t.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Tool actuation */}
              {isMock && (
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#b34a3a] bg-[#b34a3a]/10 border border-[#b34a3a]/30 rounded-sm px-2 py-1 text-center">
                  Mock mode on — commands not sent
                </div>
              )}

              {/* Water: Mount picks up the nozzle, moves to the plant, and starts
                  the flow; Dismount stops the flow and returns it to its holder. */}
              {activeTool === 'water' && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={async () => {
                      try {
                        await mountAndWater(SEED_POSITION)
                        toast('Mounting nozzle → moving → watering', 'success')
                      } catch (e) {
                        toast(e instanceof Error ? e.message : 'Mount failed', 'error')
                      }
                    }}
                    className="px-3 py-2.5 border border-[#2d5016] bg-[#2d5016]/5 text-[#2d5016] hover:bg-[#2d5016]/10 rounded-sm transition-all text-xs font-mono uppercase tracking-wider"
                  >
                    Mount &amp; Water
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await stopAndDismount()
                        toast('Stopping water → returning nozzle', 'success')
                      } catch (e) {
                        toast(e instanceof Error ? e.message : 'Dismount failed', 'error')
                      }
                    }}
                    className="px-3 py-2.5 border border-[#d4cdb8] text-[#1a1f1a] hover:border-[#2d5016] hover:bg-[#2d5016]/5 rounded-sm transition-all text-xs font-mono uppercase tracking-wider"
                  >
                    Stop &amp; Dismount
                  </button>
                </div>
              )}

              {/* Seeder: Mount & Seed picks a seed and plants it at the water spot;
                  Dismount returns the seeder to its holder. */}
              {activeTool === 'seeder' && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={async () => {
                      try {
                        await mountAndSeed(SEED_SOURCE, SEED_POSITION)
                        toast('Mounting seeder → picking seed → planting', 'success')
                      } catch (e) {
                        toast(e instanceof Error ? e.message : 'Seeding failed', 'error')
                      }
                    }}
                    className="px-3 py-2.5 border border-[#2d5016] bg-[#2d5016]/5 text-[#2d5016] hover:bg-[#2d5016]/10 rounded-sm transition-all text-xs font-mono uppercase tracking-wider"
                  >
                    Mount &amp; Seed
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await dismountSeeder()
                        toast('Returning seeder to holder…', 'success')
                      } catch (e) {
                        toast(e instanceof Error ? e.message : 'Dismount failed', 'error')
                      }
                    }}
                    className="px-3 py-2.5 border border-[#d4cdb8] text-[#1a1f1a] hover:border-[#2d5016] hover:bg-[#2d5016]/5 rounded-sm transition-all text-xs font-mono uppercase tracking-wider"
                  >
                    Dismount
                  </button>
                </div>
              )}

              {/* Soil sensor: Mount & Probe drives to the spot, dips, and reads
                  moisture; Dismount returns the sensor to its holder. */}
              {activeTool === 'sensor' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={async () => {
                        try {
                          await mountAndProbe(SEED_POSITION)
                          toast('Mounting sensor → probing soil…', 'success')
                        } catch (e) {
                          toast(e instanceof Error ? e.message : 'Probe failed', 'error')
                        }
                      }}
                      className="px-3 py-2.5 border border-[#2d5016] bg-[#2d5016]/5 text-[#2d5016] hover:bg-[#2d5016]/10 rounded-sm transition-all text-xs font-mono uppercase tracking-wider"
                    >
                      Mount &amp; Probe
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await dismountSensor()
                          toast('Returning sensor to holder…', 'success')
                        } catch (e) {
                          toast(e instanceof Error ? e.message : 'Dismount failed', 'error')
                        }
                      }}
                      className="px-3 py-2.5 border border-[#d4cdb8] text-[#1a1f1a] hover:border-[#2d5016] hover:bg-[#2d5016]/5 rounded-sm transition-all text-xs font-mono uppercase tracking-wider"
                    >
                      Dismount
                    </button>
                  </div>
                  {moisture !== null && (
                    <div className="flex items-center justify-between px-3 py-2 bg-[#1a1f1a] text-[#f5f1e8] rounded-sm font-mono text-sm">
                      <span className="text-[10px] uppercase tracking-[0.18em] text-[#7ba05b]">Soil moisture</span>
                      <span className="tabular-nums">
                        {moisture} <span className="text-[#7ba05b]/70 text-xs">{moisture < 350 ? '· dry' : moisture > 700 ? '· wet' : '· ok'}</span>
                      </span>
                    </div>
                  )}
                </>
              )}
              {/* Direct actuation only for the tools where it does something:
                  water (valve) and camera (photo). */}
              {(activeTool === 'water' || activeTool === 'camera') && (
                <button
                  onClick={async () => {
                    const next = !waterOn
                    try {
                      await activateTool(activeTool, next)
                      const msg = activeTool === 'camera'
                        ? 'Photo command sent'
                        : `${activeTool} ${next ? 'activated' : 'stopped'}`
                      toast(msg, 'success')
                      // Only latch state when command succeeded
                      if (activeTool !== 'camera') setWaterOn(next)
                    } catch (e) {
                      toast(e instanceof Error ? e.message : 'Command failed', 'error')
                    }
                  }}
                  className={cn(
                    'w-full py-3 rounded-sm transition-all text-sm font-medium border',
                    waterOn
                      ? 'bg-[#2d5016] text-[#f5f1e8] border-[#2d5016]'
                      : 'bg-transparent text-[#1a1f1a] border-[#d4cdb8] hover:border-[#2d5016]',
                  )}
                >
                  {waterOn ? 'STOP' : 'ACTUATE'} {activeTool.toUpperCase()}
                </button>
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>

      {/* Coordinate input */}
      <div className="mt-6">
        <Panel>
          <PanelHeader label="Move to Coordinate" />
          <PanelBody className="flex flex-wrap items-end gap-4">
            {(['X', 'Y', 'Z'] as const).map((axis, i) => (
              <div key={axis}>
                <label className="text-[10px] uppercase tracking-[0.18em] text-[#8b6f47] font-mono mb-1.5 block">
                  {axis} axis (mm)
                </label>
                <input
                  type="number"
                  placeholder="000"
                  value={[goX, goY, goZ][i]}
                  onChange={e => [setGoX, setGoY, setGoZ][i](e.target.value)}
                  className="w-32 px-3 py-2 bg-[#f5f1e8] border border-[#d4cdb8] rounded-sm font-mono text-sm tabular-nums focus:border-[#2d5016] focus:outline-none transition-colors"
                />
              </div>
            ))}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => moveTo({ x: parseFloat(goX) || 0, y: parseFloat(goY) || 0, z: parseFloat(goZ) || 0 })}
              className="px-6 py-2 bg-[#2d5016] text-[#f5f1e8] rounded-sm font-mono uppercase tracking-[0.15em] text-xs hover:bg-[#1f3810] transition-all"
            >
              Execute Move →
            </motion.button>
          </PanelBody>
        </Panel>
      </div>
    </div>
  )
}

function JogButton({ onClick, children, label }: { onClick: () => void; children: React.ReactNode; label: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onPointerDown={onClick}
      title={label}
      className="w-14 h-14 border border-[#d4cdb8] hover:border-[#2d5016] hover:bg-[#2d5016]/5 active:bg-[#2d5016] active:text-[#f5f1e8] rounded-sm flex items-center justify-center text-[#1a1f1a] transition-colors"
    >
      {children}
    </motion.button>
  )
}
