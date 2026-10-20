import type { PagoFlat } from "../../services/decision";
import { csvCell as esc, downloadCsv, todayStamp } from "../../lib/csv";

// ─── CSV / clipboard helpers ─────────────────────────────────
export function buildCSV(sel: PagoFlat[]): string {
  const headers = ["ID", "Propuesta", "Operación", "Tipo", "OC", "Proyecto", "Solicitante", "Cliente", "Beneficiario", "Concepto", "Factura", "Vencimiento", "Monto", "Divisa", "TC", "Total MXN", "Banco", "Departamento", "Estatus"];
  const sorted = [...sel].sort((a, b) => b.total_mxn - a.total_mxn);
  const rows = sorted.map((p) =>
    [p.id, p.propuesta, p.operacion_cat, p.tipo_op, p.oc, p.proyecto, p.solicitante, p.cliente, p.benef_clean, p.concepto, p.factura, p.venc, p.monto, p.divisa, p.tc, p.total_mxn, p.banco, p.departamento, p.estatus].map(esc).join(",")
  );
  const total = sorted.reduce((s, p) => s + p.total_mxn, 0);
  rows.push("", esc(`TOTAL ${sorted.length} pagos`) + ",,,,,,,,,,,,,,," + total.toFixed(2) + ",,,");
  return headers.join(",") + "\n" + rows.join("\n");
}

export function downloadCSV(sel: PagoFlat[]) {
  if (!sel.length) return;
  downloadCsv(`pagos_${todayStamp()}.csv`, buildCSV(sel));
}

export async function copyTSV(sel: PagoFlat[]): Promise<void> {
  const headers = ["ID", "Propuesta", "Operación", "Tipo", "OC", "Proyecto", "Solicitante", "Cliente", "Beneficiario", "Concepto", "Factura", "Vencimiento", "Monto", "Divisa", "TC", "Total MXN", "Banco", "Departamento"];
  const sorted = [...sel].sort((a, b) => b.total_mxn - a.total_mxn);
  const clean = (v: any) => String(v ?? "").replace(/\t/g, " ").replace(/\n/g, " ");
  const rows = sorted.map((p) =>
    [p.id, p.propuesta, p.operacion_cat, p.tipo_op, p.oc, p.proyecto, p.solicitante, p.cliente, p.benef_clean, p.concepto, p.factura, p.venc, p.monto, p.divisa, p.tc, p.total_mxn, p.banco, p.departamento].map(clean).join("\t")
  );
  await navigator.clipboard.writeText(headers.join("\t") + "\n" + rows.join("\n"));
}
