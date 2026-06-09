import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Position } from '@/types'
import type { MqttStatus } from '@/api/mqtt'
import { connectMQTT, disconnectMQTT } from '@/api/mqtt'
import { loadAuth } from '@/api/auth'

interface PositionContextValue {
  position: Position
  mqttStatus: MqttStatus
  reconnect: () => void
}

const PositionContext = createContext<PositionContextValue>({
  position: { x: 0, y: 0, z: 0 },
  mqttStatus: 'offline',
  reconnect: () => {},
})

export function PositionProvider({ children }: { children: React.ReactNode }) {
  const [position, setPosition] = useState<Position>({ x: 0, y: 0, z: 0 })
  const [mqttStatus, setMqttStatus] = useState<MqttStatus>('offline')

  const reconnect = useCallback(() => {
    const auth = loadAuth()
    if (!auth) return
    connectMQTT(auth, setPosition, setMqttStatus)
  }, [])

  useEffect(() => {
    reconnect()
    return () => disconnectMQTT()
  }, [reconnect])

  return (
    <PositionContext.Provider value={{ position, mqttStatus, reconnect }}>
      {children}
    </PositionContext.Provider>
  )
}

export function usePosition() {
  return useContext(PositionContext)
}
