// ============================================================
// src/services/decision.ts
// Data loading and transformation for Decisión de Pagos
// ============================================================

const BASE = import.meta.env.VITE_N8N_WEBHOOK_BASE;

// ─── OC (Purchase Order) ─────────────────────────────────────
export interface OcRecord {
  oc: string;
  estatus: string;
  fecha_sol: string;
  fecha_apb: string;
  solicitante: string;
  subtotal: number | null;
  presupuesto: number | null;
  diferencia: number | null;
  moneda: string;
  coment_oc: string;
  coment_costos: string;
  comentarios_req: string;
  item_revisado?: string;
  budget_item?: string;
  // NetSuite customer, resolved via purchaseOrder -> job -> customer (added
  // 2026-09, same join pattern as pagos-por-oc in the other workflow) — used
  // to backfill PagoFlat.cliente, which the sheet's own "Cliente" column
  // never gets populated with.
  customer_code?: string;
  customer_name?: string;
}

// ─── Forecast ────────────────────────────────────────────────
export interface ForecastHito {
  nombre: string;
  fecha: string;
  pct: number | null;
  estatus: string;
}

export interface ForecastRecord {
  pct_total: number | null;
  tecnologia: string;
  fecha_inicio: string;
  fecha_fin: string;
  prevista_commissioning: string;
  dias_desviacion: number | null;
  hitos: ForecastHito[];
}

// ─── Payments ────────────────────────────────────────────────
export type VencBucket = "vencido" | "hoy" | "semana" | "prox" | "futuro" | "sin_fecha";

export interface PagoFlat {
  id: string;
  fecha_sol: string;
  tipo_op: string;
  oc: string;
  proyecto: string;
  proj_id: string;
  cliente: string;
  beneficiario: string;
  benef_clean: string;
  concepto: string;
  venc: string;
  venc_dias: number | null;
  venc_bucket: VencBucket;
  factura: string;
  monto: number;
  divisa: string;
  banco: string;
  departamento: string;
  solicitante: string;
  tc: number;
  /** Moneda extranjera sin T/C ni monto MXN: `total_mxn` es 0 y no debe leerse como dato. */
  sin_tc: boolean;
  total_mxn: number;
  estatus: string;
  propuesta: string;
  // Normalized "Propuesta" (went straight to payment) vs "Aplazado" bucket, derived
  // from the raw `propuesta` label. PaymentModal's getProposal() only ever writes
  // "Autorizado" or "Aplazado" (plus the legacy "Pagada") — never the literal
  // "Propuesta" — so bucket comparisons must go through this field, not the raw one.
  propuesta_bucket: "Propuesta" | "Aplazado" | "";
  operacion_cat: string;
  obs: string;
  prest: string;
}

// ─── Decision ────────────────────────────────────────────────
export type DecisionColor = "verde" | "rojo" | "amarillo";

export interface Decision {
  color: DecisionColor;
  label: string;
  reasons: string[];
  oc_ok: boolean | null;
  avance_ok: boolean | null;
}

// ─── Summaries ───────────────────────────────────────────────
export interface ResumenOp {
  operacion: string;
  aplazado: number;
  propuesta: number;
  total: number;
}

export interface ResumenProv {
  nombre: string;
  nombre_display: string;
  aplazado: number;
  propuesta: number;
  total: number;
}

export interface KPIs {
  total_general: number;
  total_propuesta: number;
  total_aplazado: number;
  total_vencido: number;
  total_semana: number;
  n_total: number;
  n_propuesta: number;
  n_aplazado: number;
  n_vencido: number;
  n_semana: number;
}

export interface DecisionData {
  pagos: PagoFlat[];
  kpis: KPIs;
  resumen_op: ResumenOp[];
  resumen_prov: ResumenProv[];
  por_venc: Record<string, number>;
  monto_venc: Record<string, number>;
  oc_data: Record<string, OcRecord>;
  forecast_data: Record<string, ForecastRecord>;
  /** `cross_at`: cuándo se obtuvo el cruce OC/pronóstico (ms epoch); null si aún no hay. */
  meta: { fecha_hoy: string; fecha_corte: string; total_pagos: number; cross_at: number | null };
}

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

