import React from "react";
import { CheckCircle2, HelpCircle, XCircle, X } from "lucide-react";
import type { Request } from "../../data/mockData";
import { T, NUM } from "../decision/tokens";
import { fmtFecha } from "../decision/format";
import { ActionBtn, Chip } from "../decision/ui";
import { money, STALE_DAYS, waitingLabel } from "./helpers";

interface Props {
  request: Request;
  days: number;
  busy: boolean;
  onApprove: () => void;
  onClarify: () => void;
  onReject: () => void;
  onClose: () => void;
}

// Definición de un dato: etiqueta chica arriba, valor legible abajo (el concepto puede ser largo y debe envolver).
const Datum: React.FC<{ label: string; value?: string }> = ({ label, value }) =>
  value ? (
    <div style={{ minWidth: 0 }}>
      <dt style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt, fontWeight: 500, marginBottom: 2 }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: 13, color: T.text, fontFamily: T.font, fontWeight: 400, lineHeight: 1.45, overflowWrap: "anywhere" }}>{value}</dd>
    </div>
  ) : null;

// Bloque de texto del flujo de aclaración. Borde de 1px completo (no una franja lateral gruesa).
const Note: React.FC<{ title: string; text: string; color: string; faint: string }> = ({ title, text, color, faint }) => (
  <div style={{ background: faint, border: `1px solid ${color}55`, borderRadius: 8, padding: "10px 12px" }}>
    <div style={{ fontSize: 12, fontWeight: 700, color, fontFamily: T.fontAlt, marginBottom: 4 }}>{title}</div>
    <div style={{ fontSize: 13, color: T.text, fontFamily: T.font, lineHeight: 1.5, overflowWrap: "anywhere" }}>{text}</div>
  </div>
);

export const ReviewPanel: React.FC<Props> = ({ request: r, days, busy, onApprove, onClarify, onReject, onClose }) => {
  const stale = days >= STALE_DAYS;
  return (
    <section
      className="ap-panel-in"
      aria-label={`Revisión de ${r.id}`}
      style={{ background: T.panelBg, border: `1px solid ${T.cardBorder}`, borderRadius: 12, overflow: "hidden" }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${T.cardBorder}` }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: T.fontAlt }}>{r.id}</span>
        {stale
          ? <Chip label={waitingLabel(days)} color={T.amber} bg={T.amberFaint} title="Lleva varios días esperando autorización" />
          : <span style={{ fontSize: 12, color: T.textMuted, fontFamily: T.fontAlt }}>{waitingLabel(days)}</span>}
        <button type="button" className="dp-icon-btn" onClick={onClose} aria-label="Cerrar revisión" style={{ marginLeft: "auto" }}>
          <X size={18} aria-hidden />
        </button>
      </header>

      <div style={{ padding: "18px 16px 8px" }}>
        <div style={{ ...NUM, fontSize: 30, fontWeight: 700, color: T.text, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          {money(r.amount)} <span style={{ fontSize: 15, fontWeight: 600, color: T.textSub }}>{r.currency}</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 16, fontWeight: 600, color: T.text, fontFamily: T.font, overflowWrap: "anywhere" }}>{r.beneficiary}</div>
        {r.subtotal > 0 && (
          <div style={{ marginTop: 4, fontSize: 12, color: T.textMuted, ...NUM }}>
            Subtotal {money(r.subtotal)} · IVA {money(r.iva)}
          </div>
        )}
      </div>

      <dl style={{ margin: 0, padding: "12px 16px 16px", display: "grid", gap: 14 }}>
        <Datum label="Concepto" value={r.concept} />
        <div className="dp-grid-2">
          <Datum label="Proyecto / Depto." value={r.projectNumber} />
          <Datum label="OC" value={r.poNumber} />
          <Datum label="Solicitante" value={r.submittedBy} />
          <Datum label="Departamento" value={r.department} />
          <Datum label="Fecha de solicitud" value={fmtFecha(r.date)} />
        </div>
      </dl>

      {(r.clarificationRequest || r.clarificationResponse || r.comment) && (
        <div style={{ padding: "0 16px 16px", display: "grid", gap: 10 }}>
          {r.clarificationRequest && <Note title="Lo que se pidió aclarar" text={r.clarificationRequest} color={T.amber} faint={T.amberFaint} />}
          {r.clarificationResponse && <Note title="Respuesta del solicitante" text={r.clarificationResponse} color={T.jade} faint={T.jadeFaint} />}
          {r.comment && <Note title="Comentario" text={r.comment} color={T.amber} faint={T.amberFaint} />}
        </div>
      )}

      {/* Aprobar es la acción principal (relleno Jade, 44px); las otras dos son salidas, en tinte. */}
      <footer style={{ display: "grid", gap: 8, padding: 16, borderTop: `1px solid ${T.cardBorder}` }}>
        <ActionBtn solid large label="Aprobar" color={T.jade} icon={<CheckCircle2 size={16} />} onClick={onApprove} disabled={busy} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <ActionBtn large label="Aclaración" color={T.amber} icon={<HelpCircle size={15} />} onClick={onClarify} disabled={busy} />
          <ActionBtn large label="Rechazar" color={T.red} icon={<XCircle size={15} />} onClick={onReject} disabled={busy} />
        </div>
      </footer>
    </section>
  );
};
