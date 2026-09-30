import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Esta app usa App Router: las fuentes van como <link> en el layout raíz
    // (src/app/layout.tsx), no en pages/_document.js. La regla apunta al
    // patrón de Pages Router y no distingue el contexto, así que da un falso
    // positivo aquí — es la excepción documentada por Next.js para este caso.
    rules: {
      "@next/next/no-page-custom-font": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
