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
  total_mxn: number;
  estatus: string;
  propuesta: string;
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
  meta: { fecha_hoy: string; fecha_corte: string; total_pagos: number };
}

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

async function safeFetch(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json();
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

// `onPartial` recibe los pagos apenas llegan de Sheets; el cruce OC/pronóstico
// (oc-data pega a NetSuite y es el endpoint lento) se completa después sin
// bloquear la primera pintura de la vista.
export async function loadDecisionData(onPartial?: (d: DecisionData) => void): Promise<DecisionData> {
  const ocPromise = safeFetch(`${BASE}/oc-data`);
  const fcPromise = safeFetch(`${BASE}/forecast-data`);
  // Si pagos-data falla primero, estas promesas quedarían sin handler
  ocPromise.catch(() => {});
  fcPromise.catch(() => {});

  const [pagoRes, tcRes] = await Promise.all([
    safeFetch(`${BASE}/pagos-data`),
    safeFetch(`${BASE}/tipo-cambio`),
  ]);
  if (onPartial) onPartial(assembleData(pagoRes, tcRes, {}, {}));

  const [ocRes, forecastRes] = await Promise.all([ocPromise, fcPromise]);
  const ocData: Record<string, OcRecord> = ocRes;
  normalizeOcDates(ocData);
  return assembleData(pagoRes, tcRes, ocData, forecastRes as Record<string, ForecastRecord>);
}

function assembleData(
  pagoRes: any,
  tcRes: any,
  ocData: Record<string, OcRecord>,
  forecastData: Record<string, ForecastRecord>
): DecisionData {
  const hoy = new Date();
  const TC_HOY: number = (Array.isArray(tcRes) && tcRes.length > 0 ? tcRes[tcRes.length - 1]?.rate : null) ?? 17.5;
  const pagosFlat: PagoFlat[] = [];

  for (const [ocKey, bucket] of Object.entries(pagoRes as Record<string, any>)) {
    if (ocKey === "_meta") continue;
    for (const p of (bucket.pagos || [])) {
      const venc: string = p.pago_programado || "";
      let venc_dias: number | null = null;
      let venc_bucket: VencBucket = "sin_fecha";
      if (venc) {
        const diff = Math.round((new Date(venc).getTime() - hoy.getTime()) / 86400000);
        venc_dias = diff;
        if (diff < 0) venc_bucket = "vencido";
        else if (diff === 0) venc_bucket = "hoy";
        else if (diff <= 7) venc_bucket = "semana";
        else if (diff <= 15) venc_bucket = "prox";
        else venc_bucket = "futuro";
      }
      const benef_clean = (p.beneficiario || "").replace(/^VEN-\d+\s+/, "");
      const proj_match = (p.proyecto || "").match(/(PROJ-\d+)/);
      const proj_id = proj_match ? proj_match[1] : "";
      const tc: number = p.tc || TC_HOY;

      pagosFlat.push({
        id: p.id,
        fecha_sol: p.fecha_solicitud || "",
        tipo_op: p.tipo_operacion || "",
        oc: ocKey === "_sin_oc" ? "" : ocKey,
        proyecto: p.proyecto || "",
        proj_id,
        cliente: p.cliente || "",
        beneficiario: p.beneficiario || "",
        benef_clean,
        concepto: p.concepto || "",
        venc,
        venc_dias,
        venc_bucket,
        factura: p.factura || "",
        monto: p.monto_solicitado || 0,
        divisa: p.divisa || "MXN",
        banco: p.banco || "",
        departamento: p.departamento || "",
        solicitante: p.solicitante || "",
        tc,
        total_mxn: p.monto_mxn || ((p.monto_solicitado || 0) * tc) || 0,
        estatus: p.estatus || "",
        propuesta: p.propuesta || "Sin categoría",
        operacion_cat: p.tipo_gasto || "",
        obs: p.obs_finanzas?.length ? p.obs_finanzas[0].text : "",
        prest: p.prestacion || "",
      });
    }
  }

  const sum = (arr: PagoFlat[]) => arr.reduce((a, x) => a + (x.total_mxn || 0), 0);
  const isProp = (p: PagoFlat) => p.propuesta === "Propuesta";
  const isAplaz = (p: PagoFlat) => p.propuesta === "Aplazado";

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
      fecha_hoy: hoy.toISOString().split("T")[0],
      fecha_corte: (pagoRes as any)._meta?.generado?.split("T")[0] || "",
      total_pagos: pagosFlat.length,
    },
  };
}
