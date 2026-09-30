import { MESES, parseIso } from "@/lib/dates";

/**
 * Números en letras, en español, como se escriben en actas y contratos
 * ("a los veintinueve días del mes de septiembre del año dos mil veintiséis",
 * "Gs. 150.000.000 (ciento cincuenta millones)").
 */

const UNIDADES = [
  "cero",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
  "veinte",
  "veintiuno",
  "veintidós",
  "veintitrés",
  "veinticuatro",
  "veinticinco",
  "veintiséis",
  "veintisiete",
  "veintiocho",
  "veintinueve",
];

const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];

const CENTENAS = [
  "",
  "ciento",
  "doscientos",
  "trescientos",
  "cuatrocientos",
  "quinientos",
  "seiscientos",
  "setecientos",
  "ochocientos",
  "novecientos",
];

function menorQueMil(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]);
  if (resto > 0) {
    if (resto < 30) partes.push(UNIDADES[resto]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}`);
    }
  }
  return partes.join(" ");
}

/** "uno" → "un" delante de "mil"/"millones" ("veintiún mil", "un millón"). */
function apocopar(s: string): string {
  return s.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");
}

export function numeroALetras(valor: number): string {
  const n = Math.floor(Math.abs(valor));
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "cero";
  if (n >= 1e12) return n.toLocaleString("es-PY");

  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];

  if (millones > 0) {
    if (millones === 1) partes.push("un millón");
    else {
      // Los millones pueden pasar de mil ("mil doscientos millones").
      const milesDeMillones = Math.floor(millones / 1000);
      const restoMillones = millones % 1000;
      const txt: string[] = [];
      if (milesDeMillones > 0) txt.push(milesDeMillones === 1 ? "mil" : `${apocopar(menorQueMil(milesDeMillones))} mil`);
      if (restoMillones > 0) txt.push(apocopar(menorQueMil(restoMillones)));
      partes.push(`${txt.join(" ")} millones`);
    }
  }
  if (miles > 0) partes.push(miles === 1 ? "mil" : `${apocopar(menorQueMil(miles))} mil`);
  if (resto > 0) partes.push(menorQueMil(resto));

  return partes.join(" ");
}

/** "a los veintinueve días del mes de septiembre del año dos mil veintiséis" */
export function fechaEnLetrasActa(iso: string): string {
  if (!iso) return "a los [DÍA] días del mes de [MES] del año [AÑO]";
  const d = parseIso(iso);
  const dia = d.getDate();
  const diaTxt = dia === 1 ? "al primer día" : `a los ${numeroALetras(dia)} días`;
  return `${diaTxt} del mes de ${MESES[d.getMonth()]} del año ${numeroALetras(d.getFullYear())}`;
}

/** "Gs. 150.000.000 (ciento cincuenta millones de guaraníes)" */
export function montoGs(valor: string | number | undefined | null): string {
  const n = typeof valor === "number" ? valor : Number(String(valor ?? "").replace(/\./g, "").replace(",", "."));
  if (!valor && valor !== 0) return "Gs. [MONTO]";
  if (!Number.isFinite(n)) return `Gs. ${valor}`;
  const letras = numeroALetras(n);
  // "un millón de guaraníes", "cincuenta millones de guaraníes"
  const de = /(millón|millones)$/.test(letras) ? " de" : "";
  return `Gs. ${Math.round(n).toLocaleString("es-PY")} (${letras}${de} guaraníes)`;
}

/** "14:30" → "14:30 horas"; vacío → "[HORA] horas" */
export function horaTexto(hhmm: string | undefined): string {
  if (!hhmm) return "[HORA] horas";
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h)) return `${hhmm} horas`;
  const mm = m ? `:${String(m).padStart(2, "0")}` : ":00";
  return `${String(h).padStart(2, "0")}${mm} horas`;
}
