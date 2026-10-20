import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import type { PagoFlat, OcRecord, ForecastRecord, Decision, DecisionColor } from "../../services/decision";
import { fetchInvoiceLinkByOC } from "../../services/sheets";
import { T, NUM, DECISION_COLORS } from "./tokens";
import { fmtN, fmtMXN, fmtFecha, fmtMoney } from "./format";
import { canDecideOn, normOcKey } from "./logic";
import { Chip, ActionBtn, ExpBlock, ExpField, StatusBadge, CrossBlock } from "./ui";

// ─── Urgency label ───────────────────────────────────────────
export function urgLabel(p: PagoFlat): { text: string; color: string } {
  const b = p.venc_bucket;
  if (b === "vencido") return { text: `Vencido · ${Math.abs(p.venc_dias!)}d`, color: T.red };
  if (b === "hoy") return { text: "Vence hoy", color: T.amber };
  if (b === "semana") return { text: `En ${p.venc_dias}d`, color: T.amber };
  if (b === "prox") return { text: `En ${p.venc_dias}d`, color: T.steel };
  if (b === "futuro") return { text: `+${p.venc_dias}d`, color: T.textMuted };
  return { text: "Sin fecha", color: T.textMuted };
}

// ─── OC status chip ──────────────────────────────────────────
export function OcChip({ p, ocData }: { p: PagoFlat; ocData: Record<string, OcRecord> }) {
  if (!p.oc) return <Chip label="Sin OC" color={T.textMuted} bg="rgba(255,255,255,0.08)" />;
  const key = normOcKey(p.oc)!;
  const oc = ocData[key];
  if (!oc) return <Chip label="OC s/reg." color={T.textMuted} bg="rgba(255,255,255,0.08)" title={`OC ${p.oc} no encontrada`} />;
  const est = (oc.estatus || "").toLowerCase();
  if (est === "aprobada") return <Chip label="OC ✓" color={T.jade} bg={T.jadeFaint} title={`Aprobada el ${fmtFecha(oc.fecha_apb)}`} />;
  if (est === "rechazada") return <Chip label="OC ✗" color={T.red} bg={T.redFaint} />;
  return <Chip label={`OC ${oc.estatus || "Pend."}`} color={T.amber} bg={T.amberFaint} />;
}

// ─── Payment card ────────────────────────────────────────────
export interface CardProps {
  p: PagoFlat;
  decision: Decision;
  selected: boolean;
  expanded: boolean;
  ocData: Record<string, OcRecord>;
  fcData: Record<string, ForecastRecord>;
  onToggleSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  canDecide?: boolean;
  actionBusy?: boolean;
  /** false mientras el cruce OC/pronóstico no terminó: las decisiones calculadas aún no son confiables. */
  crossReady: boolean;
  onApprove?: (p: PagoFlat) => void;
  onClarify?: (p: PagoFlat) => void;
  onReject?: (p: PagoFlat) => void;
}

