/**
 * FarmBot API service layer.
 * All UI code calls these functions — swap the implementation
 * to connect to my.farmbot.io or a local API.
 *
 * Reference: https://developer.farm.bot/v15/docs/web-app/rest-api
 */

import type { SystemStatus, CropCell, Task, Alert, SensorReading, Position, TaskAction, BedImage } from '@/types'
import { mqttTakePhoto, mqttScanBed, mqttMoveTo, mqttJog, mqttSendHome, mqttEStop, mqttWritePin, mqttMountTool, mqttDismountTool, mqttMountAndWater, mqttStopAndDismount, mqttMountAndSeed, mqttReturnToHolder, mqttMountAndProbe } from './mqtt'
import {
  mockSystemStatus, mockCrops,
  mockAlerts, mockSensorReadings, getMockMoistureHistory,
} from './mock/data'
import { authHeader } from './auth'
import { loadSettings } from '@/lib/settings'
import { loadTasks, addTask } from '@/lib/taskQueue'

// Reads the mock toggle from persisted settings; falls back to false (live).
function useMock(): boolean {
  try { return loadSettings().mock } catch { return false }
}

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`API ${res.status}: ${url}`)
  return res
}

// ── Bed dimensions ────────────────────────────────────────────────────────────

interface FirmwareConfig {
  movement_axis_nr_steps_x?: number
  movement_axis_nr_steps_y?: number
  movement_step_per_mm_x?: number
  movement_step_per_mm_y?: number
  // Some FarmBot firmware versions use _0/_1/_2 suffixes instead of _x/_y/_z
  movement_axis_nr_steps_0?: number
  movement_axis_nr_steps_1?: number
  movement_step_per_mm_0?: number
  movement_step_per_mm_1?: number
}

export interface BedDimensions { width: number; height: number }

export async function getBedDimensions(): Promise<BedDimensions> {
  if (useMock()) return { width: 1200, height: 1200 }
  try {
    const res = await apiFetch('/api/firmware_config', { headers: authHeader() })
    const cfg: FirmwareConfig = await res.json()
    const stepsX = cfg.movement_axis_nr_steps_x ?? cfg.movement_axis_nr_steps_0
    const stepsY = cfg.movement_axis_nr_steps_y ?? cfg.movement_axis_nr_steps_1
    const mmX   = cfg.movement_step_per_mm_x   ?? cfg.movement_step_per_mm_0
    const mmY   = cfg.movement_step_per_mm_y   ?? cfg.movement_step_per_mm_1
    const width  = stepsX && mmX ? Math.round(stepsX / mmX) : 1200
    const height = stepsY && mmY ? Math.round(stepsY / mmY) : 1200
    return { width, height }
  } catch {
    return { width: 1200, height: 1200 }
  }
}

// ── Adapters ───────────────────────────────────────────────────────────────────

interface FarmBotPoint {
  id: number
  name: string
  x: number
  y: number
  z: number
  pointer_type: string
  plant_stage?: string
  planted_at?: string
  days_to_maturity?: number
  openfarm_slug?: string
}

interface FarmBotAlert {
  id: number
  created_at: string
  priority?: number
  problem_tag?: string
  content?: string
}

function mapPlantStage(stage?: string): CropCell['status'] {
  if (stage === 'harvested') return 'harvested'
  if (stage === 'maturing') return 'ready'
  if (stage === 'growing') return 'growing'
  return 'planted' // planned, sprouting, undefined
}

function slugToDisplay(slug?: string): string {
  if (!slug) return ''
  // "miners-lettuce-1" → "miners lettuce", strip trailing digits
  return slug.replace(/-\d+$/, '').replace(/-/g, ' ')
}

function mapPoint(p: FarmBotPoint): CropCell {
  const plantedAt = p.planted_at ?? new Date().toISOString()
  const totalDays = p.days_to_maturity ?? 30
  const elapsed = Math.floor((Date.now() - new Date(plantedAt).getTime()) / 86400000)
  const growthStageDays = Math.min(elapsed, totalDays)
  return {
    id: String(p.id),
    col: 0,
    row: 0,
    cropName: p.name,
    variety: slugToDisplay(p.openfarm_slug),
    plantedAt,
    growthStageDays,
    totalDays,
    status: mapPlantStage(p.plant_stage),
    lastWatered: new Date().toISOString(),
    wateringCount: 0,
    totalWaterMl: 0,
    healthScore: 80,
  }
}