async function safeFetch(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  // n8n returns a genuinely empty body (not "{}") when a Sheets-backed read
  // resolves to zero rows — res.json() would throw on that, so parse text
  // ourselves and treat empty as "no data" rather than a fetch failure.
  const text = await res.text();
  if (!text || !text.trim()) return null;
  return JSON.parse(text);
}

function normalizeOcDates(ocData: Record<string, OcRecord>) {
  for (const oc of Object.values(ocData)) {
    if (oc.fecha_sol) {
      const m = oc.fecha_sol.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (m) oc.fecha_sol = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }
    if (oc.fecha_apb) {
      const m = oc.fecha_apb.match(/(\d{1,2})\s+de\s+(\w+)\s+del?\s+(\d{4})/i);
      if (m) {
        const mes = MESES[m[2].toLowerCase()];
        if (mes) oc.fecha_apb = `${m[3]}-${String(mes).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      }
    }
  }
}

// ─── Caché del cruce OC / pronóstico ─────────────────────────
// oc-data pega a NetSuite (~1.2 MB, ~6 s) y forecast-data tarda ~3 s, pero ambos cambian
// poco; lo que sí cambia con cada decisión es pagos-data. Se cachea a nivel de módulo (sobrevive
// a salir y volver a la vista) para que decidir y refrescar solo pidan pagos-data.
const CROSS_TTL_MS = 20 * 60 * 1000;

interface CrossCache {
  oc: Record<string, OcRecord>;
  fc: Record<string, ForecastRecord>;
  at: number;
}
let crossCache: CrossCache | null = null;
let crossInflight: Promise<CrossCache> | null = null;

const crossIsFresh = () => !!crossCache && Date.now() - crossCache.at < CROSS_TTL_MS;

// Una sola petición en vuelo aunque se disparen varias cargas a la vez (refresco + acción).
function fetchCross(): Promise<CrossCache> {
  if (crossInflight) return crossInflight;
  crossInflight = Promise.all([safeFetch(`${BASE}/oc-data`), safeFetch(`${BASE}/forecast-data`)])
    .then(([ocRes, fcRes]) => {
      const oc: Record<string, OcRecord> = ocRes ?? {};
      normalizeOcDates(oc);
      crossCache = { oc, fc: (fcRes ?? {}) as Record<string, ForecastRecord>, at: Date.now() };
      return crossCache;
    })
    .finally(() => { crossInflight = null; });
  return crossInflight;
}

export interface LoadOptions {
  /** Recibe los pagos apenas llegan de Sheets, antes de que termine el cruce con OC/pronóstico. */
  onPartial?: (d: DecisionData) => void;
  /** Ignora la caché del cruce (botón Actualizar). Si falla, el error se propaga en vez de usar datos viejos. */
  force?: boolean;
}

export async function loadDecisionData(opts: LoadOptions = {}): Promise<DecisionData> {
  const { onPartial, force } = opts;
  const needsCross = force || !crossIsFresh();
  const crossPromise = needsCross ? fetchCross() : null;
  // Si pagos-data falla primero, esta promesa quedaría sin handler
  crossPromise?.catch(() => {});

  const [pagoRes, tcRes] = await Promise.all([
    safeFetch(`${BASE}/pagos-data`),
    safeFetch(`${BASE}/tipo-cambio`),
  ]);

  if (!crossPromise) return assembleData(pagoRes ?? {}, tcRes, crossCache!.oc, crossCache!.fc, crossCache!.at);

  if (onPartial) onPartial(assembleData(pagoRes ?? {}, tcRes, {}, {}, null));
  try {
    const cross = await crossPromise;
    return assembleData(pagoRes ?? {}, tcRes, cross.oc, cross.fc, cross.at);
  } catch (e) {
    // Refresco automático con caché vencida: mejor un cruce de hace unos minutos que ninguno.
    // En un refresco forzado el usuario pidió datos nuevos, así que el fallo se muestra.
    if (!force && crossCache) return assembleData(pagoRes ?? {}, tcRes, crossCache.oc, crossCache.fc, crossCache.at);
    throw e;
  }
}

// "YYYY-MM-DD" → medianoche LOCAL de ese día. new Date("2026-10-20") lo interpreta como
// UTC (= 18:00 del día anterior en México) y desfasaba todos los vencimientos un día.
function localDayStart(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

const localISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Días de calendario entre hoy y `venc` (negativo = vencido); null si la fecha no se puede leer. */
export function diasParaVencer(venc: string, hoy: Date = new Date()): number | null {
  const target = localDayStart(venc);
  if (!target) return null;
  const today0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  // round (no floor): un cambio de horario deja días de 23/25 h.
  return Math.round((target.getTime() - today0.getTime()) / 86400000);
}

export function bucketVencimiento(diff: number): VencBucket {
  if (diff < 0) return "vencido";
  if (diff === 0) return "hoy";
  if (diff <= 7) return "semana";
  if (diff <= 14) return "prox";
  return "futuro";
}

function assembleData(
  pagoRes: any,
  tcRes: any,
  ocData: Record<string, OcRecord>,
  forecastData: Record<string, ForecastRecord>,
  crossAt: number | null
): DecisionData {
  const hoy = new Date();
  // Sin T/C real no se inventa uno: los pagos en moneda extranjera sin monto MXN
  // quedan marcados `sin_tc` en vez de calcularse con un número fijo.
  const TC_HOY: number | null = (Array.isArray(tcRes) && tcRes.length > 0 ? tcRes[tcRes.length - 1]?.rate : null) ?? null;
  const pagosFlat: PagoFlat[] = [];

  for (const [ocKey, bucket] of Object.entries(pagoRes as Record<string, any>)) {
    if (ocKey === "_meta") continue;
    for (const p of (bucket.pagos || [])) {
      const venc: string = p.pago_programado || "";
      let venc_dias: number | null = null;
      let venc_bucket: VencBucket = "sin_fecha";
      if (venc) {
        venc_dias = diasParaVencer(venc, hoy);
        if (venc_dias != null) venc_bucket = bucketVencimiento(venc_dias);
      }
      const benef_clean = (p.beneficiario || "").replace(/^VEN-\d+\s+/, "");
      const proj_match = (p.proyecto || "").match(/(PROJ-\d+)/);
      const proj_id = proj_match ? proj_match[1] : "";
      const divisa: string = p.divisa || "MXN";
      const monto: number = p.monto_solicitado || 0;
      // MXN no se convierte: antes un pago en pesos sin `monto_mxn` se multiplicaba por el T/C.
      const tc: number = divisa === "MXN" ? 1 : p.tc || TC_HOY || 0;
      const sin_tc = divisa !== "MXN" && !p.monto_mxn && !tc;
      const total_mxn: number = divisa === "MXN" ? p.monto_mxn || monto : p.monto_mxn || monto * tc;
      // The sheet's own "Cliente" column is never populated — fall back to
      // the NetSuite customer resolved per-OC in oc-data (see OcRecord).
      const cliente = p.cliente || (ocKey !== "_sin_oc" ? ocData[ocKey]?.customer_name : "") || "";

      pagosFlat.push({
        id: p.id,
        fecha_sol: p.fecha_solicitud || "",
        tipo_op: p.tipo_operacion || "",
        oc: ocKey === "_sin_oc" ? "" : ocKey,
        proyecto: p.proyecto || "",
        proj_id,
        cliente,
        beneficiario: p.beneficiario || "",
        benef_clean,
        concepto: p.concepto || "",
        venc,
        venc_dias,
        venc_bucket,
        factura: p.factura || "",
        monto,
        divisa,
        banco: p.banco || "",
        departamento: p.departamento || "",
        solicitante: p.solicitante || "",
        tc,
        sin_tc,
        total_mxn,
        estatus: p.estatus || "",
        propuesta: p.propuesta || "Sin categoría",
        propuesta_bucket: p.propuesta === "Aplazado" ? "Aplazado" : p.propuesta ? "Propuesta" : "",
        operacion_cat: p.tipo_gasto || "",
        obs: p.obs_finanzas?.length ? p.obs_finanzas[0].text : "",
        prest: p.prestacion || "",
      });
    }
  }

  const sum = (arr: PagoFlat[]) => arr.reduce((a, x) => a + (x.total_mxn || 0), 0);
  const isProp = (p: PagoFlat) => p.propuesta_bucket === "Propuesta";
  const isAplaz = (p: PagoFlat) => p.propuesta_bucket === "Aplazado";

  const kpis: KPIs = {
    total_general: sum(pagosFlat),
    total_propuesta: sum(pagosFlat.filter(isProp)),
    total_aplazado: sum(pagosFlat.filter(isAplaz)),
    total_vencido: sum(pagosFlat.filter((p) => p.venc_bucket === "vencido")),
    total_semana: sum(pagosFlat.filter((p) => p.venc_bucket === "semana" || p.venc_bucket === "hoy")),
    n_total: pagosFlat.length,
    n_propuesta: pagosFlat.filter(isProp).length,
    n_aplazado: pagosFlat.filter(isAplaz).length,
    n_vencido: pagosFlat.filter((p) => p.venc_bucket === "vencido").length,
    n_semana: pagosFlat.filter((p) => p.venc_bucket === "semana" || p.venc_bucket === "hoy").length,
  };

  const opMap: Record<string, ResumenOp> = {};
  for (const p of pagosFlat) {
    const k = p.operacion_cat || "Sin categoría";
    if (!opMap[k]) opMap[k] = { operacion: k, aplazado: 0, propuesta: 0, total: 0 };
    opMap[k].total += p.total_mxn;
    if (isProp(p)) opMap[k].propuesta += p.total_mxn;
    if (isAplaz(p)) opMap[k].aplazado += p.total_mxn;
  }

  const provMap: Record<string, ResumenProv> = {};
  for (const p of pagosFlat) {
    const k = p.benef_clean || "Sin proveedor";
    if (!provMap[k]) provMap[k] = { nombre: p.beneficiario || k, nombre_display: k, aplazado: 0, propuesta: 0, total: 0 };
    provMap[k].total += p.total_mxn;
    if (isProp(p)) provMap[k].propuesta += p.total_mxn;
    if (isAplaz(p)) provMap[k].aplazado += p.total_mxn;
  }

  const BUCKETS: VencBucket[] = ["vencido", "hoy", "semana", "prox", "futuro", "sin_fecha"];
  const por_venc: Record<string, number> = {};
  const monto_venc: Record<string, number> = {};
  for (const b of BUCKETS) {
    const subset = pagosFlat.filter((p) => p.venc_bucket === b);
    por_venc[b] = subset.length;
    monto_venc[b] = sum(subset);
  }

  return {
    pagos: pagosFlat,
    kpis,
    resumen_op: Object.values(opMap).sort((a, b) => b.total - a.total),
    resumen_prov: Object.values(provMap).sort((a, b) => b.total - a.total),
    por_venc,
    monto_venc,
    oc_data: ocData,
    forecast_data: forecastData,
    meta: {
      fecha_hoy: localISODate(hoy),
      fecha_corte: (pagoRes as any)._meta?.generado?.split("T")[0] || "",
      total_pagos: pagosFlat.length,
      cross_at: crossAt,
    },
  };
}