const PaymentCardBase: React.FC<CardProps> = ({
  p, decision, selected, expanded, ocData, fcData, onToggleSelect, onToggleExpand,
  canDecide, actionBusy, crossReady, onApprove, onClarify, onReject,
}) => {
  const urg = urgLabel(p);
  // Sin el cruce, todo caería en "Revisar" por falta de datos, no por una revisión real.
  const dc = crossReady
    ? DECISION_COLORS[decision.color]
    : { bg: "rgba(255,255,255,0.08)", text: T.textSub, dot: "rgba(255,255,255,0.3)" };
  const tagColor = p.propuesta_bucket === "Propuesta" ? T.jade : T.steel;
  const tagBg = p.propuesta_bucket === "Propuesta" ? T.jadeFaint : T.steelFaint;

  return (
    // El clic en la tarjeta es una comodidad para el ratón; el teclado usa el checkbox y el botón
    // de detalle, que son controles reales. Los controles interiores no disparan este handler.
    <div
      className="dp-card"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button, a, input, label")) return;
        onToggleExpand(p.id);
      }}
      style={{
        background: selected ? "rgba(0,170,133,0.06)" : T.cardBg,
        border: `1px solid ${selected ? T.jade : expanded ? "rgba(255,255,255,0.14)" : T.cardBorder}`,
        borderRadius: 8, marginBottom: 6, cursor: "pointer",
      }}
    >
      {/* Card header row */}
      <div className="dp-card-row">
        {/* Checkbox (la etiqueta amplía el área de clic) */}
        <label style={{ padding: 4, margin: -4, flexShrink: 0, cursor: "pointer", display: "flex" }}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(p.id)}
            aria-label={`Seleccionar ${p.id}`}
            style={{ accentColor: T.jade, width: 16, height: 16, cursor: "pointer", marginTop: 2 }}
          />
        </label>

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
        <div className="dp-card-main">
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
              label={crossReady ? decision.label : "Calculando…"}
              color={dc.text}
              bg={dc.bg}
              title={crossReady ? decision.reasons.join(" | ") : "Cruzando con OC y pronóstico de avance"}
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
          <div style={{ fontSize: 12, color: T.text, ...NUM, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }} title={p.factura}>
            {p.factura || "—"}
          </div>
          <div style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt }}>{fmtFecha(p.venc)}</div>
        </div>

        {/* Amount */}
        <div style={{ flexShrink: 0, minWidth: 110, textAlign: "right" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, ...NUM }}>
            {p.sin_tc ? "—" : fmtMXN(p.total_mxn)}
          </div>
          <div style={{ fontSize: 11, color: p.sin_tc ? T.amber : T.textMuted, fontFamily: T.fontAlt }}>
            {p.sin_tc
              ? `Sin T/C · ${p.divisa} ${fmtN(p.monto)}`
              : p.divisa !== "MXN" ? `${p.divisa} ${fmtN(p.monto)} · TC ${p.tc}` : "MXN"}
          </div>
        </div>

        {/* Expand toggle */}
        <button
          type="button"
          className="dp-icon-btn"
          aria-expanded={expanded}
          aria-label={expanded ? `Contraer detalle de ${p.id}` : `Ver detalle de ${p.id}`}
          onClick={() => onToggleExpand(p.id)}
          style={{ flexShrink: 0 }}
        >
          {expanded ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
        </button>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <ExpandedPanel
          p={p} decision={decision} ocData={ocData} fcData={fcData}
          canDecide={canDecide} actionBusy={actionBusy} crossReady={crossReady}
          onApprove={onApprove} onClarify={onClarify} onReject={onReject}
        />
      )}
    </div>
  );
};

// memo: con decenas de tarjetas, marcar una no debe re-renderizar todas. Funciona porque
// el padre pasa callbacks estables y las demás props son primitivas o referencias de `data`.
export const PaymentCard = React.memo(PaymentCardBase);

