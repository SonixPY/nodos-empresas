import { createBrowserClient } from "@supabase/ssr";
import { cookieDomainFor } from "@/lib/nodos/sitios";
import { supabaseAnonKey as supabaseAnonKey_, supabaseUrl as supabaseUrlLimpia } from "@/lib/nodos/sitios";

const supabaseUrl = supabaseUrlLimpia();
const supabaseAnonKey = supabaseAnonKey_();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan las variables de entorno NEXT_PUBLIC_SUPABASE_URL y/o NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copiá .env.local.example a .env.local y completá los valores de tu proyecto Supabase."
  );
}

// La sesión vive en cookies (no solo en localStorage) para que el proxy la
// lea. En producción la cookie es de ".nodoscompliance.com": la misma cuenta
// queda abierta en Finanzas y en Empresas.
const domain = typeof window !== "undefined" ? cookieDomainFor(window.location.hostname) : undefined;

export const supabase = createBrowserClient(
  supabaseUrl,
  supabaseAnonKey,
  domain ? { cookieOptions: { domain, path: "/", sameSite: "lax", secure: true } } : undefined
);
