/**
 * MQTT real-time integration for FarmBot.
 * Uses mqtt.js v5 (browser WebSocket transport).
 *
 * Token fields used:
 *   unencoded.bot      → device_id (MQTT username, also the topic prefix)
 *   token.encoded      → MQTT password
 *   unencoded.mqtt_ws  → WebSocket URL (e.g. wss://my.farmbot.io:3002/ws)
 *
 * Topics:
 *   bot/<device_id>/status        ← real-time position + state (subscribe)
 *   bot/<device_id>/from_clients  → commands as Celery Script JSON (publish)
 */

import mqtt, { type MqttClient } from 'mqtt'
import type { AuthState } from './auth'
import type { Position } from '@/types'

export type MqttStatus = 'connecting' | 'online' | 'offline'

type PositionListener = (pos: Position) => void
type StatusListener = (status: MqttStatus) => void

let client: MqttClient | null = null
let deviceId = ''

export function connectMQTT(
  auth: AuthState,
  onPositionChange: PositionListener,
  onStatusChange: StatusListener,
): void {
  if (client) {
    client.end(true)
    client = null
  }

  deviceId = auth.token.unencoded.bot

  const thisClient = mqtt.connect(auth.token.unencoded.mqtt_ws, {
    username: auth.token.unencoded.bot,
    password: auth.token.encoded,
    clientId: `farmbot-dashboard-${Date.now()}`,
    clean: true,
  })
  client = thisClient

  onStatusChange('connecting')

  // Each handler checks `client !== thisClient` so stale events from a
  // superseded connection (React StrictMode double-mount, manual reconnect)
  // never update state after a newer client takes over.
  thisClient.on('connect', () => {
    if (client !== thisClient) return
    onStatusChange('online')
    thisClient.subscribe(`bot/${deviceId}/status`)
    // Tap the firmware log stream — printed to the browser console so we can
    // see what the bot actually executes (write_pin, mount_tool errors, etc.).
    thisClient.subscribe(`bot/${deviceId}/logs`)
  })

  thisClient.on('offline', () => { if (client === thisClient) onStatusChange('offline') })
  thisClient.on('error',   () => { if (client === thisClient) onStatusChange('offline') })
  thisClient.on('close',   () => { if (client === thisClient) onStatusChange('offline') })

  thisClient.on('message', (topic, payload) => {
    if (client !== thisClient) return
    if (topic === `bot/${deviceId}/logs`) {
      let message = payload.toString()
      let type = 'log'
      try {
        const log = JSON.parse(payload.toString()) as { message?: string; type?: string }
        message = log.message ?? message
        type = log.type ?? type
      } catch { /* not JSON — use raw */ }
      console.log(`[farmbot:${type}]`, message)
      // Let the UI react to firmware logs (e.g. soil moisture readings).
      window.dispatchEvent(new CustomEvent('farmbot:log', { detail: { type, message } }))
      return
    }
    try {
      const msg = JSON.parse(payload.toString()) as {
        location_data?: { position?: { x: number; y: number; z: number } }
      }
      const pos = msg.location_data?.position
      if (pos) onPositionChange({ x: pos.x, y: pos.y, z: pos.z })
    } catch {
      // malformed message — ignore
    }
  })
}

export function disconnectMQTT(): void {
  client?.end(true)
  client = null
}

/** Returns false if we're not connected to the broker (nothing was sent). */
function publish(payload: unknown): boolean {
  if (!client || !client.connected || !deviceId) return false
  client.publish(`bot/${deviceId}/from_clients`, JSON.stringify(payload))
  return true
}

export function isConnected(): boolean {
  return !!client?.connected
}

export function mqttJog(axis: 'x' | 'y' | 'z', delta: number): boolean {
  const args = { x: 0, y: 0, z: 0, speed: 100, [axis]: delta }
  return publish({
    kind: 'rpc_request',
    args: { label: `jog-${Date.now()}` },
    body: [{ kind: 'move_relative', args }],
  })
}

export function mqttMoveTo(pos: Position): boolean {
  return publish({
    kind: 'rpc_request',
    args: { label: `move-${Date.now()}` },
    body: [{
      kind: 'move_absolute',
      args: {
        location: { kind: 'coordinate', args: { x: pos.x, y: pos.y, z: pos.z } },
        offset: { kind: 'coordinate', args: { x: 0, y: 0, z: 0 } },
        speed: 100,
      },
    }],
  })
}

