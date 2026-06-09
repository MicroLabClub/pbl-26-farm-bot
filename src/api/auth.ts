/**
 * FarmBot auth helpers.
 * POST /api/tokens → { token: { encoded, unencoded: { bot, mqtt_ws, jti } } }
 * Token stored under localStorage key "session" (mirrors FarmBot Web App).
 */

const SESSION_KEY = 'session'

export interface UnencodedToken {
  bot: string        // MQTT username = device id
  mqtt_ws: string    // WebSocket MQTT URL (e.g. wss://my.farmbot.io:3002/ws)
  jti: string
  iss: string
  aud: string
}

export interface AuthState {
  token: {
    encoded: string
    unencoded: UnencodedToken
  }
  userId: number
}

export async function login(email: string, password: string): Promise<AuthState> {
  const res = await fetch('/api/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: { email, password } }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Auth failed (${res.status})`)
  }
  const data = await res.json() as { token: AuthState['token']; user?: { id: number } }
  const state: AuthState = {
    token: data.token,
    userId: data.user?.id ?? 0,
  }
  saveAuth(state)
  return state
}

export function saveAuth(state: AuthState): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(state))
}

export function loadAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as AuthState) : null
  } catch {
    return null
  }
}

export function clearAuth(): void {
  localStorage.removeItem(SESSION_KEY)
}

export function authHeader(): Record<string, string> {
  const auth = loadAuth()
  if (!auth) return {}
  return { Authorization: `Bearer ${auth.token.encoded}` }
}
