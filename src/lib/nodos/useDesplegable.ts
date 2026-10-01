"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";

const DEMORA_CIERRE_MS = 180;

/**
 * Lógica común de los desplegables del header (selector de páginas y menú de
 * cuenta): abre con click/tap o teclado (Enter, Espacio, flecha abajo), cierra
 * con Escape, tocando afuera o al sacar el foco, y opcionalmente abre al pasar
 * el mouse (con una pequeña demora de cierre para poder entrar al panel).
 */
export function useDesplegable({ hover = false }: { hover?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  // "Fijado": se abrió con click o teclado, así que no se cierra al salir el mouse.
  const fijado = useRef(false);
  const porHover = useRef(false);
  const porTeclado = useRef(false);

  const limpiarTimer = () => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = undefined;
  };

  const cerrar = useCallback((devolverFoco = false) => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = undefined;
    fijado.current = false;
    porHover.current = false;
    setOpen(false);
    if (devolverFoco) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) cerrar();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cerrar(true);
        return;
      }
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && rootRef.current?.contains(document.activeElement)) {
        const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
        if (!items.length) return;
        e.preventDefault();
        const i = items.indexOf(document.activeElement as HTMLElement);
        const siguiente = e.key === "ArrowDown" ? (i + 1) % items.length : i <= 0 ? items.length - 1 : i - 1;
        items[siguiente].focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, cerrar]);

  // Abierto con teclado: el foco pasa al primer ítem.
  useEffect(() => {
    if (open && porTeclado.current) {
      porTeclado.current = false;
      panelRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    }
  }, [open]);

  useEffect(() => () => limpiarTimer(), []);

  const onTriggerClick = (e: ReactMouseEvent<HTMLButtonElement>) => {
    if (e.detail === 0) porTeclado.current = true;
    if (open && porHover.current && !fijado.current) {
      // Ya estaba abierto por hover: el click lo deja fijo en vez de cerrarlo.
      fijado.current = true;
      porHover.current = false;
      return;
    }
    if (open) {
      cerrar();
    } else {
      fijado.current = true;
      setOpen(true);
    }
  };

  const onTriggerKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" && !open) {
      e.preventDefault();
      porTeclado.current = true;
      fijado.current = true;
      setOpen(true);
    }
  };

  const onPointerEnter = (e: ReactPointerEvent) => {
    if (!hover || e.pointerType !== "mouse") return;
    limpiarTimer();
    if (!open) {
      porHover.current = true;
      setOpen(true);
    }
  };

  const onPointerLeave = (e: ReactPointerEvent) => {
    if (!hover || e.pointerType !== "mouse" || fijado.current) return;
    limpiarTimer();
    timer.current = window.setTimeout(() => {
      porHover.current = false;
      setOpen(false);
    }, DEMORA_CIERRE_MS);
  };

  // Si el foco sale del desplegable (Tab), se cierra.
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    const destino = e.relatedTarget as Node | null;
    if (open && destino && rootRef.current && !rootRef.current.contains(destino)) cerrar();
  };

  // Al elegir un link del panel, se cierra.
  const onPanelClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("a")) cerrar();
  };

  return {
    open,
    cerrar,
    rootRef,
    triggerRef,
    panelRef,
    onTriggerClick,
    onTriggerKeyDown,
    onPointerEnter,
    onPointerLeave,
    onBlur,
    onPanelClick,
  };
}