export function mqttSendHome(): boolean {
  return publish({
    kind: 'rpc_request',
    args: { label: `home-${Date.now()}` },
    body: [{ kind: 'find_home', args: { axis: 'all', speed: 100 } }],
  })
}

export function mqttEStop(): boolean {
  return publish({ kind: 'emergency_stop', args: {} })
}

export function mqttWritePin(pin: number, value: 0 | 1): boolean {
  return publish({
    kind: 'rpc_request',
    args: { label: `pin-${pin}-${value}-${Date.now()}` },
    body: [{ kind: 'write_pin', args: { pin_number: pin, pin_value: value, pin_mode: 0 } }],
  })
}

/** Run an arbitrary Lua snippet on the bot — FarmBot OS executes it. */
export function mqttRunLua(lua: string): boolean {
  return publish({
    kind: 'rpc_request',
    args: { label: `lua-${Date.now()}` },
    body: [{ kind: 'lua', args: { lua } }],
  })
}

/**
 * Mount a physical tool from its slot. Delegates the pick-up maneuver
 * (approach → lower → slide to engage magnets → verify) to FarmBot OS,
 * which knows each slot's coordinates and pull direction.
 * `toolName` must match the tool name in the FarmBot Tools list exactly.
 */
export function mqttMountTool(toolName: string): boolean {
  return mqttRunLua(`mount_tool("${toolName}")`)
}

/** Return the currently mounted tool to its slot. */
export function mqttDismountTool(): boolean {
  return mqttRunLua('dismount_tool()')
}

/**
 * Mount the seeder, pick one seed from the seed source with the vacuum, carry
 * it to the planting position, and release it — mirroring the water flow.
 * Travels at z=0 (raised) between points so it doesn't drag.
 */
export function mqttMountAndSeed(
  srcX: number, srcY: number, srcZ: number,
  plantX: number, plantY: number, plantZ: number,
  vacuumPin: number,
  exitDx: number, lift: number,
): boolean {
  return mqttRunLua([
    'mount_tool("Seeder")',
    'local p = get_position()',
    // ① slide X− to clear the holder, then ② lift Z
    `move_absolute(p.x - ${exitDx}, p.y, p.z)`,            // ① X−
    `move_absolute(p.x - ${exitDx}, p.y, p.z + ${lift})`,  // ② Z up
    // ── go to the seed bin: X, then Y, then Z down ──
    `move_absolute(${srcX}, p.y, p.z + ${lift})`,          // X
    `move_absolute(${srcX}, ${srcY}, p.z + ${lift})`,      // Y
    `move_absolute(${srcX}, ${srcY}, ${srcZ})`,            // Z down into the bin
    `write_pin(${vacuumPin}, "digital", 1)`,               // vacuum ON (grip seed)
    // ── lift with the seed, then go to the plant: X, Y, Z down ──
    `move_absolute(${srcX}, ${srcY}, ${srcZ} + ${lift})`,      // Z up
    `move_absolute(${plantX}, ${srcY}, ${srcZ} + ${lift})`,    // X
    `move_absolute(${plantX}, ${plantY}, ${srcZ} + ${lift})`,  // Y
    `move_absolute(${plantX}, ${plantY}, ${plantZ})`,      // Z down into the soil
    `write_pin(${vacuumPin}, "digital", 0)`,               // vacuum OFF (drop seed)
    // stay here — no final raise
  ].join('\n'))
}

/**
 * Return the seeder to its holder with explicit moves (no `dismount_tool`,
 * which errors when tool verification is off): raise Z, then Y, then X to the
 * holder, then lower to seat.
 */
/**
 * Return a tool to its holder: Z to the holder depth first, then Y, then X to
 * seat it, then lift to clear. Used by the seeder and the soil sensor.
 */
