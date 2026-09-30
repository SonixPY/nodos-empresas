"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
  leaving?: boolean;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICON: Record<ToastKind, string> = {
  success: "✓",
  error: "!",
  info: "i",
};

const COLOR: Record<ToastKind, string> = {
  success: "var(--color-good)",
  error: "var(--color-bad)",
  info: "var(--color-cobre)",
};

/** Proveedor global de notificaciones tipo "toast" — feedback claro y breve
 * para cualquier acción (guardar, borrar, importar), sin bloquear la UI
 * como hace un alert() nativo. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, kind }]);

    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    }, 3200);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2 rounded-sm border bg-white px-4 py-2.5 text-sm shadow-lg ${
              t.leaving ? "toast-exit" : "toast-enter"
            }`}
            style={{ borderColor: "var(--line)" }}
            role="status"
          >
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: COLOR[t.kind] }}
            >
              {ICON[t.kind]}
            </span>
            <span className="text-carbon">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}
