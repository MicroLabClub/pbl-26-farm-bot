import { useState } from 'react'
import { Panel, PanelHeader, PanelBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { loadSettings, saveSettings } from '@/lib/settings'
import { login, loadAuth, clearAuth } from '@/api/auth'
import type { AuthState } from '@/api/auth'

export default function Settings() {
  const initial = loadSettings()
  const [rehoming, setRehoming] = useState(initial.rehoming)
  const [moistLow, setMoistLow] = useState(initial.moistLow)
  const [moistHigh, setMoistHigh] = useState(initial.moistHigh)
  const [apiUrl, setApiUrl] = useState(initial.apiUrl)
  const [mqtt, setMqtt] = useState(initial.mqtt)
  const [alerts, setAlerts] = useState(initial.alerts)
  const [mock, setMock] = useState(initial.mock)
  const [saved, setSaved] = useState(false)
  const [auth, setAuth] = useState<AuthState | null>(() => loadAuth())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)
    setLoginLoading(true)
    try {
      const state = await login(email, password)
      setAuth(state)
      setEmail('')
      setPassword('')
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleDisconnect = () => {
    clearAuth()
    setAuth(null)
  }

  const handleSave = () => {
    saveSettings({ rehoming, moistLow, moistHigh, apiUrl, mqtt, alerts, mock })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b6f47] font-mono mb-2">
          System configuration
        </div>
        <h1 className="font-display text-4xl text-[#1a1f1a]">
          <span className="italic text-[#2d5016]">Config</span>
        </h1>
      </div>

      <div className="space-y-6">
        {/* Account */}
        <Panel>
          <PanelHeader label="Account" meta={auth ? <Badge variant="green">Connected</Badge> : undefined} />
          <PanelBody>
            {auth ? (
              <div className="space-y-3">
                <div className="text-sm text-[#1a1f1a]">
                  Device: <span className="font-mono text-[#2d5016]">{auth.token.unencoded.bot}</span>
                </div>
                <div className="text-[11px] text-[#8b6f47] font-mono break-all">
                  MQTT: {auth.token.unencoded.mqtt_ws}
                </div>
                <button
                  onClick={handleDisconnect}
                  className="mt-2 px-4 py-1.5 border border-[#b34a3a]/40 text-[#b34a3a] text-xs font-mono uppercase tracking-[0.15em] rounded-sm hover:bg-[#b34a3a]/5 hover:border-[#b34a3a] transition-all"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-3">
                <Field label="Email" hint="Your my.farmbot.io account">
                  <TextInput value={email} onChange={setEmail} type="email" />
                </Field>
                <Field label="Password" hint="Account password">
                  <TextInput value={password} onChange={setPassword} type="password" />
                </Field>
                {loginError && (
                  <p className="text-xs text-[#b34a3a] font-mono">{loginError}</p>
                )}
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={loginLoading || !email || !password}
                    className="px-5 py-2 bg-[#2d5016] text-[#f5f1e8] text-xs font-mono uppercase tracking-[0.15em] rounded-sm hover:bg-[#1f3810] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {loginLoading ? 'Connecting…' : 'Connect'}
                  </button>
                </div>
              </form>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader label="Connection" meta={mock ? 'mock mode' : 'live'} />
          <PanelBody className="divide-y divide-[#d4cdb8]">
            <Field label="Mock data layer" hint="Disable when wiring to a real backend">
              <Toggle checked={mock} onChange={setMock} />
            </Field>
            <Field label="REST API base URL" hint="my.farmbot.io or local proxy">
              <TextInput value={apiUrl} onChange={setApiUrl} />
            </Field>
            <Field label="MQTT broker" hint="WebSocket endpoint for device control">
              <TextInput value={mqtt} onChange={setMqtt} />
            </Field>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader label="Motion" />
          <PanelBody className="divide-y divide-[#d4cdb8]">
            <Field label="Re-homing interval" hint="Auto re-home every N task cycles">
              <NumInput value={rehoming} onChange={setRehoming} unit="cycles" />
            </Field>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader label="Sensor Thresholds" />
          <PanelBody className="divide-y divide-[#d4cdb8]">
            <Field label="Moisture floor" hint="Trigger watering below this">
              <NumInput value={moistLow} onChange={setMoistLow} unit="%" />
            </Field>
            <Field label="Moisture ceiling" hint="Stop watering above this">
              <NumInput value={moistHigh} onChange={setMoistHigh} unit="%" />
            </Field>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader label="Alerts & Notifications" />
          <PanelBody>
            <Field label="Push & SMS alerts" hint="On critical events">
              <Toggle checked={alerts} onChange={setAlerts} />
            </Field>
          </PanelBody>
        </Panel>

        <div className="flex justify-end items-center gap-4 pt-2">
          {saved && (
            <span className="text-[10px] font-mono text-[#4a7c2c] uppercase tracking-wider">
              ✓ Saved
            </span>
          )}
          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-[#2d5016] text-[#f5f1e8] text-xs font-mono uppercase tracking-[0.15em] rounded-sm hover:bg-[#1f3810] transition-colors"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
      <div>
        <div className="text-sm text-[#1a1f1a]">{label}</div>
        {hint && <div className="text-[11px] text-[#8b6f47] mt-0.5 font-mono">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}

function NumInput({ value, onChange, unit }: { value: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-20 px-2.5 py-1.5 bg-[#f5f1e8] border border-[#d4cdb8] rounded-sm font-mono text-xs tabular-nums text-center focus:border-[#2d5016] focus:outline-none"
      />
      {unit && <span className="text-[10px] uppercase tracking-wider text-[#8b6f47] font-mono">{unit}</span>}
    </div>
  )
}

function TextInput({ value, onChange, type = 'text' }: { value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-64 px-2.5 py-1.5 bg-[#f5f1e8] border border-[#d4cdb8] rounded-sm font-mono text-xs focus:border-[#2d5016] focus:outline-none"
    />
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-9 h-5 rounded-full transition-colors',
        checked ? 'bg-[#2d5016]' : 'bg-[#d4cdb8]',
      )}
    >
      <div
        className={cn(
          'absolute top-0.5 w-4 h-4 rounded-full bg-[#f5f1e8] shadow-sm transition-all',
          checked ? 'left-[18px]' : 'left-0.5',
        )}
      />
    </button>
  )
}
