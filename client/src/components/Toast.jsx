import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import clsx from 'clsx';

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warn: AlertTriangle,
  info: Info,
};
const COLORS = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  error: 'bg-red-50 border-red-200 text-red-900',
  warn: 'bg-amber-50 border-amber-200 text-amber-900',
  info: 'bg-ink-50 border-ink-200 text-ink-900',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const push = useCallback((type, message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((ts) => [...ts, { id, type, message, ...opts }]);
    setTimeout(() => dismiss(id), opts.duration ?? 4500);
  }, [dismiss]);

  const value = {
    success: (m, o) => push('success', m, o),
    error:   (m, o) => push('error', m, o),
    warn:    (m, o) => push('warn', m, o),
    info:    (m, o) => push('info', m, o),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div
              key={t.id}
              className={clsx('flex items-start gap-3 rounded-lg border px-4 py-3 shadow-sm pointer-events-auto animate-fade-in', COLORS[t.type])}
              role="status"
            >
              <Icon className="shrink-0 mt-0.5" size={18} />
              <div className="flex-1 text-sm">{t.message}</div>
              <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-60 hover:opacity-100">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
