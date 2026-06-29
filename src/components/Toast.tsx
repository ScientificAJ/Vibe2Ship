import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, Info, X, AlertCircle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType, duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const success = useCallback((message: string, duration?: number) => {
    addToast(message, 'success', duration);
  }, [addToast]);

  const error = useCallback((message: string, duration?: number) => {
    addToast(message, 'error', duration);
  }, [addToast]);

  const warning = useCallback((message: string, duration?: number) => {
    addToast(message, 'warning', duration);
  }, [addToast]);

  const info = useCallback((message: string, duration?: number) => {
    addToast(message, 'info', duration);
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ success, error, warning, info, removeToast }}>
      {children}
      <div 
        id="toast-container" 
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        <AnimatePresence>
          {toasts.map((toast) => {
            let bgColor = 'bg-white border-slate-100 text-slate-800';
            let icon = <Info className="w-5 h-5 text-beach-ocean shrink-0" />;
            
            if (toast.type === 'success') {
              bgColor = 'bg-white border-emerald-100 text-slate-800 shadow-[0_4px_16px_rgba(16,185,129,0.08)]';
              icon = <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />;
            } else if (toast.type === 'error') {
              bgColor = 'bg-white border-rose-100 text-slate-800 shadow-[0_4px_16px_rgba(244,63,94,0.08)]';
              icon = <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />;
            } else if (toast.type === 'warning') {
              bgColor = 'bg-white border-amber-100 text-slate-800 shadow-[0_4px_16px_rgba(245,158,11,0.08)]';
              icon = <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
            } else if (toast.type === 'info') {
              bgColor = 'bg-white border-blue-100 text-slate-800 shadow-[0_4px_16px_rgba(59,130,246,0.08)]';
              icon = <Info className="w-5 h-5 text-beach-ocean shrink-0" />;
            }

            return (
              <motion.div
                key={toast.id}
                id={`toast-${toast.id}`}
                layout
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                className={`w-full pointer-events-auto flex items-start gap-3 p-4 rounded-xl border ${bgColor} shadow-lg relative overflow-hidden`}
              >
                {icon}
                <div className="flex-1 text-sm font-medium leading-5">
                  {toast.message}
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded-lg hover:bg-slate-50 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
