"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import AvatarNodos, { AVATAR_ICONO_COMPONENTE } from "@/components/nodos/AvatarNodos";
import { AVATAR_COLORES, AVATAR_FONDO, AVATAR_ICONOS, avatarTexto, leerAvatar, type AvatarColor, type AvatarIcono } from "@/lib/nodos/avatares";

/** Elegir el avatar de la cuenta: un ícono de línea y un color de la marca. */
export default function AvatarSelector({ valor, onGuardar }: { valor: string | null; onGuardar: (v: string | null) => Promise<boolean> }) {
  const actual = leerAvatar(valor);
  const [icono, setIcono] = useState<AvatarIcono>(actual?.icono ?? "usuario");
  const [color, setColor] = useState<AvatarColor>(actual?.color ?? "musgo");
  const [guardando, setGuardando] = useState(false);
  const elegido = avatarTexto({ icono, color });
  const cambio = elegido !== valor;

  async function guardar(v: string | null) {
    setGuardando(true);
    await onGuardar(v);
    setGuardando(false);
  }

  return (
    <section className="card space-y-4" aria-labelledby="avatar-titulo">
      <div className="flex items-center gap-4">
        <AvatarNodos valor={elegido} size={56} />
        <div className="min-w-0">
          <h3 id="avatar-titulo">Tu avatar</h3>
          <p className="text-sm text-carbon/60">Es lo que se ve en el menú de tu cuenta y en los rankings de Práctica.</p>
        </div>
      </div>

      <div>
        <p className="field-label">Ícono</p>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8" role="radiogroup" aria-label="Ícono del avatar">
          {AVATAR_ICONOS.map((k) => {
            const Icono = AVATAR_ICONO_COMPONENTE[k];
            const activo = k === icono;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={activo}
                aria-label={k}
                onClick={() => setIcono(k)}
                className={`flex aspect-square items-center justify-center rounded-md border transition ${
                  activo ? "border-cobre bg-cobre/10 text-cobre-hover" : "bg-white text-musgo hover:border-cobre"
                }`}
                style={activo ? undefined : { borderColor: "var(--line)" }}
              >
                <Icono size={20} strokeWidth={1.8} />
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="field-label">Color</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color del avatar">
          {AVATAR_COLORES.map((c) => {
            const activo = c === color;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={activo}
                aria-label={AVATAR_FONDO[c].nombre}
                title={AVATAR_FONDO[c].nombre}
                onClick={() => setColor(c)}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition ${activo ? "ring-2 ring-cobre ring-offset-2" : ""}`}
                style={{ background: AVATAR_FONDO[c].fondo, color: AVATAR_FONDO[c].trazo, boxShadow: c === "marfil" ? "inset 0 0 0 1px rgba(30,47,37,0.2)" : undefined }}
              >
                {activo && <Check size={16} />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" disabled={!cambio || guardando} onClick={() => guardar(elegido)}>
          {guardando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Guardar avatar
        </button>
        {valor && (
          <button type="button" className="btn btn-ghost" disabled={guardando} onClick={() => guardar(null)}>
            Quitar avatar
          </button>
        )}
      </div>
    </section>
  );
}
