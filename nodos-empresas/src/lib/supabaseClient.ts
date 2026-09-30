import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan las variables de entorno NEXT_PUBLIC_SUPABASE_URL y/o NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copiá .env.local.example a .env.local y completá los valores de tu proyecto Supabase."
  );
}

// Cliente de navegador consciente de cookies: la sesión de Supabase Auth
// queda guardada en cookies (no solo en localStorage), para que el proxy
// del servidor pueda leerla y decidir si dejar pasar la request.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
