// ============================================================
// src/components/DecisionPagos.tsx
// Decisión de Pagos — full port from decision_pagos.html
// ============================================================
import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { RefreshCw, Download, Copy, X, ChevronDown, ChevronUp } from "lucide-react";
import {
  loadDecisionData,
  type DecisionData,
  type PagoFlat,
  type OcRecord,
  type ForecastRecord,
  type Decision,
  type DecisionColor,
  type VencBucket,
} from "../services/decision";

// ─── Theme tokens ────────────────────────────────────────────
const T = {
  jade: "#00AA85",
  jadeFaint: "rgba(0,170,133,0.14)",
  steel: "#3D7D9C",
  steelFaint: "rgba(61,125,156,0.14)",
  ink: "#293C47",
  red: "#ef4444",
  redFaint: "rgba(239,68,68,0.14)",
  amber: "#f59e0b",
  amberFaint: "rgba(245,158,11,0.14)",
  pageBg: "#121926",
  cardBg: "rgba(255,255,255,0.04)",
  cardBorder: "rgba(255,255,255,0.08)",
  text: "rgba(255,255,255,0.9)",
  textSub: "rgba(255,255,255,0.6)",
  textMuted: "rgba(255,255,255,0.38)",
  font: "Alexandria, sans-serif",
  fontAlt: "Albert Sans, sans-serif",
};

const DECISION_COLORS: Record<DecisionColor, { bg: string; text: string; dot: string }> = {
  verde: { bg: "rgba(0,170,133,0.14)", text: T.jade, dot: T.jade },
  rojo: { bg: "rgba(239,68,68,0.14)", text: T.red, dot: T.red },
  amarillo: { bg: "rgba(245,158,11,0.14)", text: T.amber, dot: T.amber },
};

const OP_COLORS = ["#00AA85", "#3D7D9C", "#293C47", "#7c9dad", "#a0bbc8"];

// ─── Formatters ──────────────────────────────────────────────
const fmtN = (n: number) =>
  new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(Math.round(n));

const fmtMXN = (n: number | null | undefined) => {
  if (n == null || isNaN(n)) return "—";
  return "$" + fmtN(n);
};

