import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export interface EmptyAccion {
  label: string;
  icon?: LucideIcon;
  href?: string;
  onClick?: () => void;
}

function Boton({ accion, primaria }: { accion: EmptyAccion; primaria: boolean }) {
  const cls = `btn ${primaria ? "btn-primary" : "btn-ghost"}`;
  const contenido = (
    <>
      {accion.icon && <accion.icon size={15} />} {accion.label}
    </>
  );
  if (accion.href) {
    return (
      <Link href={accion.href} className={cls}>
        {contenido}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={accion.onClick}>
      {contenido}
    </button>
  );
}

/** Lleva al formulario de la página (que ya está visible) y enfoca su primer campo. */
export function irAFormulario(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  const campo = el.querySelector<HTMLElement>("input:not([type=hidden]):not([disabled]), select, textarea");
  window.setTimeout(() => campo?.focus({ preventScroll: true }), 400);
}

/**
 * Pantalla vacía: ícono de línea, qué va acá (1–2 líneas) y la acción
 * principal. `compacta` para usar dentro de una tarjeta o pestaña.
 */
export default function EmptyState({
  icon: Icon,
  titulo,
  texto,
  accion,
  secundaria,
  compacta = false,
}: {
  icon: LucideIcon;
  titulo: string;
  texto: React.ReactNode;
  accion?: EmptyAccion;
  secundaria?: EmptyAccion;
  compacta?: boolean;
}) {
  return (
    <div
      className={`animate-fade-in flex flex-col items-center rounded-md border border-dashed text-center ${compacta ? "px-4 py-6" : "px-5 py-10"}`}
      style={{ borderColor: "var(--line)", background: "rgba(255,255,255,0.6)" }}
    >
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-full" style={{ background: "rgba(184,115,74,0.1)" }}>
        <Icon size={20} className="text-cobre" strokeWidth={1.75} />
      </span>
      <h3 className="!text-[17px] !leading-6">{titulo}</h3>
      <p className="mt-1 max-w-md text-sm text-carbon/65">{texto}</p>
      {(accion || secundaria) && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {accion && <Boton accion={accion} primaria />}
          {secundaria && <Boton accion={secundaria} primaria={false} />}
        </div>
      )}
    </div>
  );
}
