import { createContext, useContext, useReducer, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export type ToastVariant = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  variant: ToastVariant
}

type Action =
  | { type: 'push'; toast: Toast }
  | { type: 'pop'; id: number }

let _nextId = 0

function reducer(state: Toast[], action: Action): Toast[] {
  if (action.type === 'push') return [...state, action.toast]
  return state.filter(t => t.id !== action.id)
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = useReducer(reducer, [])

  const toast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = ++_nextId
    dispatch({ type: 'push', toast: { id, message, variant } })
    setTimeout(() => dispatch({ type: 'pop', id }), 3500)
  }, [])

  const variantStyle: Record<ToastVariant, string> = {
    success: 'border-[#4a7c2c]/30 bg-[#f5f1e8] text-[#2d5016]',
    error: 'border-[#b34a3a]/30 bg-[#f5f1e8] text-[#b34a3a]',
    info: 'border-[#3a5a7c]/30 bg-[#f5f1e8] text-[#3a5a7c]',
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 24, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className={`border rounded-sm px-4 py-2.5 text-xs font-mono uppercase tracking-[0.12em] shadow-sm pointer-events-auto ${variantStyle[t.variant]}`}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
