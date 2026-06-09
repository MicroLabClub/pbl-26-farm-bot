# FarmBot 01-AFB — Web Dashboard

Control interface for the autonomous CNC farm gantry built at UTM / PBL26, Team 01-AFB.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Running Locally](#4-running-locally)
5. [Pages](#5-pages)
6. [Data & API Layer](#6-data--api-layer)
7. [Connecting to the Real Backend](#7-connecting-to-the-real-backend)
   - 7.0 [Self-Hosting the Backend](#70-self-hosting-the-backend)
   - 7.1 [Authentication](#71-authentication)
   - 7.2 [Vite Dev Proxy](#72-vite-dev-proxy-cors-fix)
   - 7.3 [REST API Mapping](#73-rest-api-mapping)
   - 7.4 [MQTT Real-time Control](#74-mqtt-real-time-control)
   - 7.5 [Production Proxy](#75-production-proxy)
8. [Design Tokens](#8-design-tokens)
9. [Adding New Features](#9-adding-new-features)
10. [External References](#10-external-references)

---

## 1. Overview

The dashboard is a single-page React application that operates against either **mock data** (default, no hardware required) or the **FarmBot REST API + MQTT broker** (live mode).

It covers:

| Capability | Where |
|---|---|
| Real-time gantry position (XYZ) | Dashboard, Control |
| Manual jog / move-to / E-Stop | Control |
| Plot grid with per-cell crop & moisture data | Bed (Farm Planner) |
| Task scheduling and history | Tasks |
| 7-day soil moisture telemetry | Telemetry (Analytics) |
| Full crop lifecycle traceability | Farm to Fork |
| System configuration | Config (Settings) |

Everything in the frontend is pure React — **no custom backend** is required to run the app in mock mode. Switching to live mode is a single boolean flag plus a Vite proxy entry.

---

## 2. Tech Stack

| Layer | Library | Why |
|---|---|---|
| UI framework | React 19 + TypeScript | Component model, strong types |
| Build tool | Vite 8 | Fast HMR, built-in proxy, easy aliases |
| Styling | Tailwind CSS v4 | Utility-first, no runtime cost |
| Routing | React Router v7 | File-style SPA routing |
| Server state | TanStack Query v5 | Caching, refetch intervals, easy mock swap |
| Animation | Framer Motion v12 | Layout animations, page transitions |
| Charts | Recharts | Area + line charts for moisture history |
| Icons | Lucide React | Consistent icon set |
| Utilities | clsx + tailwind-merge | Safe class merging |

**Fonts (loaded from Google Fonts)**
- `Instrument Serif` — editorial headlines and emphasis
- `Inter` — body text and UI labels
- `JetBrains Mono` — all data values, coordinates, codes

---

## 3. Project Structure

```
web/
├── src/
│   ├── api/
│   │   ├── farmbot.ts          ← Service layer (all API calls go here)
│   │   └── mock/
│   │       └── data.ts         ← Static mock data (12 crops, tasks, alerts, sensors)
│   │
│   ├── components/
│   │   ├── Layout.tsx          ← Top bar, live XYZ / status, nav, footer
│   │   └── ui/
│   │       ├── Card.tsx        ← Panel / PanelHeader / PanelBody primitives
│   │       └── Badge.tsx       ← Status / label badges
│   │
│   ├── lib/
│   │   └── utils.ts            ← cn(), moisture/health colors, date helpers
│   │
│   ├── pages/
│   │   ├── Dashboard.tsx       ← Overview, position visual, recent tasks, alerts
│   │   ├── ControlPanel.tsx    ← D-pad jog, Z axis, tools, move-to, E-Stop
│   │   ├── FarmPlanner.tsx     ← 4×3 interactive plot grid, cell inspector
│   │   ├── TaskManager.tsx     ← Filterable task table (running / queue / history)
│   │   ├── Analytics.tsx       ← Fleet aggregate + per-cell 7-day moisture charts
│   │   ├── FarmToFork.tsx      ← Crop passport, lifecycle timeline, harvest archive
│   │   └── Settings.tsx        ← Connection URLs, thresholds, toggles
│   │
│   ├── types/
│   │   └── index.ts            ← All shared TypeScript types (CropCell, Task, etc.)
│   │
│   ├── App.tsx                 ← Router root, QueryClient provider
│   ├── main.tsx                ← Entry point
│   └── index.css               ← Global reset, paper background, scrollbar
│
├── index.html                  ← Font imports, page title
├── vite.config.ts              ← Path alias (@/), Tailwind plugin
├── tsconfig.app.json           ← Path alias, compiler options
└── package.json
```

---

## 4. Running Locally

```bash
cd web
npm install
npm run dev        # starts at http://localhost:5173
```

Other commands:

```bash
npm run build      # type-check + production bundle → dist/
npm run preview    # serve dist/ locally
```

No `.env` file or external service is needed while `USE_MOCK = true` (the default).

---

## 5. Pages

### Dashboard (`/`)

Entry point. Shows:
- Editorial headline with a live crop health summary
- Four vital stats (active crops, avg health, water today, uptime)
- **Position visual** — a top-down schematic of the bed with the gantry head's animated XYZ location
- Recent activity table (last 6 tasks)
- Unacknowledged alerts feed
- Quick-action buttons (stub — wire to API calls)

The position visual polls `getSystemStatus()` every 2 seconds via TanStack Query's `refetchInterval`.

---

### Control Panel (`/control`)

Manual gantry override. Shows:
- Live position banner (dark terminal strip, 1-second poll)
- **D-pad** for X/Y jogging (step sizes: 1 / 10 / 100 mm)
- **Z axis buttons** (up/down)
- Tool selector (water / seeder / sensor / camera) + actuate toggle
- **Move to coordinate** form — X, Y, Z inputs → executes `moveTo()`
- **Emergency Stop** button (always visible at the top-right of the header)

Every jog button calls `jogAxis(axis, delta)` from `src/api/farmbot.ts`. In mock mode this logs to the console.

---

### Bed / Farm Planner (`/planner`)

Interactive 4-column × 3-row plot grid.
- Each occupied cell shows the crop emoji, name, variety, and current soil moisture
- Status dot (green = ready, blue = growing, yellow = planted)
- Clicking a cell opens the **Cell Inspector** panel on the right with:
  - Growth progress bar
  - Detail rows (planted date, health score, water used, cell ID)
  - Moisture bar (from latest sensor reading)
  - Quick action buttons (Water now / Probe)
- Empty cells are shown with dashed borders

The grid is derived from `getCrops()` and `getSensorReadings()` — each crop's `id` is `"col-row"` (e.g., `"2-1"`).

---

### Tasks (`/tasks`)

Filterable data table of all tasks.
- Filter tabs: All / Running / Queue / Done / Failed
- Columns: status icon, action, cell, position (XYZ), scheduled time, duration, badge
- Animated underline filter indicator

Task statuses: `pending | running | completed | failed | skipped`
Task actions: `water | plant | probe | photo | home`

---

### Telemetry (`/analytics`)

- **Aggregate chart** — 7-day average moisture across the entire bed (line chart)
- **Per-cell cards** — one area chart per active cell with trend arrow (↑/↓/→)

Charts use Recharts with a custom dark tooltip and Tailwind-matched color palette. Data comes from `getMoistureHistory(cellId)` — returns 7 points per cell.

---

### Farm to Fork (`/farm-to-fork`)

Traceability page. Every crop in the system has a full verifiable record.

**Active view** — cards for all growing crops with a progress bar, water used, and health score.

**Harvested view** — archive of completed crops with yield in grams and harvest date.

**Crop Passport modal** — clicking any card opens a passport with:
- Key stats grid (planted, water used, health %, harvest date, yield, ml/g efficiency)
- Lifecycle timeline (seed → waterings → ready → harvested)
- A short text description of the crop's journey
- Export PDF button (stub — wire to a PDF generation library)
- Share / QR button (stub)

The `ml/g` efficiency ratio (total water applied ÷ yield in grams) is unique to this page and gives a sustainability angle relevant for research and PBL reporting.

---

### Config (`/settings`)

- Mock data toggle (`USE_MOCK`)
- REST API base URL
- MQTT broker WebSocket URL
- Re-homing interval (cycles)
- Moisture floor / ceiling thresholds
- Alerts on/off

Currently **state only** — values are not persisted. To persist, write to `localStorage` or POST to a config endpoint.

---

## 6. Data & API Layer

All data access is centralised in `src/api/farmbot.ts`. **No page imports `fetch` or touches mock data directly.**

```ts
// src/api/farmbot.ts
const USE_MOCK = true   // ← the only line to change for live mode
```

When `USE_MOCK = true`, every function returns data from `src/api/mock/data.ts` immediately with no network call.

When `USE_MOCK = false`, each function calls the REST endpoint listed in the comment above it.

### Available API functions

```ts
getSystemStatus()                          → SystemStatus
moveTo(position: Position)                 → void
jogAxis(axis, delta)                       → void
sendHome()                                 → void
sendEStop()                                → void
activateTool(tool, on)                     → void
getCrops()                                 → CropCell[]
harvestCrop(cellId, yieldGrams)            → void
getTasks()                                 → Task[]
createTask(action, position, scheduledAt)  → Task
getSensorReadings()                        → SensorReading[]
getMoistureHistory(cellId)                 → { date, moisture }[]
getAlerts()                                → Alert[]
acknowledgeAlert(id)                       → void
```

### Types (`src/types/index.ts`)

```ts
Position       { x, y, z: number }
CropCell       { id, col, row, cropName, variety, status, healthScore, ... }
Task           { id, action, position, status, scheduledAt, ... }
SensorReading  { cellId, moisture, temperature, timestamp }
Alert          { id, severity, message, timestamp, acknowledged }
SystemStatus   { connection, position, activeTask, tool, motorTemperature, uptime }
```

---

## 7. Connecting to the Real Backend

Two paths exist:

| Mode | Backend | When to use |
|---|---|---|
| **Cloud** | `my.farmbot.io` | Fastest to get started — account already exists, no infrastructure |
| **Self-hosted** | Your own server (Docker) | Required for local-first deployment per SR-1.1–1.3 — full control, no dependency on FarmBot Inc. |

Both modes use the same auth flow, the same REST API surface, and the same MQTT topic format. The only differences are the `API_HOST` and the MQTT WebSocket URL.

---

### 7.0 Self-Hosting the Backend

The official FarmBot Web App is open-source (Rails + RabbitMQ + PostgreSQL + Redis) and ships a production-ready `docker-compose.yml`. This is the recommended path for the 01-AFB project per SR-1.1.

**Source:** [github.com/FarmBot/Farmbot-Web-App](https://github.com/FarmBot/Farmbot-Web-App) (already cloned to `Farmbot-Web-App/`)

#### Service architecture

```
        PostgreSQL 17       Redis 7
               ↑               ↑
               └───── web ─────┘           (Rails/Passenger, port API_PORT)
                        ↑
              ┌──────── mqtt ────────┐      (RabbitMQ)
              │                     │
       log_digests   rabbit_jobs   delayed_job
```

Port map (host → container):

| Service | Port | Protocol |
|---|---|---|
| `web` | `API_PORT` (default `3000`) | HTTP/REST |
| `mqtt` | `1883` | MQTT plain |
| `mqtt` | `8883` | MQTT TLS |
| `mqtt` | **`3002`** → `15675` | **MQTT over WebSocket** |
| `mqtt` | `15672` | RabbitMQ management UI |

#### Step 1 — Prerequisites

A Linux machine (Ubuntu recommended). Can be a cloud VPS (Hetzner, DigitalOcean) or a local Raspberry Pi / mini-PC in the greenhouse.

```bash
# Install Docker + Docker Compose
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER
```

#### Step 2 — Configure environment

```bash
cd Farmbot-Web-App
cp example.env .env
nano .env
```

Minimum required values (from `example.env`):

```bash
API_HOST=192.168.1.100        # Your server's IP or domain — NOT localhost
API_PORT=3000                 # 443 if you have SSL
MQTT_HOST=192.168.1.100       # Usually same as API_HOST

POSTGRES_PASSWORD=change_me   # Strong random password
DEVISE_SECRET=<openssl rand -hex 64>
SECRET_KEY_BASE=<openssl rand -hex 64>
ADMIN_PASSWORD=change_me

RAILS_ENV=production
NO_EMAILS=TRUE                # Disables email verification — useful for lab setup
```

#### Step 3 — Build and start

```bash
docker compose up -d

# First run: set up and migrate the database
docker compose run web bundle exec rails db:setup
docker compose run web bundle exec rails db:migrate
```

The web UI is now accessible at `http://YOUR_IP:3000`. Register an admin account there.

#### Step 4 — Point the FarmBot device at your server

FarmBot OS connects to `my.farmbot.io` by default. To redirect it:

1. Power on the FarmBot. If it was previously configured, perform a **Factory Reset** from the web UI or hold the button.
2. The device will broadcast a Wi-Fi network: `FarmBot-XXXX`.
3. Connect to that network from a phone or laptop.
4. The captive portal opens — enter your local Wi-Fi credentials.
5. Expand **Advanced Settings** → **Server URL**.
6. Replace `https://my.farmbot.io` with `http://YOUR_SERVER_IP:3000`.
7. Save. The bot reboots and registers with your server.

#### Step 5 — HTTPS (strongly recommended)

FarmBot OS prefers HTTPS. Without it, some sync features may not work reliably.
The easiest path: point a domain at your server, then:

```bash
sudo apt install nginx certbot python3-certbot-nginx
sudo certbot --nginx -d your.domain.com
```

Then set `API_HOST=your.domain.com` and `API_PORT=443` in `.env` and restart.

---

### 7.1 Authentication

FarmBot uses JWT tokens issued per-device. Get one by POSTing credentials:

```http
POST https://my.farmbot.io/api/tokens
Content-Type: application/json

{
  "user": {
    "email": "your@email.com",
    "password": "yourpassword"
  }
}
```

**Response (simplified):**
```json
{
  "token": {
    "unencoded": {
      "iss": "https://my.farmbot.io",
      "bot": "device_36",
      "jti": "abc123",
      "mqtt": "clever-octopus.rmq.cloudamqp.com",
      "mqtt_ws": "wss://clever-octopus.rmq.cloudamqp.com:443/mqtt"
    },
    "encoded": "eyJ..."
  },
  "user": { "id": 42, ... }
}
```

Key fields in `token.unencoded`:

| Field | Value | Used for |
|---|---|---|
| `bot` | `"device_36"` | MQTT username |
| `mqtt_ws` | Full WebSocket URL | MQTT broker connection (cloud or self-hosted) |
| `jti` | token identifier | MQTT client ID / echo filtering |
| `encoded` | JWT string | Bearer header + MQTT password |

> **Self-hosted note:** For your own Docker server, `mqtt_ws` will be `ws://YOUR_IP:3002/ws` (port `3002` on the host maps to RabbitMQ's WebSocket port `15675` inside the container).

**Implementation — add to `src/api/farmbot.ts`:**

```ts
export async function login(email: string, password: string) {
  const res = await fetch('/api/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: { email, password } }),
  })
  const data = await res.json()
  localStorage.setItem('fb_token',   data.token.encoded)
  localStorage.setItem('fb_bot',     data.token.unencoded.bot)      // MQTT username
  localStorage.setItem('fb_mqtt_ws', data.token.unencoded.mqtt_ws)  // full WebSocket URL
  localStorage.setItem('fb_jti',     data.token.unencoded.jti)
  return data
}

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('fb_token')}` }
}
```

---

### 7.2 Vite Dev Proxy (CORS fix)

The browser cannot call `my.farmbot.io` directly from `localhost` due to CORS. Vite's dev server can proxy the requests transparently — no backend code needed.

Add to `vite.config.ts`:

```ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },

  server: {
    proxy: {
      '/api': {
        target: 'https://my.farmbot.io',
        changeOrigin: true,
        secure: true,
        // Strip /api prefix → becomes /api on the target too
        // FarmBot API lives at my.farmbot.io/api/*, so paths align
      },
    },
  },
})
```

Now `fetch('/api/tokens')` in the browser hits `https://my.farmbot.io/api/tokens` — no CORS issue, no backend.

---

### 7.3 REST API Mapping

FarmBot resource names → dashboard types:

| Dashboard type | FarmBot endpoint | Notes |
|---|---|---|
| `CropCell` (active) | `GET /api/points?filter=kept` | Plants are points with `pointer_type: "Plant"` — filter client-side |
| `CropCell` (harvested) | `GET /api/saved_gardens` | Archived plant groups |
| `Task` | `GET /api/farm_events` | Scheduled sequences |
| `SensorReading` | `GET /api/sensor_readings` | Filter by `pin` for moisture sensor |
| `Alert` | `GET /api/alerts` | Direct match |
| `SystemStatus` connectivity | `GET /api/device` | `last_saw_api`, `last_status` fields |
| `SystemStatus` position | MQTT `bot/<device_id>/status` | Real-time XYZ — see section 7.4 |

> **Important:** FarmBot has no `/api/plants` endpoint. All spatial points (plants, weeds, tool slots) live under `/api/points`. Filter to plants by checking `pointer_type === "Plant"` on each result.

**Example: fetching crops**

```ts
export async function getCrops(): Promise<CropCell[]> {
  if (USE_MOCK) return mockCrops

  const res = await fetch('/api/points?filter=kept', { headers: authHeader() })
  const points = await res.json()
  const plants = points.filter((p: FarmBotPoint) => p.pointer_type === 'Plant')

  return plants.map((p: FarmBotPoint) => ({
    id: `${p.x}-${p.y}`,
    col: Math.floor(p.x / 120),  // 120mm per cell column
    row: Math.floor(p.y / 120),
    cropName: p.name,
    variety: p.openfarm_slug ?? '—',
    plantedAt: p.planted_at ?? new Date().toISOString(),
    growthStageDays: daysSince(p.planted_at),
    totalDays: p.days_to_harvest ?? 60,
    status: plantStageToStatus(p.plant_stage),
    lastWatered: p.updated_at,
    wateringCount: 0,        // derive from sensor_readings
    totalWaterMl: 0,         // derive from farm_events history
    healthScore: 90,
  }))
}
```

---

### 7.4 MQTT Real-time Control

Real-time device communication (jog, move, water) uses MQTT over WebSocket.

**Install the client library:**

```bash
npm install mqtt
```

**MQTT topic structure:**

| Topic | Direction | Content |
|---|---|---|
| `bot/<device_id>/status` | device → browser | Full state tree, published every ~500ms. Contains `location_data.position.{x,y,z}` |
| `bot/<device_id>/from_clients` | browser → device | CeleryScript commands (move, water, e-stop, etc.) |
| `bot/<device_id>/logs` | device → browser | Log messages |
| `bot/<device_id>/sync/<Resource>/<id>` | device → browser | Auto-sync resource changes |

Where `<device_id>` = `token.unencoded.bot` (e.g. `device_36`).

**Connection (add to `src/api/farmbot.ts`):**

```ts
import mqtt, { MqttClient } from 'mqtt'

let client: MqttClient | null = null

export function connectMQTT(): MqttClient {
  // mqtt_ws is the full WebSocket URL — already set by the server in the token.
  // Cloud:       wss://clever-octopus.rmq.cloudamqp.com:443/mqtt
  // Self-hosted: ws://YOUR_IP:3002/ws  (host port 3002 → container port 15675)
  const mqttWs = localStorage.getItem('fb_mqtt_ws') ?? ''
  const bot    = localStorage.getItem('fb_bot')     ?? ''  // e.g. "device_36"
  const token  = localStorage.getItem('fb_token')   ?? ''
  const jti    = localStorage.getItem('fb_jti')     ?? ''

  client = mqtt.connect(mqttWs, {
    username: bot,          // "device_36"
    password: token,        // encoded JWT used as password
    clientId: `dashboard_${jti}_${Date.now()}`,
  })

  client.on('connect', () => {
    client!.subscribe(`bot/${bot}/status`)
    client!.subscribe(`bot/${bot}/logs`)
  })
  client.on('message', (topic, payload) => handleIncoming(topic, bot, payload))

  return client
}

function handleIncoming(topic: string, bot: string, payload: Buffer) {
  const msg = JSON.parse(payload.toString())
  if (topic === `bot/${bot}/status`) {
    const { x, y, z } = msg.location_data.position
    // Push to Zustand store or invalidate TanStack Query ['status'] key
    console.log('position', x, y, z)
  }
}
```

**Sending a move command:**

FarmBot's firmware understands Celery Script JSON messages published to the `from_clients` topic.

```ts
function publishCommand(command: object) {
  if (!client) return
  const bot = localStorage.getItem('fb_bot') ?? ''
  client.publish(`bot/${bot}/from_clients`, JSON.stringify(command))
}

export async function moveTo(position: Position): Promise<void> {
  if (USE_MOCK) { console.log('[mock] moveTo', position); return }

  publishCommand({
    kind: 'rpc_request',
    args: { label: `move_${Date.now()}` },
    body: [{
      kind: 'move_absolute',
      args: {
        location: { kind: 'coordinate', args: { x: position.x, y: position.y, z: position.z } },
        offset:   { kind: 'coordinate', args: { x: 0, y: 0, z: 0 } },
        speed: 100,
      },
    }],
  })
}

export async function sendEStop(): Promise<void> {
  if (USE_MOCK) { console.log('[mock] E-STOP'); return }
  publishCommand({ kind: 'rpc_request', args: { label: 'estop' }, body: [{ kind: 'emergency_stop', args: {} }] })
}
```

**Receiving real-time position:**

The device publishes to `bot/<device_id>/status` every ~500ms while online. Extract position from the payload:

```ts
const { x, y, z } = msg.location_data.position
```

Other useful paths in the status payload:

```
msg.informational_settings.sync_status     → "synced" | "sync_error" | "syncing"
msg.informational_settings.controller_version → FBOS firmware version
msg.informational_settings.uptime          → seconds since last boot
```

---

### 7.5 Production Proxy

The Vite proxy only runs during `npm run dev`. In production (after `npm run build`), you need a real proxy in front of the built static files.

**Option A — Nginx (simplest, ~10 lines):**

```nginx
server {
  listen 80;
  root /var/www/farmbot-dashboard/dist;
  index index.html;

  location /api/ {
    proxy_pass https://my.farmbot.io/api/;
    proxy_set_header Host my.farmbot.io;
    proxy_ssl_server_name on;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

**Option B — Node.js (20 lines, any hosting):**

```ts
// server.js
import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import path from 'path'

const app = express()

app.use('/api', createProxyMiddleware({
  target: 'https://my.farmbot.io',
  changeOrigin: true,
  secure: true,
}))

app.use(express.static('dist'))
app.get('*', (_, res) => res.sendFile(path.resolve('dist/index.html')))

app.listen(3000, () => console.log('Dashboard running on :3000'))
```

```bash
npm install express http-proxy-middleware
node server.js
```

**Option C — Cloudflare Workers (zero server, free):**

```js
export default {
  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api')) {
      const target = new URL(url.pathname + url.search, 'https://my.farmbot.io')
      return fetch(target, { headers: request.headers })
    }
    return fetch(request)  // serve static from Cloudflare Pages
  }
}
```

---

## 8. Design Tokens

The palette is defined inline in Tailwind utility classes. Key raw values:

| Name | Hex | Usage |
|---|---|---|
| Paper | `#f5f1e8` | Page background |
| Paper warm | `#ebe5d4` | Panel headers, hover states |
| Ink | `#1a1f1a` | Primary text, headings |
| Ink muted | `#4a5444` | Secondary labels |
| Soil | `#8b6f47` | Tertiary labels, icons, borders |
| Soil light | `#c9a876` | Decorative accents |
| Border | `#d4cdb8` | All dividers, panel outlines |
| Leaf deep | `#2d5016` | Primary action, CTA buttons, active state |
| Leaf mid | `#4a7c2c` | Healthy moisture/health indicators |
| Leaf sage | `#7ba05b` | Terminal accent (live status strip) |
| Rust | `#b34a3a` | Danger, E-Stop, critical alerts |
| Mustard | `#c9a032` | Warning, low moisture |
| Slate | `#3a5a7c` | Running tasks, water tool |

The paper grain texture is a CSS radial gradient on `body::before` in `index.css` — a 24×24px dot grid at 3% opacity.

---

## 9. Adding New Features

### Add a new page

1. Create `src/pages/MyPage.tsx`
2. Add a route in `src/App.tsx`:
   ```tsx
   <Route path="my-page" element={<MyPage />} />
   ```
3. Add a nav entry in `src/components/Layout.tsx` (the `nav` array)

### Add a new API call

1. Add the typed function to `src/api/farmbot.ts` following the existing pattern:
   ```ts
   export async function myCall(arg: string): Promise<MyType> {
     if (USE_MOCK) return mockMyData
     const res = await fetch(`/api/my-endpoint/${arg}`, { headers: authHeader() })
     return res.json()
   }
   ```
2. Use it with TanStack Query in the page:
   ```tsx
   const { data } = useQuery({ queryKey: ['my-key', arg], queryFn: () => myCall(arg) })
   ```

### Add mock data

Edit `src/api/mock/data.ts`. Export constants or functions — the service layer imports them only when `USE_MOCK = true`.

### Switching to live mode (checklist)

- [ ] Run `npm install mqtt`
- [ ] Set `USE_MOCK = false` in `src/api/farmbot.ts`
- [ ] Add proxy block to `vite.config.ts` (section 7.2)
- [ ] Implement `login()` and call it from the Settings page or a Login page
- [ ] Call `connectMQTT()` once on app startup (e.g., in `App.tsx` after login)
- [ ] Wire the MQTT `status` message handler to update XYZ in the dashboard
- [ ] Map FarmBot plant/sensor fields to `CropCell` / `SensorReading` types (section 7.3)

---

## 10. External References

| Resource | URL | Notes |
|---|---|---|
| **FarmBot Software Development Docs** | [developer.farm.bot/v15/docs/farmbot-software-development](https://developer.farm.bot/v15/docs/farmbot-software-development) | Primary reference for REST API, MQTT topics, Celery Script command format, and device architecture |
| FarmBot REST API reference | [developer.farm.bot/v15/docs/web-app/rest-api](https://developer.farm.bot/v15/docs/web-app/rest-api) | Full endpoint listing with request/response shapes |
| Celery Script (command format) | [developer.farm.bot/v15/docs/celery-script](https://developer.farm.bot/v15/docs/celery-script) | JSON schema for MQTT commands (move, water, e-stop, etc.) |
| FarmBot MQTT / message broker | [developer.farm.bot/v15/docs/message-broker](https://developer.farm.bot/v15/docs/message-broker) | Topic structure, WebSocket endpoint, auth via JWT |
| FarmBot Web App (open source) | [github.com/FarmBot/Farmbot-Web-App](https://github.com/FarmBot/Farmbot-Web-App) | Reference React implementation — useful for seeing how they handle MQTT state and API calls |
| my.farmbot.io | [my.farmbot.io](https://my.farmbot.io) | Live FarmBot cloud — token endpoint and API live here |
