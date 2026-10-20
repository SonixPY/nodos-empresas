"use client";

import { useEffect, useState, type InputHTMLAttributes } from "react";

/**
 * Campo numérico con separador de miles mientras escribís (idéntico en las dos
 * apps): muestra "1.500.000" o "1.234,56" y devuelve el valor crudo
 * ("1500000", "1234.56") para guardar y calcular.
 */

const SEP_MILES = ".";
const SEP_DEC = ",";

/** "1.500.000,5" → "1500000.5"; vacío → "". */
export function numeroCrudo(texto: string, decimales: number): string {
  let t = texto.replace(/\s/g, "").replace(/[^\d.,-]/g, "");
  const neg = t.startsWith("-");
  t = t.replace(/-/g, "");
  // "100.50" (punto decimal, a la inglesa): un solo punto con 1 o 2 cifras
  // detrás y sin coma se toma como decimal, no como miles.
  if (decimales > 0 && !t.includes(SEP_DEC) && /^\d+\.\d{1,2}$/.test(t)) t = t.replace(".", SEP_DEC);
  let entero = t;
  let dec = "";
  if (decimales > 0) {
    const i = t.lastIndexOf(SEP_DEC);
    if (i >= 0) {
      entero = t.slice(0, i);
      dec = t.slice(i + 1).replace(/[.,]/g, "").slice(0, decimales);
    }
  }
  entero = entero.replace(/[.,]/g, "").replace(/^0+(?=\d)/, "");
  if (!entero && !dec && !t.includes(SEP_DEC)) return neg ? "-" : "";
  return `${neg ? "-" : ""}${entero || "0"}${decimales > 0 && (dec || t.endsWith(SEP_DEC)) ? `.${dec}` : ""}`;
}

/** "1500000.5" → "1.500.000,5" (respeta lo que se está escribiendo). */
export function numeroVisible(crudo: string | number, decimales: number): string {
  const s = String(crudo ?? "");
  if (s === "" || s === "-") return s;
  const neg = s.startsWith("-");
  const [ent, dec] = s.replace("-", "").split(".");
  const conMiles = (ent || "0").replace(/\B(?=(\d{3})+(?!\d))/g, SEP_MILES);
  return `${neg ? "-" : ""}${conMiles}${decimales > 0 && dec !== undefined ? `${SEP_DEC}${dec}` : ""}`;
}

export default function InputNumero({
  value,
  onValor,
  decimales = 0,
  className = "input",
  ...rest
}: {
  value: string | number;
  onValor: (crudo: string) => void;
  /** 0 para guaraníes; 2 para dólares; más para cantidades de cripto. */
  decimales?: number;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  const [texto, setTexto] = useState(() => numeroVisible(value, decimales));

  // Si el valor cambia desde afuera (reset del formulario), se refleja.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTexto((t) => (numeroCrudo(t, decimales) === String(value ?? "") ? t : numeroVisible(value, decimales)));
  }, [value, decimales]);

  return (
    <input
      {...rest}
      type="text"
      inputMode={decimales > 0 ? "decimal" : "numeric"}
      autoComplete="off"
      className={`${className} tabular-nums`}
      value={texto}
      onChange={(e) => {
        const crudo = numeroCrudo(e.target.value, decimales);
        setTexto(numeroVisible(crudo, decimales));
        onValor(crudo);
      }}
    />
  );
}
