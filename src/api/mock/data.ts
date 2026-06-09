import type { CropCell, Task, Alert, SensorReading, SystemStatus } from '@/types'

export const mockSystemStatus: SystemStatus = {
  connection: 'connected',
  position: { x: 342, y: 178, z: 0 },
  activeTask: null,
  tool: 'water',
  motorTemperature: 38,
  uptime: 187200,
  lastHeartbeat: new Date().toISOString(),
}

export const mockCrops: CropCell[] = [
  {
    id: '0-0', col: 0, row: 0,
    cropName: 'Tomato', variety: 'Cherry Roma',
    plantedAt: '2026-03-01', growthStageDays: 55, totalDays: 90,
    status: 'growing', lastWatered: '2026-04-25T08:00:00Z',
    wateringCount: 38, totalWaterMl: 3800, healthScore: 88,
  },
  {
    id: '1-0', col: 1, row: 0,
    cropName: 'Lettuce', variety: 'Butterhead',
    plantedAt: '2026-03-28', growthStageDays: 28, totalDays: 45,
    status: 'ready', lastWatered: '2026-04-25T08:10:00Z',
    wateringCount: 22, totalWaterMl: 1540, healthScore: 95,
  },
  {
    id: '2-0', col: 2, row: 0,
    cropName: 'Carrot', variety: 'Nantes',
    plantedAt: '2026-03-10', growthStageDays: 46, totalDays: 75,
    status: 'growing', lastWatered: '2026-04-24T19:00:00Z',
    wateringCount: 30, totalWaterMl: 2100, healthScore: 76,
  },
  {
    id: '3-0', col: 3, row: 0,
    cropName: 'Radish', variety: 'Cherry Belle',
    plantedAt: '2026-04-10', growthStageDays: 15, totalDays: 28,
    status: 'growing', lastWatered: '2026-04-25T07:45:00Z',
    wateringCount: 14, totalWaterMl: 700, healthScore: 91,
  },
  {
    id: '0-1', col: 0, row: 1,
    cropName: 'Basil', variety: 'Genovese',
    plantedAt: '2026-04-01', growthStageDays: 24, totalDays: 60,
    status: 'growing', lastWatered: '2026-04-25T08:05:00Z',
    wateringCount: 20, totalWaterMl: 1000, healthScore: 82,
  },
  {
    id: '1-1', col: 1, row: 1,
    cropName: 'Spinach', variety: 'Bloomsdale',
    plantedAt: '2026-03-20', growthStageDays: 36, totalDays: 50,
    status: 'ready', lastWatered: '2026-04-24T20:00:00Z',
    wateringCount: 28, totalWaterMl: 1960, healthScore: 89,
  },
  {
    id: '2-1', col: 2, row: 1,
    cropName: 'Pepper', variety: 'Bell Red',
    plantedAt: '2026-02-15', growthStageDays: 69, totalDays: 120,
    status: 'growing', lastWatered: '2026-04-25T08:15:00Z',
    wateringCount: 55, totalWaterMl: 6600, healthScore: 71,
  },
  {
    id: '3-1', col: 3, row: 1,
    cropName: 'Kale', variety: 'Lacinato',
    plantedAt: '2026-03-15', growthStageDays: 41, totalDays: 70,
    status: 'growing', lastWatered: '2026-04-24T18:00:00Z',
    wateringCount: 32, totalWaterMl: 2880, healthScore: 85,
  },
  {
    id: '0-2', col: 0, row: 2,
    cropName: 'Tomato', variety: 'San Marzano',
    plantedAt: '2026-03-05', growthStageDays: 51, totalDays: 90,
    status: 'growing', lastWatered: '2026-04-25T08:00:00Z',
    wateringCount: 41, totalWaterMl: 4100, healthScore: 79,
  },
  {
    id: '1-2', col: 1, row: 2,
    cropName: 'Cucumber', variety: 'Persian',
    plantedAt: '2026-04-05', growthStageDays: 20, totalDays: 55,
    status: 'growing', lastWatered: '2026-04-25T08:20:00Z',
    wateringCount: 18, totalWaterMl: 1980, healthScore: 93,
  },
  {
    id: '2-2', col: 2, row: 2,
    cropName: 'Lettuce', variety: 'Romaine',
    plantedAt: '2026-04-15', growthStageDays: 10, totalDays: 45,
    status: 'planted', lastWatered: '2026-04-24T21:00:00Z',
    wateringCount: 8, totalWaterMl: 400, healthScore: 97,
  },
  {
    id: '3-2', col: 3, row: 2,
    cropName: 'Zucchini', variety: 'Black Beauty',
    plantedAt: '2026-04-20', growthStageDays: 5, totalDays: 60,
    status: 'planted', lastWatered: '2026-04-25T07:30:00Z',
    wateringCount: 4, totalWaterMl: 240, healthScore: 100,
  },
  // Harvested crops
  {
    id: '0-3', col: 0, row: 3,
    cropName: 'Radish', variety: 'French Breakfast',
    plantedAt: '2026-02-10', growthStageDays: 28, totalDays: 28,
    status: 'harvested', lastWatered: '2026-03-08T12:00:00Z',
    wateringCount: 22, totalWaterMl: 1100, healthScore: 94,
    harvestedAt: '2026-03-10', yieldGrams: 340,
  },
  {
    id: '1-3', col: 1, row: 3,
    cropName: 'Spinach', variety: 'Savoy',
    plantedAt: '2026-02-01', growthStageDays: 50, totalDays: 50,
    status: 'harvested', lastWatered: '2026-03-20T14:00:00Z',
    wateringCount: 38, totalWaterMl: 2660, healthScore: 87,
    harvestedAt: '2026-03-23', yieldGrams: 520,
  },
]

