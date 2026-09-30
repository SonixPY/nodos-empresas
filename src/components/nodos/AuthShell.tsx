import Link from "next/link";
import { APP_ID } from "@/lib/nodos/app";
import { SITIOS } from "@/lib/nodos/sitios";

/**
 * Marco común de las pantallas de ingreso de NODOS: panel de marca (Musgo)
 * + formulario sobre Marfil. Igual en Finanzas y Empresas.
 */
export default function AuthShell({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
}) {
  const app = SITIOS[APP_ID];
  const otra = SITIOS[APP_ID === "finanzas" ? "empresas" : "finanzas"];
  return (
    <main className="grid min-h-screen grid-cols-1 bg-marfil lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-musgo px-12 py-12 text-marfil lg:flex lg:flex-col">
        <Link href={SITIOS.inicio.url} className="flex items-center gap-3" aria-label="Ir a nodoscompliance.com">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/isotipo.svg" alt="" width={40} height={40} className="rounded-md" />
          <span className="text-lg">
            <span className="wordmark">NODOS</span> <span className="font-display font-normal text-marfil/80">{app.corto}</span>
          </span>
        </Link>
        <div className="my-auto max-w-md">
          <p className="t-caption uppercase tracking-[0.14em] text-cobre">Una cuenta, todo NODOS</p>
          <h2 className="t-display mt-3 !text-[40px] !leading-[46px] !text-marfil">{app.descripcion}</h2>
          <p className="t-body-lg mt-5 text-marfil/75">
            Con el mismo usuario entrás a {app.nombre} y a {otra.nombre}. Cada cuenta ve solo sus propios datos.
          </p>
        </div>
        <p className="t-caption text-marfil/50">
          El punto de encuentro entre finanzas, proyectos y ley — con foco en cripto.
        </p>
        <svg
          aria-hidden="true"
          viewBox="0 0 400 400"
          className="pointer-events-none absolute -bottom-24 -right-24 h-[420px] w-[420px] opacity-[0.12]"
        >
          <g fill="none" stroke="#b8734a" strokeWidth="3" strokeLinejoin="round">
            <polyline points="200,215 120,215 98,193 98,116" />
            <polyline points="200,215 116,215 90,241" />
            <polyline points="200,215 200,134 222,112 286,112" />
          </g>
          <circle cx="98" cy="98" r="18" fill="none" stroke="#f2eee6" strokeWidth="5" />
          <circle cx="84" cy="255" r="16" fill="none" stroke="#f2eee6" strokeWidth="5" />
          <circle cx="306" cy="112" r="20" fill="none" stroke="#f2eee6" strokeWidth="5" />
          <circle cx="200" cy="215" r="44" fill="#b8734a" />
        </svg>
      </section>

      <section className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="mb-8 flex items-center gap-2 lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/isotipo.svg" alt="" width={32} height={32} className="rounded-md" />
          <span className="text-musgo">
            <span className="wordmark">NODOS</span> <span className="font-display">{app.corto}</span>
          </span>
        </div>
        <div className="w-full max-w-sm">
          <h1>{titulo}</h1>
          {subtitulo && <p className="mb-6 mt-2 text-carbon/65">{subtitulo}</p>}
          {children}
        </div>
        <p className="t-caption mt-10 text-carbon/50">
          ¿Problemas para ingresar?{" "}
          <Link href="/soporte" className="text-cobre-hover underline">
            Escribí a soporte
          </Link>
        </p>
      </section>
    </main>
  );
}