function mapAlert(a: FarmBotAlert): Alert {
  const priority = a.priority ?? 100
  const severity: Alert['severity'] =
    priority >= 600 ? 'critical' : priority >= 300 ? 'warning' : 'info'
  return {
    id: String(a.id),
    severity,
    message: a.content ?? a.problem_tag ?? 'FarmBot alert',
    timestamp: a.created_at,
    acknowledged: false,
  }
}

// ── System ────────────────────────────────────────────────────────────────────

export async function getSystemStatus(): Promise<SystemStatus> {
  // Status (position, tool, temperature) comes from MQTT, not REST.
  // Return a live-looking stub so pages that poll this don't crash.
  return { ...mockSystemStatus, lastHeartbeat: new Date().toISOString() }
}

// ── Motion control ────────────────────────────────────────────────────────────

export async function moveTo(position: Position): Promise<void> {
  if (useMock()) { console.log('[mock] moveTo', position); return }
  if (!mqttMoveTo(position)) throw new Error('Not connected to FarmBot broker')
}

export async function jogAxis(axis: 'x' | 'y' | 'z', delta: number): Promise<void> {
  if (useMock()) { console.log(`[mock] jog ${axis} by ${delta}`); return }
  if (!mqttJog(axis, delta)) throw new Error('Not connected to FarmBot broker')
}

export async function sendHome(): Promise<void> {
  if (useMock()) { console.log('[mock] home'); return }
  if (!mqttSendHome()) throw new Error('Not connected to FarmBot broker')
}

export async function sendEStop(): Promise<void> {
  if (useMock()) { console.log('[mock] E-STOP'); return }
  if (!mqttEStop()) throw new Error('Not connected to FarmBot broker')
}

/**
 * Sweep the gantry across the given grid positions, taking a photo at each.
 * There is no REST endpoint for this on FarmBot — it's published as a single
 * CeleryScript rpc_request (move + take_photo per cell) over MQTT.
 */
export async function scanBed(positions: Position[]): Promise<void> {
  if (useMock()) { console.log('[mock] scanBed', positions.length, 'cells'); return }
  if (!mqttScanBed(positions)) throw new Error('Not connected to FarmBot broker')
}

// ── Actuators ─────────────────────────────────────────────────────────────────

const TOOL_PINS: Record<string, number> = {
  water: 8, // Farmduino water-valve pin (matches the official watering Lua: write_pin(8, ...))
}

/**
 * Maps a UI tool id to the physical tool's name in the FarmBot Tools list.
 * Must match exactly — `mount_tool` looks the tool up by name to find its slot.
 * The camera is gantry-mounted, so it has no mountable tool.
 */
const TOOL_NAMES: Record<string, string> = {
  water: 'Watering Nozzle',
  seeder: 'Seeder',
  sensor: 'Soil Sensor',
}

export function isMountable(tool: string): boolean {
  return tool in TOOL_NAMES
}

export async function activateTool(tool: string, on: boolean): Promise<void> {
  if (useMock()) { console.log(`[mock] tool ${tool} → ${on}`); return }
  if (tool === 'camera' && on) {
    if (!mqttTakePhoto()) throw new Error('Not connected to FarmBot broker')
    return
  }
  const pin = TOOL_PINS[tool]
  if (pin !== undefined) {
    if (!mqttWritePin(pin, on ? 1 : 0)) throw new Error('Not connected to FarmBot broker')
    return
  }
}

/** Drive the gantry to the tool's slot and mount it onto the UTM. */
export async function mountTool(tool: string): Promise<void> {
  const name = TOOL_NAMES[tool]
  if (!name) throw new Error(`${tool} has no mountable tool`)
  if (useMock()) { console.log(`[mock] mount ${name}`); return }
  if (!mqttMountTool(name)) throw new Error('Not connected to FarmBot broker')
}

/** Return the currently mounted tool to its slot. */
export async function dismountTool(): Promise<void> {
  if (useMock()) { console.log('[mock] dismount tool'); return }
  if (!mqttDismountTool()) throw new Error('Not connected to FarmBot broker')
}