const fmtMXNk = (n: number | null | undefined) => {
  if (n == null || isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return "$" + (n / 1_000).toFixed(0) + "k";
  return fmtMXN(n);
};

const fmtPct = (n: number) => (n * 100).toFixed(1) + "%";

const fmtFecha = (s: string | null | undefined) => {
  if (!s) return "—";
  try {
    const d = new Date(s + "T12:00:00");
    return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" });
  } catch {
    return s;
  }
};

const fmtMoney = (v: number | null | undefined, moneda?: string) => {
  if (v == null || isNaN(v)) return "—";
  const prefix = moneda === "USD" || moneda === "MXN" ? "$" : "";
  return prefix + Number(v).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ─── Decision logic ──────────────────────────────────────────
function evalDecision(
  p: PagoFlat,
  ocData: Record<string, OcRecord>,
  fcData: Record<string, ForecastRecord>
): Decision {
  const ocKey = p.oc ? String(p.oc).replace(/\s+/g, "").toUpperCase() : null;
  const oc = ocKey ? ocData[ocKey] : null;
  const fc = p.proj_id ? fcData[p.proj_id.trim()] : null;

  if (!oc && !fc) {
    return {
      color: "amarillo",
      label: "Revisar",
      reasons: ["Sin OC en control de aprobaciones", "Sin proyecto en pronósticos — revisar manualmente"],
      oc_ok: null,
      avance_ok: null,
    };
  }

  let oc_ok = false;
  let oc_reason = "";
  if (!oc) {
    oc_reason = `OC ${p.oc || "—"} sin registro de aprobación`;
  } else {
    const est = (oc.estatus || "").toLowerCase();
    if (est === "aprobada") {
      oc_ok = true;
      oc_reason = `OC aprobada el ${oc.fecha_apb || "—"}`;
    } else if (est === "rechazada") {
      oc_reason = "OC rechazada" + (oc.coment_oc ? ": " + oc.coment_oc.substring(0, 80) : "");
    } else {
      oc_reason = `OC sin aprobar (${oc.estatus || "pendiente"})`;
    }
  }

  let avance_ok = false;
  let avance_reason = "";
  if (!fc) {
    avance_reason = `Proyecto ${p.proj_id || "—"} sin registro en pronósticos`;
  } else {
    const pct = fc.pct_total;
    if (pct == null) {
      avance_reason = "Pronóstico de avance no disponible";
    } else {
      const pctNum = pct * 100;
      if (pctNum < 5) {
        avance_reason = `Proyecto no arrancado (${pctNum.toFixed(1)}% — debe ser ≥5%)`;
      } else if (pctNum > 99) {
        avance_reason = `Proyecto ya terminado (${pctNum.toFixed(1)}% — debe ser ≤99%)`;
      } else {
        avance_ok = true;
        avance_reason = `Avance ${pctNum.toFixed(1)}% (entre 5% y 99% — proyecto activo)`;
      }
    }
  }

  const reasons = [
    (oc_ok ? "✓ " : "✗ ") + oc_reason,
    (avance_ok ? "✓ " : "✗ ") + avance_reason,
  ];

  if (oc_ok && avance_ok) return { color: "verde", label: "Procede", reasons, oc_ok, avance_ok };
  return { color: "rojo", label: "Bloquear", reasons, oc_ok, avance_ok };
}

// ─── Filter state ────────────────────────────────────────────
interface Filters {
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

const defaultFilters = (): Filters => ({
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

// ─── MultiSelect dropdown ────────────────────────────────────
interface MultiSelectProps {
  label: string;
  options: string[];
  selected: Set<string>;
  counts?: Record<string, number>;
  onChange: (updated: Set<string>) => void;
}

const MultiSelect: React.FC<MultiSelectProps> = ({ label, options, selected, counts, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter((o) => !search || o.toLowerCase().includes(search.toLowerCase()));

  const btnLabel =
    selected.size === 0 ? label :
    selected.size === 1 ? [...selected][0] :
    `${label}: ${selected.size}`;

  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange(next);
  };

  const selectAll = () => { const next = new Set(selected); filtered.forEach((o) => next.add(o)); onChange(next); };
  const selectNone = () => {
    const next = new Set(selected);
    if (!search) { next.clear(); }
    else { filtered.forEach((o) => next.delete(o)); }
    onChange(next);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((p) => !p)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 12px", border: `1px solid ${selected.size > 0 ? T.jade : T.cardBorder}`,
          borderRadius: 6, background: selected.size > 0 ? T.jadeFaint : T.cardBg,
          color: selected.size > 0 ? T.jade : T.textSub,
          fontSize: 12, fontFamily: T.font, cursor: "pointer", whiteSpace: "nowrap",
          transition: "all 0.15s",
        }}
      >
        {btnLabel}
        <ChevronDown size={12} style={{ opacity: 0.7 }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100,
          background: "#1a2738", border: `1px solid ${T.cardBorder}`, borderRadius: 8,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)", minWidth: 220, maxWidth: 300,
        }}>
          <div style={{ padding: "8px 10px", borderBottom: `1px solid ${T.cardBorder}` }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              style={{
                width: "100%", padding: "5px 8px", border: `1px solid ${T.cardBorder}`,
                borderRadius: 5, background: "rgba(255,255,255,0.06)", color: T.text,
                fontSize: 12, fontFamily: T.fontAlt, outline: "none",
              }}
              autoFocus
            />
          </div>
          <div style={{ display: "flex", gap: 6, padding: "6px 10px", borderBottom: `1px solid ${T.cardBorder}` }}>
            {["Todos", "Ninguno"].map((a) => (
              <button key={a} onClick={a === "Todos" ? selectAll : selectNone}
                style={{
                  padding: "3px 10px", background: T.cardBg, border: `1px solid ${T.cardBorder}`,
                  borderRadius: 4, color: T.textSub, fontSize: 11, fontFamily: T.font, cursor: "pointer",
                }}>{a}</button>
            ))}
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto", padding: "4px 0" }}>
            {filtered.length === 0 && (
              <div style={{ padding: "8px 12px", color: T.textMuted, fontSize: 12 }}>Sin resultados</div>
            )}
            {filtered.map((o) => (
              <label key={o} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", cursor: "pointer",
                background: selected.has(o) ? T.jadeFaint : "transparent",
                transition: "background 0.1s",
              }}>
                <input type="checkbox" checked={selected.has(o)} onChange={() => toggle(o)}
                  style={{ accentColor: T.jade, width: 13, height: 13, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, fontFamily: T.fontAlt, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o}</span>
                {counts?.[o] != null && (
                  <span style={{ fontSize: 10, color: T.textMuted, fontFamily: T.fontAlt }}>{counts[o]}</span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Urgency label ───────────────────────────────────────────
function urgLabel(p: PagoFlat): { text: string; color: string } {
  const b = p.venc_bucket;
  if (b === "vencido") return { text: `Vencido · ${Math.abs(p.venc_dias!)}d`, color: T.red };
  if (b === "hoy") return { text: "Vence hoy", color: T.amber };
  if (b === "semana") return { text: `En ${p.venc_dias}d`, color: T.amber };
  if (b === "prox") return { text: `En ${p.venc_dias}d`, color: T.steel };
  if (b === "futuro") return { text: `+${p.venc_dias}d`, color: T.textMuted };
  return { text: "Sin fecha", color: T.textMuted };
}

// ─── OC status chip ──────────────────────────────────────────
function OcChip({ p, ocData }: { p: PagoFlat; ocData: Record<string, OcRecord> }) {
  if (!p.oc) return <Chip label="Sin OC" color={T.textMuted} bg="rgba(255,255,255,0.08)" />;
  const key = String(p.oc).replace(/\s+/g, "").toUpperCase();
  const oc = ocData[key];
  if (!oc) return <Chip label="OC s/reg." color={T.textMuted} bg="rgba(255,255,255,0.08)" title={`OC ${p.oc} no encontrada`} />;
  const est = (oc.estatus || "").toLowerCase();
  if (est === "aprobada") return <Chip label="OC ✓" color={T.jade} bg={T.jadeFaint} title={`Aprobada el ${fmtFecha(oc.fecha_apb)}`} />;
  if (est === "rechazada") return <Chip label="OC ✗" color={T.red} bg={T.redFaint} />;
  return <Chip label={`OC ${oc.estatus || "Pend."}`} color={T.amber} bg={T.amberFaint} />;
}

const Chip = ({ label, color, bg, title }: { label: string; color: string; bg: string; title?: string }) => (
  <span title={title} style={{
    display: "inline-flex", alignItems: "center",
    padding: "2px 8px", borderRadius: 4, fontSize: 11, fontFamily: T.fontAlt,
    fontWeight: 600, color, background: bg, letterSpacing: "0.01em",
  }}>{label}</span>
);

// ─── Payment card ────────────────────────────────────────────
interface CardProps {
  p: PagoFlat;
  decision: Decision;
  selected: boolean;
  expanded: boolean;
  ocData: Record<string, OcRecord>;
  fcData: Record<string, ForecastRecord>;
  onToggleSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
}

const PaymentCard: React.FC<CardProps> = ({
  p, decision, selected, expanded, ocData, fcData, onToggleSelect, onToggleExpand,
}) => {
  const urg = urgLabel(p);
  const dc = DECISION_COLORS[decision.color];
  const tagColor = p.propuesta === "Propuesta" ? T.jade : T.steel;
  const tagBg = p.propuesta === "Propuesta" ? T.jadeFaint : T.steelFaint;

  return (
    <div
      onClick={(e) => {
        if ((e.target as HTMLElement).closest(".card-checkbox")) return;
        onToggleExpand(p.id);
      }}
      style={{
        background: selected ? "rgba(0,170,133,0.06)" : T.cardBg,
        border: `1px solid ${selected ? T.jade : expanded ? "rgba(255,255,255,0.14)" : T.cardBorder}`,
        borderLeft: `3px solid ${dc.dot}`,
        borderRadius: 8, marginBottom: 6, cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      {/* Card header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px 10px" }}>
        {/* Checkbox */}
        <div
          className="card-checkbox"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(p.id); }}
          style={{ paddingTop: 2, flexShrink: 0 }}
        >
          <input type="checkbox" checked={selected} onChange={() => {}} style={{ accentColor: T.jade, width: 14, height: 14, cursor: "pointer" }} />
        </div>

        {/* Propuesta tag */}
        <div style={{ flexShrink: 0, minWidth: 80, textAlign: "center" }}>
          <div style={{
            padding: "3px 8px", borderRadius: 4, background: tagBg,
            color: tagColor, fontSize: 11, fontWeight: 700, fontFamily: T.font, letterSpacing: "0.02em",
          }}>{p.propuesta || "—"}</div>
          <div style={{ fontSize: 10, color: T.textMuted, fontFamily: T.fontAlt, marginTop: 2, lineHeight: 1.2 }}>
            {p.operacion_cat || "—"}
          </div>
        </div>

        {/* Main info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 4 }}>
            {p.tipo_op && (
              <span style={{ padding: "2px 7px", background: "rgba(255,255,255,0.08)", borderRadius: 4, fontSize: 11, color: T.textSub, fontFamily: T.fontAlt }}>
                {p.tipo_op}
              </span>
            )}
            {p.proj_id && (
              <span style={{ padding: "2px 7px", background: T.steelFaint, borderRadius: 4, fontSize: 11, color: T.steel, fontFamily: T.fontAlt, fontWeight: 600 }}>
                {p.proj_id}
              </span>
            )}
            {urg.text !== "Sin fecha" && (
              <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: 11, fontFamily: T.fontAlt, fontWeight: 600, color: urg.color, background: "transparent", border: `1px solid ${urg.color}30` }}>
                {urg.text}
              </span>
            )}
            <OcChip p={p} ocData={ocData} />
            <Chip
              label={decision.label}
              color={dc.text}
              bg={dc.bg}
              title={decision.reasons.join(" | ")}
            />
          </div>
          <div style={{ fontSize: 13, color: T.text, fontFamily: T.fontAlt, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3 }}>
            {p.proyecto || p.tipo_op || "—"}
          </div>
          <div style={{ fontSize: 12, color: T.textSub, fontFamily: T.fontAlt, display: "flex", gap: 12 }}>
            <span>Cliente: <strong style={{ color: T.text }}>{p.cliente || "—"}</strong></span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.concepto}</span>
          </div>
        </div>

        {/* Beneficiary */}
        <div style={{ flexShrink: 0, minWidth: 120, textAlign: "right" }}>
          <div style={{ fontSize: 10, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Beneficiario</div>
          <div style={{ fontSize: 12, color: T.text, fontFamily: T.fontAlt, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }} title={p.beneficiario}>
            {p.benef_clean || "—"}
          </div>
          <div style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt }}>
            {[p.banco, p.departamento].filter(Boolean).join(" · ")}
          </div>
        </div>

        {/* Factura */}
        <div style={{ flexShrink: 0, minWidth: 100, textAlign: "right" }}>
          <div style={{ fontSize: 10, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Factura · Vence</div>
          <div style={{ fontSize: 12, color: T.text, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }} title={p.factura}>
            {p.factura || "—"}
          </div>
          <div style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt }}>{fmtFecha(p.venc)}</div>
        </div>

        {/* Amount */}
        <div style={{ flexShrink: 0, minWidth: 110, textAlign: "right" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: "monospace", fontVariantNumeric: "tabular-nums" }}>
            {fmtMXN(p.total_mxn)}
          </div>
          <div style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt }}>
            {p.divisa !== "MXN" ? `${p.divisa} ${fmtN(p.monto)} · TC ${p.tc}` : "MXN"}
          </div>
        </div>

        {/* Expand toggle */}
        <div style={{ flexShrink: 0, paddingTop: 2, color: T.textMuted }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && <ExpandedPanel p={p} decision={decision} ocData={ocData} fcData={fcData} />}
    </div>
  );
};

// ─── Expanded panel ──────────────────────────────────────────
const ExpandedPanel: React.FC<{
  p: PagoFlat;
  decision: Decision;
  ocData: Record<string, OcRecord>;
  fcData: Record<string, ForecastRecord>;
}> = ({ p, decision, ocData, fcData }) => {
  const dc = DECISION_COLORS[decision.color];
  const ocKey = p.oc ? String(p.oc).replace(/\s+/g, "").toUpperCase() : null;
  const oc = ocKey ? ocData[ocKey] : null;
  const fc = p.proj_id ? fcData[p.proj_id.trim()] : null;
  const titleMap: Record<DecisionColor, string> = {
    verde: "✓ Procede el pago",
    rojo: "✗ No procede el pago",
    amarillo: "⚠ Revisar manualmente",
  };

  return (
    <div style={{ padding: "0 14px 16px", borderTop: `1px solid ${T.cardBorder}`, paddingTop: 14 }}>
      {/* Decision summary */}
      <div style={{
        padding: "10px 14px", borderRadius: 6, background: dc.bg,
        border: `1px solid ${dc.text}30`, marginBottom: 14,
      }}>
        <div style={{ fontWeight: 700, color: dc.text, fontSize: 13, fontFamily: T.font, marginBottom: 4 }}>
          {titleMap[decision.color]}
        </div>
        {decision.reasons.map((r, i) => (
          <div key={i} style={{ fontSize: 12, color: T.textSub, fontFamily: T.fontAlt, lineHeight: 1.5 }}>{r}</div>
        ))}
      </div>

      {/* Detail grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
        <ExpBlock title="Documento">
          <ExpField label="OC" value={p.oc || "—"} mono />
          <ExpField label="Factura" value={p.factura || "—"} mono />
          <ExpField label="Concepto" value={p.concepto || "—"} />
          <ExpField label="Prestación" value={p.prest || "—"} />
        </ExpBlock>
        <ExpBlock title="Importe y banco">
          <ExpField label="Monto origen" value={`${p.divisa} ${fmtN(p.monto)}`} mono />
          <ExpField label="Tipo de cambio" value={String(p.tc)} mono />
          <ExpField label="Total MXN" value={fmtMXN(p.total_mxn)} mono bold />
          <ExpField label="Banco" value={p.banco || "—"} />
          <ExpField label="Estatus pago" value={p.estatus || "—"} />
          <ExpField label="Propuesta" value={p.propuesta || "—"} />
        </ExpBlock>
        <ExpBlock title="Solicitud y proveedor">
          <ExpField label="Fecha solicitud" value={fmtFecha(p.fecha_sol)} mono />
          <ExpField label="Vencimiento" value={fmtFecha(p.venc)} mono />
          <ExpField label="Departamento" value={p.departamento || "—"} />
          <ExpField label="Solicitante" value={p.solicitante || "—"} />
          <ExpField label="Beneficiario" value={p.beneficiario || "—"} />
        </ExpBlock>
      </div>

      {/* Cross blocks */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <OcBlock oc={oc} p={p} />
        <ForecastBlock fc={fc} p={p} />
      </div>

      {p.obs && (
        <div style={{
          marginTop: 10, padding: "8px 12px", background: "rgba(255,255,255,0.04)",
          borderRadius: 6, fontSize: 12, color: T.textSub, fontFamily: T.fontAlt,
          borderLeft: `3px solid ${T.steel}`,
        }}>
          <strong style={{ color: T.text }}>Obs. finanzas: </strong>{p.obs}
        </div>
      )}
    </div>
  );
};

const ExpBlock: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 6, padding: "10px 12px" }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, fontFamily: T.font, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{title}</div>
    {children}
  </div>
);

const ExpField: React.FC<{ label: string; value: string; mono?: boolean; bold?: boolean }> = ({ label, value, mono, bold }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, gap: 8 }}>
    <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt, flexShrink: 0 }}>{label}</span>
    <span style={{
      fontSize: 12, color: T.text, fontFamily: mono ? "monospace" : T.fontAlt,
      fontWeight: bold ? 700 : 400, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis",
    }}>{value}</span>
  </div>
);

const StatusBadge: React.FC<{ estatus: string }> = ({ estatus }) => {
  const e = (estatus || "").toLowerCase();
  const c = e === "aprobada" ? T.jade : e === "rechazada" ? T.red : T.amber;
  const bg = e === "aprobada" ? T.jadeFaint : e === "rechazada" ? T.redFaint : T.amberFaint;
  return (
    <span style={{ padding: "2px 8px", borderRadius: 4, background: bg, color: c, fontSize: 11, fontWeight: 600, fontFamily: T.fontAlt }}>
      {estatus || "Sin estatus"}
    </span>
  );
};

const OcBlock: React.FC<{ oc: OcRecord | null; p: PagoFlat }> = ({ oc, p }) => {
  if (!oc) return (
    <CrossBlock title="Aprobación de OC" badge={<Chip label="Sin registro" color={T.textMuted} bg="rgba(255,255,255,0.08)" />}>
      <p style={{ fontSize: 12, color: T.textSub, fontFamily: T.fontAlt }}>
        La OC <strong>{p.oc || "—"}</strong> no se encontró en el control de aprobaciones.
      </p>
    </CrossBlock>
  );

  const diffColor = oc.diferencia == null ? T.textMuted : oc.diferencia >= 0 ? T.jade : T.red;

  return (
    <CrossBlock title="Aprobación de OC" badge={<StatusBadge estatus={oc.estatus} />}>
      {[
        ["OC", oc.oc],
        ["Solicitud", fmtFecha(oc.fecha_sol)],
        ["Aprobación", fmtFecha(oc.fecha_apb)],
        ["Solicitante", oc.solicitante || "—"],
        ["Subtotal", fmtMoney(oc.subtotal, oc.moneda) + " " + (oc.moneda || "")],
        ["Presupuesto", fmtMoney(oc.presupuesto, oc.moneda)],
      ].map(([l, v]) => (
        <div key={l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, gap: 8 }}>
          <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt }}>{l}</span>
          <span style={{ fontSize: 12, color: T.text, fontFamily: T.fontAlt }}>{v}</span>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, gap: 8 }}>
        <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt }}>Diferencia</span>
        <span style={{ fontSize: 12, color: diffColor, fontFamily: "monospace" }}>
          {oc.diferencia == null ? "—" : fmtMoney(oc.diferencia, oc.moneda)}
        </span>
      </div>
      {[oc.coment_oc, oc.coment_costos, oc.comentarios_req].filter(Boolean).map((c, i) => (
        <div key={i} style={{ marginTop: 6, padding: "6px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 4, fontSize: 11, color: T.textSub, fontFamily: T.fontAlt }}>
          {c}
        </div>
      ))}
    </CrossBlock>
  );
};

