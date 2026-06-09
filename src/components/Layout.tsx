import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { usePosition } from '@/context/PositionContext'
import { cn } from '@/lib/utils'

const nav = [
  { to: '/', label: 'Overview' },
  { to: '/control', label: 'Control' },
  { to: '/planner', label: 'Bed' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/analytics', label: 'Telemetry' },
  { to: '/farm-to-fork', label: 'Farm to Fork' },
  { to: '/settings', label: 'Config' },
]

function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="font-mono text-xs tabular-nums text-[#4a5444]">
      {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  )
}

export default function Layout() {
  const location = useLocation()
  const { position, mqttStatus } = usePosition()
  const connected = mqttStatus === 'online'

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f1e8] text-[#1a1f1a]">
      {/* Top Bar */}
      <header className="border-b border-[#d4cdb8] bg-[#f5f1e8]/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="px-6 h-12 flex items-center gap-6">
          {/* Identity */}
          <div className="flex items-center gap-3">
            <div className="relative w-7 h-7">
              <svg viewBox="0 0 28 28" className="w-full h-full">
                <rect x="2" y="2" width="24" height="24" rx="2" fill="#2d5016" />
                <path d="M8 14 L14 8 L20 14 L14 20 Z" fill="#f5f1e8" opacity="0.9" />
                <circle cx="14" cy="14" r="1.5" fill="#2d5016" />
              </svg>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-xl leading-none">FarmBot</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#8b6f47] font-mono">01-AFB</span>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1 ml-4">
            {nav.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'px-3 py-1.5 text-sm transition-colors relative',
                    isActive
                      ? 'text-[#1a1f1a] font-medium'
                      : 'text-[#4a5444] hover:text-[#1a1f1a]',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {label}
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute left-0 right-0 -bottom-[13px] h-[2px] bg-[#2d5016]"
                        transition={{ duration: 0.2 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex-1" />

          {/* Status cluster */}
          <div className="flex items-center gap-5 text-xs">
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-1.5 h-1.5 rounded-full',
                mqttStatus === 'online' ? 'bg-[#4a7c2c]' : mqttStatus === 'connecting' ? 'bg-[#c9a032]' : 'bg-[#b34a3a]',
              )}>
                {mqttStatus === 'online' && (
                  <div className="w-full h-full rounded-full bg-[#4a7c2c] animate-ping" />
                )}
              </div>
              <span className={cn(
                'font-mono uppercase tracking-wider',
                mqttStatus === 'online' ? 'text-[#2d5016]' : mqttStatus === 'connecting' ? 'text-[#c9a032]' : 'text-[#b34a3a]',
              )}>
                {mqttStatus}
              </span>
            </div>
            <div className="h-3 w-px bg-[#d4cdb8]" />
            <span className="font-mono text-[#4a5444] tabular-nums">
              X{position.x.toString().padStart(3, '0')} Y{position.y.toString().padStart(3, '0')} Z{position.z.toString().padStart(3, '0')}
            </span>
            <div className="h-3 w-px bg-[#d4cdb8]" />
            <Clock />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer rule */}
      <footer className="border-t border-[#d4cdb8] px-6 h-8 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-[#8b6f47] font-mono">
        <span>PBL26 · Team 01-AFB · UTM</span>
        <span>v0.1.0 — {connected ? 'live' : 'mock'} data layer</span>
      </footer>
    </div>
  )
}