// Placeholder "where the plant is" target — a mid-bed spot for now; swap for
// the real plant coordinate later. Travels at z=0 (raised) to avoid crashing.
export const SEED_POSITION: Position = { x: 600, y: 400, z: -376 }

/**
 * Mount the nozzle, move to `position`, then open the valve.
 * Water keeps flowing until `stopAndDismount` is called.
 */
export async function mountAndWater(position: Position): Promise<void> {
  if (useMock()) { console.log(`[mock] mountAndWater ${JSON.stringify(position)}`); return }
  if (!mqttMountAndWater(position.x, position.y, position.z)) {
    throw new Error('Not connected to FarmBot broker')
  }
}

/** Stop the water and return the nozzle to its holder. */
export async function stopAndDismount(): Promise<void> {
  if (useMock()) { console.log('[mock] stopAndDismount'); return }
  if (!mqttStopAndDismount()) throw new Error('Not connected to FarmBot broker')
}

// ── Seeder ──────────────────────────────────────────────────────────────────
// Vacuum pump peripheral pin. CONFIRM in FarmBot's Peripherals panel — commonly
// 9 or 10. (Same kind of pin as water=8.)
export const VACUUM_PIN = 9
// Where the seeder picks up a seed (the Seed Bin slot).
export const SEED_SOURCE: Position = { x: 2160.2, y: 1263, z: -334 }
// The seeder tool's holder slot.
export const SEEDER_HOLDER: Position = { x: 2180.2, y: 349, z: -378 }
// After mounting, slide X− this far to clear the holder, and lift Z by this much.
export const SEEDER_EXIT_DX = 250
export const SEEDER_LIFT = 200

/**
 * Mount the seeder, pick a seed from `source`, and plant it at `plant`.
 */
export async function mountAndSeed(source: Position, plant: Position): Promise<void> {
  if (useMock()) { console.log(`[mock] mountAndSeed ${JSON.stringify(source)} → ${JSON.stringify(plant)}`); return }
  if (!mqttMountAndSeed(source.x, source.y, source.z, plant.x, plant.y, plant.z, VACUUM_PIN, SEEDER_EXIT_DX, SEEDER_LIFT)) {
    throw new Error('Not connected to FarmBot broker')
  }
}

/** Return the seeder to its holder. */
export async function dismountSeeder(): Promise<void> {
  if (useMock()) { console.log('[mock] dismountSeeder'); return }
  if (!mqttReturnToHolder(SEEDER_HOLDER.x, SEEDER_HOLDER.y, SEEDER_HOLDER.z, SEEDER_LIFT)) {
    throw new Error('Not connected to FarmBot broker')
  }
}

// ── Soil sensor ───────────────────────────────────────────────────────────────
// Soil moisture sensor analog pin (Farmduino default = 59).
export const SOIL_SENSOR_PIN = 59
// The soil sensor tool's holder slot.
export const SOIL_SENSOR_HOLDER: Position = { x: 2183.2, y: 551, z: -380 }
// Depth the sensor dips to when probing the soil.
export const SOIL_PROBE_Z = -439

/**
 * Mount the soil sensor, probe at `position`'s X/Y (down to SOIL_PROBE_Z), and
 * report the moisture reading (it comes back over the log stream as
 * "Soil moisture: <value>").
 */
export async function mountAndProbe(position: Position): Promise<void> {
  if (useMock()) { console.log(`[mock] mountAndProbe ${JSON.stringify(position)}`); return }
  if (!mqttMountAndProbe(position.x, position.y, SOIL_PROBE_Z, SOIL_SENSOR_PIN, SEEDER_EXIT_DX, SEEDER_LIFT)) {
    throw new Error('Not connected to FarmBot broker')
  }
}

/** Return the soil sensor to its holder. */
export async function dismountSensor(): Promise<void> {
  if (useMock()) { console.log('[mock] dismountSensor'); return }
  if (!mqttReturnToHolder(SOIL_SENSOR_HOLDER.x, SOIL_SENSOR_HOLDER.y, SOIL_SENSOR_HOLDER.z, SEEDER_LIFT)) {
    throw new Error('Not connected to FarmBot broker')
  }
}

