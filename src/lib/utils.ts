import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  return `${h}h ${m}m`
}

export function moistureColor(m: number): string {
  if (m >= 70) return '#4a7c2c'
  if (m >= 45) return '#c9a032'
  return '#b34a3a'
}

export function healthColor(s: number): string {
  if (s >= 80) return '#4a7c2c'
  if (s >= 60) return '#c9a032'
  return '#b34a3a'
}

export function daysLeft(plantedAt: string, totalDays: number): number {
  const planted = new Date(plantedAt).getTime()
  const elapsed = Math.floor((Date.now() - planted) / 86400000)
  return Math.max(0, totalDays - elapsed)
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function formatRelative(iso: string | undefined | null): string {
  if (!iso) return '—'
  const ts = new Date(iso).getTime()
  if (isNaN(ts)) return '—'
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}