const ForecastBlock: React.FC<{ fc: ForecastRecord | null; p: PagoFlat }> = ({ fc, p }) => {
  if (!fc) return (
    <CrossBlock title="Pronóstico de avance" badge={<Chip label="Sin registro" color={T.textMuted} bg="rgba(255,255,255,0.08)" />}>
      <p style={{ fontSize: 12, color: T.textSub, fontFamily: T.fontAlt }}>
        El proyecto <strong>{p.proj_id || "—"}</strong> no se encontró en pronósticos.
      </p>
    </CrossBlock>
  );

  const pct = fc.pct_total != null ? fc.pct_total * 100 : 0;
  const desvColor = fc.dias_desviacion == null ? T.textMuted : fc.dias_desviacion > 0 ? T.red : T.jade;
  const desvLabel = fc.dias_desviacion == null ? "—" : fc.dias_desviacion > 0 ? `+${fc.dias_desviacion}d` : `${fc.dias_desviacion}d`;

  return (
    <CrossBlock title={`Pronóstico de avance · ${fc.tecnologia || ""}`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.text, fontFamily: "monospace" }}>{pct.toFixed(1)}%</div>
          <div style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt }}>avance ponderado</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt }}>
          <div>Inicio: <strong style={{ color: T.text }}>{fmtFecha(fc.fecha_inicio) || "—"}</strong></div>
          <div>Fin: <strong style={{ color: T.text }}>{fmtFecha(fc.fecha_fin) || "—"}</strong></div>
        </div>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, marginBottom: 8 }}>
        <div style={{ height: "100%", borderRadius: 3, background: T.jade, width: `${Math.min(pct, 100)}%`, transition: "width 0.6s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt, marginBottom: 10 }}>
        <span>Commissioning: <strong style={{ color: T.text }}>{fmtFecha(fc.prevista_commissioning) || "—"}</strong></span>
        <span>Desv: <strong style={{ color: desvColor }}>{desvLabel}</strong></span>
      </div>
      <div>
        {(fc.hitos || []).map((h, i) => {
          const est = (h.estatus || "").toLowerCase();
          const dotColor = est === "cumplido" ? T.jade : est === "cumplido futuro" ? T.steel : est ? T.amber : T.textMuted;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 11, color: T.textSub, fontFamily: T.fontAlt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.nombre}</span>
              <span style={{ fontSize: 10, color: T.textMuted, fontFamily: T.fontAlt, flexShrink: 0 }}>{fmtFecha(h.fecha)}</span>
              <span style={{ fontSize: 10, color: T.textMuted, fontFamily: "monospace", flexShrink: 0 }}>
                {h.pct != null ? (h.pct * 100).toFixed(1) + "%" : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </CrossBlock>
  );
};

const CrossBlock: React.FC<{ title: string; badge?: React.ReactNode; children: React.ReactNode }> = ({ title, badge, children }) => (
  <div style={{
    background: "rgba(255,255,255,0.03)", borderRadius: 6, padding: "10px 12px",
    border: `1px solid ${T.cardBorder}`,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, fontFamily: T.font, textTransform: "uppercase", letterSpacing: "0.1em" }}>{title}</div>
      {badge}
    </div>
    {children}
  </div>
);

// ─── KPI Strip ───────────────────────────────────────────────
const KPICard: React.FC<{ label: string; value: string; sub?: string; accentColor?: string }> = ({ label, value, sub, accentColor = T.jade }) => (
  <div style={{
    flex: 1, minWidth: 140, padding: "14px 16px",
    background: T.cardBg, border: `1px solid ${T.cardBorder}`,
    borderRadius: 8,
  }}>
    <div style={{ fontSize: 11, fontWeight: 500, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color: accentColor, fontFamily: "monospace", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt, marginTop: 2 }}>{sub}</div>}
  </div>
);

// ─── Tab: Resumen ────────────────────────────────────────────
const TabResumen: React.FC<{ data: DecisionData }> = ({ data }) => {
  const { resumen_op, kpis } = data;
  const total = kpis.total_general;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        {/* Donut: distribution by operation */}
        <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: "16px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: T.font, marginBottom: 12 }}>Distribución por categoría de operación</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={resumen_op} dataKey="total" cx="45%" cy="50%" outerRadius={75} innerRadius={45} paddingAngle={2}>
                {resumen_op.map((_, i) => <Cell key={i} fill={OP_COLORS[i % OP_COLORS.length]} stroke="transparent" />)}
              </Pie>
              <Tooltip
                formatter={(v: any) => [`$${fmtN(v)} (${(v / total * 100).toFixed(1)}%)`, ""]}
                contentStyle={{ background: "#1a2738", border: `1px solid ${T.cardBorder}`, borderRadius: 6, fontSize: 12, fontFamily: T.fontAlt }}
                labelStyle={{ color: T.text }}
                itemStyle={{ color: T.textSub }}
              />
              <Legend
                formatter={(v) => <span style={{ fontSize: 12, color: T.textSub, fontFamily: T.fontAlt }}>{v}</span>}
                iconType="circle"
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Stacked bar: propuesta vs aplazado */}
        <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: "16px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: T.font, marginBottom: 12 }}>Propuesta vs Aplazado por operación</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={resumen_op} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" tick={{ fill: T.textMuted, fontSize: 11, fontFamily: T.fontAlt }}
                tickFormatter={(v) => "$" + (v / 1_000_000).toFixed(1) + "M"} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="operacion" tick={{ fill: T.textSub, fontSize: 11, fontFamily: T.fontAlt }}
                width={90} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: any, name) => [`$${fmtN(v)}`, name]}
                contentStyle={{ background: "#1a2738", border: `1px solid ${T.cardBorder}`, borderRadius: 6, fontSize: 12, fontFamily: T.fontAlt }}
                labelStyle={{ color: T.text }}
                itemStyle={{ color: T.textSub }}
              />
              <Legend formatter={(v) => <span style={{ fontSize: 12, color: T.textSub, fontFamily: T.fontAlt }}>{v}</span>} />
              <Bar dataKey="propuesta" name="Propuesta" stackId="a" fill={T.jade} radius={0} />
              <Bar dataKey="aplazado" name="Aplazado" stackId="a" fill={T.steel} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table: resumen by operation */}
      <SectionCard title="Resumen por Operación" meta="MXN">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Categoría", "Aplazado", "Propuesta", "Total", "% del total"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", borderBottom: `1px solid ${T.cardBorder}`, fontSize: 11, fontWeight: 600, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: h === "Categoría" ? "left" : "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resumen_op.map((r) => (
                <tr key={r.operacion} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                  <td style={{ padding: "9px 12px", fontSize: 13, color: T.text, fontFamily: T.fontAlt, fontWeight: 500 }}>{r.operacion}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13, color: T.steel, fontFamily: "monospace" }}>{fmtMXN(r.aplazado)}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13, color: T.jade, fontFamily: "monospace" }}>{fmtMXN(r.propuesta)}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13, color: T.text, fontFamily: "monospace", fontWeight: 700 }}>{fmtMXN(r.total)}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 12, color: T.textSub, fontFamily: T.fontAlt }}>{fmtPct(r.total / total)}</td>
                </tr>
              ))}
              <TotalRow cells={[
                { value: "Total general", align: "left", bold: true },
                { value: fmtMXN(kpis.total_aplazado), color: T.steel },
                { value: fmtMXN(kpis.total_propuesta), color: T.jade },
                { value: fmtMXN(total), bold: true },
                { value: "100.0%" },
              ]} />
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Table: providers by category */}
      <SectionCard title="Detalle de Proveedores" meta="MXN · jerarquía proveedor">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Proveedor", "Aplazado", "Propuesta", "Total"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", borderBottom: `1px solid ${T.cardBorder}`, fontSize: 11, fontWeight: 600, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: h === "Proveedor" ? "left" : "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.resumen_prov.slice(0, 20).map((r) => (
                <tr key={r.nombre_display} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                  <td style={{ padding: "8px 12px", fontSize: 12, color: T.text, fontFamily: T.fontAlt }}>{r.nombre_display}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: T.steel, fontFamily: "monospace" }}>{fmtMXN(r.aplazado)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: T.jade, fontFamily: "monospace" }}>{fmtMXN(r.propuesta)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: T.text, fontFamily: "monospace", fontWeight: 600 }}>{fmtMXN(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
};

// ─── Tab: Proveedores ────────────────────────────────────────
const TabProveedores: React.FC<{ data: DecisionData }> = ({ data }) => {
  const total = data.kpis.total_general;
  const map: Record<string, { nombre: string; pagos: number; propuesta: number; aplazado: number; total: number }> = {};
  data.pagos.forEach((p) => {
    const k = p.benef_clean || p.beneficiario || "Sin proveedor";
    if (!map[k]) map[k] = { nombre: k, pagos: 0, propuesta: 0, aplazado: 0, total: 0 };
    map[k].pagos++;
    map[k].total += p.total_mxn;
    if (p.propuesta === "Aplazado") map[k].aplazado += p.total_mxn;
    else map[k].propuesta += p.total_mxn;
  });
  const arr = Object.values(map).sort((a, b) => b.total - a.total);
  let acc = 0;

  return (
    <SectionCard title="Concentración por proveedor" meta={`${arr.length} proveedores · MXN`}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Proveedor", "# pagos", "Propuesta", "Aplazado", "Total", "% acumulado"].map((h) => (
                <th key={h} style={{ padding: "8px 12px", borderBottom: `1px solid ${T.cardBorder}`, fontSize: 11, fontWeight: 600, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: h === "Proveedor" ? "left" : "right" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {arr.map((r, i) => {
              acc += r.total;
              const pctAcc = acc / total;
              return (
                <tr key={r.nombre} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                  <td style={{ padding: "8px 12px", fontSize: 13, color: T.text, fontFamily: T.fontAlt }}>{i + 1}. {r.nombre}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: T.textSub, fontFamily: T.fontAlt }}>{r.pagos}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: T.jade, fontFamily: "monospace" }}>{fmtMXN(r.propuesta)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: T.steel, fontFamily: "monospace" }}>{fmtMXN(r.aplazado)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 13, color: T.text, fontFamily: "monospace", fontWeight: 700 }}>{fmtMXN(r.total)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                      <div style={{ height: 4, width: Math.max(4, pctAcc * 80), background: T.jade, borderRadius: 2, opacity: 0.7 }} />
                      <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt, whiteSpace: "nowrap" }}>{fmtPct(pctAcc)}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
};

// ─── Tab: Clientes ───────────────────────────────────────────
const TabClientes: React.FC<{ data: DecisionData }> = ({ data }) => {
  const total = data.kpis.total_general;

  const cliMap: Record<string, { nombre: string; pagos: number; propuesta: number; aplazado: number; total: number }> = {};
  const bankMap: Record<string, { nombre: string; pagos: number; total: number }> = {};
  data.pagos.forEach((p) => {
    const ck = p.cliente || "Sin cliente";
    if (!cliMap[ck]) cliMap[ck] = { nombre: ck, pagos: 0, propuesta: 0, aplazado: 0, total: 0 };
    cliMap[ck].pagos++;
    cliMap[ck].total += p.total_mxn;
    if (p.propuesta === "Aplazado") cliMap[ck].aplazado += p.total_mxn;
    else cliMap[ck].propuesta += p.total_mxn;

    const bk = p.banco || "Sin banco";
    if (!bankMap[bk]) bankMap[bk] = { nombre: bk, pagos: 0, total: 0 };
    bankMap[bk].pagos++;
    bankMap[bk].total += p.total_mxn;
  });
  const cliArr = Object.values(cliMap).sort((a, b) => b.total - a.total);
  const bankArr = Object.values(bankMap).sort((a, b) => b.total - a.total);
  let acc = 0;

  return (
    <div>
      <SectionCard title="Concentración por cliente / contraparte" meta={`${cliArr.length} clientes · MXN`}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Cliente", "# pagos", "Propuesta", "Aplazado", "Total", "% acumulado"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", borderBottom: `1px solid ${T.cardBorder}`, fontSize: 11, fontWeight: 600, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: h === "Cliente" ? "left" : "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cliArr.map((r, i) => {
                acc += r.total;
                const pctAcc = acc / total;
                return (
                  <tr key={r.nombre} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                    <td style={{ padding: "8px 12px", fontSize: 13, color: T.text, fontFamily: T.fontAlt }}>{i + 1}. {r.nombre}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: T.textSub }}>{r.pagos}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: T.jade, fontFamily: "monospace" }}>{fmtMXN(r.propuesta)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: T.steel, fontFamily: "monospace" }}>{fmtMXN(r.aplazado)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 13, color: T.text, fontFamily: "monospace", fontWeight: 700 }}>{fmtMXN(r.total)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                        <div style={{ height: 4, width: Math.max(4, pctAcc * 80), background: T.steel, borderRadius: 2, opacity: 0.7 }} />
                        <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt }}>{fmtPct(pctAcc)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Distribución por banco emisor" meta="MXN">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Banco", "# pagos", "Total", "% del total", "Distribución"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", borderBottom: `1px solid ${T.cardBorder}`, fontSize: 11, fontWeight: 600, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: h === "Banco" ? "left" : "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bankArr.map((r) => {
                const pct = r.total / total;
                return (
                  <tr key={r.nombre} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                    <td style={{ padding: "8px 12px", fontSize: 13, color: T.text, fontFamily: T.fontAlt, fontWeight: 500 }}>{r.nombre}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: T.textSub }}>{r.pagos}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: T.text, fontFamily: "monospace" }}>{fmtMXN(r.total)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: T.textSub }}>{fmtPct(pct)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>
                      <div style={{ height: 6, width: Math.max(4, pct * 160), background: T.steel, borderRadius: 3, opacity: 0.7, marginLeft: "auto" }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
};

// ─── Tab: Vencimientos ───────────────────────────────────────
const TabVencimientos: React.FC<{ data: DecisionData }> = ({ data }) => {
  const { por_venc, monto_venc } = data;
  const semanaM = (monto_venc.hoy || 0) + (monto_venc.semana || 0);
  const semanaN = (por_venc.hoy || 0) + (por_venc.semana || 0);

  const vencChartData = useMemo(() => {
    const grupos: Record<number, number> = {};
    data.pagos.filter((p) => p.venc_dias != null).forEach((p) => {
      const d = p.venc_dias!;
      grupos[d] = (grupos[d] || 0) + p.total_mxn;
    });
    return Object.entries(grupos)
      .map(([d, monto]) => ({ dias: Number(d), monto, label: Number(d) < 0 ? `${d}d` : Number(d) === 0 ? "Hoy" : `+${d}d` }))
      .sort((a, b) => a.dias - b.dias);
  }, [data.pagos]);

  const buckets = [
    { label: "Vencido", value: fmtMXN(monto_venc.vencido), sub: `${por_venc.vencido || 0} solicitudes`, color: T.red },
    { label: "≤ 7 días", value: fmtMXN(semanaM), sub: `${semanaN} solicitudes`, color: T.amber },
    { label: "8 — 14 días", value: fmtMXN(monto_venc.prox), sub: `${por_venc.prox || 0} solicitudes`, color: T.textSub },
    { label: "Sin fecha", value: fmtMXN(monto_venc.sin_fecha), sub: `${por_venc.sin_fecha || 0} solicitudes`, color: T.textMuted },
  ];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {buckets.map((b) => (
          <div key={b.label} style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontSize: 12, color: b.color, fontFamily: T.fontAlt, fontWeight: 600, marginBottom: 4 }}>{b.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.text, fontFamily: "monospace", fontVariantNumeric: "tabular-nums" }}>{b.value}</div>
            <div style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt, marginTop: 2 }}>{b.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: "16px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: T.font, marginBottom: 12 }}>
          Calendario de vencimientos · días desde hoy
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={vencChartData} margin={{ left: 0, right: 10, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="label" tick={{ fill: T.textSub, fontSize: 11, fontFamily: T.fontAlt }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: T.textMuted, fontSize: 11, fontFamily: T.fontAlt }}
              tickFormatter={(v) => "$" + (v / 1000).toFixed(0) + "k"} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v: any) => [fmtMXN(v), "Monto"]}
              contentStyle={{ background: "#1a2738", border: `1px solid ${T.cardBorder}`, borderRadius: 6, fontSize: 12, fontFamily: T.fontAlt }}
              labelStyle={{ color: T.text }}
              itemStyle={{ color: T.textSub }}
            />
            <Bar dataKey="monto" radius={[3, 3, 0, 0]}>
              {vencChartData.map((entry, i) => (
                <Cell key={i} fill={entry.dias < 0 ? T.red : entry.dias <= 7 ? T.amber : T.steel} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ─── Shared table helpers ────────────────────────────────────
const SectionCard: React.FC<{ title: string; meta?: string; children: React.ReactNode }> = ({ title, meta, children }) => (
  <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: "16px", marginBottom: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: T.font }}>{title}</div>
      {meta && <div style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt }}>{meta}</div>}
    </div>
    {children}
  </div>
);