// ── Crops ─────────────────────────────────────────────────────────────────────

export async function getCrops(): Promise<CropCell[]> {
  if (useMock()) return mockCrops
  const res = await apiFetch('/api/points?filter=kept', { headers: authHeader() })
  const points: FarmBotPoint[] = await res.json()
  return points.filter(p => p.pointer_type === 'Plant').map(mapPoint)
}

/**
 * Create a plant in FarmBot (a `Plant` point). It then shows up in Farm to Fork
 * via getCrops. `slug` is the OpenFarm crop slug, e.g. "radish".
 */
export async function addCrop(name: string, slug: string, x: number, y: number): Promise<void> {
  if (useMock()) { console.log('[mock] addCrop', { name, slug, x, y }); return }
  const res = await fetch('/api/points', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({
      pointer_type: 'Plant',
      name,
      openfarm_slug: slug,
      x, y, z: 0,
      radius: 25,
      plant_stage: 'planted',
      planted_at: new Date().toISOString(),
    }),
  })
  if (!res.ok) throw new Error(`Failed to add crop (${res.status})`)
}

export async function harvestCrop(cellId: string, yieldGrams: number): Promise<void> {
  if (useMock()) { console.log(`[mock] harvest ${cellId} ${yieldGrams}g`); return }
  await fetch(`/api/crops/${cellId}/harvest`, { method: 'POST', body: JSON.stringify({ yieldGrams }), headers: { 'Content-Type': 'application/json' } })
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function getTasks(): Promise<Task[]> {
  // The queue lives in the browser (FarmBot has no tasks endpoint).
  return loadTasks().sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
}

export async function createTask(action: TaskAction, position: Position, scheduledAt: string, cellId?: string, notes?: string): Promise<Task> {
  const task: Task = { id: `t-${Date.now()}`, action, position, scheduledAt, cellId, notes, status: 'pending' }
  addTask(task)
  return task
}

/**
 * Run a scheduled task's action over MQTT. Called by the background scheduler
 * when a task comes due. Throws if a command can't be sent (e.g. not connected).
 */
export async function runScheduledTask(task: Task): Promise<void> {
  switch (task.action) {
    case 'home':
      await sendHome()
      break
    case 'photo':
      await activateTool('camera', true)
      break
    case 'water':
      // Brief valve pulse: open, wait, close.
      await activateTool('water', true)
      await new Promise(r => setTimeout(r, 5000))
      await activateTool('water', false)
      break
    case 'plant':
    case 'probe':
      // No actuator wired for these yet — complete as a no-op.
      break
  }
}

// ── Sensors ───────────────────────────────────────────────────────────────────

export async function getSensorReadings(): Promise<SensorReading[]> {
  if (useMock()) return mockSensorReadings
  const res = await apiFetch('/api/sensor_readings', { headers: authHeader() })
  return res.json()
}

export async function getMoistureHistory(cellId: string) {
  // FarmBot's API has no per-cell history endpoint; always use generated data.
  return getMockMoistureHistory(cellId)
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export async function getAlerts(): Promise<Alert[]> {
  if (useMock()) return mockAlerts
  const res = await apiFetch('/api/alerts', { headers: authHeader() })
  const raw: FarmBotAlert[] = await res.json()
  return raw.map(mapAlert)
}

// ── Images ────────────────────────────────────────────────────────────────────

interface FarmBotImage {
  id: number
  created_at: string
  attachment_url: string
  attachment_processed_url?: string | null
  meta?: { x?: number; y?: number; z?: number }
}

export async function getImages(): Promise<BedImage[]> {
  if (useMock()) return []
  const res = await apiFetch('/api/images', { headers: authHeader() })
  const raw: FarmBotImage[] = await res.json()
  return raw
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 18)
    .map(img => ({
      id: String(img.id),
      capturedAt: img.created_at,
      url: img.attachment_processed_url ?? img.attachment_url,
      x: img.meta?.x ?? 0,
      y: img.meta?.y ?? 0,
      z: img.meta?.z ?? 0,
    }))
}

export async function acknowledgeAlert(id: string): Promise<void> {
  if (useMock()) { console.log(`[mock] ack alert ${id}`); return }
  await fetch(`/api/alerts/${id}/ack`, { method: 'POST' })
}