// ─── Expanded panel ──────────────────────────────────────────
export const ExpandedPanel: React.FC<{
  p: PagoFlat;
  decision: Decision;
  ocData: Record<string, OcRecord>;
  fcData: Record<string, ForecastRecord>;
  canDecide?: boolean;
  actionBusy?: boolean;
  crossReady: boolean;
  onApprove?: (p: PagoFlat) => void;
  onClarify?: (p: PagoFlat) => void;
  onReject?: (p: PagoFlat) => void;
}> = ({ p, decision, ocData, fcData, canDecide, actionBusy, crossReady, onApprove, onClarify, onReject }) => {
  // Sin el cruce el veredicto aún no existe: no se muestra "Revisar" como si fuera uno.
  const dc = crossReady
    ? DECISION_COLORS[decision.color]
    : { bg: "rgba(255,255,255,0.06)", text: T.textSub, dot: "rgba(255,255,255,0.3)" };
  const ocKey = normOcKey(p.oc);
  const oc = ocKey ? ocData[ocKey] : null;
  const fc = p.proj_id ? fcData[p.proj_id.trim()] : null;

  // Invoice PDF from Recepción de Facturas, looked up live by OC so the
  // decision-maker can open the actual document before approving/rejecting.
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setInvoiceUrl(null);
    if (!p.oc) return;
    fetchInvoiceLinkByOC(p.oc).then((result) => {
      if (!cancelled) setInvoiceUrl(result?.invoice_url ?? result?.drive_folder_url ?? null);
    });
    return () => { cancelled = true; };
  }, [p.oc]);
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
          {crossReady ? titleMap[decision.color] : "Cruzando con OC y pronóstico…"}
        </div>
        {crossReady && decision.reasons.map((r, i) => (
          <div key={i} style={{ fontSize: 12, color: T.textSub, fontFamily: T.fontAlt, lineHeight: 1.5 }}>{r}</div>
        ))}

        {/* Acciones del admin: la decisión se toma aquí, no en Finanzas */}
        {canDecide && canDecideOn(p) && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
            <ActionBtn
              label="Aprobar" color={T.jade} disabled={actionBusy || !crossReady} icon={<CheckCircle2 size={14} />}
              title={crossReady ? undefined : "Espera a que termine el cruce con OC y pronóstico"}
              onClick={() => onApprove?.(p)}
            />
            <ActionBtn label="Aclaración" color={T.amber} disabled={actionBusy} icon={<HelpCircle size={14} />} onClick={() => onClarify?.(p)} />
            <ActionBtn label="Rechazar" color={T.red} disabled={actionBusy} icon={<XCircle size={14} />} onClick={() => onReject?.(p)} />
            <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt, alignSelf: "center" }}>
              Estatus actual: {p.estatus || "—"}
            </span>
          </div>
        )}
      </div>

      {/* Detail grid */}
      <div className="dp-grid-3" style={{ marginBottom: 14 }}>
        <ExpBlock title="Documento">
          <ExpField label="OC" value={p.oc || "—"} mono />
          <ExpField
            label="Factura"
            value={invoiceUrl ? (p.factura || "Ver factura") : (p.factura || "—")}
            mono
            href={invoiceUrl}
          />
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
      <div className="dp-grid-2">
        <OcBlock oc={oc} p={p} />
        <ForecastBlock fc={fc} p={p} />
      </div>

      {p.obs && (
        <div style={{
          marginTop: 10, padding: "8px 12px", background: "rgba(255,255,255,0.04)",
          borderRadius: 6, fontSize: 12, color: T.textSub, fontFamily: T.fontAlt,
        }}>
          <strong style={{ color: T.text }}>Obs. finanzas: </strong>{p.obs}
        </div>
      )}
    </div>
  );
};

export const OcBlock: React.FC<{ oc: OcRecord | null; p: PagoFlat }> = ({ oc, p }) => {
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
        <span style={{ fontSize: 12, color: diffColor, ...NUM }}>
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

export const ForecastBlock: React.FC<{ fc: ForecastRecord | null; p: PagoFlat }> = ({ fc, p }) => {
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
          <div style={{ fontSize: 24, fontWeight: 800, color: T.text, ...NUM }}>{pct.toFixed(1)}%</div>
          <div style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt }}>avance ponderado</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt }}>
          <div>Inicio: <strong style={{ color: T.text }}>{fmtFecha(fc.fecha_inicio) || "—"}</strong></div>
          <div>Fin: <strong style={{ color: T.text }}>{fmtFecha(fc.fecha_fin) || "—"}</strong></div>
        </div>
      </div>
      <div
        role="progressbar" aria-label="Avance del proyecto"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(pct, 100))}
        style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, marginBottom: 8, overflow: "hidden" }}
      >
        {/* scaleX en vez de width: no recalcula layout al animar */}
        <div className="dp-bar-fill" style={{ height: "100%", background: T.jade, transform: `scaleX(${Math.min(pct, 100) / 100})` }} />
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
              <span style={{ fontSize: 10, color: T.textMuted, ...NUM, flexShrink: 0 }}>
                {h.pct != null ? (h.pct * 100).toFixed(1) + "%" : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </CrossBlock>
  );
};
