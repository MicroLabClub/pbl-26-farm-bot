export type ConnectionStatus = 'connected' | 'degraded' | 'offline'

export interface Position {
  x: number
  y: number
  z: number
}

export interface SensorReading {
  cellId: string
  moisture: number   // 0–100 %
  temperature: number
  timestamp: string
}

export type CropStatus = 'planted' | 'growing' | 'ready' | 'harvested'
export type ToolType = 'water' | 'seeder' | 'sensor' | 'camera'

export interface CropCell {
  id: string          // "3-5" → col 3, row 5
  col: number
  row: number
  cropName: string
  variety: string
  plantedAt: string
  growthStageDays: number
  totalDays: number
  status: CropStatus
  lastWatered: string
  wateringCount: number
  totalWaterMl: number
  healthScore: number // 0–100
  harvestedAt?: string
  yieldGrams?: number
  notes?: string
}

export type TaskAction = 'water' | 'plant' | 'probe' | 'photo' | 'home'
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export interface Task {
  id: string
  action: TaskAction
  position: Position
  scheduledAt: string
  executedAt?: string
  status: TaskStatus
  cellId?: string
  durationMs?: number
  notes?: string
}

export interface Alert {
  id: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  timestamp: string
  acknowledged: boolean
}

export interface BedImage {
  id: string
  capturedAt: string
  url: string
  x: number
  y: number
  z: number
}

export interface SystemStatus {
  connection: ConnectionStatus
  position: Position
  activeTask: Task | null
  tool: ToolType
  motorTemperature: number
  uptime: number // seconds
  lastHeartbeat: string
}
