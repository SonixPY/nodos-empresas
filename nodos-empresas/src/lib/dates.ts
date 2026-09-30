/**
 * Fechas como strings 'YYYY-MM-DD' (así las guarda Postgres en columnas
 * `date`). Todo se calcula en hora local y sin zonas horarias, para que un
 * vencimiento del 30/04 nunca aparezca como 29/04 por un corrimiento UTC.
 */

export const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayIso(): string {
  return toIso(new Date());
}

/** Último día del mes (month: 1-12). */
export function lastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 0);
}

export function addDays(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher). */
function pascua(y: number): Date {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}

// Feriados nacionales de fecha fija. Los "trasladables" (1 de marzo,
// 12 de junio, 29 de septiembre, etc.) cambian cada año por ley y no se
// incluyen: por eso los plazos calculados son siempre una referencia.
const FERIADOS_FIJOS = ["01-01", "05-01", "05-14", "05-15", "08-15", "12-08", "12-25"];

function isFeriado(d: Date): boolean {
  const md = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (FERIADOS_FIJOS.includes(md)) return true;
  const p = pascua(d.getFullYear());
  const jueves = new Date(p.getFullYear(), p.getMonth(), p.getDate() - 3);
  const viernes = new Date(p.getFullYear(), p.getMonth(), p.getDate() - 2);
  return toIso(d) === toIso(jueves) || toIso(d) === toIso(viernes);
}

/**
 * Suma (o resta, con n negativo) días hábiles. Saltea sábados, domingos,
 * feriados fijos y Semana Santa; NO contempla feriados trasladables ni
 * asuetos, así que el resultado es una referencia a confirmar.
 */
export function addBusinessDays(iso: string, n: number): string {
  const d = parseIso(iso);
  const step = n >= 0 ? 1 : -1;
  let remaining = Math.abs(n);
  while (remaining > 0) {
    d.setDate(d.getDate() + step);
    if (!isWeekend(d) && !isFeriado(d)) remaining--;
  }
  return toIso(d);
}

/** Días entre hoy y la fecha (negativo si ya pasó). */
export function daysUntil(iso: string, from: string = todayIso()): number {
  const ms = parseIso(iso).getTime() - parseIso(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** 30/04/2027 */
export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseIso(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** 30 de abril de 2027 */
export function formatFechaLarga(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseIso(iso);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/** "vence hoy", "en 5 días", "hace 3 días" */
export function relativo(iso: string): string {
  const n = daysUntil(iso);
  if (n === 0) return "hoy";
  if (n === 1) return "mañana";
  if (n === -1) return "ayer";
  return n > 0 ? `en ${n} días` : `hace ${-n} días`;
}