export function mqttReturnToHolder(holderX: number, holderY: number, holderZ: number, lift: number): boolean {
  return mqttRunLua([
    'local p = get_position()',
    `move_absolute(p.x, p.y, ${holderZ})`,               // ① Z to the holder depth first
    `move_absolute(p.x, ${holderY}, ${holderZ})`,        // ② Y to holder
    `move_absolute(${holderX}, ${holderY}, ${holderZ})`, // ③ X to holder (seated)
    `move_absolute(${holderX}, ${holderY}, ${holderZ} + ${lift})`, // ④ lift up to clear
  ].join('\n'))
}

/**
 * Mount the soil sensor, carry it to the measurement spot, dip into the soil,
 * read the moisture pin (analog), and report it back via a log message and a
 * saved sensor reading. Mirrors the seeder's extract → lift → travel motion.
 */
export function mqttMountAndProbe(
  mx: number, my: number, mz: number,
  sensorPin: number,
  exitDx: number, lift: number,
): boolean {
  return mqttRunLua([
    'mount_tool("Soil Sensor")',
    'local p = get_position()',
    `move_absolute(p.x - ${exitDx}, p.y, p.z)`,           // ① X− clear holder
    `move_absolute(p.x - ${exitDx}, p.y, p.z + ${lift})`, // ② Z up
    `move_absolute(${mx}, p.y, p.z + ${lift})`,           // X to the spot
    `move_absolute(${mx}, ${my}, p.z + ${lift})`,         // Y to the spot
    `move_absolute(${mx}, ${my}, ${mz})`,                 // Z down into the soil
    `local moisture = read_pin(${sensorPin}, "analog")`,  // read the sensor
    'send_message("info", "Soil moisture: " .. moisture)',// report the reading
    `move_absolute(${mx}, ${my}, ${mz} + ${lift})`,       // Z up out of the soil
  ].join('\n'))
}

/**
 * Mount the watering nozzle, move to the working position, then open the
 * valve. The travel is split into one-axis-at-a-time moves (X, then Y, then Z)
 * so the gantry doesn't lift in a sudden diagonal right after grabbing the
 * tool. Water flows only once in place, and stays on until
 * `mqttStopAndDismount` is called.
 */
export function mqttMountAndWater(x: number, y: number, z: number): boolean {
  return mqttRunLua([
    'mount_tool("Watering Nozzle")',
    'local p = get_position()',
    `move_absolute(${x}, p.y, p.z)`,   // X first
    `move_absolute(${x}, ${y}, p.z)`,  // then Y
    `move_absolute(${x}, ${y}, ${z})`, // then Z
    'write_pin(8, "digital", 1)',
  ].join('\n'))
}

/**
 * Close the valve, then return the nozzle to its slot.
 * Tool verification is off, so `mount_tool` never recorded the nozzle as
 * mounted — `dismount_tool` would otherwise error with "No tool is mounted".
 * So we look up the Watering Nozzle's id and set `mounted_tool_id` ourselves
 * first, then dismount.
 */
export function mqttStopAndDismount(): boolean {
  return mqttRunLua([
    'write_pin(8, "digital", 0)',          // stop water
    'local p = get_position()',
    'move_absolute(p.x, p.y, -376)',       // ① Z to -376 first (no X/Y yet, no raise to 0)
    'move_absolute(p.x, 450, -376)',       // ② then Y to the holder
    'move_absolute(2183.2, 450, -376)',    // ③ then X to the holder
    'move_absolute(2183.2, 450, 0)',       // ④ then raise Z to 0
  ].join('\n'))
}

export function mqttTakePhoto(): boolean {
  return publish({
    kind: 'rpc_request',
    args: { label: `photo-${Date.now()}` },
    body: [{ kind: 'take_photo', args: {} }],
  })
}

/**
 * Sweep the gantry across a list of positions, taking a photo at each.
 * Sent as a single rpc_request whose body FarmBot OS executes in order:
 * move → photo → move → photo → …
 */
export function mqttScanBed(positions: Position[]): boolean {
  const body = positions.flatMap(p => [
    {
      kind: 'move_absolute',
      args: {
        location: { kind: 'coordinate', args: { x: p.x, y: p.y, z: p.z } },
        offset: { kind: 'coordinate', args: { x: 0, y: 0, z: 0 } },
        speed: 100,
      },
    },
    { kind: 'take_photo', args: {} },
  ])
  return publish({ kind: 'rpc_request', args: { label: `scan-${Date.now()}` }, body })
}