const TotalRow: React.FC<{ cells: { value: string; align?: "left" | "right"; bold?: boolean; color?: string }[] }> = ({ cells }) => (
  <tr style={{ borderTop: `1px solid ${T.cardBorder}`, background: "rgba(255,255,255,0.03)" }}>
    {cells.map((c, i) => (
      <td key={i} style={{
        padding: "10px 12px", textAlign: c.align || "right",
        fontSize: 13, fontFamily: "monospace", fontWeight: c.bold ? 700 : 400,
        color: c.color || T.text,
      }}>{c.value}</td>
    ))}
  </tr>
);

// ─── Selection bar ───────────────────────────────────────────
interface SelBarProps {
  selected: Set<string>;
  pagos: PagoFlat[];
  onClear: () => void;
  onViewSelected: () => void;
  onExportCSV: () => void;
  onCopyClipboard: () => void;
}

const SelectionBar: React.FC<SelBarProps> = ({ selected, pagos, onClear, onViewSelected, onExportCSV, onCopyClipboard }) => {
  const sel = pagos.filter((p) => selected.has(p.id));
  if (sel.length === 0) return null;

  const total = sel.reduce((s, p) => s + p.total_mxn, 0);
  const propTotal = sel.filter((p) => p.propuesta === "Propuesta").reduce((s, p) => s + p.total_mxn, 0);
  const aplazTotal = sel.filter((p) => p.propuesta === "Aplazado").reduce((s, p) => s + p.total_mxn, 0);
  const nProp = sel.filter((p) => p.propuesta === "Propuesta").length;
  const nAplaz = sel.filter((p) => p.propuesta === "Aplazado").length;

  return (
    <div style={{
      position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
      background: "#1a2738", border: `1px solid ${T.jade}40`, borderRadius: 12,
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)", padding: "14px 20px",
      display: "flex", alignItems: "center", gap: 20, zIndex: 200,
      minWidth: 700,
    }}>
      <div style={{ display: "flex", gap: 20 }}>
        <StatItem label="Seleccionados" value={`${sel.length} pagos`} />
        <StatItem label="Suma total" value={fmtMXN(total)} mono />
        <StatItem label="Propuesta" value={fmtMXN(propTotal)} mono color={T.jade} sub={`${nProp} pagos`} />
        <StatItem label="Aplazado" value={fmtMXN(aplazTotal)} mono color={T.steel} sub={`${nAplaz} pagos`} />
      </div>
      <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
        <BarBtn label="Ver selección" onClick={onViewSelected} />
        <BarBtn label="Exportar CSV" onClick={onExportCSV} primary icon={<Download size={13} />} />
        <BarBtn label="Copiar" onClick={onCopyClipboard} icon={<Copy size={13} />} />
        <BarBtn label="" onClick={onClear} icon={<X size={13} />} />
      </div>
    </div>
  );
};

