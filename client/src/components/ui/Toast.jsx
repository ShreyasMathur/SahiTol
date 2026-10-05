import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon.jsx';

const ToastContext = createContext(null);

const TONES = {
  success: { icon: 'check', cls: 'border-green-200 bg-white', iconCls: 'bg-green-100 text-green-700' },
  error: { icon: 'alert', cls: 'border-red-200 bg-white', iconCls: 'bg-red-100 text-red-700' },
  info: { icon: 'info', cls: 'border-slate-200 bg-white', iconCls: 'bg-brand-100 text-brand-700' },
};

/** Transient confirmations ("Saved", "Approved") in the bottom-right corner. */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (tone, title, description) => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-3), { id, tone, title, description }]);
      setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000);
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (title, description) => push('success', title, description),
      error: (title, description) => push('error', title, description),
      info: (title, description) => push('info', title, description),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6">
        {toasts.map((t) => {
          const tone = TONES[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className={`toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border p-3 shadow-lg ${tone.cls}`}
            >
              <span className={`mt-0.5 rounded-full p-1 ${tone.iconCls}`}>
                <Icon name={tone.icon} className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium text-slate-900">{t.title}</p>
                {t.description && <p className="mt-0.5 text-slate-600">{t.description}</p>}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} className="rounded p-0.5 text-slate-400 hover:text-slate-700" aria-label="Dismiss">
                <Icon name="x" className="h-4 w-4" />
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
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
