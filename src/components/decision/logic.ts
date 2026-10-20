import { STATUS } from "../../data/mockData";
import type { PagoFlat, OcRecord, ForecastRecord, Decision } from "../../services/decision";

/** Clave con la que oc-data indexa las OC: sin espacios y en mayúsculas ("po-0098 12" → "PO-009812"). */
export const normOcKey = (oc: string | null | undefined): string | null =>
  oc ? String(oc).replace(/\s+/g, "").toUpperCase() : null;

// ─── Estado de aprobación de una OC ──────────────────────────
// Dos fuentes: la columna `estatus` de la hoja de control ("Aprobada"/"Rechazada") y la
// aprobación en NetSuite (`approval_ns`). La hoja manda cuando opina, pero NetSuite cubre lo
// que la hoja deja vacío (pasó con TODAS las OCs cuando se borró el encabezado de la columna).
// Si las dos se contradicen no se adivina: queda "conflicto" y decide una persona.
export type OcApprovalState = "aprobada" | "rechazada" | "pendiente" | "conflicto" | "sin_dato";

export interface OcApproval {
  state: OcApprovalState;
  /** Lo que dice cada fuente, para mostrarlo cuando hay contradicción. */
  sheet: string;
  ns: string;
}

type Signal = "aprobada" | "rechazada" | "pendiente" | null;

const sheetSignal = (est: string | undefined): Signal => {
  const e = (est || "").trim().toLowerCase();
  if (e === "aprobada") return "aprobada";
  if (e === "rechazada") return "rechazada";
  return e ? "pendiente" : null;
};

const nsSignal = (ns: string | undefined): Signal => {
  const e = (ns || "").trim().toLowerCase();
  if (e === "aprobado") return "aprobada";
  if (e === "rechazado") return "rechazada";
  return e ? "pendiente" : null; // "Aprobación pendiente" u otro valor sin aprobar
};

export function ocApproval(oc: OcRecord | null | undefined): OcApproval {
  const sheet = oc?.estatus || "";
  const ns = oc?.approval_ns || "";
  const signals = [sheetSignal(sheet), nsSignal(ns)].filter((s): s is Exclude<Signal, null> => s !== null);
  const unique = [...new Set(signals)];

  let state: OcApprovalState;
  if (unique.length === 0) state = "sin_dato";
  else if (unique.length === 1) state = unique[0];
  // Hay desacuerdo: si ninguna fuente aprueba, las dos son negativas y gana la más severa;
  // si una aprueba y otra no, es una contradicción real.
  else if (!unique.includes("aprobada")) state = "rechazada";
  else state = "conflicto";

  return { state, sheet, ns };
}

/** Etiqueta corta para chips e insignias. */
export const OC_STATE_LABEL: Record<OcApprovalState, string> = {
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  pendiente: "Pendiente",
  conflicto: "Contradictoria",
  sin_dato: "Sin estatus",
};

