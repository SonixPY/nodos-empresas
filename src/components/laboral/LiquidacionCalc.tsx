"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calculator, FileText, Info, Printer } from "lucide-react";
import InputNumero from "@/components/nodos/InputNumero";
import { MOTIVOS, calcularLiquidacion, estimarCobradoEnElAnio, type Motivo } from "@/lib/liquidacion";

const gs = (n: number) => `${n < 0 ? "−" : ""}Gs. ${Math.abs(Math.round(n)).toLocaleString("es-PY")}`;
const hoy = () => new Date().toISOString().slice(0, 10);

/**
 * Calculadora de liquidación final: preaviso, indemnización, vacaciones y
 * aguinaldo proporcional con el artículo de cada concepto y el criterio usado.
 * Todo se calcula en el navegador; no se guarda nada.
 */
export default function LiquidacionCalc({ empresaId }: { empresaId: string }) {
  const [ingreso, setIngreso] = useState("");
  const [salida, setSalida] = useState(hoy());
  const [motivo, setMotivo] = useState<Motivo>("despido_injustificado");
  const [salario, setSalario] = useState(0);
  const [huboPreaviso, setHuboPreaviso] = useState(false);
  const [diasPendientes, setDiasPendientes] = useState(0);
  const [vacCausadas, setVacCausadas] = useState(0);
  const [cobradoManual, setCobradoManual] = useState<number | null>(null);

  const cobradoEstimado = estimarCobradoEnElAnio(ingreso, salida, salario);
  const cobrado = cobradoManual ?? cobradoEstimado;
  const r = useMemo(
    () => calcularLiquidacion({ ingreso, salida, motivo, salarioPromedio: salario, huboPreaviso, diasPendientes, vacacionesCausadas: vacCausadas, cobradoEnElAnio: cobrado }),
    [ingreso, salida, motivo, salario, huboPreaviso, diasPendientes, vacCausadas, cobrado]
  );
  const listo = r && salario > 0;
  const a = r?.antiguedad;

  return (
    <section className="card" id="liquidacion">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-xl">
            <Calculator size={19} className="text-cobre" aria-hidden /> Liquidación final
          </h2>
          <p className="mt-1 text-sm text-carbon/60">Cargá las fechas, el motivo y el salario: cada concepto muestra el artículo y cómo se calculó.</p>
        </div>
        {listo && (
          <button type="button" className="btn btn-ghost print:hidden" onClick={() => window.print()}>
            <Printer size={15} /> Imprimir
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="field-label">Fecha de ingreso</span>
          <input type="date" className="input" value={ingreso} max={salida || undefined} onChange={(e) => setIngreso(e.target.value)} />
        </label>
        <label className="block">
          <span className="field-label">Último día trabajado</span>
          <input type="date" className="input" value={salida} min={ingreso || undefined} onChange={(e) => setSalida(e.target.value)} />
        </label>
        <label className="block">
          <span className="field-label">Motivo</span>
          <select className="input" value={motivo} onChange={(e) => setMotivo(e.target.value as Motivo)}>
            {(Object.keys(MOTIVOS) as Motivo[]).map((m) => (
              <option key={m} value={m}>
                {MOTIVOS[m].label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] text-carbon/50">{MOTIVOS[motivo].ayuda}</span>
        </label>
        <label className="block">
          <span className="field-label">Salario mensual promedio (últimos 6 meses)</span>
          <InputNumero decimales={0} value={salario} onValor={(v) => setSalario(Number(v) || 0)} placeholder="Gs." />
          <span className="mt-1 block text-[11px] text-carbon/50">Incluí horas extra y comisiones habituales (art. 92).</span>
        </label>
        <label className="block">
          <span className="field-label">Días del último mes sin cobrar</span>
          <InputNumero decimales={0} value={diasPendientes} onValor={(v) => setDiasPendientes(Math.min(31, Number(v) || 0))} />
        </label>
        <label className="block">
          <span className="field-label">Vacaciones de años anteriores no gozadas (días)</span>
          <InputNumero decimales={0} value={vacCausadas} onValor={(v) => setVacCausadas(Math.min(90, Number(v) || 0))} />
        </label>
        <label className="block sm:col-span-2 lg:col-span-1">
          <span className="field-label">Cobrado en el año (para el aguinaldo)</span>
          <InputNumero decimales={0} value={cobrado} onValor={(v) => setCobradoManual(v === "" ? null : Number(v) || 0)} />
          <span className="mt-1 block text-[11px] text-carbon/50">
            {cobradoManual === null ? "Estimado con el salario promedio desde el 1 de enero. Corregilo si cambió." : (
              <button type="button" className="underline" onClick={() => setCobradoManual(null)}>
                Volver al estimado ({gs(cobradoEstimado)})
              </button>
            )}
          </span>
        </label>
        {motivo !== "despido_justificado" && (
          <label className="flex items-start gap-2 text-sm sm:col-span-2 lg:col-span-2 lg:self-center">
            <input type="checkbox" className="mt-1" checked={huboPreaviso} onChange={(e) => setHuboPreaviso(e.target.checked)} />
            <span>
              {motivo === "renuncia" ? "El trabajador avisó con el preaviso que le corresponde" : "Se dio el preaviso por escrito y se trabajó ese plazo"}
              <span className="block text-[11px] text-carbon/50">{r ? `Le corresponden ${r.diasPreaviso} días por su antigüedad (art. 87).` : "El plazo depende de la antigüedad (art. 87)."}</span>
            </span>
          </label>
        )}
      </div>

      {!ingreso ? (
        <p className="mt-5 rounded-sm border border-dashed p-5 text-center text-sm text-carbon/55" style={{ borderColor: "var(--line)" }}>
          Empezá por la fecha de ingreso.
        </p>
      ) : !r ? (
        <p className="mt-5 text-sm text-bad">La fecha de salida tiene que ser posterior a la de ingreso.</p>
      ) : (
        <div className="mt-5 space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="stat-tile">
              <p className="stat-label">Antigüedad</p>
              <p className="text-base font-semibold text-carbon">
                {a!.anios} a, {a!.meses} m, {a!.dias} d
              </p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">Salario diario</p>
              <p className="text-base font-semibold text-carbon">{gs(r.salarioDiario)}</p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">Preaviso</p>
              <p className="text-base font-semibold text-carbon">{r.diasPreaviso} días</p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">Vacaciones por año</p>
              <p className="text-base font-semibold text-carbon">{r.diasVacacionesAnio} días</p>
            </div>
          </div>

          {listo ? (
            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Cálculo</th>
                    <th>Base</th>
                    <th className="text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {r.conceptos.map((c) => (
                    <tr key={c.id} className="animate-row-in">
                      <td className="font-medium">{c.titulo}</td>
                      <td className="min-w-[12rem] text-xs text-carbon/65">{c.detalle}</td>
                      <td className="whitespace-nowrap text-xs text-carbon/55">{c.base}</td>
                      <td className={`whitespace-nowrap text-right tabular-nums ${c.monto < 0 ? "text-bad" : ""}`}>{gs(c.monto)}</td>
                    </tr>
                  ))}
                  {r.conceptos.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-5 text-center text-sm text-carbon/55">
                        Con estos datos no hay montos a liquidar.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="font-semibold">
                      Total {r.total < 0 ? "a descontar" : "a pagar"} (bruto)
                    </td>
                    <td className="whitespace-nowrap text-right text-lg font-semibold tabular-nums text-musgo">{gs(r.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-sm text-carbon/55">Cargá el salario promedio para ver los montos.</p>
          )}

          {r.avisos.map((t) => (
            <p key={t} className="flex items-start gap-2 text-xs text-carbon/65">
              <Info size={13} className="mt-0.5 shrink-0 text-cobre" aria-hidden /> {t}
            </p>
          ))}

          <details className="rounded-sm border p-3 text-xs text-carbon/65" style={{ borderColor: "var(--line)" }}>
            <summary className="cursor-pointer font-medium text-cobre-hover">Criterios que usa el cálculo</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Salario diario: promedio mensual de los últimos seis meses ÷ 30. El promedio es el que manda el art. 92 para preaviso e indemnización.</li>
              <li>Preaviso (art. 87): 30 días hasta 1 año, 45 hasta 5, 60 hasta 10 y 90 con más de 10 años. Si no se dio, se paga ese plazo; si el trabajador renunció sin avisar, debe la mitad (art. 90).</li>
              <li>Indemnización (art. 91): 15 salarios diarios por año de servicio; una fracción de seis meses o más cuenta como un año.</li>
              <li>Vacaciones (art. 218): 12, 18 o 30 días por año según la antigüedad. Las proporcionales se calculan como esos días ÷ 12 por cada mes entero desde el último aniversario, solo en despido sin justa causa.</li>
              <li>Aguinaldo proporcional (arts. 243 y 244): la doceava parte de lo cobrado en el año hasta la salida.</li>
              <li>Montos brutos: no se descuenta el aporte al IPS ni otros conceptos, y no contempla convenios colectivos, estabilidad especial ni casos de embarazo o maternidad.</li>
            </ul>
          </details>

          <div className="flex flex-wrap gap-3 print:hidden">
            <Link href={`/documentos?empresa=${empresaId}&plantilla=lab-constancia-terminacion`} className="inline-flex items-center gap-1.5 text-sm font-medium text-cobre-hover hover:underline">
              <FileText size={14} aria-hidden /> Constancia de terminación (art. 93)
            </Link>
            <Link href={`/documentos?empresa=${empresaId}&plantilla=lab-preaviso`} className="inline-flex items-center gap-1.5 text-sm font-medium text-cobre-hover hover:underline">
              <FileText size={14} aria-hidden /> Nota de preaviso
            </Link>
          </div>
        </div>
      )}
      <p className="mt-4 text-[11px] text-carbon/45">Cálculo orientativo con el Código del Trabajo: no constituye asesoramiento legal para tu caso.</p>
    </section>
  );
}