const StatItem: React.FC<{ label: string; value: string; mono?: boolean; color?: string; sub?: string }> = ({ label, value, mono, color, sub }) => (
  <div>
    <div style={{ fontSize: 10, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 700, color: color || T.text, fontFamily: mono ? "monospace" : T.font, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: T.textMuted, fontFamily: T.fontAlt }}>{sub}</div>}
  </div>
);

const BarBtn: React.FC<{ label: string; onClick: () => void; primary?: boolean; icon?: React.ReactNode }> = ({ label, onClick, primary, icon }) => (
  <button onClick={onClick} style={{
    display: "flex", alignItems: "center", gap: 5, padding: label ? "7px 14px" : "7px 10px",
    background: primary ? T.jade : "rgba(255,255,255,0.08)",
    color: primary ? "#000" : T.text, border: "none", borderRadius: 6,
    fontSize: 12, fontFamily: T.font, fontWeight: 600, cursor: "pointer", transition: "opacity 0.15s",
  }} onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
    {icon}{label}
  </button>
);

// ─── Selection modal ─────────────────────────────────────────
const SelectionModal: React.FC<{ selected: Set<string>; pagos: PagoFlat[]; onClose: () => void; onExportCSV: () => void; onCopy: () => void }> = ({
  selected, pagos, onClose, onExportCSV, onCopy,
}) => {
  const sel = pagos.filter((p) => selected.has(p.id)).sort((a, b) => b.total_mxn - a.total_mxn);
  const total = sel.reduce((s, p) => s + p.total_mxn, 0);
  const propTotal = sel.filter((p) => p.propuesta === "Propuesta").reduce((s, p) => s + p.total_mxn, 0);
  const aplazTotal = sel.filter((p) => p.propuesta === "Aplazado").reduce((s, p) => s + p.total_mxn, 0);

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 300,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div style={{
        background: "#1a2738", borderRadius: 12, width: "min(900px, 100%)", maxHeight: "85vh",
        display: "flex", flexDirection: "column", border: `1px solid ${T.cardBorder}`,
        boxShadow: "0 16px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${T.cardBorder}` }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: T.font }}>Lista de pagos seleccionados</div>
            <div style={{ fontSize: 12, color: T.textMuted, fontFamily: T.fontAlt, marginTop: 2 }}>
              {sel.length} pagos · {fmtMXN(total)} MXN
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ position: "sticky", top: 0, background: "#1a2738" }}>
              <tr>
                {["#", "Tipo", "Proyecto", "Beneficiario", "OC / Factura", "Banco", "Vence", "Total MXN"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", borderBottom: `1px solid ${T.cardBorder}`, fontSize: 11, fontWeight: 600, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: ["Total MXN"].includes(h) ? "right" : "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sel.map((p, i) => {
                const tagColor = p.propuesta === "Propuesta" ? T.jade : T.steel;
                const tagBg = p.propuesta === "Propuesta" ? T.jadeFaint : T.steelFaint;
                return (
                  <tr key={p.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: T.textMuted }}>{i + 1}.<span style={{ marginLeft: 4, padding: "1px 6px", background: tagBg, color: tagColor, borderRadius: 3, fontSize: 10, fontWeight: 700 }}>{p.propuesta || "—"}</span></td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: T.text, fontFamily: T.fontAlt }}>{p.tipo_op}<br /><span style={{ fontSize: 10, color: T.textMuted }}>{p.operacion_cat}</span></td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: T.text }}>{p.proj_id || "—"}<br /><span style={{ fontSize: 10, color: T.textMuted }}>{(p.proyecto || "").slice(0, 40)}</span></td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: T.text }}>{(p.benef_clean || "").slice(0, 28)}<br /><span style={{ fontSize: 10, color: T.textMuted }}>{p.cliente || "—"}</span></td>
                    <td style={{ padding: "8px 12px", fontSize: 11, fontFamily: "monospace", color: T.text }}>{p.oc || "—"}<br /><span style={{ fontSize: 10, color: T.textMuted }}>{(p.factura || "").slice(0, 18)}</span></td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: T.textSub }}>{p.banco}</td>
                    <td style={{ padding: "8px 12px", fontSize: 11, fontFamily: "monospace", color: T.textSub }}>{fmtFecha(p.venc)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: T.text }}>{fmtMXN(p.total_mxn)}{p.divisa !== "MXN" && <><br /><span style={{ fontSize: 10, color: T.textMuted }}>{p.divisa} {fmtN(p.monto)}</span></>}</td>
                  </tr>
                );
              })}
              <TotalRow cells={[
                { value: `Total ${sel.length} pagos`, align: "left", bold: true },
                { value: "" }, { value: "" }, { value: "" }, { value: "" }, { value: "" }, { value: "" },
                { value: fmtMXN(total), bold: true },
              ]} />
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderTop: `1px solid ${T.cardBorder}` }}>
          <div style={{ fontSize: 12, color: T.textMuted, fontFamily: T.fontAlt }}>
            Propuesta: {sel.filter((p) => p.propuesta === "Propuesta").length} · {fmtMXN(propTotal)} &nbsp;|&nbsp; Aplazado: {sel.filter((p) => p.propuesta === "Aplazado").length} · {fmtMXN(aplazTotal)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <BarBtn label="Exportar CSV" onClick={onExportCSV} primary icon={<Download size={13} />} />
            <BarBtn label="Copiar" onClick={onCopy} icon={<Copy size={13} />} />
            <BarBtn label="Cerrar" onClick={onClose} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── CSV / clipboard helpers ─────────────────────────────────
function buildCSV(sel: PagoFlat[]): string {
  const esc = (v: any) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const headers = ["ID", "Propuesta", "Operación", "Tipo", "OC", "Proyecto", "Cliente", "Beneficiario", "Concepto", "Factura", "Vencimiento", "Monto", "Divisa", "TC", "Total MXN", "Banco", "Departamento", "Estatus"];
  const sorted = [...sel].sort((a, b) => b.total_mxn - a.total_mxn);
  const rows = sorted.map((p) =>
    [p.id, p.propuesta, p.operacion_cat, p.tipo_op, p.oc, p.proyecto, p.cliente, p.benef_clean, p.concepto, p.factura, p.venc, p.monto, p.divisa, p.tc, p.total_mxn, p.banco, p.departamento, p.estatus].map(esc).join(",")
  );
  const total = sorted.reduce((s, p) => s + p.total_mxn, 0);
  rows.push("", esc(`TOTAL ${sorted.length} pagos`) + ",,,,,,,,,,,,,," + total.toFixed(2) + ",,,");
  return headers.join(",") + "\n" + rows.join("\n");
}

function downloadCSV(sel: PagoFlat[]) {
  if (!sel.length) return;
  const csv = buildCSV(sel);
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pagos_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function copyTSV(sel: PagoFlat[]): Promise<void> {
  const headers = ["ID", "Propuesta", "Operación", "Tipo", "OC", "Proyecto", "Cliente", "Beneficiario", "Concepto", "Factura", "Vencimiento", "Monto", "Divisa", "TC", "Total MXN", "Banco", "Departamento"];
  const sorted = [...sel].sort((a, b) => b.total_mxn - a.total_mxn);
  const clean = (v: any) => String(v ?? "").replace(/\t/g, " ").replace(/\n/g, " ");
  const rows = sorted.map((p) =>
    [p.id, p.propuesta, p.operacion_cat, p.tipo_op, p.oc, p.proyecto, p.cliente, p.benef_clean, p.concepto, p.factura, p.venc, p.monto, p.divisa, p.tc, p.total_mxn, p.banco, p.departamento].map(clean).join("\t")
  );
  await navigator.clipboard.writeText(headers.join("\t") + "\n" + rows.join("\n"));
}

// ─── Pill filter button ──────────────────────────────────────
const PillBtn: React.FC<{ label: string; active: boolean; onClick: () => void; color?: string }> = ({ label, active, onClick, color }) => (
  <button onClick={onClick} style={{
    padding: "5px 12px", borderRadius: 5, border: `1px solid ${active ? (color || T.jade) : T.cardBorder}`,
    background: active ? (color ? color + "20" : T.jadeFaint) : "transparent",
    color: active ? (color || T.jade) : T.textSub, fontSize: 12, fontFamily: T.fontAlt,
    fontWeight: active ? 600 : 400, cursor: "pointer", transition: "all 0.12s",
    whiteSpace: "nowrap",
  }}>{label}</button>
);

// ─── TABS ────────────────────────────────────────────────────
type Tab = "lista" | "resumen" | "proveedores" | "clientes" | "vencimientos";

// ─── Main component ──────────────────────────────────────────
const DecisionPagos: React.FC = () => {
  const [data, setData] = useState<DecisionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>("lista");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await loadDecisionData();
      setData(d);
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e.message || "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Memoized decision map
  const decisionMap = useMemo(() => {
    if (!data) return new Map<string, Decision>();
    const m = new Map<string, Decision>();
    data.pagos.forEach((p) => m.set(p.id, evalDecision(p, data.oc_data, data.forecast_data)));
    return m;
  }, [data]);

  // Computed option sets for multi-selects
  const options = useMemo(() => {
    if (!data) return { ops: [], bancos: [], clientes: [], provs: [], counts: {} as Record<string, Record<string, number>> };
    const ops = [...new Set(data.pagos.map((p) => p.operacion_cat).filter(Boolean))].sort();
    const bancos = [...new Set(data.pagos.map((p) => p.banco).filter(Boolean))].sort();
    const clientes = [...new Set(data.pagos.map((p) => p.cliente || "Sin cliente"))].sort();
    const provs = [...new Set(data.pagos.map((p) => p.benef_clean).filter(Boolean))].sort();

    const countBy = (key: "operacion_cat" | "banco" | "benef_clean") =>
      data.pagos.reduce((m, p) => { const v = p[key]; if (v) m[v] = (m[v] || 0) + 1; return m; }, {} as Record<string, number>);
    const countCliente = data.pagos.reduce((m, p) => { const v = p.cliente || "Sin cliente"; m[v] = (m[v] || 0) + 1; return m; }, {} as Record<string, number>);

    return { ops, bancos, clientes, provs, counts: { op: countBy("operacion_cat"), banco: countBy("banco"), prov: countBy("benef_clean"), cliente: countCliente } };
  }, [data]);

  // Decision counts for filter chips
  const decisionCounts = useMemo(() => {
    if (!data) return { verde: 0, rojo: 0, amarillo: 0 };
    const c = { verde: 0, rojo: 0, amarillo: 0 };
    data.pagos.forEach((p) => { c[decisionMap.get(p.id)!.color]++; });
    return c;
  }, [data, decisionMap]);

  // Filtered + sorted list
  const filteredPagos = useMemo(() => {
    if (!data) return [];
    const q = filters.search.toLowerCase().trim();

    let rows = data.pagos.filter((p) => {
      if (filters.decision) {
        const dec = decisionMap.get(p.id);
        if (!dec || dec.color !== filters.decision) return false;
      }
      if (filters.oc) {
        const key = p.oc ? String(p.oc).replace(/\s+/g, "").toUpperCase() : null;
        const oc = key ? data.oc_data[key] : null;
        const est = oc ? (oc.estatus || "").toLowerCase() : "";
        if (filters.oc === "aprobada" && est !== "aprobada") return false;
        if (filters.oc === "rechazada" && est !== "rechazada") return false;
        if (filters.oc === "pendiente" && (!oc || est === "aprobada" || est === "rechazada")) return false;
        if (filters.oc === "sin" && oc) return false;
      }
      if (filters.propuesta.size > 0 && !filters.propuesta.has(p.propuesta)) return false;
      if (filters.venc.size > 0) {
        const allowed = new Set<string>();
        if (filters.venc.has("vencido")) allowed.add("vencido");
        if (filters.venc.has("semana")) { allowed.add("vencido"); allowed.add("hoy"); allowed.add("semana"); }
        if (filters.venc.has("prox")) { allowed.add("vencido"); allowed.add("hoy"); allowed.add("semana"); allowed.add("prox"); }
        if (!allowed.has(p.venc_bucket)) return false;
      }
      if (filters.op.size > 0 && !filters.op.has(p.operacion_cat)) return false;
      if (filters.banco.size > 0 && !filters.banco.has(p.banco)) return false;
      if (filters.cliente.size > 0 && !filters.cliente.has(p.cliente || "Sin cliente")) return false;
      if (filters.prov.size > 0 && !filters.prov.has(p.benef_clean)) return false;
      if (q) {
        const hay = [p.oc, p.beneficiario, p.benef_clean, p.proyecto, p.factura, p.concepto, p.tipo_op, p.cliente, p.solicitante]
          .map((s) => String(s || "").toLowerCase()).join(" ");
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (filters.sortBy === "urgencia") {
      const urgOrder: Record<VencBucket, number> = { vencido: 0, hoy: 1, semana: 2, prox: 3, futuro: 4, sin_fecha: 5 };
      rows.sort((a, b) => {
        const ua = urgOrder[a.venc_bucket], ub = urgOrder[b.venc_bucket];
        return ua !== ub ? ua - ub : b.total_mxn - a.total_mxn;
      });
    } else {
      rows.sort((a, b) => b.total_mxn - a.total_mxn);
    }

    return rows;
  }, [data, filters, decisionMap]);

  const setFilter = <K extends keyof Filters>(key: K, val: Filters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: val }));

  const clearFilters = () => { setFilters(defaultFilters()); };

  const toggleSelect = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectAllVisible = () =>
    setSelected((prev) => { const n = new Set(prev); filteredPagos.forEach((p) => n.add(p.id)); return n; });

  const unselectAllVisible = () =>
    setSelected((prev) => { const n = new Set(prev); filteredPagos.forEach((p) => n.delete(p.id)); return n; });

  const getSelectedPagos = () => (data?.pagos || []).filter((p) => selected.has(p.id));

  const handleExportCSV = () => downloadCSV(getSelectedPagos());
  const handleCopy = async () => {
    await copyTSV(getSelectedPagos());
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 1800);
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "lista", label: `Lista (${filteredPagos.length})` },
    { id: "resumen", label: "Resumen" },
    { id: "proveedores", label: `Proveedores (${options.provs.length})` },
    { id: "clientes", label: `Clientes (${options.clientes.length})` },
    { id: "vencimientos", label: "Vencimientos" },
  ];

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 12, color: T.textMuted, fontFamily: T.fontAlt }}>
      <div style={{ width: 32, height: 32, border: `3px solid ${T.cardBorder}`, borderTopColor: T.jade, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      Cargando datos…
    </div>
  );

  if (error) return (
    <div style={{ padding: "40px 20px", textAlign: "center" }}>
      <div style={{ color: T.red, fontSize: 14, fontFamily: T.fontAlt, marginBottom: 16 }}>{error}</div>
      <button onClick={load} style={{ padding: "8px 20px", background: T.jade, color: "#000", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: T.font, fontWeight: 600, fontSize: 13 }}>Reintentar</button>
    </div>
  );

  if (!data) return null;
  const { kpis, meta } = data;

  return (
    <div style={{ fontFamily: T.font, color: T.text, paddingBottom: 80 }}>
      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: 0, letterSpacing: "-0.02em" }}>Decisión de Pagos</h1>
          <div style={{ fontSize: 12, color: T.textMuted, fontFamily: T.fontAlt, marginTop: 4 }}>
            {meta.fecha_corte && <>Corte {fmtFecha(meta.fecha_corte)} · </>}
            Hoy {fmtFecha(meta.fecha_hoy)} · {kpis.n_total} solicitudes
            {lastUpdated && <> · Actualizado {lastUpdated.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</>}
          </div>
        </div>
        <button onClick={load} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
          background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 6,
          color: T.textSub, fontSize: 12, fontFamily: T.font, cursor: "pointer",
        }}>
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      {/* KPI strip */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <KPICard label="Total general" value={fmtMXNk(kpis.total_general)} sub={`${kpis.n_total} pagos`} />
        <KPICard label="Propuesta" value={fmtMXNk(kpis.total_propuesta)} sub={`${kpis.n_propuesta} pagos · ${fmtPct(kpis.total_propuesta / kpis.total_general)}`} accentColor={T.jade} />
        <KPICard label="Aplazado" value={fmtMXNk(kpis.total_aplazado)} sub={`${kpis.n_aplazado} pagos · ${fmtPct(kpis.total_aplazado / kpis.total_general)}`} accentColor={T.steel} />
        <KPICard label="Vencido" value={fmtMXNk(kpis.total_vencido)} sub={`${kpis.n_vencido} solicitudes`} accentColor={T.red} />
        <KPICard label="En ≤ 7 días" value={fmtMXNk(kpis.total_semana)} sub={`${kpis.n_semana} solicitudes`} accentColor={T.amber} />
      </div>

      {/* Tab navigation */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: `1px solid ${T.cardBorder}`, paddingBottom: 0 }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: "10px 18px", border: "none", background: "transparent",
            color: activeTab === t.id ? T.jade : T.textSub,
            borderBottom: `2px solid ${activeTab === t.id ? T.jade : "transparent"}`,
            marginBottom: -1, fontSize: 13, fontFamily: T.font, fontWeight: activeTab === t.id ? 700 : 400,
            cursor: "pointer", transition: "all 0.12s", whiteSpace: "nowrap",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Lista tab ── */}
      {activeTab === "lista" && (
        <div>
          {/* Decision filter chips */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <PillBtn label={`Todos (${kpis.n_total})`} active={!filters.decision} onClick={() => setFilter("decision", "")} />
            <PillBtn label={`✓ Procede (${decisionCounts.verde})`} active={filters.decision === "verde"} onClick={() => setFilter("decision", filters.decision === "verde" ? "" : "verde")} color={T.jade} />
            <PillBtn label={`✗ Bloquear (${decisionCounts.rojo})`} active={filters.decision === "rojo"} onClick={() => setFilter("decision", filters.decision === "rojo" ? "" : "rojo")} color={T.red} />
            <PillBtn label={`⚠ Revisar (${decisionCounts.amarillo})`} active={filters.decision === "amarillo"} onClick={() => setFilter("decision", filters.decision === "amarillo" ? "" : "amarillo")} color={T.amber} />
          </div>

          {/* Filter bar */}
          <div style={{
            background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 8,
            padding: "12px 14px", marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
          }}>
            {/* Propuesta pills */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.08em" }}>Propuesta</span>
              {["Propuesta", "Aplazado"].map((v) => (
                <PillBtn key={v} label={v} active={filters.propuesta.has(v)}
                  onClick={() => { const n = new Set(filters.propuesta); n.has(v) ? n.delete(v) : n.add(v); setFilter("propuesta", n); }}
                  color={v === "Propuesta" ? T.jade : T.steel}
                />
              ))}
            </div>

            <div style={{ width: 1, height: 20, background: T.cardBorder }} />

            {/* Vence pills */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.08em" }}>Vence</span>
              {[{ v: "vencido", l: "Vencido", c: T.red }, { v: "semana", l: "≤ 7d", c: T.amber }, { v: "prox", l: "≤ 14d", c: T.textSub }].map(({ v, l, c }) => (
                <PillBtn key={v} label={l} active={filters.venc.has(v)}
                  onClick={() => { const n = new Set(filters.venc); n.has(v) ? n.delete(v) : n.add(v); setFilter("venc", n); }}
                  color={c}
                />
              ))}
            </div>

            <div style={{ width: 1, height: 20, background: T.cardBorder }} />

            {/* OC pills */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.08em" }}>OC</span>
              {[{ v: "aprobada", l: "Aprobada" }, { v: "pendiente", l: "Pendiente" }, { v: "rechazada", l: "Rechazada" }, { v: "sin", l: "Sin OC" }].map(({ v, l }) => (
                <PillBtn key={v} label={l} active={filters.oc === v}
                  onClick={() => setFilter("oc", filters.oc === v ? "" : v as any)}
                  color={v === "aprobada" ? T.jade : v === "rechazada" ? T.red : T.textSub}
                />
              ))}
            </div>

            <div style={{ width: 1, height: 20, background: T.cardBorder }} />

            {/* Multi-selects */}
            <MultiSelect label="Operación" options={options.ops} selected={filters.op} counts={options.counts.op} onChange={(s) => setFilter("op", s)} />
            <MultiSelect label="Banco" options={options.bancos} selected={filters.banco} counts={options.counts.banco} onChange={(s) => setFilter("banco", s)} />
            <MultiSelect label="Cliente" options={options.clientes} selected={filters.cliente} counts={options.counts.cliente} onChange={(s) => setFilter("cliente", s)} />
            <MultiSelect label="Proveedor" options={options.provs} selected={filters.prov} counts={options.counts.prov} onChange={(s) => setFilter("prov", s)} />

            <div style={{ width: 1, height: 20, background: T.cardBorder }} />

            {/* Sort */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.08em" }}>Orden</span>
              <PillBtn label="Mayor monto" active={filters.sortBy === "monto"} onClick={() => setFilter("sortBy", "monto")} />
              <PillBtn label="Urgencia" active={filters.sortBy === "urgencia"} onClick={() => setFilter("sortBy", "urgencia")} />
            </div>

            <div style={{ width: 1, height: 20, background: T.cardBorder }} />

            {/* Bulk selection */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button onClick={selectAllVisible} style={{ padding: "5px 10px", borderRadius: 5, border: `1px solid ${T.jade}40`, background: T.jadeFaint, color: T.jade, fontSize: 11, fontFamily: T.fontAlt, cursor: "pointer" }}>Seleccionar visibles</button>
              <button onClick={unselectAllVisible} style={{ padding: "5px 10px", borderRadius: 5, border: `1px solid ${T.cardBorder}`, background: "transparent", color: T.textSub, fontSize: 11, fontFamily: T.fontAlt, cursor: "pointer" }}>Quitar visibles</button>
            </div>

            <div style={{ marginLeft: "auto" }}>
              <button onClick={clearFilters} style={{ padding: "5px 12px", borderRadius: 5, border: `1px solid ${T.cardBorder}`, background: "transparent", color: T.textMuted, fontSize: 11, fontFamily: T.fontAlt, cursor: "pointer" }}>Limpiar filtros</button>
            </div>
          </div>

          {/* Search */}
          <div style={{ marginBottom: 14 }}>
            <input
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              placeholder="Buscar OC, proveedor, proyecto, factura, concepto…"
              style={{
                width: "100%", padding: "9px 14px", border: `1px solid ${T.cardBorder}`,
                borderRadius: 6, background: T.cardBg, color: T.text, fontSize: 13,
                fontFamily: T.fontAlt, outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Payment list */}
          {filteredPagos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: T.textMuted, fontFamily: T.fontAlt, fontSize: 14 }}>
              No hay solicitudes que coincidan con los filtros.
            </div>
          ) : (
            filteredPagos.map((p) => (
              <PaymentCard
                key={p.id}
                p={p}
                decision={decisionMap.get(p.id)!}
                selected={selected.has(p.id)}
                expanded={expandedId === p.id}
                ocData={data.oc_data}
                fcData={data.forecast_data}
                onToggleSelect={toggleSelect}
                onToggleExpand={(id) => setExpandedId((prev) => (prev === id ? null : id))}
              />
            ))
          )}
        </div>
      )}

      {activeTab === "resumen" && <TabResumen data={data} />}
      {activeTab === "proveedores" && <TabProveedores data={data} />}
      {activeTab === "clientes" && <TabClientes data={data} />}
      {activeTab === "vencimientos" && <TabVencimientos data={data} />}

      {/* Selection bar */}
      <SelectionBar
        selected={selected}
        pagos={data.pagos}
        onClear={() => setSelected(new Set())}
        onViewSelected={() => setShowModal(true)}
        onExportCSV={handleExportCSV}
        onCopyClipboard={handleCopy}
      />

      {/* Copy feedback toast */}
      {copyFeedback && (
        <div style={{
          position: "fixed", top: 20, right: 20, background: T.jade, color: "#000",
          padding: "8px 16px", borderRadius: 6, fontFamily: T.font, fontSize: 12, fontWeight: 600, zIndex: 400,
        }}>
          ✓ Copiado al portapapeles
        </div>
      )}

      {/* Selection modal */}
      {showModal && (
        <SelectionModal
          selected={selected}
          pagos={data.pagos}
          onClose={() => setShowModal(false)}
          onExportCSV={handleExportCSV}
          onCopy={handleCopy}
        />
      )}
    </div>
  );
};

export default DecisionPagos;