// ─── Decision logic ──────────────────────────────────────────
export function evalDecision(
  p: PagoFlat,
  ocData: Record<string, OcRecord>,
  fcData: Record<string, ForecastRecord>
): Decision {
  const ocKey = normOcKey(p.oc);
  const oc = ocKey ? ocData[ocKey] : null;
  const fc = p.proj_id ? fcData[p.proj_id.trim()] : null;

  // Cada verificación distingue tres cosas: "ok", "negativo" (hay evidencia en contra) y
  // "faltante" (no hay dato para juzgar). Antes "sin dato" y "mal" se trataban igual en
  // un caso y distinto en otro, y quedaba al revés: un solo dato faltante bloqueaba, mientras
  // que no tener ninguno solo pedía revisión.
  type Check = "ok" | "negativo" | "faltante";

  let ocCheck: Check;
  let oc_reason = "";
  if (!oc) {
    ocCheck = "faltante";
    oc_reason = `OC ${p.oc || "—"} sin registro de aprobación`;
  } else {
    const ap = ocApproval(oc);
    if (ap.state === "aprobada") {
      ocCheck = "ok";
      oc_reason = `OC aprobada${oc.fecha_apb ? ` el ${oc.fecha_apb}` : ""}${ap.sheet ? "" : " (según NetSuite)"}`;
    } else if (ap.state === "rechazada") {
      ocCheck = "negativo";
      oc_reason = "OC rechazada" + (oc.coment_oc ? ": " + oc.coment_oc.substring(0, 80) : "");
    } else if (ap.state === "pendiente") {
      ocCheck = "negativo";
      oc_reason = `OC sin aprobar (${ap.sheet || ap.ns || "pendiente"})`;
    } else if (ap.state === "conflicto") {
      // No se puede confirmar ni descartar: pasa a revisión humana mostrando las dos versiones.
      ocCheck = "faltante";
      oc_reason = `OC con estatus contradictorio: hoja de control "${ap.sheet || "—"}" vs NetSuite "${ap.ns || "—"}"`;
    } else {
      ocCheck = "faltante";
      oc_reason = `OC ${p.oc || "—"} registrada pero sin estatus de aprobación`;
    }
  }

  let avanceCheck: Check;
  let avance_reason = "";
  if (!fc) {
    avanceCheck = "faltante";
    avance_reason = `Proyecto ${p.proj_id || "—"} sin registro en pronósticos`;
  } else if (fc.pct_total == null) {
    avanceCheck = "faltante";
    avance_reason = "Pronóstico de avance no disponible";
  } else {
    const pctNum = fc.pct_total * 100;
    if (pctNum < 5) {
      avanceCheck = "negativo";
      avance_reason = `Proyecto no arrancado (${pctNum.toFixed(1)}% — debe ser ≥5%)`;
    } else if (pctNum > 99) {
      avanceCheck = "negativo";
      avance_reason = `Proyecto ya terminado (${pctNum.toFixed(1)}% — debe ser ≤99%)`;
    } else {
      avanceCheck = "ok";
      avance_reason = `Avance ${pctNum.toFixed(1)}% (entre 5% y 99% — proyecto activo)`;
    }
  }

  const mark = (c: Check) => (c === "ok" ? "✓ " : c === "negativo" ? "✗ " : "⚠ ");
  const reasons = [mark(ocCheck) + oc_reason, mark(avanceCheck) + avance_reason];
  const oc_ok = ocCheck === "ok" ? true : ocCheck === "negativo" ? false : null;
  const avance_ok = avanceCheck === "ok" ? true : avanceCheck === "negativo" ? false : null;

  // Procede: ambas verificaciones respaldan el pago.
  if (ocCheck === "ok" && avanceCheck === "ok") return { color: "verde", label: "Procede", reasons, oc_ok, avance_ok };
  // Bloquear: algo está mal (evidencia negativa) o no hay nada que respalde el pago.
  if (ocCheck === "negativo" || avanceCheck === "negativo" || (ocCheck === "faltante" && avanceCheck === "faltante")) {
    return { color: "rojo", label: "Bloquear", reasons, oc_ok, avance_ok };
  }
  // Revisar: una verificación respalda el pago y la otra no tiene dato → decide una persona.
  return { color: "amarillo", label: "Revisar", reasons, oc_ok, avance_ok };
}

// ─── Elegibilidad de acciones (decisión del admin) ───────────
// Flujo confirmado: MAC autoriza (→ Pending Fin), el admin decide aquí en un solo
// paso (→ Payment Approved, directo al analista) o rechaza / pide aclaración.
// "Approved" quedó fuera del flujo pero se acepta para destrabar filas legacy.
export const canDecideOn = (p: PagoFlat) => p.estatus === STATUS.PENDING_FIN || p.estatus === STATUS.APPROVED;

// ─── Filter state ────────────────────────────────────────────
export interface Filters {
  propuesta: Set<string>;
  venc: Set<string>;
  oc: string;
  decision: string;
  sortBy: "monto" | "urgencia";
  search: string;
  op: Set<string>;
  banco: Set<string>;
  cliente: Set<string>;
  prov: Set<string>;
}

export const defaultFilters = (): Filters => ({
  propuesta: new Set(),
  venc: new Set(),
  oc: "",
  decision: "",
  sortBy: "monto",
  search: "",
  op: new Set(),
  banco: new Set(),
  cliente: new Set(),
  prov: new Set(),
});
