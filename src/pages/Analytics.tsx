import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts'
import { getSensorReadings, getMoistureHistory } from '@/api/farmbot'
import { Panel, PanelHeader, PanelBody } from '@/components/ui/Card'
import { moistureColor } from '@/lib/utils'

function MoistureCard({ cellId }: { cellId: string }) {
  const { data = [] } = useQuery({
    queryKey: ['moisture-history', cellId],
    queryFn: () => getMoistureHistory(cellId),
    retry: false,
    staleTime: Infinity,
  })

  const latest = data[data.length - 1]?.moisture ?? 0
  const earliest = data[0]?.moisture ?? 0
  const trend = latest - earliest

  return (
    <Panel>
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#d4cdb8] bg-[#ebe5d4]/30">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#4a5444] font-mono font-medium">
          Cell {cellId}
        </span>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm tabular-nums" style={{ color: moistureColor(latest) }}>
            {latest}%
          </span>
          <span className="text-[10px] font-mono text-[#8b6f47]">
            {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend)}%
          </span>
        </div>
      </div>
      <div className="h-24 px-2 pt-2 pb-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`grad-${cellId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={moistureColor(latest)} stopOpacity={0.3} />
                <stop offset="100%" stopColor={moistureColor(latest)} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <YAxis domain={[0, 100]} hide />
            <Tooltip
              cursor={{ stroke: '#8b6f47', strokeWidth: 1, strokeDasharray: '2 2' }}
              contentStyle={{ background: '#1a1f1a', border: 'none', borderRadius: 2, fontSize: 11, fontFamily: 'JetBrains Mono', padding: '4px 8px' }}
              labelStyle={{ color: '#7ba05b', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em' }}
              itemStyle={{ color: '#f5f1e8' }}
            />
            <Area
              type="monotone"
              dataKey="moisture"
              stroke={moistureColor(latest)}
              strokeWidth={1.5}
              fill={`url(#grad-${cellId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}

export default function Analytics() {
  const { data: sensors = [] } = useQuery({ queryKey: ['sensors'], queryFn: getSensorReadings })

  const avgMoisture = sensors.length
    ? Math.round(sensors.reduce((s, r) => s + r.moisture, 0) / sensors.length)
    : 0
  const avgTemp = sensors.length
    ? (sensors.reduce((s, r) => s + r.temperature, 0) / sensors.length).toFixed(1)
    : '—'

  // Aggregate fleet trend
  const { data: aggregate = [] } = useQuery({
    queryKey: ['moisture-aggregate'],
    queryFn: async () => {
      const allCells = sensors.map(s => s.cellId)
      if (allCells.length === 0) return []
      const histories = await Promise.all(allCells.map(c => getMoistureHistory(c)))
      const days = histories[0]?.length ?? 0
      return Array.from({ length: days }, (_, i) => ({
        date: histories[0][i].date,
        avg: Math.round(
          histories.reduce((sum, h) => sum + h[i].moisture, 0) / histories.length
        ),
      }))
    },
    enabled: sensors.length > 0,
    retry: false,
    staleTime: Infinity,
  })

  return (
    <div className="px-6 py-8 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b6f47] font-mono mb-2">
            Sensor data · 7-day window
          </div>
          <h1 className="font-display text-4xl text-[#1a1f1a]">
            <span className="italic text-[#2d5016]">Telemetry</span>
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <Stat label="Avg Moisture" value={`${avgMoisture}%`} />
          <Stat label="Avg Temp" value={`${avgTemp}°C`} />
          <Stat label="Cells" value={String(sensors.length)} />
        </div>
      </div>

      {/* Fleet aggregate */}
      <Panel className="mb-6">
        <PanelHeader label="Bed Average — 7 day trend" meta={`${avgMoisture}% current`} />
        <PanelBody className="p-0">
          <div className="h-48 px-4 py-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={aggregate}>
              <XAxis
                dataKey="date"
                tick={{ fill: '#8b6f47', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                axisLine={{ stroke: '#d4cdb8' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#8b6f47', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{ background: '#1a1f1a', border: 'none', borderRadius: 2, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                labelStyle={{ color: '#7ba05b' }}
                itemStyle={{ color: '#f5f1e8' }}
              />
              <Line
                type="monotone"
                dataKey="avg"
                stroke="#2d5016"
                strokeWidth={2}
                dot={{ fill: '#2d5016', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </PanelBody>
      </Panel>

      {/* Per-cell grid */}
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#8b6f47] font-mono mb-3">
        Per-Cell Detail
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sensors.map(s => <MoistureCard key={s.cellId} cellId={s.cellId} />)}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-2 border-[#d4cdb8] pl-3">
      <div className="text-[9px] uppercase tracking-[0.18em] text-[#8b6f47] font-mono">{label}</div>
      <div className="font-display text-2xl tabular-nums">{value}</div>
    </div>
  )
}
