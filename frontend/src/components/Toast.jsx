import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

const ToastContext = createContext(null);

const TOAST_STYLES = {
  success: {
    icon: CheckCircle2,
    classes: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    iconClass: 'text-emerald-500',
  },
  error: {
    icon: XCircle,
    classes: 'border-red-200 bg-red-50 text-red-800',
    iconClass: 'text-red-500',
  },
  info: {
    icon: Info,
    classes: 'border-sky-200 bg-sky-50 text-sky-800',
    iconClass: 'text-sky-500',
  },
};

function ToastItem({ toast, onDismiss }) {
  const { icon: Icon, classes, iconClass } = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-sm ${classes}`}>
      <Icon className={`h-5 w-5 shrink-0 ${iconClass}`} />
      <p className="text-sm font-medium">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="ml-2 rounded p-0.5 opacity-60 transition hover:opacity-100"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type, message) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((current) => [...current, { id, type, message }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const toast = useMemo(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}