import assert from "node:assert/strict";
import { antiguedad, calcularLiquidacion, diasDePreaviso, diasDeVacaciones, aniosParaIndemnizacion, estimarCobradoEnElAnio } from "../src/lib/liquidacion";

let n = 0;
const ok = (t: string, f: () => void) => { f(); n++; console.log("ok", t); };
const A = (i: string, s: string) => antiguedad(i, s)!;

ok("antigüedad exacta", () => assert.deepEqual(A("2020-03-01", "2026-02-28"), { anios: 6, meses: 0, dias: 0, totalMeses: 72 }));
ok("antigüedad con fracción", () => assert.deepEqual(A("2023-01-15", "2026-08-20"), { anios: 3, meses: 7, dias: 6, totalMeses: 43 }));
ok("preaviso art. 87", () => {
  assert.equal(diasDePreaviso(A("2026-01-01", "2026-06-30")), 30);
  assert.equal(diasDePreaviso(A("2025-01-01", "2025-12-31")), 30);
  assert.equal(diasDePreaviso(A("2024-01-01", "2026-06-30")), 45);
  assert.equal(diasDePreaviso(A("2018-01-01", "2026-06-30")), 60);
  assert.equal(diasDePreaviso(A("2010-01-01", "2026-06-30")), 90);
});
ok("vacaciones art. 218", () => {
  assert.equal(diasDeVacaciones(A("2022-01-01", "2026-06-30")), 12);
  assert.equal(diasDeVacaciones(A("2019-01-01", "2026-06-30")), 18);
  assert.equal(diasDeVacaciones(A("2014-01-01", "2026-06-30")), 30);
});
ok("indemnización: fracción de seis meses", () => {
  assert.equal(aniosParaIndemnizacion(A("2023-01-01", "2026-05-31")), 3);
  assert.equal(aniosParaIndemnizacion(A("2023-01-01", "2026-06-30")), 4);
});
ok("despido sin causa, sin preaviso", () => {
  const l = calcularLiquidacion({ ingreso: "2023-01-01", salida: "2026-06-30", motivo: "despido_injustificado", salarioPromedio: 3_000_000, huboPreaviso: false, diasPendientes: 10, vacacionesCausadas: 0, cobradoEnElAnio: 18_000_000 })!;
  const m = Object.fromEntries(l.conceptos.map((c) => [c.id, c.monto]));
  assert.equal(m.salario, 1_000_000);
  assert.equal(m.preaviso, 4_500_000); // 45 días
  assert.equal(m.indemnizacion, 6_000_000); // 15 × 100.000 × 4
  assert.equal(m.vac_prop, 600_000); // 12/12 × 6 meses
  assert.equal(m.aguinaldo, 1_500_000);
  assert.equal(l.total, 13_600_000);
});
ok("renuncia sin preaviso descuenta la mitad", () => {
  const l = calcularLiquidacion({ ingreso: "2025-02-01", salida: "2026-01-31", motivo: "renuncia", salarioPromedio: 3_000_000, huboPreaviso: false, diasPendientes: 0, vacacionesCausadas: 0, cobradoEnElAnio: 3_000_000 })!;
  assert.equal(l.conceptos.find((c) => c.id === "preaviso_desc")!.monto, -1_500_000);
  assert.ok(!l.conceptos.some((c) => c.id === "indemnizacion"));
});
ok("justa causa: sin preaviso ni indemnización", () => {
  const l = calcularLiquidacion({ ingreso: "2020-01-01", salida: "2026-06-30", motivo: "despido_justificado", salarioPromedio: 3_000_000, huboPreaviso: false, diasPendientes: 0, vacacionesCausadas: 5, cobradoEnElAnio: 0 })!;
  assert.deepEqual(l.conceptos.map((c) => c.id), ["vac_causadas"]);
});
ok("aguinaldo estimado", () => {
  assert.equal(estimarCobradoEnElAnio("2020-01-01", "2026-06-30", 3_000_000), 18_000_000);
  assert.equal(estimarCobradoEnElAnio("2026-03-01", "2026-03-15", 3_000_000), 1_500_000);
});
ok("fechas inválidas", () => assert.equal(calcularLiquidacion({ ingreso: "2026-05-01", salida: "2026-01-01", motivo: "renuncia", salarioPromedio: 1, huboPreaviso: true, diasPendientes: 0, vacacionesCausadas: 0, cobradoEnElAnio: 0 }), null));
console.log(`${n} pruebas OK`);
