"use client";

import { useEffect, useState } from "react";
import { Check, Link2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { mensajeError } from "@/lib/nodos/errores";
import { DOMINIO_RAIZ, SITIOS, urlIngreso } from "@/lib/nodos/sitios";
import AuthShell from "@/components/nodos/AuthShell";

// La invitación llega como /vincular#t=<token>. El token nunca va en la URL
// que ve el servidor (ni la analítica): se guarda en esta pestaña mientras
// la persona ingresa o crea su cuenta, y se borra al usarlo.
const CLAVE = "nodos_invitacion_socio";

function leerToken(): string | null {
  try {
    const m = window.location.hash.match(/(?:^#|&)t=([a-f0-9]{48,96})/i);
    if (m) {
      sessionStorage.setItem(CLAVE, m[1]);
      history.replaceState(null, "", window.location.pathname);
      return m[1];
    }
    return sessionStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

function olvidarToken() {
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    // sin almacenamiento: no hay nada que borrar
  }
}

type Estado =
  | { paso: "cargando" }
  | { paso: "sin-token" }
  | { paso: "ingresar" }
  | { paso: "invalida" }
  | { paso: "confirmar"; empresa: string; accionista: string }
  | { paso: "listo"; empresa: string };

export default function VincularPage() {
  const [estado, setEstado] = useState<Estado>({ paso: "cargando" });
  const [token, setToken] = useState<string | null>(null);
  const [aceptando, setAceptando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const t = leerToken();
      setToken(t);
      if (!t) return setEstado({ paso: "sin-token" });
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return setEstado({ paso: "ingresar" });
      const { data, error: e } = await supabase.rpc("ver_invitacion_accionista", { p_token: t });
      const fila = Array.isArray(data) ? (data[0] as { empresa: string; accionista: string } | undefined) : undefined;
      if (e || !fila) return setEstado({ paso: "invalida" });
      setEstado({ paso: "confirmar", empresa: fila.empresa, accionista: fila.accionista });
    })();
  }, []);

  function irAIngresar(vista?: "crear") {
    const volver = `${window.location.origin}/vincular`;
    const produccion = window.location.hostname === DOMINIO_RAIZ || window.location.hostname.endsWith(`.${DOMINIO_RAIZ}`);
    window.location.href = produccion ? urlIngreso(volver, vista) : `/login?next=${encodeURIComponent("/vincular")}`;
  }

  async function aceptar() {
    if (!token || estado.paso !== "confirmar") return;
    setAceptando(true);
    setError(null);
    const { error: e } = await supabase.rpc("aceptar_invitacion_accionista", { p_token: token });
    setAceptando(false);
    if (e) return setError(mensajeError(e));
    olvidarToken();
    setEstado({ paso: "listo", empresa: estado.empresa });
  }

  return (
    <AuthShell titulo="Conectar tu participación" subtitulo="Una empresa te invitó a ver tu parte en NODOS Finanzas.">
      {estado.paso === "cargando" && (
        <p className="flex items-center gap-2 text-sm text-carbon/60">
          <Loader2 size={16} className="animate-spin" /> Revisando la invitación…
        </p>
      )}
      {estado.paso === "sin-token" && (
        <p className="text-carbon/75">No encontramos una invitación en este enlace. Abrí el enlace completo que te mandaron, o pedí uno nuevo.</p>
      )}
      {estado.paso === "invalida" && (
        <p className="text-carbon/75">La invitación no es válida, ya se usó o venció. Pedile una nueva a quien te la mandó.</p>
      )}
      {estado.paso === "ingresar" && (
        <div className="space-y-4">
          <p className="text-carbon/75">Para aceptarla, ingresá con tu cuenta NODOS o creá una gratis. Después volvés acá y la confirmás.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={() => irAIngresar()}>
              Ingresar
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => irAIngresar("crear")}>
              Crear cuenta
            </button>
          </div>
        </div>
      )}
      {estado.paso === "confirmar" && (
        <div className="space-y-4">
          <p className="text-carbon/80">
            <strong>{estado.empresa}</strong> te invita a conectar tu cuenta como accionista <strong>{estado.accionista}</strong>.
          </p>
          <ul className="space-y-1.5 text-sm text-carbon/70">
            <li>Vas a ver tu porcentaje, tus aportes y los dividendos que te correspondan en NODOS Finanzas.</li>
            <li>La empresa no ve tus finanzas personales: solo sabe que tu cuenta está conectada.</li>
            <li>Podés desconectarte cuando quieras desde Inversiones, en Mis empresas.</li>
          </ul>
          <button type="button" className="btn btn-primary" onClick={aceptar} disabled={aceptando}>
            {aceptando ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />} Aceptar y conectar
          </button>
          {error && <p className="text-sm text-bad">{error}</p>}
        </div>
      )}
      {estado.paso === "listo" && (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-carbon/80">
            <Check size={18} className="text-good" /> Listo: tu participación en {estado.empresa} quedó conectada.
          </p>
          <a href={`${SITIOS.finanzas.url}/portafolio?ver=empresas`} className="btn btn-primary">
            Ver en NODOS Finanzas
          </a>
        </div>
      )}
    </AuthShell>
  );
}
