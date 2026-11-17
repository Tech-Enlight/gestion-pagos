import { STATUS } from "../../data/mockData";
import type { Request } from "../../data/mockData";
import type { NSBill } from "../../services/sheets";

/** Acepta YYYY-MM-DD y DD/MM/YYYY (Sheets en locale español reformatea al leer); devuelve YYYY-MM-DD o "". */
export function toISO(s?: string | null): string {
  const v = String(s ?? "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Días de calendario locales de hoy a la fecha (negativo = ya pasó). new Date("YYYY-MM-DD") sería UTC y correría un día. */
export function diasHasta(iso: string, hoy = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Math.round((t.getTime() - startOfDay(hoy).getTime()) / 86_400_000);
}

export type GrupoId = "vencidos" | "hoy" | "manana" | "semana" | "despues" | "sin_fecha";

export const GRUPOS: { id: GrupoId; label: string }[] = [
  { id: "vencidos", label: "Vencidos" },
  { id: "hoy", label: "Hoy" },
  { id: "manana", label: "Mañana" },
  { id: "semana", label: "Esta semana" },
  { id: "despues", label: "Después" },
  { id: "sin_fecha", label: "Sin fecha" },
];

export function grupoDe(iso: string, hoy = new Date()): GrupoId {
  const d = diasHasta(iso, hoy);
  if (d === null) return "sin_fecha";
  if (d < 0) return "vencidos";
  if (d === 0) return "hoy";
  if (d === 1) return "manana";
  if (d <= 7) return "semana";
  return "despues";
}

/** Monto en pesos con el T/C vigente (referencia para totales; el monto real lo fija el pago en NetSuite). */
export const mxnOf = (r: Request, rate: number) => (r.currency === "USD" ? r.amount * rate : r.amount);

export const fechaPago = (r: Request) => toISO(r.estimatedPaymentDate);

export interface GrupoLista {
  id: GrupoId;
  label: string;
  items: Request[];
  totalMxn: number;
}

/** Pagos aprobados agrupados por fecha programada; dentro de cada grupo, por fecha y luego por antigüedad. */
export function agrupar(requests: Request[], rate: number, hoy = new Date()): GrupoLista[] {
  const por = new Map<GrupoId, Request[]>();
  for (const r of requests) {
    const g = grupoDe(fechaPago(r), hoy);
    por.set(g, [...(por.get(g) ?? []), r]);
  }
  return GRUPOS.filter((g) => por.has(g.id)).map((g) => {
    const items = (por.get(g.id) ?? []).sort((a, b) => fechaPago(a).localeCompare(fechaPago(b)) || a.id.localeCompare(b.id));
    return { id: g.id, label: g.label, items, totalMxn: items.reduce((s, r) => s + mxnOf(r, rate), 0) };
  });
}

/** Lo pagado desde el lunes de esta semana, según el evento Paid de cada solicitud. */
export function pagadoEstaSemana(requests: Request[], rate: number, hoy = new Date()): { count: number; totalMxn: number } {
  const lunes = startOfDay(hoy);
  lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
  let count = 0;
  let totalMxn = 0;
  for (const r of requests) {
    if (r.status !== STATUS.PAID) continue;
    const ev = [...(r.statusHistory || [])].reverse().find((e) => e.status === STATUS.PAID);
    const t = ev ? Date.parse(ev.timestamp) : NaN;
    if (!isFinite(t) || t < lunes.getTime()) continue;
    count++;
    totalMxn += r.amountMXN ?? mxnOf(r, rate);
  }
  return { count, totalMxn };
}

// ─── Lectura previa de NetSuite ──────────────────────────────
// Misma regla que el cruce real de "Marcar Pagado" (FinanceManagement): coincide si el pago de NetSuite está
// dentro de 1% (mínimo 1 unidad); si no coincide pero hay pagos libres, se marca como monto distinto
// (típico de retenciones). Es una referencia: la verificación definitiva sigue al pulsar Marcar Pagado.
export type NsTipo = "listo" | "distinto" | "sin_pago" | "usado" | "sin_oc" | "error";

export interface NsEstado {
  tipo: NsTipo;
  /** Diferencia % entre el pago de NetSuite y lo solicitado (solo "distinto"). */
  diffPct?: number;
  /** Pago de NetSuite al que apunta la lectura (para mostrar número y monto). */
  pago?: NSBill;
}

export function clasificarNs(bills: NSBill[], req: Request, claimed: Set<string>): NsEstado {
  const conPago = bills.filter((b) => b.payment_id);
  if (conPago.length === 0) return { tipo: "sin_pago" };
  const libres = conPago.filter((b) => !claimed.has(b.payment_id));
  if (libres.length === 0) return { tipo: "usado" };
  const tol = Math.max(1, req.amount * 0.01);
  const exacto = libres.find((b) => b.payment_amount != null && Math.abs(b.payment_amount - req.amount) <= tol);
  if (exacto) return { tipo: "listo", pago: exacto };
  const cercano = [...libres].sort((a, b) => Math.abs((a.payment_amount ?? 0) - req.amount) - Math.abs((b.payment_amount ?? 0) - req.amount))[0];
  const diff = cercano.payment_amount != null && req.amount > 0 ? ((cercano.payment_amount - req.amount) / req.amount) * 100 : undefined;
  return { tipo: "distinto", pago: cercano, diffPct: diff };
}
