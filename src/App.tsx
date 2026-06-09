import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PositionProvider } from '@/context/PositionContext'
import { ToastProvider } from '@/context/ToastContext'
import { TaskScheduler } from '@/context/TaskScheduler'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import ControlPanel from '@/pages/ControlPanel'
import FarmPlanner from '@/pages/FarmPlanner'
import TaskManager from '@/pages/TaskManager'
import Analytics from '@/pages/Analytics'
import FarmToFork from '@/pages/FarmToFork'
import Settings from '@/pages/Settings'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5000 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
      <PositionProvider>
        <TaskScheduler />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="control" element={<ControlPanel />} />
              <Route path="planner" element={<FarmPlanner />} />
              <Route path="tasks" element={<TaskManager />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="farm-to-fork" element={<FarmToFork />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </PositionProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}
