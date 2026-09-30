import type { NextConfig } from "next";

/**
 * Acepta los nombres de variables que crea la integración oficial de
 * Supabase en Vercel (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) además de los
 * clásicos NEXT_PUBLIC_*. Solo se exponen al navegador la URL y la clave
 * publicable, que son públicas por diseño; la clave secreta NUNCA se pone
 * acá (se lee solo en el servidor, en src/lib/supabaseAdmin.ts).
 */
const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      "",
  },
};

export default nextConfig;