export const mockTasks: Task[] = [
  {
    id: 't1', action: 'water', status: 'completed',
    position: { x: 0, y: 0, z: 0 }, cellId: '0-0',
    scheduledAt: '2026-04-25T08:00:00Z', executedAt: '2026-04-25T08:00:03Z',
    durationMs: 4200,
  },
  {
    id: 't2', action: 'probe', status: 'completed',
    position: { x: 120, y: 0, z: -80 }, cellId: '1-0',
    scheduledAt: '2026-04-25T08:10:00Z', executedAt: '2026-04-25T08:10:02Z',
    durationMs: 6800,
  },
  {
    id: 't3', action: 'water', status: 'running',
    position: { x: 240, y: 0, z: 0 }, cellId: '2-0',
    scheduledAt: '2026-04-25T08:20:00Z',
  },
  {
    id: 't4', action: 'probe', status: 'pending',
    position: { x: 360, y: 0, z: -80 }, cellId: '3-0',
    scheduledAt: '2026-04-25T08:30:00Z',
  },
  {
    id: 't5', action: 'water', status: 'pending',
    position: { x: 0, y: 120, z: 0 }, cellId: '0-1',
    scheduledAt: '2026-04-25T08:40:00Z',
  },
  {
    id: 't6', action: 'home', status: 'pending',
    position: { x: 0, y: 0, z: 0 },
    scheduledAt: '2026-04-25T09:00:00Z',
  },
]

export const mockAlerts: Alert[] = [
  {
    id: 'a1', severity: 'info',
    message: 'Re-homing cycle completed successfully.',
    timestamp: '2026-04-25T06:00:00Z', acknowledged: true,
  },
  {
    id: 'a2', severity: 'warning',
    message: 'Cell 2-1 soil moisture below threshold (32%). Watering scheduled.',
    timestamp: '2026-04-25T07:45:00Z', acknowledged: false,
  },
  {
    id: 'a3', severity: 'info',
    message: 'Lettuce (Butterhead) at 1-0 is ready to harvest.',
    timestamp: '2026-04-25T08:00:00Z', acknowledged: false,
  },
]

export const mockSensorReadings: SensorReading[] = [
  { cellId: '0-0', moisture: 68, temperature: 22.4, timestamp: '2026-04-25T08:00:00Z' },
  { cellId: '1-0', moisture: 74, temperature: 21.8, timestamp: '2026-04-25T08:10:00Z' },
  { cellId: '2-0', moisture: 45, temperature: 23.1, timestamp: '2026-04-24T19:00:00Z' },
  { cellId: '3-0', moisture: 81, temperature: 22.0, timestamp: '2026-04-25T07:45:00Z' },
  { cellId: '0-1', moisture: 59, temperature: 22.6, timestamp: '2026-04-25T08:05:00Z' },
  { cellId: '1-1', moisture: 52, temperature: 21.5, timestamp: '2026-04-24T20:00:00Z' },
  { cellId: '2-1', moisture: 32, temperature: 23.8, timestamp: '2026-04-25T08:15:00Z' },
  { cellId: '3-1', moisture: 61, temperature: 22.2, timestamp: '2026-04-24T18:00:00Z' },
  { cellId: '0-2', moisture: 70, temperature: 22.4, timestamp: '2026-04-25T08:00:00Z' },
  { cellId: '1-2', moisture: 77, temperature: 21.9, timestamp: '2026-04-25T08:20:00Z' },
  { cellId: '2-2', moisture: 85, temperature: 21.6, timestamp: '2026-04-24T21:00:00Z' },
  { cellId: '3-2', moisture: 90, temperature: 21.3, timestamp: '2026-04-25T07:30:00Z' },
]

// Historical moisture data per cell for analytics (last 7 days)
export function getMockMoistureHistory(cellId: string) {
  const base = mockSensorReadings.find(r => r.cellId === cellId)?.moisture ?? 60
  return Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    moisture: Math.max(20, Math.min(100, base + Math.round((Math.random() - 0.5) * 20))),
  }))
}
