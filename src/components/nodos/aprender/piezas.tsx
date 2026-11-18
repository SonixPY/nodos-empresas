"use client";

import type { ReactNode } from "react";
import { BookOpen, Briefcase, Coffee, Laptop, Palette, ShoppingCart, User, Wrench, type LucideIcon } from "lucide-react";
import type { AvatarId, CasoReal, LeccionDesbloqueada, TipoEvento, TipoSituacion } from "@/lib/nodos/aprender";
import { AVISO_TEXTO } from "@/lib/nodos/aprender";

/** Guaraníes del juego: "Gs. 1.240.000" (con signo si se pide). */
export function gs(n: number, signo = false): string {
  const s = Math.abs(Math.round(n)).toLocaleString("es-PY");
  const pre = n < 0 ? "−" : signo && n > 0 ? "+" : "";
  return `${pre}Gs. ${s}`;
}

export const COLOR_POSTIT: Record<TipoSituacion, string> = {
  situacion: "#F2EEE6",
  oportunidad: "#E8C9AE",
  vencimiento: "#CFD9CC",
};

export const ETIQUETA_TIPO: Record<TipoEvento, string> = {
  ingreso: "Ingreso",
  gasto: "Gasto",
  vencimiento: "Vencimiento",
  situacion: "Situación",
  oportunidad: "Oportunidad",
};

/** Colores de los chips del calendario (texto con contraste AA). */
export const CHIP: Record<TipoEvento, string> = {
  ingreso: "bg-bosque text-marfil",
  gasto: "bg-carbon text-marfil",
  situacion: "bg-cobre text-musgo",
  oportunidad: "bg-cobre text-musgo",
  vencimiento: "bg-cobre-hover text-marfil",
};

/** Isotipo oficial de NODOS sobre su placa (el personaje NODO). */
export function NodoIcono({ size = 40 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/isotipo.svg" alt="" width={size} height={size} className="shrink-0 rounded-lg" />;
}

const ICONO_AVATAR: Record<AvatarId, LucideIcon> = {
  persona: User,
  maletin: Briefcase,
  laptop: Laptop,
  herramientas: Wrench,
  paleta: Palette,
  libro: BookOpen,
  carrito: ShoppingCart,
  cafe: Coffee,
};

/** Avatar del personaje: ícono de línea sobre una placa. */
export function AvatarIcono({ avatar, size = 40 }: { avatar: AvatarId; size?: number }) {
  const Icono = ICONO_AVATAR[avatar] ?? User;
  return (
    <span aria-hidden className="flex shrink-0 items-center justify-center rounded-lg bg-bosque text-marfil" style={{ width: size, height: size }}>
      <Icono size={Math.round(size * 0.5)} strokeWidth={1.8} />
    </span>
  );
}

export function Aviso({ tipo = "inversion", className = "" }: { tipo?: "inversion" | "legal"; className?: string }) {
  return <p className={`text-xs leading-snug text-carbon/60 ${className}`}>{AVISO_TEXTO[tipo]}</p>;
}

export function CasoRealBloque({ caso }: { caso: CasoReal }) {
  const [anio, mes] = caso.fecha.split("-");
  const fecha = new Date(Number(anio), Number(mes) - 1, 1).toLocaleDateString("es-PY", { month: "long", year: "numeric" });
  return (
    <div className="rounded-lg bg-bosque px-4 py-3 text-sm leading-relaxed text-marfil">
      <p>
        <strong className="font-display">Caso real · {caso.titulo}</strong> <span className="text-marfil/80">({fecha})</span>
      </p>
      <p className="mt-1">{caso.resumen}</p>
      <p className="mt-2 text-xs text-marfil/80">Fuente: {caso.fuente}</p>
    </div>
  );
}

/** La lección de NODO al cerrarse una situación. */
export function LeccionNodo({ l, aviso = "inversion" }: { l: LeccionDesbloqueada; aviso?: "inversion" | "legal" }) {
  return (
    <article className="rounded-2xl border-2 border-cobre bg-musgo p-5 text-marfil shadow-lg sm:p-6">
      <div className="flex items-center gap-3">
        <NodoIcono />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-marfil/75">NODO · Lección</p>
          <h3 className="!text-marfil">{l.titulo}</h3>
        </div>
      </div>
      <p className="mt-4 rounded-md bg-marfil/10 px-3 py-2 text-sm">{l.resultado}</p>
      <p className="mt-3 text-[15px] leading-relaxed">{l.nodo}</p>
      <ol className="mt-3 space-y-1.5 text-sm leading-relaxed">
        {l.reglas.map((r, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-display font-bold text-cobre">{i + 1}.</span>
            <span>{r}</span>
          </li>
        ))}
      </ol>
      {l.casoReal && (
        <div className="mt-4">
          <CasoRealBloque caso={l.casoReal} />
        </div>
      )}
      <p className="mt-4 text-xs text-marfil/75">{AVISO_TEXTO[aviso]}</p>
    </article>
  );
}

export function Banda({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-[var(--line)] bg-[var(--superficie)] px-4 py-3 text-sm">{children}</div>;
}
