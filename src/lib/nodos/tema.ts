// Tema claro / oscuro (idéntico en las dos apps y en nodoscompliance.com).
// La preferencia vive en una cookie de .nodoscompliance.com para que sea la
// misma en las tres páginas; "auto" sigue al sistema del dispositivo.

export type Tema = "claro" | "oscuro" | "auto";

export const COOKIE_TEMA = "nodos_tema";

/** Script que corre en <head> antes de pintar: evita el destello claro. */
export const SCRIPT_TEMA = `(function(){try{var m=document.cookie.match(/(?:^|; )nodos_tema=(claro|oscuro|auto)/);var t=m?m[1]:"claro";var d=t==="oscuro"||(t==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light");}catch(e){}})();`;

export function leerTema(): Tema {
  if (typeof document === "undefined") return "claro";
  const m = /(?:^|; )nodos_tema=(claro|oscuro|auto)/.exec(document.cookie);
  return (m?.[1] as Tema) ?? "claro";
}

export function aplicarTema(t: Tema) {
  const oscuro = t === "oscuro" || (t === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", oscuro ? "dark" : "light");
}

/** Guarda la preferencia (en las tres páginas si es nodoscompliance.com) y la aplica. */
export function guardarTema(t: Tema) {
  const h = window.location.hostname;
  const dominio = h === "nodoscompliance.com" || h.endsWith(".nodoscompliance.com") ? "; domain=.nodoscompliance.com" : "";
  document.cookie = `${COOKIE_TEMA}=${t}; path=/; max-age=${60 * 60 * 24 * 400}; samesite=lax${dominio}${location.protocol === "https:" ? "; secure" : ""}`;
  aplicarTema(t);
  window.dispatchEvent(new CustomEvent("nodos:tema", { detail: t }));
}
